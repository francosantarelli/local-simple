// Entrypoint Deno de `generar-borrador-factura` (contracts/generar-borrador-factura.md).
// Dos formas de invocarlo:
//   - Cron interno (Authorization: Bearer <service_role_key>): genera el
//     borrador automático semanal por rango de fechas, para todos los
//     locales (ver supabase/migrations/20260824000002_cron.sql).
//   - Usuario logueado (Authorization: Bearer <jwt>): genera un borrador
//     manual a partir de una selección puntual de ventas de SU local
//     (ventas.html). El local_id nunca se toma del request, siempre se
//     deriva del usuario autenticado (autorización server-side).
// Wiring real de Supabase sobre la lógica pura en ./logic.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generarBorradoresDeLaSemana, generarBorradorManual } from "./logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function manejarModoCron(body: Record<string, unknown>): Promise<Response> {
  const periodoDesde = body.periodo_desde as string | undefined;
  const periodoHasta = body.periodo_hasta as string | undefined;
  if (!periodoDesde || !periodoHasta) {
    return new Response(
      JSON.stringify({ message: "Faltan periodo_desde/periodo_hasta." }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const resultado = await generarBorradoresDeLaSemana(periodoDesde, periodoHasta, {
    async obtenerVentasNoFacturadas(desde, hasta) {
      const { data, error } = await admin
        .from("ventas")
        .select("id, local_id, modo_pago, precio_total")
        .is("factura_id", null)
        .gte("fecha", desde)
        .lte("fecha", hasta);
      if (error) throw new Error(error.message);
      return (data ?? []).map((v) => ({
        id: v.id,
        localId: v.local_id,
        modoPago: v.modo_pago,
        precioTotal: Number(v.precio_total),
      }));
    },

    async crearFacturaBorrador(grupo, desde, hasta) {
      // Upsert sobre la unique constraint (local_id, periodo_desde,
      // periodo_hasta, modo_pago) — solo aplica a origen='automatico'
      // (data-model.md) — reintentar el cron para la misma semana no
      // duplica facturas.
      const { data, error } = await admin
        .from("facturas")
        .upsert(
          {
            local_id: grupo.localId,
            periodo_desde: desde,
            periodo_hasta: hasta,
            modo_pago: grupo.modoPago,
            monto_total: grupo.montoTotal,
            estado: "borrador",
            origen: "automatico",
          },
          { onConflict: "local_id,periodo_desde,periodo_hasta,modo_pago" }
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { facturaId: data.id };
    },

    async vincularVentasAFactura(ventaIds, facturaId) {
      const { error } = await admin
        .from("ventas")
        .update({ factura_id: facturaId })
        .in("id", ventaIds);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(
    JSON.stringify({ facturas_generadas: resultado.facturasGeneradas }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

async function manejarModoManual(req: Request, body: Record<string, unknown>): Promise<Response> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ message: "Sin sesión válida." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("local_id")
    .eq("id", userData.user.id)
    .single();
  if (!profile) {
    return new Response(JSON.stringify({ message: "Usuario sin local asignado." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const ventaIds = body.venta_ids;
  if (!Array.isArray(ventaIds) || ventaIds.length === 0) {
    return new Response(JSON.stringify({ message: "Falta venta_ids." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const resultado = await generarBorradorManual(ventaIds, profile.local_id, {
    async obtenerVentasSeleccionadas(ids, localId) {
      // factura_id IS NULL: una venta ya reclamada por otro borrador (aunque
      // no esté emitido) no se puede volver a elegir. local_id=localId:
      // nunca confiar en que el cliente solo mande ventas propias.
      const { data, error } = await admin
        .from("ventas")
        .select("id, local_id, modo_pago, precio_total, fecha")
        .in("id", ids)
        .eq("local_id", localId)
        .is("factura_id", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((v) => ({
        id: v.id,
        localId: v.local_id,
        modoPago: v.modo_pago,
        precioTotal: Number(v.precio_total),
        fecha: v.fecha,
      }));
    },

    async crearFacturaBorrador(grupo) {
      // Insert simple (no upsert): las facturas manuales no comparten la
      // unique constraint de las automáticas (data-model.md). Si dos
      // tandas manuales coinciden exactamente en período/modo de
      // pago/local, el insert falla en vez de pisar silenciosamente el
      // monto de la otra factura.
      const { data, error } = await admin
        .from("facturas")
        .insert({
          local_id: grupo.localId,
          periodo_desde: grupo.periodoDesde,
          periodo_hasta: grupo.periodoHasta,
          modo_pago: grupo.modoPago,
          monto_total: grupo.montoTotal,
          estado: "borrador",
          origen: "manual",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { facturaId: data.id };
    },

    async vincularVentasAFactura(ventaIds, facturaId) {
      const { error } = await admin
        .from("ventas")
        .update({ factura_id: facturaId })
        .in("id", ventaIds);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(
    JSON.stringify({
      facturas_generadas: resultado.facturasGeneradas,
      ventas_omitidas: resultado.ventasOmitidas,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const esCron = req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`;

  try {
    return esCron ? await manejarModoCron(body) : await manejarModoManual(req, body);
  } catch (err) {
    return new Response(JSON.stringify({ message: (err as Error).message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

// Entrypoint Deno de `generar-borrador-factura`
// (contracts/generar-borrador-factura.md). Invocado por pg_cron cada
// viernes (ver supabase/migrations/20260824000002_cron.sql), nunca desde
// el frontend. Wiring real de Supabase sobre la lógica pura en ./logic.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generarBorradoresDeLaSemana } from "./logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Solo el cron interno (service role) puede invocar esta función.
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { periodo_desde, periodo_hasta } = await req.json().catch(() => ({}));
  if (!periodo_desde || !periodo_hasta) {
    return new Response(
      JSON.stringify({ message: "Faltan periodo_desde/periodo_hasta." }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const resultado = await generarBorradoresDeLaSemana(periodo_desde, periodo_hasta, {
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
      // periodo_hasta, modo_pago): reintentar el cron para la misma
      // semana no duplica facturas.
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
});

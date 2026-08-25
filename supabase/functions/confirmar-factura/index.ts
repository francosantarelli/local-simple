// Entrypoint Deno de `confirmar-factura` (contracts/confirmar-factura.md).
// Wiring real de Supabase + ARCA sobre la lógica pura en ./logic.ts.
//
// Límite conocido (Principio I, YAGNI): el certificado/clave de ARCA se
// leen de un único par de secretos (ARCA_CERT_PEM/ARCA_KEY_PEM), asumiendo
// un solo local con integración ARCA activa, acorde al alcance inicial de
// la constitution. Si en el futuro hace falta más de un local con
// facturación ARCA propia, esto necesita moverse a almacenamiento por
// local (ej. Supabase Vault), no a variables globales.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleConfirmarFactura } from "./logic.ts";
import {
  solicitarTicketAcceso,
  obtenerUltimoComprobanteAutorizado,
  solicitarCAE,
  tipoComprobantePorCondicionIva,
  type TicketAcceso,
} from "./arcaClient.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const wsaaUrl = Deno.env.get("ARCA_WSAA_URL")!;
const wsfeUrl = Deno.env.get("ARCA_WSFE_URL")!;
const certPem = Deno.env.get("ARCA_CERT_PEM")!;
const keyPem = Deno.env.get("ARCA_KEY_PEM")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function obtenerTicketVigente(localId: string): Promise<TicketAcceso> {
  const { data: cacheado } = await admin
    .from("arca_tickets")
    .select("token, sign, expira_en")
    .eq("local_id", localId)
    .maybeSingle();

  if (cacheado && new Date(cacheado.expira_en) > new Date()) {
    return { token: cacheado.token, sign: cacheado.sign, expiraEn: new Date(cacheado.expira_en) };
  }

  const { data: local } = await admin
    .from("locales")
    .select("cuit")
    .eq("id", localId)
    .single();

  const nuevoTicket = await solicitarTicketAcceso(wsaaUrl, {
    certPem,
    keyPem,
    cuit: local!.cuit,
  });

  await admin.from("arca_tickets").upsert({
    local_id: localId,
    token: nuevoTicket.token,
    sign: nuevoTicket.sign,
    expira_en: nuevoTicket.expiraEn.toISOString(),
    updated_at: new Date().toISOString(),
  });

  return nuevoTicket;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer /, "");
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

  const { factura_id: facturaId } = await req.json().catch(() => ({}));
  if (!facturaId) {
    return new Response(JSON.stringify({ message: "Falta factura_id." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const result = await handleConfirmarFactura(facturaId, userData.user.id, profile!.local_id, {
    async obtenerFactura(id) {
      const { data } = await admin
        .from("facturas")
        .select("id, local_id, estado")
        .eq("id", id)
        .maybeSingle();
      if (!data) return null;
      return { id: data.id, localId: data.local_id, estado: data.estado };
    },

    async emitirAnteArca(factura) {
      const { data: facturaCompleta } = await admin
        .from("facturas")
        .select("monto_total, locales(cuit, punto_venta, condicion_iva)")
        .eq("id", factura.id)
        .single();
      const local = facturaCompleta!.locales as unknown as {
        cuit: string;
        punto_venta: number;
        condicion_iva: string;
      };

      try {
        const ticket = await obtenerTicketVigente(factura.localId);
        const tipoComprobante = tipoComprobantePorCondicionIva(local.condicion_iva);
        const ultimoNumero = await obtenerUltimoComprobanteAutorizado(
          wsfeUrl,
          ticket,
          local.cuit,
          local.punto_venta,
          tipoComprobante
        );

        return await solicitarCAE(wsfeUrl, ticket, { certPem, keyPem, cuit: local.cuit }, {
          puntoVenta: local.punto_venta,
          tipoComprobante,
          importeTotal: Number(facturaCompleta!.monto_total),
          numeroComprobante: ultimoNumero + 1,
        });
      } catch (err) {
        return { aceptado: false, motivo: (err as Error).message };
      }
    },

    async marcarEmitida(id, cae, confirmadoPor) {
      await admin
        .from("facturas")
        .update({ estado: "emitida", cae, confirmado_por: confirmadoPor, confirmado_at: new Date().toISOString() })
        .eq("id", id);
    },

    async marcarRechazada(id, motivo) {
      await admin.from("facturas").update({ estado: "rechazada", motivo_rechazo: motivo }).eq("id", id);
    },
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
});

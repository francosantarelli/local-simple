// Entrypoint Deno de `confirmar-factura` (contracts/confirmar-factura.md).
// Wiring real de Supabase + ARCA sobre la lógica pura en ./logic.ts.
//
// El certificado/clave de ARCA son por local (tabla `local_arca_credentials`,
// cada local puede tener su propio CUIT), no un secreto global — ver
// supabase/migrations/20260831000000_local_arca_credentials.sql. WSAA/WSFEv1
// sí son globales: son los mismos endpoints de ARCA para todos los locales,
// solo cambian entre homologación y producción (una decisión de ambiente,
// no de tenant).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleConfirmarFactura } from "./logic.ts";
import {
  solicitarTicketAcceso,
  obtenerUltimoComprobanteAutorizado,
  solicitarCAE,
  tipoComprobantePorCondicionIva,
  type CredencialesArca,
  type TicketAcceso,
} from "./arcaClient.ts";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const wsaaUrl = Deno.env.get("ARCA_WSAA_URL")!;
const wsfeUrl = Deno.env.get("ARCA_WSFE_URL")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function obtenerCredencialesArca(
  localId: string
): Promise<Pick<CredencialesArca, "certPem" | "keyPem"> | null> {
  const { data } = await admin
    .from("local_arca_credentials")
    .select("cert_pem, key_pem")
    .eq("local_id", localId)
    .maybeSingle();
  if (!data) return null;
  return { certPem: data.cert_pem, keyPem: data.key_pem };
}

async function obtenerTicketVigente(
  localId: string,
  credenciales: Pick<CredencialesArca, "certPem" | "keyPem">
): Promise<TicketAcceso> {
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
    ...credenciales,
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer /, "");
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ message: "Sin sesión válida." }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
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
      headers: { ...corsHeaders, "content-type": "application/json" },
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
      const credenciales = await obtenerCredencialesArca(factura.localId);
      if (!credenciales) {
        return {
          aceptado: false,
          motivo: "Este local no tiene un certificado ARCA configurado. Contactá al administrador.",
        };
      }

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
        const ticket = await obtenerTicketVigente(factura.localId, credenciales);
        const tipoComprobante = tipoComprobantePorCondicionIva(local.condicion_iva);
        const ultimoNumero = await obtenerUltimoComprobanteAutorizado(
          wsfeUrl,
          ticket,
          local.cuit,
          local.punto_venta,
          tipoComprobante
        );

        return await solicitarCAE(wsfeUrl, ticket, { ...credenciales, cuit: local.cuit }, {
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
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});

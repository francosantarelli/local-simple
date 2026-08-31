// Entrypoint Deno de `confirmar-factura` (contracts/confirmar-factura.md).
// Wiring real de Supabase + ARCA sobre la lógica pura en ./logic.ts.
//
// El certificado/clave de ARCA son por local Y por entorno (tabla
// `local_arca_credentials`, cada local puede tener a la vez un certificado
// de homologación/sandbox y uno de producción, con CUITs distintos), no un
// secreto global — ver supabase/migrations/20260831000001_arca_entorno.sql.
// `locales.arca_entorno_activo` decide cuál de los dos usa este endpoint al
// emitir. Las URL de WSAA/WSFEv1 son fijas por entorno (las mismas para
// todos los locales homologación/producción de ARCA), así que van
// hardcodeadas acá en vez de ser secretos configurables.
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

type ArcaEntorno = "homologacion" | "produccion";

// URLs públicas y fijas de ARCA (ex AFIP). Las de producción no fueron
// validadas todavía en este entorno de desarrollo (sin certificado de
// producción disponible) — confirmar contra la documentación oficial de
// ARCA antes de que algún local pase `arca_entorno_activo` a 'produccion'.
const ARCA_ENDPOINTS: Record<ArcaEntorno, { wsaaUrl: string; wsfeUrl: string }> = {
  homologacion: {
    wsaaUrl: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfeUrl: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  produccion: {
    wsaaUrl: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfeUrl: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface CredencialesLocal extends Pick<CredencialesArca, "certPem" | "keyPem"> {
  entorno: ArcaEntorno;
  wsaaUrl: string;
  wsfeUrl: string;
}

async function obtenerCredencialesArca(localId: string): Promise<CredencialesLocal | null> {
  const { data: local } = await admin
    .from("locales")
    .select("arca_entorno_activo")
    .eq("id", localId)
    .single();
  const entorno = (local?.arca_entorno_activo ?? "homologacion") as ArcaEntorno;

  const { data } = await admin
    .from("local_arca_credentials")
    .select("cert_pem, key_pem")
    .eq("local_id", localId)
    .eq("entorno", entorno)
    .maybeSingle();
  if (!data) return null;

  return { certPem: data.cert_pem, keyPem: data.key_pem, entorno, ...ARCA_ENDPOINTS[entorno] };
}

async function obtenerTicketVigente(localId: string, credenciales: CredencialesLocal): Promise<TicketAcceso> {
  const { data: cacheado } = await admin
    .from("arca_tickets")
    .select("token, sign, expira_en")
    .eq("local_id", localId)
    .eq("entorno", credenciales.entorno)
    .maybeSingle();

  if (cacheado && new Date(cacheado.expira_en) > new Date()) {
    return { token: cacheado.token, sign: cacheado.sign, expiraEn: new Date(cacheado.expira_en) };
  }

  const { data: local } = await admin
    .from("locales")
    .select("cuit")
    .eq("id", localId)
    .single();

  const nuevoTicket = await solicitarTicketAcceso(credenciales.wsaaUrl, {
    certPem: credenciales.certPem,
    keyPem: credenciales.keyPem,
    cuit: local!.cuit,
  });

  await admin.from("arca_tickets").upsert({
    local_id: localId,
    entorno: credenciales.entorno,
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
          credenciales.wsfeUrl,
          ticket,
          local.cuit,
          local.punto_venta,
          tipoComprobante
        );

        return await solicitarCAE(
          credenciales.wsfeUrl,
          ticket,
          { certPem: credenciales.certPem, keyPem: credenciales.keyPem, cuit: local.cuit },
          {
            puntoVenta: local.punto_venta,
            tipoComprobante,
            importeTotal: Number(facturaCompleta!.monto_total),
            numeroComprobante: ultimoNumero + 1,
          }
        );
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

// Cliente WSAA + WSFEv1 de ARCA (ex AFIP) — research.md §1-2. Este módulo
// hace las llamadas SOAP reales; no tiene tests unitarios porque su
// correctitud depende de un certificado real (validado de punta a punta
// contra homologación el 2026-08-29, incluyendo un FECAESolicitar real que
// devolvió CAE — ver README.md para el detalle y los bugs que esa prueba
// destapó). Validar de nuevo contra homologación si se toca el armado de
// los requests/parseo de respuestas SOAP antes de pasar a producción.
import forge from "npm:node-forge@1.3.1";

export interface CredencialesArca {
  certPem: string;
  keyPem: string;
  cuit: string;
}

export interface TicketAcceso {
  token: string;
  sign: string;
  expiraEn: Date;
}

function extraerTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

// WSAA devuelve loginCmsReturn como el XML de loginTicketResponse
// HTML-escapado dentro del sobre SOAP (confirmado contra homologación
// real el 2026-08-29), así que hay que desescapar antes de buscar tags.
function desescaparEntidadesXml(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function firmarLoginTicketRequest(xml: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  p7.addCertificate(cert);
  p7.addSigner({ key, certificate: cert, digestAlgorithm: forge.pki.oids.sha256 });
  p7.sign({ detached: false });
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

function construirLoginTicketRequest(service: string): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expirationTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

// Solicita un nuevo Ticket de Acceso (TA) a WSAA. El llamador es
// responsable de cachearlo (research.md §2) — este cliente no cachea.
export async function solicitarTicketAcceso(
  wsaaUrl: string,
  credenciales: CredencialesArca
): Promise<TicketAcceso> {
  const loginTicketRequest = construirLoginTicketRequest("wsfe");
  const cms = firmarLoginTicketRequest(loginTicketRequest, credenciales.certPem, credenciales.keyPem);

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="https://wsaa.afip.gov.ar/ws/services/LoginCms">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(wsaaUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
    body: soapBody,
  });
  const xml = desescaparEntidadesXml(await response.text());
  const token = extraerTag(xml, "token");
  const sign = extraerTag(xml, "sign");
  const expirationTime = extraerTag(xml, "expirationTime");
  if (!token || !sign || !expirationTime) {
    throw new Error(`WSAA no devolvió un ticket válido: ${xml.slice(0, 500)}`);
  }
  return { token, sign, expiraEn: new Date(expirationTime) };
}

export interface SolicitudFactura {
  puntoVenta: number;
  tipoComprobante: number; // 1=A, 6=B, 11=C
  importeTotal: number;
  numeroComprobante: number;
}

export type ResultadoArca =
  | { aceptado: true; cae: string }
  | { aceptado: false; motivo: string };

export function tipoComprobantePorCondicionIva(condicionIva: string): number {
  // Simplificación deliberada: se asume venta a consumidor final (no se
  // captura CUIT del comprador en esta feature). Monotributo emite
  // Factura C; Responsable Inscripto y Exento emiten Factura B a
  // consumidor final.
  switch (condicionIva) {
    case "monotributo":
      return 11;
    case "responsable_inscripto":
    case "exento":
      return 6;
    default:
      throw new Error(`condición de IVA desconocida: ${condicionIva}`);
  }
}

export async function obtenerUltimoComprobanteAutorizado(
  wsfeUrl: string,
  ticket: TicketAcceso,
  cuit: string,
  puntoVenta: number,
  tipoComprobante: number
): Promise<number> {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${ticket.token}</ar:Token>
        <ar:Sign>${ticket.sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(wsfeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    },
    body: soapBody,
  });
  const xml = await response.text();
  const ultimo = extraerTag(xml, "CbteNro");
  return ultimo ? Number(ultimo) : 0;
}

// CondicionIVAReceptorId=5 (Consumidor Final) e Iva con alícuota 0% son
// consistentes con la simplificación ya documentada en
// tipoComprobantePorCondicionIva: no se captura CUIT del comprador ni se
// discrimina IVA. Ambos campos son obligatorios en WSFEv1 desde la RG
// 5616/2024 (CondicionIVAReceptorId) y siempre que ImpNeto > 0 (Iva);
// confirmado contra homologación el 2026-08-29 (ver README.md).
export async function solicitarCAE(
  wsfeUrl: string,
  ticket: TicketAcceso,
  credenciales: CredencialesArca,
  solicitud: SolicitudFactura
): Promise<ResultadoArca> {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const importe = solicitud.importeTotal.toFixed(2);
  // Factura C (11, monotributo) no discrimina IVA: WSFEv1 rechaza el
  // comprobante si se informa el bloque Iva. Factura A/B sí lo exige
  // cuando ImpNeto > 0 (confirmado contra homologación el 2026-08-29).
  const ivaXml =
    solicitud.tipoComprobante === 11
      ? ""
      : `
            <ar:Iva>
              <ar:AlicIva>
                <ar:Id>3</ar:Id>
                <ar:BaseImp>${importe}</ar:BaseImp>
                <ar:Importe>0.00</ar:Importe>
              </ar:AlicIva>
            </ar:Iva>`;

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${ticket.token}</ar:Token>
        <ar:Sign>${ticket.sign}</ar:Sign>
        <ar:Cuit>${credenciales.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${solicitud.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${solicitud.tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>2</ar:Concepto>
            <ar:DocTipo>99</ar:DocTipo>
            <ar:DocNro>0</ar:DocNro>
            <ar:CbteDesde>${solicitud.numeroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${solicitud.numeroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${fecha}</ar:CbteFch>
            <ar:ImpTotal>${importe}</ar:ImpTotal>
            <ar:ImpTotConc>0</ar:ImpTotConc>
            <ar:ImpNeto>${importe}</ar:ImpNeto>
            <ar:ImpOpEx>0</ar:ImpOpEx>
            <ar:ImpIVA>0</ar:ImpIVA>
            <ar:ImpTrib>0</ar:ImpTrib>
            <ar:FchServDesde>${fecha}</ar:FchServDesde>
            <ar:FchServHasta>${fecha}</ar:FchServHasta>
            <ar:FchVtoPago>${fecha}</ar:FchVtoPago>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
            <ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>${ivaXml}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(wsfeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    },
    body: soapBody,
  });
  const xml = await response.text();
  const resultado = extraerTag(xml, "Resultado");
  const cae = extraerTag(xml, "CAE");

  if (resultado === "A" && cae) {
    return { aceptado: true, cae };
  }
  const motivo = extraerTag(xml, "Msg") ?? `ARCA rechazó el comprobante: ${xml.slice(0, 300)}`;
  return { aceptado: false, motivo };
}

# Secretos requeridos: `confirmar-factura`

Configurar con `supabase secrets set` (nunca commitear valores reales — Principio IV):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto (la setea Supabase automáticamente en runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key del proyecto (la setea Supabase automáticamente) |
| `ARCA_WSAA_URL` | URL del servicio WSAA (`https://wsaahomo.afip.gov.ar/ws/services/LoginCms` en homologación) |
| `ARCA_WSFE_URL` | URL del servicio WSFEv1 (`https://wswhomo.afip.gov.ar/wsfev1/service.asmx` en homologación) |
| `ARCA_CERT_PEM` | Certificado X.509 del local, en formato PEM |
| `ARCA_KEY_PEM` | Clave privada asociada al certificado, en formato PEM |

Límite conocido (documentado también en `index.ts`): estos dos últimos secretos son
globales a la función, es decir que hoy solo soportan **un** local con integración ARCA
activa (el alcance inicial de la constitution). Si más adelante hace falta más de un
local facturando por su cuenta, hay que moverlos a almacenamiento por local (ej.
Supabase Vault) en vez de variables de entorno globales — no antes, por el Principio I.

Validado de punta a punta contra el ambiente de **homologación** de ARCA (2026-08-29):
certificado real (CUIT 27357665278, alias `analocalsimple`, servicio `wsfe` asociado vía
WSASS), función `confirmar-factura` desplegada y llamada real vía HTTP con un usuario y
una factura de prueba reales en la base — devolvió `{"estado":"emitida","cae":"8635082710
1538"}`. En el camino se encontraron y corrigieron cinco problemas reales en
`arcaClient.ts` (ninguno visible sin pegarle a un WSAA/WSFEv1 real, por eso no se habían
notado antes):

1. WSFEv1 exige el header `SOAPAction` correcto por operación (WSAA no lo exige).
2. WSAA devuelve `loginCmsReturn` como el XML de respuesta **HTML-escapado dentro de un
   string** (`&lt;token&gt;...`) — `extraerTag` buscaba `<token>` literal y nunca
   encontraba nada. Se agregó `desescaparEntidadesXml` antes de parsear la respuesta de
   WSAA. Este era el bug raíz: sin él, WSAA nunca devolvía un ticket válido.
3. `CondicionIVAReceptorId` es obligatorio desde la RG 5616/2024 — se envía fijo en `5`
   (Consumidor Final), consistente con que no se captura CUIT del comprador.
4. El detalle de `Iva` es obligatorio para Factura A/B si `ImpNeto > 0` — se envía con
   alícuota `3` (0%), consistente con que `ImpIVA` ya se manda en `0`.
5. Para Factura C (monotributo, `CbteTipo=11`) el bloque `Iva` está **prohibido** (regla
   opuesta a la de A/B) — ahora es condicional según `tipoComprobante`.

Antes de pasar a producción, generar y asociar un certificado de **producción** (WSASS
es solo para homologación) y repetir la validación contra los endpoints productivos.

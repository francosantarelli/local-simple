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

Antes de producción, validar `arcaClient.ts` contra el ambiente de **homologación** de
ARCA: no fue probado contra un certificado real en este entorno de desarrollo.

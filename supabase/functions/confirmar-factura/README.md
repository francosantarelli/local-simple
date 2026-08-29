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

Validado manualmente contra el ambiente de **homologación** de ARCA (2026-08-29): login
WSAA con certificado real (CUIT 27357665278, alias `analocalsimple`, servicio `wsfe`
asociado vía WSASS), y `FECAESolicitar` contra WSFEv1 devolvió un CAE real de prueba
(`Resultado=A`). Esta prueba manual (fuera de `arcaClient.ts`, con `curl`) destapó tres
problemas que ya están corregidos en el cliente:

1. WSFEv1 exige el header `SOAPAction` correcto por operación (WSAA no lo exige, por
   eso no se había notado antes).
2. `CondicionIVAReceptorId` es obligatorio desde la RG 5616/2024 — se envía fijo en `5`
   (Consumidor Final), consistente con que no se captura CUIT del comprador.
3. El detalle de `Iva` es obligatorio si `ImpNeto > 0` — se envía con alícuota `3` (0%),
   consistente con que `ImpIVA` ya se manda en `0`.

Antes de pasar a producción, generar y asociar un certificado de **producción** (WSASS
es solo para homologación) y repetir la validación contra los endpoints productivos.

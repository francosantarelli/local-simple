# Secretos y credenciales: `confirmar-factura`

## Secretos globales (`supabase secrets set`)

Nunca commitear valores reales (Principio IV):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto (la setea Supabase automáticamente en runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key del proyecto (la setea Supabase automáticamente) |

Las URL de WSAA/WSFEv1 **no** son secretos configurables: son fijas por entorno (las mismas
para todos los locales de ARCA en homologación, y las mismas para todos en producción) y
están hardcodeadas en `index.ts` (`ARCA_ENDPOINTS`).

## Certificado por local y por entorno (tabla `local_arca_credentials`)

El certificado X.509 y la clave privada son por local **y por entorno** — cada local puede
tener a la vez un certificado de homologación (sandbox) y uno de producción, cada uno con
su propio CUIT si hace falta. Viven en `local_arca_credentials`
(`supabase/migrations/20260831000001_arca_entorno.sql`), con RLS habilitada y sin ninguna
policy: ni anon ni authenticated pueden leer/escribir esa tabla nunca, solo el service role
de esta Edge Function.

`locales.arca_entorno_activo` (`'homologacion'` por default, o `'produccion'`) decide cuál
de los dos certificados usa `confirmar-factura` al emitir. Un local sin fila para su
entorno activo no puede emitir todavía — "Confirmar y emitir" le va a devolver la factura
como rechazada con el motivo "Este local no tiene un certificado ARCA configurado."

Para cargar o actualizar el certificado de un local en un entorno, correr en el **SQL
Editor** del dashboard de Supabase (nunca en una migración commiteada — Principio IV):

```sql
insert into local_arca_credentials (local_id, entorno, cert_pem, key_pem)
values (
  '<uuid-del-local>',
  'homologacion',  -- o 'produccion'
  '-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----',
  '-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----'
)
on conflict (local_id, entorno) do update
  set cert_pem = excluded.cert_pem,
      key_pem = excluded.key_pem;
```

Y para cambiar cuál de los dos usa el local al emitir:

```sql
update locales
set arca_entorno_activo = 'produccion'  -- o 'homologacion'
where id = '<uuid-del-local>';
```

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

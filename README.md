# local-simple

Carga de ventas y facturación semanal en ARCA para un local. Ver
[specs/001-ventas-facturacion-arca/](specs/001-ventas-facturacion-arca/) para la spec,
el plan técnico y las decisiones de diseño completas.

## Configuración

### Frontend (`docs/js/config.js`)

Editar con la URL y anon key del proyecto Supabase real:

```js
export const LOCAL_SIMPLE_CONFIG = {
  supabaseUrl: "https://<project-ref>.supabase.co",
  supabaseAnonKey: "<anon-key>",
};
```

La anon key es segura de exponer en el cliente (el aislamiento de datos lo garantiza RLS,
ver `supabase/migrations/20260824000001_rls.sql`). **Nunca** poner acá la service role key
ni credenciales de ARCA.

### Secretos de Edge Functions (`supabase secrets set ...`)

Nunca commitear valores reales (Principio IV de la constitution).

| Variable | Usada por | Descripción |
|---|---|---|
| `RESEND_API_KEY` | `recuperar-password` | API key de Resend para enviar el email de recuperación (research.md §6) |
| `EMAIL_FROM` | `recuperar-password` | Remitente del email de recuperación |
| `ARCA_WSAA_URL` | `confirmar-factura` | URL del servicio WSAA de ARCA (homologación o producción) |
| `ARCA_WSFE_URL` | `confirmar-factura` | URL del servicio WSFEv1 de ARCA |
| `ARCA_CERT_PEM` | `confirmar-factura` | Certificado X.509 del local (PEM) |
| `ARCA_KEY_PEM` | `confirmar-factura` | Clave privada asociada (PEM) |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los setea Supabase automáticamente en runtime,
no hace falta configurarlos a mano. Ver también
[supabase/functions/confirmar-factura/README.md](supabase/functions/confirmar-factura/README.md)
para el límite conocido de un solo local por ahora.

### Cron semanal

`supabase/migrations/20260824000002_cron.sql` programa el borrador de factura de los
viernes, pero necesita que se configuren estos settings de base una vez por proyecto (no
son secretos de Edge Function, son settings de Postgres):

```sql
alter database postgres set app.settings.supabase_functions_url = 'https://<project-ref>.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = '<service-role-key>';
```

## Desarrollo

```sh
npm install
npm test              # corre toda la suite de Vitest
supabase start        # levanta Postgres + Auth + Edge Functions local (requiere Docker)
supabase db push      # aplica las migraciones de supabase/migrations/
```

Para correr también los tests de integración de RLS (`tests/functions/rls.test.ts`, que se
saltan por defecto), definir antes de `npm test`:

```sh
TEST_SUPABASE_URL=...
TEST_SUPABASE_SERVICE_ROLE_KEY=...
TEST_SUPABASE_ANON_KEY=...
```

(`supabase status` muestra estos valores para el stack local.)

Servir `docs/` con cualquier servidor estático (sin build):

```sh
npx serve docs/
```

## Estado conocido / pendiente

- El cliente ARCA (`supabase/functions/confirmar-factura/arcaClient.ts`) no fue probado
  contra el ambiente de homologación real de ARCA en este entorno de desarrollo (sin
  Docker ni certificado disponibles) — validar antes de producción
  ([quickstart.md](specs/001-ventas-facturacion-arca/quickstart.md) paso 5).
- `tests/functions/rls.test.ts` requiere una instancia real de Supabase para correr; queda
  saltado hasta que se configuren las variables `TEST_SUPABASE_*` de arriba.

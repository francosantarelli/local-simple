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

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los setea Supabase automáticamente en runtime,
no hace falta configurarlos a mano.

El certificado/clave de ARCA **no** es un secreto global: cada local puede tener uno de
homologación (sandbox) y otro de producción a la vez, en la tabla `local_arca_credentials`,
y `locales.arca_entorno_activo` dice cuál de los dos usa al emitir (un local sin fila para
su entorno activo simplemente no puede emitir facturas todavía). Las URL de WSAA/WSFEv1 no
son configurables: son fijas por entorno y están hardcodeadas en
`confirmar-factura/index.ts`. Ver
[supabase/functions/confirmar-factura/README.md](supabase/functions/confirmar-factura/README.md)
para cómo cargar el certificado y cambiar de entorno.

### Cron semanal

`supabase/migrations/20260824000002_cron.sql` (y su corrección,
`20260824000004_cron_fix_vault.sql`) programan el borrador de factura de los viernes. En
Supabase gestionado (no self-hosted), `alter database ... set app.settings.*` da
`permission denied` — el service_role_key se lee en cambio desde **Supabase Vault**. Hay
que crearlo una sola vez por proyecto, corriendo esto en el SQL Editor del dashboard (nunca
en una migración commiteada):

```sql
select vault.create_secret('<service-role-key>', 'service_role_key');
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

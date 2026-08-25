# Contracts: Ventas y facturación semanal ARCA

Dos formas de acceso conviven en esta feature:

1. **CRUD directo vía Supabase (PostgREST) bajo RLS**: alta de ventas, listado/filtrado de
   ventas, listado de productos, listado y detalle de facturas. No requieren un endpoint
   custom: el frontend usa el cliente JS de Supabase contra las tablas de
   [data-model.md](../data-model.md), y RLS garantiza el aislamiento por local (research.md
   §5). No se documentan como "contrato" aparte porque el contrato es el propio esquema de
   tablas + políticas RLS.
2. **Edge Functions custom**, para todo lo que requiere lógica server-side o secretos que no
   pueden vivir en el cliente (Principio IV). Documentadas una por una en este directorio:
   - [`recuperar-password.md`](./recuperar-password.md)
   - [`generar-borrador-factura.md`](./generar-borrador-factura.md)
   - [`confirmar-factura.md`](./confirmar-factura.md)

Todas las Edge Functions requieren un JWT de Supabase Auth válido (usuario logueado), excepto
`generar-borrador-factura`, que se invoca desde el cron interno (`pg_cron`) con la service role
key, nunca expuesta al cliente.

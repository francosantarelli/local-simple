# Edge Function: `generar-borrador-factura`

Corresponde a FR-011, más la generación manual agregada después del alcance inicial. Tiene dos
modos de invocación, distinguidos por el header `Authorization`:

- **Modo cron** (`Bearer <service-role-key>`): invocado por `pg_cron` cada viernes
  (research.md §3). Genera el borrador automático semanal, para todos los locales, agrupando
  por rango de fechas. No se expone a usuarios del frontend.
- **Modo manual** (`Bearer <jwt-usuario>`): invocado desde `ventas.html` por un usuario logueado
  que elige puntualmente qué ventas no facturadas de su local agrupar en un borrador, sin
  esperar al cierre semanal. El `local_id` nunca se toma del request: siempre se deriva del
  usuario autenticado.

## Request — modo cron

```
POST /functions/v1/generar-borrador-factura
Authorization: Bearer <service-role-key>
Content-Type: application/json

{ "periodo_desde": "YYYY-MM-DD", "periodo_hasta": "YYYY-MM-DD" }
```

## Request — modo manual

```
POST /functions/v1/generar-borrador-factura
Authorization: Bearer <jwt-usuario>
Content-Type: application/json

{ "venta_ids": ["uuid", "uuid", ...] }
```

## Behavior

### Modo cron

1. Para cada `local_id` con al menos una venta donde `factura_id IS NULL` y `fecha` esté en el
   rango `[periodo_desde, periodo_hasta]`, agrupa esas ventas por `modo_pago`.
2. Por cada grupo no vacío: hace upsert (sobre la unique constraint que aplica a
   `origen = 'automatico'`, ver [data-model.md](../data-model.md)) de una fila en `facturas`
   con `estado = 'borrador'`, `origen = 'automatico'` y `monto_total` = suma del grupo, y
   vincula `ventas.factura_id` a esa factura.
3. Si un local no tiene ventas no facturadas en el período, no genera ninguna factura para ese
   local (edge case de la spec).
4. Es idempotente: reintentar para el mismo período no duplica facturas ni vuelve a incluir
   ventas ya asociadas a un borrador o factura existente.

### Modo manual

1. Resuelve el `local_id` del usuario autenticado (vía `profiles`).
2. Filtra `venta_ids` a solo las que pertenecen a ESE local y tienen `factura_id IS NULL`
   (una venta ya reclamada por otro borrador, aunque no esté emitido, no se puede volver a
   elegir). Las que no cumplen quedan en `ventas_omitidas`.
3. Agrupa las ventas resultantes por `modo_pago`; el período de cada grupo (`periodo_desde`/
   `periodo_hasta`) es el rango mín/máx de `fecha` dentro de ese grupo, no una semana fija.
4. Por cada grupo: inserta una fila en `facturas` con `estado = 'borrador'`,
   `origen = 'manual'` (insert simple, no upsert — no comparte la unique constraint de las
   automáticas) y vincula `ventas.factura_id`.

## Response

```
200 OK
{ "facturas_generadas": <n> }                                    // modo cron
{ "facturas_generadas": <n>, "ventas_omitidas": ["uuid", ...] }   // modo manual
```

## Errors

| Status | Motivo |
|---|---|
| 400 | Faltan `periodo_desde`/`periodo_hasta` (cron) o `venta_ids` (manual) |
| 401 | Sin service role key (cron) ni sesión válida (manual) |
| 403 | (Manual) el usuario no tiene un local asignado |
| 500 | Error de base de datos al agrupar/crear facturas |

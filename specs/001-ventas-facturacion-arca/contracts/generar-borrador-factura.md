# Edge Function: `generar-borrador-factura`

Corresponde a FR-011. Se invoca desde `pg_cron` cada viernes (research.md §3), con la service
role key. No se expone a usuarios del frontend.

## Request

```
POST /functions/v1/generar-borrador-factura
Authorization: Bearer <service-role-key>   # solo cron interno
Content-Type: application/json

{ "periodo_desde": "YYYY-MM-DD", "periodo_hasta": "YYYY-MM-DD" }
```

## Behavior

1. Para cada `local_id` con al menos una venta donde `factura_id IS NULL` y `fecha` esté en el
   rango `[periodo_desde, periodo_hasta]`:
   - Agrupa esas ventas por `modo_pago`.
   - Por cada grupo no vacío: crea (o reutiliza si ya existe, ver unicidad en
     [data-model.md](../data-model.md)) una fila en `facturas` con `estado = 'borrador'` y
     `monto_total` = suma de `precio_total` del grupo.
   - Actualiza `ventas.factura_id` de ese grupo apuntando a la factura recién creada.
2. Si un local no tiene ventas no facturadas en el período, no genera ninguna factura para ese
   local (edge case de la spec).
3. Es idempotente: si se vuelve a invocar para el mismo período, no duplica facturas ni vuelve
   a incluir ventas ya asociadas a un borrador o factura existente.

## Response

```
200 OK
{ "facturas_generadas": <n>, "locales_sin_ventas": <n> }
```

## Errors

| Status | Motivo |
|---|---|
| 401 | Llamada sin service role key (no autorizada) |
| 500 | Error de base de datos al agrupar/crear facturas |

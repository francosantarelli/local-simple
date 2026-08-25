# Edge Function: `confirmar-factura`

Corresponde a FR-012, FR-013, FR-014. Un usuario logueado confirma un borrador de factura,
disparando la emisión real ante ARCA (WSAA + WSFEv1, research.md §1-2).

## Request

```
POST /functions/v1/confirmar-factura
Authorization: Bearer <jwt-usuario>
Content-Type: application/json

{ "factura_id": "uuid" }
```

## Behavior

1. Verifica que la factura exista, pertenezca al `local_id` del usuario autenticado (vía RLS +
   chequeo explícito) y esté en estado `borrador` o `rechazada`.
2. Obtiene/renueva el Ticket de Acceso WSAA del local (research.md §2).
3. Llama a WSFEv1 solicitando el CAE para el comprobante correspondiente (tipo A/B/C según
   `locales.condicion_iva`, numerado por `locales.punto_venta`), con el `monto_total` y el
   detalle de ventas incluidas.
4. Si ARCA acepta:
   - Actualiza la factura: `estado = 'emitida'`, `cae`, `confirmado_por`, `confirmado_at`.
   - Las ventas asociadas (ya con `factura_id` seteado desde el borrador) quedan efectivamente
     "facturadas" (ver nota de integridad en [data-model.md](../data-model.md)).
5. Si ARCA rechaza o falla la comunicación:
   - Actualiza la factura: `estado = 'rechazada'` (permite reintentar más tarde).
   - Ninguna venta queda marcada como facturada (FR-014).

## Response

```
200 OK
{ "estado": "emitida", "cae": "string", "monto_total": 0 }
```

o

```
200 OK
{ "estado": "rechazada", "motivo": "string" }
```

## Errors

| Status | Motivo |
|---|---|
| 401 | Sin sesión válida |
| 403 | La factura no pertenece al local del usuario |
| 404 | `factura_id` inexistente |
| 409 | La factura ya está `emitida` (inmutable, Principio V) — no se puede volver a confirmar |
| 502 | Error de comunicación con ARCA (se guarda como `rechazada` igualmente) |

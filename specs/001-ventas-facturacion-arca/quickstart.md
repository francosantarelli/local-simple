# Quickstart: Ventas y facturación semanal ARCA

Guía para validar el flujo completo end-to-end una vez implementada la feature. Referencias:
[data-model.md](./data-model.md), [contracts/](./contracts/).

## Prerrequisitos

- Proyecto Supabase creado (o `supabase start` local) con las migraciones de
  [data-model.md](./data-model.md) aplicadas.
- Edge Functions desplegadas: `recuperar-password`, `generar-borrador-factura`,
  `confirmar-factura` (ver [contracts/](./contracts/)).
- Certificado y clave privada de ARCA cargados como secretos de las Edge Functions (nunca en
  el repo ni en el cliente — Principio IV), apuntando al ambiente de **homologación** de ARCA
  para pruebas.
- Frontend estático servido localmente (sin build, `npx serve docs/` o similar).

## 1. Sembrar datos base (fuera del alcance de la app, alta manual)

Insertar directamente en la base (SQL o Supabase Studio), conforme a la decisión de
`/speckit-clarify` de que la creación de locales/usuarios es manual:

1. Un registro en `locales` con datos fiscales de prueba (CUIT de homologación, `condicion_iva`,
   `punto_venta` habilitado en homologación).
2. Un usuario en Supabase Auth (email interno sintético, research.md §4) + su fila en
   `profiles` con `username`, `recovery_email` y `local_id` apuntando al local anterior.
3. (Opcional) uno o dos `productos` de prueba para validar el catálogo.

Ejemplo de SQL para los pasos 1 y 3 (correr en el SQL editor de Supabase Studio; el usuario del
paso 2 se crea aparte, desde Authentication → Add user, con el email sintético
`<username>@usuarios.local-simple.internal`, y luego se inserta su fila en `profiles` con el
`id` de ese usuario):

```sql
insert into locales (nombre_fantasia, razon_social, cuit, condicion_iva, punto_venta, domicilio_fiscal)
values ('Kiosco de prueba', 'Kiosco de Prueba SRL', '20111111112', 'monotributo', 1, 'Calle Falsa 123')
returning id;

-- con el id devuelto arriba y el id del usuario creado en Authentication:
insert into profiles (id, username, recovery_email, local_id)
values ('<uuid-del-usuario-auth>', 'demo', 'demo@example.com', '<uuid-del-local>');

insert into productos (local_id, nombre, precio_unitario)
values ('<uuid-del-local>', 'Café', 2500);
```

## 2. Login y aislamiento por local (US1)

1. Abrir el frontend, loguearse con el `username`/contraseña sembrados.
2. Verificar que solo se ven datos del local sembrado (productos, ventas, facturas vacíos al
   inicio).
3. Repetir con un segundo local/usuario y confirmar que no hay cruce de datos entre ambos
   (SC-006).
4. Probar "olvidé mi contraseña" con el `username` sembrado y confirmar que llega el email al
   `recovery_email` configurado.

## 3. Cargar ventas (US2)

1. Cargar una venta eligiendo un producto del catálogo → confirmar que el precio unitario se
   autocompleta.
2. Cargar una venta con descripción libre (sin producto) → confirmar que se guarda igual.
3. Intentar cargar una venta con cantidad o precio inválido (negativo o vacío) → confirmar que
   el sistema la rechaza sin guardar.
4. Confirmar que ambas ventas válidas aparecen en el listado en menos de unos segundos (SC-002).

## 4. Listado y filtros (US3)

1. Cargar ventas con ambos modos de pago (`tarjeta` y `efectivo`) y fechas distintas.
2. Filtrar por rango de fechas y verificar que solo aparecen las ventas dentro del rango.
3. Filtrar por modo de pago y verificar el subconjunto correcto.
4. Filtrar por estado de facturación (`no facturada`, ninguna debería estar `facturada` todavía
   en este punto).

## 5. Cierre semanal y emisión de factura (US4)

1. Invocar manualmente `generar-borrador-factura` (simulando el cron) con el rango de la semana
   donde se cargaron las ventas del paso 3-4.
2. Verificar que se creó una fila en `facturas` por cada modo de pago con ventas no facturadas,
   en estado `borrador`, con `monto_total` correcto.
3. Verificar que las ventas incluidas ya tienen `factura_id` apuntando al borrador, pero siguen
   filtrando como "no facturadas" (ver nota de integridad en data-model.md) — es decir, todavía
   se pueden editar/eliminar en este estado.
4. Invocar `confirmar-factura` con el `factura_id` del borrador.
5. **Camino feliz** (ambiente de homologación responde OK): verificar que la factura pasa a
   `emitida` con `cae` completo, y que las ventas incluidas ahora sí figuran como `facturada` en
   el listado (US3) y ya no pueden editarse/eliminarse (FR-015).
6. **Camino de rechazo** (forzar un dato inválido, ej. CUIT de prueba no habilitado): verificar
   que la factura pasa a `rechazada`, que ninguna venta quedó marcada como facturada (FR-014), y
   que se puede reintentar `confirmar-factura` sobre la misma factura sin duplicar ventas.

## 6. Ver facturas generadas (US5)

1. Abrir el listado de facturas del local y verificar que aparece la factura `emitida` del
   paso anterior con período, modo de pago, monto total y estado correctos.
2. Abrir el detalle de esa factura y verificar que lista exactamente las ventas incluidas.

## Resultado esperado

Todos los pasos anteriores se corresponden 1 a 1 con los Acceptance Scenarios de
[spec.md](./spec.md). Si alguno falla, señala directamente qué requisito funcional (FR-XXX) o
criterio de éxito (SC-XXX) no se está cumpliendo.

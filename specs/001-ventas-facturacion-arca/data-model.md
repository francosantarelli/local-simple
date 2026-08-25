# Data Model: Ventas y facturación semanal ARCA

**Input**: [spec.md](./spec.md) Key Entities · **Decisiones**: [research.md](./research.md)

Todas las tablas viven en Supabase Postgres, con Row Level Security activada y políticas
basadas en `local_id` (ver research.md §5). Los nombres de tabla van en snake_case/plural
siguiendo convención Postgres/Supabase.

## `locales`

Comercio que usa el sistema (Key Entity: Local).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `nombre_fantasia` | text, not null | |
| `razon_social` | text, not null | |
| `cuit` | text, not null, unique | 11 dígitos, sin guiones |
| `condicion_iva` | enum(`monotributo`, `responsable_inscripto`, `exento`), not null | Determina tipo de comprobante ARCA (A/B/C) |
| `punto_venta` | int, not null | Punto de venta habilitado en ARCA para este local |
| `domicilio_fiscal` | text, not null | |
| `created_at` | timestamptz, default now() | |

## `profiles`

Extiende `auth.users` de Supabase con los datos propios del Usuario (Key Entity: Usuario).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK, FK → `auth.users.id` | |
| `username` | text, not null, unique | Usado para login; mapea a un email interno sintético en `auth.users.email` (research.md §4) |
| `recovery_email` | text, not null | Único destino válido del flujo de recuperación de contraseña |
| `local_id` | uuid, not null, FK → `locales.id` | Un usuario pertenece a exactamente un local (FR-002) |
| `created_at` | timestamptz, default now() | |

**Regla**: todos los usuarios de un mismo `local_id` tienen los mismos permisos (sin roles
diferenciados, ver Assumptions de la spec).

## `productos`

Catálogo de productos de un local (Key Entity: Producto).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `local_id` | uuid, not null, FK → `locales.id` | |
| `nombre` | text, not null | |
| `precio_unitario` | numeric(12,2), not null, check > 0 | Precio de referencia, autocompleta al cargar una venta (FR-007) |
| `created_at` | timestamptz, default now() | |
| `updated_at` | timestamptz, default now() | |

## `ventas`

Registro de una venta cargada por un usuario (Key Entity: Venta).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `local_id` | uuid, not null, FK → `locales.id` | |
| `usuario_id` | uuid, not null, FK → `profiles.id` | Quién la cargó (trazabilidad, Principio V) |
| `producto_id` | uuid, nullable, FK → `productos.id` | Null si se cargó con descripción libre (FR-007) |
| `fecha` | date, not null | |
| `cantidad` | numeric(12,2), not null, check > 0 | |
| `descripcion` | text, not null | Copiada del producto elegido o ingresada libremente |
| `precio_unitario` | numeric(12,2), not null, check > 0 | |
| `precio_total` | numeric(12,2), not null, check > 0 | Default `cantidad * precio_unitario`, ajustable manualmente (FR-005) |
| `modo_pago` | enum(`tarjeta`, `efectivo`), not null | |
| `factura_id` | uuid, nullable, FK → `facturas.id` | Null = no facturada; se completa al emitirse la factura que la incluye (FR-013, FR-016) |
| `created_at` | timestamptz, default now() | |

**Reglas de negocio**:
- Una venta con `factura_id` no nulo es inmutable: no se edita ni elimina (FR-015, Principio V).
- Una venta con `factura_id` no nulo no puede volver a incluirse en otro borrador (FR-016).

## `facturas`

Comprobante fiscal ante ARCA, agrupado por local + semana + modo de pago (Key Entity: Factura).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | |
| `local_id` | uuid, not null, FK → `locales.id` | |
| `periodo_desde` | date, not null | Lunes de la semana facturada (`automatico`) o fecha mínima de las ventas elegidas (`manual`) |
| `periodo_hasta` | date, not null | Viernes de la semana facturada (`automatico`) o fecha máxima de las ventas elegidas (`manual`) |
| `modo_pago` | enum(`tarjeta`, `efectivo`), not null | Una factura agrupa un solo modo de pago (FR-011) |
| `monto_total` | numeric(12,2), not null | Suma de `precio_total` de las ventas incluidas |
| `origen` | enum(`automatico`, `manual`), not null, default `automatico` | `automatico`: generada por el cron semanal. `manual`: un usuario la generó a demanda eligiendo ventas puntuales del listado |
| `estado` | enum(`borrador`, `emitida`, `rechazada`), not null, default `borrador` | Ver transiciones abajo |
| `cae` | text, nullable | Código de Autorización Electrónico devuelto por ARCA al emitirse |
| `motivo_rechazo` | text, nullable | Motivo devuelto por ARCA cuando `estado = 'rechazada'` (contracts/confirmar-factura.md) |
| `confirmado_por` | uuid, nullable, FK → `profiles.id` | Usuario que confirmó la emisión (FR-012) |
| `confirmado_at` | timestamptz, nullable | |
| `created_at` | timestamptz, default now() | |

**Restricción de unicidad**: índice único parcial sobre
`(local_id, periodo_desde, periodo_hasta, modo_pago)` que solo aplica cuando
`origen = 'automatico'` — evita duplicar el borrador de una misma semana/modo de pago
(FR-011, SC-003). Las facturas `manual` no compiten por esta restricción: su período es
un rango arbitrario derivado de la selección del usuario, así que dos tandas manuales
podrían coincidir en período/modo de pago/local sin ser la misma factura (cada una cubre
ventas distintas, ya que una venta con `factura_id` no nulo no puede volver a elegirse).

### Transiciones de estado de `facturas`

```
borrador --(usuario confirma; ARCA acepta)--> emitida   [terminal, inmutable]
borrador --(usuario confirma; ARCA rechaza)--> rechazada
rechazada --(usuario reintenta; ARCA acepta)--> emitida [terminal, inmutable]
rechazada --(usuario reintenta; ARCA rechaza)--> rechazada
```

- `borrador`: generada por el cron semanal (research.md §3), agrupa ventas no facturadas de
  esa semana/modo de pago. Las ventas asociadas aún tienen `factura_id` apuntando a este
  borrador, pero **no** se consideran "facturadas" a efectos de FR-015/FR-016 hasta que el
  estado pase a `emitida` (ver nota de integridad abajo).
- `emitida`: ARCA aceptó el envío; `cae` queda completo; la factura y las ventas que incluye
  son inmutables (Principio V).
- `rechazada`: ARCA rechazó o falló la comunicación; ninguna venta incluida queda marcada como
  facturada (FR-014); el usuario puede reintentar, lo que reintenta sobre la misma fila (no se
  crea una factura nueva ni se duplican ventas).

**Nota de integridad**: para que FR-014 ("ninguna venta se marca como facturada" ante rechazo)
sea consistente con que `ventas.factura_id` ya apunta al borrador, la condición real de "venta
facturada" usada en FR-009/FR-010/FR-015/FR-016 es `ventas.factura_id IS NOT NULL AND
facturas.estado = 'emitida'` (vía join), no solo la presencia de `factura_id`. Esto se
documenta aquí para que el plan de tareas implemente la validación/filtro con esa condición
compuesta, evitando bloquear edición de ventas que están en un borrador rechazado.

## Relaciones

```
locales 1───N profiles
locales 1───N productos
locales 1───N ventas
locales 1───N facturas
productos 1───N ventas (opcional, producto_id nullable)
facturas 1───N ventas (opcional hasta que se genera un borrador)
profiles 1───N ventas (usuario_id, quién cargó)
profiles 1───N facturas (confirmado_por, quién confirmó)
```

---

description: "Task list template for feature implementation"
---

# Tasks: Ventas y facturación semanal ARCA

**Input**: Design documents from `/specs/001-ventas-facturacion-arca/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluidos y obligatorios para toda lógica de ventas, cálculo de totales y facturación/ARCA, por el Principio II (Test-First, NON-NEGOTIABLE) de la constitution. Cambios puramente visuales quedan exceptuados.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para permitir implementación y prueba independiente de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1..US5)
- Cada tarea incluye la ruta de archivo exacta

## Nota sobre el catálogo de productos

Ninguna historia de usuario de spec.md describe una pantalla de alta/edición de productos: US2
solo asume que el catálogo "ya está cargado" (Acceptance Scenario 2). Siguiendo el mismo patrón
ya decidido en `/speckit-clarify` para locales/usuarios (alta manual fuera de la app) y el
Principio I (YAGNI), la carga de productos del catálogo también se resuelve por ahora con altas
manuales directas en la tabla `productos` (Supabase Studio/SQL), no con una pantalla dedicada.
Si más adelante hace falta una UI de administración de productos, se agrega como una historia
nueva.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto y estructura base

- [X] T001 Crear la estructura de directorios `docs/{css,js}`, `supabase/{migrations,functions}`, `tests/{unit,functions}` según [plan.md](./plan.md) Project Structure
- [X] T002 Inicializar el proyecto Supabase (`supabase/config.toml` vía Supabase CLI) para desarrollo local
- [X] T003 [P] Configurar Vitest (`package.json` con script `test`, `vitest.config.js`) apuntando a `tests/unit` y `tests/functions`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura core que TODAS las historias necesitan

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta completar esta fase

- [X] T004 Crear migración `supabase/migrations/<timestamp>_init.sql` con las tablas `locales`, `profiles`, `productos`, `ventas`, `facturas`, sus enums, constraints y FKs, según [data-model.md](./data-model.md)
- [X] T005 Agregar políticas RLS a `supabase/migrations/<timestamp>_init.sql` (o una migración adicional) que restrinjan el acceso a `locales`, `profiles`, `productos`, `ventas` y `facturas` a filas del `local_id` del usuario autenticado, vía `profiles` (research.md §5)
- [X] T006 [P] Crear `docs/js/supabaseClient.js` inicializando el cliente JS de Supabase (URL + anon key públicas, sin secretos)
- [X] T007 [P] Crear `docs/css/styles.css` con el layout base responsive (breakpoints desktop/mobile) reutilizado por todas las pantallas (FR-003)

**Checkpoint**: Base de datos, RLS, cliente Supabase y estilos base listos — las historias de usuario pueden empezar

---

## Phase 3: User Story 1 - Iniciar sesión y acceder solo a los datos del propio local (Priority: P1) 🎯 MVP

**Goal**: Un usuario inicia sesión con username/contraseña y solo accede a los datos de su local; puede recuperar su contraseña por email.

**Independent Test**: Sembrar 2 locales con un usuario cada uno (alta manual, ver Nota sobre productos y Assumptions de spec.md), loguearse con cada uno y confirmar que ninguno ve datos del otro local.

### Tests for User Story 1

- [X] T008 [P] [US1] Test de aislamiento RLS: un usuario no puede leer `productos`/`ventas`/`facturas` de otro local en `tests/functions/rls.test.ts` (gated: se salta sin `TEST_SUPABASE_URL`/`TEST_SUPABASE_SERVICE_ROLE_KEY`/`TEST_SUPABASE_ANON_KEY` — no hay Docker en este entorno para levantar Supabase local)
- [X] T009 [P] [US1] Test del mapeo username → email interno sintético (research.md §4) en `tests/unit/auth.test.js`
- [X] T010 [P] [US1] Test de `recuperar-password`: responde 200 genérico exista o no el `username`, y dispara el reset solo si existe, en `tests/functions/recuperar-password.test.ts`

### Implementation for User Story 1

- [X] T011 [US1] Implementar `docs/js/auth.js`: `login(username, password)` (resuelve el email interno sintético y llama `signInWithPassword`), `logout()`, y `requireSession()` como guard reutilizable
- [X] T012 [US1] Implementar `docs/index.html`: formulario de login (username + contraseña) con mensaje de error claro ante credenciales inválidas
- [X] T013 [P] [US1] Implementar `supabase/functions/recuperar-password/index.ts` según [contracts/recuperar-password.md](./contracts/recuperar-password.md) (lógica separada y testeada en `logic.ts`, envío real vía Resend — research.md §6)
- [X] T014 [US1] Implementar `docs/recuperar-password.html`: formulario que invoca la Edge Function `recuperar-password`
- [X] T015 [US1] Documentar en `specs/001-ventas-facturacion-arca/quickstart.md` (ya existente) el SQL de ejemplo para sembrar manualmente un local + usuario de prueba, si falta algún detalle al ejecutarlo

**Checkpoint**: US1 funcional y testeable de forma independiente

---

## Phase 4: User Story 2 - Cargar una venta (Priority: P1)

**Goal**: Un usuario logueado carga una venta (fecha, cantidad, descripción, precio unitario, precio total, modo de pago), con autocompletado opcional desde el catálogo del local.

**Independent Test**: Cargar una venta vía el formulario y verificar que queda guardada asociada al local y usuario correctos, con estado "no facturada".

### Tests for User Story 2

- [X] T016 [P] [US2] Test de cálculo automático `precio_total = cantidad × precio_unitario` (con override manual) y validación de cantidad/precio positivos en `tests/unit/ventas.test.js`

### Implementation for User Story 2

- [X] T017 [US2] Implementar `docs/js/ventas.js`: `crearVenta(data)` con cálculo de `precio_total` por defecto, validación de campos y `insert` en Supabase
- [X] T018 [US2] Implementar `docs/ventas.html`: formulario de carga (fecha, cantidad, descripción, precio unitario, precio total, modo de pago) con selector de producto del catálogo del local que autocompleta el precio (FR-007), permitiendo también descripción libre
- [X] T019 [US2] Implementar en `docs/js/ventas.js` la carga del catálogo de productos del local (`listarProductos()`, vía RLS) para poblar el selector del formulario
- [X] T020 [US2] Agregar feedback visual de error en `docs/ventas.html` cuando falta un campo obligatorio o un valor numérico es inválido (FR-008)

**Checkpoint**: US1 + US2 funcionales — MVP utilizable (login + carga de ventas)

---

## Phase 5: User Story 3 - Ver y filtrar el listado de ventas (Priority: P2)

**Goal**: Un usuario consulta el listado de ventas de su local, filtrable por fecha, modo de pago y estado de facturación.

**Independent Test**: Cargar varias ventas con fechas/modos de pago distintos y verificar que cada filtro devuelve exactamente el subconjunto esperado.

### Tests for User Story 3

- [X] T021 [P] [US3] Test de la lógica de filtrado (rango de fechas, modo de pago, estado facturada/no facturada — usando la condición compuesta `factura_id` + `facturas.estado = 'emitida'` de [data-model.md](./data-model.md)) en `tests/unit/listado-ventas.test.js`

### Implementation for User Story 3

- [X] T022 [US3] Implementar `docs/js/ventas.js`: `listarVentas(filtros)` consultando Supabase con los filtros de fecha/modo de pago/estado
- [X] T023 [US3] Implementar en `docs/ventas.html` la tabla/lista responsive de ventas y los controles de filtro (fecha, modo de pago, estado)

**Checkpoint**: US1-3 funcionales

---

## Phase 6: User Story 4 - Generar la factura semanal en ARCA (Priority: P2)

**Goal**: Cada viernes se genera automáticamente un borrador de factura por modo de pago con las ventas no facturadas de la semana; un usuario lo confirma y se emite ante ARCA.

**Independent Test**: Cargar ventas de una semana con ambos modos de pago, generar el borrador, confirmarlo y verificar que se emiten facturas separadas por modo de pago y que las ventas incluidas pasan a "facturada" (o, ante rechazo de ARCA, que ninguna queda facturada y se puede reintentar).

### Tests for User Story 4

- [X] T024 [P] [US4] Test de `generar-borrador-factura`: agrupa ventas no facturadas por modo de pago/período, es idempotente (no duplica facturas ni reincluye ventas ya asociadas) en `tests/functions/generar-borrador-factura.test.ts`
- [X] T025 [P] [US4] Test de `confirmar-factura`: si ARCA acepta, marca la factura `emitida` con `cae` y las ventas incluidas quedan facturadas; si ARCA rechaza, la factura queda `rechazada` y ninguna venta queda facturada, permitiendo reintentar en `tests/functions/confirmar-factura.test.ts`
- [X] T026 [P] [US4] Test de inmutabilidad: no se puede reconfirmar una factura ya `emitida` (409, cubierto en `tests/functions/confirmar-factura.test.ts`). No hay test de "editar/eliminar venta" a nivel app porque ninguna historia de usuario agrega esa UI — la inmutabilidad real de una venta facturada la impone el trigger `ventas_inmutable_si_facturada` en la base (T004), verificable solo con Postgres real (mismo límite que T008)

### Implementation for User Story 4

- [X] T027 [US4] Implementar `supabase/functions/generar-borrador-factura/index.ts` según [contracts/generar-borrador-factura.md](./contracts/generar-borrador-factura.md)
- [X] T028 [US4] Configurar `pg_cron` semanal (viernes) que invoca `generar-borrador-factura` con la service role key, en `supabase/migrations/20260824000002_cron.sql`
- [X] T029 [US4] Implementar `supabase/functions/confirmar-factura/index.ts` según [contracts/confirmar-factura.md](./contracts/confirmar-factura.md) (obtención/renovación de TA vía WSAA, solicitud de CAE vía WSFEv1, research.md §1-2 — cliente SOAP en `arcaClient.ts`, no probado contra ARCA real)
- [X] T030 [US4] Documentar en `supabase/functions/confirmar-factura/README.md` las variables de entorno/secretos requeridos, sin commitear valores reales (Principio IV)
- [X] T031 [US4] Implementar en `docs/facturas.html` la vista de borrador con botón "Confirmar y emitir" que invoca `confirmar-factura` y muestra el estado resultante
- [X] T032 [US4] Bloqueo de edición/eliminación de una venta ya facturada (FR-015): ya impuesto por el trigger `ventas_inmutable_si_facturada` (T004) a nivel de base de datos; no hay UI de edición de ventas en el alcance de esta feature, así que no hace falta réplica de esta lógica en `docs/js/ventas.js`

**Checkpoint**: US1-4 funcionales — flujo fiscal completo de punta a punta

---

## Phase 7: User Story 5 - Ver las facturas generadas (Priority: P3)

**Goal**: Un usuario consulta el listado de facturas de su local y el detalle de ventas de cada una.

**Independent Test**: Generar y confirmar al menos una factura, y verificar que aparece en el listado con sus datos correctos y el detalle de ventas incluidas.

### Implementation for User Story 5

- [X] T033 [US5] Implementar `docs/js/facturas.js`: `listarFacturas()` y `detalleFactura(facturaId)` (ventas incluidas)
- [X] T034 [US5] Implementar en `docs/facturas.html` el listado de facturas (período, modo de pago, monto total, estado)
- [X] T035 [US5] Implementar en `docs/facturas.html` la vista de detalle de una factura con las ventas que incluye

**Checkpoint**: Las 5 historias de usuario funcionales de forma independiente

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que atraviesan varias historias

- [X] T036 [P] Revisar el responsive end-to-end en mobile (real o emulado) de las 4 pantallas (`index.html`, `ventas.html`, `facturas.html`, `recuperar-password.html`) contra FR-003/SC-005 — revisión estática (viewport meta, breakpoint 640px, `table-scroll`, `form-row` con `flex-wrap`) en las 4 páginas; no se pudo abrir un navegador/emulador real en este entorno, falta una pasada visual manual antes de dar por validado SC-005
- [X] T037 [P] Unificar manejo de errores de red/Supabase (mensajes de usuario consistentes) en `docs/js/auth.js`, `docs/js/ventas.js`, `docs/js/facturas.js` — banner de error de página en `ventas.html`/`facturas.html`, try/catch alrededor de las llamadas de red en los 4 HTML
- [ ] T038 Ejecutar [quickstart.md](./quickstart.md) de punta a punta contra el ambiente de homologación de ARCA y corregir cualquier desvío encontrado — **no ejecutado**: requiere Docker (`supabase start`), un proyecto Supabase real y un certificado de homologación de ARCA, ninguno disponible en este entorno de desarrollo; queda como siguiente paso manual (ver README.md "Estado conocido / pendiente")
- [X] T039 [P] Documentar en un README de configuración las variables de entorno/secrets requeridos (Supabase URL/anon key, certificado y clave ARCA por local, credenciales WSAA), sin commitear valores reales — [README.md](../../README.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias de usuario
- **User Stories (Phase 3-7)**: todas dependen de Foundational
  - Se implementaron en orden de prioridad (US1 → US2 → US3 → US4 → US5) porque US2-5 asumen que ya existe login (US1) y, en el caso de US4, ventas cargadas (US2/US3)
- **Polish (Phase 8)**: depende de las historias que se decida incluir

### User Story Dependencies

- **US1 (P1)**: solo depende de Foundational
- **US2 (P1)**: depende de Foundational; usa el `requireSession()` de US1 para proteger `ventas.html`, pero su lógica de carga de venta es independiente
- **US3 (P2)**: depende de Foundational y de que existan ventas cargadas (US2) para tener sentido probarla, pero su código (listado/filtros) no depende del código de US2
- **US4 (P2)**: depende de que existan ventas no facturadas (US2/US3) para generar un borrador con contenido real
- **US5 (P3)**: depende de que exista al menos una factura (US4) para tener contenido que listar

### Within Each User Story

- Tests antes que la implementación correspondiente (deben fallar primero)
- Modelos/esquema ya resueltos en Foundational
- Edge Functions antes que la UI que las invoca
- Historia completa y verificada antes de pasar a la siguiente en orden de prioridad

### Parallel Opportunities

- Todas las tareas [P] de Setup pueden correr en paralelo
- Todas las tareas [P] de Foundational pueden correr en paralelo
- Los tests [P] dentro de una misma historia pueden correr en paralelo entre sí
- Distintas historias pueden trabajarse en paralelo por distintas personas una vez completado Foundational, aunque US3/US4/US5 solo son demostrables con datos reales una vez completadas US1/US2

---

## Parallel Example: User Story 1

```bash
# Lanzar juntos los tests de la User Story 1:
Task: "Test de aislamiento RLS en tests/functions/rls.test.ts"
Task: "Test del mapeo username → email interno en tests/unit/auth.test.js"
Task: "Test de recuperar-password en tests/functions/recuperar-password.test.ts"
```

## Parallel Example: User Story 4

```bash
# Lanzar juntos los tests de la User Story 4:
Task: "Test de generar-borrador-factura en tests/functions/generar-borrador-factura.test.ts"
Task: "Test de confirmar-factura (aceptación/rechazo) en tests/functions/confirmar-factura.test.ts"
Task: "Test de inmutabilidad de ventas/facturas emitidas"
```

---

## Implementation Strategy

### MVP realista (User Story 1 + User Story 2)

Login por sí solo (US1) no entrega valor de negocio visible — el valor mínimo demostrable es
"loguearse y cargar una venta". Por eso el MVP recomendado es US1 + US2, no solo US1.

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (bloqueante)
3. Completar Phase 3: User Story 1 (login)
4. Completar Phase 4: User Story 2 (carga de venta)
5. **VALIDAR**: loguearse y cargar una venta de punta a punta (quickstart.md pasos 1-3)
6. Deploy/demo si está listo

### Entrega incremental

1. Setup + Foundational → base lista
2. + US1 → login aislado por local
3. + US2 → MVP demostrable (login + carga de ventas)
4. + US3 → listado y filtros (valor de auditoría)
5. + US4 → cierre semanal y facturación ARCA (objetivo fiscal del negocio)
6. + US5 → consulta de facturas generadas
7. + Polish → responsive, manejo de errores, validación end-to-end, documentación de secretos

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] mapea cada tarea a su historia de usuario para trazabilidad
- Los tests deben escribirse primero y fallar antes de implementar (Principio II, NON-NEGOTIABLE para ventas/facturación/ARCA)
- Commitear por tarea o grupo lógico de tareas, de forma atómica (Principio III)
- Detenerse en cada checkpoint para validar la historia de forma independiente antes de seguir

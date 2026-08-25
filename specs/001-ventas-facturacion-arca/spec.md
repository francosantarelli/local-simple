# Feature Specification: Ventas y facturación semanal ARCA

**Feature Branch**: `001-ventas-facturacion-arca`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "quiero hacer una web con login de usuario
debe ser desktop con buen responsive para usar desde dispositivo celular mobile
cada usuario pertenece a un local
cada local tendra su propia configuracion de productos/ventas/facturas
en principio el usuario va a cargar ventas en un formulario: fecha-cantidad-descripción-precio unit-precio total-modo de pago(tarjeta/efectivo)
luego al finalizar la semana por ejemplo cada viernes se generará una factura en ARCA (argentina) por las ventas de acuerdo a los modos de pago
la venta se marcará como facturada
se podran ver las facturas generadas
las ventas se veran en un listado y se podran filtrar"

## Clarifications

### Session 2026-08-24

- Q: ¿Quién puede crear un local nuevo en el sistema? → A: Se crea manualmente por fuera de la app (alguien con acceso al backend/base de datos lo da de alta directo), sin pantalla de "crear local" en el producto.
- Q: ¿Cómo se da de alta un usuario nuevo dentro de un local ya existente? → A: Se crea manualmente por fuera de la app (alta directa en el backend), sin pantalla de "crear/invitar usuario" en el producto.
- Q: ¿Qué datos hacen falta para dar de alta un usuario y un local? → A: Usuario: nombre de usuario, contraseña y un email asociado para recuperar la contraseña. Local: nombre de fantasía, razón social y los datos fiscales necesarios para facturar en ARCA.
- Q: ¿Qué datos fiscales del local hace falta guardar para poder emitir comprobantes en ARCA? → A: CUIT, condición frente al IVA (Monotributo / Responsable Inscripto / Exento), punto de venta y domicilio fiscal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión y acceder solo a los datos del propio local (Priority: P1)

Un usuario abre la web, ingresa sus credenciales y accede únicamente a los productos, ventas y facturas del local al que pertenece. No puede ver ni modificar datos de otro local.

**Why this priority**: Es la base de todo lo demás: sin login y sin aislamiento por local, ninguna otra funcionalidad es segura ni utilizable.

**Independent Test**: Puede probarse creando dos locales con usuarios distintos, iniciando sesión con cada uno y confirmando que cada usuario solo ve los datos de su propio local.

**Acceptance Scenarios**:

1. **Given** un usuario con credenciales válidas asociado a un local, **When** inicia sesión, **Then** accede a la web y ve únicamente los datos (productos, ventas, facturas) de su local.
2. **Given** un usuario con credenciales inválidas, **When** intenta iniciar sesión, **Then** el sistema rechaza el acceso y muestra un mensaje de error claro.
3. **Given** dos usuarios de locales distintos, **When** cada uno inicia sesión, **Then** ninguno puede ver ni acceder a los datos del local del otro.

---

### User Story 2 - Cargar una venta (Priority: P1)

Un usuario logueado completa un formulario con fecha, cantidad, descripción (libre o elegida de un producto cargado por el local), precio unitario, precio total y modo de pago (tarjeta/efectivo), y la venta queda registrada en su local.

**Why this priority**: Es la operación diaria central del sistema; sin carga de ventas no hay datos que listar ni facturar.

**Independent Test**: Puede probarse cargando una venta a través del formulario y verificando que aparece registrada, asociada al local y usuario correctos, sin necesidad de que existan facturas ni listados todavía.

**Acceptance Scenarios**:

1. **Given** un usuario logueado en la pantalla de carga de ventas, **When** completa fecha, cantidad, descripción, precio unitario, precio total y modo de pago, y confirma, **Then** la venta queda guardada asociada a su local, con estado "no facturada".
2. **Given** un local con productos previamente cargados, **When** el usuario elige un producto de la lista al cargar una venta, **Then** el precio unitario se autocompleta con el precio configurado para ese producto (pudiendo ajustarse manualmente).
3. **Given** un producto que no está en la lista del local, **When** el usuario carga la venta, **Then** puede escribir una descripción libre y un precio manualmente en lugar de elegir de la lista.
4. **Given** el formulario de carga de venta, **When** falta un campo obligatorio o un valor numérico es inválido (ej. cantidad o precio negativo o no numérico), **Then** el sistema muestra un error y no guarda la venta.
5. **Given** cantidad y precio unitario cargados, **When** el usuario no ingresa el precio total manualmente, **Then** el sistema lo calcula automáticamente como cantidad × precio unitario.

---

### User Story 3 - Ver y filtrar el listado de ventas (Priority: P2)

Un usuario logueado consulta el listado de ventas de su local y lo filtra (por ejemplo por rango de fechas, modo de pago o estado de facturación) para revisar lo cargado.

**Why this priority**: Permite verificar y auditar lo cargado antes de facturar, y da valor incluso sin la integración con ARCA todavía activa.

**Independent Test**: Puede probarse cargando varias ventas con distintos modos de pago y fechas, y confirmando que los filtros devuelven exactamente el subconjunto esperado.

**Acceptance Scenarios**:

1. **Given** varias ventas cargadas en el local, **When** el usuario abre el listado de ventas, **Then** ve todas las ventas de su local ordenadas por fecha, con sus datos principales y estado (facturada / no facturada).
2. **Given** el listado de ventas, **When** el usuario filtra por rango de fechas, **Then** solo se muestran las ventas dentro de ese rango.
3. **Given** el listado de ventas, **When** el usuario filtra por modo de pago (tarjeta/efectivo), **Then** solo se muestran las ventas con ese modo de pago.
4. **Given** el listado de ventas, **When** el usuario filtra por estado de facturación (facturada/no facturada), **Then** solo se muestran las ventas que cumplen ese estado.

---

### User Story 4 - Generar la factura semanal en ARCA (Priority: P2)

Al llegar el cierre de la semana (viernes), el sistema arma automáticamente un borrador de factura por cada modo de pago con las ventas no facturadas de esa semana. Un usuario del local revisa el borrador y confirma su emisión, momento en el cual se envía a ARCA y las ventas incluidas quedan marcadas como facturadas.

**Why this priority**: Es el objetivo de negocio final (cumplir con la obligación fiscal), pero depende de que ya existan ventas cargadas (US2) para tener sentido.

**Independent Test**: Puede probarse cargando ventas de una semana con ambos modos de pago, esperando/forzando el cierre semanal, confirmando el borrador generado y verificando que se emiten facturas separadas por modo de pago y que las ventas incluidas pasan a estado "facturada".

**Acceptance Scenarios**:

1. **Given** ventas no facturadas cargadas durante la semana con ambos modos de pago, **When** llega el cierre semanal (viernes), **Then** el sistema genera un borrador de factura por cada modo de pago que tenga ventas no facturadas en esa semana, agrupando el total correspondiente.
2. **Given** un borrador de factura generado, **When** un usuario del local lo revisa y confirma su emisión, **Then** el sistema envía la factura a ARCA, y si ARCA la acepta, todas las ventas incluidas quedan marcadas como "facturadas" y la factura queda registrada como emitida.
3. **Given** un borrador de factura generado, **When** ARCA rechaza el envío (error de validación o comunicación), **Then** ninguna venta se marca como facturada, la factura queda registrada como "rechazada/fallida", y el usuario puede reintentar el envío.
4. **Given** una semana sin ventas no facturadas, **When** llega el cierre semanal, **Then** no se genera ningún borrador de factura para esa semana.
5. **Given** una venta ya marcada como facturada, **When** se genera un nuevo borrador de factura, **Then** esa venta no se incluye nuevamente en ningún otro borrador.

---

### User Story 5 - Ver las facturas generadas (Priority: P3)

Un usuario logueado consulta el listado de facturas ya generadas de su local, con su período, modo de pago, monto total y estado.

**Why this priority**: Es una vista de consulta/auditoría que depende de que ya exista al menos una factura generada (US4); agrega valor de trazabilidad pero no es indispensable para el flujo operativo diario.

**Independent Test**: Puede probarse generando y confirmando al menos una factura, y verificando que aparece en el listado de facturas con sus datos correctos y las ventas que incluye.

**Acceptance Scenarios**:

1. **Given** facturas emitidas en el local, **When** el usuario abre el listado de facturas, **Then** ve cada factura con su período, modo de pago, monto total y estado (emitida/rechazada).
2. **Given** una factura en el listado, **When** el usuario la selecciona, **Then** puede ver el detalle de las ventas incluidas en esa factura.

---

### Edge Cases

- Una venta cargada después del cierre del viernes: pertenece a la semana siguiente, no se incluye retroactivamente en un borrador ya generado.
- Un usuario intenta editar o eliminar una venta que ya está marcada como facturada: el sistema lo bloquea, ya que una factura emitida es inmutable.
- ARCA no responde o responde con error durante la emisión: la factura queda en estado fallido/rechazado, sin marcar ventas como facturadas, y debe poder reintentarse.
- Un usuario intenta acceder sin tener un local asignado: el acceso se rechaza.
- Dos locales configuran productos con el mismo nombre: quedan completamente aislados entre sí, sin cruce de datos.
- Un usuario carga una venta con precio total distinto al resultado de cantidad × precio unitario (ajuste manual, ej. descuento): el sistema lo permite pero dicho valor queda guardado tal cual lo ingresó el usuario.
- Un usuario solicita recuperar su contraseña pero el email asociado a su usuario ya no le pertenece o no tiene acceso: no puede completar la recuperación por ese medio (requiere intervención manual, fuera del alcance de esta feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario iniciar sesión con nombre de usuario y contraseña propios.
- **FR-001a**: El sistema MUST permitir recuperar la contraseña mediante el email asociado al usuario (envío de un enlace/código de recuperación a ese email).
- **FR-002**: El sistema MUST asociar cada usuario a exactamente un local, y restringir su acceso únicamente a los datos (productos, ventas, facturas) de ese local.
- **FR-002a**: El sistema MUST mantener, para cada local, sus datos de identificación (nombre de fantasía, razón social) y sus datos fiscales necesarios para facturar en ARCA (CUIT, condición frente al IVA, punto de venta, domicilio fiscal).
- **FR-003**: El sistema MUST presentar una interfaz utilizable tanto en pantallas de escritorio como en dispositivos móviles (responsive), sin pérdida de funcionalidad en pantallas chicas.
- **FR-004**: El sistema MUST permitir a un usuario cargar una venta con los campos: fecha, cantidad, descripción, precio unitario, precio total y modo de pago (tarjeta o efectivo).
- **FR-005**: El sistema MUST calcular automáticamente el precio total como cantidad × precio unitario cuando el usuario no lo ingrese manualmente, permitiendo su ajuste manual.
- **FR-006**: El sistema MUST permitir a cada local mantener su propio catálogo de productos (nombre y precio), independiente del de otros locales.
- **FR-007**: El sistema MUST permitir, al cargar una venta, elegir un producto del catálogo del local (autocompletando el precio) o ingresar una descripción y precio libremente.
- **FR-008**: El sistema MUST validar que cantidad y precios sean valores numéricos positivos antes de guardar una venta.
- **FR-009**: El sistema MUST mostrar un listado de las ventas del local del usuario, ordenado por fecha.
- **FR-010**: El sistema MUST permitir filtrar el listado de ventas por rango de fechas, modo de pago y estado de facturación (facturada/no facturada).
- **FR-011**: El sistema MUST generar automáticamente, al cierre de cada semana (viernes), un borrador de factura por cada modo de pago que tenga ventas no facturadas en esa semana, agrupando dichas ventas y su monto total.
- **FR-012**: El sistema MUST requerir que un usuario del local confirme explícitamente un borrador de factura antes de emitirlo ante ARCA.
- **FR-013**: El sistema MUST, al confirmar un borrador, enviar la factura a ARCA y, si es aceptada, marcar todas las ventas incluidas como "facturadas" y registrar la factura como emitida.
- **FR-014**: El sistema MUST, si ARCA rechaza o falla al emitir una factura, dejarla registrada como rechazada/fallida sin marcar ninguna venta incluida como facturada, y permitir reintentar la emisión.
- **FR-015**: El sistema MUST impedir la edición o eliminación de una venta que ya está marcada como facturada.
- **FR-016**: El sistema MUST impedir que una venta ya facturada sea incluida en un nuevo borrador o factura.
- **FR-017**: El sistema MUST mostrar un listado de las facturas generadas del local, con período, modo de pago, monto total y estado.
- **FR-018**: El sistema MUST permitir ver, para una factura dada, el detalle de las ventas que incluye.
- **FR-019**: El sistema MUST mantener credenciales y claves de ARCA exclusivamente del lado del servidor, sin exponerlas nunca al navegador.

### Key Entities

- **Local**: Comercio que usa el sistema. Tiene nombre de fantasía, razón social y datos fiscales para ARCA (CUIT, condición frente al IVA, punto de venta, domicilio fiscal). Tiene su propio catálogo de productos, sus ventas y sus facturas, completamente aislados de otros locales.
- **Usuario**: Persona que inicia sesión y opera el sistema. Tiene nombre de usuario, contraseña y un email asociado (usado únicamente para recuperación de contraseña). Pertenece a exactamente un local; todos los usuarios de un mismo local tienen los mismos permisos.
- **Producto**: Ítem del catálogo de un local, con nombre y precio unitario de referencia, usado para autocompletar ventas.
- **Venta**: Registro de una operación de venta cargada por un usuario. Incluye fecha, cantidad, descripción (libre o de producto), precio unitario, precio total, modo de pago (tarjeta/efectivo) y estado de facturación (facturada/no facturada). Pertenece a un local.
- **Factura**: Comprobante fiscal generado ante ARCA para un local, correspondiente a una semana y un modo de pago específico. Incluye el conjunto de ventas que agrupa, el monto total, y su estado (borrador/emitida/rechazada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede cargar una venta completa en menos de 30 segundos desde que abre el formulario.
- **SC-002**: Una venta recién cargada aparece en el listado de ventas del local en menos de 5 segundos.
- **SC-003**: El 100% de las ventas no facturadas de una semana quedan incluidas en el borrador de factura correspondiente a su modo de pago, sin omisiones ni duplicados.
- **SC-004**: El 100% de las ventas incluidas en una factura emitida exitosamente quedan marcadas como facturadas, y ninguna de ellas puede volver a incluirse en otra factura.
- **SC-005**: Un usuario puede completar el flujo de carga de venta y consulta del listado desde un teléfono móvil con la misma funcionalidad disponible que en escritorio.
- **SC-006**: Ningún usuario puede visualizar u operar datos (productos, ventas o facturas) de un local distinto al propio, verificado en el 100% de los intentos de acceso cruzado.
- **SC-007**: Ante un rechazo de ARCA, el usuario puede identificar la factura fallida y reintentar su emisión sin perder ni duplicar ventas.

## Assumptions

- El período de facturación semanal cierra los viernes (día configurable a nivel de local si en el futuro hace falta, pero fijo en viernes para el alcance inicial).
- Todos los usuarios de un mismo local comparten el mismo nivel de permisos (no hay roles diferenciados admin/vendedor en este alcance inicial).
- La generación del borrador de factura semanal es automática (disparada por el cierre de semana), pero su emisión ante ARCA requiere confirmación explícita de un usuario del local.
- La creación de un local nuevo, y la creación/asignación de usuarios a ese local, se hacen manualmente por fuera de la app (alta directa en el backend/base de datos por alguien con ese acceso), sin pantallas de "crear local" ni "crear/invitar usuario" en el producto. No forman parte del alcance funcional de esta feature; se asume que el local (con sus datos fiscales) y el usuario ya existen al momento de usar el sistema.
- El precio total de una venta se calcula por defecto como cantidad × precio unitario, pero el usuario puede ajustarlo manualmente (por ejemplo, para reflejar un descuento).
- El tipo de comprobante ARCA (Factura A/B/C) y los datos fiscales del local (condición frente al IVA, punto de venta) se configuran a nivel de local como parte de su configuración, sin detallarse en el flujo de esta funcionalidad.

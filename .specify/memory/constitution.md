# local-simple Constitution

## Core Principles

### I. Simplicidad primero (YAGNI)
Toda decisión de diseño empieza por la opción más simple que resuelve el
problema actual, no el que podría existir a futuro. No se agregan
abstracciones, capas, dependencias ni configuraciones "por si después hace
falta". Una funcionalidad nueva para el local de la amiga no justifica
generalizar para "cualquier local" hasta que un segundo caso real lo pida.
Si una tarea puede resolverse con menos código o menos piezas, esa es la
que se implementa.

### II. Test-First (NON-NEGOTIABLE)
Ningún cambio de lógica (ventas, facturación, cálculo de totales/impuestos,
integración con ARCA) se escribe sin un test que primero falle y después
pase. El objetivo explícito: si una acción futura rompe algo que ya
funcionaba, un test tiene que fallar y señalar exactamente qué se rompió,
para poder corregirlo antes de que llegue a producción. Ciclo Red-Green-
Refactor. Cambios de UI puramente visuales pueden quedar fuera de este
requisito, pero cualquier cosa que toque datos, montos o el flujo de
facturación no.

### III. Historial reversible (commits atómicos)
Cada feature, cambio o mejora se commitea por separado, con mensajes claros
de qué y por qué, apenas queda funcional y testeada. Nunca se acumulan
múltiples cambios no relacionados en un mismo commit. El criterio: en
cualquier momento tiene que poderse volver atrás a un commit puntual sin
arrastrar otros cambios. Nada de "WIP" gigantes ni squash de historia
salvo pedido explícito.

### IV. Credenciales fiscales fuera del cliente (NON-NEGOTIABLE)
Certificados, claves privadas, tokens y cualquier credencial de ARCA
(AFIP) viven exclusivamente en el backend y nunca se envían, loguean ni
exponen al navegador. Nada de eso se commitea al repositorio (van en
variables de entorno / secretos, con `.gitignore` cubriendo esos archivos
desde el primer commit). Toda llamada a la API de ARCA se hace server-side.

### V. Integridad de datos fiscales
Una factura ya emitida ante ARCA es inmutable en la base de datos: no se
edita ni se borra, solo se anula o se corrige mediante los mecanismos
legales correspondientes (nota de crédito). Ventas y facturas quedan con
trazabilidad completa (quién, cuándo, qué cambió) porque son datos
contables reales del local, no datos de prueba.

## Restricciones técnicas

- **Frontend**: HTML/CSS/JS plano servido por GitHub Pages, sin build ni
  framework, siguiendo el mismo patrón que control-economico. Se introduce
  un framework/build solo si la complejidad de la UI lo justifica en la
  práctica, no de forma preventiva.
- **Backend/Base de datos**: Supabase (Postgres) con Row Level Security,
  reutilizando el mismo proveedor que ya se opera en control-economico.
- **Integración con ARCA**: se implementa en Supabase Edge Functions
  (server-side), nunca en el frontend estático. Ahí viven el certificado y
  la clave privada como secretos de la función, conforme al Principio IV.
- **Tests**: Vitest como test runner, tanto para lógica de frontend como
  para las Edge Functions.
- **Alcance inicial**: usuarios, ventas y facturas conectadas a la API de
  ARCA. Cualquier feature que no sirva directamente a facturar el local de
  la amiga se documenta como posible extensión futura, pero no se
  implementa hasta que se confirme que hace falta.

## Flujo de trabajo

- Un cambio se considera terminado cuando: tiene su test (si aplica según
  el Principio II), pasa la suite completa, y está commiteado de forma
  atómica (Principio III).
- Antes de tocar código de facturación o integración con ARCA, se revisa
  que el cambio no viole los Principios IV y V.
- Ante la duda entre una solución simple y una "más robusta pero
  compleja", gana la simple salvo que un caso real ya demuestre que hace
  falta la otra (Principio I).

## Governance

Esta constitution prevalece sobre cualquier otra convención o preferencia
puntual dentro del proyecto. Cualquier plan (`/speckit-plan`) o tarea
(`/speckit-tasks`) que se aparte de un principio acá definido debe
justificarlo explícitamente o, si el principio ya no tiene sentido,
enmendarse primero acá antes de proceder. Los cambios a este documento se
versionan:

- **MAJOR**: se elimina o redefine un principio existente de forma
  incompatible con cómo se venía trabajando.
- **MINOR**: se agrega un principio o sección nueva.
- **PATCH**: aclaraciones de redacción que no cambian el significado.

**Version**: 1.1.0 | **Ratified**: 2026-08-24 | **Last Amended**: 2026-08-24

# Implementation Plan: Ventas y facturación semanal ARCA

**Branch**: `001-ventas-facturacion-arca` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ventas-facturacion-arca/spec.md`

## Summary

Una web con login para que los usuarios de un local carguen ventas (fecha, cantidad,
descripción, precio unitario, precio total, modo de pago), las consulten en un listado
filtrable, y cada viernes el sistema arme automáticamente un borrador de factura por modo de
pago con las ventas no facturadas de la semana; un usuario del local confirma ese borrador para
emitirlo ante ARCA, momento en que las ventas incluidas quedan marcadas como facturadas y la
factura queda disponible para consulta. Enfoque técnico: frontend estático (HTML/CSS/JS plano)
en GitHub Pages consumiendo Supabase directamente (Auth + Postgres con RLS) para todo lo
transaccional, y Supabase Edge Functions para lo que requiere secretos server-side: la
integración WSAA/WSFEv1 con ARCA y el flujo de recuperación de contraseña.

## Technical Context

**Language/Version**: JavaScript (ES202x) vanilla para el frontend; TypeScript sobre Deno para
las Supabase Edge Functions.

**Primary Dependencies**: Cliente JS de Supabase (`@supabase/supabase-js`) en el frontend; SDK/
runtime de Supabase Edge Functions (Deno) en el backend. Sin frameworks de UI ni build tooling
(restricción técnica de la constitution).

**Storage**: Supabase (Postgres) con Row Level Security.

**Testing**: Vitest, tanto para lógica de frontend (cálculos, validaciones) como para las Edge
Functions.

**Target Platform**: Navegador web, desktop y mobile (responsive), servido estáticamente desde
GitHub Pages; backend serverless en Supabase.

**Project Type**: Web application (frontend estático + backend serverless/Supabase) — no aplica
la distinción "mobile app" nativa, el requisito mobile se resuelve con diseño responsive.

**Performance Goals**: Carga de una venta percibida en <30s (SC-001); listado de ventas
refleja una carga nueva en <5s (SC-002). Sin metas de alto throughput: volumen de un comercio
único, uso no concurrente masivo.

**Constraints**: Certificado y clave privada de ARCA exclusivamente en secretos de Edge
Functions, nunca en el cliente ni en el repo (Principio IV). Una factura `emitida` y las ventas
que incluye son inmutables (Principio V). Sin frameworks/build tooling salvo que la complejidad
de la UI lo justifique en la práctica (restricción técnica, Principio I).

**Scale/Scope**: Alcance inicial de un local (con posibilidad de algunos más), pocos usuarios
concurrentes por local, volumen de ventas bajo/moderado propio de un comercio individual.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Restricción | Evaluación |
|---|---|
| I. Simplicidad primero (YAGNI) | PASS — se reutiliza el stack ya fijado (HTML/CSS/JS plano + Supabase), sin frameworks nuevos ni generalización más allá de "un local" (research.md §1, §4). |
| II. Test-First (NON-NEGOTIABLE) | PASS (a aplicar en tasks) — toda lógica de ventas, cálculo de totales y la integración ARCA (Edge Functions `generar-borrador-factura`, `confirmar-factura`) requiere test Vitest en rojo antes de implementarse. Cambios puramente visuales quedan exceptuados. |
| III. Historial reversible | PASS (proceso, no arquitectura) — cada tarea de `/speckit-tasks` se commitea atómicamente al completarse. |
| IV. Credenciales fiscales fuera del cliente | PASS — certificado/clave de ARCA viven como secretos de Edge Functions (research.md §1-2); el frontend nunca los recibe ni los loguea. |
| V. Integridad de datos fiscales | PASS — `facturas.estado = 'emitida'` es terminal e inmutable; ventas con `factura_id` apuntando a una factura emitida no se editan ni eliminan (data-model.md, FR-015); trazabilidad vía `usuario_id`, `confirmado_por`, `created_at`. |
| Restricciones técnicas (frontend/backend/ARCA/tests) | PASS — ver Technical Context, coincide exactamente con lo fijado en la constitution. |

Sin violaciones. No aplica Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-ventas-facturacion-arca/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── recuperar-password.md
│   ├── generar-borrador-factura.md
│   └── confirmar-factura.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── index.html            # login
├── recuperar-password.html
├── ventas.html            # carga + listado/filtro de ventas
├── facturas.html          # listado + detalle de facturas
├── css/
│   └── styles.css         # responsive desktop/mobile
└── js/
    ├── supabaseClient.js
    ├── auth.js
    ├── ventas.js
    └── facturas.js

supabase/
├── config.toml
├── migrations/
│   └── <timestamp>_init.sql   # tablas de data-model.md + políticas RLS
└── functions/
    ├── recuperar-password/
    │   └── index.ts
    ├── generar-borrador-factura/
    │   └── index.ts
    └── confirmar-factura/
        └── index.ts

tests/
├── unit/                  # Vitest: cálculos y validaciones de frontend (ventas.js, etc.)
└── functions/             # Vitest: Edge Functions (generar-borrador-factura, confirmar-factura, recuperar-password)
```

**Structure Decision**: Se sigue el patrón ya usado en `control-economico` (frontend estático
sin build, servido por GitHub Pages) más la convención estándar del CLI de Supabase para
`supabase/migrations/` y `supabase/functions/`. No hay una carpeta `backend/` tradicional: toda
la lógica transaccional simple pasa por Supabase (PostgREST + RLS) directo desde el frontend, y
solo lo que requiere secretos server-side (ARCA, envío de recuperación de contraseña) vive en
Edge Functions.

## Complexity Tracking

*Sin violaciones al Constitution Check — no aplica esta sección.*

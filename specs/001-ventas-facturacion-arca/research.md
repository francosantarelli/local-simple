# Research: Ventas y facturación semanal ARCA

**Input**: [spec.md](./spec.md) · **Constitution**: `.specify/memory/constitution.md`

La mayoría de las decisiones técnicas ya están fijadas por la constitution del proyecto
(Restricciones técnicas): frontend HTML/CSS/JS plano en GitHub Pages, backend Supabase
(Postgres + RLS), integración ARCA en Supabase Edge Functions, tests con Vitest. Esta
investigación resuelve los puntos que la constitution no fija explícitamente.

## 1. Mecanismo de integración con ARCA (ex AFIP)

**Decision**: Integrar vía los web services oficiales de ARCA — WSAA (autenticación, emite
un Ticket de Acceso con certificado X.509 + clave privada) y WSFEv1 (factura electrónica,
solicita el CAE) — invocados exclusivamente desde Supabase Edge Functions (Deno).

**Rationale**: Es el mecanismo directo y gratuito provisto por ARCA para emitir comprobantes
electrónicos sin depender de un proveedor externo. Encaja con el Principio IV (certificado y
clave privada solo en backend) y con la restricción técnica ya fijada (Edge Functions).

**Alternatives considered**:
- Proveedor de facturación electrónica de terceros (ej. servicios "as a service" sobre AFIP):
  descartado por costo recurrente y por el Principio I (no sumar dependencias sin necesidad
  comprobada) — el volumen de un solo local no lo justifica.

## 2. Manejo del Ticket de Acceso (TA) de WSAA

**Decision**: El TA (válido ~12 horas) se solicita una vez y se cachea (tabla interna en
Postgres, no accesible desde el cliente) hasta expirar; se renueva automáticamente cuando la
Edge Function detecta que venció.

**Rationale**: Evita pedir un TA nuevo en cada emisión de factura, reduce latencia y respeta
los límites de uso del servicio WSAA.

**Alternatives considered**:
- Solicitar TA en cada llamada: descartado, es innecesario y más lento.

## 3. Disparo del cierre semanal (viernes)

**Decision**: Un cron (Supabase `pg_cron` invocando una Edge Function programada) genera el
borrador de factura por modo de pago cada viernes. La emisión real ante ARCA queda detrás de
una acción explícita de un usuario del local (llamada a una segunda Edge Function que confirma
y emite), conforme a la decisión ya tomada en `/speckit-clarify` ("automática con revisión").

**Rationale**: Cumple el flujo de negocio decidido: borrador automático, emisión con
confirmación humana, dado que un envío a ARCA es fiscalmente irreversible.

**Alternatives considered**:
- Cron dispara también la emisión final sin revisión: descartado por la decisión de negocio ya
  tomada.

## 4. Login por nombre de usuario (no por email)

**Decision**: Supabase Auth requiere un identificador tipo email para el login nativo. Se usa
un email interno sintético derivado del username (`<username>@<dominio-interno>.local`) como
identificador de Supabase Auth, y se guarda el email real del usuario en un campo separado
(`recovery_email`, tabla `profiles`) usado únicamente por el flujo de recuperación de
contraseña (una Edge Function que dispara el reset de Supabase Auth apuntando al email real).

**Rationale**: Reutiliza toda la infraestructura de sesión/JWT/RLS de Supabase Auth sin
reimplementar autenticación desde cero (Principio I), a la vez que cumple el requisito de la
spec de loguearse con username y recuperar contraseña por un email distinto.

**Alternatives considered**:
- Autenticación custom completa (tablas propias de credenciales, hashing manual, sesiones
  propias): descartado, viola el Principio I y duplica trabajo que Supabase ya resuelve.
- Login directo por email: descartado, la clarificación de la spec pidió explícitamente
  username.

## 5. Aislamiento de datos por local

**Decision**: Row Level Security (RLS) en Postgres sobre todas las tablas de negocio
(`productos`, `ventas`, `facturas`), basada en el `local_id` del usuario autenticado (resuelto
vía `profiles` a partir de `auth.uid()`).

**Rationale**: La constitution ya exige Supabase con RLS; aplicarlo a nivel de base de datos
es más robusto que filtrar solo en la capa de aplicación, y previene fugas de datos entre
locales aunque haya un bug en el frontend.

**Alternatives considered**:
- Aislamiento solo en queries de aplicación sin RLS: descartado, inseguro y contradice la
  restricción técnica ya fijada.

## 6. Envío del email de recuperación de contraseña

**Decision**: `recuperar-password` genera el link de recuperación con
`admin.generateLink({ type: "recovery", email: <email interno sintético> })`
(que **no** envía nada, solo devuelve el link) y lo envía por su cuenta,
por email, a `profiles.recovery_email` vía una API HTTP simple de envío
transaccional (Resend), usando una API key guardada como secreto de la
Edge Function.

**Rationale**: El email interno sintético (research.md §4) no es una
casilla real, así que el envío automático de Supabase Auth (que solo
manda al email de la cuenta) no puede usarse tal cual — hay que generar
el link y reenviarlo nosotros mismos al email de contacto real. Resend
se elige por tener una API HTTP mínima (un solo `fetch`, sin SDK ni
dependencias adicionales), acorde al Principio I.

**Alternatives considered**:
- Usar el email sintético como email de la cuenta y esperar que Supabase
  lo entregue: descartado, esa casilla no existe.
- Montar un servidor SMTP propio: descartado, complejidad innecesaria
  para el volumen de un solo local.

## Resumen de Technical Context resuelto

Con lo anterior, no quedan `NEEDS CLARIFICATION` pendientes en el Technical Context del plan.

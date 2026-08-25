# Edge Function: `recuperar-password`

Corresponde a FR-001a. Dispara el flujo de reseteo de contraseña de Supabase Auth hacia el
email real del usuario (research.md §4), a partir de su `username`.

## Request

```
POST /functions/v1/recuperar-password
Content-Type: application/json

{ "username": "string" }
```

No requiere sesión iniciada (se usa desde la pantalla de login, antes de loguearse).

## Behavior

1. Busca en `profiles` el registro con ese `username`.
2. Si existe, resuelve su `recovery_email` y dispara `supabase.auth.resetPasswordForEmail`
   sobre el email interno sintético asociado (research.md §4), con `recovery_email` como
   destino de entrega.
3. Responde siempre `200` con un mensaje genérico, exista o no el username (para no revelar
   qué usuarios existen).

## Response

```
200 OK
{ "message": "Si el usuario existe, se envió un email de recuperación." }
```

## Errors

| Status | Motivo |
|---|---|
| 400 | Falta `username` en el body |
| 500 | Error interno al disparar el reset (no relacionado a que el usuario exista o no) |

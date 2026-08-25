// Lógica pura de recuperar-password (contracts/recuperar-password.md),
// separada del entrypoint Deno (index.ts) para poder testearla con Vitest
// sin depender del runtime de Edge Functions. Ver research.md §4 y §6.

export interface RecoverableProfile {
  username: string;
  recoveryEmail: string;
  authEmail: string;
}

export interface RecuperarPasswordDeps {
  findProfileByUsername: (username: string) => Promise<RecoverableProfile | null>;
  generateRecoveryLink: (authEmail: string) => Promise<string>;
  sendRecoveryEmail: (recoveryEmail: string, link: string) => Promise<void>;
}

export interface RecuperarPasswordResult {
  status: number;
  body: { message: string };
}

const GENERIC_MESSAGE = "Si el usuario existe, se envió un email de recuperación.";

export async function handleRecuperarPassword(
  username: string,
  deps: RecuperarPasswordDeps
): Promise<RecuperarPasswordResult> {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized) {
    return { status: 400, body: { message: "Falta el nombre de usuario." } };
  }

  const profile = await deps.findProfileByUsername(normalized);
  if (profile) {
    const link = await deps.generateRecoveryLink(profile.authEmail);
    await deps.sendRecoveryEmail(profile.recoveryEmail, link);
  }

  // Respuesta genérica siempre, exista o no el usuario: no revela qué
  // usuarios existen en el sistema.
  return { status: 200, body: { message: GENERIC_MESSAGE } };
}

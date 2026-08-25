// Login por username en vez de email (spec.md FR-001), sobre un Supabase
// Auth que solo soporta login por email: se deriva un email interno
// sintético y determinístico del username (research.md §4). El email real
// del usuario para recuperar contraseña vive aparte, en profiles.recovery_email.
const SYNTHETIC_EMAIL_DOMAIN = "usuarios.local-simple.internal";

export function usernameToSyntheticEmail(username) {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized) {
    throw new Error("El nombre de usuario no puede estar vacío");
  }
  return `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

// Recibe un cliente Supabase (real o de prueba) por inyección de
// dependencias, para poder testear la lógica sin red ni Supabase real.
export function createAuthService(client) {
  return {
    async login(username, password) {
      const email = usernameToSyntheticEmail(username);
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data?.user ?? null, error };
    },

    async logout() {
      return client.auth.signOut();
    },

    async requireSession() {
      const {
        data: { session },
      } = await client.auth.getSession();
      return session ?? null;
    },
  };
}

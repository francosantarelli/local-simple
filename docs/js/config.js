// Configuración pública del proyecto Supabase. La anon key es segura de
// exponer en el cliente: el aislamiento de datos lo garantiza RLS
// (ver supabase/migrations/20260824000001_rls.sql), no el secreto de esta
// key. Reemplazar estos valores por los del proyecto real antes de
// desplegar (nunca poner acá la service role key ni credenciales de ARCA:
// esas viven solo en los secretos de las Edge Functions, Principio IV).
export const LOCAL_SIMPLE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
};

// Configuración pública del proyecto Supabase. La anon key es segura de
// exponer en el cliente: el aislamiento de datos lo garantiza RLS
// (ver supabase/migrations/20260824000001_rls.sql), no el secreto de esta
// key. Reemplazar estos valores por los del proyecto real antes de
// desplegar (nunca poner acá la service role key ni credenciales de ARCA:
// esas viven solo en los secretos de las Edge Functions, Principio IV).
export const LOCAL_SIMPLE_CONFIG = {
  supabaseUrl: "https://sxqpkgsblkgphfsjcyhd.supabase.co",
  supabaseAnonKey: "sb_publishable_hfuCxEuNj6GmFCUqy_fwEA_y-3TsAdj",
};

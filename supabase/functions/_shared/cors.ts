// CORS compartido por las Edge Functions invocadas desde el navegador
// (ventas.html, facturas.html, recuperar-password.html). Sin esto, el
// navegador manda un preflight OPTIONS antes del POST real (por los
// headers custom Authorization/apikey/content-type) y lo corta con 405
// apenas Deno.serve no sabe responder OPTIONS — la autorización real la
// siguen imponiendo los checks de JWT/service role key adentro de cada
// función, esto solo habilita que el navegador deje pasar la llamada.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

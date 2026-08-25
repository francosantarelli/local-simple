-- Corrige 20260824000002_cron.sql: en Supabase gestionado (no self-hosted)
-- el rol de la base no tiene permiso para `alter database ... set
-- app.settings.*` (GUCs custom) — el intento manual dio
-- "permission denied to set parameter". Se reemplaza esa lectura por
-- Supabase Vault, el mecanismo soportado en la plataforma gestionada
-- para que un cron job lea un secreto sin exponerlo en el código.
--
-- Antes de que este cron funcione hace falta crear el secreto UNA VEZ,
-- corriendo esto en el SQL Editor del dashboard (nunca en una migración
-- commiteada, para no exponer el service_role_key en git — Principio IV):
--
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- La URL de las Edge Functions no es secreta (el service_role_key en el
-- header Authorization es lo que protege el endpoint), así que sí se
-- puede commitear literal.

select cron.schedule(
  'generar-borrador-factura-semanal',
  '0 21 * * 5', -- viernes 21:00 UTC; ajustar a la zona horaria real si hace falta
  $$
  select net.http_post(
    url := 'https://sxqpkgsblkgphfsjcyhd.supabase.co/functions/v1/generar-borrador-factura',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
      ),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'periodo_desde', (date_trunc('week', now()))::date,
      'periodo_hasta', (date_trunc('week', now()) + interval '4 days')::date
    )
  );
  $$
);

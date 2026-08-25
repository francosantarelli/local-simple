-- Cron semanal (viernes) que invoca la Edge Function generar-borrador-factura
-- (contracts/generar-borrador-factura.md, research.md §3).
--
-- IMPORTANTE: no se commitea ningún secreto acá (Principio IV). La URL de
-- las Edge Functions y la service role key se leen de settings de la base
-- que hay que configurar aparte, una sola vez, por proyecto:
--
--   alter database postgres set app.settings.supabase_functions_url = 'https://<project-ref>.supabase.co/functions/v1';
--   alter database postgres set app.settings.service_role_key = '<service-role-key>';
--
-- (En desarrollo local, `supabase status` muestra la URL de functions y la
-- service_role key del stack local.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generar-borrador-factura-semanal',
  '0 21 * * 5', -- viernes 21:00 UTC; ajustar a la zona horaria real si hace falta
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_functions_url', true) || '/generar-borrador-factura',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'periodo_desde', (date_trunc('week', now()))::date,
      'periodo_hasta', (date_trunc('week', now()) + interval '4 days')::date
    )
  );
  $$
);

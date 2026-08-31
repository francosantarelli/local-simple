-- Certificado/clave ARCA por local (antes un único par global, leído
-- como secreto de la Edge Function `confirmar-factura` — ver su README,
-- sección "Límite conocido"). Cada local puede tener su propio CUIT y
-- por lo tanto necesita su propio certificado para facturar.
--
-- Mismo patrón que `arca_tickets`: RLS habilitada sin ninguna política,
-- así que ni anon ni authenticated pueden leer/escribir esta tabla bajo
-- ningún caso (ni siquiera el propio local sobre su propia fila) — solo
-- el service role de la Edge Function, que ignora RLS, puede acceder.
-- Son credenciales fiscales sensibles (Principio IV), nunca expuestas
-- al cliente.

create table local_arca_credentials (
  local_id uuid primary key references locales (id) on delete cascade,
  cert_pem text not null,
  key_pem text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table local_arca_credentials enable row level security;

create trigger local_arca_credentials_touch_updated_at
  before update on local_arca_credentials
  for each row
  execute function public.touch_updated_at();

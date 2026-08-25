-- Cache del Ticket de Acceso (TA) de WSAA por local (research.md §2).
-- Solo accedida por Edge Functions vía service role; RLS habilitada sin
-- políticas para el cliente (deny por defecto), igual que `facturas`.

create table arca_tickets (
  local_id uuid primary key references locales (id),
  token text not null,
  sign text not null,
  expira_en timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table arca_tickets enable row level security;

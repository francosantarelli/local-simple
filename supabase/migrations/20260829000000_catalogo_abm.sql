-- Catálogo administrable desde la app: categorías (entidad nueva) +
-- ABM de productos (antes solo se podían leer, el alta era manual). Ver
-- data-model.md (`categorias`, `productos.categoria_id`).

create table categorias (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales (id),
  descripcion text not null,
  created_at timestamptz not null default now()
);

create index categorias_local_id_idx on categorias (local_id);

alter table productos
  add column categoria_id uuid references categorias (id);

-- `updated_at` de productos existía desde el esquema inicial pero nada lo
-- tocaba en un UPDATE real (antes solo se insertaba manualmente).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger productos_touch_updated_at
  before update on productos
  for each row
  execute function public.touch_updated_at();

-- RLS: categorías, mismo patrón que el resto (aislado por local_id_actual()).

alter table categorias enable row level security;

create policy categorias_select_propio_local on categorias
  for select
  using (local_id = public.local_id_actual());

create policy categorias_insert_propio_local on categorias
  for insert
  with check (local_id = public.local_id_actual());

create policy categorias_update_propio_local on categorias
  for update
  using (local_id = public.local_id_actual())
  with check (local_id = public.local_id_actual());

create policy categorias_delete_propio_local on categorias
  for delete
  using (local_id = public.local_id_actual());

-- RLS: productos ahora también admite alta/edición/baja desde la app
-- (antes solo tenía política de lectura).

create policy productos_insert_propio_local on productos
  for insert
  with check (local_id = public.local_id_actual());

create policy productos_update_propio_local on productos
  for update
  using (local_id = public.local_id_actual())
  with check (local_id = public.local_id_actual());

create policy productos_delete_propio_local on productos
  for delete
  using (local_id = public.local_id_actual());

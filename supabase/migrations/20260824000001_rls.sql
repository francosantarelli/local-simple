-- Row Level Security: aisla todos los datos por local_id del usuario
-- autenticado. Ver specs/001-ventas-facturacion-arca/research.md §5.

-- Helper: resuelve el local_id del usuario autenticado a partir de su
-- profile. SECURITY DEFINER para evitar recursión de RLS sobre `profiles`
-- al evaluarse dentro de las propias políticas de `profiles`.
create or replace function public.local_id_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select local_id from profiles where id = auth.uid()
$$;

-- locales ---------------------------------------------------------------
-- Alta/edición de locales es manual (fuera de la app), solo lectura del
-- propio local desde el cliente.

alter table locales enable row level security;

create policy locales_select_propio on locales
  for select
  using (id = public.local_id_actual());

-- profiles ---------------------------------------------------------------
-- Alta de usuarios es manual (fuera de la app); solo lectura de perfiles
-- del propio local (útil para mostrar quién cargó una venta/confirmó una
-- factura).

alter table profiles enable row level security;

create policy profiles_select_mismo_local on profiles
  for select
  using (local_id = public.local_id_actual());

-- productos ---------------------------------------------------------------
-- Catálogo cargado manualmente (ver Nota en tasks.md); el cliente solo lee.

alter table productos enable row level security;

create policy productos_select_propio_local on productos
  for select
  using (local_id = public.local_id_actual());

-- ventas ---------------------------------------------------------------
-- El cliente puede leer, crear, y editar/eliminar ventas de su local; la
-- inmutabilidad de una venta ya facturada la impone el trigger
-- `ventas_inmutable_si_facturada` (defensa en profundidad, no solo RLS).

alter table ventas enable row level security;

create policy ventas_select_propio_local on ventas
  for select
  using (local_id = public.local_id_actual());

create policy ventas_insert_propio_local on ventas
  for insert
  with check (local_id = public.local_id_actual() and usuario_id = auth.uid());

create policy ventas_update_propio_local on ventas
  for update
  using (local_id = public.local_id_actual())
  with check (local_id = public.local_id_actual());

create policy ventas_delete_propio_local on ventas
  for delete
  using (local_id = public.local_id_actual());

-- facturas ---------------------------------------------------------------
-- Las facturas solo se crean/emiten desde las Edge Functions (service
-- role key, que ignora RLS); el cliente únicamente lee las de su local.

alter table facturas enable row level security;

create policy facturas_select_propio_local on facturas
  for select
  using (local_id = public.local_id_actual());

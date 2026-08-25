-- Esquema inicial: locales, profiles, productos, ventas, facturas
-- Ver specs/001-ventas-facturacion-arca/data-model.md para el detalle de cada campo.

create extension if not exists pgcrypto;

create type condicion_iva as enum ('monotributo', 'responsable_inscripto', 'exento');
create type modo_pago as enum ('tarjeta', 'efectivo');
create type estado_factura as enum ('borrador', 'emitida', 'rechazada');

-- locales -------------------------------------------------------------

create table locales (
  id uuid primary key default gen_random_uuid(),
  nombre_fantasia text not null,
  razon_social text not null,
  cuit text not null unique,
  condicion_iva condicion_iva not null,
  punto_venta integer not null,
  domicilio_fiscal text not null,
  created_at timestamptz not null default now()
);

-- profiles (extiende auth.users) --------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  recovery_email text not null,
  local_id uuid not null references locales (id),
  created_at timestamptz not null default now()
);

create index profiles_local_id_idx on profiles (local_id);

-- productos -------------------------------------------------------------

create table productos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales (id),
  nombre text not null,
  precio_unitario numeric(12, 2) not null check (precio_unitario > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productos_local_id_idx on productos (local_id);

-- facturas -------------------------------------------------------------

create table facturas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales (id),
  periodo_desde date not null,
  periodo_hasta date not null,
  modo_pago modo_pago not null,
  monto_total numeric(12, 2) not null default 0,
  estado estado_factura not null default 'borrador',
  cae text,
  motivo_rechazo text,
  confirmado_por uuid references profiles (id),
  confirmado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (local_id, periodo_desde, periodo_hasta, modo_pago)
);

create index facturas_local_id_periodo_idx on facturas (local_id, periodo_desde, periodo_hasta);

-- ventas -------------------------------------------------------------

create table ventas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locales (id),
  usuario_id uuid not null references profiles (id),
  producto_id uuid references productos (id),
  fecha date not null,
  cantidad numeric(12, 2) not null check (cantidad > 0),
  descripcion text not null,
  precio_unitario numeric(12, 2) not null check (precio_unitario > 0),
  precio_total numeric(12, 2) not null check (precio_total > 0),
  modo_pago modo_pago not null,
  factura_id uuid references facturas (id),
  created_at timestamptz not null default now()
);

create index ventas_local_id_fecha_idx on ventas (local_id, fecha);
create index ventas_factura_id_idx on ventas (factura_id);

-- Integridad de datos fiscales (Principio V): una factura emitida y las
-- ventas que incluye son inmutables en la base de datos, no solo en la app.

create or replace function forbid_mutation_of_factura_emitida()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.estado = 'emitida' then
      raise exception 'No se puede eliminar una factura emitida (id=%)', OLD.id;
    end if;
    return OLD;
  end if;

  if OLD.estado = 'emitida' then
    raise exception 'No se puede modificar una factura emitida (id=%)', OLD.id;
  end if;
  return NEW;
end;
$$;

create trigger facturas_inmutable_si_emitida
  before update or delete on facturas
  for each row
  execute function forbid_mutation_of_factura_emitida();

create or replace function forbid_mutation_of_venta_facturada()
returns trigger
language plpgsql
as $$
declare
  v_estado estado_factura;
begin
  if OLD.factura_id is not null then
    select estado into v_estado from facturas where id = OLD.factura_id;
    if v_estado = 'emitida' then
      raise exception 'No se puede modificar/eliminar una venta ya facturada (id=%)', OLD.id;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger ventas_inmutable_si_facturada
  before update or delete on ventas
  for each row
  execute function forbid_mutation_of_venta_facturada();

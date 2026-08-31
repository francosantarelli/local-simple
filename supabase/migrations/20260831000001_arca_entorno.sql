-- Cada local puede tener certificado tanto de sandbox (homologación) como
-- de producción a la vez, y elegir cuál está activo para emitir. Antes
-- (migración 20260831000000) un local tenía como máximo un certificado.
--
-- `locales.arca_entorno_activo` dice cuál de los dos usa `confirmar-factura`
-- al emitir; default 'homologacion' (nunca arrancar emitiendo en
-- producción por default). El cache de Ticket de Acceso (`arca_tickets`)
-- también pasa a ser por (local, entorno): un TA de homologación no sirve
-- contra WSFEv1 de producción ni viceversa, así que compartir la fila
-- entre entornos serviría un ticket del entorno equivocado al cambiar
-- `arca_entorno_activo`.

create type arca_entorno as enum ('homologacion', 'produccion');

alter table locales
  add column arca_entorno_activo arca_entorno not null default 'homologacion';

alter table local_arca_credentials
  drop constraint local_arca_credentials_pkey;

alter table local_arca_credentials
  add column entorno arca_entorno not null default 'homologacion';

alter table local_arca_credentials
  add primary key (local_id, entorno);

alter table arca_tickets
  drop constraint arca_tickets_pkey;

alter table arca_tickets
  add column entorno arca_entorno not null default 'homologacion';

alter table arca_tickets
  add primary key (local_id, entorno);

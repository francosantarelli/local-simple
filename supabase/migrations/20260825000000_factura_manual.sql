-- Soporte para generar un borrador de factura manualmente, a partir de
-- una selección de ventas no facturadas (en vez de esperar al cron
-- semanal). Ver contracts/generar-borrador-factura.md.
--
-- Las facturas manuales derivan su período (periodo_desde/periodo_hasta)
-- del rango real de fechas de las ventas elegidas, no de una semana fija.
-- Eso puede coincidir por casualidad con el período de otra factura del
-- mismo local/modo de pago (ej. dos tandas manuales el mismo día), lo
-- que rompería la unique constraint pensada para garantizar "una factura
-- automática por semana". Se resuelve agregando `origen` y reemplazando
-- esa constraint por un índice único parcial que solo aplica a las
-- facturas automáticas (la idempotencia del cron sigue intacta; las
-- manuales no compiten por esa restricción).

alter table facturas
  add column origen text not null default 'automatico'
    check (origen in ('automatico', 'manual'));

alter table facturas
  drop constraint facturas_local_id_periodo_desde_periodo_hasta_modo_pago_key;

create unique index facturas_unico_automatico_idx
  on facturas (local_id, periodo_desde, periodo_hasta, modo_pago)
  where origen = 'automatico';

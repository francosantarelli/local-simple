// Lógica pura de generar-borrador-factura (contracts/generar-borrador-factura.md).
// FR-011: agrupa las ventas no facturadas de la semana por local + modo de
// pago y crea un borrador de factura por cada grupo no vacío.

export type ModoPago = "tarjeta" | "efectivo";

export interface VentaNoFacturada {
  id: string;
  localId: string;
  modoPago: ModoPago;
  precioTotal: number;
}

export interface FacturaBorrador {
  localId: string;
  modoPago: ModoPago;
  montoTotal: number;
  ventaIds: string[];
}

export function agruparVentasPorLocalYModoPago(
  ventas: VentaNoFacturada[]
): FacturaBorrador[] {
  const grupos = new Map<string, FacturaBorrador>();

  for (const venta of ventas) {
    const key = `${venta.localId}::${venta.modoPago}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        localId: venta.localId,
        modoPago: venta.modoPago,
        montoTotal: 0,
        ventaIds: [],
      });
    }
    const grupo = grupos.get(key)!;
    grupo.montoTotal = Math.round((grupo.montoTotal + venta.precioTotal) * 100) / 100;
    grupo.ventaIds.push(venta.id);
  }

  return [...grupos.values()];
}

export interface GenerarBorradorDeps {
  // Debe devolver solo ventas con factura_id IS NULL en el período: esto
  // es lo que hace que reintentar sea idempotente (una venta ya vinculada
  // a un borrador no vuelve a aparecer acá).
  obtenerVentasNoFacturadas: (
    periodoDesde: string,
    periodoHasta: string
  ) => Promise<VentaNoFacturada[]>;
  // Debe hacer upsert sobre la unique constraint
  // (local_id, periodo_desde, periodo_hasta, modo_pago) para que reintentar
  // no duplique facturas.
  crearFacturaBorrador: (
    grupo: FacturaBorrador,
    periodoDesde: string,
    periodoHasta: string
  ) => Promise<{ facturaId: string }>;
  vincularVentasAFactura: (ventaIds: string[], facturaId: string) => Promise<void>;
}

export interface GenerarBorradorResultado {
  facturasGeneradas: number;
}

export async function generarBorradoresDeLaSemana(
  periodoDesde: string,
  periodoHasta: string,
  deps: GenerarBorradorDeps
): Promise<GenerarBorradorResultado> {
  const ventas = await deps.obtenerVentasNoFacturadas(periodoDesde, periodoHasta);
  const grupos = agruparVentasPorLocalYModoPago(ventas);

  let facturasGeneradas = 0;
  for (const grupo of grupos) {
    if (grupo.ventaIds.length === 0) continue;
    const { facturaId } = await deps.crearFacturaBorrador(grupo, periodoDesde, periodoHasta);
    await deps.vincularVentasAFactura(grupo.ventaIds, facturaId);
    facturasGeneradas += 1;
  }

  return { facturasGeneradas };
}

// --- Generación manual: un usuario elige puntualmente qué ventas no
// facturadas de su local agrupar en un borrador, en vez de esperar al
// cron semanal. Ver data-model.md (columna `origen`) sobre por qué las
// facturas manuales no comparten la unique constraint de las automáticas.

export interface VentaParaFacturar extends VentaNoFacturada {
  fecha: string; // 'YYYY-MM-DD', deriva el período de cada grupo manual
}

export interface GrupoManual extends FacturaBorrador {
  periodoDesde: string;
  periodoHasta: string;
}

export function agruparVentasSeleccionadas(ventas: VentaParaFacturar[]): GrupoManual[] {
  const grupos = new Map<string, GrupoManual>();

  for (const venta of ventas) {
    const key = `${venta.localId}::${venta.modoPago}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        localId: venta.localId,
        modoPago: venta.modoPago,
        montoTotal: 0,
        ventaIds: [],
        periodoDesde: venta.fecha,
        periodoHasta: venta.fecha,
      });
    }
    const grupo = grupos.get(key)!;
    grupo.montoTotal = Math.round((grupo.montoTotal + venta.precioTotal) * 100) / 100;
    grupo.ventaIds.push(venta.id);
    if (venta.fecha < grupo.periodoDesde) grupo.periodoDesde = venta.fecha;
    if (venta.fecha > grupo.periodoHasta) grupo.periodoHasta = venta.fecha;
  }

  return [...grupos.values()];
}

export interface GenerarBorradorManualDeps {
  // Debe filtrar por local_id (autorización: nunca confiar en un
  // local_id que mande el cliente) y por factura_id IS NULL (una venta
  // ya reclamada por otro borrador, aunque no esté emitido, no se puede
  // volver a elegir).
  obtenerVentasSeleccionadas: (
    ventaIds: string[],
    localId: string
  ) => Promise<VentaParaFacturar[]>;
  crearFacturaBorrador: (grupo: GrupoManual) => Promise<{ facturaId: string }>;
  vincularVentasAFactura: (ventaIds: string[], facturaId: string) => Promise<void>;
}

export interface GenerarBorradorManualResultado {
  facturasGeneradas: number;
  // ids pedidos que no se pudieron incluir (de otro local, inexistentes,
  // o ya vinculados a otra factura) — para avisarle al usuario.
  ventasOmitidas: string[];
}

export async function generarBorradorManual(
  ventaIds: string[],
  localId: string,
  deps: GenerarBorradorManualDeps
): Promise<GenerarBorradorManualResultado> {
  if (ventaIds.length === 0) {
    return { facturasGeneradas: 0, ventasOmitidas: [] };
  }

  const ventas = await deps.obtenerVentasSeleccionadas(ventaIds, localId);
  const idsEncontrados = new Set(ventas.map((v) => v.id));
  const ventasOmitidas = ventaIds.filter((id) => !idsEncontrados.has(id));

  const grupos = agruparVentasSeleccionadas(ventas);
  let facturasGeneradas = 0;
  for (const grupo of grupos) {
    const { facturaId } = await deps.crearFacturaBorrador(grupo);
    await deps.vincularVentasAFactura(grupo.ventaIds, facturaId);
    facturasGeneradas += 1;
  }

  return { facturasGeneradas, ventasOmitidas };
}

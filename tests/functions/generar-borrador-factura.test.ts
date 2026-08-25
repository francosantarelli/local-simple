import { describe, it, expect, vi } from "vitest";
import {
  agruparVentasPorLocalYModoPago,
  generarBorradoresDeLaSemana,
  agruparVentasSeleccionadas,
  generarBorradorManual,
} from "../../supabase/functions/generar-borrador-factura/logic";

describe("agruparVentasPorLocalYModoPago", () => {
  it("agrupa y suma por local + modo de pago", () => {
    const grupos = agruparVentasPorLocalYModoPago([
      { id: "v1", localId: "L1", modoPago: "efectivo", precioTotal: 100 },
      { id: "v2", localId: "L1", modoPago: "efectivo", precioTotal: 50 },
      { id: "v3", localId: "L1", modoPago: "tarjeta", precioTotal: 200 },
      { id: "v4", localId: "L2", modoPago: "efectivo", precioTotal: 10 },
    ]);

    expect(grupos).toHaveLength(3);
    const l1efectivo = grupos.find((g) => g.localId === "L1" && g.modoPago === "efectivo");
    expect(l1efectivo?.montoTotal).toBe(150);
    expect(l1efectivo?.ventaIds).toEqual(["v1", "v2"]);
  });

  it("sin ventas no genera ningún grupo", () => {
    expect(agruparVentasPorLocalYModoPago([])).toEqual([]);
  });
});

describe("generarBorradoresDeLaSemana", () => {
  it("crea una factura borrador por cada grupo y vincula sus ventas", async () => {
    const obtenerVentasNoFacturadas = vi.fn().mockResolvedValue([
      { id: "v1", localId: "L1", modoPago: "efectivo", precioTotal: 100 },
      { id: "v2", localId: "L1", modoPago: "tarjeta", precioTotal: 200 },
    ]);
    const crearFacturaBorrador = vi
      .fn()
      .mockResolvedValueOnce({ facturaId: "f-efectivo" })
      .mockResolvedValueOnce({ facturaId: "f-tarjeta" });
    const vincularVentasAFactura = vi.fn().mockResolvedValue(undefined);

    const resultado = await generarBorradoresDeLaSemana("2026-08-17", "2026-08-21", {
      obtenerVentasNoFacturadas,
      crearFacturaBorrador,
      vincularVentasAFactura,
    });

    expect(crearFacturaBorrador).toHaveBeenCalledTimes(2);
    expect(vincularVentasAFactura).toHaveBeenCalledWith(["v1"], "f-efectivo");
    expect(vincularVentasAFactura).toHaveBeenCalledWith(["v2"], "f-tarjeta");
    expect(resultado.facturasGeneradas).toBe(2);
  });

  it("si no hay ventas no facturadas, no crea ninguna factura (idempotente en reintentos)", async () => {
    const obtenerVentasNoFacturadas = vi.fn().mockResolvedValue([]);
    const crearFacturaBorrador = vi.fn();
    const vincularVentasAFactura = vi.fn();

    const resultado = await generarBorradoresDeLaSemana("2026-08-17", "2026-08-21", {
      obtenerVentasNoFacturadas,
      crearFacturaBorrador,
      vincularVentasAFactura,
    });

    expect(crearFacturaBorrador).not.toHaveBeenCalled();
    expect(resultado.facturasGeneradas).toBe(0);
  });
});

describe("agruparVentasSeleccionadas", () => {
  it("agrupa por local+modo de pago y deriva el período del mín/máx de fecha de cada grupo", () => {
    const grupos = agruparVentasSeleccionadas([
      { id: "v1", localId: "L1", modoPago: "efectivo", precioTotal: 100, fecha: "2026-08-20" },
      { id: "v2", localId: "L1", modoPago: "efectivo", precioTotal: 50, fecha: "2026-08-10" },
      { id: "v3", localId: "L1", modoPago: "tarjeta", precioTotal: 200, fecha: "2026-08-24" },
    ]);

    expect(grupos).toHaveLength(2);
    const efectivo = grupos.find((g) => g.modoPago === "efectivo")!;
    expect(efectivo.montoTotal).toBe(150);
    expect(efectivo.periodoDesde).toBe("2026-08-10");
    expect(efectivo.periodoHasta).toBe("2026-08-20");
    const tarjeta = grupos.find((g) => g.modoPago === "tarjeta")!;
    expect(tarjeta.periodoDesde).toBe("2026-08-24");
    expect(tarjeta.periodoHasta).toBe("2026-08-24");
  });
});

describe("generarBorradorManual", () => {
  it("agrupa las ventas seleccionadas por modo de pago y crea una factura por grupo", async () => {
    const obtenerVentasSeleccionadas = vi.fn().mockResolvedValue([
      { id: "v1", localId: "L1", modoPago: "efectivo", precioTotal: 100, fecha: "2026-08-20" },
      { id: "v2", localId: "L1", modoPago: "tarjeta", precioTotal: 200, fecha: "2026-08-21" },
    ]);
    const crearFacturaBorrador = vi
      .fn()
      .mockResolvedValueOnce({ facturaId: "f-efectivo" })
      .mockResolvedValueOnce({ facturaId: "f-tarjeta" });
    const vincularVentasAFactura = vi.fn().mockResolvedValue(undefined);

    const resultado = await generarBorradorManual(["v1", "v2"], "L1", {
      obtenerVentasSeleccionadas,
      crearFacturaBorrador,
      vincularVentasAFactura,
    });

    expect(obtenerVentasSeleccionadas).toHaveBeenCalledWith(["v1", "v2"], "L1");
    expect(crearFacturaBorrador).toHaveBeenCalledTimes(2);
    expect(vincularVentasAFactura).toHaveBeenCalledWith(["v1"], "f-efectivo");
    expect(vincularVentasAFactura).toHaveBeenCalledWith(["v2"], "f-tarjeta");
    expect(resultado.facturasGeneradas).toBe(2);
    expect(resultado.ventasOmitidas).toEqual([]);
  });

  it("informa qué ventas seleccionadas se omitieron (de otro local o ya facturadas)", async () => {
    const obtenerVentasSeleccionadas = vi.fn().mockResolvedValue([
      { id: "v1", localId: "L1", modoPago: "efectivo", precioTotal: 100, fecha: "2026-08-20" },
    ]);
    const crearFacturaBorrador = vi.fn().mockResolvedValue({ facturaId: "f1" });
    const vincularVentasAFactura = vi.fn().mockResolvedValue(undefined);

    const resultado = await generarBorradorManual(["v1", "v2", "v3"], "L1", {
      obtenerVentasSeleccionadas,
      crearFacturaBorrador,
      vincularVentasAFactura,
    });

    expect(resultado.ventasOmitidas).toEqual(["v2", "v3"]);
    expect(resultado.facturasGeneradas).toBe(1);
  });

  it("sin ventaIds no hace nada", async () => {
    const obtenerVentasSeleccionadas = vi.fn();
    const crearFacturaBorrador = vi.fn();
    const vincularVentasAFactura = vi.fn();

    const resultado = await generarBorradorManual([], "L1", {
      obtenerVentasSeleccionadas,
      crearFacturaBorrador,
      vincularVentasAFactura,
    });

    expect(obtenerVentasSeleccionadas).not.toHaveBeenCalled();
    expect(resultado).toEqual({ facturasGeneradas: 0, ventasOmitidas: [] });
  });
});

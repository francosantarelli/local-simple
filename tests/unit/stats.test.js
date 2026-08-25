import { describe, it, expect } from "vitest";
import { computeStats } from "../../docs/js/ventas.js";

describe("computeStats", () => {
  const ventas = [
    { fecha: "2026-08-24", precio_total: 100, factura_id: null, facturas: null },
    { fecha: "2026-08-24", precio_total: 25.4, factura_id: null, facturas: null },
    { fecha: "2026-08-20", precio_total: 500, factura_id: "f1", facturas: { estado: "emitida" } },
    { fecha: "2026-08-10", precio_total: 200, factura_id: "f2", facturas: { estado: "borrador" } },
    { fecha: "2026-07-15", precio_total: 999, factura_id: null, facturas: null }, // mes anterior, no cuenta
  ];

  it("suma monto y cuenta las ventas de hoy", () => {
    const stats = computeStats(ventas, "2026-08-24");
    expect(stats.hoy.monto).toBeCloseTo(125.4);
    expect(stats.hoy.cantidad).toBe(2);
  });

  it("suma monto y cuenta las ventas del mes en curso (por fecha, no por hoy)", () => {
    const stats = computeStats(ventas, "2026-08-24");
    // agosto: las 4 primeras ventas (100 + 25.4 + 500 + 200), julio no cuenta
    expect(stats.mes.monto).toBeCloseTo(825.4);
    expect(stats.mes.cantidad).toBe(4);
  });

  it("cuenta como pendientes las que no están facturada (emitida)", () => {
    const stats = computeStats(ventas, "2026-08-24");
    // no facturadas: las 2 de hoy + la de julio (borrador y sin factura no cuentan como emitida)
    // la del 10/08 tiene factura en borrador -> tampoco cuenta como facturada -> pendiente
    expect(stats.pendientes).toBe(4);
  });

  it("con una lista vacía devuelve todo en cero", () => {
    const stats = computeStats([], "2026-08-24");
    expect(stats).toEqual({
      hoy: { monto: 0, cantidad: 0 },
      mes: { monto: 0, cantidad: 0 },
      pendientes: 0,
    });
  });
});

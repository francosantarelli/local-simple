import { describe, it, expect, vi } from "vitest";
import {
  agruparVentasPorLocalYModoPago,
  generarBorradoresDeLaSemana,
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

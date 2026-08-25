import { describe, it, expect, vi } from "vitest";
import {
  estaFacturada,
  filtrarPorEstadoFacturacion,
  createVentasService,
} from "../../docs/js/ventas.js";

// Condición compuesta de "facturada" documentada en data-model.md: no
// alcanza con que factura_id no sea null, la factura asociada tiene que
// estar en estado 'emitida' (un borrador o una factura rechazada no
// cuentan como facturada).
describe("estaFacturada", () => {
  it("no está facturada si no tiene factura asociada", () => {
    expect(estaFacturada({ factura_id: null, facturas: null })).toBe(false);
  });

  it("no está facturada si su factura sigue en borrador", () => {
    expect(estaFacturada({ factura_id: "f1", facturas: { estado: "borrador" } })).toBe(false);
  });

  it("no está facturada si su factura fue rechazada", () => {
    expect(estaFacturada({ factura_id: "f1", facturas: { estado: "rechazada" } })).toBe(false);
  });

  it("está facturada si su factura fue emitida", () => {
    expect(estaFacturada({ factura_id: "f1", facturas: { estado: "emitida" } })).toBe(true);
  });
});

describe("filtrarPorEstadoFacturacion", () => {
  const ventas = [
    { id: "v1", factura_id: null, facturas: null },
    { id: "v2", factura_id: "f1", facturas: { estado: "borrador" } },
    { id: "v3", factura_id: "f2", facturas: { estado: "emitida" } },
  ];

  it("sin filtro devuelve todas las ventas", () => {
    expect(filtrarPorEstadoFacturacion(ventas, undefined)).toHaveLength(3);
  });

  it("'no-facturada' incluye las sin factura y las con borrador/rechazada", () => {
    const resultado = filtrarPorEstadoFacturacion(ventas, "no-facturada");
    expect(resultado.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("'facturada' incluye solo las de factura emitida", () => {
    const resultado = filtrarPorEstadoFacturacion(ventas, "facturada");
    expect(resultado.map((v) => v.id)).toEqual(["v3"]);
  });
});

describe("createVentasService.listarVentas", () => {
  function mockQuery(resultado) {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue(resultado),
    };
    return query;
  }

  it("aplica el filtro de local, rango de fechas y modo de pago en la query", async () => {
    const query = mockQuery({ data: [], error: null });
    const client = { from: vi.fn().mockReturnValue(query) };
    const service = createVentasService(client);

    await service.listarVentas("local-1", {
      desde: "2026-08-01",
      hasta: "2026-08-07",
      modoPago: "efectivo",
    });

    expect(client.from).toHaveBeenCalledWith("ventas");
    expect(query.eq).toHaveBeenCalledWith("local_id", "local-1");
    expect(query.eq).toHaveBeenCalledWith("modo_pago", "efectivo");
    expect(query.gte).toHaveBeenCalledWith("fecha", "2026-08-01");
    expect(query.lte).toHaveBeenCalledWith("fecha", "2026-08-07");
  });

  it("filtra por estado de facturación en memoria sobre el resultado", async () => {
    const query = mockQuery({
      data: [
        { id: "v1", factura_id: null, facturas: null },
        { id: "v2", factura_id: "f2", facturas: { estado: "emitida" } },
      ],
      error: null,
    });
    const client = { from: vi.fn().mockReturnValue(query) };
    const service = createVentasService(client);

    const { data } = await service.listarVentas("local-1", { estado: "facturada" });

    expect(data.map((v) => v.id)).toEqual(["v2"]);
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  calcularPrecioTotal,
  validarVenta,
  createVentasService,
} from "../../docs/js/ventas.js";

describe("calcularPrecioTotal", () => {
  it("multiplica cantidad por precio unitario", () => {
    expect(calcularPrecioTotal(3, 150)).toBe(450);
  });

  it("redondea a 2 decimales", () => {
    expect(calcularPrecioTotal(3, 10.005)).toBe(30.02);
  });
});

describe("validarVenta", () => {
  const base = {
    fecha: "2026-08-24",
    cantidad: 2,
    descripcion: "Café",
    precioUnitario: 100,
    precioTotal: 200,
    modoPago: "efectivo",
  };

  it("no encuentra errores en una venta válida", () => {
    expect(validarVenta(base)).toEqual({});
  });

  it("rechaza cantidad negativa o cero", () => {
    expect(validarVenta({ ...base, cantidad: 0 }).cantidad).toBeTruthy();
    expect(validarVenta({ ...base, cantidad: -1 }).cantidad).toBeTruthy();
  });

  it("rechaza precio unitario no numérico", () => {
    expect(validarVenta({ ...base, precioUnitario: "abc" }).precioUnitario).toBeTruthy();
  });

  it("rechaza descripción vacía", () => {
    expect(validarVenta({ ...base, descripcion: "  " }).descripcion).toBeTruthy();
  });

  it("rechaza un modo de pago fuera de tarjeta/efectivo", () => {
    expect(validarVenta({ ...base, modoPago: "cheque" }).modoPago).toBeTruthy();
  });

  it("rechaza falta de fecha", () => {
    expect(validarVenta({ ...base, fecha: "" }).fecha).toBeTruthy();
  });
});

describe("createVentasService.crearVenta", () => {
  const localId = "local-1";
  const usuarioId = "user-1";

  it("calcula el precio total automáticamente cuando no se ingresa manualmente", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "v1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const service = createVentasService(client);

    await service.crearVenta({
      localId,
      usuarioId,
      fecha: "2026-08-24",
      cantidad: 3,
      descripcion: "Café",
      precioUnitario: 100,
      precioTotal: "",
      modoPago: "efectivo",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 300 })
    );
  });

  it("respeta un precio total ingresado manualmente aunque no coincida con cantidad × precio unitario", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "v1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const service = createVentasService(client);

    await service.crearVenta({
      localId,
      usuarioId,
      fecha: "2026-08-24",
      cantidad: 3,
      descripcion: "Café con descuento",
      precioUnitario: 100,
      precioTotal: 250,
      modoPago: "efectivo",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 250 })
    );
  });

  it("no llama a insert y devuelve errores si la venta es inválida", async () => {
    const insert = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const service = createVentasService(client);

    const result = await service.crearVenta({
      localId,
      usuarioId,
      fecha: "2026-08-24",
      cantidad: -1,
      descripcion: "Café",
      precioUnitario: 100,
      precioTotal: "",
      modoPago: "efectivo",
    });

    expect(insert).not.toHaveBeenCalled();
    expect(result.errors.cantidad).toBeTruthy();
  });
});

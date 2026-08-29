import { describe, it, expect, vi } from "vitest";
import { validarProducto, createProductosService } from "../../docs/js/productos.js";

describe("validarProducto", () => {
  it("no encuentra errores en un producto válido", () => {
    expect(validarProducto({ nombre: "Café", precioUnitario: 2500 })).toEqual({});
  });

  it("rechaza nombre vacío", () => {
    expect(validarProducto({ nombre: "  ", precioUnitario: 2500 }).nombre).toBeTruthy();
  });

  it("rechaza precio unitario cero o negativo", () => {
    expect(validarProducto({ nombre: "Café", precioUnitario: 0 }).precioUnitario).toBeTruthy();
    expect(validarProducto({ nombre: "Café", precioUnitario: -5 }).precioUnitario).toBeTruthy();
  });

  it("rechaza precio unitario no numérico", () => {
    expect(validarProducto({ nombre: "Café", precioUnitario: "abc" }).precioUnitario).toBeTruthy();
  });

  it("la categoría es opcional", () => {
    expect(validarProducto({ nombre: "Café", precioUnitario: 2500, categoriaId: null })).toEqual({});
  });
});

describe("createProductosService.crearProducto", () => {
  const localId = "local-1";

  it("no llama a insert y devuelve errores si el producto es inválido", async () => {
    const insert = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const service = createProductosService(client);

    const result = await service.crearProducto({ localId, nombre: "", precioUnitario: 100 });

    expect(insert).not.toHaveBeenCalled();
    expect(result.errors.nombre).toBeTruthy();
  });

  it("inserta el producto con categoria_id null si no se eligió categoría", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "p1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = { from: vi.fn().mockReturnValue({ insert }) };
    const service = createProductosService(client);

    await service.crearProducto({ localId, nombre: "Café", precioUnitario: 2500 });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Café", precio_unitario: 2500, categoria_id: null })
    );
  });
});

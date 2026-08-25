import { describe, it, expect, vi } from "vitest";
import { handleConfirmarFactura } from "../../supabase/functions/confirmar-factura/logic";

const facturaBorrador = { id: "f1", localId: "L1", estado: "borrador" as const };

describe("handleConfirmarFactura", () => {
  it("404 si la factura no existe", async () => {
    const result = await handleConfirmarFactura("f1", "u1", "L1", {
      obtenerFactura: vi.fn().mockResolvedValue(null),
      emitirAnteArca: vi.fn(),
      marcarEmitida: vi.fn(),
      marcarRechazada: vi.fn(),
    });
    expect(result.status).toBe(404);
  });

  it("403 si la factura no pertenece al local del usuario", async () => {
    const result = await handleConfirmarFactura("f1", "u1", "OTRO-LOCAL", {
      obtenerFactura: vi.fn().mockResolvedValue(facturaBorrador),
      emitirAnteArca: vi.fn(),
      marcarEmitida: vi.fn(),
      marcarRechazada: vi.fn(),
    });
    expect(result.status).toBe(403);
  });

  it("409 si la factura ya está emitida (inmutable, no se reconfirma)", async () => {
    const emitirAnteArca = vi.fn();
    const result = await handleConfirmarFactura("f1", "u1", "L1", {
      obtenerFactura: vi.fn().mockResolvedValue({ ...facturaBorrador, estado: "emitida" }),
      emitirAnteArca,
      marcarEmitida: vi.fn(),
      marcarRechazada: vi.fn(),
    });
    expect(result.status).toBe(409);
    expect(emitirAnteArca).not.toHaveBeenCalled();
  });

  it("si ARCA acepta, marca la factura emitida con su CAE (FR-013)", async () => {
    const marcarEmitida = vi.fn().mockResolvedValue(undefined);
    const marcarRechazada = vi.fn();
    const result = await handleConfirmarFactura("f1", "u1", "L1", {
      obtenerFactura: vi.fn().mockResolvedValue(facturaBorrador),
      emitirAnteArca: vi.fn().mockResolvedValue({ aceptado: true, cae: "CAE-123" }),
      marcarEmitida,
      marcarRechazada,
    });

    expect(marcarEmitida).toHaveBeenCalledWith("f1", "CAE-123", "u1");
    expect(marcarRechazada).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "emitida", cae: "CAE-123" });
  });

  it("si ARCA rechaza, marca la factura rechazada y ninguna venta queda facturada (FR-014)", async () => {
    const marcarEmitida = vi.fn();
    const marcarRechazada = vi.fn().mockResolvedValue(undefined);
    const result = await handleConfirmarFactura("f1", "u1", "L1", {
      obtenerFactura: vi.fn().mockResolvedValue(facturaBorrador),
      emitirAnteArca: vi.fn().mockResolvedValue({ aceptado: false, motivo: "CUIT inválido" }),
      marcarEmitida,
      marcarRechazada,
    });

    expect(marcarEmitida).not.toHaveBeenCalled();
    expect(marcarRechazada).toHaveBeenCalledWith("f1", "CUIT inválido");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ estado: "rechazada" });
  });

  it("permite reintentar sobre una factura rechazada previamente", async () => {
    const marcarEmitida = vi.fn().mockResolvedValue(undefined);
    const result = await handleConfirmarFactura("f1", "u1", "L1", {
      obtenerFactura: vi.fn().mockResolvedValue({ ...facturaBorrador, estado: "rechazada" }),
      emitirAnteArca: vi.fn().mockResolvedValue({ aceptado: true, cae: "CAE-999" }),
      marcarEmitida,
      marcarRechazada: vi.fn(),
    });

    expect(marcarEmitida).toHaveBeenCalledWith("f1", "CAE-999", "u1");
    expect(result.status).toBe(200);
  });
});

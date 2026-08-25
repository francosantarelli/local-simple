// Lógica pura de confirmar-factura (contracts/confirmar-factura.md).
// FR-012, FR-013, FR-014: confirma un borrador, lo emite ante ARCA, y
// resuelve el estado resultante. Una factura ya emitida es inmutable
// (Principio V) y no se puede reconfirmar.

export type EstadoFactura = "borrador" | "emitida" | "rechazada";

export interface Factura {
  id: string;
  localId: string;
  estado: EstadoFactura;
}

export type ArcaResultado =
  | { aceptado: true; cae: string }
  | { aceptado: false; motivo: string };

export interface ConfirmarFacturaDeps {
  obtenerFactura: (facturaId: string) => Promise<Factura | null>;
  emitirAnteArca: (factura: Factura) => Promise<ArcaResultado>;
  marcarEmitida: (facturaId: string, cae: string, confirmadoPor: string) => Promise<void>;
  marcarRechazada: (facturaId: string, motivo: string) => Promise<void>;
}

export interface ConfirmarFacturaResult {
  status: number;
  body: Record<string, unknown>;
}

export async function handleConfirmarFactura(
  facturaId: string,
  usuarioId: string,
  localIdDelUsuario: string,
  deps: ConfirmarFacturaDeps
): Promise<ConfirmarFacturaResult> {
  const factura = await deps.obtenerFactura(facturaId);
  if (!factura) {
    return { status: 404, body: { message: "Factura no encontrada." } };
  }
  if (factura.localId !== localIdDelUsuario) {
    return { status: 403, body: { message: "La factura no pertenece a tu local." } };
  }
  // Una factura emitida es terminal e inmutable (Principio V): no se
  // vuelve a confirmar, ni siquiera si ARCA la re-aceptara.
  if (factura.estado === "emitida") {
    return { status: 409, body: { message: "La factura ya fue emitida y es inmutable." } };
  }

  const resultado = await deps.emitirAnteArca(factura);

  if (resultado.aceptado) {
    await deps.marcarEmitida(facturaId, resultado.cae, usuarioId);
    return { status: 200, body: { estado: "emitida", cae: resultado.cae } };
  }

  await deps.marcarRechazada(facturaId, resultado.motivo);
  return { status: 200, body: { estado: "rechazada", motivo: resultado.motivo } };
}

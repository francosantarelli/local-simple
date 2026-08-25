// Listado/detalle de facturas (US5) y disparo de confirmar-factura (US4).
// Lecturas van directo por Supabase/RLS; confirmar-factura es la única
// escritura, y pasa por la Edge Function (nunca se escribe `facturas`
// directo desde el cliente — ver contracts/README.md).

export function createFacturasService(client, { functionsUrl, anonKey }) {
  return {
    async listarFacturas(localId) {
      const { data, error } = await client
        .from("facturas")
        .select("id, periodo_desde, periodo_hasta, modo_pago, monto_total, estado, cae, motivo_rechazo, origen")
        .eq("local_id", localId)
        .order("periodo_desde", { ascending: false });
      return { data: data ?? [], error };
    },

    async detalleFactura(facturaId) {
      const { data, error } = await client
        .from("ventas")
        .select("id, fecha, descripcion, cantidad, precio_unitario, precio_total")
        .eq("factura_id", facturaId)
        .order("fecha");
      return { data: data ?? [], error };
    },

    async confirmarFactura(facturaId) {
      const {
        data: { session },
      } = await client.auth.getSession();

      const response = await fetch(`${functionsUrl}/confirmar-factura`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ factura_id: facturaId }),
      });
      return response.json();
    },
  };
}

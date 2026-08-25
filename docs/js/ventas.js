// Lógica de carga de ventas (US2, FR-004 a FR-008). `createVentasService`
// recibe el cliente Supabase por inyección de dependencias para poder
// testear sin red.

export function calcularPrecioTotal(cantidad, precioUnitario) {
  return Math.round(Number(cantidad) * Number(precioUnitario) * 100) / 100;
}

const MODOS_PAGO_VALIDOS = ["tarjeta", "efectivo"];

export function validarVenta(data) {
  const errors = {};

  if (!data.fecha) {
    errors.fecha = "La fecha es obligatoria.";
  }
  if (!(Number(data.cantidad) > 0)) {
    errors.cantidad = "La cantidad debe ser un número mayor a 0.";
  }
  if (!data.descripcion || !String(data.descripcion).trim()) {
    errors.descripcion = "La descripción es obligatoria.";
  }
  if (!(Number(data.precioUnitario) > 0)) {
    errors.precioUnitario = "El precio unitario debe ser un número mayor a 0.";
  }
  if (!(Number(data.precioTotal) > 0)) {
    errors.precioTotal = "El precio total debe ser un número mayor a 0.";
  }
  if (!MODOS_PAGO_VALIDOS.includes(data.modoPago)) {
    errors.modoPago = "Elegí un modo de pago válido (tarjeta o efectivo).";
  }

  return errors;
}

// Condición compuesta de "facturada" (data-model.md, nota de integridad):
// no alcanza con que factura_id no sea null, la factura asociada tiene
// que estar emitida (un borrador o una factura rechazada no cuentan).
export function estaFacturada(venta) {
  return Boolean(venta.factura_id) && venta.facturas?.estado === "emitida";
}

export function filtrarPorEstadoFacturacion(ventas, estado) {
  if (!estado) return ventas;
  if (estado === "facturada") return ventas.filter(estaFacturada);
  if (estado === "no-facturada") return ventas.filter((v) => !estaFacturada(v));
  return ventas;
}

// Agregados para las tarjetas de resumen del dashboard. `hoy` recibe la
// fecha de referencia como string 'YYYY-MM-DD' (inyectada para poder
// testear sin depender del reloj real).
export function computeStats(ventas, hoy) {
  const mesActual = hoy.slice(0, 7); // 'YYYY-MM'

  const stats = {
    hoy: { monto: 0, cantidad: 0 },
    mes: { monto: 0, cantidad: 0 },
    pendientes: 0,
  };

  for (const venta of ventas) {
    const monto = Number(venta.precio_total);

    if (venta.fecha === hoy) {
      stats.hoy.monto += monto;
      stats.hoy.cantidad += 1;
    }
    if (venta.fecha.slice(0, 7) === mesActual) {
      stats.mes.monto += monto;
      stats.mes.cantidad += 1;
    }
    if (!estaFacturada(venta)) {
      stats.pendientes += 1;
    }
  }

  stats.hoy.monto = Math.round(stats.hoy.monto * 100) / 100;
  stats.mes.monto = Math.round(stats.mes.monto * 100) / 100;

  return stats;
}

export function createVentasService(client, { functionsUrl, anonKey } = {}) {
  return {
    async listarVentas(localId, filtros = {}) {
      let query = client
        .from("ventas")
        .select("*, facturas(estado)")
        .eq("local_id", localId);

      if (filtros.desde) query = query.gte("fecha", filtros.desde);
      if (filtros.hasta) query = query.lte("fecha", filtros.hasta);
      if (filtros.modoPago) query = query.eq("modo_pago", filtros.modoPago);

      const { data, error } = await query.order("fecha", { ascending: false });
      if (error) return { data: [], error };

      return { data: filtrarPorEstadoFacturacion(data ?? [], filtros.estado), error: null };
    },

    async listarProductos(localId) {
      const { data, error } = await client
        .from("productos")
        .select("id, nombre, precio_unitario")
        .eq("local_id", localId)
        .order("nombre");
      return { data: data ?? [], error };
    },

    async crearVenta(input) {
      // FR-005: si no se ingresó precio total manualmente, se calcula
      // automáticamente; si se ingresó, se respeta tal cual (permite
      // ajustes como descuentos, ver Edge Cases de spec.md).
      const precioTotal =
        input.precioTotal !== "" && input.precioTotal != null
          ? Number(input.precioTotal)
          : calcularPrecioTotal(input.cantidad, input.precioUnitario);

      const errors = validarVenta({ ...input, precioTotal });
      if (Object.keys(errors).length > 0) {
        return { data: null, errors };
      }

      const { data, error } = await client
        .from("ventas")
        .insert({
          local_id: input.localId,
          usuario_id: input.usuarioId,
          producto_id: input.productoId || null,
          fecha: input.fecha,
          cantidad: Number(input.cantidad),
          descripcion: input.descripcion.trim(),
          precio_unitario: Number(input.precioUnitario),
          precio_total: precioTotal,
          modo_pago: input.modoPago,
        })
        .select()
        .single();

      if (error) {
        return { data: null, errors: { supabase: error.message } };
      }
      return { data, errors: {} };
    },

    // Genera un borrador de factura a demanda a partir de una selección
    // puntual de ventas no facturadas, sin esperar al cron semanal (ver
    // contracts/generar-borrador-factura.md, modo manual). La lógica de
    // agrupamiento/autorización vive y está testeada del lado del server;
    // esto es solo el llamado a la Edge Function.
    async generarBorradorManual(ventaIds) {
      const {
        data: { session },
      } = await client.auth.getSession();

      const response = await fetch(`${functionsUrl}/generar-borrador-factura`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ venta_ids: ventaIds }),
      });
      return response.json();
    },
  };
}

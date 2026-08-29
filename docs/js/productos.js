// ABM de productos del catálogo de un local. `createProductosService`
// recibe el cliente Supabase por inyección de dependencias para poder
// testear sin red (mismo patrón que ventas.js/facturas.js).

export function validarProducto(data) {
  const errors = {};

  if (!data.nombre || !String(data.nombre).trim()) {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!(Number(data.precioUnitario) > 0)) {
    errors.precioUnitario = "El precio unitario debe ser un número mayor a 0.";
  }
  // categoriaId es opcional (data-model.md: productos.categoria_id nullable).

  return errors;
}

export function createProductosService(client) {
  return {
    async listarProductos(localId) {
      const { data, error } = await client
        .from("productos")
        .select("id, nombre, precio_unitario, categoria_id, categorias(descripcion)")
        .eq("local_id", localId)
        .order("nombre");
      return { data: data ?? [], error };
    },

    async crearProducto(input) {
      const errors = validarProducto(input);
      if (Object.keys(errors).length > 0) {
        return { data: null, errors };
      }

      const { data, error } = await client
        .from("productos")
        .insert({
          local_id: input.localId,
          categoria_id: input.categoriaId || null,
          nombre: input.nombre.trim(),
          precio_unitario: Number(input.precioUnitario),
        })
        .select()
        .single();

      if (error) {
        return { data: null, errors: { supabase: error.message } };
      }
      return { data, errors: {} };
    },

    async actualizarProducto(productoId, input) {
      const errors = validarProducto(input);
      if (Object.keys(errors).length > 0) {
        return { data: null, errors };
      }

      const { data, error } = await client
        .from("productos")
        .update({
          categoria_id: input.categoriaId || null,
          nombre: input.nombre.trim(),
          precio_unitario: Number(input.precioUnitario),
        })
        .eq("id", productoId)
        .select()
        .single();

      if (error) {
        return { data: null, errors: { supabase: error.message } };
      }
      return { data, errors: {} };
    },

    async eliminarProducto(productoId) {
      const { error } = await client.from("productos").delete().eq("id", productoId);
      if (error) {
        // FK sin cascade (ventas.producto_id): borrar un producto ya usado
        // en alguna venta falla en la base en vez de romper esa venta.
        return { errors: { supabase: "No se puede eliminar: hay ventas que usan este producto." } };
      }
      return { errors: {} };
    },
  };
}

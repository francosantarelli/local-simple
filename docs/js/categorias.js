// ABM de categorías del catálogo de un local.

export function createCategoriasService(client) {
  return {
    async listarCategorias(localId) {
      const { data, error } = await client
        .from("categorias")
        .select("id, descripcion")
        .eq("local_id", localId)
        .order("descripcion");
      return { data: data ?? [], error };
    },

    async crearCategoria(localId, descripcion) {
      if (!descripcion || !descripcion.trim()) {
        return { data: null, errors: { descripcion: "La descripción es obligatoria." } };
      }
      const { data, error } = await client
        .from("categorias")
        .insert({ local_id: localId, descripcion: descripcion.trim() })
        .select()
        .single();
      if (error) {
        return { data: null, errors: { supabase: error.message } };
      }
      return { data, errors: {} };
    },

    async eliminarCategoria(categoriaId) {
      const { error } = await client.from("categorias").delete().eq("id", categoriaId);
      if (error) {
        return { errors: { supabase: "No se puede eliminar: hay productos que usan esta categoría." } };
      }
      return { errors: {} };
    },
  };
}

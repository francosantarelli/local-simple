// Fechas se guardan y viajan como ISO (AAAA-MM-DD); se muestran en la UI
// en formato DD-MM-AAAA (uso habitual en Argentina).
export function formatFecha(iso) {
  if (!iso) return "";
  const [anio, mes, dia] = iso.split("-");
  return `${dia}-${mes}-${anio}`;
}

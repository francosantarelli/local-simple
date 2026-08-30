// Set mínimo de íconos SVG en línea (stroke, 24x24, currentColor) para no
// depender de una librería/font de íconos externa (sin build/framework).
// Cada función devuelve el markup como string para insertarlo con
// innerHTML/template strings en las páginas.

function svg(paths, viewBox = "0 0 24 24") {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const icons = {
  store: svg(
    '<path d="M4 9V4h16v5" /><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />'
  ),
  cart: svg(
    '<circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6" />'
  ),
  document: svg(
    '<path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 12h5M9.5 15.5h5" />'
  ),
  logout: svg(
    '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h12" />'
  ),
  calendar: svg(
    '<rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" />'
  ),
  trendingUp: svg('<path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />'),
  clock: svg('<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />'),
  tag: svg(
    '<path d="M20 12.5 12.5 20a1.5 1.5 0 0 1-2 0L4 13.5V4h9.5L20 10.5a1.5 1.5 0 0 1 0 2z" /><circle cx="8.5" cy="8.5" r="1.3" />'
  ),
  card: svg(
    '<rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18" />'
  ),
  cash: svg(
    '<rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.5" />'
  ),
  filter: svg('<path d="M4 5h16l-6 8v6l-4-2v-4z" />'),
  search: svg('<circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />'),
  plus: svg('<path d="M12 5v14M5 12h14" />'),
  minus: svg('<path d="M5 12h14" />'),
  check: svg('<circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5 5.5-6" />'),
  chevronDown: svg('<path d="M6 9l6 6 6-6" />'),
  box: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />'),
  edit: svg('<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />'),
  trash: svg(
    '<path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /><path d="M10 11v6M14 11v6" />'
  ),
  dot: '<svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="4" /></svg>',
  list: svg('<path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" />'),
};

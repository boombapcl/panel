// Clientes compartidos entre Tareas y Bandeja: nombre canónico, logo y avatar.
// Un mismo cliente puede venir escrito distinto («Mamba Sport» y «Mamba Sport Chile»,
// «Krat» y «KRAT Inmobiliaria»): se une al cliente de Noise cuyo nombre empieza igual.

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const normal = n => String(n || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let lista = [];
const cache = new Map();

/** clientes = [{ nombre, logo }] */
export function usarClientes(clientes) {
  lista = (clientes || []).map(c => ({ ...c, k: normal(c.nombre) }));
  cache.clear();
}
export const clientes = () => lista;

export function claveCliente(n) {
  const x = normal(n); if (!x) return '';
  if (cache.has(x)) return cache.get(x);
  const nombres = lista.map(c => c.k);
  const igual = nombres.find(c => c === x)
    || nombres.find(c => c.startsWith(x + ' ') || x.startsWith(c + ' '))
    || (() => { const p = x.split(' ')[0]; const m = nombres.filter(c => c.split(' ')[0] === p); return m.length === 1 ? m[0] : ''; })();
  const k = igual || x;
  cache.set(x, k);
  return k;
}

export function logoDe(nombre) {
  const k = claveCliente(nombre);
  const c = lista.find(c => c.k === k);
  return c?.logo && /^https:\/\//.test(c.logo) ? c.logo : '';
}

export function avatar(nombre, tam = 'sm') {
  const url = logoDe(nombre);
  const ini = esc(String(nombre || '?').trim().charAt(0).toUpperCase());
  return url ? `<img class="av ${tam}" src="${esc(url)}" alt="" loading="lazy">` : `<span class="av ${tam} ini" aria-hidden="true">${ini}</span>`;
}

/** Fila de chips de cliente. items: [{ nombre, n }] ya ordenados. */
export function chipsClientes(items, activo, total) {
  return `<button type="button" class="cl${activo ? '' : ' on'}" data-cli="" aria-pressed="${!activo}"><span class="av sm ini todos" aria-hidden="true">✦</span><span>Todos</span>${total ? `<b>${total}</b>` : ''}</button>` +
    items.map(c => {
      const k = claveCliente(c.nombre);
      return `<button type="button" class="cl${activo === k ? ' on' : ''}" data-cli="${esc(k)}" aria-pressed="${activo === k}" title="${esc(c.nombre)}">${avatar(c.nombre)}<span>${esc(c.nombre)}</span>${c.n ? `<b>${c.n}</b>` : ''}</button>`;
    }).join('');
}

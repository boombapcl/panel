// Barra de navegación común a todo el panel: Tareas (inicio), Bandeja y Células,
// con contadores de tareas de hoy/atrasadas y decisiones pendientes.
import { sb } from './acceso.js';

const ICONOS = {
  tareas: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="m8.5 12.2 2.4 2.4 4.8-5"/></svg>',
  bandeja: '<svg viewBox="0 0 24 24"><path d="M4 13.5 6.2 6a1.5 1.5 0 0 1 1.4-1h8.8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/></svg>',
  celulas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="16" r="1.6"/><circle cx="5" cy="16" r="1.6"/><path d="M12 5.6V9M17.6 15.2l-3-1.7M6.4 15.2l3-1.7"/></svg>',
};
export const SECCIONES = [
  { id: 'tareas', href: '/', nombre: 'Tareas' },
  { id: 'bandeja', href: '/bandeja', nombre: 'Bandeja' },
  { id: 'celulas', href: '/celulas', nombre: 'Células y clientes' },
];

export function pintarRiel(activo) {
  const nav = document.querySelector('nav.riel');
  if (!nav) return;
  nav.innerHTML = `<div class="riel-in">
      <span class="logo"><img src="/logo-marca.png" alt="Boombap"></span>
      ${SECCIONES.map(s => `<a href="${s.href}" class="${s.id === activo ? 'on' : ''}" title="${s.nombre}" aria-label="${s.nombre}"${s.id === activo ? ' aria-current="page"' : ''}>${ICONOS[s.id]}<i class="cnt" data-cnt="${s.id}" hidden></i></a>`).join('')}
    </div>
    <span class="riel-tag">BOOMBAP · AGENTES 2026</span>`;
  actualizarContadores();
  setInterval(() => { if (!document.hidden) actualizarContadores(); }, 30000);
}

export async function actualizarContadores() {
  const { data, error } = await sb.rpc('panel_contadores');
  if (error || !data) return;
  const pon = (id, n, alerta) => {
    const el = document.querySelector(`[data-cnt="${id}"]`);
    if (!el) return;
    el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n || '');
    el.classList.toggle('alerta', !!alerta);
  };
  pon('tareas', (data.tareas_hoy || 0) + (data.tareas_atrasadas || 0), data.tareas_atrasadas > 0);
  pon('bandeja', data.bandeja || 0, true);
  return data;
}

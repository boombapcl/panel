// Menú lateral común del Panel: secciones con título, contador y submenú.
// Escritorio: se expande (con textos) o se contrae a íconos; contraído, cada sección
// muestra su submenú al pasar el cursor. Móvil: barra superior y menú deslizable.
import './menu.css';
import { sb, salir } from './acceso.js';
import { cargarTimer, alCambiarTimer, detenerTimer, timerActual } from './timer.js';
import { montarReloj } from './reloj.js';

const I = {
  tareas: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="m8.5 12.2 2.4 2.4 4.8-5"/>',
  bandeja: '<path d="M4 13.5 6.2 6a1.5 1.5 0 0 1 1.4-1h8.8a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20"/>',
  clientes: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17M11 12.5v1.5h2v-1.5"/>',
  celulas: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="1.6"/><circle cx="19" cy="16" r="1.6"/><circle cx="5" cy="16" r="1.6"/><path d="M12 5.6V9M17.6 15.2l-3-1.7M6.4 15.2l3-1.7"/>',
  noise: '<path d="M4 15c2.5 0 2.5-6 5-6s2.5 6 5 6 2.5-6 5-6"/><path d="M4 19h16"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  plegar: '<path d="M15 6 9 12l6 6"/><path d="M5 5v14"/>',
  hamb: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  salir: '<path d="M14 7V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V17"/><path d="M10 12h10M17 9l3 3-3 3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
};
const svg = (k, c = '') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const SECCIONES = [
  { id: 'tareas', href: '/', nombre: 'Tareas', desc: 'Lo que hay que hacer', cnt: 'tareas', sub: [
    { href: '/', nombre: 'Por hacer' },
    { href: '/?vista=hoy', nombre: 'Hoy', cnt: 'tareas_hoy' },
    { href: '/?vista=atrasadas', nombre: 'Atrasadas', cnt: 'tareas_atrasadas', alerta: true },
    { href: '/?vista=semana', nombre: 'Esta semana' },
    { href: '/?origen=agente', nombre: 'Creadas por agentes' },
    { href: '/?tab=hechas', nombre: 'Hechas' },
  ] },
  { id: 'bandeja', href: '/bandeja', nombre: 'Bandeja', desc: 'Decisiones por aprobar', cnt: 'bandeja', sub: [
    { href: '/bandeja', nombre: 'Pendientes', cnt: 'bandeja', alerta: true },
    { href: '/bandeja?tab=curso', nombre: 'En curso' },
    { href: '/bandeja?tab=errores', nombre: 'Errores', cnt: 'bandeja_errores', alerta: true },
    { href: '/bandeja?tab=historial', nombre: 'Historial' },
  ] },
  { id: 'clientes', href: '/clientes', nombre: 'Clientes', desc: 'Ficha y pendientes', sub: [
    { href: '/clientes', nombre: 'Activos' },
    { href: '/clientes?ver=pendientes', nombre: 'Con pendientes' },
    { href: '/clientes?ver=pauta', nombre: 'Con pauta en Meta' },
    { href: '/clientes?ver=inactivos', nombre: 'Inactivos' },
  ] },
  { id: 'celulas', href: '/celulas', nombre: 'Células', desc: 'Ciclo, agentes y memoria', sub: [
    { href: '/celulas#resumen', nombre: 'Resumen' },
    { href: '/celulas#clientes', nombre: 'Clientes y etapa' },
    { href: '/celulas#calendario', nombre: 'Calendario' },
    { href: '/celulas#ciclo', nombre: 'Ciclo mensual' },
    { href: '/celulas#celulas', nombre: 'Esquema de células' },
    { href: '/celulas#automatizaciones', nombre: 'Automatizaciones' },
    { href: '/celulas#fichas', nombre: 'ADN y registros' },
    { href: '/celulas#memoria', nombre: 'Memoria' },
  ] },
];
const EXTERNOS = [
  { href: 'https://noise.boombap.cl/admin', nombre: 'Noise', icono: 'noise' },
];

const CLAVE_CORTO = 'panel-menu-corto', CLAVE_ABIERTOS = 'panel-menu-abiertos';
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

let activo = '', navegarAqui = null, usuario = null;

/** Vuelve a marcar la opción activa (por ejemplo, tras cambiar de pestaña dentro de la página). */
export function refrescarMenu() { pintar(); }

/** Cuando un enlace del menú apunta a esta misma página, la página puede manejarlo sin recargar. */
export function alNavegar(fn) { navegarAqui = fn; }

function subActivo(s) {
  const q = new URLSearchParams(location.search);
  for (const k of ['c', 'tarea', 'cliente']) q.delete(k);
  const busq = q.toString() ? '?' + q : '';
  const aqui = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') + busq + (s.id === 'celulas' ? location.hash : '');
  const exacto = s.sub.find(x => x.href === aqui);
  if (exacto) return exacto.href;
  if (s.id === 'celulas' && location.pathname.startsWith('/celulas')) return s.sub[0].href;
  return busq ? '' : s.sub[0].href;
}

function pintar() {
  const nav = document.getElementById('menu'); if (!nav) return;
  const abiertos = new Set(leer(CLAVE_ABIERTOS, [activo]));
  abiertos.add(activo);
  const ini = (usuario?.user_metadata?.full_name || usuario?.email || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const nombre = usuario?.user_metadata?.full_name || (usuario?.email || '').split('@')[0];
  nav.innerHTML = `
    <div class="m-top">
      <a class="m-logo" href="/" aria-label="Panel Boombap, inicio"><img src="/logo-marca.png" alt=""><span class="m-txt"><b>Boombap</b><small>Panel de agencia</small></span></a>
      <button class="m-plegar" type="button" data-m="plegar" aria-label="Contraer menú" title="Contraer menú">${svg('plegar')}</button>
      <button class="m-cerrar" type="button" data-m="cerrar" aria-label="Cerrar menú">${svg('cerrar')}</button>
    </div>
    <div class="m-timer" id="m-timer" hidden></div>
    <p class="m-grp">Trabajo</p>
    <ul class="m-secs">
      ${SECCIONES.map(s => {
        const on = s.id === activo, ab = abiertos.has(s.id), sa = on ? subActivo(s) : '';
        return `<li class="m-sec${on ? ' on' : ''}${ab ? ' abierta' : ''}" data-sec="${s.id}">
          <div class="m-fila">
            <a class="m-link" href="${s.href}"${on ? ' aria-current="page"' : ''}>${svg(s.id, 'm-ic')}<span class="m-txt"><b>${s.nombre}</b><small>${s.desc}</small></span>${s.cnt ? `<i class="m-cnt" data-cnt="${s.cnt}" hidden></i>` : ''}</a>
            <button class="m-exp" type="button" data-m="exp" aria-expanded="${ab}" aria-controls="m-sub-${s.id}" aria-label="${ab ? 'Ocultar' : 'Mostrar'} opciones de ${s.nombre}">${svg('chev')}</button>
          </div>
          <ul class="m-sub" id="m-sub-${s.id}">
            <li class="m-sub-tit">${s.nombre}</li>
            ${s.sub.map(x => `<li><a href="${x.href}" class="${x.href === sa ? 'on' : ''}"${x.href === sa ? ' aria-current="true"' : ''}><span>${x.nombre}</span>${x.cnt ? `<i class="m-sc${x.alerta ? ' alerta' : ''}" data-sc="${x.cnt}" hidden></i>` : ''}</a></li>`).join('')}
          </ul>
        </li>`;
      }).join('')}
    </ul>
    <p class="m-grp">Herramientas</p>
    <ul class="m-secs m-ext">
      ${EXTERNOS.map(e => `<li class="m-sec"><div class="m-fila"><a class="m-link" href="${e.href}" target="_blank" rel="noopener noreferrer">${svg(e.icono, 'm-ic')}<span class="m-txt"><b>${e.nombre} <span aria-hidden="true">↗</span></b><small>Abre en otra pestaña</small></span></a></div></li>`).join('')}
    </ul>
    <div class="m-pie">
      <span class="m-yo" title="${esc(nombre)}"><span class="m-av">${esc(ini)}</span><span class="m-txt"><b>${esc(nombre)}</b><small>${esc(usuario?.email || '')}</small></span></span>
      <button class="m-salir" type="button" data-m="salir" aria-label="Salir" title="Salir">${svg('salir')}</button>
    </div>`;
  pintarTimer(timerActual());
  if (ultimos) ponerContadores(ultimos);
}

function barraMovil() {
  if (document.getElementById('m-barra')) return;
  const b = document.createElement('header');
  b.id = 'm-barra'; b.className = 'm-barra';
  b.innerHTML = `<button type="button" data-m="abrir" aria-label="Abrir menú" aria-controls="menu" aria-expanded="false">${svg('hamb')}</button>
    <a class="m-logo" href="/"><img src="/logo-marca.png" alt=""><b>Boombap</b></a>
    <span class="m-barra-cnt"><a href="/" aria-label="Tareas">${svg('tareas')}<i class="m-cnt" data-cnt="tareas" hidden></i></a><a href="/bandeja" aria-label="Bandeja">${svg('bandeja')}<i class="m-cnt" data-cnt="bandeja" hidden></i></a></span>`;
  document.body.prepend(b);
  const fondo = document.createElement('div');
  fondo.className = 'm-fondo'; fondo.dataset.m = 'cerrar';
  document.body.appendChild(fondo);
}

function pintarTimer(t) {
  const el = document.getElementById('m-timer'); if (!el) return;
  t = null; // la tarea activa se muestra en el reloj flotante
  el.hidden = !t;
  document.documentElement.classList.toggle('timer-on', !!t);
  if (!t) { el.innerHTML = ''; return; }
  el.innerHTML = `<a class="m-timer-info" href="/?tarea=${esc(t.task_id)}" title="${esc(t.titulo)}"><span class="m-punto" aria-hidden="true"></span><span class="m-txt"><small>Timer en curso</small><b>${esc(t.titulo)}</b></span><span class="m-reloj num" data-timer-reloj>0:00</span></a>
    <button type="button" data-m="detener" aria-label="Detener timer de ${esc(t.titulo)}" title="Detener">${svg('stop')}</button>`;
}

let ultimos = null;
function ponerContadores(d) {
  ultimos = d;
  const v = { tareas: (d.tareas_hoy || 0) + (d.tareas_atrasadas || 0), tareas_hoy: d.tareas_hoy, tareas_atrasadas: d.tareas_atrasadas, bandeja: d.bandeja, bandeja_errores: d.bandeja_errores };
  document.querySelectorAll('[data-cnt]').forEach(el => {
    const n = v[el.dataset.cnt] || 0;
    el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n);
    el.classList.toggle('alerta', el.dataset.cnt === 'bandeja' || (el.dataset.cnt === 'tareas' && d.tareas_atrasadas > 0));
  });
  document.querySelectorAll('[data-sc]').forEach(el => { const n = v[el.dataset.sc] || 0; el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); });
}

export async function actualizarContadores() {
  const { data, error } = await sb.rpc('panel_contadores');
  if (error || !data) return null;
  ponerContadores(data);
  return data;
}

function corto(v) {
  document.documentElement.classList.toggle('menu-corto', v);
  escribir(CLAVE_CORTO, v);
  const b = document.querySelector('[data-m=plegar]');
  if (b) { b.setAttribute('aria-label', v ? 'Expandir menú' : 'Contraer menú'); b.title = b.getAttribute('aria-label'); }
}
function movil(abrir) {
  document.documentElement.classList.toggle('menu-abierto', abrir);
  document.querySelector('[data-m=abrir]')?.setAttribute('aria-expanded', String(abrir));
  if (abrir) document.querySelector('#menu .m-link')?.focus();
}

function eventos() {
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-m]');
    if (b) {
      const m = b.dataset.m;
      if (m === 'plegar') return corto(!document.documentElement.classList.contains('menu-corto'));
      if (m === 'abrir') return movil(true);
      if (m === 'cerrar') return movil(false);
      if (m === 'salir') return salir();
      if (m === 'exp') {
        const li = b.closest('.m-sec'); const ab = !li.classList.contains('abierta');
        li.classList.toggle('abierta', ab); b.setAttribute('aria-expanded', String(ab));
        const set = new Set(leer(CLAVE_ABIERTOS, [activo])); ab ? set.add(li.dataset.sec) : set.delete(li.dataset.sec);
        return escribir(CLAVE_ABIERTOS, [...set]);
      }
      if (m === 'detener') { b.disabled = true; try { await detenerTimer(); } catch (e) { b.disabled = false; alert('No se pudo detener el timer: ' + (e.message || '')); } return; }
    }
    // Enlaces a la misma página: la página decide (sin recargar).
    const a = ev.target.closest('#menu a[href], #m-barra a[href]');
    if (!a || a.target === '_blank' || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const u = new URL(a.href, location.href);
    const misma = u.pathname.replace(/\.html$/, '') === location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    if (misma && navegarAqui) {
      ev.preventDefault();
      history.pushState(null, '', u.pathname + u.search + u.hash);
      movil(false);
      navegarAqui(u);
      pintar();
    } else if (misma && u.hash) movil(false);
  });
  window.addEventListener('popstate', () => { if (navegarAqui) { navegarAqui(new URL(location.href)); pintar(); } });
  window.addEventListener('hashchange', () => { if (activo === 'celulas') pintar(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && document.documentElement.classList.contains('menu-abierto')) movil(false); });
}

/** Pinta el menú de la sección `id` y arranca contadores y timer. */
export async function iniciarMenu(id, user) {
  activo = id; usuario = user;
  document.body.classList.add('con-menu');
  let nav = document.getElementById('menu');
  if (!nav) { nav = document.createElement('nav'); nav.id = 'menu'; nav.className = 'menu'; nav.setAttribute('aria-label', 'Panel'); document.body.prepend(nav); }
  const guardado = leer(CLAVE_CORTO, null);
  corto(guardado === null ? window.innerWidth < 1280 : guardado);
  barraMovil();
  pintar();
  eventos();
  alCambiarTimer(pintarTimer);
  montarReloj();
  actualizarContadores();
  cargarTimer();
  setInterval(() => { if (!document.hidden) actualizarContadores(); }, 30000);
}

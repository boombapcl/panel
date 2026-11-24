// Reloj flotante del timer (esquina inferior derecha, en todas las páginas):
// tarea activa, tiempo grande y botones para pausar, reanudar, terminar o completar.
import { sb } from './acceso.js';
import { timerActual, timerPausado, alCambiarTimer, pausarTimer, reanudarTimer, detenerTimer, descartarPausa, completarTareaTimer, formatoDuracion, segundosCorriendo } from './timer.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IC = {
  pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1.2"/><rect x="13.5" y="5.5" width="4" height="13" rx="1.2"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  min: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M6 12h12"/></svg>',
  max: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M6 15l6-6 6 6"/></svg>',
};
const CLAVE_MIN = 'panel-reloj-min';
let min = (() => { try { return localStorage.getItem(CLAVE_MIN) === '1'; } catch { return false; } })();
const clientes = new Map(); // task_id -> nombre de cliente
let el, ocupado = false;

async function clienteDe(taskId) {
  if (clientes.has(taskId)) return clientes.get(taskId);
  clientes.set(taskId, '');
  const { data } = await sb.from('tasks').select('client_id').eq('id', taskId).maybeSingle();
  if (data?.client_id) {
    const { data: c } = await sb.from('companies').select('name').eq('id', data.client_id).maybeSingle();
    clientes.set(taskId, c?.name || '');
    pintar();
  }
  return clientes.get(taskId);
}

function pintar() {
  if (!el) return;
  const corre = timerActual(), pausa = timerPausado();
  const t = corre || pausa;
  el.hidden = !t;
  document.documentElement.classList.toggle('con-reloj', !!t);
  if (!t) { el.innerHTML = ''; return; }
  const cli = clientes.get(t.task_id) ?? (clienteDe(t.task_id), '');
  const seg = corre ? Number(corre.acumulado_seg || 0) + segundosCorriendo() : Number(pausa.acumulado_seg || 0);
  el.className = `reloj${corre ? ' corre' : ' pausa'}${min ? ' min' : ''}`;
  if (min) {
    el.innerHTML = `<button type="button" class="r-pill" data-r="max" aria-label="Mostrar timer de ${esc(t.titulo)}"><span class="r-punto" aria-hidden="true"></span><b class="num" data-timer-reloj>${formatoDuracion(seg, true)}</b><span class="r-pill-t">${esc(t.titulo)}</span>${IC.max}</button>`;
    return;
  }
  el.innerHTML = `
    <div class="r-cab"><span class="r-estado"><span class="r-punto" aria-hidden="true"></span>${corre ? 'En curso' : 'En pausa'}</span>
      <button type="button" class="r-ic" data-r="min" aria-label="Minimizar timer" title="Minimizar">${IC.min}</button></div>
    <a class="r-tit" href="/?tarea=${esc(t.task_id)}">${esc(t.titulo)}</a>
    ${cli ? `<p class="r-cli">${esc(cli)}</p>` : ''}
    <b class="r-tiempo num" data-timer-reloj aria-live="off">${formatoDuracion(seg, true)}</b>
    <div class="r-acc">
      ${corre ? `<button type="button" class="r-b r-prim" data-r="pausar">${IC.pausa}Pausar</button>` : `<button type="button" class="r-b r-prim" data-r="reanudar">${IC.play}Reanudar</button>`}
      <button type="button" class="r-b" data-r="terminar" title="Guardar el tiempo y cerrar el timer">${IC.stop}Terminar</button>
      <button type="button" class="r-b ok" data-r="completar" title="Marcar la tarea como hecha">${IC.check}Completar</button>
    </div>`;
}

async function accion(r, b) {
  if (r === 'min' || r === 'max') { min = r === 'min'; try { localStorage.setItem(CLAVE_MIN, min ? '1' : '0'); } catch { /* */ } return pintar(); }
  if (ocupado) return;
  ocupado = true; b.disabled = true;
  try {
    if (r === 'pausar') await pausarTimer();
    else if (r === 'reanudar') await reanudarTimer();
    else if (r === 'terminar') { if (timerActual()) await detenerTimer(); else descartarPausa(); }
    else if (r === 'completar') { await completarTareaTimer(); window.dispatchEvent(new CustomEvent('tarea:completada')); }
  } catch (e) {
    alert('No se pudo completar la acción del timer: ' + (e.message || ''));
  } finally { ocupado = false; b.disabled = false; }
}

export function montarReloj() {
  if (el) return;
  el = document.createElement('section');
  el.id = 'reloj'; el.className = 'reloj'; el.hidden = true;
  el.setAttribute('aria-label', 'Timer de la tarea activa');
  document.body.appendChild(el);
  el.addEventListener('click', ev => { const b = ev.target.closest('[data-r]'); if (b) accion(b.dataset.r, b); });
  alCambiarTimer(pintar);
  pintar();
}

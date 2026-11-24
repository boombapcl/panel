// Timer de tareas compartido por todo el panel. El estado vive en Supabase
// (task_time_logs): un timer abierto por usuario, visible desde cualquier dispositivo.
import { sb } from './acceso.js';

let actual = null;          // { task_id, inicio, titulo, acumulado_seg }
// Timer en pausa: vive en este navegador (el tiempo ya quedó guardado al pausar).
const CLAVE_PAUSA = 'panel-timer-pausa';
let pausado = (() => { try { return JSON.parse(localStorage.getItem(CLAVE_PAUSA)) || null; } catch { return null; } })();
const guardarPausa = v => { pausado = v; try { v ? localStorage.setItem(CLAVE_PAUSA, JSON.stringify(v)) : localStorage.removeItem(CLAVE_PAUSA); } catch { /* sin almacenamiento */ } };
export const timerPausado = () => (actual ? null : pausado);
const oyentes = new Set();
let reloj = null;

export const timerActual = () => actual;
export function alCambiarTimer(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
function avisar() { for (const fn of oyentes) { try { fn(actual); } catch (e) { console.error(e); } } pintarVivos(); }

/** Segundos que lleva corriendo el timer actual (desde que se inició esta vez). */
export const segundosCorriendo = () => actual ? Math.max(0, Math.floor((Date.now() - new Date(actual.inicio).getTime()) / 1000)) : 0;

export function formatoDuracion(seg, conSegundos) {
  seg = Math.max(0, Math.floor(seg || 0));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  if (conSegundos) return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  if (!h && !m) return seg ? '<1 min' : '0 min';
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** Elementos con data-timer-vivo="<task_id>" muestran el tiempo total en vivo (acumulado + corriendo). */
function pintarVivos() {
  const corr = segundosCorriendo();
  if (!actual && pausado) {
    document.querySelectorAll('[data-timer-reloj]').forEach(el => { el.textContent = formatoDuracion(pausado.acumulado_seg || 0, true); });
  }
  document.querySelectorAll('[data-timer-vivo]').forEach(el => {
    const base = Number(el.dataset.base || 0) * 60; // minutos guardados en tasks.time_spent
    const id = el.dataset.timerVivo;
    const vivo = actual && actual.task_id === id;
    el.textContent = vivo ? formatoDuracion(Number(actual.acumulado_seg ?? base) + corr, true) : formatoDuracion(base);
  });
  if (actual) document.querySelectorAll('[data-timer-reloj]').forEach(el => {
    el.textContent = formatoDuracion(Number(actual.acumulado_seg || 0) + corr, true);
  });
}

export async function cargarTimer() {
  const { data, error } = await sb.rpc('timer_actual');
  if (error) return actual;
  const antes = actual?.task_id || null;
  actual = data || null;
  if (actual && pausado) guardarPausa(null);
  if (antes !== (actual?.task_id || null) || !reloj) avisar(); else pintarVivos();
  arrancarReloj();
  return actual;
}

function arrancarReloj() {
  clearInterval(reloj);
  reloj = actual ? setInterval(pintarVivos, 1000) : null;
}

export async function iniciarTimer(taskId) {
  const { data, error } = await sb.rpc('timer_iniciar', { p_task: taskId });
  if (error) throw error;
  guardarPausa(null);
  actual = data || null; arrancarReloj(); avisar();
  return actual;
}

/** Detiene y termina (sin dejarlo en pausa). */
export async function detenerTimer() {
  const { data, error } = await sb.rpc('timer_detener');
  if (error) throw error;
  guardarPausa(null);
  actual = null; arrancarReloj(); avisar();
  return data; // { task_id, tiempo_min }
}

/** Pausa: guarda el tiempo y deja la tarea lista para reanudar. */
export async function pausarTimer() {
  const antes = actual, seg = actual ? Number(actual.acumulado_seg || 0) + segundosCorriendo() : 0;
  const { data, error } = await sb.rpc('timer_detener');
  if (error) throw error;
  if (antes) guardarPausa({ task_id: antes.task_id, titulo: antes.titulo, acumulado_seg: seg });
  actual = null; arrancarReloj(); avisar();
  return data;
}
export async function reanudarTimer() { if (pausado) return iniciarTimer(pausado.task_id); }
export function descartarPausa() { guardarPausa(null); avisar(); }

/** Completa la tarea del timer (el timer se detiene solo al completarla). */
export async function completarTareaTimer() {
  const id = actual?.task_id || pausado?.task_id; if (!id) return;
  const { error } = await sb.from('tasks').update({ status: 'completed' }).eq('id', id);
  if (error) throw error;
  guardarPausa(null); actual = null; arrancarReloj(); avisar();
  return id;
}

export async function ajustarTiempo(taskId, minutos) {
  const { data, error } = await sb.rpc('timer_ajustar', { p_task: taskId, p_minutos: minutos });
  if (error) throw error;
  return data;
}

// Mantener al día entre pestañas y dispositivos.
setInterval(() => { if (!document.hidden) cargarTimer(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) cargarTimer(); });

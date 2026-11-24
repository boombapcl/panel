// Timer de tareas compartido por todo el panel. El estado vive en Supabase
// (task_time_logs): un timer abierto por usuario, visible desde cualquier dispositivo.
import { sb } from './acceso.js';

let actual = null;          // { task_id, inicio, titulo, acumulado_seg }
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
  document.querySelectorAll('[data-timer-vivo]').forEach(el => {
    const base = Number(el.dataset.base || 0) * 60; // minutos guardados en tasks.time_spent
    const id = el.dataset.timerVivo;
    const vivo = actual && actual.task_id === id;
    el.textContent = vivo ? formatoDuracion(Number(actual.acumulado_seg ?? base) + corr, true) : formatoDuracion(base);
  });
  document.querySelectorAll('[data-timer-reloj]').forEach(el => {
    el.textContent = actual ? formatoDuracion(Number(actual.acumulado_seg || 0) + corr, true) : '0:00';
  });
}

export async function cargarTimer() {
  const { data, error } = await sb.rpc('timer_actual');
  if (error) return actual;
  const antes = actual?.task_id || null;
  actual = data || null;
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
  actual = data || null; arrancarReloj(); avisar();
  return actual;
}

export async function detenerTimer() {
  const { data, error } = await sb.rpc('timer_detener');
  if (error) throw error;
  actual = null; arrancarReloj(); avisar();
  return data; // { task_id, tiempo_min }
}

export async function ajustarTiempo(taskId, minutos) {
  const { data, error } = await sb.rpc('timer_ajustar', { p_task: taskId, p_minutos: minutos });
  if (error) throw error;
  return data;
}

// Mantener al día entre pestañas y dispositivos.
setInterval(() => { if (!document.hidden) cargarTimer(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) cargarTimer(); });

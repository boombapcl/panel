// Tareas: la misma tabla que usa Noise (public.tasks), con vista por día, cliente y origen.
// Las tareas que crean los agentes traen «origen» y no se duplican (origen_ref).
import './acceso.css';
import './panel.css';
import './tareas.css';
import { sb, exigirSesion, salir } from './lib/acceso.js';
import { pintarRiel, actualizarContadores } from './lib/riel.js';
import { esc, usarClientes, claveCliente, avatar, chipsClientes } from './lib/clientes.js';

const $ = id => document.getElementById(id);
const TZ = 'America/Santiago';
const CAMPOS = 'id,title,description,status,priority,category,scheduled_date,client_id,assigned_to,parent_task_id,origen,origen_ref,enlaces,aprobacion_id,completed_at,created_at,estimated_time,ticket_id,lead_id';

const est = {
  yo: null, tareas: [], padres: new Map(), empresas: [], perfiles: [], categorias: [],
  tab: 'abiertas', abierta: null, editando: null, nuevaFecha: 0, ocupado: false,
};

/* ---------- filtros ---------- */
const CLAVE = 'tareas-filtros';
const filtro = (() => {
  const base = { cliente: '', resp: '', origen: '', prio: '', texto: '' };
  try { return { ...base, ...JSON.parse(localStorage.getItem(CLAVE) || '{}'), texto: '' }; } catch { return base; }
})();
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ ...filtro, texto: '' })); } catch { /* sin almacenamiento */ } };
const hayFiltro = () => !!(filtro.cliente || filtro.resp || filtro.origen || filtro.prio || filtro.texto);

/* ---------- fechas (las de Noise son solo día: se usa la parte AAAA-MM-DD) ---------- */
const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const diaDe = t => (t.scheduled_date || '').slice(0, 10);
function sumarDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function proximoLunes(iso) { const d = new Date(iso + 'T12:00:00Z'); const dow = d.getUTCDay(); return sumarDias(iso, ((8 - dow) % 7) || 7); }
function finSemana(iso) { const d = new Date(iso + 'T12:00:00Z'); const dow = d.getUTCDay() || 7; return sumarDias(iso, 7 - dow); }
const fDia = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const etiquetaDia = iso => iso ? fDia.format(new Date(iso + 'T12:00:00Z')).replace(/\./g, '') : '';
function relativo(iso) {
  if (!iso) return '';
  const h = hoyISO();
  if (iso === h) return 'Hoy';
  if (iso === sumarDias(h, 1)) return 'Mañana';
  if (iso === sumarDias(h, -1)) return 'Ayer';
  return etiquetaDia(iso);
}
function diasAtraso(iso) { return Math.round((new Date(hoyISO() + 'T12:00:00Z') - new Date(iso + 'T12:00:00Z')) / 86400000); }

/* ---------- datos ---------- */
const nombreCliente = t => est.empresas.find(e => e.id === t.client_id)?.name || '';
const nombrePerfil = id => (est.perfiles.find(p => p.id === id)?.full_name || '').split(' ')[0];
const abierta = t => t.status === 'pending' || t.status === 'in_progress';

async function cargar(silencioso) {
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const [ab, he, ctr] = await Promise.all([
    sb.from('tasks').select(CAMPOS).in('status', ['pending', 'in_progress']).limit(1000),
    sb.from('tasks').select(CAMPOS).eq('status', 'completed').gte('completed_at', desde).order('completed_at', { ascending: false }).limit(300),
    actualizarContadores(),
  ]);
  if (ab.error || he.error) {
    $('vivo').className = 'vivo mal'; $('vivo').textContent = 'Sin conexión';
    if (!silencioso) toast('No se pudieron cargar las tareas.');
    return;
  }
  est.tareas = [...ab.data, ...he.data];
  // Títulos de las tareas madre que no vinieron (por ejemplo, ya completadas)
  const faltan = [...new Set(est.tareas.map(t => t.parent_task_id).filter(id => id && !est.tareas.some(x => x.id === id) && !est.padres.has(id)))];
  if (faltan.length) {
    const { data } = await sb.from('tasks').select('id,title,status').in('id', faltan);
    for (const p of data || []) est.padres.set(p.id, p);
  }
  $('vivo').className = 'vivo bien'; $('vivo').textContent = 'En vivo · ' + new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const pb = ctr?.bandeja || 0;
  const ab2 = $('aviso-bandeja');
  ab2.hidden = !pb;
  ab2.innerHTML = pb ? `<b>${pb}</b> ${pb === 1 ? 'decisión espera' : 'decisiones esperan'} tu aprobación en la Bandeja <span aria-hidden="true">→</span>` : '';
  if (!est.editando) render();
}

async function cargarCatalogos() {
  const [emp, per, cat] = await Promise.all([
    sb.from('companies').select('id,name,logo_url,dashboard_logo_url,status').order('name'),
    sb.from('profiles').select('id,full_name'),
    sb.from('task_categories').select('name,color').order('name'),
  ]);
  est.empresas = emp.data || [];
  est.perfiles = (per.data || []).filter(p => p.full_name);
  est.categorias = cat.data || [];
  usarClientes(est.empresas.map(e => ({ nombre: e.name, logo: e.dashboard_logo_url || e.logo_url })));
  const activos = est.empresas.filter(e => e.status === 'activo');
  $('n-cliente').innerHTML = '<option value="">Sin cliente</option>' + activos.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('n-resp').innerHTML = est.perfiles.map(p => `<option value="${p.id}"${p.id === est.yo.id ? ' selected' : ''}>${esc(p.full_name.split(' ')[0])}</option>`).join('');
  $('f-resp').innerHTML = '<option value="">Todos</option><option value="yo">Solo mías</option>' + est.perfiles.filter(p => p.id !== est.yo.id).map(p => `<option value="${p.id}">${esc(p.full_name.split(' ')[0])}</option>`).join('');
}

/* ---------- filtrado y grupos ---------- */
function pasa(t) {
  if (filtro.cliente && claveCliente(nombreCliente(t)) !== filtro.cliente) return false;
  if (filtro.resp === 'yo' && t.assigned_to && t.assigned_to !== est.yo.id) return false;
  if (filtro.resp && filtro.resp !== 'yo' && t.assigned_to !== filtro.resp) return false;
  if (filtro.origen === 'manual' && t.origen) return false;
  if (filtro.origen === 'agente' && !t.origen) return false;
  if (filtro.prio && t.priority !== filtro.prio) return false;
  if (filtro.texto) {
    const q = filtro.texto.toLowerCase();
    if (!`${t.title} ${t.description || ''} ${nombreCliente(t)}`.toLowerCase().includes(q)) return false;
  }
  return true;
}
const ORDEN_PRIO = { alta: 0, media: 1, baja: 2 };
const ordenar = l => l.sort((a, b) => (ORDEN_PRIO[a.priority] ?? 1) - (ORDEN_PRIO[b.priority] ?? 1) || diaDe(a).localeCompare(diaDe(b)) || a.created_at.localeCompare(b.created_at));

function grupos(lista) {
  const h = hoyISO(), m = sumarDias(h, 1), fs = finSemana(h), fp = sumarDias(fs, 7);
  const g = { atrasadas: [], hoy: [], manana: [], semana: [], proxima: [], despues: [], sinfecha: [] };
  for (const t of lista) {
    const d = diaDe(t);
    if (!d) g.sinfecha.push(t);
    else if (d < h) g.atrasadas.push(t);
    else if (d === h) g.hoy.push(t);
    else if (d === m) g.manana.push(t);
    else if (d <= fs) g.semana.push(t);
    else if (d <= fp) g.proxima.push(t);
    else g.despues.push(t);
  }
  Object.values(g).forEach(ordenar);
  g.atrasadas.sort((a, b) => diaDe(a).localeCompare(diaDe(b)));
  return g;
}
const NOMBRES = { atrasadas: 'Atrasadas', hoy: 'Hoy', manana: 'Mañana', semana: 'Esta semana', proxima: 'Próxima semana', despues: 'Más adelante', sinfecha: 'Sin fecha' };

/* ---------- render ---------- */
function filaTarea(t, hijos) {
  const d = diaDe(t), h = hoyISO();
  const hecha = t.status === 'completed';
  const atrasada = !hecha && d && d < h;
  const cli = nombreCliente(t);
  const resp = t.assigned_to && t.assigned_to !== est.yo.id ? nombrePerfil(t.assigned_to) : '';
  const madre = t.parent_task_id ? (est.tareas.find(x => x.id === t.parent_task_id) || est.padres.get(t.parent_task_id)) : null;
  const subs = hijos.get(t.id) || [];
  const subsHechas = subs.filter(s => s.status === 'completed').length;
  const enl = (Array.isArray(t.enlaces) ? t.enlaces : []).filter(e => /^https:\/\//.test(e?.u || ''));
  const abiertaAqui = est.abierta === t.id;
  const meta = [
    cli ? `<span class="m-cli">${avatar(cli, 'xs')}${esc(cli)}</span>` : '',
    d ? `<span class="m-fecha${atrasada ? ' tarde' : ''}">${atrasada ? `${relativo(d)} · ${diasAtraso(d)} d` : relativo(d)}</span>` : '',
    t.priority === 'alta' ? '<span class="m-prio">Alta</span>' : '',
    t.status === 'in_progress' ? '<span class="m-curso">En curso</span>' : '',
    t.origen ? `<span class="m-origen" title="Creada automáticamente">${esc(t.origen)}</span>` : '',
    resp ? `<span class="m-resp">${esc(resp)}</span>` : '',
    subs.length ? `<span class="m-subs">${subsHechas}/${subs.length}</span>` : '',
    madre ? `<span class="m-madre">de «${esc(madre.title)}»</span>` : '',
    t.ticket_id ? '<span class="m-ticket">Ticket</span>' : '',
    enl.length && !abiertaAqui ? `<span class="m-enl">${enl.length} ${enl.length === 1 ? 'enlace' : 'enlaces'}</span>` : '',
  ].filter(Boolean).join('');
  return `<li class="t${hecha ? ' hecha' : ''}${abiertaAqui ? ' abierta' : ''}" data-id="${t.id}">
    <button class="chk" type="button" data-do="${hecha ? 'reabrir' : 'completar'}" aria-label="${hecha ? 'Marcar como pendiente' : 'Completar'}: ${esc(t.title)}"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></button>
    <div class="t-cuerpo">
      <button class="t-tit" type="button" data-do="abrir" aria-expanded="${abiertaAqui}">${esc(t.title)}</button>
      ${meta ? `<div class="t-meta">${meta}</div>` : ''}
      ${abiertaAqui ? detalle(t, subs, enl) : ''}
    </div>
    ${!hecha && !abiertaAqui ? `<div class="t-rap"><button type="button" class="mini" data-do="posponer" data-a="1" title="Pasar a mañana">Mañana</button><button type="button" class="mini" data-do="posponer" data-a="lunes" title="Pasar al lunes">Lunes</button></div>` : ''}
  </li>`;
}

function detalle(t, subs, enl) {
  if (est.editando === t.id) return formEditar(t);
  const desc = (t.description || '').trim();
  return `<div class="t-det">
    ${desc ? `<p class="t-desc">${esc(desc)}</p>` : ''}
    ${enl.length ? `<div class="enl">${enl.map(e => `<a href="${esc(e.u)}" target="_blank" rel="noopener noreferrer">${esc(e.t || 'Abrir')} ↗</a>`).join('')}</div>` : ''}
    ${t.aprobacion_id ? '<p class="t-nota">Viene de una decisión de la <a href="/bandeja">Bandeja</a>.</p>' : ''}
    <ul class="subs">${subs.map(s => `<li class="${s.status === 'completed' ? 'hecha' : ''}"><button class="chk sm" type="button" data-do="${s.status === 'completed' ? 'reabrir' : 'completar'}" data-id="${s.id}" aria-label="Completar subtarea ${esc(s.title)}"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></button><span>${esc(s.title)}</span></li>`).join('')}
      <li class="sub-nueva"><form data-do="subtarea" data-id="${t.id}"><input name="t" placeholder="Agregar subtarea" maxlength="300" aria-label="Nueva subtarea"></form></li>
    </ul>
    <div class="acc">
      <button class="b sm" type="button" data-do="editar">Editar</button>
      ${t.status === 'pending' ? '<button class="b sm" type="button" data-do="estado" data-a="in_progress">Marcar en curso</button>' : ''}
      ${t.status === 'in_progress' ? '<button class="b sm" type="button" data-do="estado" data-a="pending">Quitar «en curso»</button>' : ''}
      <button class="b sm" type="button" data-do="posponer" data-a="1">Mañana</button>
      <button class="b sm" type="button" data-do="posponer" data-a="lunes">Lunes</button>
      <button class="b sm no-l" type="button" data-do="cancelar">Descartar</button>
    </div>
    <p class="t-pie">Creada ${esc(etiquetaDia(t.created_at.slice(0, 10)))}${t.origen ? ` por ${esc(t.origen)}` : ''}${t.estimated_time ? ` · estimado ${t.estimated_time} min` : ''}</p>
  </div>`;
}

function formEditar(t) {
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  return `<form class="t-edit" data-do="guardar" data-id="${t.id}">
    <label>Título<input name="title" value="${esc(t.title)}" maxlength="300" required></label>
    <label>Detalle<textarea name="description" rows="3">${esc(t.description || '')}</textarea></label>
    <div class="t-edit-fila">
      <label>Cliente<select name="client_id">${opt('', 'Sin cliente', !t.client_id)}${est.empresas.filter(e => e.status === 'activo' || e.id === t.client_id).map(e => opt(e.id, e.name, e.id === t.client_id)).join('')}</select></label>
      <label>Fecha<input type="date" name="fecha" value="${esc(diaDe(t))}"></label>
      <label>Responsable<select name="assigned_to">${opt('', 'Sin asignar', !t.assigned_to)}${est.perfiles.map(p => opt(p.id, p.full_name.split(' ')[0], p.id === t.assigned_to)).join('')}</select></label>
      <label>Prioridad<select name="priority">${['alta', 'media', 'baja'].map(p => opt(p, p[0].toUpperCase() + p.slice(1), p === t.priority)).join('')}</select></label>
      <label>Categoría<select name="category">${opt('', 'Sin categoría', !t.category)}${est.categorias.map(c => opt(c.name, c.name, c.name === t.category)).join('')}${t.category && !est.categorias.some(c => c.name === t.category) ? opt(t.category, t.category, true) : ''}</select></label>
    </div>
    <div class="acc"><button class="b ok sm" type="submit">Guardar</button><button class="b sm" type="button" data-do="cerrar-edicion">Cancelar</button></div>
  </form>`;
}

function render() {
  const yo = est.yo.id;
  const todas = est.tareas;
  const hijos = new Map();
  for (const t of todas) if (t.parent_task_id && todas.some(x => x.id === t.parent_task_id)) {
    if (!hijos.has(t.parent_task_id)) hijos.set(t.parent_task_id, []);
    hijos.get(t.parent_task_id).push(t);
  }
  // Una subtarea se muestra dentro de su tarea madre si la madre está en la misma vista.
  const raiz = t => !(t.parent_task_id && todas.some(x => x.id === t.parent_task_id && abierta(x) === abierta(t)));
  const abiertas = todas.filter(t => abierta(t) && raiz(t));
  const hechas = todas.filter(t => t.status === 'completed' && raiz(t));
  const vis = (est.tab === 'abiertas' ? abiertas : hechas).filter(pasa);

  // Encabezado
  const mias = todas.filter(t => abierta(t) && (!t.assigned_to || t.assigned_to === yo));
  const h = hoyISO();
  const nHoy = mias.filter(t => diaDe(t) === h).length, nAtr = mias.filter(t => diaDe(t) && diaDe(t) < h).length;
  $('sub').textContent = nHoy || nAtr
    ? `Tienes ${nHoy} para hoy${nAtr ? ` y ${nAtr} atrasada${nAtr === 1 ? '' : 's'}` : ''}.`
    : 'Nada pendiente para hoy.';
  document.title = `${nHoy + nAtr ? `(${nHoy + nAtr}) ` : ''}Tareas · Panel Boombap`;
  $('n-abiertas').textContent = abiertas.filter(pasa).length;
  $('n-hechas').textContent = hechas.filter(pasa).length;
  $('n-abiertas').classList.toggle('hay', nAtr > 0);
  document.querySelectorAll('#tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === est.tab)));

  // Clientes con tareas abiertas
  const conteo = new Map();
  for (const t of abiertas) { const c = nombreCliente(t); if (!c) continue; const k = claveCliente(c); const v = conteo.get(k) || { nombre: c, n: 0 }; v.n++; conteo.set(k, v); }
  const items = [...conteo.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
  if (filtro.cliente && !conteo.has(filtro.cliente)) {
    const e = est.empresas.find(e => claveCliente(e.name) === filtro.cliente);
    if (e) items.unshift({ nombre: e.name, n: 0 });
  }
  $('clientes').innerHTML = chipsClientes(items, filtro.cliente, abiertas.length);
  $('f-resp').value = filtro.resp; $('f-origen').value = filtro.origen; $('f-prio').value = filtro.prio;
  $('f-limpiar').hidden = !hayFiltro();

  let html = '';
  if (est.tab === 'abiertas') {
    const g = grupos(vis);
    for (const k of Object.keys(NOMBRES)) {
      if (!g[k].length) continue;
      html += `<section class="grupo g-${k}"><h2>${NOMBRES[k]} <span>${g[k].length}</span></h2><ul>${g[k].map(t => filaTarea(t, hijos)).join('')}</ul></section>`;
    }
    if (!html) html = hayFiltro()
      ? '<div class="vacio"><b>Nada con estos filtros</b><span>Prueba con otro cliente o quita los filtros.</span></div>'
      : '<div class="vacio"><b>Todo al día</b><span>Agrega una tarea arriba o espera las que creen los agentes.</span></div>';
  } else {
    const porDia = new Map();
    for (const t of vis.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))) {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(t.completed_at || t.created_at));
      if (!porDia.has(d)) porDia.set(d, []);
      porDia.get(d).push(t);
    }
    for (const [d, l] of porDia) html += `<section class="grupo"><h2>${relativo(d)} <span>${l.length}</span></h2><ul>${l.map(t => filaTarea(t, hijos)).join('')}</ul></section>`;
    if (!html) html = '<div class="vacio"><b>Sin tareas hechas</b><span>Aquí aparecen las de los últimos 30 días.</span></div>';
  }
  $('lista').innerHTML = html;
  if (est.editando) document.querySelector('.t-edit input[name=title]')?.focus();
}

/* ---------- acciones ---------- */
let toastTimer;
function toast(texto, deshacer) {
  const el = $('toast');
  el.innerHTML = esc(texto) + (deshacer ? ' <button type="button" class="deshacer">Deshacer</button>' : '');
  el.hidden = false;
  if (deshacer) el.querySelector('.deshacer').onclick = () => { el.hidden = true; deshacer(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

async function actualizar(id, cambios, mensaje, previo) {
  const t = est.tareas.find(x => x.id === id);
  const antes = t ? Object.fromEntries(Object.keys(cambios).map(k => [k, t[k]])) : null;
  if (t) Object.assign(t, cambios, cambios.status === 'completed' ? { completed_at: new Date().toISOString() } : {});
  render();
  const { error } = await sb.from('tasks').update(cambios).eq('id', id);
  if (error) { if (t && antes) Object.assign(t, antes); render(); toast('No se pudo guardar: ' + (error.message || '')); return false; }
  if (mensaje) toast(mensaje, previo && antes ? () => actualizar(id, antes) : null);
  actualizarContadores();
  return true;
}

function fechaPara(a) {
  const h = hoyISO();
  if (a === 'lunes') return proximoLunes(h);
  return sumarDias(h, Number(a));
}

$('lista').addEventListener('click', async ev => {
  const b = ev.target.closest('[data-do]'); if (!b || b.tagName === 'FORM') return;
  const li = b.closest('li.t'); const id = b.dataset.id || li?.dataset.id; if (!id) return;
  const hacer = b.dataset.do;
  if (hacer === 'abrir') { est.abierta = est.abierta === id ? null : id; est.editando = null; return render(); }
  if (hacer === 'completar') return actualizar(id, { status: 'completed' }, 'Tarea completada.', true);
  if (hacer === 'reabrir') return actualizar(id, { status: 'pending' }, 'Tarea reabierta.');
  if (hacer === 'estado') return actualizar(id, { status: b.dataset.a });
  if (hacer === 'posponer') { const f = fechaPara(b.dataset.a); return actualizar(id, { scheduled_date: f }, `Movida a ${relativo(f).toLowerCase()}.`, true); }
  if (hacer === 'cancelar') return actualizar(id, { status: 'cancelled' }, 'Tarea descartada.', true);
  if (hacer === 'editar') { est.editando = id; return render(); }
  if (hacer === 'cerrar-edicion') { est.editando = null; return render(); }
});

$('lista').addEventListener('submit', async ev => {
  const f = ev.target.closest('form[data-do]'); if (!f) return;
  ev.preventDefault();
  if (f.dataset.do === 'guardar') {
    const d = Object.fromEntries(new FormData(f));
    const cambios = {
      title: d.title.trim(), description: d.description.trim() || null,
      client_id: d.client_id || null, assigned_to: d.assigned_to || null,
      priority: d.priority, category: d.category || null, scheduled_date: d.fecha || null,
    };
    est.editando = null;
    return actualizar(f.dataset.id, cambios, 'Cambios guardados.');
  }
  if (f.dataset.do === 'subtarea') {
    const titulo = f.t.value.trim(); if (!titulo) return;
    const madre = est.tareas.find(x => x.id === f.dataset.id);
    f.t.value = '';
    const { data, error } = await sb.from('tasks').insert({
      title: titulo, type: 'work', status: 'pending', priority: madre?.priority || 'media',
      parent_task_id: f.dataset.id, client_id: madre?.client_id || null, assigned_to: madre?.assigned_to || est.yo.id,
      scheduled_date: madre?.scheduled_date || hoyISO(), created_by: est.yo.id, time_spent: 0, estimated_time: 0,
    }).select(CAMPOS).single();
    if (error) return toast('No se pudo agregar la subtarea.');
    est.tareas.push(data); render();
    document.querySelector(`form[data-do=subtarea][data-id="${f.dataset.id}"] input`)?.focus();
  }
});

// Nueva tarea
$('nueva').addEventListener('click', ev => {
  const b = ev.target.closest('[data-dia]'); if (!b) return;
  est.nuevaFecha = b.dataset.dia; $('n-fecha').value = '';
  document.querySelectorAll('.dias [data-dia]').forEach(x => x.classList.toggle('on', x === b));
});
$('n-fecha').addEventListener('change', () => {
  est.nuevaFecha = $('n-fecha').value ? 'fecha' : 0;
  document.querySelectorAll('.dias [data-dia]').forEach(x => x.classList.toggle('on', !$('n-fecha').value && x.dataset.dia === '0'));
});
$('nueva').addEventListener('submit', async ev => {
  ev.preventDefault();
  if (est.ocupado) return;
  const titulo = $('n-titulo').value.trim(); if (!titulo) return;
  const fecha = est.nuevaFecha === 'fecha' ? $('n-fecha').value : fechaPara(est.nuevaFecha);
  est.ocupado = true;
  const { data, error } = await sb.from('tasks').insert({
    title: titulo, type: 'work', status: 'pending', priority: $('n-prio').value,
    client_id: $('n-cliente').value || (filtro.cliente ? est.empresas.find(e => claveCliente(e.name) === filtro.cliente)?.id : null) || null,
    assigned_to: $('n-resp').value || est.yo.id, scheduled_date: fecha, created_by: est.yo.id, time_spent: 0, estimated_time: 0,
  }).select(CAMPOS).single();
  est.ocupado = false;
  if (error) return toast('No se pudo crear la tarea: ' + (error.message || ''));
  est.tareas.push(data);
  $('n-titulo').value = '';
  est.tab = 'abiertas'; render(); actualizarContadores();
  toast(`Tarea agregada para ${relativo(fecha).toLowerCase()}.`);
});

// Pestañas y filtros
$('tabs').addEventListener('click', ev => { const b = ev.target.closest('[role=tab]'); if (!b) return; est.tab = b.dataset.t; est.abierta = null; est.editando = null; render(); });
$('clientes').addEventListener('click', ev => {
  const b = ev.target.closest('[data-cli]'); if (!b) return;
  filtro.cliente = filtro.cliente === b.dataset.cli ? '' : b.dataset.cli;
  const e = est.empresas.find(e => claveCliente(e.name) === filtro.cliente);
  $('n-cliente').value = e?.id || '';
  guardar(); render();
});
for (const [id, k] of [['f-resp', 'resp'], ['f-origen', 'origen'], ['f-prio', 'prio']]) $(id).addEventListener('change', ev => { filtro[k] = ev.target.value; guardar(); render(); });
$('f-texto').addEventListener('input', ev => { filtro.texto = ev.target.value.trim(); render(); });
$('f-limpiar').addEventListener('click', () => { Object.assign(filtro, { cliente: '', resp: '', origen: '', prio: '', texto: '' }); $('f-texto').value = ''; $('n-cliente').value = ''; guardar(); render(); });
$('salir').addEventListener('click', salir);
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && (est.editando || est.abierta)) { est.editando = null; est.abierta = null; render(); }
  if (ev.key === 'n' && !ev.metaKey && !ev.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { ev.preventDefault(); $('n-titulo').focus(); }
});

/* ---------- inicio ---------- */
est.yo = await exigirSesion();
pintarRiel('tareas');
await cargarCatalogos();
{ // Enlace directo desde Células: /?cliente=Alimor
  const p = new URLSearchParams(location.search).get('cliente');
  if (p) { filtro.cliente = claveCliente(p); const e = est.empresas.find(e => claveCliente(e.name) === filtro.cliente); $('n-cliente').value = e?.id || ''; history.replaceState(null, '', '/'); }
}
await cargar(false);
setInterval(() => { if (!document.hidden && !est.editando && !document.activeElement?.closest?.('.nueva, .subs, .filtros')) cargar(true); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !est.editando) cargar(true); });

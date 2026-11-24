// Clientes: la matriz de Noise (companies) con sus contactos, servicios, cuentas de pauta
// y lo pendiente (tareas y decisiones) en una sola vista.
import './acceso.css';
import './panel.css';
import './tareas.css';
import './cartera.css';
import { sb, exigirSesion } from './lib/acceso.js';
import { iniciarMenu, actualizarContadores, alNavegar, refrescarMenu } from './lib/menu.js';
import { esc, usarClientes, claveCliente, avatar } from './lib/clientes.js';
import { formatoDuracion } from './lib/timer.js';

const $ = id => document.getElementById(id);
const TZ = 'America/Santiago';
const VISTAS = ['activos', 'pendientes', 'pauta', 'inactivos'];
const est = { yo: null, clientes: [], decisiones: new Map(), ver: 'activos', sel: null, tareasSel: [], editando: false, q: '', orden: 'nombre' };
try { est.orden = localStorage.getItem('clientes-orden') || 'nombre'; } catch { /* sin almacenamiento */ }

const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const fDia = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dia = iso => iso ? fDia.format(new Date(iso.slice(0, 10) + 'T12:00:00Z')).replace(/\./g, '') : '';
const clp = n => n == null ? '' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const TAMANOS = { '1p': '1 persona', '2_5p': '2 a 5 personas', '6_10p': '6 a 10 personas', '10p': 'Más de 10 personas', '10_plus': 'Más de 10 personas' };
const urlSegura = u => { const x = String(u || '').trim(); if (!x) return ''; const c = /^https?:\/\//i.test(x) ? x : 'https://' + x; return /^https:\/\/[^\s"<>]+$/i.test(c.replace(/^http:/i, 'https:')) ? c.replace(/^http:/i, 'https:') : ''; };

let toastT;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 5000); }

/* ---------- datos ---------- */
async function cargar(silencioso) {
  const [c, p] = await Promise.all([sb.rpc('panel_clientes'), sb.rpc('panel_por_cliente'), actualizarContadores()]);
  if (c.error) {
    $('vivo').className = 'vivo mal'; $('vivo').textContent = 'Sin conexión';
    if (!silencioso) $('grid').innerHTML = `<div class="vacio"><b>No se pudieron cargar los clientes</b><span>${esc(c.error.message || '')}</span></div>`;
    return;
  }
  est.clientes = c.data || [];
  usarClientes(est.clientes.map(x => ({ nombre: x.nombre, logo: x.logo })));
  est.decisiones = new Map();
  for (const d of p.data?.decisiones || []) { const k = claveCliente(d.cliente); est.decisiones.set(k, (est.decisiones.get(k) || 0) + d.n); }
  $('vivo').className = 'vivo bien'; $('vivo').textContent = 'En vivo · ' + new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  if (!est.editando) render();
}
async function cargarTareas(id) {
  const { data } = await sb.from('tasks').select('id,title,status,priority,scheduled_date,origen,time_spent')
    .eq('client_id', id).in('status', ['pending', 'in_progress']).is('parent_task_id', null).order('scheduled_date', { ascending: true, nullsFirst: false }).limit(30);
  if (est.sel === id) { est.tareasSel = data || []; if (!est.editando) pintarFicha(); }
}

const decisionesDe = c => est.decisiones.get(claveCliente(c.nombre)) || 0;
const pendientes = c => (c.tareas || 0) + decisionesDe(c);
function pasaVista(c, v = est.ver) {
  if (v === 'inactivos') return c.estado !== 'activo';
  if (c.estado !== 'activo') return false;
  if (v === 'pendientes') return pendientes(c) > 0;
  if (v === 'pauta') return (c.pauta || []).length > 0;
  return true;
}
function pasaTexto(c) {
  if (!est.q) return true;
  const txt = [c.nombre, c.razon_social, c.rubro, c.comuna, c.region, c.rut, c.web, ...(c.contactos || []).map(k => `${k.nombre} ${k.email || ''}`)].join(' ').toLowerCase();
  return est.q.toLowerCase().split(/\s+/).every(p => txt.includes(p));
}

/* ---------- render ---------- */
function tarjeta(c) {
  const dec = decisionesDe(c);
  const ppal = (c.contactos || []).find(k => k.rol === 'principal') || (c.contactos || [])[0];
  const lugar = [c.comuna, c.region].filter(Boolean).join(', ');
  const stats = [
    c.tareas ? `<span class="st${c.atrasadas ? ' mal' : ''}" title="Tareas abiertas">${c.tareas} tarea${c.tareas === 1 ? '' : 's'}${c.atrasadas ? ` · ${c.atrasadas} atrasada${c.atrasadas === 1 ? '' : 's'}` : ''}</span>` : '',
    dec ? `<span class="st dec" title="Decisiones en la Bandeja">${dec} decisión${dec === 1 ? '' : 'es'}</span>` : '',
    (c.pauta || []).length ? `<span class="st meta" title="Cuenta de Meta conectada al Panel">Meta${c.pauta.some(p => p.boost) ? ' · Boost' : ''}</span>` : '',
    c.minutos_30 ? `<span class="st t30" title="Tiempo registrado en 30 días">⏱ ${formatoDuracion(c.minutos_30 * 60)}</span>` : '',
  ].filter(Boolean).join('');
  return `<button type="button" class="c-tj${est.sel === c.id ? ' on' : ''}${c.estado !== 'activo' ? ' inactivo' : ''}" data-c="${c.id}" aria-pressed="${est.sel === c.id}" ${c.color ? `style="--marca:${esc(c.color)}"` : ''}>
    <span class="c-cab">${avatarGrande(c, 'md')}<span class="c-nom"><b>${esc(c.nombre)}</b><small>${esc([c.rubro, lugar].filter(Boolean).join(' · ') || 'Sin rubro')}</small></span>${c.estado !== 'activo' ? '<span class="pill-in">Inactivo</span>' : ''}</span>
    ${stats ? `<span class="c-stats">${stats}</span>` : '<span class="c-stats"><span class="st ok">Al día</span></span>'}
    ${ppal ? `<span class="c-ppal">${esc(ppal.nombre)}${ppal.cargo ? ` · ${esc(ppal.cargo)}` : ''}</span>` : ''}
  </button>`;
}
function avatarGrande(c, tam) {
  const u = urlSegura(c.logo);
  return u ? `<img class="c-av ${tam}" src="${esc(u)}" alt="" loading="lazy">` : `<span class="c-av ${tam} ini" aria-hidden="true">${esc(c.nombre.trim().charAt(0).toUpperCase())}</span>`;
}

function render() {
  const activos = est.clientes.filter(c => c.estado === 'activo');
  const cuenta = v => est.clientes.filter(c => pasaVista(c, v)).length;
  for (const v of VISTAS) $('n-' + v).textContent = cuenta(v);
  document.querySelectorAll('#tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === est.ver)));
  const conAtraso = activos.filter(c => c.atrasadas > 0).length;
  const conDec = activos.filter(c => decisionesDe(c) > 0).length;
  $('sub').textContent = `${activos.length} activos · ${conAtraso ? `${conAtraso} con tareas atrasadas` : 'ninguno con tareas atrasadas'}${conDec ? ` · ${conDec} con decisiones pendientes` : ''}.`;
  $('orden').value = est.orden;

  let lista = est.clientes.filter(c => pasaVista(c) && pasaTexto(c));
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  if (est.orden === 'pendientes') lista.sort((a, b) => (b.atrasadas - a.atrasadas) || (pendientes(b) - pendientes(a)) || porNombre(a, b));
  else if (est.orden === 'tiempo') lista.sort((a, b) => (b.minutos_30 - a.minutos_30) || porNombre(a, b));
  else lista.sort(porNombre);
  $('grid').innerHTML = lista.length ? lista.map(tarjeta).join('')
    : `<div class="vacio"><b>${est.q ? 'Sin coincidencias' : 'Nada por aquí'}</b><span>${est.q ? 'Prueba con otro nombre o rubro.' : 'Ningún cliente en esta vista.'}</span></div>`;
  $('layout').classList.toggle('con-ficha', !!est.sel);
  pintarFicha();
}

function fila(et, val) { return val ? `<div class="f-dato"><dt>${et}</dt><dd>${val}</dd></div>` : ''; }
function enlace(u, t) { const s = urlSegura(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(t || s.replace(/^https:\/\//, ''))} ↗</a>` : ''; }

function pintarFicha() {
  const el = $('ficha');
  const c = est.clientes.find(x => x.id === est.sel);
  el.hidden = !c;
  document.documentElement.classList.toggle('ficha-abierta', !!c);
  if (!c) { el.innerHTML = ''; return; }
  const dec = decisionesDe(c);
  const h = hoyISO();
  const q = encodeURIComponent(c.nombre);
  const contactos = c.contactos || [], servicios = c.servicios || [], fact = c.facturacion || [], pauta = c.pauta || [];
  el.innerHTML = `
    <div class="f-cab">
      ${avatarGrande(c, 'lg')}
      <div class="f-nom"><h2>${esc(c.nombre)}</h2><p>${esc([c.razon_social, c.rut].filter(Boolean).join(' · ') || 'Sin razón social')}</p></div>
      <button type="button" class="f-x" data-f="cerrar" aria-label="Cerrar ficha">✕</button>
    </div>
    <div class="f-resumen">
      <a class="f-kpi${c.atrasadas ? ' mal' : ''}" href="/?cliente=${q}"><b class="num">${c.tareas}</b><span>tareas abiertas${c.atrasadas ? ` · ${c.atrasadas} atrasadas` : ''}</span></a>
      <a class="f-kpi${dec ? ' dec' : ''}" href="/bandeja?cliente=${q}"><b class="num">${dec}</b><span>decisiones en la Bandeja</span></a>
      <div class="f-kpi"><b class="num">${c.hechas_30}</b><span>tareas hechas (30 días)</span></div>
      <div class="f-kpi"><b class="num">${formatoDuracion((c.minutos_30 || 0) * 60)}</b><span>tiempo registrado (30 días)</span></div>
    </div>

    <section class="f-sec">
      <div class="f-sec-h"><h3>Tareas abiertas</h3><a href="/?cliente=${q}">Ver en Tareas →</a></div>
      <form class="f-nueva" data-f="nueva"><input name="t" placeholder="Nueva tarea para ${esc(c.nombre)} (hoy)" maxlength="300" aria-label="Nueva tarea para ${esc(c.nombre)}"><button class="b sm ok" type="submit">Agregar</button></form>
      ${est.tareasSel.length ? `<ul class="f-tareas">${est.tareasSel.map(t => {
        const d = (t.scheduled_date || '').slice(0, 10), tarde = d && d < h;
        return `<li><a href="/?tarea=${t.id}"><span class="f-t-tit">${esc(t.title)}</span><span class="f-t-meta">${d ? `<span class="${tarde ? 'tarde' : ''}">${d === h ? 'Hoy' : esc(dia(d))}</span>` : ''}${t.priority === 'alta' ? '<span class="alta">Alta</span>' : ''}${t.status === 'in_progress' ? '<span class="curso">En curso</span>' : ''}${t.origen ? `<span class="ori">${esc(t.origen)}</span>` : ''}</span></a></li>`;
      }).join('')}</ul>` : '<p class="f-vacio">Sin tareas abiertas.</p>'}
    </section>

    ${est.editando ? formEditar(c) : `
    <section class="f-sec">
      <div class="f-sec-h"><h3>Datos</h3><button type="button" class="b sm" data-f="editar">Editar</button></div>
      <dl class="f-datos">
        ${fila('Estado', c.estado === 'activo' ? 'Activo' : 'Inactivo')}
        ${fila('Rubro', esc(c.rubro))}
        ${fila('Tamaño', esc(TAMANOS[c.tamano] || c.tamano || ''))}
        ${fila('Ubicación', esc([c.comuna, c.region].filter(Boolean).join(', ')))}
        ${fila('Sitio web', enlace(c.web))}
        ${fila('Drive · pauta', enlace(c.drive_ads, 'Carpeta de anuncios'))}
        ${fila('Drive · facturas', enlace(c.drive_facturas, 'Carpeta de facturas'))}
        ${fila('Cliente desde', esc(dia(c.creado)))}
      </dl>
    </section>`}

    <section class="f-sec">
      <div class="f-sec-h"><h3>Contactos</h3><span>${contactos.length}</span></div>
      ${contactos.length ? `<ul class="f-contactos">${contactos.map(k => `<li>
        <span class="c-av sm ini" aria-hidden="true">${esc((k.nombre || '?').charAt(0).toUpperCase())}</span>
        <div><b>${esc(k.nombre)}</b>${k.rol === 'principal' ? ' <span class="pill-p">Principal</span>' : ''}<small>${esc(k.cargo || '')}</small>
        <span class="f-ct">${k.email ? `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a>` : ''}${k.telefono ? `<a href="tel:${esc(String(k.telefono).replace(/[^\d+]/g, ''))}">${esc(k.telefono)}</a>` : ''}</span></div>
      </li>`).join('')}</ul>` : '<p class="f-vacio">Sin contactos en Noise.</p>'}
    </section>

    ${fact.length ? `<section class="f-sec"><div class="f-sec-h"><h3>Facturación</h3></div><ul class="f-lista">${fact.map(b => `<li><b>${esc(b.nombre || 'Contacto de facturación')}</b><small>${esc((b.correos || []).join(', '))}${b.telefono ? ` · ${esc(b.telefono)}` : ''}</small></li>`).join('')}</ul></section>` : ''}

    <section class="f-sec">
      <div class="f-sec-h"><h3>Servicios contratados</h3><span>${servicios.length}</span></div>
      ${servicios.length ? `<ul class="f-lista">${servicios.map(s => `<li><b>${esc(s.nombre)}</b><small>${esc([s.tipo === 'recurrente' ? `Recurrente${s.recurrencia ? ' ' + s.recurrencia : ''}` : 'Proyecto', s.estado, s.monto != null ? clp(s.monto) + ' + IVA' : '', s.renovacion ? 'renueva ' + dia(s.renovacion) : ''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ul>` : '<p class="f-vacio">Aún no hay servicios registrados en Noise.</p>'}
    </section>

    <section class="f-sec">
      <div class="f-sec-h"><h3>Pauta</h3></div>
      ${pauta.length ? `<ul class="f-lista">${pauta.map(p => `<li><b>Meta · ${esc(p.nombre || p.cuenta)}</b><small>Cuenta ${esc(p.cuenta)} · ${p.escritura ? 'lectura y escritura' : 'solo lectura'}${p.boost ? ' · Boost IG activo' : ''}${p.slack ? ` · #${esc(p.slack)}` : ''}</small></li>`).join('')}</ul>` : '<p class="f-vacio">Sin cuenta de Meta conectada al Panel.</p>'}
    </section>

    <p class="f-pie"><a href="https://noise.boombap.cl/admin/clients" target="_blank" rel="noopener noreferrer">Contactos, servicios y logo se editan en Noise ↗</a></p>`;
  if (est.editando) el.querySelector('select[name=status]')?.focus();
}

function formEditar(c) {
  const v = x => esc(x || '');
  return `<form class="f-sec t-edit f-edit" data-f="guardar">
    <div class="f-sec-h"><h3>Editar datos</h3></div>
    <div class="t-edit-fila">
      <label>Estado<select name="status"><option value="activo"${c.estado === 'activo' ? ' selected' : ''}>Activo</option><option value="inactivo"${c.estado !== 'activo' ? ' selected' : ''}>Inactivo</option></select></label>
      <label>Región<input name="region" value="${v(c.region)}" maxlength="80"></label>
      <label>Comuna<input name="comuna" value="${v(c.comuna)}" maxlength="80"></label>
    </div>
    <label>Sitio web<input name="website_domain" value="${v(c.web)}" maxlength="200" placeholder="ejemplo.cl"></label>
    <label>Carpeta de Drive · pauta<input name="google_drive_ads_folder" value="${v(c.drive_ads)}" maxlength="500" placeholder="https://drive.google.com/…"></label>
    <label>Carpeta de Drive · facturas<input name="google_drive_billing_folder" value="${v(c.drive_facturas)}" maxlength="500" placeholder="https://drive.google.com/…"></label>
    <div class="acc"><button class="b ok sm" type="submit">Guardar</button><button class="b sm" type="button" data-f="cancelar">Cancelar</button></div>
  </form>`;
}

/* ---------- navegación ---------- */
function syncUrl() {
  const q = new URLSearchParams();
  if (est.ver !== 'activos') q.set('ver', est.ver);
  if (est.sel) q.set('c', est.sel);
  history.replaceState(null, '', '/clientes' + (q.toString() ? '?' + q : ''));
  refrescarMenu();
}
function seleccionar(id) {
  est.sel = id; est.editando = false; est.tareasSel = [];
  syncUrl(); render();
  if (id) { cargarTareas(id); if (window.matchMedia('(max-width: 1100px)').matches) $('ficha').scrollTop = 0; }
}
function irA(u) {
  const v = u.searchParams.get('ver');
  est.ver = VISTAS.includes(v) ? v : 'activos';
  const c = u.searchParams.get('c');
  est.sel = c && est.clientes.some(x => x.id === c) ? c : null;
  const n = u.searchParams.get('cliente');
  if (n) { const k = claveCliente(n); est.sel = est.clientes.find(x => claveCliente(x.nombre) === k)?.id || est.sel; }
  est.editando = false; render();
  if (est.sel) cargarTareas(est.sel);
}

/* ---------- eventos ---------- */
$('grid').addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (b) seleccionar(est.sel === b.dataset.c ? null : b.dataset.c); });
$('tabs').addEventListener('click', ev => { const b = ev.target.closest('[role=tab]'); if (!b) return; est.ver = b.dataset.v; syncUrl(); render(); });
$('q').addEventListener('input', ev => { est.q = ev.target.value.trim(); render(); });
$('orden').addEventListener('change', ev => { est.orden = ev.target.value; try { localStorage.setItem('clientes-orden', est.orden); } catch { /* */ } render(); });
$('ficha').addEventListener('click', ev => {
  const b = ev.target.closest('[data-f]'); if (!b || b.tagName === 'FORM') return;
  if (b.dataset.f === 'cerrar') return seleccionar(null);
  if (b.dataset.f === 'editar') { est.editando = true; return pintarFicha(); }
  if (b.dataset.f === 'cancelar') { est.editando = false; return pintarFicha(); }
});
$('ficha').addEventListener('submit', async ev => {
  const f = ev.target.closest('form[data-f]'); if (!f) return;
  ev.preventDefault();
  const c = est.clientes.find(x => x.id === est.sel); if (!c) return;
  if (f.dataset.f === 'nueva') {
    const t = f.t.value.trim(); if (!t) return;
    f.querySelector('button').disabled = true;
    const { error } = await sb.from('tasks').insert({ title: t, type: 'work', status: 'pending', priority: 'media', client_id: c.id, assigned_to: est.yo.id, scheduled_date: hoyISO(), created_by: est.yo.id, time_spent: 0, estimated_time: 0 });
    f.querySelector('button').disabled = false;
    if (error) return toast('No se pudo crear la tarea: ' + (error.message || ''));
    f.t.value = ''; toast(`Tarea agregada para hoy en ${c.nombre}.`);
    c.tareas++; render(); cargarTareas(c.id); actualizarContadores();
    return;
  }
  if (f.dataset.f === 'guardar') {
    const d = Object.fromEntries(new FormData(f));
    const limpio = k => (d[k] || '').trim() || null;
    for (const k of ['google_drive_ads_folder', 'google_drive_billing_folder']) if (limpio(k) && !/^https:\/\//i.test(limpio(k))) return toast('Las carpetas de Drive deben ser un enlace https://');
    const cambios = { status: d.status === 'inactivo' ? 'inactivo' : 'activo', region: limpio('region'), comuna: limpio('comuna'), website_domain: limpio('website_domain'), google_drive_ads_folder: limpio('google_drive_ads_folder'), google_drive_billing_folder: limpio('google_drive_billing_folder') };
    const { error } = await sb.from('companies').update(cambios).eq('id', c.id);
    if (error) return toast('No se pudo guardar: ' + (error.message || ''));
    Object.assign(c, { estado: cambios.status, region: cambios.region, comuna: cambios.comuna, web: cambios.website_domain, drive_ads: cambios.google_drive_ads_folder, drive_facturas: cambios.google_drive_billing_folder });
    est.editando = false; render(); toast('Datos guardados en Noise.');
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && est.sel && !est.editando) seleccionar(null); });
// En pantallas angostas la ficha flota: tocar fuera la cierra.
document.addEventListener('click', ev => { if (ev.target === document.body && est.sel) seleccionar(null); });

/* ---------- inicio ---------- */
est.yo = await exigirSesion();
iniciarMenu('clientes', est.yo);
await cargar(false);
irA(new URL(location.href));
alNavegar(u => irA(u));
setInterval(() => { if (!document.hidden && !est.editando && !document.activeElement?.closest?.('#ficha form, #q')) cargar(true); }, 30000);

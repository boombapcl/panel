import './acceso.css';
import './panel.css';
import { sb, exigirSesion, salir } from './lib/acceso.js';
import { pintarRiel, actualizarContadores } from './lib/riel.js';
import { esc, usarClientes, claveCliente, avatar, chipsClientes } from './lib/clientes.js';

const $ = id => document.getElementById(id);
const TZ = 'America/Santiago';

const ACCION = {
  cargar_anuncio: 'Cargar anuncio en pausa',
  boost_post: 'Cargar Boost en pausa',
  reanudar_anuncio: 'Activar anuncio',
  pausar_anuncio: 'Pausar anuncio',
  duplicar_conjunto: 'Duplicar conjunto en pausa',
  eliminar_conjunto: 'Eliminar conjunto',
  cambiar_presupuesto_conjunto: 'Cambiar presupuesto del conjunto',
  probar_creativo: 'Prueba técnica de creativo',
};
const ESTADO = {
  pendiente: 'Pendiente', aprobada: 'Aprobada', ejecutando: 'Ejecutando', ejecutada: 'Ejecutada',
  error: 'Con error', rechazada: 'Rechazada', cambios: 'Cambio pedido', vencida: 'Vencida', atendida: 'Atendida',
};

const estado = { datos: null, tab: 'pendientes', abierto: null, ocupado: false, usuario: null };

/* ---------- filtros ---------- */
const CLAVE_FILTROS = 'bandeja-filtros';
const filtro = (() => {
  try { return { cliente: '', tipo: '', plat: '', fecha: '', ...JSON.parse(localStorage.getItem(CLAVE_FILTROS) || '{}') }; }
  catch { return { cliente: '', tipo: '', plat: '', fecha: '' }; }
})();
function guardarFiltros() { try { localStorage.setItem(CLAVE_FILTROS, JSON.stringify(filtro)); } catch { /* sin almacenamiento */ } }
const tipoDe = x => x.celula || 'Pauta';
const platDe = x => x.plataforma_efectiva || x.plataforma || 'Meta';
const fechaDe = x => x.decidida_at || x.ejecutada_at || x.created_at;
function pasa(x) {
  if (filtro.cliente && claveCliente(x.cliente || x.cuenta) !== filtro.cliente) return false;
  if (filtro.tipo && tipoDe(x) !== filtro.tipo) return false;
  if (filtro.plat && platDe(x) !== filtro.plat) return false;
  if (filtro.fecha) {
    const t = new Date(fechaDe(x)).getTime();
    if (filtro.fecha === 'hoy') {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
      if (new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(t)) !== hoy) return false;
    } else if (Date.now() - t > Number(filtro.fecha) * 86400000) return false;
  }
  return true;
}
const filtrar = lista => (lista || []).filter(pasa);
/* ---------- fechas ---------- */
const fFecha = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// «mié 25 nov 09:00»
const fecha = iso => iso ? fFecha.format(new Date(iso)).replace(/[.,]/g, '') : '';
function hace(iso) {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/* ---------- textos ---------- */
const corto = id => { const s = String(id ?? ''); return s.length > 8 ? '…' + s.slice(-6) : s; };
function lineaAccion(x) {
  const p = x.parametros || {};
  const que = ACCION[x.accion] || x.accion;
  const sobre = p.nombre ? `«${p.nombre}»` : p.ad_id ? corto(p.ad_id) : p.adset_id ? `(conjunto ${corto(p.adset_id)})` : '';
  const extra = x.accion === 'cambiar_presupuesto_conjunto' && p.presupuesto_diario ? ` a $${Number(p.presupuesto_diario).toLocaleString('es-CL')} diarios` : '';
  return `${esc(que)} ${esc(sobre)}${esc(extra)}`.trim();
}
function pista(error) {
  const e = String(error || '');
  if (/Faltan permisos de página|does not have permission/i.test(e)) return 'A la app de Meta le falta permiso de anunciante en la página del cliente. Reintentar no sirve hasta que se entregue ese permiso.';
  if (/Drive: File not found/i.test(e)) return 'El archivo de Drive no está compartido con la cuenta de servicio del agente. Compártelo y reintenta.';
  if (/WORKER_RESOURCE_LIMIT/i.test(e)) return 'Se lanzaron demasiadas cargas a la vez. Reintentar funciona: la bandeja las ejecuta de a dos.';
  if (/request limit|demasiadas llamadas/i.test(e)) return 'Meta limitó las llamadas de la cuenta. Espera unos minutos y reintenta.';
  if (/Sin respuesta tras 10 minutos/i.test(e)) return 'La ejecución no respondió. Revisa en Meta si alcanzó a hacerse antes de reintentar.';
  if (/Vuelve a intentarlo más tarde/i.test(e)) return 'Meta falló al crear el anuncio. Suele resolverse reintentando.';
  return '';
}
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const chip = celula => `<span class="chip c-${slug(celula)}">${esc(celula)}</span>`;
const plat = p => (!p || p === 'Otra') ? '' : `<span class="plat p-${slug(p)}">${esc(p)}</span>`;
function enlaces(lista) {
  const ok = (lista || []).filter(e => e && /^https:\/\//.test(e.u || ''));
  if (!ok.length) return '';
  return `<div class="enl">${ok.map(e => `<a href="${esc(e.u)}" target="_blank" rel="noopener noreferrer">${esc(e.t || 'Abrir')} ↗</a>`).join('')}</div>`;
}

/* ---------- tarjetas ---------- */
function botones(id, tipo) {
  const d = estado.datos;
  if (!d.puede_aprobar) return '<p class="solo">Solo Manuel puede decidir.</p>';
  const ab = estado.abierto;
  const mio = ab && ab.id === id;
  if (tipo === 'aprobacion') {
    if (mio && ab.modo === 'confirmar') return `<div class="acc"><button class="b ok" data-do="aprobar" data-id="${id}">Confirmar y ejecutar en Meta</button><button class="b" data-do="cerrar">Cancelar</button></div>`;
    if (mio && (ab.modo === 'cambios' || ab.modo === 'rechazar')) {
      const cambio = ab.modo === 'cambios';
      return `<div class="form"><label for="com-${id}">${cambio ? '¿Qué cambio necesitas?' : 'Motivo (opcional)'}</label>
        <textarea id="com-${id}" rows="2" placeholder="${cambio ? 'Ej.: usa el reel del viernes en vez de este' : 'Ej.: el evento ya pasó'}"></textarea>
        <div class="acc"><button class="b ${cambio ? 'dark' : 'no'}" data-do="${cambio ? 'cambios' : 'rechazar'}" data-id="${id}">${cambio ? 'Enviar cambio' : 'Rechazar'}</button><button class="b" data-do="cerrar">Cancelar</button></div></div>`;
    }
    return `<div class="acc"><button class="b ok" data-do="abrir" data-modo="confirmar" data-id="${id}">Aprobar</button><button class="b" data-do="abrir" data-modo="cambios" data-id="${id}">Pedir cambio</button><button class="b no-l" data-do="abrir" data-modo="rechazar" data-id="${id}">Rechazar</button></div>`;
  }
  return '';
}

function tarjetaAprobacion(a) {
  const pend = a.estado === 'pendiente';
  const acciones = a.al_aprobar || [];
  const directa = !acciones.length;
  const hara = pend ? (directa
    ? `<p class="hara-t">Al aprobar, el agente de ${esc(a.celula)} continúa en su próxima corrida.</p>`
    : `<div class="hara"><span class="eyebrow">Al aprobar se ejecuta en Meta</span><ul>${acciones.map(x => `<li>${lineaAccion(x)}</li>`).join('')}</ul></div>`) : '';
  let pie = '';
  if (pend) {
    // Sin acciones que ejecutar no hace falta el paso de confirmación.
    pie = directa && estado.datos.puede_aprobar && !(estado.abierto && estado.abierto.id === a.id)
      ? `<div class="acc"><button class="b ok" data-do="aprobar" data-id="${a.id}">Aprobar</button><button class="b" data-do="abrir" data-modo="cambios" data-id="${a.id}">Pedir cambio</button><button class="b no-l" data-do="abrir" data-modo="rechazar" data-id="${a.id}">Rechazar</button></div>`
      : botones(a.id, 'aprobacion');
  } else {
    const quien = a.decidida_por_nombre ? `${esc(a.decidida_por_nombre)} · ${fecha(a.decidida_at)}` : '';
    const hechas = (a.acciones || []).filter(x => !x.revisada);
    const listas = hechas.filter(x => x.estado === 'ejecutada').length;
    let linea = '';
    if (a.estado === 'ejecutando') linea = `Aprobada por ${quien}. Ejecutando en Meta: ${listas} de ${hechas.length} listas.`;
    else if (a.estado === 'aprobada') linea = `Aprobada por ${quien}. El agente de ${esc(a.celula)} la toma en su próxima corrida.`;
    else if (a.estado === 'cambios') linea = `Cambio pedido por ${quien}. Esperando al agente de ${esc(a.celula)}.`;
    else if (a.estado === 'ejecutada') linea = `Aprobada por ${quien}. Ejecutada${hechas.length ? ` (${listas} ${listas === 1 ? 'acción' : 'acciones'} en Meta)` : ''}.`;
    else if (a.estado === 'rechazada') linea = `Rechazada por ${quien}.`;
    else if (a.estado === 'vencida') linea = `Venció sin respuesta el ${fecha(a.vence_at)}.`;
    else if (a.estado === 'atendida') linea = a.decidida_por_nombre ? `Decidida por ${quien}. El agente de ${esc(a.celula)} ya la atendió.` : `El agente de ${esc(a.celula)} la cerró.`;
    else if (a.estado === 'error') linea = `Aprobada por ${quien}. Falló al ejecutar en Meta.`;
    const nota = a.resultado && typeof a.resultado.nota === 'string' ? `<p class="com">Agente: ${esc(a.resultado.nota)}</p>` : '';
    const com = (a.comentario ? `<p class="com">«${esc(a.comentario)}»</p>` : '') + nota;
    const filas = a.estado === 'error' || a.estado === 'ejecutando' ? `<ul class="subacc">${hechas.map(x => `
      <li class="s-${x.estado}"><span>${esc(ACCION[x.accion] || x.accion)} ${x.nombre ? '«' + esc(x.nombre) + '»' : esc(corto(x.ad_id))} · <b>${esc(ESTADO[x.estado] || x.estado)}</b>${x.error ? `<small>${esc(pista(x.error) || x.error)}</small>` : ''}</span>
      ${x.estado === 'error' && estado.datos.puede_aprobar ? `<span class="acc"><button class="b ok sm" data-do="reintentar" data-ids="${x.id}">Reintentar</button><button class="b sm" data-do="descartar" data-ids="${x.id}">Descartar</button></span>` : ''}</li>`).join('')}</ul>` : '';
    pie = `<p class="linea e-${a.estado}">${linea}</p>${com}${filas}`;
  }
  const vence = pend && a.vence_at ? ` · vence ${fecha(a.vence_at)}` : '';
  return `<article class="tj${pend ? ' viva' : ''}">
    <div class="tj-top">${avatar(a.cliente)}<b class="cli">${esc(a.cliente || 'General')}</b>${chip(a.celula)}${plat(platDe(a))}<span class="cuando" title="${esc(fecha(a.created_at))}">${hace(a.created_at)}${esc(vence)}</span></div>
    <h2>${esc(a.titulo)}</h2>
    ${a.detalle ? `<p class="det">${esc(a.detalle)}</p>` : ''}
    ${hara}${enlaces(a.enlaces)}
    <p class="por">Pedido por ${esc(a.solicitado_por)}</p>
    ${pie}
  </article>`;
}

function tarjetaSuelta(x) {
  const espera = x.estado === 'aprobada';
  const cab = `<div class="tj-top">${avatar(x.cliente)}<b class="cli">${esc(x.cliente || x.cuenta)}</b>${chip(tipoDe(x))}${plat('Meta')}<span class="cuando">${hace(x.created_at)}</span></div>
    <h2>${esc(ACCION[x.accion] || x.accion)}${x.nombre ? `: ${esc(x.nombre)}` : x.ad_id ? ` ${esc(corto(x.ad_id))}` : ''}</h2>`;
  const linea = espera
    ? `<p class="linea e-cambios">Aprobada el ${fecha(x.aprobada_at)} y nunca se ejecutó.</p>`
    : x.estado === 'ejecutando' ? '<p class="linea e-ejecutando">Ejecutando en Meta…</p>' : '<p class="linea">En espera de aprobación fuera de la bandeja.</p>';
  const acc = espera && estado.datos.puede_aprobar
    ? `<div class="acc"><button class="b ok" data-do="ejecutar" data-ids="${x.id}">Ejecutar ahora</button><button class="b no-l" data-do="descartar" data-ids="${x.id}">Descartar</button></div>` : '';
  return `<article class="tj">${cab}${x.mensaje ? `<p class="det clamp">${esc(x.mensaje)}</p>` : ''}${linea}
    <p class="por">${esc(x.aprobada_por || x.solicitado_por)}</p>${acc}</article>`;
}

// Errores que no se arreglan reintentando: primero hay que hacer algo fuera del panel.
function bloqueo(error) {
  const e = String(error || '');
  if (/Faltan permisos de página|does not have permission/i.test(e)) return 'Reintentar después de dar el permiso';
  if (/Drive: File not found/i.test(e)) return 'Reintentar después de compartir el archivo';
  return '';
}

function tarjetaError(g) {
  const x = g.ultima;
  const p = pista(x.error);
  const bl = bloqueo(x.error);
  const acc = estado.datos.puede_aprobar
    ? `<div class="acc"><button class="b ${bl ? '' : 'ok'}" data-do="reintentar" data-ids="${x.id}" data-otros="${g.ids.filter(i => i !== x.id).join(',')}">${bl || 'Reintentar'}</button><button class="b" data-do="descartar" data-ids="${g.ids.join(',')}">Descartar</button></div>` : '';
  return `<article class="tj err">
    <div class="tj-top">${avatar(x.cliente)}<b class="cli">${esc(x.cliente || x.cuenta)}</b>${chip(tipoDe(x))}${plat('Meta')}<span class="cuando">${hace(x.created_at)}${g.ids.length > 1 ? ` · ${g.ids.length} intentos` : ''}</span></div>
    <h2>${esc(ACCION[x.accion] || x.accion)}${x.nombre ? `: ${esc(x.nombre)}` : ''}</h2>
    ${p ? `<p class="det">${esc(p)}</p>` : ''}
    <details class="crudo"><summary>Ver el error original</summary><p>${esc(x.error)}</p></details>
    <p class="por">${esc(x.solicitado_por)}</p>${acc}</article>`;
}

function agruparErrores(lista) {
  const grupos = new Map();
  for (const x of lista) {
    const k = [x.cuenta, x.accion, x.nombre || '', x.adset_id || '', x.ad_id || ''].join('|');
    const g = grupos.get(k);
    if (!g) grupos.set(k, { ultima: x, ids: [x.id] });
    else { g.ids.push(x.id); if (x.created_at > g.ultima.created_at) g.ultima = x; }
  }
  return [...grupos.values()].sort((a, b) => b.ultima.created_at.localeCompare(a.ultima.created_at));
}

const vacio = (t, s) => `<div class="vacio"><b>${esc(t)}</b><span>${esc(s)}</span></div>`;
const titulo = (t, s) => `<h3 class="sec">${esc(t)}${s ? `<span>${esc(s)}</span>` : ''}</h3>`;

/* ---------- render ---------- */
function render() {
  const d = estado.datos;
  if (!d) return;
  pintarFiltros();
  const pend = filtrar(d.pendientes), curso = filtrar(d.en_curso), cursoSu = filtrar(d.acciones_en_curso);
  const errAp = filtrar(d.errores), hist = filtrar(d.historial), recientes = filtrar(d.acciones_recientes);
  const errores = agruparErrores(filtrar(d.acciones_error));
  const nP = pend.length, nC = curso.length + cursoSu.length, nE = errAp.length + errores.length;
  const nTotal = d.pendientes.length;
  $('n-pendientes').textContent = nP; $('n-curso').textContent = nC; $('n-errores').textContent = nE;
  $('n-pendientes').classList.toggle('hay', nP > 0); $('n-errores').classList.toggle('hay', nE > 0);
  document.title = `${nTotal ? `(${nTotal}) ` : ''}Bandeja · Panel Células`;
  $('sub').textContent = nTotal
    ? `${nTotal === 1 ? 'Hay 1 decisión esperándote' : `Hay ${nTotal} decisiones esperándote`}${hayFiltro() ? ` (${nP} con estos filtros)` : ''}.`
    : 'No hay nada esperando tu decisión.';
  document.querySelectorAll('#tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === estado.tab)));

  let h = '';
  if (estado.tab === 'pendientes') {
    h = nP ? pend.map(tarjetaAprobacion).join('') : (hayFiltro() ? vacio('Nada con estos filtros', 'Prueba con otro cliente o quita los filtros.') : vacio('Bandeja al día', 'Cuando un agente necesite tu decisión, aparece aquí.'));
  } else if (estado.tab === 'curso') {
    if (!nC) h = vacio('Nada en curso', 'Lo que apruebes se ejecuta al momento y pasa al historial.');
    else {
      if (curso.length) h += curso.map(tarjetaAprobacion).join('');
      if (cursoSu.length) h += titulo('Aprobadas fuera de la bandeja', 'Quedaron sin ejecutar') + cursoSu.map(tarjetaSuelta).join('');
    }
  } else if (estado.tab === 'errores') {
    if (!nE) h = vacio('Sin errores', 'Si una acción falla en Meta, queda aquí para reintentarla.');
    else h = errAp.map(tarjetaAprobacion).join('') + errores.map(tarjetaError).join('');
  } else {
    h = titulo('Decisiones', 'Últimos 90 días') + (hist.length ? hist.map(tarjetaAprobacion).join('') : vacio('Sin decisiones', hayFiltro() ? 'No hay decisiones con estos filtros.' : 'Lo que apruebes o rechaces queda registrado aquí.'));
    if (recientes.length) {
      h += titulo('Últimas acciones en Meta', 'Hechas por los agentes') + `<div class="tabla"><table><thead><tr><th>Cuándo</th><th>Cliente</th><th>Acción</th><th>Aprobó</th></tr></thead><tbody>${
        recientes.map(x => `<tr><td class="num">${esc(fecha(x.ejecutada_at))}</td><td><span class="celda-cli">${avatar(x.cliente, 'xs')}${esc(x.cliente || x.cuenta)}</span></td><td>${esc(ACCION[x.accion] || x.accion)}${x.nombre ? `<small>${esc(x.nombre)}</small>` : ''}</td><td><small>${esc(x.aprobada_por || '')}</small></td></tr>`).join('')
      }</tbody></table></div>`;
    }
  }
  $('lista').innerHTML = h;
  const campo = estado.abierto && document.getElementById('com-' + estado.abierto.id);
  if (campo) campo.focus();
}

function hayFiltro() { return !!(filtro.cliente || filtro.tipo || filtro.plat || filtro.fecha); }

function pintarFiltros() {
  const d = estado.datos;
  // Clientes: los activos de Noise más cualquiera que aparezca en la Bandeja.
  const todos = [...(d.pendientes || []), ...(d.en_curso || []), ...(d.errores || []), ...(d.historial || []),
    ...(d.acciones_en_curso || []), ...(d.acciones_error || []), ...(d.acciones_recientes || [])];
  const mapa = new Map();
  for (const c of d.clientes || []) mapa.set(claveCliente(c.nombre), { nombre: c.nombre, pend: 0 });
  for (const x of todos) {
    const k = claveCliente(x.cliente || x.cuenta); if (!k) continue;
    if (!mapa.has(k)) mapa.set(k, { nombre: x.cliente || x.cuenta, pend: 0 });
  }
  for (const x of d.pendientes || []) { const k = claveCliente(x.cliente); if (mapa.has(k)) mapa.get(k).pend++; }
  const lista = [...mapa.values()].sort((a, b) => b.pend - a.pend || a.nombre.localeCompare(b.nombre, 'es'));
  $('clientes').innerHTML = chipsClientes(lista.map(c => ({ nombre: c.nombre, n: c.pend })), filtro.cliente, d.pendientes.length);
  // Tipos presentes
  const tipos = [...new Set(todos.map(tipoDe))].sort((a, b) => a.localeCompare(b, 'es'));
  const sel = $('f-tipo'), actual = filtro.tipo;
  sel.innerHTML = '<option value="">Todos</option>' + tipos.map(t => `<option${t === actual ? ' selected' : ''}>${esc(t)}</option>`).join('');
  $('f-plat').value = filtro.plat; $('f-fecha').value = filtro.fecha;
  $('f-limpiar').hidden = !hayFiltro();
}

function aviso(texto, tipo) {
  const el = $('aviso');
  el.textContent = texto || ''; el.hidden = !texto; el.className = 'aviso' + (tipo ? ' ' + tipo : '');
}

/* ---------- datos ---------- */
async function cargar(silencioso) {
  const { data, error } = await sb.rpc('bandeja');
  if (error) {
    $('vivo').className = 'vivo mal'; $('vivo').textContent = 'Sin conexión';
    if (!silencioso) aviso('No se pudo cargar la bandeja. ' + (error.message || ''), 'mal');
    return;
  }
  estado.datos = data;
  usarClientes(data.clientes);
  $('vivo').className = 'vivo bien'; $('vivo').textContent = 'En vivo · ' + fHora.format(new Date());
  // No redibujar mientras hay un formulario abierto, para no borrar lo que se está escribiendo.
  if (!estado.abierto || !silencioso) render();
}

async function ejecutar(fn, args, exito) {
  if (estado.ocupado) return;
  estado.ocupado = true; document.body.classList.add('ocupado');
  const { error } = await sb.rpc(fn, args);
  estado.ocupado = false; document.body.classList.remove('ocupado');
  estado.abierto = null;
  if (error) aviso(error.message || 'No se pudo completar.', 'mal'); else aviso(exito, 'bien');
  await cargar(false);
  actualizarContadores();
  if (!error) setTimeout(() => cargar(true), 6000);
}

/* ---------- eventos ---------- */
$('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('[role=tab]'); if (!b) return;
  estado.tab = b.dataset.t; estado.abierto = null; aviso(''); render();
});
$('lista').addEventListener('click', async ev => {
  const b = ev.target.closest('button[data-do]'); if (!b) return;
  const hacer = b.dataset.do, id = b.dataset.id;
  if (hacer === 'abrir') { estado.abierto = { id, modo: b.dataset.modo }; aviso(''); return render(); }
  if (hacer === 'cerrar') { estado.abierto = null; return render(); }
  if (hacer === 'aprobar') return ejecutar('bandeja_decidir', { p_id: id, p_decision: 'aprobar' }, 'Aprobada. Si hay acciones en Meta, se están ejecutando.');
  if (hacer === 'rechazar' || hacer === 'cambios') {
    const com = (document.getElementById('com-' + id)?.value || '').trim();
    if (hacer === 'cambios' && !com) return aviso('Escribe qué cambio necesitas.', 'mal');
    return ejecutar('bandeja_decidir', { p_id: id, p_decision: hacer, p_comentario: com || null }, hacer === 'cambios' ? 'Cambio enviado al agente.' : 'Rechazada.');
  }
  const ids = (b.dataset.ids || '').split(',').filter(Boolean);
  if (hacer === 'ejecutar') return ejecutar('bandeja_accion', { p_id: ids[0], p_que: 'ejecutar' }, 'Enviada a ejecutar en Meta.');
  if (hacer === 'reintentar') {
    // Los intentos anteriores del mismo anuncio se descartan para que no reaparezcan.
    for (const otro of (b.dataset.otros || '').split(',').filter(Boolean)) await sb.rpc('bandeja_accion', { p_id: otro, p_que: 'descartar' });
    return ejecutar('bandeja_accion', { p_id: ids[0], p_que: 'reintentar' }, 'Reintento enviado a Meta.');
  }
  if (hacer === 'descartar') {
    for (const otro of ids.slice(1)) await sb.rpc('bandeja_accion', { p_id: otro, p_que: 'descartar' });
    return ejecutar('bandeja_accion', { p_id: ids[0], p_que: 'descartar' }, 'Descartada.');
  }
});
$('salir').addEventListener('click', salir);
$('clientes').addEventListener('click', ev => {
  const b = ev.target.closest('[data-cli]'); if (!b) return;
  filtro.cliente = filtro.cliente === b.dataset.cli ? '' : b.dataset.cli; guardarFiltros(); estado.abierto = null; render();
});
for (const [id, k] of [['f-tipo', 'tipo'], ['f-plat', 'plat'], ['f-fecha', 'fecha']]) {
  $(id).addEventListener('change', ev => { filtro[k] = ev.target.value; guardarFiltros(); estado.abierto = null; render(); });
}
$('f-limpiar').addEventListener('click', () => {
  Object.assign(filtro, { cliente: '', tipo: '', plat: '', fecha: '' }); guardarFiltros(); render();
});

/* ---------- inicio ---------- */
estado.usuario = await exigirSesion();
pintarRiel('bandeja');
await cargar(false);
{ // Enlace directo desde Células: /bandeja?cliente=Alimor
  const p = new URLSearchParams(location.search).get('cliente');
  if (p && estado.datos) { filtro.cliente = claveCliente(p); guardarFiltros(); history.replaceState(null, '', '/bandeja'); render(); }
}
setInterval(() => { if (!document.hidden) cargar(true); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(true); });

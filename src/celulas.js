// Panel Células: células, clientes, calendario Meta Timing y memoria.
// Los datos vienen del espejo de Notion en Supabase (función celulas-sync, cada minuto).
// Si el espejo aún está vacío se muestran los datos guardados (SNAP_*).
import './acceso.css';
import './celulas.css';
import { sb, exigirSesion } from './lib/acceso.js';
import { actualizarContadores } from './lib/riel.js';
import { usarClientes, claveCliente } from './lib/clientes.js';

await exigirSesion();
actualizarContadores();
setInterval(() => { if (!document.hidden) actualizarContadores(); }, 30000);
// Tareas y decisiones pendientes por cliente, para la tabla «Clientes · etapa y estado».
let PORCLI = { tareas: [], decisiones: [] };
async function cargarPorCliente() {
  const [pc, emp] = await Promise.all([sb.rpc('panel_por_cliente'), sb.from('companies').select('name').eq('status', 'activo')]);
  if (pc.data) PORCLI = pc.data;
  usarClientes((emp.data || []).map(e => ({ nombre: e.name })));
}
function pendientesDe(c) {
  const k = claveCliente(c);
  const t = PORCLI.tareas.filter(x => claveCliente(x.cliente) === k).reduce((s, x) => ({ n: s.n + x.abiertas, a: s.a + x.atrasadas }), { n: 0, a: 0 });
  const d = PORCLI.decisiones.filter(x => claveCliente(x.cliente) === k).reduce((s, x) => s + x.n, 0);
  const q = encodeURIComponent(c);
  return (t.n ? `<span class="pc-link pill ${t.a ? 'warn' : 'todo'}" data-href="/?cliente=${q}" title="Ver tareas de ${c}${t.a ? ` (${t.a} atrasada${t.a === 1 ? '' : 's'})` : ''}">${t.n} tarea${t.n === 1 ? '' : 's'}</span>` : '')
    + (d ? `<span class="pc-link pill wip" data-href="/bandeja?cliente=${q}" title="Ver decisiones de ${c}">${d} decisión${d === 1 ? '' : 'es'}</span>` : '');
}
document.addEventListener('click', ev => { const l = ev.target.closest('.pc-link'); if (l) { ev.stopPropagation(); ev.preventDefault(); location.href = l.dataset.href; } }, true);
await cargarPorCliente();
setInterval(() => { if (!document.hidden) cargarPorCliente().then(() => { try { renderClients(); } catch { /* aún sin datos */ } }); }, 60000);
(function(){
const CHK_URL='https://app.notion.com/p/c43bce045b8e47efa1c47d4731ea5def';
const CLIENTS=['Alimor','Carillon','Donem','Krat','Mejac','Ventanas 2001','Kinebaric','Mamba Sport','Siosip'];
const waiting=i=>/esperando/i.test(i['Siguiente acción']||'');
const ORDER=['Operaciones','Planificación','Producción','Pauta','Reportes','Ventas','Marketing','Finanzas','Personal'];

/* Respaldo: estado guardado al publicar (12-nov-2026). Se reemplaza con Notion en vivo. */
const SNAP_CEL=[
 {Nombre:'Operaciones',Tipo:'Célula',Célula:'Operaciones',Estado:'Piloto',Avance:.45,Modelo:'Por definir','Siguiente paso':'Borradores de correo por hito; pasar el aviso diario a código'},
 {Nombre:'Planificación',Tipo:'Célula',Célula:'Planificación',Estado:'Piloto',Avance:.4,Modelo:'Por definir','Siguiente paso':'Que el agente escriba directo en Notion siguiendo el protocolo'},
 {Nombre:'Producción de anuncios',Tipo:'Célula',Célula:'Producción',Estado:'Por construir',Avance:.1,Modelo:'Por definir','Siguiente paso':'Piloto de un mes con Alimor'},
 {Nombre:'Pauta',Tipo:'Célula',Célula:'Pauta',Estado:'Piloto',Avance:.6,Modelo:'Por definir','Siguiente paso':'Videos y carruseles; Google Ads después'},
 {Nombre:'Reportes',Tipo:'Célula',Célula:'Reportes',Estado:'Por construir',Avance:.05,Modelo:'Por definir','Siguiente paso':'Definir la meta de cada cliente'},
 {Nombre:'Ventas',Tipo:'Célula',Célula:'Ventas',Estado:'Por construir',Avance:.1,Modelo:'Por definir','Siguiente paso':'Cotizaciones con registro en Notion y proceso de propuestas'},
 {Nombre:'Marketing',Tipo:'Célula',Célula:'Marketing',Estado:'Por construir',Avance:0,Modelo:'Por definir','Siguiente paso':'ADN de Boombap como marca'},
 {Nombre:'Finanzas',Tipo:'Célula',Célula:'Finanzas',Estado:'Por construir',Avance:0,Modelo:'Por definir','Siguiente paso':'Calendario de facturación y cobranza'},
 {Nombre:'Personal (Dueño)',Tipo:'Célula',Célula:'Personal',Estado:'Piloto',Avance:.3,Modelo:'Opus','Siguiente paso':'Radar diario activo'},
 {Nombre:'Radar del dueño',Tipo:'Automatización',Célula:'Personal',Estado:'Activa',Avance:1,'Siguiente paso':'Lunes a viernes 7:52 por Slack'},
 {Nombre:'Aviso diario del ciclo',Tipo:'Automatización',Célula:'Operaciones',Estado:'Activa',Avance:1,'Siguiente paso':'Pasar a código en NOISE (sin modelo)'},
 {Nombre:'Reporte diario Ads',Tipo:'Automatización',Célula:'Pauta',Estado:'Activa',Avance:.8,'Siguiente paso':'Pasarlo a la nube para que no dependa del Mac'},
 {Nombre:'Sincronización Meta (Noise Ads Sync)',Tipo:'Automatización',Célula:'Pauta',Estado:'Activa',Avance:1,'Siguiente paso':'Seis cuentas sincronizadas, Alimor incluida'},
 {Nombre:'Boost IG clientes (lunes y miércoles)',Tipo:'Automatización',Célula:'Pauta',Estado:'Activa',Avance:1,'Siguiente paso':'Mejac, Ventanas 2001 y Alimor; primera ronda conjunta el lunes 16-nov'},
 {Nombre:'ADN de clientes',Tipo:'Base común',Estado:'Piloto',Avance:.78,'Siguiente paso':'Listos 7 de 9. Kinebaric y Mamba Sport esperan info del cliente.'},
 {Nombre:'Memoria compartida y conversaciones por célula',Tipo:'Base común',Estado:'Activa',Avance:1,'Siguiente paso':'Abrir las seis conversaciones y anotar su modelo.'},
 {Nombre:'Proyectos por cliente en Claude',Tipo:'Base común',Estado:'Piloto',Avance:.17,'Siguiente paso':'Donem creado. Replicar en el resto de las cuentas.'},
 {Nombre:'Meta Timing y protocolo de agentes',Tipo:'Base común',Estado:'Activa',Avance:1,'Siguiente paso':'Cargar cada ciclo nuevo al inicio de mes.'}
];
const SNAP_MEM=[
 {Entrada:'ADN de Donem creado',Tipo:'Cambio',Desde:'Manuel',Para:['Todas'],Cliente:['Donem'],Estado:'Resuelto',Fecha:'2026-11-12'},
 {Entrada:'El cliente no revisa el planificador; solo aprueba la presentación de anuncios',Tipo:'Decisión',Desde:'Manuel',Para:['Todas'],Cliente:['General'],Estado:'Resuelto',Fecha:'2026-11-12'},
 {Entrada:'Ciclo de noviembre de Carillon y Donem reprogramado por atraso',Tipo:'Decisión',Desde:'Manuel',Para:['Operaciones','Producción','Pauta'],Cliente:['Carillon','Donem'],Estado:'Resuelto',Fecha:'2026-11-12'},
 {Entrada:'Producción: subir reels y carruseles Mes 28 de Mejac a Drive con nombre claro',Tipo:'Pedido',Desde:'Pauta',Para:['Producción'],Cliente:['Mejac'],Estado:'Abierto',Fecha:'2026-11-11'},
 {Entrada:'Reportes: definir la meta de cada cliente en su ADN',Tipo:'Pedido',Desde:'Manuel',Para:['Reportes','Planificación'],Cliente:['General'],Estado:'Abierto',Fecha:'2026-11-11'},
 {Entrada:'Boost IG rotativo lunes y miércoles, en el canal de cada cliente',Tipo:'Decisión',Desde:'Pauta',Para:['Todas'],Cliente:['Mejac'],Estado:'Resuelto',Fecha:'2026-11-11'}
];

const SNAP_CHK=[{"Ítem": "Prompt inicial de la célula", "Célula": "Operaciones", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Meta Timing con ciclo D-15 → D", "Célula": "Operaciones", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 2}, {"Ítem": "Aviso diario del ciclo en Slack", "Célula": "Operaciones", "Grupo": "Automatización", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 3}, {"Ítem": "Ciclo de diciembre cargado (6 cuentas)", "Célula": "Operaciones", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 4}, {"Ítem": "Conversación «Operaciones | Boombap Agentes» abierta", "Célula": "Operaciones", "Grupo": "Base", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Abrirla con el prompt inicial y anotar el modelo en la fila de la célula", "Orden": 5}, {"Ítem": "Borradores de correo por hito", "Célula": "Operaciones", "Grupo": "Automatización", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Generar borrador en Gmail al vencer Solicitud de información (D-15) y Presentación (D-4)", "Orden": 6}, {"Ítem": "Aviso diario pasado a código en NOISE", "Célula": "Operaciones", "Grupo": "Automatización", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Mover la lógica del aviso a NOISE sin modelo", "Orden": 7}, {"Ítem": "Ciclo de enero cargado en Meta Timing", "Célula": "Operaciones", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Cargar hitos de enero antes del 1 de diciembre", "Orden": 8}, {"Ítem": "Prompt inicial de la célula", "Célula": "Planificación", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Persuasion Taxonomy conectado", "Célula": "Planificación", "Grupo": "Conexión", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 2}, {"Ítem": "ADN Alimor", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Alimor", "Estado": "Listo", "Siguiente acción": "", "Orden": 3}, {"Ítem": "ADN Donem", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Donem", "Estado": "Listo", "Siguiente acción": "", "Orden": 4}, {"Ítem": "ADN Carillon", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Carillon", "Estado": "Listo", "Siguiente acción": "Armar desde Drive, Gmail y planificadores Mes 57; mismo formato que Donem", "Orden": 5}, {"Ítem": "ADN Krat", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Krat", "Estado": "Listo", "Siguiente acción": "Armar con foco en leads inmobiliarios (Alaia) y Google Ads", "Orden": 6}, {"Ítem": "ADN Mejac", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Mejac", "Estado": "Listo", "Siguiente acción": "Armar desde planificadores y Boost IG", "Orden": 7}, {"Ítem": "ADN Ventanas 2001", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Ventanas 2001", "Estado": "Listo", "Siguiente acción": "Armar desde Drive y planificadores", "Orden": 8}, {"Ítem": "Proyecto Claude Donem", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Donem", "Estado": "Listo", "Siguiente acción": "", "Orden": 9}, {"Ítem": "Proyecto Claude Alimor", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Alimor", "Estado": "Falta", "Siguiente acción": "Crear proyecto con el prompt del ADN", "Orden": 10}, {"Ítem": "Proyecto Claude Carillon", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Carillon", "Estado": "Falta", "Siguiente acción": "Después del ADN Carillon", "Orden": 11}, {"Ítem": "Proyecto Claude Krat", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Krat", "Estado": "Falta", "Siguiente acción": "Después del ADN Krat", "Orden": 12}, {"Ítem": "Proyecto Claude Mejac", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Mejac", "Estado": "Falta", "Siguiente acción": "Después del ADN Mejac", "Orden": 13}, {"Ítem": "Proyecto Claude Ventanas 2001", "Célula": "Planificación", "Grupo": "Proyecto Claude", "Cliente": "Ventanas 2001", "Estado": "Falta", "Siguiente acción": "Después del ADN Ventanas 2001", "Orden": 14}, {"Ítem": "Agente escribe el planificador directo en Notion", "Célula": "Planificación", "Grupo": "Proceso", "Cliente": "General", "Estado": "En curso", "Siguiente acción": "Probarlo con Donem Mes 38 y luego replicar", "Orden": 15}, {"Ítem": "Meta de cada cliente en su ADN", "Célula": "Planificación", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Definir objetivo y KPI por cuenta junto con Reportes", "Orden": 16}, {"Ítem": "Prompt inicial de la célula", "Célula": "Producción", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Magnific conectado", "Célula": "Producción", "Grupo": "Conexión", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 2}, {"Ítem": "Comentarios por slide en la presentación", "Célula": "Producción", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 3}, {"Ítem": "Copies del slide desde Notion", "Célula": "Producción", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 4}, {"Ítem": "Convención de nombres y carpeta del mes en Drive", "Célula": "Producción", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Definir nombre estándar (Cliente_Mes_AD#_formato) y aplicarlo a Mejac Mes 28", "Orden": 5}, {"Ítem": "Checklist de formatos 9:16 (D-2 y D-1)", "Célula": "Producción", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Lista de piezas que requieren versión vertical por mes", "Orden": 6}, {"Ítem": "Piloto de un mes con Alimor", "Célula": "Producción", "Grupo": "Proceso", "Cliente": "Alimor", "Estado": "Falta", "Siguiente acción": "Producir el mes completo con la célula y medir horas", "Orden": 7}, {"Ítem": "Prompt inicial de la célula", "Célula": "Pauta", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Sincronización Meta (Noise Ads Sync)", "Célula": "Pauta", "Grupo": "Automatización", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 2}, {"Ítem": "Boost IG Mejac (lunes y miércoles)", "Célula": "Pauta", "Grupo": "Automatización", "Cliente": "Mejac", "Estado": "Listo", "Siguiente acción": "", "Orden": 3}, {"Ítem": "Reporte diario Ads en la nube", "Célula": "Pauta", "Grupo": "Automatización", "Cliente": "General", "Estado": "En curso", "Siguiente acción": "Sacarlo del Mac para que corra sin depender del equipo", "Orden": 4}, {"Ítem": "Alimor en la sincronización Meta", "Célula": "Pauta", "Grupo": "Conexión", "Cliente": "Alimor", "Estado": "Listo", "Siguiente acción": "Agregar la cuenta publicitaria de Alimor al Sync", "Orden": 5}, {"Ítem": "Boost IG en más cuentas", "Célula": "Pauta", "Grupo": "Automatización", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "Activar en una segunda cuenta usando su propio canal", "Orden": 6}, {"Ítem": "Carga de videos y carruseles", "Célula": "Pauta", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Que el agente cree anuncios de video y carrusel en pausa", "Orden": 7}, {"Ítem": "Google Ads", "Célula": "Pauta", "Grupo": "Conexión", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Conectar lectura de campañas PMax (Carillon, Donem, Krat)", "Orden": 8}, {"Ítem": "Prompt inicial de la célula", "Célula": "Reportes", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Meta de cada cliente", "Célula": "Reportes", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Definir con Planificación el objetivo por cuenta", "Orden": 2}, {"Ítem": "Plantilla de reporte mensual", "Célula": "Reportes", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Una página por cliente: inversión, resultados, meta, próximo mes", "Orden": 3}, {"Ítem": "Datos automáticos desde NOISE", "Célula": "Reportes", "Grupo": "Automatización", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Leer métricas del Sync para armar el reporte", "Orden": 4}, {"Ítem": "Prompt inicial de la célula", "Célula": "Ventas", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Leads del CDN cargados en NOISE", "Célula": "Ventas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Cargar la lista y asignar estado", "Orden": 2}, {"Ítem": "Seguimiento de propuestas abiertas", "Célula": "Ventas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Mindgym, Mamba Sport, CDV Dental y Bodega Online con fecha de próximo contacto", "Orden": 3}, {"Ítem": "Plantilla de propuesta para leads", "Célula": "Ventas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "Modelo base: Propuesta Plan Marketing (Alimor, Bodega Online, Mindgym)", "Orden": 4}, {"Ítem": "ADN Kinebaric", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Kinebaric", "Estado": "En curso", "Siguiente acción": "Onboarding: esperando la información del cliente. Alcance: Meta, 4 anuncios.", "Orden": 8.1}, {"Ítem": "ADN Mamba Sport", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Mamba Sport", "Estado": "En curso", "Siguiente acción": "Esperando la información del cliente. Alcance: solo Google Ads.", "Orden": 8.2}, {"Ítem": "ADN Siosip", "Célula": "Planificación", "Grupo": "ADN", "Cliente": "Siosip", "Estado": "Listo", "Siguiente acción": "Armar ADN enfocado solo en Google Ads (sin planificador mensual).", "Orden": 8.3}, {"Ítem": "Optimización de campañas D y D+10 (rutina)", "Célula": "Pauta", "Grupo": "Automatización", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 4.5}, {"Ítem": "Escritura en Carillon, Donem y Krat", "Célula": "Pauta", "Grupo": "Conexión", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 5.5}, {"Ítem": "Base de cotizaciones en Notion (registro de todas)", "Célula": "Ventas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "Crear base con N°, cliente, servicio, monto, estado, fecha y enlace a la hoja", "Orden": 5}, {"Ítem": "Cotización en minutos desde plantilla", "Célula": "Ventas", "Grupo": "Automatización", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "El agente copia la hoja modelo, llena ítems y deja borrador en Gmail", "Orden": 6}, {"Ítem": "Proceso de creación de propuestas para leads", "Célula": "Ventas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Brief → diagnóstico → propuesta en Slides → revisión → envío → seguimiento", "Orden": 7}, {"Ítem": "Proceso de onboarding ordenado", "Célula": "Operaciones", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Unir Solicitud de información, Guía de Drive, Setup checklist y ADN en una secuencia", "Orden": 9}, {"Ítem": "Prompt inicial de la célula", "Célula": "Marketing", "Grupo": "Base", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Definir alcance: marketing propio de Boombap", "Orden": 1}, {"Ítem": "ADN de Boombap como marca", "Célula": "Marketing", "Grupo": "ADN", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Ficha de marca, servicios, casos y tono", "Orden": 2}, {"Ítem": "Planificador mensual de contenido Boombap", "Célula": "Marketing", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Boombap como cliente número uno", "Orden": 3}, {"Ítem": "Casos de éxito con resultados", "Célula": "Marketing", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Uno por cliente activo con datos de Reportes", "Orden": 4}, {"Ítem": "Prompt inicial de la célula", "Célula": "Finanzas", "Grupo": "Base", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Alcance: facturación, cobranza, pagos de pauta y flujo de caja", "Orden": 1}, {"Ítem": "Calendario de facturación y cobranza", "Célula": "Finanzas", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Fee y fecha de factura por cliente desde cada ADN", "Orden": 2}, {"Ítem": "Registro de ingresos y gastos en Notion", "Célula": "Finanzas", "Grupo": "Conexión", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Usar el registro financiero existente en Notion", "Orden": 3}, {"Ítem": "Resumen financiero mensual", "Célula": "Finanzas", "Grupo": "Automatización", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Ingresos por cliente, pendientes de cobro, gastos y margen", "Orden": 4}, {"Ítem": "Prompt inicial del agente personal", "Célula": "Personal", "Grupo": "Base", "Cliente": "General", "Estado": "Listo", "Siguiente acción": "", "Orden": 1}, {"Ítem": "Radar diario del dueño (noticias, IA, plataformas)", "Célula": "Personal", "Grupo": "Automatización", "Cliente": "General", "Estado": "En curso", "Siguiente acción": "Ajustar fuentes y temas después de la primera semana", "Orden": 2}, {"Ítem": "Plan de capacitación con videos y cursos", "Célula": "Personal", "Grupo": "Proceso", "Cliente": "General", "Estado": "Falta", "Siguiente acción": "Lista viva de cursos y videos, con lo visto y lo pendiente", "Orden": 3}];
let CEL=SNAP_CEL, MEM=SNAP_MEM, CHK=SNAP_CHK, sel=null, jump=false, view=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:(typeof v==='string'&&v.startsWith('[')?(()=>{try{return JSON.parse(v)}catch(e){return [v]}})():(v?[v]:[]));
const num=v=>{const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?Math.max(0,Math.min(1,n>1?n/100:n)):0};
const cls=e=>e==='Activa'?'ok':e==='Piloto'?'wip':'todo';
const pct=v=>Math.round(num(v)*100)+'%';
const ck=it=>{const L=it.filter(i=>i.Estado==='Listo').length,W=it.filter(i=>i.Estado==='En curso').length;return {L,W,F:it.length-L-W,n:it.length,v:it.length?(L+W*.5)/it.length:0}};
const stc=e=>e==='Listo'?'ok':e==='En curso'?'wip':'todo';

/* mapa: células (izq.) → memoria (centro) → plataformas (der.) */
const NS='http://www.w3.org/2000/svg';
const FICHA={
 Operaciones:{t:'Operaciones',i:'⚙️',tag:'Mantiene el ciclo mensual de cada cliente a tiempo.',fn:['Carga y vigila Meta Timing (D-15 → D+10)','Aviso diario del ciclo en #boombap','Onboarding de clientes nuevos','Borradores de correo por hito'],out:'Hitos al día y avisos claros a cada responsable',ask:'«¿Qué está atrasado esta semana?»'},
 'Planificación':{t:'Planificación',i:'🧭',tag:'Convierte el ADN de cada cliente en el planificador del mes.',fn:['Mantiene el ADN de cada cliente','Escribe el planificador en Notion','Copies y titulares con Persuasion Taxonomy','Metas y KPI por cuenta'],out:'Planificador listo en D-8',ask:'«Arma el planificador de Mejac Mes 29»'},
 'Producción':{t:'Producción',i:'🎨',tag:'Del planificador a piezas listas para presentar.',fn:['Fila de diseño de Rocío: una cuenta a la vez (Donem → Alimor → Krat → Mejac → Ventanas → Carillon)','Imágenes y video con IA (Magnific)','Presentación de anuncios en Slides','Versiones 9:16 y carga a Drive'],out:'Piezas aprobadas en Drive en D-1',ask:'«Genera 3 variantes del AD-03 de Alimor»'},
 Pauta:{t:'Pauta',i:'📈',tag:'Activa, optimiza y cuida las campañas en Meta y Google.',fn:['Activación en D con 3 anuncios + los con fecha','Optimización D+10: pausar, mantener, cargar','Boost IG lunes y miércoles','Alerta de piezas con fecha','Checklist de Google Ads'],out:'Propuestas en Slack que aplicas con un ✅',ask:'«¿Qué anuncios pausarías hoy en Ventanas?»'},
 Reportes:{t:'Reportes',i:'📊',tag:'Muestra a cada cliente qué logró su inversión.',fn:['Lee el reporte en tiempo real de Looker Studio que ve el cliente','Cierre de ciclo: resultados contra los objetivos y score de salud','Cruza con Noise y la Bitácora: qué cambió y por qué','Insumos para el próximo planificador y casos de éxito'],out:'Una página por cliente al cierre de mes',ask:'«Resume el mes de Donem»'},
 Ventas:{t:'Ventas',i:'🤝',tag:'Cotiza rápido, propone bien y hace seguimiento.',fn:['Cotizaciones desde la plantilla en minutos','Registro de cada cotización en Notion','Propuestas para leads desde el modelo','Seguimiento de propuestas abiertas','Leads del CDN en Noise'],out:'Cotización o propuesta como borrador listo para enviar',ask:'«Cotiza 8 anuncios Meta para Kinebaric»'},
 Marketing:{t:'Marketing',i:'📣',tag:'Hace con Boombap lo mismo que hace con sus clientes.',fn:['ADN de Boombap como marca','Planificador mensual propio','Casos de éxito con resultados','Contenido para redes y web'],out:'Boombap con su propio ciclo mensual',ask:'«Propón 4 posts de Boombap para diciembre»'},
 Finanzas:{t:'Finanzas',i:'💼',tag:'Factura a tiempo, cobra y sabe cuánto queda.',fn:['Calendario de facturación por cliente','Aviso de facturas por cobrar','Pagos de pauta y gastos','Resumen financiero mensual'],out:'Saber cada mes qué entra, qué falta y el margen',ask:'«¿Qué facturas faltan por cobrar?»'},
 Personal:{t:'Personal · Dueño',i:'🧑‍💼',tag:'Te mantiene al día para que decidas mejor.',fn:['Radar diario: plataformas, IA y Chile','Videos y cursos recomendados','Novedades de Meta, Google y modelos de IA','Una recomendación accionable al día'],out:'Mensaje directo en Slack de lunes a viernes 7:52',ask:'«¿Qué cambió esta semana en Meta Ads?»'}
};
const TEAM={Operaciones:[['Agente Operaciones (conversación)','Aviso diario del ciclo · L–V 8:11'],['Manuel','Carolina']],'Planificación':[['Agente Planificación (conversación)'],['Carolina','Manuel']],'Producción':[['Agente Producción (Magnific y Slides)'],['Rocío']],Pauta:[['Agente Pauta (conversación)','Pauta D / D+10 · L–V 9:37 y 15:37','Boost IG · lun y mié'],['Manuel']],Reportes:[['Agente Reportes (por construir)'],['Manuel']],Ventas:[['Agente Ventas: cotizaciones y propuestas'],['Manuel']],Marketing:[['Agente Marketing (por construir)'],['Manuel','Carolina','Rocío']],Finanzas:[['Agente Finanzas (por construir)'],['Manuel']],Personal:[['Radar del dueño · L–V 7:52'],['Manuel']]};
const ICO={
 Operaciones:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
 'Planificación':'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
 'Producción':'<path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M13.5 7.5l3 3M15 4l5 5"/>',
 Pauta:'<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/><path d="M3 21h18"/>',
 Reportes:'<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>',
 Ventas:'<path d="M3 12l9-9h7v7l-9 9z"/><circle cx="15.5" cy="8.5" r="1.4"/><path d="M8 13l3 3"/>',
 Marketing:'<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.5 9a4 4 0 010 6M20 6.5a7.5 7.5 0 010 11"/>',
 Finanzas:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
 Personal:'<circle cx="12" cy="12" r="2"/><path d="M12 12l6-6"/><path d="M5.6 18.4A9 9 0 1121 12"/><path d="M8.5 15.5A5 5 0 1117 12"/>'
};
const MARKSRC=(document.querySelector('.rail-in .logo img')||{}).src||'';
const icoSvg=(c,sz)=>`<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[c]||''}</svg>`;
const TINT={Operaciones:['#e4f1e8','#1f7a4f'],'Planificación':['#f7f0d6','#8a6a00'],'Producción':['#fbe7da','#b5501d'],Pauta:['#fde4ea','#c8173f'],Reportes:['#e2ecf9','#1f5fae'],Ventas:['#fbe2ef','#b0246b'],Marketing:['#ece6fb','#5b3cc4'],Finanzas:['#efe9df','#7a5a2e'],Personal:['#e9edf1','#3d4a57']};
function mediaHTML(c,big){const t=TINT[c]||['#f1f1ee','#2b2b2d'];const idx=String(ORDER.indexOf(c)+1).padStart(2,'0');return `<div class="pm${big?' big':''}" style="--ti:${t[1]}"><span class="pm-ic">${icoSvg(c,big?30:22)}</span><span class="pm-txt"><span class="pm-tag">Célula ${idx}</span><span class="pm-name">${esc(FICHA[c]?FICHA[c].t:c)}</span></span></div>`}
const PLAT=[
 {k:'notion',n:'Notion',s:'Memoria, ADN, planificadores',b:'N',c:'#2f2f2f'},
 {k:'slack',n:'Slack',s:'Avisos y aprobaciones',b:'Sl',c:'#611f69'},
 {k:'gmail',n:'Gmail',s:'Borradores a clientes',b:'Gm',c:'#c5221f'},
 {k:'drive',n:'Drive y Slides',s:'Piezas, presentaciones, propuestas',b:'Dr',c:'#1a73e8'},
 {k:'sheets',n:'Google Sheets',s:'Cotizaciones y cifras',b:'Sh',c:'#188038'},
 {k:'magnific',n:'Magnific',s:'Imágenes y video con IA',b:'Mg',c:'#7a3cff'},
 {k:'meta',n:'Meta Ads',s:'6 cuentas · lectura y escritura',b:'Me',c:'#0866ff'},
 {k:'gads',n:'Google Ads',s:'MCC Boombap · checklist',b:'GA',c:'#e37400'},
 {k:'looker',n:'Looker Studio',s:'Reportes en tiempo real a clientes',b:'LS',c:'#4285f4'},
 {k:'noise',n:'Noise',s:'Supabase · cola de acciones',b:'Nz',c:'#EA1F50'},
 {k:'persu',n:'Persuasion Taxonomy',s:'Copies y titulares',b:'PT',c:'#b06000'},
 {k:'web',n:'Web y YouTube',s:'Noticias, IA, capacitación',b:'W',c:'#5f6368'}
];
const USES={Operaciones:['notion','slack','gmail','drive'],'Planificación':['notion','drive','persu'],'Producción':['magnific','drive','notion'],Pauta:['meta','gads','noise','slack'],Reportes:['looker','noise','meta','gads','notion'],Ventas:['gmail','sheets','drive','noise','notion'],Marketing:['magnific','meta','notion','persu'],Finanzas:['sheets','gmail','notion'],Personal:['web','slack','notion']};
const ring=ORDER;
const svg=$('map');
function mk(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);(p||svg).appendChild(e);return e}
const gE=mk('g',{}),gD=mk('g',{}),gN=mk('g',{});
const CW=300,CH=58,CX=24,PX=880,PW=296,PH=48,HX=470,HY=270,HW=260,HH=110;
const cy=i=>14+i*72, py=i=>8+i*54;
const paths=[];const NODES={},PNODES={};
const bez=(x1,y1,x2,y2)=>{const m=(x1+x2)/2;return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`};
ring.forEach((a,i)=>{const y=cy(i)+CH/2;
  const sp=mk('path',{d:bez(CX+CW,y,HX,HY+HH/2),class:'edge spoke','data-c':a},gE);
  paths.push({p:sp,c:a,pl:null,len:sp.getTotalLength(),dot:mk('circle',{r:3,class:'dot hubdot'},gD),s:70});
  USES[a].forEach(k=>{const j=PLAT.findIndex(p=>p.k===k);const p=mk('path',{d:bez(CX+CW,y,PX,py(j)+PH/2),class:'edge link','data-c':a,'data-p':k},gE);
    paths.push({p,c:a,pl:k,len:p.getTotalLength(),dot:mk('circle',{r:3.6,class:'dot'},gD),s:90})})});
const hub=mk('g',{class:'hub',transform:`translate(${HX},${HY})`},gN);
mk('rect',{width:HW,height:HH,rx:22},hub);
mk('text',{x:HW/2,y:44,'text-anchor':'middle',class:'nm'},hub).textContent='Memoria compartida';
mk('text',{x:HW/2,y:70,'text-anchor':'middle',class:'sb'},hub).textContent='Notion · Meta Timing';
const hp=mk('text',{x:HW/2,y:92,'text-anchor':'middle',class:'pc',id:'hubpc'},hub);hp.textContent='';
ring.forEach((a,i)=>{const g=mk('g',{class:'node',tabindex:'0',role:'button','aria-label':'Célula '+a,transform:`translate(${CX},${cy(i)})`,'data-c':a},gN);
  mk('rect',{class:'bg',width:CW,height:CH,rx:18},g);
  mk('text',{x:18,y:26,class:'nm'},g).textContent=FICHA[a]?FICHA[a].t:a;
  const pc=mk('text',{x:CW-18,y:26,'text-anchor':'end',class:'pc'},g);pc.textContent='0%';
  mk('rect',{class:'tk',x:18,y:39,width:CW-36,height:8,rx:4},g);
  const pg=mk('rect',{class:'pg',x:18,y:39,width:0,height:8,rx:4},g);
  g.addEventListener('click',()=>select(a));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(a)}});
  g.addEventListener('mouseenter',()=>hl(a,null));g.addEventListener('mouseleave',()=>hl(null,null));
  NODES[a]={g,pc,pg,w:CW-36}});
PLAT.forEach((p,j)=>{const g=mk('g',{class:'pnode',transform:`translate(${PX},${py(j)})`,'data-p':p.k},gN);
  mk('rect',{class:'bg',width:PW,height:PH,rx:25},g);
  mk('circle',{cx:25,cy:25,r:17,fill:p.c},g);
  mk('text',{x:25,y:30,'text-anchor':'middle',class:'bd'},g).textContent=p.b;
  mk('text',{x:52,y:22,class:'pn'},g).textContent=p.n;
  mk('text',{x:52,y:39,class:'ps'},g).textContent=p.s;
  g.addEventListener('mouseenter',()=>hl(null,p.k));g.addEventListener('mouseleave',()=>hl(null,null));
  PNODES[p.k]=g});
let hov={c:null,p:null};
function hl(c,p){hov={c,p};paint()}
function paint(){const c=hov.c||(hov.p?null:sel),p=hov.p;const on=!!(c||p);
  svg.classList.toggle('focus',on);
  paths.forEach(e=>{const act=(c&&e.c===c)||(p&&e.pl===p);e.act=act;e.p.classList.toggle('on',!!act);e.dot.classList.toggle('on',!!act)});
  ring.forEach(a=>NODES[a].g.classList.toggle('lit',on&&((c===a)||(p&&USES[a].includes(p)))));
  PLAT.forEach(x=>PNODES[x.k].classList.toggle('lit',on&&((p===x.k)||(c&&USES[c].includes(x.k)))));
  hub.classList.toggle('lit',on&&!!c)}
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function draw(t){paths.forEach((e,i)=>{const f=((t/1000)*e.s/e.len+i*.137)%1;const pt=e.p.getPointAtLength(f*e.len);e.dot.setAttribute('cx',pt.x);e.dot.setAttribute('cy',pt.y)})}
if(reduce)draw(0);else{const L=t=>{draw(t);requestAnimationFrame(L)};requestAnimationFrame(L)}

function select(a){sel=sel===a?null:a;view=null;jump=!!sel;render()}
function openView(v){view=view===v?null:v;sel=null;jump=!!view;render()}

function nextOf(c){const it=CHK.filter(i=>i['Célula']===c&&i.Estado!=='Listo'&&!waiting(i)).sort((a,b)=>(a.Estado==='En curso'?0:1)-(b.Estado==='En curso'?0:1)||(+a.Orden||99)-(+b.Orden||99));return it[0]}
const ADN=[['Alimor','415dc9f0714581fda51ae71d7fd43d70',['meta','gads'],'Maquinaria · Full Meta + Google'],['Carillon','416dc9f071458133a437db11cff41b7a',['meta','gads'],'Ecommerce · PMax y Merchant'],['Donem','416dc9f07145813a8245c8a0516a32f7',['meta','gads'],'Ecommerce deportivo'],['Krat','416dc9f07145814f8706f6af15558c31',['meta','gads'],'Inmobiliaria · en pausa'],['Mejac','416dc9f0714581518675f2ad27182d1b',['meta'],'Ferretería · Boost IG'],['Ventanas 2001','416dc9f07145814aab11e0e7741ff49f',['meta','gads'],'Termopaneles · Boost IG'],['Siosip','416dc9f07145816eaab0d32121881806',['gads'],'Solo Google Ads'],['Kinebaric','',['meta'],'Onboarding · 4 anuncios'],['Mamba Sport','',['gads'],'Onboarding · solo Google']];
$('v-ped').onclick=()=>openView('ped');
const LOGS=[['📒','Bitácora de cuentas','Cada acción con un cliente','a40db104e0d24b718bb2d5b68d221634'],['🧠','Memoria de células','Cambios, decisiones y pedidos','75b82b6e43644f0d86a596fb5ca6c623'],['🗓️','Meta Planificación','Ciclo D-15 → D+10 y Meta Timing','78c7039abb044deeba507c0f7b1ab136'],['✅','Checklist de células','Lo que alimenta este panel','c43bce045b8e47efa1c47d4731ea5def'],['📐','Protocolo de agentes','Reglas para cada agente','415dc9f0714581378002d4d10ba7aaeb'],['🧩','Sistema de células','Página madre del ecosistema','416dc9f071458148a45bfb23f52d3198']];
$('logs').innerHTML=LOGS.map(([i,n,s2,id])=>`<a class="log" href="https://app.notion.com/p/${id}" target="_blank" rel="noopener"><span class="ic">${i}</span><span><b>${n}</b><span>${s2}</span></span><span class="ar">↗</span></a>`).join('');
function renderView(d){
  const T={wip:'En curso',wait:'Esperando cliente',ped:'Pedidos abiertos'};
  let rows;
  if(view==='ped'){rows=MEM.filter(m=>m.Tipo==='Pedido'&&m.Estado!=='Resuelto').map(m=>`<div class="ck"><span>${esc(m.Entrada)}</span><span class="tg"><span class="chip">${esc(m.Desde)} → ${esc(arr(m.Para).join(', '))}</span>${arr(m.Cliente).filter(c=>c!=='General').map(c=>`<span class="chip">${esc(c)}</span>`).join('')}<span class="chip">${esc(String(m.Fecha||'').slice(0,10))}</span></span></div>`)}
  else{const it=CHK.filter(i=>view==='wip'?i.Estado==='En curso':(i.Estado!=='Listo'&&waiting(i)));rows=it.map(i=>`<div class="ck"><span>${esc(i['Ítem'])}</span><span class="tg"><span class="chip">${esc(i['Célula'])}</span><span class="chip">${esc(i.Grupo||'')}</span>${i.Cliente&&i.Cliente!=='General'?`<span class="chip">${esc(i.Cliente)}</span>`:''}</span>${i['Siguiente acción']?`<span class="s">${esc(i['Siguiente acción'])}</span>`:''}</div>`)}
  d.innerHTML=`<div class="detail-h"><div><p class="eyebrow">Estado</p><h2>${T[view]} <span class="muted num" style="font-weight:500">${rows.length}</span></h2></div><span style="display:flex;gap:12px;align-items:center"><a href="https://app.notion.com/p/${view==='ped'?'75b82b6e43644f0d86a596fb5ca6c623':'c43bce045b8e47efa1c47d4731ea5def'}" target="_blank" rel="noopener">Abrir en Notion ↗</a><button class="btn" type="button" id="close">Cerrar</button></span></div><div class="vlist">${rows.join('')||'<p class="empty">Nada por ahora.</p>'}</div>`;
  $('close').onclick=()=>openView(view);
  if(jump){jump=false;d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
}
function fichaHTML(c,it){const f=FICHA[c];if(!f)return'';const auts=CEL.filter(r=>r.Tipo==='Automatización'&&r['Célula']===c);
  return `<div class="ficha"><div class="f-media">${mediaHTML(c,1)}<span class="pfs">${(USES[c]||[]).map(k=>{const p=PLAT.find(x=>x.k===k);return `<span class="pfb" style="background:${p.c}">${esc(p.n)}</span>`}).join('')}</span></div>
  <div class="f-body"><p class="f-tag">${esc(f.tag)}</p><h3>Lo que hace</h3><ul class="f-fn">${f.fn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <div class="f-meta"><div><span class="eyebrow">Entrega</span><b>${esc(f.out)}</b></div><div><span class="eyebrow">Agentes de IA</span><b>${(TEAM[c]||[[],[]])[0].map(esc).join(' · ')}</b></div><div><span class="eyebrow">Personas</span><b>${(TEAM[c]||[[],[]])[1].map(esc).join(' · ')}</b></div></div>
  <div class="f-ask"><span class="eyebrow">Pídele, por ejemplo</span>${esc(f.ask)}</div></div></div>`}
function renderDetail(cells){
  const d=$('detail');
  if(view){renderView(d);return}
  if(!sel){d.innerHTML=`<div class="hint"><span class="chip">Detalle</span>Toca una célula en el esquema o en las tarjetas, o un estado de la barra lateral, para ver qué está listo, qué falta y lo siguiente que conviene avanzar.</div>`;return}
  const it=CHK.filter(i=>i['Célula']===sel).sort((a,b)=>(+a.Orden||99)-(+b.Orden||99));
  const r=cells.find(c=>c['Célula']===sel)||{};const k=ck(it);const nx=nextOf(sel);
  const grp=[...new Set(it.filter(i=>i.Cliente&&i.Cliente!=='General').map(i=>i.Grupo))];
  const sym={ok:'✓',wip:'◐',todo:'·'};
  const mx=grp.length?`<div class="mx-wrap"><table class="mx"><thead><tr><th>Por cliente</th>${CLIENTS.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${grp.map(g=>`<tr><td>${esc(g)}</td>${CLIENTS.map(c=>{const x=it.find(i=>i.Grupo===g&&i.Cliente===c);if(!x)return'<td><span class="st na">—</span></td>';const t=stc(x.Estado);return `<td><span class="st ${t}" title="${esc(x.Estado)}">${sym[t]}</span></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  const col=(name,t,list)=>`<div class="col"><h3><span class="pill ${t}">${name}</span><span class="ct">${list.length}</span></h3>${list.length?list.map(i=>`<div class="ck${t==='ok'?' done':''}"><span>${esc(i['Ítem'])}</span><span class="tg"><span class="chip">${esc(i.Grupo||'')}</span>${i.Cliente&&i.Cliente!=='General'?`<span class="chip">${esc(i.Cliente)}</span>`:''}${waiting(i)&&t!=='ok'?'<span class="pill warn">Esperando cliente</span>':''}</span>${i['Siguiente acción']&&t!=='ok'?`<span class="s">${esc(i['Siguiente acción'])}</span>`:''}</div>`).join(''):'<p class="empty">Nada aquí.</p>'}</div>`;
  d.innerHTML=`<div class="detail-h"><div><p class="eyebrow">Ficha de la célula</p><h2>${esc(FICHA[sel]?FICHA[sel].t:sel)}</h2></div><span style="display:flex;gap:12px;align-items:center"><a href="${CHK_URL}" target="_blank" rel="noopener">Abrir checklist en Notion ↗</a><button class="btn" type="button" id="close">Cerrar</button></span></div>
    ${fichaHTML(sel,it)}
    <div class="prog"><div class="bar ${k.v>=1?'':'wip'}"><i style="width:${Math.round(k.v*100)}%"></i></div><span class="num" style="font-weight:700">${Math.round(k.v*100)}%</span>
      <span class="lg"><span>${k.L} listos</span><span>${k.W} en curso</span><span>${k.F} faltan</span>${r.Modelo?`<span>Modelo: ${esc(r.Modelo)}</span>`:''}</span></div>
    ${nx?`<div class="up"><span class="eyebrow">Lo siguiente a avanzar</span><b>${esc(nx['Ítem'])}</b>${nx['Siguiente acción']?`<span class="s">${esc(nx['Siguiente acción'])}</span>`:''}</div>`:`<div class="up"><b>Todo listo en esta célula</b></div>`}
    ${mx}
    <div class="cols">${col('Falta','todo',it.filter(i=>i.Estado!=='Listo'&&i.Estado!=='En curso'))}${col('En curso','wip',it.filter(i=>i.Estado==='En curso'))}${col('Listo','ok',it.filter(i=>i.Estado==='Listo'))}</div>`;
  $('close').onclick=()=>select(sel);
  if(jump){jump=false;d.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
}

function render(){
  const cells=ORDER.map(c=>{const r={...(CEL.find(r=>r.Tipo==='Célula'&&r['Célula']===c)||{Nombre:c,Célula:c,Estado:'Por construir',Avance:0})};
    const it=CHK.filter(i=>i['Célula']===c);if(it.length){const k=ck(it);r.Avance=k.v;r.k=k}return r});
  const autos=CEL.filter(r=>r.Tipo==='Automatización');
  const base=CEL.filter(r=>r.Tipo==='Base común');
  const all=[...cells,...autos,...base];
  const tot=all.length?all.reduce((s,r)=>s+num(r.Avance),0)/all.length:0;
  $('ringpg').setAttribute('stroke-dashoffset',(263.9*(1-tot)).toFixed(1));
  $('ringtx').textContent=Math.round(tot*100)+'%';
  $('k-cel').textContent=cells.filter(r=>r.Estado!=='Por construir').length+'/'+cells.length;
  $('k-aut').textContent=autos.filter(r=>r.Estado==='Activa').length+'/'+autos.length;
  const adnI=CHK.filter(i=>i.Grupo==='ADN');const adn=base.find(r=>/ADN/i.test(r.Nombre||''));
  $('k-adn').textContent=adnI.length?adnI.filter(i=>i.Estado==='Listo').length+'/'+adnI.length:(adn?pct(adn.Avance):'—');
  const ped=MEM.filter(m=>m.Tipo==='Pedido'&&m.Estado!=='Resuelto');
  $('k-ped').textContent=ped.length;
  $('hubpc').textContent=ped.length+' pedidos abiertos';

  cells.forEach(r=>{const n=NODES[r['Célula']];if(!n)return;const v=num(r.Avance);
    n.pc.textContent=pct(v);n.pg.setAttribute('width',(n.w*v).toFixed(1));
    n.g.classList.remove('wipn','todon');if(cls(r.Estado)!=='ok')n.g.classList.add(cls(r.Estado)+'n');
    n.g.classList.toggle('sel',sel===r['Célula'])});
  paint();

  $('cells').innerHTML=cells.map(r=>{const c=cls(r.Estado);const C=r['Célula'];const f=FICHA[C]||{fn:[]};const nAut=autos.filter(a=>a['Célula']===C).length;const nx=nextOf(C);
    return `<article class="card cell${sel===C?' sel':''}" tabindex="0" data-c="${esc(C)}">
      ${mediaHTML(C)}
      <div class="cell-b">
        <div class="cell-h"><span class="pill ${c}">${esc(r.Estado||'')}</span><span class="pc2 num">${pct(r.Avance)}</span></div>
        <div class="bar ${c==='ok'?'':c}"><i style="width:${pct(r.Avance)}"></i></div>
        <p class="tagl">${esc(f.tag||'')}</p>
        <ul class="mini">${f.fn.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <div class="cell-f"><span class="pfs sm">${(USES[C]||[]).map(k=>{const p=PLAT.find(x=>x.k===k);return `<i title="${esc(p.n)}" style="background:${p.c}">${esc(p.b)}</i>`}).join('')}</span><span class="more">${r.k?r.k.L+'/'+r.k.n+' listos':''}${nAut?' · '+nAut+' autom.':''} · Ver ficha →</span></div>
        ${nx?`<p class="next">Sigue: ${esc(nx['Ítem'])}</p>`:''}
      </div></article>`}).join('');
  document.querySelectorAll('.cell').forEach(el=>{const a=el.dataset.c;el.onclick=()=>select(a);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(a)}}});



  $('bigval').innerHTML=Math.round(tot*100)+'<small>%</small>';
  const nL=CHK.filter(i=>i.Estado==='Listo').length;$('bigdelta').textContent=nL+'/'+CHK.length+' ítems listos';
  const cnt=c=>{const it=CHK.filter(i=>i['Célula']===c);return it.filter(i=>i.Estado==='Listo').length+'/'+it.length};
  $('side-cells').innerHTML=`<button class="nav${!sel?' on':''}" data-c=""><span class="dot ok"></span>Todas<span class="ct">${CHK.length}</span></button>`+cells.map(r=>`<button class="nav${sel===r['Célula']?' on':''}" data-c="${esc(r['Célula'])}"><span class="dot ${cls(r.Estado)}"></span>${esc(r['Célula'])}<span class="ct">${cnt(r['Célula'])}</span></button>`).join('');
  const wt=CHK.filter(i=>i.Estado!=='Listo'&&waiting(i)).length,inC=CHK.filter(i=>i.Estado==='En curso').length;
  const sb=(v,dot,lbl,n,hot)=>`<button class="nav${view===v?' on':''}" data-v="${v}" type="button"><span class="dot"${dot}></span>${lbl}<span class="ct${hot&&n?' hot':''}">${n}</span></button>`;
  $('side-state').innerHTML=sb('wip',' style="background:var(--wip)"','En curso',inC)+sb('wait','','Esperando cliente',wt)+sb('ped',' style="background:var(--warn)"','Pedidos abiertos',ped.length,1);
  document.querySelectorAll('#side-state .nav').forEach(b=>b.onclick=()=>openView(b.dataset.v));
  $('adnsub').textContent=CHK.filter(i=>i.Grupo==='ADN'&&i.Estado==='Listo').length+' de '+CHK.filter(i=>i.Grupo==='ADN').length+' listos';
  $('adns').innerHTML=ADN.map(([c,id,pf,nota])=>{const it=CHK.find(i=>i.Grupo==='ADN'&&i.Cliente===c);const st=it?it.Estado:'Falta';const t=stc(st);
    const body=`<b>${esc(c)}<span class="pill ${t}">${esc(st)}</span></b><span class="pf">${pf.map(k=>{const p=PLAT.find(x=>x.k===k);return `<span class="pfb" style="background:${p.c}">${esc(p.n)}</span>`}).join('')}</span><span class="s">${esc(nota)}</span>`;
    return id?`<a class="adn" href="https://app.notion.com/p/${id}" target="_blank" rel="noopener">${body}</a>`:`<div class="adn">${body}</div>`}).join('');
  $('tabs').innerHTML=`<button class="tab${!sel?' on':''}" role="tab" aria-selected="${!sel}" data-c="">Todas</button>`+cells.map(r=>`<button class="tab${sel===r['Célula']?' on':''}" role="tab" aria-selected="${sel===r['Célula']}" data-c="${esc(r['Célula'])}">${esc(r['Célula'])}<i>${pct(r.Avance)}</i></button>`).join('');
  document.querySelectorAll('#side-cells .nav,#tabs .tab').forEach(b=>b.onclick=()=>{const c=b.dataset.c;if(!c){sel=null;render()}else if(sel!==c)select(c)});
  $('feedsub').textContent=sel?'Entradas de '+sel+' o para todas':'Cambios, decisiones y pedidos entre células';
  renderDetail(cells);
  const li=r=>{const c=cls(r.Estado);return `<div class="item"><span class="t">${esc(r.Nombre)} <span class="pill ${c}">${esc(r.Estado||'')}</span></span><span class="p">${pct(r.Avance)}</span>
    <div class="bar ${c==='ok'?'':c}"><i style="width:${pct(r.Avance)}"></i></div><span class="s">${esc(r['Siguiente paso']||'')}</span></div>`};
  $('autos').innerHTML=autos.length?autos.map(li).join(''):'<p class="empty">Sin automatizaciones registradas.</p>';
  $('base').innerHTML=base.length?base.map(li).join(''):'<p class="empty">Sin elementos de base común.</p>';

  const fm=d=>{if(!d)return'';const [y,m,dd]=String(d).slice(0,10).split('-');const M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return dd+'-'+(M[+m-1]||m)};
  const list=sel?MEM.filter(m=>m.Desde===sel||arr(m.Para).includes(sel)||arr(m.Para).includes('Todas')):MEM;
  $('feed').innerHTML=list.length?list.slice(0,10).map(m=>`<div class="ev"><span class="d">${fm(m.Fecha)}</span><div class="e">${esc(m.Entrada)}
    <div class="meta"><span class="ty ${esc(m.Tipo)}">${esc(m.Tipo)}</span><span class="chip">${esc(m.Desde)} → ${esc(arr(m.Para).join(', '))}</span>${arr(m.Cliente).filter(c=>c!=='General').map(c=>`<span class="chip">${esc(c)}</span>`).join('')}${m.Tipo==='Pedido'&&m.Estado!=='Resuelto'?'<span class="pill warn">Abierto</span>':''}</div></div></div>`).join('')
    :'<p class="empty">Sin entradas para esta célula.</p>';
}

const STAGES=[['D-15','Solicitud de información','Operaciones'],['D-10','Info recibida','Cliente'],['D-9','Planificador en proceso','Planificación'],['D-8','Planificador listo','Planificación'],['D-7','Diseño día 1','Producción'],['D-6','Diseño día 2 + revisión','Producción'],['D-5','Correcciones + revisión','Producción'],['D-4/3','Presentación al cliente','Operaciones'],['D-2/1','Aprobación, 9:16 y Drive','Producción'],['D','Activación de campañas','Pauta'],['D+10','Optimización','Pauta']];
$('tl').innerHTML=STAGES.map(([d,t,w],i)=>`<div class="st-node${d==='D'?' d':(i%2&&d!=='D+10'?' mid':'')}"><span class="ic">${i+1}</span><b>${d}</b><span>${t}</span><span class="who2">${w}</span></div>`).join('');
const JOBS=[['Aviso del ciclo','L–V 8:11'],['Pauta D / D+10 y fechas','L–V 9:37 · 15:37'],['Boost IG','Lun y mié 9:00 · 11 · 15'],['Noise Ads Sync','Diario 18:00'],['Reporte Ads','Diario · Mac']];
$('dock').innerHTML=JOBS.map(([n,t])=>`<span class="job"><span class="b"></span>${n}<i>${t}</i></span>`).join('');
function colorBars(){document.querySelectorAll('.bar i').forEach(i=>{const p=parseFloat(i.style.width)||0;i.style.backgroundSize=p>0?(10000/p).toFixed(1)+'% 100%':'100% 100%'});
  Object.keys(NODES).forEach(k=>{const n=NODES[k];const p=n.w?(+n.pg.getAttribute('width')||0)/n.w:0;n.pg.style.fill='hsl('+Math.round(p*125)+',68%,'+(p>.4&&p<.75?'45':'48')+'%)'})}
const _render=render;render=function(){_render();colorBars()};
render();

/* Meta Timing: clientes y calendario */
const STG=['Pedir información','Planificador','Diseño','Revisión interna','Presentación al cliente','Aprobación y 9:16','Activación (D)','Optimización D+10'];
const STG_S=['Info','Planif.','Diseño','Rev. interna','Presentación','Aprobación','Activación','D+10'];
const STG_C=['#8a8f98','#c9a227','#e07b39','#9b6bd6','#2f7fd1','#1aa39a','#EA1F50','#22a06b'];
const HITO_I={'Solicitud de Información':0,'Planificador Terminado':1,'Diseño de Anuncios':2,'Revisión Agencia Presentador':3,'Revisión Cliente Presentador':4,'Aprobación Piezas':5,'Inicio de Campaña':6,'Optimización D+10':7};
const SNAP_MT=[["Alimor",0,"2026-11-11","","H","Dic","415dc9f071458135925bd8b92a0bfedb"],["Mejac",0,"2026-11-11","","H","Dic","415dc9f07145813aa279e4410494432d"],["Krat",0,"2026-11-11","","H","Dic","415dc9f0714581689eecd13291eb0e91"],["Donem",1,"2026-11-12","","P","Nov","416dc9f0714581269075c1c22fc03757"],["Carillon",2,"2026-11-12","2026-11-13","P","Nov","416dc9f0714581358e8ff9a947ff0845"],["Carillon",3,"2026-11-12","2026-11-13","P","Nov","416dc9f0714581d5b25ff55811db8a33"],["Mejac",7,"2026-11-13","","P","Nov","416dc9f0714581028126d81f65986c23"],["Alimor",7,"2026-11-13","","P","Nov","416dc9f071458187bd13fdf3828b9892"],["Carillon",5,"2026-11-13","2026-11-16","P","Nov","416dc9f0714581978a4be5f213f64f89"],["Donem",2,"2026-11-13","2026-11-16","P","Nov","416dc9f0714581e4b9ebca6eda433b99"],["Carillon",4,"2026-11-13","","P","Nov","416dc9f0714581fa9300f0c0e9b76a91"],["Donem",3,"2026-11-17","","P","Nov","416dc9f07145812c9de8cfc462bf1b3b"],["Carillon",6,"2026-11-16","","P","Nov","416dc9f0714581cd8e76ce6dbec58c6d"],["Donem",4,"2026-11-17","2026-11-18","P","Nov","416dc9f0714581ce9ea2cb9df9fb6cc7"],["Mejac",1,"2026-11-19","2026-11-20","P","Dic","415dc9f071458131af32eb6741c52827"],["Krat",1,"2026-11-17","2026-11-18","P","Dic","415dc9f07145814bb1f8f8762f7f645f"],["Ventanas 2001",0,"2026-11-18","","P","Dic","415dc9f0714581cfba9acb635d66dff7"],["Alimor",1,"2026-11-16","","P","Dic","415dc9f0714581e088b5f8be9463eb4b"],["Donem",5,"2026-11-19","","P","Nov","416dc9f071458152b203e22af8ad468b"],["Donem",6,"2026-11-20","","P","Nov","416dc9f071458168bcb0d4154196d7b1"],["Alimor",2,"2026-11-17","2026-11-18","P","Dic","415dc9f071458135b3cbcd43e50172f8"],["Krat",2,"2026-11-19","2026-11-20","P","Dic","415dc9f07145813fb650dab43ffdef1f"],["Mejac",2,"2026-11-23","2026-11-24","P","Dic","415dc9f0714581ab8b20ed1bc21acec3"],["Carillon",0,"2026-11-23","","P","Dic","415dc9f071458146ac02c0d39cc00a3d"],["Krat",3,"2026-11-23","","P","Dic","415dc9f07145814fb9a2eea1dab36752"],["Mejac",3,"2026-11-25","","P","Dic","415dc9f071458196826ac3444dd78308"],["Alimor",3,"2026-11-19","","P","Dic","415dc9f0714581e59b0eeec021a6dfab"],["Ventanas 2001",7,"2026-11-24","","P","Nov","416dc9f07145818193b3eaeac6f13709"],["Alimor",4,"2026-11-20","2026-11-23","P","Dic","415dc9f07145814aaabaf9bd92417b9f"],["Krat",4,"2026-11-24","2026-11-25","P","Dic","415dc9f071458190ba89d8795562654b"],["Mejac",4,"2026-11-26","2026-11-27","P","Dic","415dc9f0714581f3b0d5f4eed94d6526"],["Ventanas 2001",1,"2026-11-26","2026-11-27","P","Dic","415dc9f0714581bba56ce66b422013db"],["Donem",0,"2026-11-27","","P","Dic","415dc9f07145810fbfa6c61b4328cece"],["Krat",5,"2026-11-26","2026-11-30","P","Dic","415dc9f07145816791beecf9f3ce5030"],["Mejac",5,"2026-11-30","","P","Dic","415dc9f071458185ad67f2f5b2f4bbdf"],["Alimor",5,"2026-11-24","2026-11-30","P","Dic","415dc9f0714581e2b221f39d76b45ed4"],["Carillon",7,"2026-11-30","","P","Nov","416dc9f07145819db868cb6e7f37234a"],["Ventanas 2001",2,"2026-11-30","2026-12-02","P","Dic","415dc9f071458188a6f3c2d1798424f6"],["Krat",6,"2026-12-01","","P","Dic","415dc9f071458135ae42db21306fbcb1"],["Alimor",6,"2026-12-01","","P","Dic","415dc9f07145818d8615ea4ae928a1ce"],["Carillon",1,"2026-12-01","2026-12-02","P","Dic","415dc9f0714581a8aa9ec5d8c767b9ed"],["Mejac",6,"2026-12-01","","P","Dic","415dc9f0714581ee9790e81ca931a22f"],["Ventanas 2001",3,"2026-12-01","2026-12-02","P","Dic","415dc9f0714581f8bf83fc46c781002a"],["Ventanas 2001",4,"2026-12-03","2026-12-04","P","Dic","415dc9f07145813792e2e92d9f70b4be"],["Carillon",2,"2026-12-03","2026-12-07","P","Dic","415dc9f0714581ed827dc91e6c878451"],["Donem",7,"2026-12-04","","P","Nov","416dc9f0714581c9864cd4657a41d547"],["Carillon",3,"2026-12-04","2026-12-07","P","Dic","415dc9f0714581ff97e0df5fced27c76"],["Ventanas 2001",5,"2026-12-07","2026-12-09","P","Dic","415dc9f071458133ac1dc3dfc69b8dc0"],["Donem",1,"2026-12-07","2026-12-09","P","Dic","415dc9f071458182ad64daa2d65c91aa"],["Carillon",4,"2026-12-09","2026-12-10","P","Dic","415dc9f0714581b294e1ce6c20496981"],["Donem",2,"2026-12-10","2026-12-14","P","Dic","415dc9f0714581c49480e79c8252a9bd"],["Ventanas 2001",6,"2026-12-10","","P","Dic","415dc9f0714581d994b3dea11fed17ab"],["Carillon",5,"2026-12-11","2026-12-14","P","Dic","415dc9f0714581579fcee81e55245a43"],["Donem",3,"2026-12-11","2026-12-14","P","Dic","415dc9f0714581b28c55db702a64ca41"],["Donem",4,"2026-12-15","2026-12-16","P","Dic","415dc9f071458117a22ac8acc9335c74"],["Carillon",6,"2026-12-15","","P","Dic","415dc9f0714581f4951ec73b8d7a89b4"],["Alimor",7,"2026-12-16","","P","Dic","416dc9f07145818dafe8ea4559f7b830"],["Mejac",7,"2026-12-16","","P","Dic","416dc9f0714581b689d4d3a561b0d31c"],["Donem",5,"2026-12-17","2026-12-18","P","Dic","415dc9f071458146946dc32a3a8f01bb"],["Donem",6,"2026-12-20","","P","Dic","415dc9f07145819586d3d81d7a7d6a41"],["Ventanas 2001",7,"2026-12-24","","P","Dic","416dc9f07145814f90f2d12370658a7e"],["Carillon",7,"2026-12-30","","P","Dic","416dc9f071458129b2b0fbfdefb03d88"],["Donem",7,"2027-01-05","","P","Dic","416dc9f0714581ca9ba8f3243aca76d1"]].map(r=>({c:r[0],h:r[1],a:r[2],b:r[3]||r[2],done:r[4]==='H',cy:r[5],url:'https://app.notion.com/p/'+r[6]}));
let MT=SNAP_MT, mtSel=null, calM=null;
const EXTRA=[['Siosip','Solo Google Ads','Revisión semanal los lunes (sin ciclo de piezas)','gads'],['Mamba Sport','Onboarding','Esperando la información del cliente','wait'],['Kinebaric','Onboarding','Esperando la información del cliente','wait']];
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const fd=iso=>{const [y,m,d]=iso.split('-');return +d+' '+['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+m-1]};
function bdays(a,b){let n=0;const d=new Date(a+'T12:00');const e=new Date(b+'T12:00');const s=d<e?1:-1;while(d.toISOString().slice(0,10)!==e.toISOString().slice(0,10)){d.setDate(d.getDate()+s);const w=d.getDay();if(w&&w<6)n+=s}return n}
function clientState(c){
  /* etapa según el calendario de Meta Timing: la que corre hoy; si no hay ninguna, la próxima que empieza */
  const t=todayISO();
  const rs=MT.filter(r=>r.c===c&&r.h!==7).sort((x,y)=>x.a.localeCompare(y.a)||x.h-y.h);
  if(!rs.length)return null;
  const ongoing=rs.filter(r=>r.a<=t&&r.b>=t&&!r.done).sort((x,y)=>y.h-x.h)[0];
  const upcoming=rs.find(r=>r.a>t&&!r.done);
  const cur=ongoing||upcoming||rs[rs.length-1];
  const cyRows=rs.filter(r=>r.cy===cur.cy);
  const dots=STG.map((_,i)=>{const r=cyRows.find(x=>x.h===i);if(i===cur.h)return 'cur';if(i<cur.h)return 'done';if(r&&r.done)return 'done';return 'todo'});
  const isToday=!!ongoing;const starts=!ongoing&&upcoming?upcoming.a:null;
  const act=rs.find(r=>r.h===6&&r.a>=t);const nx=rs.find(r=>r.a>cur.a&&r!==cur&&!r.done);
  return {cur,dots,late:0,isToday,starts,act,nx};
}
function renderClients(){
  const names=[...new Set(MT.map(r=>r.c))].sort((a,b)=>(clientState(a)?.cur.a||'9').localeCompare(clientState(b)?.cur.a||'9'));
  const rowsH=names.map(c=>{const st=clientState(c);if(!st)return'';
    const chip=st.isToday?`<span class="pill wip">En curso</span>`:st.starts?`<span class="pill todo">Empieza ${fd(st.starts)}</span>`:`<span class="pill ok">Al día</span>`;
    const note=c==='Krat'?'<span class="chip">Pauta en pausa</span>':'';
    return `<button type="button" class="cl${mtSel===c?' on':''}" data-c="${esc(c)}">
      <span class="cl-n"><b>${esc(c)}</b><span class="muted">Ciclo ${esc(st.cur.cy==='Nov'?'noviembre':'diciembre')}</span></span>
      <span class="cl-dots">${st.dots.map((d,i)=>`<i class="${d}" title="${STG[i]}" style="--sc:${STG_C[i]}"></i>`).join('')}</span>
      <span class="cl-st"><b>${STG[st.cur.h]}</b><span class="muted">${fd(st.cur.a)}${st.cur.b!==st.cur.a?' – '+fd(st.cur.b):''}</span></span>
      <span class="cl-nx muted">${st.act?'Activación '+fd(st.act.a):'Siguiente: '+(st.nx?STG[st.nx.h]+' '+fd(st.nx.a):'—')}</span>
      <span class="cl-s">${chip}${note}${pendientesDe(c)}</span></button>`}).join('');
  const extraH=EXTRA.map(([c,a,b,k])=>`<div class="cl static"><span class="cl-n"><b>${esc(c)}</b><span class="muted">${esc(a)}</span></span><span class="cl-dots muted" style="font-size:12px">${esc(b)}</span><span></span><span></span><span class="cl-s">${k==='wait'?'<span class="pill warn">Esperando cliente</span>':'<span class="pill todo">Semanal</span>'}</span></div>`).join('');
  $('clients').innerHTML=`<div class="cl head"><span>Cliente</span><span>Etapas del ciclo</span><span>Etapa actual</span><span>Próximo</span><span>Estado</span></div>`+rowsH+extraH;
  document.querySelectorAll('#clients .cl[data-c]').forEach(b=>b.onclick=()=>{mtSel=mtSel===b.dataset.c?null:b.dataset.c;renderClients();renderCal()});
  $('stglg').innerHTML=STG.map((n,i)=>`<span><i style="background:${STG_C[i]}"></i>${n}</span>`).join('');
}
function renderCal(){
  const t=todayISO();if(!calM)calM=t.slice(0,7);
  const [y,m]=calM.split('-').map(Number);const first=new Date(y,m-1,1);const start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
  const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  $('calt').textContent=MES[m-1]+' '+y+(mtSel?' · '+mtSel:'');
  const rs=MT.filter(r=>!mtSel||r.c===mtSel);let h='<div class="cal-h">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('')+'</div><div class="cal-g">';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const wk=d.getDay()===0||d.getDay()===6;const items=wk?[]:rs.filter(r=>r.a<=iso&&r.b>=iso).sort((a,b)=>a.h-b.h);
    h+=`<div class="cd${d.getMonth()!==m-1?' out':''}${iso===t?' today':''}${wk?' wk':''}"><span class="cdn">${d.getDate()}</span>${items.slice(0,5).map(r=>`<a class="ev2${r.done?' done':''}${!r.done&&r.b<t?' late':''}" style="--sc:${STG_C[r.h]}" href="${r.url}" target="_blank" rel="noopener" title="${esc(r.c+' · '+STG[r.h]+' · ciclo '+r.cy)}"><b>${esc(r.c.replace(' 2001',''))}</b> ${STG_S[r.h]}</a>`).join('')}${items.length>5?`<span class="more2">+${items.length-5} más</span>`:''}</div>`}
  $('cal').innerHTML=h+'</div>';
}
$('calp').onclick=()=>{const [y,m]=calM.split('-').map(Number);const d=new Date(y,m-2,1);calM=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderCal()};
$('caln').onclick=()=>{const [y,m]=calM.split('-').map(Number);const d=new Date(y,m,1);calM=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderCal()};
$('calh').onclick=()=>{calM=null;mtSel=null;renderClients();renderCal()};
function applyMT(rows){MT=rows.map(r=>{const st=(r.Estado||'');return {c:String(r.Nombre||'').split(' · ')[0],h:HITO_I[r.Hito]??0,a:r['date:Fecha:start']||'',b:r['date:Fecha:end']||r['date:Fecha:start']||'',done:st==='Hecho'||st==='Aprobado por plazo',cy:/^Nov/.test(r.Ciclo||'')?'Nov':/^Dic/.test(r.Ciclo||'')?'Dic':String(r.Ciclo||'').slice(0,3),url:r.url}}).filter(r=>r.a);renderClients();renderCal()}
renderClients();renderCal();

/* Datos en vivo: espejo de Notion en Supabase */
const live=$('live'),stamp=$('stamp'),notice=$('notice');
function setLive(state,text){live.className='live'+(state?' '+state:'');live.textContent=text}
function note(text){notice.textContent=text||'';notice.hidden=!text}
const plano=r=>{const p=r.props||{};const f=p.Fecha&&typeof p.Fecha==='object'?p.Fecha:null;return {...p,url:r.url,...(f?{'date:Fecha:start':f.start,'date:Fecha:end':f.end||f.start}:{})}};
let firma='';
async function loadOnce(){
  if(!firma)setLive('','Cargando…');
  const [esp,est]=await Promise.all([
    sb.from('notion_espejo').select('fuente,props,url,notion_editado_at').limit(2000),
    sb.from('notion_sync_estado').select('fuente,ultima_at,ok,error')]);
  if(esp.error){setLive('err','Sin conexión');note('No se pudo leer Supabase. Se muestran los datos guardados.');return}
  const por={celulas:[],memoria:[],checklist:[],meta_timing:[]};
  for(const r of esp.data||[])if(por[r.fuente])por[r.fuente].push(plano(r));
  const nueva=(esp.data||[]).map(r=>r.fuente+r.notion_editado_at).sort().join('|')||'vacio';
  const vivos=['celulas','memoria','checklist','meta_timing'].filter(k=>por[k].length).length;
  if(nueva!==firma){
    firma=nueva;
    if(por.celulas.length)CEL=por.celulas;
    if(por.checklist.length)CHK=por.checklist;
    if(por.memoria.length)MEM=por.memoria.map(r=>({Entrada:r.Entrada,Tipo:r.Tipo,Desde:r.Desde,Para:arr(r.Para),Cliente:arr(r.Cliente),Estado:r.Estado,Fecha:r['date:Fecha:start']||''})).sort((a,b)=>String(b.Fecha).localeCompare(String(a.Fecha)));
    render();
    if(por.meta_timing.length)applyMT(por.meta_timing);
  }
  const estados=est.data||[];
  const fallo=estados.find(e=>!e.ok&&e.error);
  const ult=estados.filter(e=>e.ok).map(e=>e.ultima_at).sort().pop();
  if(vivos===4){setLive('on','En vivo desde Notion');note('')}
  else if(vivos){setLive('on','En vivo (parcial)');note(fallo?fallo.error:'Algunas bases de Notion aún no se sincronizan; para esas se muestran los datos guardados.')}
  else{setLive('','Datos guardados');note((fallo?fallo.error+' ':'')+'Mientras tanto se muestran los datos guardados al 12-nov.')}
  if(ult)stamp.textContent='Actualizado '+new Date(ult).toLocaleString('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
$('refresh').addEventListener('click',loadOnce);
loadOnce();
setInterval(()=>{if(!document.hidden)loadOnce()},60000);
})();

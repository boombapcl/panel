# Panel Células · Boombap

Panel interno de Boombap, publicado en **panel.boombap.cl** (VPS con Plesk). Los datos viven en Supabase (proyecto «Admin Cotizador Boombap», el mismo de Noise). Aquí solo está la página.

| Dirección | Qué es |
|---|---|
| `/` | **Tareas**: lo que hay que hacer a mano, agrupado por día (Atrasadas, Hoy, Mañana, Esta semana…). Usa la misma tabla `tasks` de Noise |
| `/bandeja` | **Bandeja**: todo lo que espera la decisión de Manuel, con Aprobar / Pedir cambio / Rechazar |
| `/clientes` | **Clientes**: la matriz de Noise (`companies`) con contactos, servicios, facturación, cuentas de pauta, tareas y decisiones. Se editan estado, ubicación, web y carpetas de Drive |
| `/celulas` | Células, clientes, calendario Meta Timing y memoria, con tareas y decisiones pendientes por cliente |

Todas las páginas comparten el **menú lateral** (`src/lib/menu.js`): cada sección con título, descripción, contador y submenú. En escritorio se expande o se contrae a íconos (el submenú aparece al pasar el cursor); en pantallas angostas es una barra superior con menú deslizable. Los enlaces del submenú usan la dirección (`/?vista=hoy`, `/bandeja?tab=errores`, `/clientes?ver=pendientes`), así que se pueden guardar y compartir.

### Timer

Cada tarea abierta tiene ▶ para medir tiempo. El timer se guarda en Supabase (`task_time_logs`), no en el navegador: sigue corriendo si cambias de página o de dispositivo y se ve en el menú. Un timer por persona: al iniciar otro se detiene el anterior; al completar o descartar la tarea se detiene solo. El total queda en `tasks.time_spent` (minutos, igual que Noise) y se puede ajustar a mano al editar la tarea. Funciones: `timer_actual`, `timer_iniciar`, `timer_detener`, `timer_ajustar`.

## Tareas

- Agregar: escribir y Enter (tecla `n` lleva al campo). Cliente, día (Hoy / Mañana / Lunes / fecha), responsable y prioridad.
- Cada tarea se abre para ver detalle, enlaces, subtareas, editar, marcar «en curso», posponer o descartar. Completar y descartar tienen «Deshacer».
- Filtros por cliente, responsable, origen (manual / agente), prioridad y texto. Se recuerdan en el navegador.
- Las tareas creadas por agentes llevan una etiqueta con su origen (Agente Pauta, Reportes, Resumen diario…).

### Contrato para los agentes (tareas manuales)

Cuando un agente o tarea programada necesita que alguien haga algo a mano, llama con service role:

```sql
select public.tarea_agente(
  p_titulo      => 'Revisar Google Ads · Siosip',
  p_origen      => 'Agente Pauta',                 -- etiqueta visible
  p_ref         => 'pauta:google:siosip:2026-11-23', -- clave estable: evita duplicados mientras la tarea siga abierta
  p_cliente     => 'Siosip',                        -- nombre aproximado; se busca en companies
  p_fecha       => current_date,                    -- opcional (por defecto hoy, hora Chile)
  p_detalle     => 'Qué hay que hacer y por qué',
  p_prioridad   => 'alta',                          -- baja | media | alta (por defecto media)
  p_enlaces     => '[{"t":"Abrir Google Ads","u":"https://ads.google.com/..."}]'
);
-- Cuando el agente detecta que ya está hecho:
select public.tarea_agente_cerrar('pauta:google:siosip:2026-11-23', 'Se ve publicado en Google Ads');
```

Si se llama de nuevo con la misma `p_ref` mientras la tarea sigue abierta, se actualiza título, detalle y enlaces, pero no se pisan fecha, prioridad ni responsable que Manuel haya cambiado. El responsable por defecto es Manuel.

Se entra con el mismo usuario y contraseña de Noise. Solo entran usuarios admin; solo quienes están en la tabla `panel_aprobadores` pueden aprobar (hoy, Manuel).

## Cómo funciona la Bandeja

1. Un agente necesita una decisión e inserta una fila en `public.aprobaciones` con estado `pendiente`.
2. Manuel la ve en la Bandeja y decide.
3. Si la fila trae acciones de Meta en `al_aprobar`, se ejecutan al aprobar (de a dos a la vez). Si falla alguna, la solicitud pasa a **Errores** con botón Reintentar.
4. Si no trae acciones, queda `aprobada` y el agente del área la toma en su próxima corrida.

Filtros: cliente (con su logo de la ficha en Noise y el número de pendientes), tipo (Pauta, Boost IG…), plataforma y fecha. Se recuerdan en el navegador.

Pestañas: **Pendientes**, **En curso** (ejecutándose, con cambio pedido o aprobadas que nunca se ejecutaron), **Errores** e **Historial**.

### Contrato para los agentes

Insertar con service role:

```sql
insert into public.aprobaciones
  (celula, cliente, titulo, detalle, enlaces, solicitado_por, al_aprobar, origen_tabla, origen_id, vence_at)
values (
  'Boost IG',                                  -- célula que pide
  'Cliente',                                   -- nombre del cliente
  'Activar Boost IG: Reel "..." (20-nov)',     -- qué se decide, en una línea
  'Reemplaza al Boost actual...',              -- contexto para decidir
  '[{"t":"Ver publicación","u":"https://..."}]',
  'Agente Boost IG (ronda del lunes)',
  '[{"cuenta":"123","accion":"reanudar_anuncio","parametros":{"ad_id":"456","nombre":"Boost IG - ..."}}]',
  'pauta_boost_rondas', '<id de la ronda>',    -- opcional: fila de origen
  now() + interval '2 days'                    -- opcional: cuándo deja de tener sentido
);
```

- `plataforma` (opcional): `Meta`, `Google`, `Instagram`, `Web` u `Otra`. Si va vacío y hay acciones, la Bandeja asume Meta. Sirve para el filtro por plataforma.
- `al_aprobar` acepta las mismas acciones que `pauta_acciones` (`reanudar_anuncio`, `pausar_anuncio`, `cargar_anuncio`, etc.). Incluye `parametros.nombre` para que la tarjeta muestre un nombre legible en vez del ID.
- Estados que el agente debe leer en su siguiente corrida: `aprobada` (sin acciones: le toca continuar), `cambios` (leer `comentario`), `rechazada`, `vencida`.
- Cuando el agente termina de atender una fila `aprobada` sin acciones o una `cambios`, la marca `atendida` y puede dejar una nota: `update public.aprobaciones set estado = 'atendida', resultado = jsonb_build_object('nota', '<qué hizo>') where id = '<id>';`
- Nada se activa en Meta sin el clic de Manuel: las funciones `bandeja_decidir` y `bandeja_accion` validan su sesión.

El esquema completo está en `supabase/migrations/`.

## Publicación

Cada cambio en `main` se compila con GitHub Actions y queda en la rama `publicado`. Plesk descarga esa rama al subdominio; el servidor no necesita Node.

### Conectar Plesk (una sola vez)

1. En el subdominio `panel.boombap.cl`, abre **Git** → agregar repositorio **remoto** con `git@github.com:boombapcl/panel.git`.
2. Plesk muestra una clave SSH pública. Pégala en GitHub: repo → Settings → **Deploy keys** → Add deploy key (solo lectura).
3. Rama **`publicado`**, modo **automático**, destino **`httpdocs`**.
4. Plesk entrega una URL de webhook. Agrégala en GitHub: Settings → **Webhooks** → Add webhook, tipo `application/json`, solo el evento *push*.
5. Activa SSL con Let's Encrypt si aún no está.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 (Bandeja en /bandeja.html, Clientes en /clientes.html, Células en /celulas.html)
npm run build    # deja el sitio en dist/
```

## Seguridad

- La clave de Supabase que va en el código es la pública (publishable). Las tablas de la bandeja y de pauta no tienen políticas: solo se llega por las funciones `bandeja*`, que revisan la sesión.
- `.htaccess` impide indexar el sitio, incrustarlo en otras páginas y cargar scripts de terceros.
- La página de Células trae embebido un respaldo de datos (nombres de clientes y descripción de las células) para cuando el espejo de Notion está vacío. Si quieres ocultarlo también a quien tenga el enlace, activa «Directorios protegidos con contraseña» en Plesk para el subdominio.

## Pendiente

- Cargar `NOTION_TOKEN` en Supabase (Edge Functions → Secrets) para que Células pase a datos en vivo.
- Sumar Tickets y programación de IG.
- Dar perfil en Noise a Rocío para poder asignarle tareas.

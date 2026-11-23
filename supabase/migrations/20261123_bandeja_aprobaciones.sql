-- Bandeja de aprobaciones del Panel Células (panel.boombap.cl)
-- Una sola cola para todo lo que necesita la decisión de Manuel.
-- Las tablas no tienen políticas: solo se llega por service role (agentes)
-- o por las funciones bandeja*, que validan al usuario con sesión.

-- 1. Quién puede aprobar ------------------------------------------------------
create table public.panel_aprobadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);
alter table public.panel_aprobadores enable row level security;
comment on table public.panel_aprobadores is
  'Usuarios que pueden aprobar o rechazar en la Bandeja. Sin políticas: solo service role y funciones bandeja*.';
insert into public.panel_aprobadores (user_id, nombre)
select id, 'Manuel' from auth.users where email = 'agencia@boombap.cl';

-- 2. La cola ------------------------------------------------------------------
create table public.aprobaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  celula text not null,
  cliente text,
  titulo text not null,
  detalle text,
  enlaces jsonb not null default '[]'::jsonb check (jsonb_typeof(enlaces) = 'array'),
  solicitado_por text not null,
  al_aprobar jsonb not null default '[]'::jsonb check (jsonb_typeof(al_aprobar) = 'array'),
  origen_tabla text,
  origen_id uuid,
  vence_at timestamptz,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aprobada','ejecutando','ejecutada','error','rechazada','cambios','vencida')),
  decidida_por uuid references auth.users(id),
  decidida_por_nombre text,
  decidida_at timestamptz,
  comentario text,
  resultado jsonb
);
alter table public.aprobaciones enable row level security;
create index aprobaciones_estado_idx on public.aprobaciones (estado, created_at);
comment on table public.aprobaciones is
  'Cola única de decisiones para Manuel (Bandeja del Panel). Los agentes insertan con estado pendiente. al_aprobar = [{cuenta, accion, parametros}] que se encolan en pauta_acciones al aprobar; si va vacío, el agente del área toma la decisión en su próxima corrida. enlaces = [{t, u}]. Sin políticas: solo service role y funciones bandeja*.';

alter table public.pauta_acciones
  add column aprobacion_id uuid references public.aprobaciones(id) on delete set null,
  add column desde_bandeja boolean not null default false,
  add column despachada_at timestamptz,
  add column revisada_at timestamptz;
create index pauta_acciones_aprobacion_idx on public.pauta_acciones (aprobacion_id) where aprobacion_id is not null;

-- 3. Funciones internas -------------------------------------------------------
create function public.bandeja_disparar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pauta_acciones set despachada_at = now() where id = p_id;
  perform net.http_post(
    url := 'https://zyldzmaeykxwildnpetx.supabase.co/functions/v1/pauta-agente',
    body := jsonb_build_object('id', p_id),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 150000);
end $$;

create function public.bandeja_recalcular(p_aprobacion uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ok int; v_err int; v_pend int; v_estado text; a aprobaciones%rowtype;
begin
  select count(*) filter (where estado = 'ejecutada'),
         count(*) filter (where estado in ('error','rechazada')),
         count(*) filter (where estado in ('pendiente','aprobada','ejecutando'))
    into v_ok, v_err, v_pend
    from pauta_acciones where aprobacion_id = p_aprobacion and revisada_at is null;
  v_estado := case when v_pend > 0 then 'ejecutando'
                   when v_err > 0 then 'error'
                   when v_ok > 0 then 'ejecutada'
                   else 'rechazada' end;
  update aprobaciones
     set estado = v_estado,
         resultado = jsonb_build_object('ejecutadas', v_ok, 'con_error', v_err, 'en_curso', v_pend, 'actualizado_at', now())
   where id = p_aprobacion and estado in ('aprobada','ejecutando','error','ejecutada')
   returning * into a;
  if found and a.origen_tabla = 'pauta_boost_rondas' and v_estado in ('ejecutada','error') then
    update pauta_boost_rondas
       set estado = case when v_estado = 'ejecutada' then 'activada' else 'error' end,
           aprobado_por = coalesce(a.decidida_por_nombre, 'Manuel') || ' en la Bandeja del Panel'
     where id = a.origen_id;
  end if;
end $$;

create function public.bandeja_sincronizar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.aprobacion_id is not null and new.estado is distinct from old.estado
     and new.estado in ('ejecutada','error','rechazada') then
    perform bandeja_recalcular(new.aprobacion_id);
  end if;
  return new;
end $$;
create trigger pauta_acciones_bandeja after update of estado on public.pauta_acciones
  for each row execute function public.bandeja_sincronizar();

-- Corre cada minuto: vence solicitudes, corta ejecuciones colgadas y despacha la cola (2 a la vez).
create function public.bandeja_despachar() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in update aprobaciones set estado = 'vencida'
            where estado = 'pendiente' and vence_at is not null and vence_at < now()
        returning origen_tabla, origen_id loop
    if r.origen_tabla = 'pauta_boost_rondas' then
      update pauta_boost_rondas set estado = 'sin_respuesta' where id = r.origen_id and estado = 'propuesta';
    end if;
  end loop;

  update pauta_acciones
     set estado = 'error', ejecutada_at = now(),
         resultado = jsonb_build_object('error', 'Sin respuesta tras 10 minutos. Revisa en Meta si alcanzó a ejecutarse antes de reintentar.')
   where estado = 'ejecutando' and desde_bandeja and despachada_at < now() - interval '10 minutes';

  if (select count(*) from pauta_acciones
       where estado = 'ejecutando' and desde_bandeja and despachada_at > now() - interval '3 minutes') < 2 then
    for r in select id from pauta_acciones
              where estado = 'aprobada' and desde_bandeja
                and (despachada_at is null or despachada_at < now() - interval '2 minutes')
              order by aprobada_at limit 2 loop
      perform bandeja_disparar(r.id);
    end loop;
  end if;
end $$;

-- 4. Funciones que usa el Panel (usuario con sesión) --------------------------
create function public.bandeja() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lectura text[] := array['revisar','inspeccionar_anuncio','listar_posts_ig'];
  v jsonb;
begin
  if v_uid is null or not has_role(v_uid, 'admin'::app_role) then
    raise exception 'Acceso solo para administradores' using errcode = '42501';
  end if;
  with ap as (
    select a.*, (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'accion', p.accion, 'estado', p.estado, 'cuenta', p.cuenta,
               'nombre', p.parametros->>'nombre', 'ad_id', p.parametros->>'ad_id',
               'error', p.resultado->>'error', 'revisada', p.revisada_at is not null,
               'vista_previa', p.resultado->'anuncio'->>'vista_previa') order by p.created_at), '[]'::jsonb)
        from pauta_acciones p where p.aprobacion_id = a.id) as acciones
    from aprobaciones a
  ), su as (
    select p.id, p.created_at, p.cuenta, c.nombre as cliente, p.accion, p.estado, p.solicitado_por,
           p.aprobada_por, p.aprobada_at, p.ejecutada_at,
           p.parametros->>'nombre' as nombre, p.parametros->>'adset_id' as adset_id,
           p.parametros->>'ad_id' as ad_id, left(p.parametros->>'mensaje', 320) as mensaje,
           p.resultado->>'error' as error, p.resultado->'anuncio'->>'vista_previa' as vista_previa
      from pauta_acciones p left join pauta_cuentas c on c.cuenta = p.cuenta
     where p.aprobacion_id is null and not (p.accion = any (v_lectura))
  )
  select jsonb_build_object(
    'ahora', now(),
    'puede_aprobar', exists (select 1 from panel_aprobadores where user_id = v_uid),
    'pendientes', coalesce((select jsonb_agg(to_jsonb(ap) order by ap.created_at) from ap where estado = 'pendiente'), '[]'::jsonb),
    'en_curso', coalesce((select jsonb_agg(to_jsonb(ap) order by ap.decidida_at desc) from ap where estado in ('aprobada','ejecutando','cambios')), '[]'::jsonb),
    'errores', coalesce((select jsonb_agg(to_jsonb(ap) order by ap.decidida_at desc) from ap where estado = 'error'), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(to_jsonb(h)) from (select * from ap where estado in ('ejecutada','rechazada','vencida') order by coalesce(decidida_at, created_at) desc limit 40) h), '[]'::jsonb),
    'acciones_en_curso', coalesce((select jsonb_agg(to_jsonb(su) order by su.created_at) from su where estado in ('pendiente','aprobada','ejecutando')), '[]'::jsonb),
    'acciones_error', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
        select su.* from su join pauta_acciones p on p.id = su.id
         where su.estado = 'error' and p.revisada_at is null and su.created_at > now() - interval '21 days'
           and not exists (select 1 from pauta_acciones o
                 where o.cuenta = su.cuenta and o.accion = su.accion and o.estado = 'ejecutada' and o.created_at >= su.created_at
                   and coalesce(o.parametros->>'nombre','') = coalesce(su.nombre,'')
                   and coalesce(o.parametros->>'adset_id','') = coalesce(su.adset_id,'')
                   and coalesce(o.parametros->>'ad_id','') = coalesce(su.ad_id,''))) e), '[]'::jsonb),
    'acciones_recientes', coalesce((select jsonb_agg(to_jsonb(r)) from (select * from su where estado = 'ejecutada' order by ejecutada_at desc limit 25) r), '[]'::jsonb)
  ) into v;
  return v;
end $$;

create function public.bandeja_decidir(p_id uuid, p_decision text, p_comentario text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_nombre text; v_sello text; v_com text := nullif(btrim(coalesce(p_comentario, '')), '');
  a aprobaciones%rowtype; act jsonb; v_new uuid; n int := 0; v_estado text;
begin
  select nombre into v_nombre from panel_aprobadores where user_id = v_uid;
  if v_nombre is null then raise exception 'Solo Manuel puede aprobar o rechazar.' using errcode = '42501'; end if;
  if p_decision not in ('aprobar','rechazar','cambios') then raise exception 'Decisión no válida.'; end if;
  select * into a from aprobaciones where id = p_id for update;
  if not found then raise exception 'La solicitud no existe.'; end if;
  if a.estado <> 'pendiente' then raise exception 'Esta solicitud ya fue resuelta (%).', a.estado; end if;
  if p_decision = 'cambios' and v_com is null then raise exception 'Escribe qué cambio necesitas.'; end if;
  v_sello := v_nombre || ' en la Bandeja del Panel (' || to_char(now() at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') || ')';

  if p_decision = 'aprobar' then
    for act in select * from jsonb_array_elements(a.al_aprobar) loop
      insert into pauta_acciones (solicitado_por, cuenta, accion, parametros, estado, aprobada_por, aprobada_at, aprobacion_id, desde_bandeja)
      values (a.solicitado_por, act->>'cuenta', act->>'accion', coalesce(act->'parametros', '{}'::jsonb), 'aprobada', v_sello, now(), a.id, true)
      returning id into v_new;
      n := n + 1;
      if n <= 2 then perform bandeja_disparar(v_new); end if;
    end loop;
    v_estado := case when n > 0 then 'ejecutando' else 'aprobada' end;
    if n = 0 and a.origen_tabla = 'pauta_boost_rondas' then
      update pauta_boost_rondas set estado = 'activada', aprobado_por = v_sello where id = a.origen_id;
    end if;
  elsif p_decision = 'rechazar' then
    v_estado := 'rechazada';
    if a.origen_tabla = 'pauta_boost_rondas' then
      update pauta_boost_rondas set estado = 'rechazada',
             notas = concat_ws(' · ', notas, 'Rechazada por ' || v_sello || coalesce(': ' || v_com, ''))
       where id = a.origen_id;
    end if;
  else
    v_estado := 'cambios';
    if a.origen_tabla = 'pauta_boost_rondas' then
      update pauta_boost_rondas set notas = concat_ws(' · ', notas, 'Cambio pedido por ' || v_sello || ': ' || v_com)
       where id = a.origen_id;
    end if;
  end if;

  update aprobaciones set estado = v_estado, decidida_por = v_uid, decidida_por_nombre = v_nombre,
         decidida_at = now(), comentario = v_com where id = a.id;
  return jsonb_build_object('ok', true, 'estado', v_estado, 'acciones', n);
end $$;

-- Acciones de pauta sueltas o con error: ejecutar ahora, reintentar o descartar.
create function public.bandeja_accion(p_id uuid, p_que text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_nombre text; v_sello text; p pauta_acciones%rowtype; v_new uuid;
begin
  select nombre into v_nombre from panel_aprobadores where user_id = v_uid;
  if v_nombre is null then raise exception 'Solo Manuel puede aprobar o rechazar.' using errcode = '42501'; end if;
  select * into p from pauta_acciones where id = p_id for update;
  if not found then raise exception 'La acción no existe.'; end if;
  v_sello := v_nombre || ' en la Bandeja del Panel (' || to_char(now() at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') || ')';

  if p_que = 'ejecutar' then
    if p.estado <> 'aprobada' then raise exception 'La acción ya no está esperando (%).', p.estado; end if;
    update pauta_acciones set desde_bandeja = true,
           aprobada_por = concat_ws(' · ', aprobada_por, 'Relanzada por ' || v_sello) where id = p.id;
    perform bandeja_disparar(p.id);
  elsif p_que = 'reintentar' then
    if p.estado <> 'error' or p.revisada_at is not null then raise exception 'Solo se reintentan acciones con error sin revisar.'; end if;
    insert into pauta_acciones (solicitado_por, cuenta, accion, parametros, estado, aprobada_por, aprobada_at, aprobacion_id, desde_bandeja)
    values (p.solicitado_por || ' · reintento', p.cuenta, p.accion, p.parametros, 'aprobada', 'Reintento aprobado por ' || v_sello, now(), p.aprobacion_id, true)
    returning id into v_new;
    update pauta_acciones set revisada_at = now() where id = p.id;
    if p.aprobacion_id is not null then update aprobaciones set estado = 'ejecutando' where id = p.aprobacion_id; end if;
    perform bandeja_disparar(v_new);
  elsif p_que = 'descartar' then
    if p.estado = 'aprobada' then
      update pauta_acciones set estado = 'rechazada', resultado = jsonb_build_object('descartada_por', v_sello) where id = p.id;
    elsif p.estado = 'error' then
      update pauta_acciones set revisada_at = now() where id = p.id;
      if p.aprobacion_id is not null then perform bandeja_recalcular(p.aprobacion_id); end if;
    else
      raise exception 'Solo se descartan acciones en espera o con error.';
    end if;
  else
    raise exception 'Operación no válida.';
  end if;
  return jsonb_build_object('ok', true, 'nueva', v_new);
end $$;

-- 5. Permisos -----------------------------------------------------------------
revoke all on function public.bandeja_disparar(uuid), public.bandeja_recalcular(uuid),
  public.bandeja_sincronizar(), public.bandeja_despachar() from public, anon, authenticated;
revoke all on function public.bandeja(), public.bandeja_decidir(uuid, text, text),
  public.bandeja_accion(uuid, text) from public, anon;
grant execute on function public.bandeja(), public.bandeja_decidir(uuid, text, text),
  public.bandeja_accion(uuid, text) to authenticated;

-- 6. Despacho cada minuto -----------------------------------------------------
select cron.schedule('bandeja-despacho', '* * * * *', $$select public.bandeja_despachar()$$);

-- Tareas en el Panel (ya aplicada en Supabase: tareas_origen_agentes, tareas_agente_no_pisar_campos,
-- panel_contadores, panel_por_cliente). Se guarda aquí como registro.

alter table public.tasks
  add column if not exists origen text,
  add column if not exists origen_ref text,
  add column if not exists aprobacion_id uuid references public.aprobaciones(id) on delete set null,
  add column if not exists enlaces jsonb not null default '[]'::jsonb check (jsonb_typeof(enlaces) = 'array'),
  add column if not exists completed_at timestamptz;

-- Un agente no puede duplicar una tarea abierta con la misma referencia.
create unique index if not exists tasks_origen_ref_abierta on public.tasks (origen_ref)
  where origen_ref is not null and status in ('pending','in_progress');

create or replace function public.tasks_marcar_completada() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then new.completed_at := now();
  elsif new.status <> 'completed' then new.completed_at := null; end if;
  return new;
end $$;
drop trigger if exists tasks_completada on public.tasks;
create trigger tasks_completada before update of status on public.tasks
  for each row execute function public.tasks_marcar_completada();

create or replace function public.cliente_id_por_nombre(p_nombre text) returns uuid
language sql stable security definer set search_path to 'public' as $$
  with n as (select lower(trim(p_nombre)) x)
  select c.id from companies c, n
   where n.x <> '' and (lower(c.name) = n.x or lower(c.name) like n.x || ' %' or n.x like lower(c.name) || ' %'
          or split_part(lower(c.name), ' ', 1) = split_part(n.x, ' ', 1))
   order by (lower(c.name) = n.x) desc, (c.status = 'activo') desc, length(c.name)
   limit 1
$$;

-- Crea o actualiza (por p_ref) una tarea manual pedida por un agente o tarea programada.
-- Al actualizar no pisa fecha, prioridad ni responsable que Manuel haya cambiado a mano.
create or replace function public.tarea_agente(
  p_titulo text, p_origen text, p_ref text, p_cliente text default null, p_fecha date default null,
  p_detalle text default null, p_responsable text default null, p_prioridad text default null,
  p_categoria text default null, p_enlaces jsonb default null, p_aprobacion uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_asig uuid; v_cli uuid := cliente_id_por_nombre(p_cliente);
begin
  if coalesce(btrim(p_titulo), '') = '' or coalesce(btrim(p_origen), '') = '' then
    raise exception 'Faltan título u origen.';
  end if;
  if p_responsable is not null then
    select p.id into v_asig from profiles p where p.full_name ilike p_responsable || '%' limit 1;
  end if;
  if p_ref is not null then
    select id into v_id from tasks where origen_ref = p_ref and status in ('pending','in_progress');
  end if;
  if v_id is not null then
    update tasks set title = p_titulo, description = coalesce(p_detalle, description),
           client_id = coalesce(client_id, v_cli), enlaces = coalesce(p_enlaces, enlaces),
           aprobacion_id = coalesce(p_aprobacion, aprobacion_id), category = coalesce(category, p_categoria)
     where id = v_id;
    return v_id;
  end if;
  if v_asig is null then
    select p.id into v_asig from profiles p where p.full_name ilike 'Manuel%' limit 1;
  end if;
  insert into tasks (title, description, type, status, priority, assigned_to, category, scheduled_date, client_id,
                     created_by, origen, origen_ref, enlaces, aprobacion_id, estimated_time)
  values (p_titulo, p_detalle, 'work', 'pending', coalesce(nullif(p_prioridad,''), 'media')::task_priority, v_asig,
          p_categoria, coalesce(p_fecha, (now() at time zone 'America/Santiago')::date)::timestamptz, v_cli,
          null, p_origen, p_ref, coalesce(p_enlaces, '[]'::jsonb), p_aprobacion, 0)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.tarea_agente_cerrar(p_ref text, p_nota text default null) returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin
  update tasks set status = 'completed',
         description = case when p_nota is null then description
                            else concat_ws(E'\n\n', description, 'Cerrada por el agente: ' || p_nota) end
   where origen_ref = p_ref and status in ('pending','in_progress');
  return found;
end $$;

-- Solo los agentes (service role) las usan.
revoke all on function public.tarea_agente(text,text,text,text,date,text,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.tarea_agente_cerrar(text,text) from public, anon, authenticated;
revoke all on function public.cliente_id_por_nombre(text) from public, anon, authenticated;

-- Contadores del riel (solo equipo).
create or replace function public.panel_contadores() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  if v_uid is null or not is_staff(v_uid) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  return jsonb_build_object(
    'bandeja', (select count(*) from aprobaciones where estado = 'pendiente'),
    'bandeja_errores', (select count(*) from aprobaciones where estado = 'error'),
    'tareas_hoy', (select count(*) from tasks where status in ('pending','in_progress') and scheduled_date is not null
                     and left(scheduled_date::text, 10)::date = v_hoy and (assigned_to = v_uid or assigned_to is null)),
    'tareas_atrasadas', (select count(*) from tasks where status in ('pending','in_progress') and scheduled_date is not null
                     and left(scheduled_date::text, 10)::date < v_hoy and (assigned_to = v_uid or assigned_to is null)));
end $$;

-- Pendientes por cliente para Células.
create or replace function public.panel_por_cliente() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is null or not is_staff(auth.uid()) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  return jsonb_build_object(
    'tareas', coalesce((select jsonb_agg(jsonb_build_object('cliente', c.name, 'abiertas', x.n, 'atrasadas', x.a))
       from (select client_id, count(*) n, count(*) filter (where scheduled_date is not null and left(scheduled_date::text,10)::date < v_hoy) a
               from tasks where status in ('pending','in_progress') and client_id is not null group by client_id) x
       join companies c on c.id = x.client_id), '[]'::jsonb),
    'decisiones', coalesce((select jsonb_agg(jsonb_build_object('cliente', cliente, 'n', n))
       from (select cliente, count(*) n from aprobaciones where estado = 'pendiente' and cliente is not null group by cliente) y), '[]'::jsonb));
end $$;
grant execute on function public.panel_contadores() to authenticated;
grant execute on function public.panel_por_cliente() to authenticated;

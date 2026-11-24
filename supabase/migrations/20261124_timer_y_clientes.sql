-- Timer de tareas guardado en la base (task_time_logs), no en el navegador:
-- funciona entre dispositivos y Noise ve el tiempo en tasks.time_spent (minutos).
-- Un timer abierto por usuario; al iniciar otro, el anterior se detiene.

create or replace function public.timer_recalcular(p_task uuid) returns void
language sql security definer set search_path to 'public' as $$
  update tasks set time_spent = coalesce((select round(sum(duration) / 60.0)::int from task_time_logs
                                           where task_id = p_task and end_time is not null), 0)
   where id = p_task;
$$;

-- Cierra los timers abiertos del usuario. Los abandonados (más de 12 h) se cierran sin sumar tiempo.
create or replace function public.timer_cerrar_abiertos(p_user uuid) returns setof uuid
language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select id, task_id, start_time from task_time_logs where user_id = p_user and end_time is null loop
    if r.start_time < now() - interval '12 hours' then
      update task_time_logs set end_time = start_time, duration = 0 where id = r.id;
    else
      update task_time_logs set end_time = now(), duration = greatest(0, extract(epoch from now() - start_time)::int) where id = r.id;
    end if;
    perform timer_recalcular(r.task_id);
    return next r.task_id;
  end loop;
end $$;

create or replace function public.timer_actual() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v jsonb;
begin
  if v_uid is null or not is_staff(v_uid) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  select jsonb_build_object('task_id', l.task_id, 'inicio', l.start_time, 'titulo', t.title,
                            'acumulado_seg', coalesce((select sum(duration) from task_time_logs x where x.task_id = l.task_id and x.end_time is not null), 0))
    into v
    from task_time_logs l join tasks t on t.id = l.task_id
   where l.user_id = v_uid and l.end_time is null and l.start_time > now() - interval '12 hours'
   order by l.start_time desc limit 1;
  return v;
end $$;

create or replace function public.timer_iniciar(p_task uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not is_staff(v_uid) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  if not exists (select 1 from tasks where id = p_task and status in ('pending','in_progress')) then
    raise exception 'La tarea no está abierta.';
  end if;
  perform timer_cerrar_abiertos(v_uid);
  insert into task_time_logs (task_id, user_id, start_time) values (p_task, v_uid, now());
  update tasks set status = 'in_progress' where id = p_task and status = 'pending';
  return timer_actual();
end $$;

create or replace function public.timer_detener() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_task uuid;
begin
  if v_uid is null or not is_staff(v_uid) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  select t into v_task from timer_cerrar_abiertos(v_uid) t limit 1;
  return jsonb_build_object('task_id', v_task,
    'tiempo_min', (select time_spent from tasks where id = v_task));
end $$;

-- Al completar o descartar una tarea, se detiene su timer (de cualquier usuario).
create or replace function public.tasks_detener_timer() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status in ('completed','cancelled') and old.status is distinct from new.status then
    update task_time_logs set end_time = case when start_time < now() - interval '12 hours' then start_time else now() end,
           duration = case when start_time < now() - interval '12 hours' then 0 else greatest(0, extract(epoch from now() - start_time)::int) end
     where task_id = new.id and end_time is null;
    if found then perform timer_recalcular(new.id); end if;
  end if;
  return null;
end $$;
drop trigger if exists tasks_detener_timer on public.tasks;
create trigger tasks_detener_timer after update of status on public.tasks
  for each row execute function public.tasks_detener_timer();

revoke all on function public.timer_recalcular(uuid), public.timer_cerrar_abiertos(uuid) from public, anon, authenticated;
revoke all on function public.timer_actual(), public.timer_iniciar(uuid), public.timer_detener() from public, anon;
grant execute on function public.timer_actual(), public.timer_iniciar(uuid), public.timer_detener() to authenticated;

-- Ficha de clientes para el Panel (matriz de Noise): datos, contactos, servicios, facturación,
-- cuentas de pauta (sin tokens) y pendientes. Solo equipo.
create or replace function public.panel_clientes() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is null or not is_staff(auth.uid()) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'nombre', c.name, 'razon_social', c.razon_social, 'rut', c.rut, 'rubro', coalesce(nullif(c.other_industry,''), c.industry),
      'region', c.region, 'comuna', c.comuna, 'estado', c.status, 'tamano', c.company_size, 'web', c.website_domain,
      'logo', coalesce(c.dashboard_logo_url, c.logo_url), 'color', c.dashboard_brand_color,
      'drive_ads', c.google_drive_ads_folder, 'drive_facturas', c.google_drive_billing_folder,
      'meta', c.meta_connection_status, 'creado', c.created_at,
      'contactos', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nombre', k.full_name, 'cargo', k.position, 'email', k.email, 'telefono', k.phone, 'rol', k.role) order by k.role, k.full_name)
                             from contacts k where k.company_id = c.id), '[]'),
      'servicios', coalesce((select jsonb_agg(jsonb_build_object('nombre', s.service_name, 'tipo', s.service_type, 'recurrencia', s.recurrence_type, 'estado', s.status,
                                     'monto', s.contracted_amount, 'inicio', s.start_date, 'renovacion', s.renewal_date) order by s.status, s.service_name)
                             from contracted_services s where s.company_id = c.id), '[]'),
      'facturacion', coalesce((select jsonb_agg(jsonb_build_object('nombre', b.contact_name, 'correos', b.billing_emails, 'telefono', b.phone))
                             from billing_contacts b where b.client_id = c.id), '[]'),
      'pauta', coalesce((select jsonb_agg(jsonb_build_object('cuenta', p.cuenta, 'nombre', p.nombre, 'slack', p.slack_canal, 'escritura', p.escritura, 'boost', p.boost_activo))
                             from pauta_cuentas p where p.client_id = c.id), '[]'),
      'tareas', (select count(*) from tasks t where t.client_id = c.id and t.status in ('pending','in_progress')),
      'atrasadas', (select count(*) from tasks t where t.client_id = c.id and t.status in ('pending','in_progress')
                      and t.scheduled_date is not null and left(t.scheduled_date::text,10)::date < v_hoy),
      'hechas_30', (select count(*) from tasks t where t.client_id = c.id and t.status = 'completed' and t.completed_at > now() - interval '30 days'),
      'minutos_30', (select coalesce(sum(l.duration),0)/60 from task_time_logs l join tasks t on t.id = l.task_id
                      where t.client_id = c.id and l.end_time > now() - interval '30 days')
    ) order by c.status, c.name) from companies c), '[]'::jsonb);
end $$;
grant execute on function public.panel_clientes() to authenticated;

-- Ajuste manual del tiempo total de una tarea: agrega un registro de corrección (puede ser negativo).
create or replace function public.timer_ajustar(p_task uuid, p_minutos int) returns int
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_actual int;
begin
  if v_uid is null or not is_staff(v_uid) then raise exception 'Acceso solo para el equipo' using errcode = '42501'; end if;
  if p_minutos is null or p_minutos < 0 or p_minutos > 100000 then raise exception 'Minutos fuera de rango.'; end if;
  select coalesce(sum(duration), 0) into v_actual from task_time_logs where task_id = p_task and end_time is not null;
  if p_minutos * 60 <> v_actual then
    insert into task_time_logs (task_id, user_id, start_time, end_time, duration)
    values (p_task, v_uid, now(), now(), p_minutos * 60 - v_actual);
  end if;
  perform timer_recalcular(p_task);
  return (select time_spent from tasks where id = p_task);
end $$;
revoke all on function public.timer_ajustar(uuid, int) from public, anon;
grant execute on function public.timer_ajustar(uuid, int) to authenticated;

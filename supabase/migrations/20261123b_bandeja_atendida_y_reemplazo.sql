-- Estado «atendida»: el agente resolvió un cambio pedido o una aprobación sin acciones.
alter table public.aprobaciones drop constraint aprobaciones_estado_check;
alter table public.aprobaciones add constraint aprobaciones_estado_check
  check (estado in ('pendiente','aprobada','ejecutando','ejecutada','error','rechazada','cambios','vencida','atendida'));
-- (bandeja() incluye 'atendida' en el historial; ver 20261123_bandeja_aprobaciones.sql)

-- Si un agente crea una nueva propuesta para el mismo origen, la anterior queda atendida.
create function public.aprobaciones_reemplazar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.origen_tabla is not null and new.origen_id is not null then
    update aprobaciones
       set estado = 'atendida',
           resultado = coalesce(resultado, '{}'::jsonb) || jsonb_build_object('nota', 'Reemplazada por una nueva propuesta del agente.')
     where origen_tabla = new.origen_tabla and origen_id = new.origen_id
       and id <> new.id and estado in ('pendiente','cambios');
  end if;
  return new;
end $$;
revoke all on function public.aprobaciones_reemplazar() from public, anon, authenticated;
create trigger aprobaciones_reemplazo after insert on public.aprobaciones
  for each row execute function public.aprobaciones_reemplazar();

-- Publicaciones IG: aviso de publicación exitosa sin mención a Manuel (los errores sí mencionan).

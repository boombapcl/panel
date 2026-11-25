-- Si una acción de Meta que falló se reintenta con éxito, el error anterior queda revisado solo
-- (así el Resumen diario y la Bandeja cuentan los mismos errores).
create or replace function public.pauta_acciones_cerrar_errores_previos() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.estado = 'ejecutada' and old.estado is distinct from 'ejecutada' then
    update pauta_acciones set revisada_at = now()
     where estado = 'error' and revisada_at is null and id <> new.id
       and cuenta = new.cuenta and accion = new.accion
       and coalesce(parametros->>'nombre', parametros->>'ad_id', '') = coalesce(new.parametros->>'nombre', new.parametros->>'ad_id', '');
  end if;
  return null;
end $$;
drop trigger if exists pauta_acciones_cerrar_errores_previos on public.pauta_acciones;
create trigger pauta_acciones_cerrar_errores_previos after update of estado on public.pauta_acciones
  for each row execute function public.pauta_acciones_cerrar_errores_previos();
revoke all on function public.pauta_acciones_cerrar_errores_previos() from public, anon, authenticated;

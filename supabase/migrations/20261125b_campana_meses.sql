-- Número de mes de campaña por cliente (el «Mes N» de los planificadores). Punto de partida + 1 por ciclo.
create table if not exists public.campana_meses (
  cliente text primary key,
  ciclo_base date not null,
  mes_base int not null check (mes_base > 0),
  notas text,
  updated_at timestamptz not null default now()
);
alter table public.campana_meses enable row level security;
create policy "Equipo lee meses de campaña" on public.campana_meses for select to authenticated using (is_staff(auth.uid()));
create policy "Admin edita meses de campaña" on public.campana_meses for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
insert into public.campana_meses (cliente, ciclo_base, mes_base, notas) values
  ('Alimor', '2026-12-01', 5, 'Planificador Alimor: Mes 5 = Diciembre 2026'),
  ('Mejac', '2026-12-01', 29, 'Planificador Mejac: Mes 29 = Diciembre 2026'),
  ('Ventanas 2001', '2026-12-01', 55, 'Mes 54 = Noviembre 2026'),
  ('Carillon', '2026-12-01', 58, 'Mes 57 = Noviembre 2026'),
  ('Donem', '2026-12-01', 39, 'Mes 38 = Noviembre 2026'),
  ('Krat', '2026-12-01', 26, 'Planificador Krat: Mes 26 = Diciembre 2026')
on conflict (cliente) do nothing;
create or replace function public.mes_campana(p_cliente text, p_ciclo date) returns int
language sql stable security definer set search_path to 'public' as $$
  select m.mes_base + ((extract(year from p_ciclo) - extract(year from m.ciclo_base)) * 12
                       + (extract(month from p_ciclo) - extract(month from m.ciclo_base)))::int
    from campana_meses m
   where lower(p_cliente) = lower(m.cliente) or lower(p_cliente) like lower(m.cliente) || ' %'
      or split_part(lower(p_cliente), ' ', 1) = split_part(lower(m.cliente), ' ', 1)
   order by (lower(p_cliente) = lower(m.cliente)) desc limit 1
$$;
grant execute on function public.mes_campana(text, date) to authenticated;

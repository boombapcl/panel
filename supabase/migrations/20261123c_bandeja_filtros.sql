-- Filtros de la Bandeja: plataforma por decisión y lista de clientes con logo.
alter table public.aprobaciones
  add column plataforma text check (plataforma in ('Meta','Google','Instagram','Web','Otra'));
-- bandeja() ahora devuelve 'clientes' (companies activos con logo), plataforma_efectiva y celula
-- en cada fila, y un historial de 90 días (hasta 200). Ver la función en la base.

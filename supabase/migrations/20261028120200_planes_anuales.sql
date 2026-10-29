-- Ciclo de facturación y planes anuales (2 meses gratis).
alter table public.planes
  add column ciclo text not null default 'mensual'
  check (ciclo in ('mensual', 'anual'));

insert into public.planes (id, nombre, descripcion, precio_cop, caracteristicas, orden, ciclo)
select
  p.id || '_anual',
  p.nombre || ' Anual',
  'Pago anual · 2 meses gratis',
  a.precio_cop,
  p.caracteristicas,
  p.orden + 10,
  'anual'
from public.planes p
join (values ('basico', 499900), ('pro', 899900)) as a (id, precio_cop) on a.id = p.id
on conflict (id) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  precio_cop = excluded.precio_cop,
  caracteristicas = excluded.caracteristicas,
  orden = excluded.orden,
  ciclo = excluded.ciclo,
  activo = true;

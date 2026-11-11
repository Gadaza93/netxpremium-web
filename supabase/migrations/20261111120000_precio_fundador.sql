-- Precio fundador de NexoBar: los primeros 20 bares pagan menos y conservan ese precio mientras sigan renovando.
-- crear-compra decide el precio: si el correo ya pagó como fundador, o si quedan cupos, cobra precio_fundador_cop.
-- Los cupos se cuentan por correo en compras pagadas o entregadas con precio_fundador (más las pendientes de los
-- últimos 30 minutos, para no regalar cupos a dos pagos simultáneos).
alter table public.planes
  add column if not exists precio_fundador_cop integer check (precio_fundador_cop is null or precio_fundador_cop > 0);

update public.planes p
set precio_fundador_cop = v.precio
from (values ('basico', 39990), ('pro', 69990), ('basico_anual', 399900), ('pro_anual', 699900)) as v (id, precio)
where p.id = v.id;

alter table public.compras
  add column if not exists precio_fundador boolean not null default false;

create index if not exists compras_fundador_idx on public.compras (email) where precio_fundador;

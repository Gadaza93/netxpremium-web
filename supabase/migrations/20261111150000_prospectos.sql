-- CRM de ventas de Netxpremium (pestaña Ventas de netxpremium.com/central). Aplicado el 11-11-2026 en el proyecto de
-- NexoBar (el proyecto «central»: compras de la web y precio fundador). Sin business_id: no pertenece a ningún negocio.
-- Solo el superadmin la lee y escribe. Los 64 prospectos iniciales (Google Maps, 10-11-2026) se cargaron aparte.
create table if not exists public.prospectos (
  id text primary key check (id ~ '^[a-z0-9_.-]{3,80}$'),
  nombre text not null,
  ciudad text not null default '',
  direccion text not null default '',
  tipo text not null default '',
  producto text not null default 'NexoBar' check (producto in ('NexoBar', 'NexoPos', 'Nexo Retail')),
  modalidad text not null default '',
  telefono text not null default '',
  web text not null default '',
  calificacion numeric(2,1),
  resenas integer not null default 0,
  prioridad text not null default 'Media' check (prioridad in ('Alta', 'Media', 'Baja')),
  estado text not null default 'Prospecto' check (estado in ('Prospecto', 'Contactado', 'Cita', 'Demo hecha', 'Cliente', 'Descartado')),
  proxima date,
  notas text not null default '',
  mensaje1 text not null default '',
  mensaje2 text not null default '',
  mensaje3 text not null default '',
  fuente text not null default '',
  sistema text,
  negocio_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prospectos_estado_idx on public.prospectos (estado, proxima);
create index if not exists prospectos_telefono_idx on public.prospectos (telefono) where telefono <> '';
alter table public.prospectos enable row level security;
create policy prospectos_superadmin_all on public.prospectos for all to authenticated
  using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'superadmin')
  with check ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'superadmin');
revoke all on public.prospectos from anon;
grant select, insert, update, delete on public.prospectos to authenticated;
create or replace function public.prospectos_tocar() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
create trigger prospectos_tocar before update on public.prospectos for each row execute function public.prospectos_tocar();

-- Compras de NexoBar POS desde la landing (pago con Wompi).
-- Solo las Edge Functions (crear-compra y wompi-webhook) leen y escriben estas tablas
-- con la clave secreta; el navegador nunca accede a ellas directamente.

create table public.planes (
  id text primary key,
  nombre text not null,
  descripcion text not null default '',
  precio_cop integer not null check (precio_cop > 0),
  caracteristicas text[] not null default '{}',
  orden smallint not null default 0,
  activo boolean not null default true
);

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique,
  plan_id text not null references public.planes (id),
  monto_cop integer not null check (monto_cop > 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'rechazado', 'entregado')),

  comercio text not null,
  documento_tipo text not null check (documento_tipo in ('NIT', 'CC', 'CE')),
  documento text not null,
  responsable text not null,
  email text not null,
  telefono text not null,
  ciudad text not null,
  acepta_marketing boolean not null default false,

  wompi_transaccion_id text,
  wompi_estado text,
  metodo_pago text,
  pagado_at timestamptz,
  alerta_enviada_at timestamptz,
  entregado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Postgres no indexa las llaves foráneas automáticamente
create index compras_plan_id_idx on public.compras (plan_id);
-- Bandeja de trabajo: "compras pagadas pendientes de entregar, las más recientes primero"
create index compras_estado_created_at_idx on public.compras (estado, created_at desc);

create or replace function public.compras_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger compras_touch_updated_at
before update on public.compras
for each row execute function public.compras_touch_updated_at();

-- RLS activo y sin políticas: anon y authenticated no ven ni modifican nada.
-- La clave secreta de las Edge Functions omite RLS.
alter table public.planes enable row level security;
alter table public.compras enable row level security;

revoke all on public.planes from anon, authenticated;
revoke all on public.compras from anon, authenticated;
revoke execute on function public.compras_touch_updated_at() from public, anon, authenticated;

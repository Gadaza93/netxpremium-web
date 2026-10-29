-- Entrega automática: al aprobarse un pago, wompi-webhook crea el comercio y su usuario
-- (o renueva el existente si el correo ya tiene cuenta) y envía las credenciales.

alter table public.compras
  add column negocio_id text references public.negocios (id) on delete set null,
  add column usuario_id uuid,
  add column es_renovacion boolean,
  add column provision_error text,
  add column cliente_notificado_at timestamptz;

-- Postgres no indexa las llaves foráneas automáticamente
create index compras_negocio_id_idx on public.compras (negocio_id);

-- Usuario y comercio de NexoBar asociados a un correo. SECURITY DEFINER para leer auth.users;
-- solo la clave secreta de las Edge Functions puede ejecutarla.
create or replace function public.provision_buscar_cuenta(p_email text)
returns table (usuario_id uuid, negocio_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.raw_app_meta_data ->> 'business_id'
  from auth.users u
  where u.email = lower(trim(p_email))
  limit 1;
$$;

-- Crea el comercio igual que admin_create_negocio: configuracion vacía, la app la completa al vincularse
create or replace function public.provision_crear_negocio(p_id text, p_nombre text, p_telefono text, p_plan text, p_meses integer)
returns timestamptz
language sql
set search_path = ''
as $$
  insert into public.negocios (id, nombre, telefono, activo, plan, fecha_vencimiento)
  values (p_id, p_nombre, p_telefono, true, p_plan, now() + make_interval(months => p_meses))
  returning fecha_vencimiento;
$$;

-- Renueva desde hoy o desde el vencimiento actual, lo que sea posterior (no se pierden días pagados)
create or replace function public.provision_renovar_negocio(p_id text, p_plan text, p_meses integer)
returns timestamptz
language sql
set search_path = ''
as $$
  update public.negocios
  set activo = true,
      plan = p_plan,
      fecha_vencimiento = greatest(coalesce(fecha_vencimiento, now()), now()) + make_interval(months => p_meses)
  where id = p_id
  returning fecha_vencimiento;
$$;

revoke execute on function public.provision_buscar_cuenta(text) from public, anon, authenticated;
revoke execute on function public.provision_crear_negocio(text, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.provision_renovar_negocio(text, text, integer) from public, anon, authenticated;
grant execute on function public.provision_buscar_cuenta(text) to service_role;
grant execute on function public.provision_crear_negocio(text, text, text, text, integer) to service_role;
grant execute on function public.provision_renovar_negocio(text, text, integer) to service_role;

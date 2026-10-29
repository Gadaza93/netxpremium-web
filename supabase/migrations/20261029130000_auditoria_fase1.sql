-- Auditoría fase 1: bloqueo por compra, prorrateo de cambios de plan, posibles duplicados,
-- límite de compras por IP y barrido programado de entregas pendientes.

alter table public.compras
  add column procesando_hasta timestamptz,
  add column duplicado_de text,
  add column ip text;

-- Límite de compras por IP en crear-compra
create index compras_ip_created_at_idx on public.compras (ip, created_at desc);

-- Bloqueo atómico: solo una invocación del webhook procesa cada compra a la vez.
-- El UPDATE bloquea la fila; una invocación concurrente reevalúa el WHERE al liberarse y no la toma.
-- El plazo evita que una función caída deje la compra bloqueada para siempre.
create or replace function public.compras_reclamar(p_referencia text, p_segundos integer default 120)
returns boolean
language sql
set search_path = ''
as $$
  with reclamada as (
    update public.compras
    set procesando_hasta = now() + make_interval(secs => p_segundos)
    where referencia = p_referencia
      and estado in ('pagado', 'entregado')
      and (procesando_hasta is null or procesando_hasta < now())
    returning 1
  )
  select exists (select 1 from reclamada);
$$;

create or replace function public.compras_liberar(p_referencia text)
returns void
language sql
set search_path = ''
as $$
  update public.compras set procesando_hasta = null where referencia = p_referencia;
$$;

-- Renovación con prorrateo: el saldo vigente se convierte al plan nuevo según el precio mensual
-- de cada plan, y luego se suman los meses comprados. Mismo plan → equivale a sumar al vencimiento.
--   Básico con 15 días → Pro: 15 × 49.990 / 89.990 ≈ 8,3 días de Pro + los meses comprados.
--   Pro con 200 días → Básico: 200 × 89.990 / 49.990 ≈ 360 días de Básico + los meses comprados.
create or replace function public.provision_renovar_negocio(p_id text, p_plan text, p_meses integer)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  v_plan_actual text;
  v_vence timestamptz;
  v_precio_actual numeric;
  v_precio_nuevo numeric;
  v_saldo interval := interval '0';
begin
  select replace(lower(coalesce(plan, '')), 'á', 'a'), fecha_vencimiento
  into v_plan_actual, v_vence
  from public.negocios
  where id = p_id
  for update;

  if not found then
    return null;
  end if;

  if v_vence > now() then
    v_saldo := v_vence - now();
    select precio_cop into v_precio_actual from public.planes where id = v_plan_actual and ciclo = 'mensual';
    select precio_cop into v_precio_nuevo from public.planes where id = p_plan and ciclo = 'mensual';
    if v_precio_actual > 0 and v_precio_nuevo > 0 and v_precio_actual <> v_precio_nuevo then
      v_saldo := v_saldo * (v_precio_actual / v_precio_nuevo)::double precision;
    end if;
  end if;

  update public.negocios
  set activo = true,
      plan = p_plan,
      fecha_vencimiento = now() + v_saldo + make_interval(months => p_meses)
  where id = p_id
  returning fecha_vencimiento into v_vence;

  return v_vence;
end;
$$;

revoke execute on function public.compras_reclamar(text, integer) from public, anon, authenticated;
revoke execute on function public.compras_liberar(text) from public, anon, authenticated;
revoke execute on function public.provision_renovar_negocio(text, text, integer) from public, anon, authenticated;
grant execute on function public.compras_reclamar(text, integer) to service_role;
grant execute on function public.compras_liberar(text) to service_role;
grant execute on function public.provision_renovar_negocio(text, text, integer) to service_role;

-- Barrido cada 10 minutos: reintenta correos y alertas que no salieron (p. ej. Resend caído)
-- sin esperar los reintentos de Wompi (30 min, 3 h, 24 h). El secreto vive en Vault, no aquí:
--   select vault.create_secret('<valor de BARRIDO_SECRET>', 'barrido_secret');
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'nexobar-reintentar-entregas',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://fthjtbhxqqzqpyhtynaa.supabase.co/functions/v1/wompi-webhook?barrido=1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-barrido-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'barrido_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.compras
    where estado in ('pagado', 'entregado')
      and pagado_at > now() - interval '3 days'
      and (cliente_notificado_at is null or alerta_enviada_at is null)
  );
  $$
);

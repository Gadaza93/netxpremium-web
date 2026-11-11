-- Panel central (netxpremium.com/central): el superadmin lee las compras de NexoBar (NexoPos ya tenía esta política). Aplicado el 11-11-2026.
create policy compras_superadmin_select on public.compras for select to authenticated
  using ((select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'superadmin');

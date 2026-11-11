-- Qué usa hoy cada prospecto (cuaderno, registradora o programa de la competencia). Aplicado el 11-11-2026.
alter table public.prospectos add column if not exists sistema_actual text not null default '';

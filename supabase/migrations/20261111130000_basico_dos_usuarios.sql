-- El Plan Básico de NexoBar pasa de 1 a 2 usuarios (administrador + cajero o mesero). Aplicado el 11-11-2026.
update public.planes
set caracteristicas = array_replace(caracteristicas, '1 usuario (cajero/administrador)', '2 usuarios (administrador + cajero o mesero)')
where id in ('basico', 'basico_anual');

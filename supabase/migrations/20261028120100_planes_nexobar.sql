-- Planes de suscripción mensual de NexoBar POS.
-- La landing y crear-compra leen precios y características de esta tabla.
insert into public.planes (id, nombre, descripcion, precio_cop, caracteristicas, orden) values
  (
    'basico',
    'Plan Básico',
    'Pago mensual',
    49990,
    array[
      'Hasta 10 mesas',
      'Facturación, POS y control de stock simple',
      'Cierre de caja y ventas del día',
      'Interfaz tradicional en lista',
      '1 usuario (cajero/administrador)',
      'Soporte por WhatsApp'
    ],
    1
  ),
  (
    'pro',
    'Plan Pro',
    'Pago mensual',
    89990,
    array[
      'Mesas ilimitadas',
      'Facturación y POS',
      'Valoración de inventario y exportaciones',
      'Analítica de ganancias netas y control de gastos',
      'Mapa de layout de mesas interactivo',
      'Múltiples roles de usuario',
      'Soporte prioritario por WhatsApp'
    ],
    2
  )
on conflict (id) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  precio_cop = excluded.precio_cop,
  caracteristicas = excluded.caracteristicas,
  orden = excluded.orden,
  activo = true;

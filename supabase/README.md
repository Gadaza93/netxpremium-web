# Compra de NexoBar POS (Wompi + Supabase)

Flujo:

1. En `/nexobar`, el cliente elige un plan (o abre **Ingresar → NexoBar → Comprar**) y llena los datos de su comercio.
2. `crear-compra` registra la compra como `pendiente` y devuelve el enlace firmado al Web Checkout de Wompi.
3. El cliente paga en Wompi y vuelve a `/pago`, que le muestra el estado.
4. Wompi avisa a `wompi-webhook`. La función verifica la firma, marca la compra como `pagado` y luego:
   1. **Provisión.** Si el correo no tiene cuenta, crea el comercio en `negocios` (ID tipo `bar-la-esquina-7f3a`, plan, vencimiento a 1 o 12 meses) y su usuario con `business_id` en `app_metadata`. Si el correo ya tiene cuenta, **renueva** su comercio: suma los meses desde hoy o desde el vencimiento actual, lo que sea posterior.
   2. **Correo al cliente.** Un comercio nuevo recibe sus credenciales con una contraseña temporal. Una renovación recibe la nueva fecha de vencimiento.
   3. **Alerta a soporte@netxpremium.com:** ✅ comercio creado, 🔁 renovación o ⚠️ error.
5. La compra queda `entregado`. Si la provisión falla, la compra queda `pagado` con `provision_error`, el cliente recibe "Recibimos tu pago" y tú recibes la alerta ⚠️ para crearlo a mano desde el panel.

Cada paso queda marcado (`negocio_id`/`provision_error`, `cliente_notificado_at`, `alerta_enviada_at`), así que los reintentos de Wompi nunca duplican comercios ni correos.

## 1. Cuentas externas

**Wompi** (comercios.wompi.co). Sección *Desarrolladores*:
- Llave pública (`pub_prod_…`, o `pub_test_…` en Sandbox).
- Secreto de **integridad**.
- Secreto de **eventos**.
- En la URL de eventos, pon `https://fthjtbhxqqzqpyhtynaa.supabase.co/functions/v1/wompi-webhook`.

**Resend** (resend.com):
- Verifica el dominio `netxpremium.com`. Los registros DNS se agregan en Cloudflare.
- Crea una API key.

## 2. Base de datos

Ejecuta las migraciones en orden. Puedes hacerlo con `supabase db push` o pegándolas en el SQL Editor de Supabase:

1. `migrations/20261028120000_compras_nexobar.sql` crea las tablas `planes` y `compras`.
2. `migrations/20261028120100_planes_nexobar.sql` carga el Plan Básico ($ 49.990) y el Plan Pro ($ 89.990).
3. `migrations/20261028120200_planes_anuales.sql` agrega la columna `ciclo` y los planes anuales: `basico_anual` ($ 499.900) y `pro_anual` ($ 899.900).
4. `migrations/20261029120000_provision_negocios.sql` agrega las columnas de entrega en `compras` y las funciones `provision_*`, que solo puede ejecutar el webhook.

Los precios se cambian en la tabla `planes` y la landing los toma de ahí. Para ocultar un plan, pon `activo = false`.

## Publicación en Cloudflare

Esta carpeta no debe quedar publicada en la web:

- `_redirects`, en la raíz, redirige `/supabase/*` al inicio. Funciona en Cloudflare Pages y en Workers. En Cloudflare las redirecciones tienen prioridad sobre los archivos.
- `.assetsignore` hace que Workers ni siquiera suba la carpeta.

## 3. Edge Functions

```bash
supabase functions deploy crear-compra --no-verify-jwt
supabase functions deploy wompi-webhook --no-verify-jwt

supabase secrets set \
  WOMPI_PUBLIC_KEY=pub_prod_xxx \
  WOMPI_INTEGRITY_SECRET=prod_integrity_xxx \
  WOMPI_EVENTS_SECRET=prod_events_xxx \
  WOMPI_ENVIRONMENT=prod \
  WOMPI_REDIRECT_URL=https://netxpremium.com/pago \
  ALLOWED_ORIGINS=https://netxpremium.com,https://www.netxpremium.com \
  RESEND_API_KEY=re_xxx \
  ALERTA_EMAIL_FROM="NexoBar POS <pagos@netxpremium.com>" \
  ALERTA_EMAIL_TO=soporte@netxpremium.com
```

`--no-verify-jwt` se usa porque el visitante de la landing y Wompi no tienen sesión de Supabase. La seguridad la dan dos cosas:
- el precio se lee del servidor;
- la firma del webhook se verifica con el secreto de eventos.

## 4. Conectar la landing

- En `nexobar.html`, `NEXOBAR_COMPRA_API` ya apunta a `https://fthjtbhxqqzqpyhtynaa.supabase.co/functions/v1/crear-compra`.
- En `pago.html`, `WOMPI_API` debe apuntar a `https://production.wompi.co/v1`. En pruebas usa `https://sandbox.wompi.co/v1`.

## 5. Probar en Sandbox

1. Usa las llaves `test` de Wompi y `WOMPI_ENVIRONMENT=test`.
2. Compra con las tarjetas de prueba de Wompi:
   - `4242 4242 4242 4242` → aprobada.
   - `4111 1111 1111 1111` → rechazada.
3. Verifica que llegue el correo y que la fila en `compras` pase a `pagado`.

## Operación diaria

La entrega es automática. Solo revisa las compras que quedaron con error (llega una alerta ⚠️):

```sql
select referencia, comercio, responsable, email, telefono, plan_id, monto_cop, provision_error, pagado_at
from public.compras
where estado = 'pagado'
order by pagado_at;
```

Últimas compras entregadas:

```sql
select referencia, comercio, email, plan_id, negocio_id, es_renovacion, entregado_at
from public.compras
where estado = 'entregado'
order by entregado_at desc
limit 20;
```

Después de crear a mano un comercio que falló:

```sql
update public.compras set estado = 'entregado', entregado_at = now() where referencia = 'NXB-…';
```

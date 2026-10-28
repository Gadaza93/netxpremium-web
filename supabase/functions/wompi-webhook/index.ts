// wompi-webhook
// Recibe el evento transaction.updated de Wompi, verifica su firma y actualiza la compra.
// Cuando el pago queda APROBADO envía la alerta a NetxPremium (y una confirmación al
// cliente) para crear el comercio y entregar las credenciales.
// Wompi reintenta el evento si la respuesta no es 200, así que todo es idempotente.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey(), {
  auth: { persistSession: false },
});

function getSecretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const first = Object.values(keys)[0];
    if (typeof first === 'string') return first;
  } catch (_) { /* proyecto con claves legacy */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// "transaction.amount_in_cents" → data.transaction.amount_in_cents
function valueAt(data: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    data,
  );
  return value === undefined || value === null ? '' : String(value);
}

async function firmaValida(event: WompiEvent): Promise<boolean> {
  const properties = event.signature?.properties ?? [];
  const checksum = event.signature?.checksum ?? '';
  if (!properties.length || !checksum) return false;

  const concatenado = properties.map((p) => valueAt(event.data, p)).join('')
    + String(event.timestamp)
    + Deno.env.get('WOMPI_EVENTS_SECRET');

  return (await sha256Hex(concatenado)) === checksum.toLowerCase();
}

function escapeHtml(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

const cop = (valor: number) => `$ ${valor.toLocaleString('es-CO')} COP`;

async function enviarCorreo(to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('ALERTA_EMAIL_FROM'),
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

type Compra = {
  referencia: string;
  plan_id: string;
  monto_cop: number;
  comercio: string;
  documento_tipo: string;
  documento: string;
  responsable: string;
  email: string;
  telefono: string;
  ciudad: string;
  acepta_marketing: boolean;
  metodo_pago: string | null;
  wompi_transaccion_id: string | null;
  pagado_at: string;
  planes: { nombre: string } | null;
};

async function enviarAlertas(compra: Compra): Promise<void> {
  const plan = compra.planes?.nombre ?? compra.plan_id;
  const filas: [string, string][] = [
    ['Comercio', compra.comercio],
    ['Documento', `${compra.documento_tipo} ${compra.documento}`],
    ['Responsable', compra.responsable],
    ['Correo', compra.email],
    ['Celular', `+57 ${compra.telefono}`],
    ['Ciudad', compra.ciudad],
    ['Plan', plan],
    ['Valor pagado', cop(compra.monto_cop)],
    ['Medio de pago', compra.metodo_pago ?? '—'],
    ['Referencia', compra.referencia],
    ['Transacción Wompi', compra.wompi_transaccion_id ?? '—'],
    ['Acepta información comercial', compra.acepta_marketing ? 'Sí' : 'No'],
  ];

  const tabla = filas.map(([k, v]) => (
    `<tr><td style="padding:6px 12px;color:#64748b">${escapeHtml(k)}</td><td style="padding:6px 12px"><strong>${escapeHtml(v)}</strong></td></tr>`
  )).join('');

  await enviarCorreo(
    Deno.env.get('ALERTA_EMAIL_TO')!,
    `💰 Nuevo pago NexoBar: ${compra.comercio} (${plan})`,
    `<h2>Nuevo pago aprobado de NexoBar POS</h2>
     <p>Crea el comercio y entrega las credenciales al cliente.</p>
     <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${tabla}</table>
     <p style="color:#64748b;font-size:12px">Cuando entregues las credenciales, marca la compra como <code>entregado</code> en la tabla <code>compras</code> de Supabase.</p>`,
    compra.email,
  );

  // La confirmación al cliente es informativa: si falla no se reintenta todo el evento
  try {
    await enviarCorreo(
      compra.email,
      'Recibimos tu pago de NexoBar POS',
      `<p>Hola ${escapeHtml(compra.responsable)},</p>
       <p>Confirmamos el pago de <strong>${escapeHtml(plan)}</strong> por <strong>${escapeHtml(cop(compra.monto_cop))}</strong> para <strong>${escapeHtml(compra.comercio)}</strong>.</p>
       <p>Estamos creando tu comercio en NexoBar POS. Te enviaremos las credenciales de acceso a este correo y por WhatsApp al +57 ${escapeHtml(compra.telefono)}.</p>
       <p>Referencia de pago: <strong>${escapeHtml(compra.referencia)}</strong></p>
       <p>¿Dudas? Escríbenos a soporte@netxpremium.com o al WhatsApp +57 305 248 4278.</p>
       <p>— Equipo NetxPremium</p>`,
      Deno.env.get('ALERTA_EMAIL_TO')!,
    );
  } catch (err) {
    console.error('correo cliente', err);
  }
}

type WompiEvent = {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp: number;
};

type WompiTransaction = {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
};

const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  let event: WompiEvent;
  try {
    event = await req.json();
  } catch (_) {
    return new Response('JSON no válido', { status: 400 });
  }

  if (!(await firmaValida(event))) {
    console.warn('Evento con firma inválida descartado');
    return new Response('Firma inválida', { status: 401 });
  }

  const ambienteEsperado = Deno.env.get('WOMPI_ENVIRONMENT');
  if (event.event !== 'transaction.updated' || (ambienteEsperado && event.environment !== ambienteEsperado)) {
    return ok();
  }

  const tx = event.data.transaction as WompiTransaction;

  const { data: compra, error } = await supabase
    .from('compras')
    .select('referencia, monto_cop, estado')
    .eq('referencia', tx.reference)
    .maybeSingle();

  if (error) {
    console.error('compras.select', error);
    return new Response('Error de base de datos', { status: 500 });
  }
  if (!compra) {
    console.warn('Referencia desconocida', tx.reference);
    return ok();
  }

  const datosWompi = {
    wompi_transaccion_id: tx.id,
    wompi_estado: tx.status,
    metodo_pago: tx.payment_method_type ?? null,
  };

  if (tx.status === 'APPROVED') {
    if (tx.currency !== 'COP' || tx.amount_in_cents !== compra.monto_cop * 100) {
      console.error('Monto no coincide', tx.reference, tx.amount_in_cents, compra.monto_cop);
      await supabase.from('compras').update({ ...datosWompi, wompi_estado: 'MONTO_NO_COINCIDE' }).eq('referencia', tx.reference);
      return ok();
    }

    if (compra.estado === 'pendiente' || compra.estado === 'rechazado') {
      const { error: updateError } = await supabase
        .from('compras')
        .update({ ...datosWompi, estado: 'pagado', pagado_at: new Date().toISOString() })
        .eq('referencia', tx.reference)
        .in('estado', ['pendiente', 'rechazado']);

      if (updateError) {
        console.error('compras.update', updateError);
        return new Response('Error de base de datos', { status: 500 });
      }
    }

    // Se alerta una sola vez; si el correo falla, el 500 hace que Wompi reintente
    const { data: porAlertar } = await supabase
      .from('compras')
      .select('*, planes(nombre)')
      .eq('referencia', tx.reference)
      .eq('estado', 'pagado')
      .is('alerta_enviada_at', null)
      .maybeSingle();

    if (porAlertar) {
      try {
        await enviarAlertas(porAlertar as Compra);
      } catch (err) {
        console.error('alerta', err);
        return new Response('No se pudo enviar la alerta', { status: 500 });
      }
      await supabase.from('compras').update({ alerta_enviada_at: new Date().toISOString() }).eq('referencia', tx.reference);
    }

    return ok();
  }

  if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    await supabase
      .from('compras')
      .update({ ...datosWompi, estado: 'rechazado' })
      .eq('referencia', tx.reference)
      .eq('estado', 'pendiente');
    return ok();
  }

  // PENDING u otros estados intermedios: solo se registra la información
  await supabase.from('compras').update(datosWompi).eq('referencia', tx.reference).eq('estado', 'pendiente');
  return ok();
});

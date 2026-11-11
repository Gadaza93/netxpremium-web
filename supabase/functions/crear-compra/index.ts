// crear-compra
//   GET  → planes activos de NexoBar POS (la landing los muestra en el formulario).
//   POST → valida el formulario, registra la compra como "pendiente" y devuelve la URL
//          del Web Checkout de Wompi firmada con el secreto de integridad.
// El precio siempre sale de la tabla planes (precio_cop o, para fundadores, precio_fundador_cop): el navegador
// solo envía el id del plan.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

// Máximo de compras que una misma IP puede iniciar en la ventana (frena bots que llenan la tabla)
const LIMITE_POR_IP = 5;
const VENTANA_MIN = 10;

// Precio fundador: los primeros CUPOS_FUNDADOR bares pagan planes.precio_fundador_cop y lo conservan al renovar
// (mismo correo). Una compra pendiente reserva su cupo por RESERVA_FUNDADOR_MIN mientras paga en Wompi.
const CUPOS_FUNDADOR = Number(Deno.env.get('CUPOS_FUNDADOR') ?? 20);
const RESERVA_FUNDADOR_MIN = 30;

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

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function ipCliente(req: Request): string {
  return (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

type CompraInput = {
  plan_id: string;
  comercio: string;
  documento_tipo: string;
  documento: string;
  responsable: string;
  email: string;
  telefono: string;
  ciudad: string;
  acepta_marketing: boolean;
};

function validar(body: Record<string, unknown>): { data?: CompraInput; error?: string } {
  const data: CompraInput = {
    plan_id: clean(body.plan_id, 40),
    comercio: clean(body.comercio, 120),
    documento_tipo: clean(body.documento_tipo, 3).toUpperCase(),
    documento: clean(body.documento, 20).replace(/[^0-9-]/g, ''),
    responsable: clean(body.responsable, 120),
    email: clean(body.email, 160).toLowerCase(),
    telefono: clean(body.telefono, 20).replace(/\D/g, ''),
    ciudad: clean(body.ciudad, 80),
    acepta_marketing: body.acepta_marketing === true,
  };

  if (body.acepta_terminos !== true) return { error: 'Debes aceptar los Términos y la Política de Privacidad.' };
  if (!data.plan_id) return { error: 'Selecciona un plan.' };
  if (data.comercio.length < 2) return { error: 'Escribe el nombre del comercio.' };
  if (!['NIT', 'CC', 'CE'].includes(data.documento_tipo)) return { error: 'Tipo de documento no válido.' };
  if (data.documento.replace(/-/g, '').length < 5) return { error: 'Escribe un número de documento válido.' };
  if (data.responsable.length < 3) return { error: 'Escribe el nombre del responsable.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return { error: 'Escribe un correo electrónico válido.' };
  if (!/^3\d{9}$/.test(data.telefono)) return { error: 'Escribe un celular colombiano de 10 dígitos.' };
  if (data.ciudad.length < 2) return { error: 'Escribe la ciudad.' };

  return { data };
}

// Correos distintos que ya tienen precio fundador (pagado o entregado) o lo están pagando ahora mismo
async function cuposFundadorUsados(): Promise<Set<string>> {
  const desde = new Date(Date.now() - RESERVA_FUNDADOR_MIN * 60_000).toISOString();
  const { data, error } = await supabase
    .from('compras')
    .select('email')
    .eq('precio_fundador', true)
    .is('duplicado_de', null)
    .or(`estado.in.(pagado,entregado),and(estado.eq.pendiente,created_at.gte.${desde})`);
  if (error) throw error;
  return new Set((data ?? []).map((c) => c.email));
}

async function esFundador(email: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('compras')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('precio_fundador', true)
    .in('estado', ['pagado', 'entregado']);
  if (error) throw error;
  return (count ?? 0) > 0;
}

function nuevaReferencia(): string {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `NXB-${fecha}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('planes')
      .select('id, nombre, descripcion, precio_cop, precio_fundador_cop, caracteristicas, ciclo')
      .eq('activo', true)
      .order('orden');

    if (error) {
      console.error('planes', error);
      return json({ error: 'No pudimos cargar los planes.' }, 500, cors);
    }

    let restantes = 0;
    try {
      restantes = Math.max(0, CUPOS_FUNDADOR - (await cuposFundadorUsados()).size);
    } catch (err) {
      console.error('cupos fundador', err);
    }
    // Con cupos, precio_cop es el precio fundador y precio_regular_cop el tachado
    const planes = (data ?? []).map(({ precio_fundador_cop, ...p }) =>
      restantes > 0 && precio_fundador_cop && precio_fundador_cop < p.precio_cop
        ? { ...p, precio_cop: precio_fundador_cop, precio_regular_cop: p.precio_cop }
        : p
    );
    const fundador = { cupos_total: CUPOS_FUNDADOR, cupos_restantes: restantes };
    // Un cambio de precio o de cupos se ve en la landing en máximo 60 s
    return json({ planes, fundador }, 200, cors, { 'Cache-Control': 'public, max-age=60' });
  }

  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, cors);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Solicitud no válida.' }, 400, cors);
  }

  const { data: input, error: validationError } = validar(body);
  if (!input) return json({ error: validationError }, 400, cors);

  const { data: plan, error: planError } = await supabase
    .from('planes')
    .select('id, nombre, precio_cop, precio_fundador_cop')
    .eq('id', input.plan_id)
    .eq('activo', true)
    .maybeSingle();

  if (planError || !plan) return json({ error: 'El plan seleccionado no está disponible.' }, 400, cors);

  const ip = ipCliente(req);
  if (ip) {
    const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
    const { count } = await supabase
      .from('compras')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', desde);
    if ((count ?? 0) >= LIMITE_POR_IP) {
      return json({ error: 'Demasiados intentos de compra. Espera unos minutos e intenta de nuevo.' }, 429, cors);
    }
  }

  // Precio fundador: quien ya lo tiene lo conserva al renovar; uno nuevo lo recibe si quedan cupos
  let fundador = false;
  if (plan.precio_fundador_cop && plan.precio_fundador_cop < plan.precio_cop) {
    try {
      if (await esFundador(input.email)) {
        fundador = true;
      } else {
        const usados = await cuposFundadorUsados();
        fundador = usados.has(input.email) || usados.size < CUPOS_FUNDADOR;
      }
    } catch (err) {
      console.error('precio fundador', err);
    }
  }
  const monto = fundador ? plan.precio_fundador_cop! : plan.precio_cop;

  const referencia = nuevaReferencia();
  const { error: insertError } = await supabase.from('compras').insert({
    ...input,
    referencia,
    monto_cop: monto,
    precio_fundador: fundador,
    ip: ip || null,
  });

  if (insertError) {
    console.error('compras.insert', insertError);
    return json({ error: 'No pudimos registrar la compra. Intenta de nuevo.' }, 500, cors);
  }

  const amountInCents = String(monto * 100);
  const signature = await sha256Hex(`${referencia}${amountInCents}COP${Deno.env.get('WOMPI_INTEGRITY_SECRET')}`);

  const params = new URLSearchParams({
    'public-key': Deno.env.get('WOMPI_PUBLIC_KEY')!,
    'currency': 'COP',
    'amount-in-cents': amountInCents,
    'reference': referencia,
    'signature:integrity': signature,
    'redirect-url': Deno.env.get('WOMPI_REDIRECT_URL')!,
    'customer-data:email': input.email,
    'customer-data:full-name': input.responsable,
    'customer-data:phone-number': input.telefono,
    'customer-data:phone-number-prefix': '+57',
    'customer-data:legal-id': input.documento.replace(/-/g, ''),
    'customer-data:legal-id-type': input.documento_tipo,
  });

  return json({ referencia, monto_cop: monto, precio_fundador: fundador, checkout_url: `${WOMPI_CHECKOUT_URL}?${params}` }, 200, cors);
});

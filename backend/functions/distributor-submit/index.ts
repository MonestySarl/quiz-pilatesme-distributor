// distributor-submit — edge fn Supabase (Deno).
// Reçoit un POST du quiz distributeur (quiz.pilatesme.com/distributor) et insère
// une ligne dans public.distributor_applications.
//
// Envoie aussi une notification email à l'équipe distributeur si RESEND_API_KEY dispo.
//
// CORS : autorisé pour les origines listées dans DISTRIBUTOR_ALLOWED_ORIGINS
// (fallback = tout ce qui contient pilatesme).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_TO = (Deno.env.get('DISTRIBUTOR_NOTIFY_TO') || 'monesty.sarl@gmail.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = (Deno.env.get('DISTRIBUTOR_ALLOWED_ORIGINS') ||
  'https://quiz.pilatesme.com,https://quiz-pilatesme-distributor.vercel.app')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function j(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface Payload {
  visitor_id?: string;
  countries?: string[];
  business_types?: string[];
  product_interest?: string;
  business_model?: string;
  volume_machines?: string;
  volume_accessories?: string;
  annual_revenue?: string;
  timeline?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  landing_page?: string;
  referrer?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return j({ error: 'method_not_allowed' }, 405, cors);
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return j({ error: 'invalid_json' }, 400, cors);
  }

  // Validation minimum
  const missing = ['first_name', 'last_name', 'email', 'company'].filter(
    (k) => !body[k as keyof Payload] || String(body[k as keyof Payload]).trim() === '',
  );
  if (missing.length) return j({ error: 'missing_fields', fields: missing }, 400, cors);

  const email = String(body.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return j({ error: 'invalid_email' }, 400, cors);
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const row = {
    visitor_id: body.visitor_id || null,
    countries: Array.isArray(body.countries) ? body.countries : [],
    business_types: Array.isArray(body.business_types) ? body.business_types : [],
    product_interest: body.product_interest || null,
    business_model: body.business_model || null,
    volume_machines: body.volume_machines || null,
    volume_accessories: body.volume_accessories || null,
    annual_revenue: body.annual_revenue || null,
    timeline: body.timeline || null,
    first_name: String(body.first_name).trim(),
    last_name: String(body.last_name).trim(),
    email,
    phone: body.phone ? String(body.phone).trim() : null,
    company: String(body.company).trim(),
    website: body.website ? String(body.website).trim() : null,
    landing_page: body.landing_page || null,
    referrer: body.referrer || null,
    user_agent: req.headers.get('user-agent') || null,
    status: 'new',
  };

  const { data, error } = await supa
    .from('distributor_applications')
    .insert(row)
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[distributor-submit] insert error', error);
    return j({ error: 'db_error', detail: error.message }, 500, cors);
  }

  // Notification email (fire-and-forget)
  if (RESEND_API_KEY && NOTIFY_TO.length) {
    const html = renderNotifEmail(row, data.id);
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Pilates&Me <noreply@pilatesme.com>',
        to: NOTIFY_TO,
        subject: `[Distributor] New application — ${row.company} (${row.first_name} ${row.last_name})`,
        html,
        reply_to: row.email,
      }),
    }).catch((e) => console.error('[distributor-submit] resend error', e));
  }

  return j({ ok: true, id: data.id }, 200, cors);
});

function esc(s: string | null | undefined): string {
  if (s == null) return '—';
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>
  )[c]);
}

function renderNotifEmail(row: Record<string, unknown>, id: string): string {
  const rows = [
    ['Company', row.company],
    ['Contact', `${row.first_name} ${row.last_name}`],
    ['Email', row.email],
    ['Phone', row.phone],
    ['Website', row.website],
    ['Countries', Array.isArray(row.countries) ? (row.countries as string[]).join(', ') : '—'],
    ['Business type', Array.isArray(row.business_types) ? (row.business_types as string[]).join(', ') : '—'],
    ['Product interest', row.product_interest],
    ['Business model', row.business_model],
    ['Volume machines / month', row.volume_machines],
    ['Volume accessories / month', row.volume_accessories],
    ['Annual revenue', row.annual_revenue],
    ['Timeline', row.timeline],
  ];
  const trs = rows.map(([k, v]) => `
    <tr>
      <td style="padding:6px 12px;color:#6b7280;font-size:13px;vertical-align:top">${esc(k as string)}</td>
      <td style="padding:6px 12px;font-size:14px;font-weight:600">${esc(v as string)}</td>
    </tr>`).join('');
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin:0 0 6px">New distributor application</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:13px">Application ID: ${esc(id)}</p>
  <table style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%">${trs}</table>
  <p style="color:#6b7280;font-size:12px;margin:24px 0 0">CRM: team.pilatesme.com → Distributors tab</p>
</div>`;
}

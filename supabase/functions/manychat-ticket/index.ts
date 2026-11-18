// ManyChat "Dynamic" block → personal ticket message (decision #51).
// ManyChat POSTs the contact's data; we issue (or re-find) the ticket with the existing
// issue_ticket() function and answer in ManyChat's dynamic-content format.
// Auth: ManyChat sends the ticket_issuer secret in the X-GFA-Key header; issue_ticket checks it,
// so this function holds no secret of its own. Deploy with JWT verification OFF.
// Keyed on "manual:<username>", the same key as the /bilet-ver page, so a fan who already got
// a link by hand gets the same link again, never a second seat.

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const reply = (text: string) =>
  new Response(
    JSON.stringify({ version: 'v2', content: { type: 'instagram', messages: [{ type: 'text', text }] } }),
    { headers: { 'Content-Type': 'application/json' } },
  );

const SORRY = 'Şu an bilet veremedik 😕 Birazdan "Biletimi gönder" düğmesine tekrar bas.';

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function setting(key: string, fallback: string): Promise<string> {
  const res = await rest(`settings?select=value&key=eq.${key}`);
  if (!res.ok) return fallback;
  const rows = (await res.json()) as { value: unknown }[];
  return typeof rows[0]?.value === 'string' ? (rows[0].value as string) : fallback;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const key = req.headers.get('x-gfa-key') ?? '';
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }
  const raw = String(body.ig_username ?? body.instagram_username ?? body.username ?? '');
  const user = raw.trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(user)) {
    console.log('no username; keys:', Object.keys(body).join(','));
    return reply(SORRY);
  }

  const res = await rest('rpc/issue_ticket', {
    method: 'POST',
    body: JSON.stringify({ p_secret: key, p_ig_user_id: `manual:${user}`, p_ig_username: user }),
  });
  const a = res.ok ? ((await res.json()) as { ok: boolean; url?: string; used?: boolean; error?: string }) : null;
  if (!a?.ok || !a.url) {
    console.log('issue_ticket failed:', res.status, a?.error);
    if (a?.error === 'full') return reply(await setting('ig_reply_full', 'Stadyum doldu! 🏟️'));
    return reply(SORRY);
  }
  const text = a.used
    ? await setting('ig_reply_used', 'Sen zaten tribündesin! {url}')
    : await setting('ig_reply_new', 'Biletini almak için: {url}');
  return reply(text.replace('{url}', a.url));
});

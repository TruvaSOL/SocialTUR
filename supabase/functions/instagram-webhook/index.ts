/**
 * Instagram comment -> ticket (decisions #48, #50). A Supabase Edge Function (Deno).
 *
 * Meta calls this address:
 *   GET  once, when the webhook is set up: we answer the challenge if the verify token matches.
 *   POST for every new comment: we check Meta's signature, keep only top-level comments on the
 *        target Reel of our own account that say the keyword (TRİBÜN), ask the database what to
 *        answer (ig_handle_comment) and send that as the single private reply to the comment.
 *
 * Safe mode (settings.ig_live = false): matching comments are recorded as 'dry_run'; nothing is sent
 * and no ticket is made. Secrets live in private_config (never in code or logs).
 * Must be deployed with JWT verification OFF, because Meta does not send a Supabase login.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
/** The server key: the legacy service_role key, or the new secret key ('default' in SUPABASE_SECRET_KEYS). */
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    return (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>).default ?? '';
  } catch {
    return '';
  }
}
const SERVICE_KEY = serverKey();
// New-style secret keys (sb_secret_...) go only in the apikey header; a legacy key is a JWT for both.
const AUTH_HEADERS: Record<string, string> = SERVICE_KEY.startsWith('sb_')
  ? { apikey: SERVICE_KEY }
  : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
// Meta's newer apps use 'Instagram API with Unified login' (Facebook Login for Business):
// graph.facebook.com and a business system-user token (POST /<IG_ACCOUNT_ID>/messages).
const GRAPH = 'https://graph.facebook.com';
const REFRESH = 'https://graph.instagram.com/refresh_access_token';
const API_VERSION = 'v27.0';

// ---------------------------------------------------------------- database

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...AUTH_HEADERS,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

type Config = Record<string, string>;
let cached: { at: number; config: Config } | null = null;

async function config(): Promise<Config> {
  if (cached && Date.now() - cached.at < 60_000) return cached.config;
  const res = await rest('private_config?select=key,value&key=in.(ig_verify_token,ig_app_secret,ig_token,ig_token_refreshed_at)');
  if (!res.ok) throw new Error(`private_config: ${res.status}`);
  const rows = (await res.json()) as { key: string; value: string }[];
  const result: Config = {};
  for (const row of rows) result[row.key] = row.value;
  cached = { at: Date.now(), config: result };
  return result;
}

async function setConfig(key: string, value: string): Promise<void> {
  await rest(`private_config?key=eq.${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify({ value }) });
  cached = null;
}

export interface Switches {
  live: boolean;
  account: string;
  media: string;
  keywords: string[];
  refreshDays: number;
}
let cachedSwitches: { at: number; value: Switches } | null = null;

/** The service's switches, from the settings table (changed in the dashboard, no deploy). */
async function switches(): Promise<Switches> {
  if (cachedSwitches && Date.now() - cachedSwitches.at < 30_000) return cachedSwitches.value;
  const res = await rest('settings?select=key,value&key=in.(ig_live,ig_account_id,ig_target_media,ig_keywords,ig_token_refresh_days)');
  if (!res.ok) throw new Error(`settings: ${res.status}`);
  const rows = (await res.json()) as { key: string; value: unknown }[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const days = Number(get('ig_token_refresh_days'));
  const words = get('ig_keywords');
  const value: Switches = {
    live: get('ig_live') === true,
    account: String(get('ig_account_id') ?? ''),
    media: String(get('ig_target_media') ?? ''),
    keywords: Array.isArray(words) ? words.map((k) => normalizeTR(String(k))).filter(Boolean) : [],
    refreshDays: Number.isFinite(days) && days > 0 ? days : 0,
  };
  cachedSwitches = { at: Date.now(), value };
  return value;
}

// ---------------------------------------------------------------- keyword

/** Lower case without Turkish accents: TRİBÜN, Tribün and tribun all become "tribun". */
export function normalizeTR(x: string): string {
  return x
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase();
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the comment has one of the keywords as a whole word ("tribünlü" does not count). */
export function asksForTicket(text: string, keywords: string[]): boolean {
  const t = normalizeTR(text);
  return keywords.some((k) => new RegExp(`(?:^|[^a-z0-9])${escape(k)}(?=$|[^a-z0-9])`).test(t));
}

// ---------------------------------------------------------------- Meta signature

const encoder = new TextEncoder();

async function signatureOk(raw: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  if (!header || !/^sha256=[0-9a-f]{64}$/i.test(header) || !secret) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice('sha256='.length).toLowerCase();
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// ---------------------------------------------------------------- Instagram

/**
 * A system-user token (Unified login) does not need renewing: ig_token_refresh_days = 0.
 * An Instagram-login token lasts 60 days; with ig_token_refresh_days > 0 it is renewed that often.
 */
async function token(): Promise<string> {
  const c = await config();
  const current = c.ig_token ?? '';
  if (!current) return '';
  const days = (await switches()).refreshDays;
  if (days <= 0) return current;
  const last = Date.parse(c.ig_token_refreshed_at ?? '');
  if (Number.isFinite(last) && Date.now() - last < days * 86_400_000) return current;
  try {
    const url = `${REFRESH}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
    const res = await fetch(url);
    const body = (await res.json()) as { access_token?: string };
    if (res.ok && body.access_token) {
      await setConfig('ig_token', body.access_token);
      await setConfig('ig_token_refreshed_at', new Date().toISOString());
      return body.access_token;
    }
    console.warn('token refresh refused', res.status);
  } catch (error) {
    console.warn('token refresh failed', String(error).slice(0, 120));
  }
  return current;
}

async function privateReply(accountId: string, commentId: string, text: string): Promise<string | null> {
  const access = await token();
  if (!access) return 'no_token';
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${API_VERSION}/${accountId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    });
  } catch (error) {
    // Outcome unknown: it is noted and never retried (one private reply per comment).
    return `network: ${String(error).slice(0, 80)}`;
  }
  if (res.ok) return null;
  // Keep only the status and Meta's error code: the body may carry personal data.
  let code = '';
  try {
    const body = (await res.json()) as { error?: { code?: number; error_subcode?: number } };
    code = ` code ${body.error?.code ?? '?'}/${body.error?.error_subcode ?? '-'}`;
  } catch {
    // not JSON
  }
  return `HTTP ${res.status}${code}`;
}

// ---------------------------------------------------------------- comments

export interface Comment {
  account: string;
  id: string;
  from: string;
  username: string;
  text: string;
  media: string;
  parent: string;
}

/** Meta's examples show both layouts (value directly on the entry, or inside changes[]); accept either. */
export function comments(payload: unknown): Comment[] {
  const found: Comment[] = [];
  const p = payload as { object?: string; entry?: unknown[] };
  if (p?.object !== 'instagram' || !Array.isArray(p.entry)) return found;
  for (const e of p.entry as Record<string, unknown>[]) {
    const account = String(e?.id ?? '');
    const changes = Array.isArray(e?.changes) ? (e.changes as Record<string, unknown>[]) : [e];
    for (const change of changes) {
      if (change?.field !== 'comments') continue;
      const v = (change.value ?? {}) as Record<string, unknown>;
      const from = (v.from ?? {}) as Record<string, unknown>;
      const media = (v.media ?? {}) as Record<string, unknown>;
      const id = String(v.id ?? v.comment_id ?? '');
      const fromId = String(from.id ?? '');
      if (!id || !fromId) continue;
      found.push({
        account,
        id,
        from: fromId,
        username: String(from.username ?? ''),
        text: String(v.text ?? ''),
        media: String(media.id ?? v.media_id ?? ''),
        parent: String(v.parent_id ?? ''),
      });
    }
  }
  return found;
}

/**
 * Only top-level keyword comments by others on the target Reel of our own account.
 * Safe mode with no target yet: any post of ours counts (noted as dry run with its media id),
 * which is how the Reel's numeric id is found. Live mode always needs the target.
 */
export function wanted(c: Comment, s: Switches): boolean {
  if (!s.account || c.account !== s.account) return false;
  if (s.media ? c.media !== s.media : s.live) return false;
  if (c.parent) return false;
  if (c.from === c.account) return false; // never answer ourselves
  return asksForTicket(c.text, s.keywords);
}

async function handle(comment: Comment, live: boolean): Promise<void> {
  const answer = await rpc<{ reply: string | null }>('ig_handle_comment', {
    p_comment_id: comment.id,
    p_ig_user_id: comment.from,
    p_username: comment.username,
    p_media_id: comment.media,
    p_dry_run: !live,
  });
  if (!live || !answer?.reply) return;
  const error = await privateReply(comment.account, comment.id, answer.reply);
  await rpc('ig_comment_done', { p_comment_id: comment.id, p_sent: error === null, p_error: error });
  if (error) console.warn('private reply failed', error);
}

// ---------------------------------------------------------------- entry point

export async function serve(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    if (url.searchParams.has('health')) {
      const s = await switches();
      const c = await config();
      return Response.json({
        ok: true,
        live: s.live,
        account_set: !!s.account,
        target_media_set: !!s.media,
        app_secret_set: !!c.ig_app_secret,
        token_set: !!c.ig_token,
      });
    }
    const c = await config();
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      !!c.ig_verify_token &&
      sameText(url.searchParams.get('hub.verify_token') ?? '', c.ig_verify_token);
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.length > 250_000) return new Response('too large', { status: 413 });
  const c = await config();
  if (!(await signatureOk(raw, req.headers.get('x-hub-signature-256'), c.ig_app_secret ?? ''))) {
    return new Response('bad signature', { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const s = await switches();
  // A failure on one comment must not block the others; it is noted in ig_comments and the logs.
  // Answering 200 even then stops Meta from repeating the whole delivery.
  let accepted = 0;
  for (const comment of comments(payload)) {
    if (!wanted(comment, s)) continue;
    accepted++;
    try {
      await handle(comment, s.live);
    } catch (error) {
      console.error('comment failed', String(error).slice(0, 120));
    }
  }
  return Response.json({ received: true, live: s.live, accepted });
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') Deno.serve(serve);

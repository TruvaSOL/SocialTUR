/**
 * Instagram comment -> ticket (decision #48). A Supabase Edge Function (Deno).
 *
 * Meta calls this address:
 *   GET  once, when the webhook is set up: we answer the challenge if the verify token matches.
 *   POST for every new comment on our posts: we check Meta's signature, ask the database what
 *        to answer (ig_handle_comment) and send that as a private reply to the comment.
 *
 * Secrets live in the private_config table (never in code): ig_verify_token, ig_app_secret, ig_token.
 * Must be deployed with JWT verification OFF, because Meta does not send a Supabase login.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GRAPH = 'https://graph.instagram.com';
const API_VERSION = 'v27.0';

// ---------------------------------------------------------------- database

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
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

async function settingNumber(key: string, fallback: number): Promise<number> {
  const res = await rest(`settings?select=value&key=eq.${encodeURIComponent(key)}`);
  if (!res.ok) return fallback;
  const rows = (await res.json()) as { value: unknown }[];
  const n = Number(rows[0]?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------------------------------------------------------------- Meta signature

const encoder = new TextEncoder();

async function signatureOk(raw: Uint8Array, header: string | null, secret: string): Promise<boolean> {
  if (!header || !header.startsWith('sha256=') || !secret) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  const given = header.slice('sha256='.length).toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- Instagram

/** The access token lasts 60 days; renew it every few days while comments keep coming. */
async function token(): Promise<string> {
  const c = await config();
  const current = c.ig_token ?? '';
  if (!current) return '';
  const days = await settingNumber('ig_token_refresh_days', 7);
  const last = Date.parse(c.ig_token_refreshed_at ?? '');
  if (Number.isFinite(last) && Date.now() - last < days * 86_400_000) return current;
  try {
    const url = `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
    const res = await fetch(url);
    const body = (await res.json()) as { access_token?: string };
    if (res.ok && body.access_token) {
      await setConfig('ig_token', body.access_token);
      await setConfig('ig_token_refreshed_at', new Date().toISOString());
      return body.access_token;
    }
    console.warn('token refresh refused', res.status, JSON.stringify(body).slice(0, 300));
  } catch (error) {
    console.warn('token refresh failed', String(error));
  }
  return current;
}

async function privateReply(accountId: string, commentId: string, text: string): Promise<string | null> {
  const access = await token();
  if (!access) return 'no_token';
  const res = await fetch(`${GRAPH}/${API_VERSION}/${accountId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
  });
  if (res.ok) return null;
  return `${res.status} ${(await res.text()).slice(0, 400)}`;
}

// ---------------------------------------------------------------- comments

interface Comment {
  account: string;
  id: string;
  from: string;
  username: string;
  text: string;
}

/** Meta's examples show both layouts (value directly on the entry, or inside changes[]); accept either. */
function comments(payload: unknown): Comment[] {
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
      const id = String(v.id ?? v.comment_id ?? '');
      const fromId = String(from.id ?? '');
      // Our own replies under the post come back as comments too: never answer ourselves.
      if (!id || !fromId || fromId === account) continue;
      found.push({ account, id, from: fromId, username: String(from.username ?? ''), text: String(v.text ?? '') });
    }
  }
  return found;
}

async function handle(comment: Comment): Promise<void> {
  const answer = await rpc<{ reply: string | null }>('ig_handle_comment', {
    p_comment_id: comment.id,
    p_ig_user_id: comment.from,
    p_username: comment.username,
    p_text: comment.text,
  });
  if (!answer?.reply) return;
  const error = await privateReply(comment.account, comment.id, answer.reply);
  await rpc('ig_comment_done', { p_comment_id: comment.id, p_sent: error === null, p_error: error });
  if (error) console.warn('private reply failed', comment.id, error);
}

// ---------------------------------------------------------------- entry point

export async function serve(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const c = await config();
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      !!c.ig_verify_token &&
      url.searchParams.get('hub.verify_token') === c.ig_verify_token;
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
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
  // A failure on one comment must not block the others; it is noted in ig_comments and the logs.
  // Answering 200 even then stops Meta from repeating the whole delivery for hours.
  for (const comment of comments(payload)) {
    try {
      await handle(comment);
    } catch (error) {
      console.error('comment failed', comment.id, String(error));
    }
  }
  return new Response('ok', { status: 200 });
}

Deno.serve(serve);

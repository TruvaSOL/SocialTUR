// Runs the Edge Function in Node against fake Supabase and fake Instagram.
//   node supabase/functions/instagram-webhook/test.mjs
import { createHmac } from 'node:crypto';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: () => {} };

const SECRET = 'app-secret';
const db = {
  config: { ig_verify_token: 'vt123', ig_app_secret: SECRET, ig_token: 'tok-old', ig_token_refreshed_at: '2026-01-01T00:00:00Z' },
  settings: { ig_live: false, ig_account_id: 'ACC', ig_target_media: 'REEL', ig_keywords: ['tribun'], ig_token_refresh_days: 7 },
  rows: new Map(),
  done: [],
};
const sent = [];
let refreshes = 0;
let failSend = false;

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.startsWith('https://db.test/rest/v1/private_config?select')) return json(Object.entries(db.config).map(([key, value]) => ({ key, value })));
  if (url.startsWith('https://db.test/rest/v1/private_config?key=eq.')) {
    db.config[decodeURIComponent(url.split('eq.')[1])] = JSON.parse(init.body).value;
    return new Response(null, { status: 204 });
  }
  if (url.startsWith('https://db.test/rest/v1/settings')) return json(Object.entries(db.settings).map(([key, value]) => ({ key, value })));
  if (url === 'https://db.test/rest/v1/rpc/ig_handle_comment') {
    // Mirrors the SQL: one row per comment, ever.
    const a = JSON.parse(init.body);
    if (db.rows.has(a.p_comment_id)) return json({ reply: null });
    db.rows.set(a.p_comment_id, a.p_dry_run ? 'dry_run' : 'pending');
    return json(a.p_dry_run ? { reply: null, dry_run: true } : { reply: `Biletini almak için: https://site/?kod=X-${a.p_ig_user_id}` });
  }
  if (url === 'https://db.test/rest/v1/rpc/ig_comment_done') {
    const a = JSON.parse(init.body);
    db.done.push(a);
    db.rows.set(a.p_comment_id, a.p_sent ? 'sent' : 'failed');
    return new Response(null, { status: 204 });
  }
  if (url.startsWith('https://graph.instagram.com/refresh_access_token')) {
    refreshes++;
    return json({ access_token: 'tok-new', expires_in: 5184000 });
  }
  if (url.startsWith('https://graph.facebook.com/v27.0/')) {
    sent.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    return failSend ? json({ error: { message: 'secret detail', code: 10, error_subcode: 2534022 } }, 400) : json({ recipient_id: '1', message_id: 'm' });
  }
  throw new Error(`unexpected fetch ${url}`);
};

const fn = await import(new URL('./index.ts', import.meta.url).href);
const { serve, asksForTicket } = fn;
const sign = (body, key = SECRET) => 'sha256=' + createHmac('sha256', key).update(body).digest('hex');
const post = (payload, signature) => {
  const body = JSON.stringify(payload);
  return serve(new Request('https://fn.test/', { method: 'POST', body, headers: { 'x-hub-signature-256': signature ?? sign(body) } }));
};
const comment = (id, from, text, extra = {}) => ({
  object: 'instagram',
  entry: [{ id: 'ACC', time: 1, changes: [{ field: 'comments', value: { comment_id: id, from: { id: from, username: 'u' + from }, text, media: { id: 'REEL', media_product_type: 'REELS' }, ...extra } }] }],
});
const settle = () => new Promise((r) => setTimeout(r, 40)); // switches are cached for 30 s; tests reset the cache by re-importing is not needed
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};

// Keyword (the package's cases)
for (const s of ['TRİBÜN', 'tribun', 'Tribün!', 'Ben de tribün istiyorum']) check(`keyword yes: ${s}`, asksForTicket(s, ['tribun']));
for (const s of ['tribünlü', 'tribunlarda', 'bilet', 'stadyum']) check(`keyword no: ${s}`, !asksForTicket(s, ['tribun']));

// Verification handshake
let r = await serve(new Request('https://fn.test/?hub.mode=subscribe&hub.verify_token=vt123&hub.challenge=4242'));
check('handshake with right token answers the challenge', r.status === 200 && (await r.text()) === '4242');
r = await serve(new Request('https://fn.test/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242'));
check('handshake with wrong token is refused', r.status === 403);
r = await serve(new Request('https://fn.test/?health'));
const health = await r.json();
check('health shows safe mode and what is configured, no secrets', health.live === false && health.token_set === true && !JSON.stringify(health).includes('tok-old'));

// Signature
r = await post(comment('c0', 'P0', 'TRİBÜN'), sign('x'));
check('wrong signature is refused', r.status === 401 && db.rows.size === 0);
r = await post(comment('c0', 'P0', 'TRİBÜN'), 'sha256=zz');
check('malformed signature is refused', r.status === 401);

// Safe mode: noted, nothing sent
r = await post(comment('c1', 'P1', 'TRİBÜN'));
let body = await r.json();
check('safe mode: comment accepted and noted as dry run', body.live === false && body.accepted === 1 && db.rows.get('c1') === 'dry_run');
check('safe mode: nothing sent', sent.length === 0);

// Filters
await post({ object: 'instagram', entry: [{ id: 'ACC', changes: [{ field: 'comments', value: { id: 'c2', from: { id: 'P2' }, text: 'TRİBÜN', media: { id: 'OTHER' } } }] }] });
check('other post ignored', !db.rows.has('c2'));
await post(comment('c3', 'P3', 'TRİBÜN', { parent_id: 'c1' }));
check('reply to a comment ignored', !db.rows.has('c3'));
await post(comment('c4', 'ACC', 'TRİBÜN'));
check('our own comment ignored', !db.rows.has('c4'));
await post(comment('c5', 'P5', 'harika video'));
check('comment without keyword ignored', !db.rows.has('c5'));
await post({ object: 'instagram', entry: [{ id: 'SOMEONE', changes: [{ field: 'comments', value: { id: 'c6', from: { id: 'P6' }, text: 'TRİBÜN', media: { id: 'REEL' } } }] }] });
check('other account ignored', !db.rows.has('c6'));

// Safe mode without a target: any post of ours is noted (to learn its media id), nothing sent
{
  db.settings.ig_target_media = '';
  const find = await import(new URL('./index.ts?find', import.meta.url).href);
  const b2 = JSON.stringify({ object: 'instagram', entry: [{ id: 'ACC', changes: [{ field: 'comments', value: { comment_id: 'f1', from: { id: 'PF' }, text: 'TRİBÜN', media: { id: 'OLDPOST' } } }] }] });
  await find.serve(new Request('https://fn.test/', { method: 'POST', body: b2, headers: { 'x-hub-signature-256': sign(b2) } }));
  check('safe mode, no target: comment on any of our posts noted', db.rows.get('f1') === 'dry_run' && sent.length === 0);
  db.settings.ig_target_media = 'REEL';
}

// Live: re-import with a fresh switch cache
db.settings.ig_live = true;
const live = await import(new URL('./index.ts?live', import.meta.url).href);
const postLive = (payload) => {
  const b = JSON.stringify(payload);
  return live.serve(new Request('https://fn.test/', { method: 'POST', body: b, headers: { 'x-hub-signature-256': sign(b) } }));
};
r = await postLive(comment('c7', 'P7', 'Ben de tribün istiyorum'));
body = await r.json();
check('live: answered', body.live === true && body.accepted === 1);
check('live: private reply goes to the comment', sent[0]?.url === 'https://graph.facebook.com/v27.0/ACC/messages' && sent[0]?.body.recipient.comment_id === 'c7');
check('live: reply carries the person\'s own link', sent[0]?.body.message.text.includes('kod=X-P7'));
check('live: old token renewed and used', refreshes === 1 && sent[0]?.auth === 'Bearer tok-new');
check('live: marked as sent', db.rows.get('c7') === 'sent');
await postLive(comment('c7', 'P7', 'Ben de tribün istiyorum'));
check('live: same comment delivered twice sends once', sent.length === 1);
await postLive(comment('c1', 'P1', 'TRİBÜN'));
check('live: comment seen in safe mode is not answered later', sent.length === 1);

failSend = true;
await postLive(comment('c8', 'P8', 'TRİBÜN'));
const fail = db.done.find((d) => d.p_comment_id === 'c8');
check('live: failed send noted with code only (no message body)', fail?.p_sent === false && /HTTP 400 code 10\/2534022/.test(fail.p_error) && !fail.p_error.includes('secret detail'));
failSend = false;
await postLive(comment('c8', 'P8', 'TRİBÜN'));
check('live: failed comment is not retried', sent.length === 2);

console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);

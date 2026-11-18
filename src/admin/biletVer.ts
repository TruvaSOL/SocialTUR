/**
 * "Bilet ver": the owner pastes Instagram usernames of people who commented TRİBÜN and gets,
 * for each, a personal ticket link and the ready DM text to send by hand.
 * Uses the existing issue_ticket() endpoint (the same one the automatic webhook uses), keyed on
 * "manual:<username>", so asking again for the same person gives the same link.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const STORE = 'gfa.ticketIssuer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const secretInput = $<HTMLInputElement>('secret');
const keyBox = $<HTMLElement>('key-box');
const work = $<HTMLElement>('work');
const names = $<HTMLTextAreaElement>('names');
const status = $<HTMLElement>('status');
const results = $<HTMLOListElement>('results');

const load = (): string => {
  try {
    return localStorage.getItem(STORE) ?? '';
  } catch {
    return '';
  }
};
let secret = load();

function show(): void {
  keyBox.hidden = !!secret;
  work.hidden = !secret;
}

$<HTMLButtonElement>('save-key').addEventListener('click', () => {
  secret = secretInput.value.trim();
  secretInput.value = '';
  try {
    localStorage.setItem(STORE, secret);
  } catch {
    // storage blocked: works for this visit only
  }
  show();
});

$<HTMLButtonElement>('forget').addEventListener('click', () => {
  secret = '';
  try {
    localStorage.removeItem(STORE);
  } catch {
    // ignore
  }
  results.innerHTML = '';
  status.textContent = '';
  show();
});

/** Instagram usernames: letters, digits, dot, underscore; at most 30. */
function clean(line: string): string | null {
  const u = line.trim().replace(/^@+/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON!, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

let template: { fresh: string; used: string } | null = null;
async function texts(): Promise<{ fresh: string; used: string }> {
  if (template) return template;
  const res = await rest('settings?select=key,value&key=in.(ig_reply_new,ig_reply_used)');
  const rows = res.ok ? ((await res.json()) as { key: string; value: string }[]) : [];
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? 'Biletini almak için: {url}';
  template = { fresh: get('ig_reply_new'), used: get('ig_reply_used') };
  return template;
}

interface Answer {
  ok: boolean;
  url?: string;
  used?: boolean;
  new?: boolean;
  error?: string;
}

async function issue(username: string): Promise<Answer> {
  const res = await rest('rpc/issue_ticket', {
    method: 'POST',
    body: JSON.stringify({ p_secret: secret, p_ig_user_id: `manual:${username}`, p_ig_username: username }),
  });
  if (!res.ok) return { ok: false, error: `http_${res.status}` };
  return (await res.json()) as Answer;
}

const ERRORS: Record<string, string> = {
  forbidden: 'Gizli anahtar yanlış. "Anahtarı bu cihazdan sil" deyip doğrusunu gir.',
  full: 'Stadyum dolu.',
  invalid_user: 'Kullanıcı adı geçersiz.',
};

function copyButton(label: string, value: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value);
      b.textContent = 'Kopyalandı ✓';
      setTimeout(() => (b.textContent = label), 1500);
    } catch {
      b.textContent = 'Kopyalanamadı';
    }
  });
  return b;
}

$<HTMLButtonElement>('make').addEventListener('click', async () => {
  const lines = names.value.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) {
    status.textContent = 'Önce en az bir kullanıcı adı yaz.';
    return;
  }
  results.innerHTML = '';
  status.textContent = 'Oluşturuluyor…';
  const t = await texts();
  let done = 0;
  for (const line of lines) {
    const li = document.createElement('li');
    results.append(li);
    const user = clean(line);
    if (!user) {
      li.className = 'bad';
      li.textContent = `"${line.trim()}" — geçerli bir Instagram kullanıcı adı değil.`;
      continue;
    }
    const a = await issue(user);
    if (!a.ok || !a.url) {
      li.className = 'bad';
      li.textContent = `@${user} — ${ERRORS[a.error ?? ''] ?? `Hata: ${a.error}`}`;
      if (a.error === 'forbidden') break;
      continue;
    }
    done++;
    const message = (a.used ? t.used : t.fresh).replace('{url}', a.url);
    const head = document.createElement('div');
    head.className = 'head';
    const who = document.createElement('b');
    who.textContent = `@${user}`;
    const tag = document.createElement('span');
    tag.className = `tag ${a.used ? 'used' : a.new ? 'new' : 'again'}`;
    tag.textContent = a.used ? 'koltuğunu almış' : a.new ? 'yeni bilet' : 'daha önce verilmiş, aynı bilet';
    head.append(who, tag);
    const msg = document.createElement('pre');
    msg.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'row';
    const dm = document.createElement('a');
    dm.href = `https://ig.me/m/${user}`;
    dm.target = '_blank';
    dm.rel = 'noopener';
    dm.textContent = 'DM aç';
    actions.append(copyButton('Mesajı kopyala', message), copyButton('Sadece bağlantı', a.url), dm);
    li.append(head, msg, actions);
  }
  status.textContent = `${done} bilet bağlantısı hazır. Mesajı kopyala, "DM aç" ile kişiye gönder.`;
});

if (!URL_BASE || !ANON) {
  status.textContent = 'Sunucu ayarı eksik (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
}
show();

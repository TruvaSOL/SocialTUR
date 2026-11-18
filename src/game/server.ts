import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Locale } from '../config/game';
import { type Look, sanitizeLook } from '../world/looks';
import type { Profile } from './profile';

// The only place that talks to the server. The game never writes tables directly:
// it asks the server to do things ("check this code", "take my seat", "send this") and the server decides.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the build has no server settings; the stadium then only shows itself. */
export const serverReady = Boolean(url && key);

const client: SupabaseClient | null = serverReady ? createClient(url!, key!) : null;

/** The visitor's id. A first-time visitor is signed in anonymously: no e-mail, no password. */
export async function ensureSession(): Promise<string | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signed, error } = await client.auth.signInAnonymously();
  return error ? null : (signed.user?.id ?? null);
}

/** The visitor's id if they already have a session on this device; never creates one. */
export async function existingUser(): Promise<string | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

export type TicketCheck = 'ok' | 'invalid' | 'used' | 'too_many' | 'full' | 'offline';

export async function checkTicket(code: string): Promise<TicketCheck> {
  if (!client || !(await ensureSession())) return 'offline';
  const { data, error } = await client.rpc('check_ticket', { p_code: code });
  if (error || typeof data !== 'string') return 'offline';
  return data === 'not_signed_in' ? 'offline' : (data as TicketCheck);
}

export type RedeemError = 'invalid' | 'used' | 'too_young' | 'invalid_name' | 'full' | 'too_many' | 'offline';
export type RedeemResult = { ok: true; fanNo: number } | { ok: false; error: RedeemError };

/** Claims the code and takes the next seat. Fan number N sits in the N-th best seat. */
export async function redeem(code: string, profile: Omit<Profile, 'residentNo'>, locale: Locale): Promise<RedeemResult> {
  if (!client || !(await ensureSession())) return { ok: false, error: 'offline' };
  const { data, error } = await client.rpc('redeem', {
    p_code: code,
    p_name: profile.name,
    p_birth_year: profile.birthYear,
    p_locale: locale,
    p_look: profile.look,
  });
  if (error || !data) return { ok: false, error: 'offline' };
  const answer = data as { ok: boolean; fan_no?: number; error?: string };
  if (answer.ok && typeof answer.fan_no === 'number') return { ok: true, fanNo: answer.fan_no };
  const known: RedeemError[] = ['invalid', 'used', 'too_young', 'invalid_name', 'full', 'too_many'];
  return { ok: false, error: known.includes(answer.error as RedeemError) ? (answer.error as RedeemError) : 'offline' };
}

/** The signed-in visitor's own record, or null if they have no seat yet. */
export async function loadOwnProfile(userId: string): Promise<Profile | null> {
  if (!client) return null;
  const [{ data: profile }, { data: fan }] = await Promise.all([
    client.from('profiles').select('display_name, birth_year').eq('id', userId).maybeSingle(),
    client.from('fans').select('fan_no, look').eq('profile_id', userId).maybeSingle(),
  ]);
  if (!profile || !fan) return null;
  return {
    name: profile.display_name as string,
    birthYear: profile.birth_year as number,
    residentNo: fan.fan_no as number,
    look: sanitizeLook(fan.look),
  };
}

export async function saveCharacter(name: string, look: Look): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.rpc('save_character', { p_name: name, p_look: look });
  return !error;
}

// ---------------------------------------------------------------- the crowd

export interface FanRow {
  no: number;
  name: string;
  look: Look;
}

const toFan = (row: { fan_no: number; display_name: string; look: unknown }): FanRow => ({
  no: row.fan_no,
  name: row.display_name,
  look: sanitizeLook(row.look),
});

/** Loads every fan, best seats first, a page at a time. */
export async function loadFans(onPage: (rows: FanRow[]) => void): Promise<boolean> {
  if (!client) return false;
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from('fans')
      .select('fan_no, display_name, look')
      .order('fan_no')
      .range(from, from + page - 1);
    if (error) return false;
    if (data.length) onPage(data.map(toFan));
    if (data.length < page) return true;
  }
}

// ---------------------------------------------------------------- chat

export interface ChatMessage {
  id: number;
  no: number;
  name: string;
  body: string;
  preset: boolean;
}

const toMessage = (row: { id: number; fan_no: number; display_name: string; body: string; is_preset: boolean }): ChatMessage => ({
  id: row.id,
  no: row.fan_no,
  name: row.display_name,
  body: row.body,
  preset: row.is_preset,
});

/** The latest messages, oldest first. */
export async function loadChat(limit = 60): Promise<ChatMessage[]> {
  if (!client) return [];
  const { data, error } = await client
    .from('chat_messages')
    .select('id, fan_no, display_name, body, is_preset')
    .order('created_at', { ascending: false })
    .limit(limit);
  return error ? [] : data.map(toMessage).reverse();
}

/** 'blocked': the text has a word from the server's list and was not posted; 'muted': too many of those lately. */
export type SendResult = 'ok' | 'not_a_fan' | 'too_fast' | 'empty' | 'not_allowed' | 'blocked' | 'muted' | 'offline';

/** Sends free text (adults) or a ready-made phrase (everyone). */
export async function sendChat(text: string | null, preset: string | null): Promise<SendResult> {
  if (!client) return 'offline';
  const { data, error } = await client.rpc('send_message', { p_body: text, p_preset: preset });
  return error || typeof data !== 'string' ? 'offline' : (data as SendResult);
}

/** 'removed': this report was the one that took the message down. */
export type ReportResult = 'ok' | 'removed' | 'gone' | 'self' | 'not_a_fan' | 'offline';

/** Reports a message; enough reports from different fans take it down for everyone. */
export async function reportChat(id: number): Promise<ReportResult> {
  if (!client) return 'offline';
  const { data, error } = await client.rpc('report_message', { p_id: id });
  return error || typeof data !== 'string' ? 'offline' : (data as ReportResult);
}

/** Live updates: new and changed fans, new chat messages and removed ones. */
export function subscribe(
  onFan: (fan: FanRow) => void,
  onMessage: (message: ChatMessage) => void,
  onRemoved: (id: number) => void,
): void {
  if (!client) return;
  client
    .channel('stadium')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fans' }, (p) => onFan(toFan(p.new as never)))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fans' }, (p) => onFan(toFan(p.new as never)))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => onMessage(toMessage(p.new as never)))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (p) => {
      const id = (p.old as { id?: number }).id;
      if (typeof id === 'number') onRemoved(id);
    })
    .subscribe();
}

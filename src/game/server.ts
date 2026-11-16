import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Locale } from '../config/game';
import { type Look, sanitizeLook } from '../world/looks';
import type { Profile } from './profile';

// The only place that talks to the server. The game never writes tables directly:
// it asks the server to do things ("arrive", "save my character") and the server decides.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the build has no server settings; the game then runs in guest mode only. */
export const serverReady = Boolean(url && key);

const client: SupabaseClient | null = serverReady ? createClient(url!, key!) : null;

/** The signed-in player's id, or null for a guest. */
export async function signedInUser(): Promise<string | null> {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Calls back whenever someone signs in on this device (including returning from the e-mail link). */
export function onSignedIn(callback: () => void): void {
  client?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') callback();
  });
}

/** E-mails a one-time sign-in link. Returns false if it could not be sent. */
export async function sendSignInLink(email: string): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  return !error;
}

export async function signOut(): Promise<void> {
  await client?.auth.signOut();
}

/**
 * Registers the signed-in player as a resident and returns their permanent number.
 * Safe to call again: the server returns the number already given.
 */
export async function arrive(profile: Profile, locale: Locale): Promise<number | null> {
  if (!client) return null;
  const { data, error } = await client.rpc('arrive', {
    p_name: profile.name,
    p_birth_year: profile.birthYear,
    p_locale: locale,
    p_look: profile.look,
  });
  return error || typeof data !== 'number' ? null : data;
}

/** The signed-in player's own record from the server, or null if they have not arrived yet. */
export async function loadOwnProfile(userId: string): Promise<Profile | null> {
  if (!client) return null;
  const [{ data: profile }, { data: character }] = await Promise.all([
    client.from('profiles').select('display_name, birth_year, resident_no').eq('id', userId).maybeSingle(),
    client.from('characters').select('look').eq('profile_id', userId).maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    name: profile.display_name as string,
    birthYear: profile.birth_year as number,
    residentNo: profile.resident_no as number,
    look: sanitizeLook(character?.look),
  };
}

export async function saveCharacter(name: string, look: Look): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.rpc('save_character', { p_name: name, p_look: look });
  return !error;
}

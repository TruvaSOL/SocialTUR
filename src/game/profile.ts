import { GAME } from '../config/game';
import { type Look, sanitizeLook } from '../world/looks';

/**
 * The player's own record. Until accounts are connected this lives only on the device
 * ("guest"); the server version will have the same shape plus the resident number.
 */
export interface Profile {
  name: string;
  birthYear: number;
  look: Look;
  /** Permanent arrival number given by the server. Null for a guest. */
  residentNo: number | null;
}

const STORAGE_KEY = 'profile';

export const NAME_MIN = 3;
export const NAME_MAX = 16;

/** Trims and collapses spaces; returns null if the name is not acceptable. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  // Letters (any alphabet), digits, space, dot, dash, underscore.
  return /^[\p{L}\p{N} ._-]+$/u.test(name) ? name : null;
}

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

export function isOldEnough(birthYear: number): boolean {
  return ageFromBirthYear(birthYear) >= GAME.minAge;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Profile>;
    const name = typeof data.name === 'string' ? cleanName(data.name) : null;
    if (!name || typeof data.birthYear !== 'number' || !isOldEnough(data.birthYear)) return null;
    return {
      name,
      birthYear: data.birthYear,
      look: sanitizeLook(data.look),
      residentNo: typeof data.residentNo === 'number' ? data.residentNo : null,
    };
  } catch {
    return null; // storage blocked or data damaged: treat as a new visitor
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Not persisted (private mode); the visit still works.
  }
}

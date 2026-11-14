import { GAME, type Locale } from '../config/game';
import en from './en.json';
import tr from './tr.json';

type Key = keyof typeof tr;
const tables: Record<Locale, Record<string, string>> = { tr, en };
const STORAGE_KEY = 'locale';

function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (GAME.locales as readonly string[]).includes(value);
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode); fall through to the browser language.
  }
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return isLocale(browser) ? browser : GAME.defaultLocale;
}

let current: Locale = initialLocale();
const listeners = new Set<() => void>();

export function t(key: Key): string {
  return tables[current][key] ?? tables[GAME.defaultLocale][key] ?? key;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
  applyToDom();
  listeners.forEach((fn) => fn());
}

export function onLocaleChange(fn: () => void): void {
  listeners.add(fn);
}

/** Fills every element carrying data-i18n="key" with the current translation. */
export function applyToDom(): void {
  document.documentElement.lang = current;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
}

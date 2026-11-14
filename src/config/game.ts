// The game's name is not final. It lives here only; nothing else may hard-code it.
export const GAME = {
  name: 'Sociativeworld',
  defaultLocale: 'tr',
  locales: ['tr', 'en'],
  /** Youngest age allowed to play. The server enforces its own copy of this; this one only drives the form. */
  minAge: 13,
} as const;

export type Locale = (typeof GAME.locales)[number];

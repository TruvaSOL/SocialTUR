// The game's name is not final. It lives here only; nothing else may hard-code it.
export const GAME = {
  name: 'Sociativeworld',
  defaultLocale: 'tr',
  locales: ['tr', 'en'],
} as const;

export type Locale = (typeof GAME.locales)[number];

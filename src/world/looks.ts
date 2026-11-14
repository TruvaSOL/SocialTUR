import { PALETTE as C } from '../art/palette';

/**
 * What a character looks like. Every field is an index into the option lists below,
 * so a look is a handful of small numbers: easy to store, and safe to accept from a server.
 */
export interface Look {
  skin: number;
  hair: number;
  hairStyle: number;
  top: number;
  bottom: number;
  shoes: number;
  accessory: number;
}

export const SKINS = [C.skinLight, C.skinTan, C.skinBrown, 0x8a5a3c] as const;
export const HAIRS = [C.hairBrown, C.hairBlack, C.hairBlond, C.woodDark, C.coral, C.stoneDark] as const;
export const TOPS = [
  C.clothMustard, C.clothRed, C.clothTeal, C.clothNavy, C.clothPlum, C.clothCream, C.flowerPink, C.leaf, C.aegean, C.white,
] as const;
export const BOTTOMS = [C.clothNavy, C.shoe, C.stoneDark, C.woodDark, C.clothTeal, C.clothCream, C.aegean] as const;
export const SHOES = [C.shoe, C.ink, C.wood, C.white, C.coral] as const;

/** Hair styles: 0 bun, 1 short, 2 long. Accessories: 0 none, 1 cap, 2 glasses. */
export const HAIR_STYLE_COUNT = 3;
export const ACCESSORY_COUNT = 3;

export const DEFAULT_LOOK: Look = { skin: 0, hair: 0, hairStyle: 0, top: 0, bottom: 0, shoes: 0, accessory: 0 };

/** The editable parts in the order the editor shows them, with how many choices each has. */
export const LOOK_FIELDS: { key: keyof Look; colors?: readonly number[]; count: number }[] = [
  { key: 'skin', colors: SKINS, count: SKINS.length },
  { key: 'hair', colors: HAIRS, count: HAIRS.length },
  { key: 'hairStyle', count: HAIR_STYLE_COUNT },
  { key: 'top', colors: TOPS, count: TOPS.length },
  { key: 'bottom', colors: BOTTOMS, count: BOTTOMS.length },
  { key: 'shoes', colors: SHOES, count: SHOES.length },
  { key: 'accessory', count: ACCESSORY_COUNT },
];

/** Returns a valid look whatever was passed in (stored data may be old or tampered with). */
export function sanitizeLook(input: unknown): Look {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const look = { ...DEFAULT_LOOK };
  for (const field of LOOK_FIELDS) {
    const value = source[field.key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < field.count) look[field.key] = value;
  }
  return look;
}

export function randomLook(rnd: () => number): Look {
  const look = { ...DEFAULT_LOOK };
  for (const field of LOOK_FIELDS) look[field.key] = Math.floor(rnd() * field.count);
  return look;
}

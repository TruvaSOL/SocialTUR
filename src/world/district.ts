import { seededRandom } from '../art/builder';

// The district plan. Units are metres. Streets form a 5 x 5 grid of lines;
// the middle crossing is the plaza. Everything else reads its positions from here.
export const STREET_STEP = 24;
export const STREET_LINES = [-48, -24, 0, 24, 48] as const;
export const STREET_HALF = 2.5;
/** Streets end here. */
export const GRID_HALF = 51;
export const ISLAND_RADIUS = 76;
export const PLAZA_RADIUS = 9;
/** Radius of the planter in the middle of the plaza. */
export const PLANTER_RADIUS = 1.0;

/** House footprint, in the house's own coordinates; the front faces +z. */
export const HOUSE_HALF_DEPTH = 1.8;
export const DOOR_LOCAL_X = -0.95;
/** Distance from the front wall to the street edge. */
const SETBACK = 1.8;

export interface Lot {
  x: number;
  z: number;
  /** Rotation around the vertical axis; 0 faces +z. */
  yaw: number;
  /** Which colour scheme the house uses. */
  variant: number;
}

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
}

const BLOCK_CENTRES = [-36, -12, 12, 36];
const BLOCK_HALF = STREET_STEP / 2 - STREET_HALF; // 9.5
/** Blocks left without houses, as [column, row]. */
const PARKS: [number, number][] = [
  [0, 3],
  [3, 0],
];
const isPark = (i: number, j: number) => PARKS.some(([a, b]) => a === i && b === j);

function makeLots(): Lot[] {
  const lots: Lot[] = [];
  const row = BLOCK_HALF - SETBACK - HOUSE_HALF_DEPTH; // house centre, measured from the block centre
  const side = 4.6;
  BLOCK_CENTRES.forEach((cx, i) =>
    BLOCK_CENTRES.forEach((cz, j) => {
      if (isPark(i, j)) return;
      // Alternate blocks face the other pair of streets, so no two neighbours look alike.
      const turned = (i + j) % 2 === 1;
      for (const front of [1, -1]) {
        for (const along of [1, -1]) {
          const x = cx + (turned ? front * row : along * side);
          const z = cz + (turned ? along * side : front * row);
          if (Math.hypot(x, z) < PLAZA_RADIUS + 6) continue; // keep the plaza open
          const yaw = turned ? (front * Math.PI) / 2 : front === 1 ? 0 : Math.PI;
          lots.push({ x, z, yaw, variant: (i * 7 + j * 3 + (front + 1) + (along + 1) / 2) % 4 });
        }
      }
    }),
  );
  return lots;
}

export const LOTS: Lot[] = makeLots();

/** Converts a point in a lot's own coordinates to world coordinates. */
export function lotToWorld(lot: Lot, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  return { x: lot.x + lx * c + lz * s, z: lot.z - lx * s + lz * c };
}

const onStreetLine = (v: number, margin: number) => STREET_LINES.some((l) => Math.abs(v - l) < STREET_HALF + margin);

/** True where scenery (grass tufts, trees, stones) may be placed. */
export function isFree(x: number, z: number, margin = 0): boolean {
  const r = Math.hypot(x, z);
  if (r > ISLAND_RADIUS - 2.5 - margin) return false;
  if (r < PLAZA_RADIUS + 0.8 + margin) return false;
  if (Math.abs(x) < GRID_HALF + margin && Math.abs(z) < GRID_HALF + margin) {
    if (onStreetLine(x, 0.5 + margin) || onStreetLine(z, 0.5 + margin)) return false;
  }
  for (const lot of LOTS) {
    const dx = x - lot.x;
    const dz = z - lot.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    const c = Math.cos(lot.yaw);
    const s = Math.sin(lot.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    // House, roof overhang and the front yard down to the street.
    if (Math.abs(lx) < 3.0 + margin && lz > -2.7 - margin && lz < HOUSE_HALF_DEPTH + SETBACK + margin) return false;
  }
  return true;
}

function makeTrees(): TreeSpot[] {
  const rnd = seededRandom(404);
  const trees: TreeSpot[] = [];
  const tryAdd = (x: number, z: number, margin: number, minGap = 4.2): boolean => {
    if (!isFree(x, z, margin)) return false;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < minGap)) return false;
    trees.push({ x, y: 0, z, scale: 0.8 + rnd() * 0.45, yaw: rnd() * Math.PI * 2 });
    return true;
  };

  // The plaza tree stands in the planter.
  trees.push({ x: 0, y: 0.45, z: 0, scale: 1.45, yaw: 0.6 });

  BLOCK_CENTRES.forEach((cx, i) =>
    BLOCK_CENTRES.forEach((cz, j) => {
      if (isPark(i, j)) {
        for (let k = 0, placed = 0; k < 60 && placed < 11; k++) {
          const x = cx + (rnd() - 0.5) * (BLOCK_HALF * 2 - 3);
          const z = cz + (rnd() - 0.5) * (BLOCK_HALF * 2 - 3);
          if (tryAdd(x, z, 0.8)) placed++;
        }
      } else {
        // Back yards: a couple of trees between the two rows of houses.
        const turned = (i + j) % 2 === 1;
        for (const along of [-1, 0, 1]) {
          if (rnd() < 0.25) continue;
          const off = along * 5.5 + (rnd() - 0.5) * 1.5;
          tryAdd(cx + (turned ? (rnd() - 0.5) * 1.2 : off), cz + (turned ? off : (rnd() - 0.5) * 1.2), 0.3);
        }
      }
    }),
  );

  // The green belt between the last street and the shore.
  for (let k = 0, placed = 0; k < 600 && placed < 55; k++) {
    const angle = rnd() * Math.PI * 2;
    const dist = Math.sqrt(rnd()) * (ISLAND_RADIUS - 5);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x) < GRID_HALF + 2 && Math.abs(z) < GRID_HALF + 2) continue;
    if (tryAdd(x, z, 1.2, 5)) placed++;
  }
  return trees;
}

export const TREES: TreeSpot[] = makeTrees();

/** World position of street crossing (i, j), each 0..4. */
export function nodePos(i: number, j: number): { x: number; z: number } {
  return { x: STREET_LINES[i], z: STREET_LINES[j] };
}

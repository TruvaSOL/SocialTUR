import { seededRandom } from '../art/builder';
import { HOUSE_HALF_DEPTH, HOUSE_SHAPES } from './house';

// The district plan. Units are metres. Streets form a 5 x 5 grid of lines; the middle
// crossing is the plaza. The two middle streets run on to the shore, one in each direction:
// east to the ferry pier, south to the harbour, west to the forest camp, north to the fishing hut.
export const STREET_STEP = 24;
export const STREET_LINES = [-48, -24, 0, 24, 48] as const;
export const STREET_HALF = 2.5;
/** The street grid ends here. */
export const GRID_HALF = 51;
/** Where the four shore roads end. */
export const SPOKE_END = 66;
/** Edge of the beach. Grass stops a few metres before it. */
export const ISLAND_RADIUS = 76;
export const GRASS_RADIUS = ISLAND_RADIUS - 3.5;
export const SEA_LEVEL = -0.9;
export const PLAZA_RADIUS = 9;
/** Radius of the planter in the middle of the plaza. */
export const PLANTER_RADIUS = 1.0;

/** Fixed places. Each landmark is drawn around its own point. */
export const PLACES = {
  /** Shared building projects. The town hall and the cafe face the plaza from two of its corners. */
  townHall: { x: -8.6, z: -8.6 },
  cafe: { x: 8.6, z: 8.6 },
  park: { x: -36, z: 36 },
  ferry: { x: 72, z: 0 },
  harbor: { x: 0, z: 70 },
  camp: { x: -66, z: 8 },
  fishing: { x: 7, z: -68 },
} as const;

/** Distance from a house's front wall to the street edge. */
const SETBACK = 1.8;

export interface Lot {
  x: number;
  z: number;
  /** Rotation around the vertical axis; 0 faces +z. */
  yaw: number;
  /** Which colour scheme the house uses. */
  variant: number;
  /** Which house model stands here once the plot is built on. */
  shape: number;
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
/** Blocks left without houses, as [column, row]. The first is the park project, the second a grove. */
const PARKS: [number, number][] = [
  [0, 3],
  [3, 0],
];
const isPark = (i: number, j: number) => PARKS.some(([a, b]) => a === i && b === j);

function makeLots(): Lot[] {
  const lots: Lot[] = [];
  const rnd = seededRandom(77);
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
          lots.push({
            x,
            z,
            yaw,
            variant: Math.floor(rnd() * 4),
            shape: Math.floor(rnd() * HOUSE_SHAPES.length),
          });
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
  if (r > GRASS_RADIUS - 1.5 - margin) return false;
  if (r < PLAZA_RADIUS + 0.8 + margin) return false;
  const street = STREET_HALF + 0.5 + margin;
  if (Math.abs(x) < GRID_HALF + margin && Math.abs(z) < GRID_HALF + margin) {
    if (onStreetLine(x, 0.5 + margin) || onStreetLine(z, 0.5 + margin)) return false;
  }
  // The four shore roads.
  if (Math.abs(z) < street || Math.abs(x) < street) return false;
  // Landmarks keep their surroundings clear.
  if (Math.hypot(x - PLACES.camp.x, z - PLACES.camp.z) < 8 + margin) return false;
  if (Math.hypot(x - PLACES.fishing.x, z - PLACES.fishing.z) < 7 + margin) return false;
  if (Math.hypot(x - PLACES.ferry.x, z - PLACES.ferry.z) < 7 + margin) return false;
  if (Math.abs(x - PLACES.harbor.x) < 17 + margin && z > 57 - margin) return false;
  if (Math.hypot(x - PLACES.townHall.x, z - PLACES.townHall.z) < 6 + margin) return false;
  if (Math.hypot(x - PLACES.cafe.x, z - PLACES.cafe.z) < 6 + margin) return false;
  if (Math.abs(x - PLACES.park.x) < BLOCK_HALF + margin && Math.abs(z - PLACES.park.z) < BLOCK_HALF + margin) return false;
  for (const lot of LOTS) {
    const dx = x - lot.x;
    const dz = z - lot.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    const c = Math.cos(lot.yaw);
    const s = Math.sin(lot.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    // House, roof overhang and the front yard down to the street.
    if (Math.abs(lx) < 3.4 + margin && lz > -2.7 - margin && lz < HOUSE_HALF_DEPTH + SETBACK + margin) return false;
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
        for (let k = 0, placed = 0; k < 60 && placed < 10; k++) {
          const x = cx + (rnd() - 0.5) * (BLOCK_HALF * 2 - 3);
          const z = cz + (rnd() - 0.5) * (BLOCK_HALF * 2 - 3);
          if (tryAdd(x, z, 0.8)) placed++;
        }
      } else {
        // Back yards: a couple of trees between the two rows of houses.
        const turned = (i + j) % 2 === 1;
        for (const along of [-1, 0, 1]) {
          if (rnd() < 0.35) continue;
          const off = along * 5.5 + (rnd() - 0.5) * 1.5;
          tryAdd(cx + (turned ? (rnd() - 0.5) * 1.2 : off), cz + (turned ? off : (rnd() - 0.5) * 1.2), 0.3);
        }
      }
    }),
  );

  // The green belt between the last street and the shore. The west side is the forest:
  // trees stand close together there and thin out elsewhere.
  for (let k = 0, placed = 0; k < 1500 && placed < 78; k++) {
    const angle = rnd() * Math.PI * 2;
    const dist = Math.sqrt(rnd()) * (GRASS_RADIUS - 5.5);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x) < GRID_HALF + 2 && Math.abs(z) < GRID_HALF + 2) continue;
    const forest = x < -40;
    if (!forest && rnd() < 0.72) continue;
    if (tryAdd(x, z, forest ? 0.6 : 1.2, forest ? 3.6 : 5.5)) placed++;
  }
  return trees;
}

export const TREES: TreeSpot[] = makeTrees();

function makePalms(): TreeSpot[] {
  const rnd = seededRandom(909);
  const palms: TreeSpot[] = [];
  const add = (x: number, z: number) => palms.push({ x, y: 0, z, scale: 0.85 + rnd() * 0.35, yaw: rnd() * Math.PI * 2 });
  const nearPlace = (x: number, z: number) =>
    [PLACES.ferry, PLACES.fishing, PLACES.camp].some((p) => Math.hypot(x - p.x, z - p.z) < 10) ||
    (Math.abs(x - PLACES.harbor.x) < 18 && z > 56);

  // An avenue of palms along the two main streets.
  for (const along of [8, 16, 32, 40, 57]) {
    for (const sign of [1, -1]) {
      for (const side of [1, -1]) {
        const a = sign * along;
        const off = side * (STREET_HALF + 0.9);
        if (!nearPlace(a, off)) add(a, off);
        if (!nearPlace(off, a)) add(off, a);
      }
    }
  }
  // A promenade of palms where the grass meets the beach.
  const ring = GRASS_RADIUS - 2.2;
  for (let k = 0; k < 44; k++) {
    const angle = (k / 44) * Math.PI * 2 + 0.07;
    const x = Math.cos(angle) * ring;
    const z = Math.sin(angle) * ring;
    if (Math.abs(x) < 6 || Math.abs(z) < 6 || nearPlace(x, z)) continue;
    add(x, z);
  }
  return palms;
}

export const PALMS: TreeSpot[] = makePalms();

const LAST = STREET_LINES.length - 1;
const coordinate = (k: number) => (k < 0 ? -SPOKE_END : k > LAST ? SPOKE_END : STREET_LINES[k]);

/**
 * World position of street crossing (i, j). Crossings are numbered 0..4 in each direction;
 * -1 and 5 are the ends of the shore roads and exist only on the middle streets.
 */
export function nodePos(i: number, j: number): { x: number; z: number } {
  return { x: coordinate(i), z: coordinate(j) };
}

export function isNode(i: number, j: number): boolean {
  const inI = i >= 0 && i <= LAST;
  const inJ = j >= 0 && j <= LAST;
  if (inI && inJ) return true;
  const mid = LAST / 2;
  return (inJ && j === mid && (i === -1 || i === LAST + 1)) || (inI && i === mid && (j === -1 || j === LAST + 1));
}

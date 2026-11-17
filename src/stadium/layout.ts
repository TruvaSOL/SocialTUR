// The stadium plan. Units are metres; the pitch is centred on the origin, its length along x.
//
// The bowl follows a rounded rectangle around the pitch. Every row of seats is the same
// rounded rectangle pushed outwards, so a point on the outline can be named by its place
// on the outline (segment + fraction) and its distance out (d). Aisles sit at fixed places
// on the outline, so they line up from the front row to the back.

export const PITCH = { halfLength: 52.5, halfWidth: 34 } as const;

/** Front edge of the lower tier. */
const A0 = 62;
const B0 = 44;
const R0 = 20;

export const SEAT_W = 0.55;
export const ROW_D = 0.85;
/** Seat pan height above its step. Seats are sized for the game's characters, who are smaller than people. */
export const SEAT_H = 0.36;
const AISLE = 1.2;
/** The stadium holds exactly this many people; the worst spare seats are left out to reach it. */
export const CAPACITY = 50_000;

export interface Tier {
  rows: number;
  /** Distance out of the first row's front edge. */
  d0: number;
  /** Height of the first row's step. */
  y0: number;
  /** Height between rows grows towards the back, as in real stands. */
  rise: (row: number) => number;
}

export const LOWER: Tier = { rows: 28, d0: 0, y0: 1.1, rise: (r) => 0.32 + 0.007 * r };
const lowerBackD = LOWER.d0 + LOWER.rows * ROW_D;
export const UPPER: Tier = { rows: 32, d0: lowerBackD - 4, y0: 0, rise: (r) => 0.52 + 0.005 * r };

/** Height of the step of row `r` (the step the seat stands on). */
export function rowY(tier: Tier, r: number): number {
  let y = tier.y0;
  for (let i = 0; i < r; i++) y += tier.rise(i);
  return y;
}
export const LOWER_TOP = rowY(LOWER, LOWER.rows);
UPPER.y0 = LOWER_TOP + 7;
export const UPPER_TOP = rowY(UPPER, UPPER.rows);
export const UPPER_BACK_D = UPPER.d0 + UPPER.rows * ROW_D;

// ---------------------------------------------------------------- the outline

/** 0 east side, 1 SE corner, 2 south side, 3 SW, 4 west, 5 NW, 6 north, 7 NE. Corners are odd. */
export type Segment = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OutlinePoint {
  x: number;
  z: number;
  /** Outward normal (away from the pitch). */
  nx: number;
  nz: number;
}

const SA = A0 - R0; // half length of the long straights' centre part
const SB = B0 - R0;

/** A point on the outline pushed `d` metres outwards. `f` runs 0..1 along the segment. */
export function outline(seg: Segment, f: number, d: number, out: OutlinePoint = { x: 0, z: 0, nx: 0, nz: 0 }): OutlinePoint {
  const R = R0 + d;
  switch (seg) {
    case 0: // east side, x = +A
      return set(out, A0 + d, -SB + 2 * SB * f, 1, 0);
    case 2: // south side, z = +B, running west
      return set(out, SA - 2 * SA * f, B0 + d, 0, 1);
    case 4: // west side, running north
      return set(out, -A0 - d, SB - 2 * SB * f, -1, 0);
    case 6: // north side, running east
      return set(out, -SA + 2 * SA * f, -B0 - d, 0, -1);
    default: {
      // Corners turn a quarter circle around their centre.
      const k = (seg - 1) / 2; // 0 SE, 1 SW, 2 NW, 3 NE
      const cx = k === 0 || k === 3 ? SA : -SA;
      const cz = k < 2 ? SB : -SB;
      const angle = (k * Math.PI) / 2 + (f * Math.PI) / 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      return set(out, cx + nx * R, cz + nz * R, nx, nz);
    }
  }
}

function set(out: OutlinePoint, x: number, z: number, nx: number, nz: number): OutlinePoint {
  out.x = x;
  out.z = z;
  out.nx = nx;
  out.nz = nz;
  return out;
}

/** Length of a segment at distance d. */
export function segmentLength(seg: Segment, d: number): number {
  if (seg % 2 === 1) return ((R0 + d) * Math.PI) / 2;
  return seg === 0 || seg === 4 ? 2 * SB : 2 * SA;
}

/** How finely a segment is drawn: straights need only their ends, corners a few steps. */
export function segmentSteps(seg: Segment): number {
  return seg % 2 === 1 ? 14 : 1;
}

export const SEGMENTS: Segment[] = [0, 1, 2, 3, 4, 5, 6, 7];

// ---------------------------------------------------------------- blocks and stands

export type Stand = 'east' | 'southEast' | 'south' | 'southWest' | 'west' | 'northWest' | 'north' | 'northEast';
const STAND_OF: Stand[] = ['east', 'southEast', 'south', 'southWest', 'west', 'northWest', 'north', 'northEast'];

/** A block: the seats between two aisles, from the front row of a tier to its back. */
export interface Block {
  seg: Segment;
  f0: number;
  f1: number;
  stand: Stand;
  /** Printed number, e.g. 107 (lower tier) or 214 (upper tier). */
  label: number;
  tier: 0 | 1;
}

/** How many blocks each segment is split into. */
const BLOCKS_PER_SEGMENT = [3, 3, 5, 3, 3, 3, 5, 3];
/** Upper corner blocks taken by the two big screens (NE and SW, the middle block of each corner). */
export const SCREEN_BLOCKS: { seg: Segment; index: number }[] = [
  { seg: 7, index: 1 },
  { seg: 3, index: 1 },
];

function makeBlocks(): Block[] {
  const blocks: Block[] = [];
  for (const tier of [0, 1] as const) {
    let label = tier === 0 ? 101 : 201;
    for (const seg of SEGMENTS) {
      const n = BLOCKS_PER_SEGMENT[seg];
      for (let i = 0; i < n; i++) {
        const screen = tier === 1 && SCREEN_BLOCKS.some((s) => s.seg === seg && s.index === i);
        if (screen) continue;
        blocks.push({ seg, f0: i / n, f1: (i + 1) / n, stand: STAND_OF[seg], label: label++, tier });
      }
    }
  }
  return blocks;
}

export const BLOCKS: Block[] = makeBlocks();

// ---------------------------------------------------------------- rows of seats

/** One row inside one block: a run of seats between two aisles. */
export interface RowRun {
  block: number;
  /** 1-based row number within the tier. */
  row: number;
  /** Distance out of the seat centre line. */
  d: number;
  /** Height of the seat pan. */
  y: number;
  /** Where the seats start and end along the block (0..1 of the block's own span). */
  g0: number;
  g1: number;
  seats: number;
}

function makeRuns(): RowRun[] {
  const runs: RowRun[] = [];
  BLOCKS.forEach((block, b) => {
    const tier = block.tier === 0 ? LOWER : UPPER;
    let y = tier.y0;
    for (let r = 0; r < tier.rows; r++) {
      const d = tier.d0 + r * ROW_D + ROW_D * 0.55;
      const length = segmentLength(block.seg, d) * (block.f1 - block.f0);
      const seats = Math.floor((length - AISLE) / SEAT_W);
      const used = seats * SEAT_W;
      const g0 = (length - used) / 2 / length;
      runs.push({ block: b, row: r + 1, d, y: y + SEAT_H, g0, g1: 1 - g0, seats });
      y += tier.rise(r);
    }
  });
  return runs;
}

export const RUNS: RowRun[] = makeRuns();

// ---------------------------------------------------------------- every seat, best first

/**
 * All seats, ordered best first: seat 0 goes to the first person to arrive.
 * "Best" is close to the centre spot and low, with the lower tier ahead of the upper.
 */
export interface SeatTable {
  count: number;
  /** x, y (seat pan), z per seat. */
  pos: Float32Array;
  /** Direction the seat faces (towards the pitch), as a rotation around y. */
  yaw: Float32Array;
  /** Which row run each seat belongs to, and its number in that run (1-based). */
  run: Uint16Array;
  num: Uint16Array;
}

function seatScore(x: number, y: number, z: number, upper: boolean): number {
  // Distance to the centre spot, with the long sides favoured and height costing a little.
  return Math.hypot(x, z * 1.15) + y * 0.6 + (upper ? 18 : 0);
}

function makeSeats(): SeatTable {
  const p = { x: 0, z: 0, nx: 0, nz: 0 };
  const all: { x: number; y: number; z: number; yaw: number; run: number; num: number; score: number }[] = [];
  RUNS.forEach((run, r) => {
    const block = BLOCKS[run.block];
    for (let s = 0; s < run.seats; s++) {
      const g = run.g0 + ((s + 0.5) / run.seats) * (run.g1 - run.g0);
      outline(block.seg, block.f0 + g * (block.f1 - block.f0), run.d, p);
      const yaw = Math.atan2(-p.nx, -p.nz); // facing inwards
      all.push({ x: p.x, y: run.y, z: p.z, yaw, run: r, num: s + 1, score: seatScore(p.x, run.y, p.z, block.tier === 1) });
    }
  });
  all.sort((a, b) => a.score - b.score);
  // Spare seats beyond the capacity are the very worst; they are simply not built (see `RUN_SEATS`).
  const kept = all.slice(0, CAPACITY);
  const table: SeatTable = {
    count: kept.length,
    pos: new Float32Array(kept.length * 3),
    yaw: new Float32Array(kept.length),
    run: new Uint16Array(kept.length),
    num: new Uint16Array(kept.length),
  };
  kept.forEach((seat, i) => {
    table.pos[i * 3] = seat.x;
    table.pos[i * 3 + 1] = seat.y;
    table.pos[i * 3 + 2] = seat.z;
    table.yaw[i] = seat.yaw;
    table.run[i] = seat.run;
    table.num[i] = seat.num;
  });
  return table;
}

export const SEATS: SeatTable = makeSeats();

/**
 * Which seats of each run actually exist: a run may lose a few seats at its ends
 * when it holds some of the spare seats. Bit per seat, per run.
 */
export const RUN_SEATS: Uint8Array[] = (() => {
  const exists = RUNS.map((run) => new Uint8Array(run.seats));
  for (let i = 0; i < SEATS.count; i++) exists[SEATS.run[i]][SEATS.num[i] - 1] = 1;
  return exists;
})();

/** Everything a person needs to find their seat. Seat index is 0-based, best first. */
export function seatLabel(index: number): { stand: Stand; block: number; row: number; seat: number; tier: 0 | 1 } {
  const run = RUNS[SEATS.run[index]];
  const block = BLOCKS[run.block];
  return { stand: block.stand, block: block.label, row: run.row, seat: SEATS.num[index], tier: block.tier };
}

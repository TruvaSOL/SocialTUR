// How much of the pitch each of the best seats can see past the pitch-side buildings
// (players' tunnel, team benches). Run: npx tsx tools/check-sightlines.ts [seats]
// The boxes below must match src/stadium/pitch.ts (PITCHSIDE_BOXES is exported from there).
import { PITCH, SEATS, seatLabel } from '../src/stadium/layout';
import { PITCHSIDE_BOXES } from '../src/stadium/pitch';

const N = Number(process.argv[2] ?? 600);
/** `old`: the tall tunnel and benches before 2026-11-19, for comparison. */
const OLD = process.argv.includes('old');
const BOXES = OLD
  ? [
      { min: [-2.7, 0, -44.05], max: [2.7, 2.6, -43.75] },
      { min: [-2.9, 0, -44], max: [-2.7, 2.5, -39.4] },
      { min: [2.7, 0, -44], max: [2.9, 2.5, -39.4] },
      { min: [-3, 2.53, -44.1], max: [3, 2.67, -39.3] },
      { min: [-3.05, 2.45, -39.4], max: [3.05, 2.75, -39.2] },
      ...[-11, 11].flatMap((x) => [
        { min: [x - 3.5, 0.05, -38.01], max: [x + 3.5, 2.15, -37.89] },
        { min: [x - 3.6, 2.0, -38.15], max: [x + 3.6, 2.3, -36.25] },
      ]),
    ]
  : PITCHSIDE_BOXES;
const EYE_UP = 0.92; // as eyePoint() in src/main.ts
const FWD = 0.22;

/** Ray from o towards p hits box (min/max corners) before reaching p? */
function blocked(o: number[], p: number[], b: { min: number[]; max: number[] }): boolean {
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = p[k] - o[k];
    if (Math.abs(d) < 1e-9) {
      if (o[k] < b.min[k] || o[k] > b.max[k]) return false;
      continue;
    }
    let a = (b.min[k] - o[k]) / d;
    let c = (b.max[k] - o[k]) / d;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return false;
  }
  return t1 > 0 && t0 < 1;
}

const targets: number[][] = [];
for (let i = 0; i <= 20; i++) for (let j = 0; j <= 12; j++) targets.push([-PITCH.halfLength + (i / 20) * 2 * PITCH.halfLength, 0, -PITCH.halfWidth + (j / 12) * 2 * PITCH.halfWidth]);

const bad: string[] = [];
let worst = 1;
let sum = 0;
for (let s = 0; s < N; s++) {
  const yaw = SEATS.yaw[s];
  const o = [SEATS.pos[s * 3] + Math.sin(yaw) * FWD, SEATS.pos[s * 3 + 1] + EYE_UP, SEATS.pos[s * 3 + 2] + Math.cos(yaw) * FWD];
  let seen = 0;
  for (const p of targets) if (!BOXES.some((b) => blocked(o, p, b))) seen++;
  const f = seen / targets.length;
  sum += f;
  worst = Math.min(worst, f);
  if (f < 0.97) {
    const l = seatLabel(s);
    bad.push(`#${s + 1} ${l.stand} blok ${l.block} sıra ${l.row} koltuk ${l.seat}: sahanın %${Math.round(f * 100)}'i görünüyor`);
  }
}
console.log(`İlk ${N} koltuk: ortalama %${((sum / N) * 100).toFixed(1)}, en kötü %${Math.round(worst * 100)}, %97'nin altında ${bad.length} koltuk`);
console.log(bad.slice(0, 40).join('\n'));

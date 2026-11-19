import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { PITCH } from './layout';
import { Mesher, structureMaterial } from './mesher';
import { ring } from './structure';

const L = PITCH.halfLength;
const W = PITCH.halfWidth;
const LINE = 0.12;
const LINE_Y = 0.07;
/** Grass stripes cover the pitch and a little beyond it. */
const STRIPES = 18;
const BANDS = 10;
const STRIPE_X = L + 6;
const STRIPE_Z = W + 5;

/** A solid box beside the pitch, as min/max corners. tools/check-sightlines.ts tests the seats' view against these. */
export interface PitchsideBox {
  min: [number, number, number];
  max: [number, number, number];
  colour: 'ledBack' | 'white' | 'aegean' | 'glassTint' | 'concreteDark';
}

/** Centre line of the two team benches (north side). */
const BENCH_Z = -W - 2.4;

/**
 * The players' tunnel (middle of the north stand) and the team benches. All are kept low:
 * the best seats are the front rows right behind them, and a seated fan's eyes there are
 * only about 2.4 m above the pitch. The tunnel is a low mouth in the stand's front wall with
 * waist-high side walls, as in grounds where the tunnel runs under the stand; the benches are
 * low dugouts. Nothing here is taller than 1.1 m.
 */
export const PITCHSIDE_BOXES: PitchsideBox[] = [
  // Tunnel: dark mouth in the front wall, low white side walls, a dark floor and a blue rim.
  { min: [-2.7, 0, -44.1], max: [2.7, 1.0, -43.85], colour: 'ledBack' },
  { min: [-2.9, 0, -44], max: [-2.7, 0.9, -41.2], colour: 'white' },
  { min: [2.7, 0, -44], max: [2.9, 0.9, -41.2], colour: 'white' },
  { min: [-2.7, 0, -44], max: [2.7, 0.03, -41.2], colour: 'concreteDark' },
  { min: [-2.95, 0.9, -41.35], max: [2.95, 1.05, -41.15], colour: 'aegean' },
  // Benches: floor, low back screen, flat roof.
  ...[-11, 11].flatMap((x): PitchsideBox[] => [
    { min: [x - 3.5, 0, BENCH_Z - 0.8], max: [x + 3.5, 0.12, BENCH_Z + 0.8], colour: 'concreteDark' },
    { min: [x - 3.5, 0, BENCH_Z - 0.81], max: [x + 3.5, 1.0, BENCH_Z - 0.69], colour: 'glassTint' },
    { min: [x - 3.6, 1.0, BENCH_Z - 0.85], max: [x + 3.6, 1.08, BENCH_Z + 0.85], colour: 'glassTint' },
  ]),
];

/** A painted straight line from (x0, z0) to (x1, z1). */
function line(b: Builder, x0: number, z0: number, x1: number, z1: number): void {
  const length = Math.hypot(x1 - x0, z1 - z0) + LINE;
  b.add(new BoxGeometry(length, 0.01, LINE), C.line, {
    p: [(x0 + x1) / 2, LINE_Y, (z0 + z1) / 2],
    r: [0, -Math.atan2(z1 - z0, x1 - x0), 0],
  });
}

/** A painted circle or arc. Angles start at +x and turn towards -z. */
function arc(b: Builder, x: number, z: number, r: number, start = 0, length = Math.PI * 2): void {
  b.add(new RingGeometry(r - LINE / 2, r + LINE / 2, Math.max(8, Math.round(48 * (length / (Math.PI * 2)))), 1, start, length), C.line, {
    p: [x, LINE_Y, z],
    r: [-Math.PI / 2, 0, 0],
  });
}

function rect(b: Builder, x0: number, z0: number, x1: number, z1: number): void {
  line(b, x0, z0, x1, z0);
  line(b, x1, z0, x1, z1);
  line(b, x1, z1, x0, z1);
  line(b, x0, z1, x0, z0);
}

/** A goal on the line at x = side * L, with its net behind. */
function goal(b: Builder, side: 1 | -1): void {
  const x = side * (L + 0.06);
  const depth = 2.2;
  const halfW = 3.66;
  const height = 2.44;
  const post = (px: number, pz: number, h: number, r = 0.06) =>
    b.add(new CylinderGeometry(r, r, h, 8), C.line, { p: [px, h / 2, pz] });
  post(x, -halfW, height);
  post(x, halfW, height);
  b.add(new CylinderGeometry(0.06, 0.06, halfW * 2, 8), C.line, { p: [x, height, 0], r: [Math.PI / 2, 0, 0] });
  // Net frame and mesh: thin white strands are enough to read as a net.
  const back = x + side * depth;
  post(back, -halfW, height * 0.8, 0.03);
  post(back, halfW, height * 0.8, 0.03);
  const strand = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    b.group({ p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], r: [0, Math.atan2(x1 - x0, z1 - z0), 0] }, () => {
      b.add(new BoxGeometry(0.025, 0.025, length), C.line, { r: [-Math.asin((y1 - y0) / length), 0, 0] });
    });
  };
  for (let z = -halfW; z <= halfW + 0.01; z += 0.61) {
    strand(x, height, z, back, height * 0.8, z); // roof of the net
    strand(back, height * 0.8, z, back, 0, z); // back of the net
  }
  for (let y = 0.3; y < height * 0.8; y += 0.5) strand(back, y, -halfW, back, y, halfW);
  for (const z of [-halfW, halfW]) {
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      strand(x + side * depth * t, 0, z, x + side * depth * t, height - (height * 0.2) * t, z);
    }
  }
}

/** The ring of LED boards around the pitch, facing in. */
function boards(texture: Texture): Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const h = 0.95;
  const runs: [number, number, number, number][] = [
    [-L + 2, W + 4, L - 2, W + 4],
    [L - 2, -W - 4, -L + 2, -W - 4],
    [L + 4.5, W - 2, L + 4.5, -W + 2],
    [-L - 4.5, -W + 2, -L - 4.5, W - 2],
  ];
  for (const [x0, z0, x1, z1] of runs) {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const u1 = length / 12;
    pos.push(x0, 0, z0, x1, 0, z1, x1, h, z1, x0, 0, z0, x1, h, z1, x0, h, z0);
    uv.push(0, 0, u1, 0, u1, 1, 0, 0, u1, 1, 0, 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return new Mesh(g, new MeshBasicMaterial({ map: texture }));
}

/** The pitch, its markings, goals, corner flags, benches and the LED boards. */
export function createPitch(ledTexture: Texture): Group {
  const group = new Group();
  const m = new Mesher();

  // Grass everywhere inside the stands, then mown stripes over the playing area.
  const edge = ring(-0.05);
  for (let i = 0; i < edge.length - 1; i++) {
    m.tri([0, 0, 0], [edge[i].x, 0, edge[i].z], [edge[i + 1].x, 0, edge[i + 1].z], C.runoff);
  }
  const stripe = (STRIPE_X * 2) / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    const x0 = -STRIPE_X + i * stripe;
    // Mown both ways: stripes along the pitch, fainter bands across it.
    const band = (STRIPE_Z * 2) / BANDS;
    for (let j = 0; j < BANDS; j++) {
      const z0 = -STRIPE_Z + j * band;
      const color = i % 2 ? (j % 2 ? C.pitchDarkB : C.pitchDark) : j % 2 ? C.pitchLightB : C.pitchLight;
      m.quad([x0, 0.035, z0], [x0 + stripe, 0.035, z0], [x0 + stripe, 0.035, z0 + band], [x0, 0.035, z0 + band], color);
    }
  }
  // A paved apron between the grass and the stands.
  const inner = ring(-4.5);
  for (let i = 0; i < edge.length - 1; i++) {
    m.quad([inner[i].x, 0.03, inner[i].z], [inner[i + 1].x, 0.03, inner[i + 1].z], [edge[i + 1].x, 0.03, edge[i + 1].z], [edge[i].x, 0.03, edge[i].z], C.apron);
  }

  const b = new Builder();
  // Markings.
  rect(b, -L, -W, L, W);
  line(b, 0, -W, 0, W);
  arc(b, 0, 0, 9.15);
  b.add(new CylinderGeometry(0.15, 0.15, 0.01, 10), C.line, { p: [0, LINE_Y, 0] });
  for (const side of [1, -1] as const) {
    const gx = side * L;
    rect(b, gx, -20.16, gx - side * 16.5, 20.16);
    rect(b, gx, -9.16, gx - side * 5.5, 9.16);
    const spot = gx - side * 11;
    b.add(new CylinderGeometry(0.12, 0.12, 0.01, 10), C.line, { p: [spot, LINE_Y, 0] });
    // The arc outside the penalty area, centred on the spot and opening towards the middle.
    const half = Math.acos(5.5 / 9.15);
    const facing = side === 1 ? Math.PI : 0;
    arc(b, spot, 0, 9.15, facing - half, half * 2);
    goal(b, side);
  }
  // Corner arcs and flags.
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      // The quarter circle that lies inside the pitch.
      const start = sx === 1 ? (sz === 1 ? Math.PI / 2 : Math.PI) : sz === 1 ? 0 : -Math.PI / 2;
      arc(b, sx * L, sz * W, 1, start, Math.PI / 2);
      b.add(new CylinderGeometry(0.025, 0.025, 1.5, 6), C.line, { p: [sx * L, 0.75, sz * W] });
      b.add(new ConeGeometry(0.28, 0.4, 3), C.coral, { p: [sx * L + 0.12, 1.32, sz * W], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.15] });
    }
  }
  // The ball on the centre spot.
  b.add(new IcosahedronGeometry(0.16, 1), C.line, { p: [0, 0.16, 0] });
  // Players' tunnel and team benches (see PITCHSIDE_BOXES).
  for (const box of PITCHSIDE_BOXES) {
    const size = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
    const centre = [0, 1, 2].map((k) => (box.max[k] + box.min[k]) / 2) as [number, number, number];
    b.add(new BoxGeometry(size[0], size[1], size[2]), C[box.colour], { p: centre });
  }
  // Bench seats: low, so they hide nothing.
  for (const x of [-11, 11]) {
    for (let i = 0; i < 10; i++) b.add(new BoxGeometry(0.5, 0.4, 0.5), C.aegean, { p: [x - 3.15 + i * 0.7, 0.3, BENCH_Z - 0.2] });
  }

  const mesh = new Mesh(mergeGeometries([m.geometry(), b.geometry()], false), structureMaterial);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh, boards(ledTexture));
  return group;
}

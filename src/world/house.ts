import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';

/** The colours that change from house to house. Everything else is shared. */
export interface HouseStyle {
  wall: number;
  /** Door, shutters, railings. */
  accent: number;
  /** Floor of the roof terrace, seen from above. */
  roof: number;
}

export const HOUSE_STYLES: HouseStyle[] = [
  { wall: C.white, accent: C.aegean, roof: C.terracotta },
  { wall: C.wallPeach, accent: C.clothTeal, roof: C.tile },
  { wall: C.wallLemon, accent: C.coral, roof: C.terracotta },
  { wall: C.wallSky, accent: C.clothNavy, roof: C.tile },
];

/** A house model: how to build it and where its door and sides are (house coordinates, front faces +z). */
export interface HouseShape {
  build(style: HouseStyle): BufferGeometry;
  doorX: number;
  halfWidth: number;
}

/** Every house's front wall sits this far from its centre, so lots line up along the street. */
export const HOUSE_HALF_DEPTH = 1.8;
const BASE = 0.12; // top of the plinth

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

// The look: modern coastal town. Crisp white and pastel cubes, flat roofs used as terraces,
// coloured doors and shutters, a pergola or a parasol on the roof, flowers in pots.

/** A flat-roofed block from the plinth up, with a parapet and a terrace floor. x/z give its centre. */
function block(b: Builder, style: HouseStyle, w: number, h: number, d: number, x: number, z: number, y0 = BASE): number {
  const top = y0 + h;
  b.add(box(w, h, d), style.wall, { p: [x, y0 + h / 2, z] });
  // Parapet: four low walls around the roof; the terrace floor sits just inside them.
  const p = 0.32;
  b.add(box(w + 0.1, p, 0.16), style.wall, { p: [x, top + p / 2, z + d / 2 - 0.03] });
  b.add(box(w + 0.1, p, 0.16), style.wall, { p: [x, top + p / 2, z - d / 2 + 0.03] });
  b.add(box(0.16, p, d + 0.1), style.wall, { p: [x + w / 2 - 0.03, top + p / 2, z] });
  b.add(box(0.16, p, d + 0.1), style.wall, { p: [x - w / 2 + 0.03, top + p / 2, z] });
  b.add(box(w - 0.2, 0.06, d - 0.2), style.roof, { p: [x, top + 0.03, z] });
  return top;
}

/** A window with shutters on a +z wall, centred on the current group. */
function addWindow(b: Builder, style: HouseStyle, w = 0.9, h = 1.0, shutters = true): void {
  b.add(box(w + 0.12, h + 0.12, 0.08), C.white, { p: [0, 0, 0.02] });
  b.add(box(w, h, 0.08), C.glass, { p: [0, 0, 0.05] });
  b.add(box(w + 0.3, 0.08, 0.2), C.white, { p: [0, -h / 2 - 0.1, 0.08] });
  if (!shutters) return;
  for (const side of [1, -1]) b.add(box(0.36, h + 0.08, 0.07), style.accent, { p: [side * (w / 2 + 0.24), 0, 0.05] });
}

/** A wide picture window without shutters. */
function addGlassWall(b: Builder, w: number, h: number): void {
  b.add(box(w + 0.14, h + 0.14, 0.08), C.metalDark, { p: [0, 0, 0.02] });
  b.add(box(w, h, 0.08), C.glass, { p: [0, 0, 0.05] });
  b.add(box(0.06, h, 0.1), C.metalDark, { p: [0, 0, 0.06] });
}

/** Front door in the accent colour, a flat canopy over it and a step. Placed at plinth level on a +z wall. */
function addDoor(b: Builder, style: HouseStyle): void {
  b.add(box(1.06, 2.06, 0.08), C.white, { p: [0, 1.03, 0.02] });
  b.add(box(0.9, 1.95, 0.1), style.accent, { p: [0, 0.98, 0.05] });
  b.add(new IcosahedronGeometry(0.05, 0), C.brass, { p: [0.3, 1.0, 0.13] });
  b.add(box(1.7, 0.1, 0.8), C.white, { p: [0, 2.3, 0.4] });
  b.add(box(1.5, 0.12, 0.6), C.concrete, { p: [0, -0.06, 0.34] });
}

/** A terracotta pot with a plant; `flower` adds a splash of colour. */
function pot(b: Builder, x: number, y: number, z: number, flower: number | null = null, size = 1): void {
  b.add(new CylinderGeometry(0.2 * size, 0.15 * size, 0.3 * size, 7), C.terracotta, { p: [x, y + 0.15 * size, z] });
  b.add(new IcosahedronGeometry(0.28 * size, 0), flower ?? C.leaf, { p: [x, y + 0.5 * size, z] });
}

/** Bougainvillea climbing a wall corner: a few pink blobs over a green one. */
function bougainvillea(b: Builder, x: number, y: number, z: number): void {
  b.add(new IcosahedronGeometry(0.5, 0), C.leafDark, { p: [x, y, z], s: [1, 1.3, 0.7] });
  b.add(new IcosahedronGeometry(0.42, 0), C.flowerPink, { p: [x + 0.25, y + 0.5, z + 0.05], s: [1, 1, 0.7] });
  b.add(new IcosahedronGeometry(0.34, 0), C.flowerPink, { p: [x - 0.2, y + 0.95, z + 0.05], s: [1, 1, 0.7] });
}

/** A timber pergola: four posts and slats, footprint w x d, standing on height y. */
function pergola(b: Builder, x: number, y: number, z: number, w: number, d: number, h = 2.1): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.1, h, 0.1), C.wood, { p: [x + (sx * w) / 2, y + h / 2, z + (sz * d) / 2] });
  for (const sz of [-1, 1]) b.add(box(w + 0.3, 0.1, 0.1), C.wood, { p: [x, y + h, z + (sz * d) / 2] });
  const slats = Math.max(3, Math.round(w / 0.45));
  for (let i = 0; i < slats; i++) {
    b.add(box(0.07, 0.07, d + 0.4), C.wood, { p: [x - w / 2 + (i / (slats - 1)) * w, y + h + 0.08, z] });
  }
}

/** Rooftop solar water heater: a white tank over a dark tilted panel. */
function solarHeater(b: Builder, x: number, y: number, z: number): void {
  b.add(box(0.9, 0.06, 1.2), C.metalDark, { p: [x, y + 0.42, z], r: [0.5, 0, 0] });
  b.add(new CylinderGeometry(0.2, 0.2, 1.0, 7), C.white, { p: [x, y + 0.86, z - 0.5], r: [0, 0, Math.PI / 2] });
  for (const sx of [-0.38, 0.38]) b.add(box(0.05, 0.75, 0.05), C.metal, { p: [x + sx, y + 0.4, z - 0.5] });
}

function parasol(b: Builder, x: number, y: number, z: number, color: number): void {
  b.add(new CylinderGeometry(0.03, 0.03, 1.9, 4, 1, true), C.metalDark, { p: [x, y + 0.95, z] });
  b.add(new ConeGeometry(1.0, 0.45, 8), color, { p: [x, y + 2.0, z] });
  b.add(new CylinderGeometry(0.4, 0.4, 0.06, 8), C.white, { p: [x, y + 0.7, z] });
}

/** A thin railing along x from x0 to x1 at depth z, standing on height y. */
function railing(b: Builder, style: HouseStyle, x0: number, x1: number, y: number, z: number): void {
  b.add(box(x1 - x0, 0.06, 0.06), style.accent, { p: [(x0 + x1) / 2, y + 0.85, z] });
  const n = Math.max(2, Math.round((x1 - x0) / 0.45));
  for (let i = 0; i <= n; i++) b.add(box(0.05, 0.85, 0.05), style.accent, { p: [x0 + ((x1 - x0) * i) / n, y + 0.42, z] });
}

const plinth = (b: Builder, w: number, d: number, x = 0, z = 0) =>
  b.add(box(w + 0.3, BASE + 0.1, d + 0.3), C.concrete, { p: [x, (BASE + 0.1) / 2 - 0.05, z] });

// ---- Cube house: one storey, the whole roof a terrace under a pergola. ----
function buildCube(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  const w = 4.4;
  const d = HOUSE_HALF_DEPTH * 2;
  const front = HOUSE_HALF_DEPTH;
  plinth(b, w, d);
  const top = block(b, style, w, 2.9, d, 0, 0);
  b.group({ p: [-1.05, BASE, front] }, () => addDoor(b, style));
  b.group({ p: [0.95, BASE + 1.45, front] }, () => addWindow(b, style, 1.1, 1.1));
  for (const side of [1, -1]) {
    b.group({ p: [(side * w) / 2, BASE + 1.5, 0.1], r: [0, (side * Math.PI) / 2, 0] }, () => addWindow(b, style, 0.8, 1.0, false));
  }
  // Roof terrace.
  pergola(b, -0.8, top + 0.06, 0.2, 2.2, 2.2);
  pot(b, 1.7, top + 0.06, 1.2, C.flowerPink);
  pot(b, 1.75, top + 0.06, 0.5, null);
  solarHeater(b, 1.4, top + 0.06, -0.7);
  // Street level: flowers by the door, bougainvillea on the corner.
  pot(b, -1.9, 0, front + 0.35, C.coral);
  bougainvillea(b, w / 2 - 0.1, 1.2, front + 0.12);
  return b.geometry();
}

// ---- Two-storey house: a smaller upper floor leaves a terrace beside it; a balcony faces the street. ----
function buildTwoStorey(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  const w = 4.4;
  const d = HOUSE_HALF_DEPTH * 2;
  const front = HOUSE_HALF_DEPTH;
  plinth(b, w, d);
  const first = block(b, style, w, 2.8, d, 0, 0);
  const upperW = 2.9;
  const upperX = -w / 2 + upperW / 2;
  const top = block(b, style, upperW, 2.6, d - 0.5, upperX, -0.25, first);
  b.group({ p: [-1.05, BASE, front] }, () => addDoor(b, style));
  b.group({ p: [1.0, BASE + 1.4, front] }, () => addWindow(b, style, 1.1, 1.1));
  // Upstairs: a glass door onto a small balcony.
  b.group({ p: [upperX, first + 1.2, front - 0.5] }, () => addGlassWall(b, 1.5, 1.9));
  b.add(box(upperW, 0.1, 0.9), C.white, { p: [upperX, first + 0.1, front + 0.1] });
  railing(b, style, upperX - upperW / 2 + 0.05, upperX + upperW / 2 - 0.05, first + 0.15, front + 0.5);
  // Side terrace on the lower roof.
  parasol(b, 1.45, first + 0.06, 0.2, style.accent);
  pot(b, 1.9, first + 0.06, 1.3, C.flowerYellow);
  b.group({ p: [-w / 2, BASE + 1.4, 0], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, style, 0.8, 1.0, false));
  b.group({ p: [w / 2, BASE + 1.4, 0], r: [0, Math.PI / 2, 0] }, () => addWindow(b, style, 0.8, 1.0, false));
  b.group({ p: [-w / 2, first + 1.3, -0.2], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, style, 0.8, 1.0));
  solarHeater(b, upperX + 0.5, top + 0.06, -0.6);
  pot(b, 1.95, 0, front + 0.35, C.flowerPink);
  bougainvillea(b, -w / 2 + 0.1, 1.3, front + 0.12);
  return b.geometry();
}

// ---- Wide villa: a tall block and a lower wing with a glass front and a shaded patio. ----
function buildVilla(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  const front = HOUSE_HALF_DEPTH;
  const mainW = 3.2;
  const wingW = 2.6;
  const mainX = -wingW / 2;
  const wingX = mainW / 2;
  plinth(b, mainW + wingW, front * 2);
  const top = block(b, style, mainW, 3.4, front * 2, mainX, 0);
  const wingTop = block(b, style, wingW, 2.5, front * 2 - 0.8, wingX, -0.4);
  b.group({ p: [mainX - 0.4, BASE, front] }, () => addDoor(b, style));
  b.group({ p: [mainX + 0.9, BASE + 2.2, front] }, () => addWindow(b, style, 0.7, 0.7, false));
  // Wing: glass front opening onto a patio under a pergola.
  b.group({ p: [wingX, BASE + 1.15, front - 0.8] }, () => addGlassWall(b, 1.9, 1.9));
  b.add(box(wingW, 0.1, 0.9), C.tile, { p: [wingX, BASE - 0.02, front - 0.35] });
  pergola(b, wingX, BASE, front - 0.3, wingW - 0.4, 0.9, 2.3);
  pot(b, wingX + 0.9, BASE, front - 0.1, C.flowerPink, 0.9);
  b.group({ p: [mainX - mainW / 2, BASE + 1.5, 0], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, style, 0.8, 1.0));
  b.group({ p: [wingX + wingW / 2, BASE + 1.4, -0.4], r: [0, Math.PI / 2, 0] }, () => addWindow(b, style, 0.8, 1.0, false));
  // Roofs: sun loungers' parasol on the wing, water heater on the main block.
  parasol(b, wingX, wingTop + 0.06, -0.4, C.white);
  solarHeater(b, mainX + 0.3, top + 0.06, -0.5);
  pot(b, mainX - 1.1, top + 0.06, 1.2, null);
  bougainvillea(b, mainX - mainW / 2 + 0.1, 1.3, front + 0.12);
  return b.geometry();
}

export const HOUSE_SHAPES: HouseShape[] = [
  { build: buildCube, doorX: -1.05, halfWidth: 2.2 },
  { build: buildTwoStorey, doorX: -1.05, halfWidth: 2.2 },
  { build: buildVilla, doorX: -1.7, halfWidth: 2.9 },
];

import { BoxGeometry, type BufferGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, Shape } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';

/** The colours that change from house to house. Everything else is shared. */
export interface HouseStyle {
  wall: number;
  roof: number;
  roofDark: number;
  door: number;
}

export const HOUSE_STYLES: HouseStyle[] = [
  { wall: C.wall, roof: C.roof, roofDark: C.roofDark, door: C.door },
  { wall: C.wallWarm, roof: C.roofTeal, roofDark: C.roofTealDark, door: C.clothRed },
  { wall: C.wall, roof: C.roofSlate, roofDark: C.roofSlateDark, door: C.clothMustard },
  { wall: C.wallCool, roof: C.roofOchre, roofDark: C.roofOchreDark, door: C.clothNavy },
];

/** A house model: how to build it and where its door, sides and chimney are (house coordinates, front faces +z). */
export interface HouseShape {
  build(style: HouseStyle): BufferGeometry;
  doorX: number;
  halfWidth: number;
  /** Where chimney smoke starts. */
  smoke: { x: number; y: number; z: number };
}

/** Every house's front wall sits this far from its centre, so lots line up along the street. */
export const HOUSE_HALF_DEPTH = 1.8;
const BASE = 0.22; // top of the stone foundation
const OVERHANG = 0.45;

// Small trim pieces are plain boxes; only pieces big enough to show a soft edge pay for one.
export const box = (w: number, h: number, d: number, r = 0.05) =>
  r < 0.08 ? new BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r);

interface Shell {
  wallTop: number;
  peakY: number;
  front: number;
}

/**
 * Foundation, walls and a gable roof whose ridge runs front to back.
 * Proportions: short walls, big roof. That ratio is what makes a house read as cosy.
 */
function shell(b: Builder, style: HouseStyle, w: number, d: number, wallH: number, rise: number): Shell {
  const wallTop = BASE + wallH;
  const roofHalf = w / 2 + OVERHANG;
  const eaveY = wallTop - (rise * OVERHANG) / roofHalf;
  const peakY = eaveY + rise;
  const angle = Math.atan2(rise, roofHalf);
  const front = d / 2;

  b.add(box(w + 0.3, 0.3, d + 0.3), C.stone, { p: [0, 0.12, 0] });
  b.add(box(w, wallH, d, 0.1), style.wall, { p: [0, BASE + wallH / 2, 0] });

  // Gable ends: the triangular wall under the roof.
  const gable = new Shape();
  gable.moveTo(-w / 2 + 0.03, 0);
  gable.lineTo(w / 2 - 0.03, 0);
  gable.lineTo(0, peakY - wallTop);
  gable.closePath();
  b.add(new ExtrudeGeometry(gable, { depth: d - 0.06, bevelEnabled: false }), style.wall, {
    p: [0, wallTop - 0.02, -(d - 0.06) / 2],
  });

  // Timber beam where wall meets gable, front and back.
  b.add(box(w + 0.08, 0.16, 0.1), C.woodDark, { p: [0, wallTop, front + 0.01] });
  b.add(box(w + 0.08, 0.16, 0.1), C.woodDark, { p: [0, wallTop, -front - 0.01] });

  // Roof: two thick slabs, a darker trim along each eave, and a ridge cap.
  const slabLen = Math.hypot(roofHalf, rise) + 0.14;
  const roofDepth = d + 0.9;
  for (const side of [1, -1]) {
    b.group({ p: [(side * roofHalf) / 2, eaveY + rise / 2, 0], r: [0, 0, -side * angle] }, () => {
      b.add(box(slabLen, 0.24, roofDepth, 0.08), style.roof);
      b.add(box(0.34, 0.3, roofDepth + 0.06), style.roofDark, { p: [(side * slabLen) / 2 - side * 0.12, 0, 0] });
      // Two raised rows hint at tiles without adding real detail.
      b.add(box(0.12, 0.28, roofDepth + 0.02), style.roofDark, { p: [side * 0.25, 0, 0] });
      b.add(box(0.12, 0.28, roofDepth + 0.02), style.roofDark, { p: [-side * 0.6, 0, 0] });
    });
  }
  b.add(box(0.46, 0.26, roofDepth + 0.08, 0.1), style.roofDark, { p: [0, peakY + 0.04, 0] });
  return { wallTop, peakY, front };
}

/** A framed window on a wall facing +z of the current group. */
function addWindow(b: Builder, flowerBox: boolean): void {
  b.add(box(1.16, 1.06, 0.14), C.wood, { p: [0, 0, 0.02] });
  b.add(box(0.9, 0.8, 0.1), C.glass, { p: [0, 0, 0.06] });
  b.add(box(0.07, 0.8, 0.06), C.wood, { p: [0, 0, 0.1] });
  b.add(box(0.9, 0.07, 0.06), C.wood, { p: [0, 0, 0.1] });
  b.add(box(1.32, 0.1, 0.26), C.woodDark, { p: [0, -0.58, 0.1] });
  if (!flowerBox) return;
  b.add(box(1.12, 0.24, 0.28), C.wood, { p: [0, -0.76, 0.24] });
  for (let i = 0; i < 5; i++) {
    const x = -0.42 + i * 0.21;
    b.add(new IcosahedronGeometry(0.13, 0), C.leaf, { p: [x, -0.6, 0.25], r: [i, i * 2, 0] });
    b.add(new IcosahedronGeometry(0.075, 0), i % 2 ? C.flowerYellow : C.flowerPink, { p: [x + 0.04, -0.49, 0.3] });
  }
}

/** Front door with a little window, knob and step; optionally a small awning. Placed at ground level on a +z wall. */
function addDoor(b: Builder, style: HouseStyle, awning: boolean): void {
  b.add(box(1.14, 1.78, 0.14), C.woodDark, { p: [0, 0.89, 0.02] });
  b.add(box(0.88, 1.56, 0.12), style.door, { p: [0, 0.8, 0.07] });
  b.add(box(0.38, 0.38, 0.06), C.glass, { p: [0, 1.2, 0.12] });
  b.add(new IcosahedronGeometry(0.06, 0), C.brass, { p: [0.3, 0.75, 0.15] });
  if (awning) b.add(box(1.6, 0.1, 0.62), style.roofDark, { p: [0, 1.98, 0.3], r: [0.38, 0, 0] });
  b.add(box(1.5, 0.18, 0.7), C.stoneDark, { p: [0, -0.14, 0.42] });
}

function addChimney(b: Builder, x: number, z: number, top: number): void {
  b.add(box(0.58, 1.7, 0.58), C.stone, { p: [x, top - 0.85, z] });
  b.add(box(0.74, 0.16, 0.74), C.stoneDark, { p: [x, top, z] });
}

function addRoundWindow(b: Builder, y: number, z: number): void {
  b.add(new CylinderGeometry(0.36, 0.36, 0.14, 10), C.wood, { p: [0, y, z], r: [Math.PI / 2, 0, 0] });
  b.add(new CylinderGeometry(0.26, 0.26, 0.18, 10), C.glass, { p: [0, y, z], r: [Math.PI / 2, 0, 0] });
}

// ---- Cottage: the Stage 1 house. Low walls, big roof, door to one side. ----
const COTTAGE = { w: 4.2, wallH: 2.3, rise: 1.9, chimneyX: 1.25, chimneyZ: -0.7, doorX: -0.95 };
const COTTAGE_PEAK = BASE + COTTAGE.wallH - (COTTAGE.rise * OVERHANG) / (COTTAGE.w / 2 + OVERHANG) + COTTAGE.rise;

function buildCottage(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  const s = shell(b, style, COTTAGE.w, HOUSE_HALF_DEPTH * 2, COTTAGE.wallH, COTTAGE.rise);
  addChimney(b, COTTAGE.chimneyX, COTTAGE.chimneyZ, s.peakY + 0.25);
  b.group({ p: [COTTAGE.doorX, BASE, s.front] }, () => addDoor(b, style, true));
  // Windows: one beside the door, one on each side wall, a round one in the gable.
  b.group({ p: [0.95, BASE + 1.32, s.front] }, () => addWindow(b, true));
  b.group({ p: [COTTAGE.w / 2, BASE + 1.32, 0.1], r: [0, Math.PI / 2, 0] }, () => addWindow(b, false));
  b.group({ p: [-COTTAGE.w / 2, BASE + 1.32, 0.1], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, false));
  addRoundWindow(b, s.wallTop + 0.62, s.front - 0.02);
  return b.geometry();
}

// ---- Townhouse: two storeys, narrow, with a little balcony. ----
const TOWN = { w: 3.7, wallH: 4.2, rise: 1.7, chimneyX: -1.1, chimneyZ: -0.6, doorX: -0.8 };
const TOWN_PEAK = BASE + TOWN.wallH - (TOWN.rise * OVERHANG) / (TOWN.w / 2 + OVERHANG) + TOWN.rise;

function buildTownhouse(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  const s = shell(b, style, TOWN.w, HOUSE_HALF_DEPTH * 2, TOWN.wallH, TOWN.rise);
  addChimney(b, TOWN.chimneyX, TOWN.chimneyZ, s.peakY + 0.25);
  // A timber band marks the floor between the two storeys.
  b.add(box(TOWN.w + 0.06, 0.14, HOUSE_HALF_DEPTH * 2 + 0.06), C.woodDark, { p: [0, BASE + 2.2, 0] });
  b.group({ p: [TOWN.doorX, BASE, s.front] }, () => addDoor(b, style, true));
  b.group({ p: [0.8, BASE + 1.3, s.front] }, () => addWindow(b, false));
  const upper = BASE + 3.25;
  b.group({ p: [-0.8, upper, s.front] }, () => addWindow(b, true));
  b.group({ p: [0.8, upper, s.front] }, () => addWindow(b, false));
  // Balcony under the right-hand upstairs window.
  b.group({ p: [0.8, BASE + 2.42, s.front + 0.36] }, () => {
    b.add(box(1.6, 0.1, 0.72), C.woodDark);
    b.add(box(1.6, 0.07, 0.07), C.wood, { p: [0, 0.52, 0.32] });
    for (const x of [-0.76, -0.38, 0, 0.38, 0.76]) b.add(box(0.06, 0.5, 0.06), C.wood, { p: [x, 0.27, 0.32] });
    b.add(box(0.06, 0.5, 0.06), C.wood, { p: [-0.76, 0.27, 0] });
    b.add(box(0.06, 0.5, 0.06), C.wood, { p: [0.76, 0.27, 0] });
  });
  b.group({ p: [TOWN.w / 2, upper, 0], r: [0, Math.PI / 2, 0] }, () => addWindow(b, false));
  b.group({ p: [-TOWN.w / 2, BASE + 1.3, 0.3], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, false));
  addRoundWindow(b, s.wallTop + 0.55, s.front - 0.02);
  return b.geometry();
}

// ---- Bungalow: wide and low, roof ridge running side to side, a porch across the door. ----
const BUNG = { w: 5.4, wallH: 2.2, rise: 1.45, chimneyX: 1.5, chimneyZ: -0.5 };
const BUNG_PEAK = BASE + BUNG.wallH - (BUNG.rise * OVERHANG) / (HOUSE_HALF_DEPTH + OVERHANG) + BUNG.rise;

function buildBungalow(style: HouseStyle): BufferGeometry {
  const b = new Builder();
  // The same shell turned a quarter: its gables now face the sides and an eave faces the street.
  b.group({ r: [0, Math.PI / 2, 0] }, () => shell(b, style, HOUSE_HALF_DEPTH * 2, BUNG.w, BUNG.wallH, BUNG.rise));
  const front = HOUSE_HALF_DEPTH;
  addChimney(b, BUNG.chimneyX, BUNG.chimneyZ, BUNG_PEAK + 0.25);
  b.group({ p: [0, BASE, front] }, () => addDoor(b, style, false));
  b.group({ p: [-1.75, BASE + 1.28, front] }, () => addWindow(b, true));
  b.group({ p: [1.75, BASE + 1.28, front] }, () => addWindow(b, false));
  // Porch: a floor, two posts, a low rail and a lean-to roof.
  b.add(box(3.2, 0.18, 1.15), C.stoneDark, { p: [0, 0.11, front + 0.6] });
  for (const x of [-1.45, 1.45]) b.add(box(0.14, 1.95, 0.14), C.wood, { p: [x, 1.15, front + 1.05] });
  b.add(box(1.0, 0.07, 0.07), C.wood, { p: [-0.95, 0.75, front + 1.05] });
  b.add(box(1.0, 0.07, 0.07), C.wood, { p: [0.95, 0.75, front + 1.05] });
  b.add(box(3.5, 0.12, 1.5), style.roofDark, { p: [0, 2.18, front + 0.62], r: [0.2, 0, 0] });
  // A dormer in the roof gives the long front some life.
  b.group({ p: [0, BASE + BUNG.wallH + 0.55, front - 0.55] }, () => {
    b.add(box(1.3, 0.9, 0.9), style.wall);
    b.add(box(0.8, 0.5, 0.08), C.glass, { p: [0, 0, 0.46] });
    b.add(box(1.6, 0.12, 1.2), style.roof, { p: [0, 0.5, 0.05] });
  });
  // Round windows in the two side gables.
  for (const side of [1, -1]) {
    b.group({ p: [side * (BUNG.w / 2 - 0.02), BASE + BUNG.wallH + 0.5, 0], r: [0, (side * Math.PI) / 2, 0] }, () =>
      addRoundWindow(b, 0, 0),
    );
  }
  return b.geometry();
}

export const HOUSE_SHAPES: HouseShape[] = [
  {
    build: buildCottage,
    doorX: COTTAGE.doorX,
    halfWidth: COTTAGE.w / 2,
    smoke: { x: COTTAGE.chimneyX, y: COTTAGE_PEAK + 0.4, z: COTTAGE.chimneyZ },
  },
  {
    build: buildTownhouse,
    doorX: TOWN.doorX,
    halfWidth: TOWN.w / 2,
    smoke: { x: TOWN.chimneyX, y: TOWN_PEAK + 0.4, z: TOWN.chimneyZ },
  },
  {
    build: buildBungalow,
    doorX: 0,
    halfWidth: BUNG.w / 2,
    smoke: { x: BUNG.chimneyX, y: BUNG_PEAK + 0.4, z: BUNG.chimneyZ },
  },
];

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, IcosahedronGeometry, Mesh, Shape, SphereGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, flatMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { DOOR_LOCAL_X, HOUSE_HALF_DEPTH } from './layout';

export interface House {
  group: Group;
  update(time: number): void;
}

// Proportions: short walls, big roof. That ratio is what makes it read as cosy.
const W = 4.2; // width (x)
const D = HOUSE_HALF_DEPTH * 2; // depth (z); the front faces +z
const BASE = 0.22; // top of the stone foundation
const WALL_H = 2.3;
const WALL_TOP = BASE + WALL_H;
const OVERHANG = 0.45;
const ROOF_RISE = 1.9;
const ROOF_HALF = W / 2 + OVERHANG;
const EAVE_Y = WALL_TOP - (ROOF_RISE * OVERHANG) / ROOF_HALF;
const PEAK_Y = EAVE_Y + ROOF_RISE;
const ROOF_ANGLE = Math.atan2(ROOF_RISE, ROOF_HALF);

// Small trim pieces are plain boxes; only pieces big enough to show a soft edge pay for one.
const box = (w: number, h: number, d: number, r = 0.05) =>
  r < 0.06 ? new BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r);

/** A framed window on a wall facing +z of the current group. */
function addWindow(b: Builder, flowerBox: boolean): void {
  b.add(box(1.16, 1.06, 0.14), C.wood, { p: [0, 0, 0.02] });
  b.add(box(0.9, 0.8, 0.1, 0.03), C.glass, { p: [0, 0, 0.06] });
  b.add(box(0.07, 0.8, 0.06, 0.02), C.wood, { p: [0, 0, 0.1] });
  b.add(box(0.9, 0.07, 0.06, 0.02), C.wood, { p: [0, 0, 0.1] });
  b.add(box(1.32, 0.1, 0.26, 0.04), C.woodDark, { p: [0, -0.58, 0.1] });
  if (!flowerBox) return;
  b.add(box(1.12, 0.24, 0.28, 0.06), C.wood, { p: [0, -0.76, 0.24] });
  for (let i = 0; i < 5; i++) {
    const x = -0.42 + i * 0.21;
    b.add(new IcosahedronGeometry(0.13, 0), C.leaf, { p: [x, -0.6, 0.25], r: [i, i * 2, 0] });
    b.add(new IcosahedronGeometry(0.075, 0), i % 2 ? C.flowerYellow : C.flowerPink, { p: [x + 0.04, -0.49, 0.3] });
  }
}

export function createHouse(): House {
  const group = new Group();
  const b = new Builder();
  const front = D / 2;

  // Foundation and walls.
  b.add(box(W + 0.3, 0.3, D + 0.3, 0.08), C.stone, { p: [0, 0.12, 0] });
  b.add(box(W, WALL_H, D, 0.1), C.wall, { p: [0, BASE + WALL_H / 2, 0] });

  // Gable ends: the triangular wall under the roof.
  const gable = new Shape();
  gable.moveTo(-W / 2 + 0.03, 0);
  gable.lineTo(W / 2 - 0.03, 0);
  gable.lineTo(0, PEAK_Y - WALL_TOP);
  gable.closePath();
  b.add(new ExtrudeGeometry(gable, { depth: D - 0.06, bevelEnabled: false }), C.wall, {
    p: [0, WALL_TOP - 0.02, -(D - 0.06) / 2],
  });

  // Timber beam where wall meets gable, front and back.
  b.add(box(W + 0.08, 0.16, 0.1, 0.04), C.woodDark, { p: [0, WALL_TOP, front + 0.01] });
  b.add(box(W + 0.08, 0.16, 0.1, 0.04), C.woodDark, { p: [0, WALL_TOP, -front - 0.01] });

  // Roof: two thick slabs, a darker trim along each eave, and a ridge cap.
  const slabLen = Math.hypot(ROOF_HALF, ROOF_RISE) + 0.14;
  const roofDepth = D + 0.9;
  for (const side of [1, -1]) {
    b.group({ p: [(side * ROOF_HALF) / 2, EAVE_Y + ROOF_RISE / 2, 0], r: [0, 0, -side * ROOF_ANGLE] }, () => {
      b.add(box(slabLen, 0.24, roofDepth, 0.08), C.roof);
      b.add(box(0.34, 0.3, roofDepth + 0.06, 0.08), C.roofDark, { p: [(side * slabLen) / 2 - side * 0.12, 0, 0] });
      // Two raised rows hint at tiles without adding real detail.
      b.add(box(0.12, 0.28, roofDepth + 0.02, 0.04), C.roofDark, { p: [side * 0.25, 0, 0] });
      b.add(box(0.12, 0.28, roofDepth + 0.02, 0.04), C.roofDark, { p: [-side * 0.6, 0, 0] });
    });
  }
  b.add(box(0.46, 0.26, roofDepth + 0.08, 0.1), C.roofDark, { p: [0, PEAK_Y + 0.04, 0] });

  // Chimney.
  const chimneyX = 1.25;
  const chimneyZ = -0.7;
  const chimneyTop = PEAK_Y + 0.25;
  b.add(box(0.58, 1.7, 0.58, 0.06), C.stone, { p: [chimneyX, chimneyTop - 0.85, chimneyZ] });
  b.add(box(0.74, 0.16, 0.74, 0.05), C.stoneDark, { p: [chimneyX, chimneyTop, chimneyZ] });

  // Front door with a little window, knob, awning and step.
  b.group({ p: [DOOR_LOCAL_X, BASE, front] }, () => {
    b.add(box(1.14, 1.78, 0.14, 0.06), C.woodDark, { p: [0, 0.89, 0.02] });
    b.add(box(0.88, 1.56, 0.12, 0.05), C.door, { p: [0, 0.8, 0.07] });
    b.add(box(0.38, 0.38, 0.06, 0.05), C.glass, { p: [0, 1.2, 0.12] });
    b.add(new SphereGeometry(0.055, 8, 6), C.brass, { p: [0.3, 0.75, 0.15] });
    b.add(box(1.6, 0.1, 0.62, 0.04), C.roofDark, { p: [0, 1.98, 0.3], r: [0.38, 0, 0] });
    b.add(box(1.5, 0.18, 0.7, 0.06), C.stoneDark, { p: [0, -0.14, 0.42] });
  });

  // Windows: one beside the door, one on each side wall, a round one in the gable.
  b.group({ p: [0.95, BASE + 1.32, front] }, () => addWindow(b, true));
  b.group({ p: [W / 2, BASE + 1.32, 0.1], r: [0, Math.PI / 2, 0] }, () => addWindow(b, false));
  b.group({ p: [-W / 2, BASE + 1.32, 0.1], r: [0, -Math.PI / 2, 0] }, () => addWindow(b, false));
  b.add(new CylinderGeometry(0.36, 0.36, 0.14, 14), C.wood, { p: [0, WALL_TOP + 0.62, front - 0.02], r: [Math.PI / 2, 0, 0] });
  b.add(new CylinderGeometry(0.26, 0.26, 0.18, 14), C.glass, { p: [0, WALL_TOP + 0.62, front - 0.02], r: [Math.PI / 2, 0, 0] });

  group.add(b.mesh());

  // Chimney smoke: a few puffs that rise, drift and shrink. Shared geometry, no transparency.
  const puffGeo = new Builder().add(new IcosahedronGeometry(0.2, 1), C.cloud).geometry();
  const origin = new Vector3(chimneyX, chimneyTop + 0.15, chimneyZ);
  const puffs: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const puff = new Mesh(puffGeo, flatMaterial);
    puffs.push(puff);
    group.add(puff);
  }

  return {
    group,
    update(time) {
      puffs.forEach((puff, i) => {
        const life = (time * 0.22 + i / puffs.length) % 1;
        puff.position.set(origin.x + life * 0.7 + Math.sin(life * 6 + i) * 0.08, origin.y + life * 1.9, origin.z + life * 0.25);
        puff.scale.setScalar(Math.sin(life * Math.PI) * (0.7 + life * 0.9));
      });
    },
  };
}

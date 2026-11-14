import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Mesh } from 'three';
import { Builder, seededRandom } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import {
  DOOR_LOCAL_X,
  GRID_HALF,
  HOUSE_HALF_DEPTH,
  ISLAND_RADIUS,
  LOTS,
  PLANTER_RADIUS,
  PLAZA_RADIUS,
  STREET_HALF,
  STREET_LINES,
  isFree,
  lotToWorld,
} from './district';

// Heights of the flat layers. Kept well apart so they never flicker when seen from far away.
const PATCH_TOP = 0.015;
const STREET_TOP = 0.04;
const PLAZA_TOP = 0.055;

/** The whole district floor and its small scenery, merged into one mesh (one draw call). */
export function createGround(): Mesh {
  const b = new Builder();
  const R = ISLAND_RADIUS;
  const rnd = seededRandom(7);

  // The island: grass cap, grass rim, two bands of earth tapering underneath.
  b.add(new CylinderGeometry(R - 0.5, R, 0.3, 72), C.grass, { p: [0, -0.15, 0] });
  b.add(new CylinderGeometry(R, R - 0.3, 1.2, 72), C.grassDark, { p: [0, -0.9, 0] });
  b.add(new CylinderGeometry(R - 0.6, R - 9, 5, 72), C.earth, { p: [0, -4, 0] });
  b.add(new CylinderGeometry(R - 9, R - 30, 5, 72), C.earthDark, { p: [0, -9, 0] });

  // Soft colour patches so the lawn is not one flat green. A jittered grid keeps them from overlapping.
  for (let gx = -R; gx < R; gx += 15) {
    for (let gz = -R; gz < R; gz += 15) {
      const x = gx + 7.5 + (rnd() - 0.5) * 5;
      const z = gz + 7.5 + (rnd() - 0.5) * 5;
      const radius = 2.5 + rnd() * 2.2;
      if (Math.hypot(x, z) > R - radius - 2) continue;
      b.add(new CylinderGeometry(radius, radius, 0.02, 12), rnd() < 0.5 ? C.grassLight : C.grassDark, {
        p: [x, PATCH_TOP - 0.01, z],
        s: [1, 1, 0.7 + rnd() * 0.3],
        r: [0, rnd() * 3, 0],
      });
    }
  }

  // Streets, both directions.
  for (const line of STREET_LINES) {
    b.add(new BoxGeometry(GRID_HALF * 2, 0.06, STREET_HALF * 2), C.sand, { p: [0, STREET_TOP - 0.03, line] });
    b.add(new BoxGeometry(STREET_HALF * 2, 0.06, GRID_HALF * 2), C.sand, { p: [line, STREET_TOP - 0.03, 0] });
  }

  // Front paths from each door to the street.
  for (const lot of LOTS) {
    b.group({ p: [lot.x, 0, lot.z], r: [0, lot.yaw, 0] }, () => {
      b.add(new BoxGeometry(1.1, 0.06, 1.7), C.sand, { p: [DOOR_LOCAL_X, STREET_TOP - 0.03, HOUSE_HALF_DEPTH + 1.15] });
    });
  }

  // Plaza: paved disc, a planter for the big tree, benches around it.
  b.add(new CylinderGeometry(PLAZA_RADIUS, PLAZA_RADIUS, 0.06, 40), C.stone, { p: [0, PLAZA_TOP - 0.03, 0] });
  b.add(new CylinderGeometry(PLAZA_RADIUS - 2.2, PLAZA_RADIUS - 2.2, 0.06, 40), C.sand, { p: [0, PLAZA_TOP - 0.015, 0] });
  b.add(new CylinderGeometry(PLANTER_RADIUS, PLANTER_RADIUS + 0.12, 0.5, 12), C.stoneDark, { p: [0, 0.25, 0] });
  b.add(new CylinderGeometry(PLANTER_RADIUS - 0.14, PLANTER_RADIUS - 0.14, 0.1, 12), C.grass, { p: [0, 0.47, 0] });
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    b.group({ p: [Math.sin(angle) * 6.6, PLAZA_TOP, Math.cos(angle) * 6.6], r: [0, angle + Math.PI, 0] }, () => {
      b.add(new BoxGeometry(1.7, 0.1, 0.5), C.wood, { p: [0, 0.45, 0] });
      b.add(new BoxGeometry(1.7, 0.36, 0.08), C.wood, { p: [0, 0.74, -0.24], r: [-0.14, 0, 0] });
      b.add(new BoxGeometry(0.1, 0.42, 0.44), C.woodDark, { p: [-0.7, 0.21, 0] });
      b.add(new BoxGeometry(0.1, 0.42, 0.44), C.woodDark, { p: [0.7, 0.21, 0] });
    });
  }

  // A lamp post at one corner of every crossing.
  for (const lx of STREET_LINES) {
    for (const lz of STREET_LINES) {
      if (lx === 0 && lz === 0) continue;
      const x = lx + STREET_HALF + 0.5;
      const z = lz + STREET_HALF + 0.5;
      b.add(new CylinderGeometry(0.06, 0.09, 2.7, 5, 1, true), C.shoe, { p: [x, 1.35, z] });
      b.add(new CylinderGeometry(0.2, 0.12, 0.12, 6), C.shoe, { p: [x, 2.72, z] });
      b.add(new IcosahedronGeometry(0.19, 0), C.brass, { p: [x, 2.9, z] });
    }
  }

  // A bush beside every house.
  LOTS.forEach((lot, i) => {
    const r = 0.5 + rnd() * 0.25;
    const p = lotToWorld(lot, i % 2 ? 2.75 : -2.8, HOUSE_HALF_DEPTH + 0.2 + rnd() * 0.6);
    b.add(new IcosahedronGeometry(r, 1), i % 3 ? C.leafDark : C.leaf, { p: [p.x, r * 0.6, p.z], s: [1, 0.8, 1] });
    b.add(new IcosahedronGeometry(r * 0.6, 0), C.leafLight, { p: [p.x + r * 0.45, r * 0.95, p.z + r * 0.3], s: [1, 0.8, 1] });
  });

  // Grass tufts, flowers and stones scattered on free ground.
  const spot = (): [number, number] | null => {
    for (let tries = 0; tries < 30; tries++) {
      const angle = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * (R - 3);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (isFree(x, z)) return [x, z];
    }
    return null;
  };
  for (let i = 0; i < 420; i++) {
    const at = spot();
    if (!at) continue;
    for (let k = 0; k < 3; k++) {
      b.add(new ConeGeometry(0.07, 0.24 + rnd() * 0.14, 4, 1, true), k === 1 ? C.leafLight : C.grassDark, {
        p: [at[0] + (k - 1) * 0.1, 0.12, at[1] + (rnd() - 0.5) * 0.12],
        r: [(rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4],
      });
    }
  }
  for (let i = 0; i < 220; i++) {
    const at = spot();
    if (!at) continue;
    const petal = i % 3 === 0 ? C.flowerYellow : i % 3 === 1 ? C.flowerPink : C.cloud;
    b.add(new CylinderGeometry(0.02, 0.02, 0.26, 4, 1, true), C.leafDark, { p: [at[0], 0.13, at[1]] });
    b.add(new IcosahedronGeometry(0.09, 0), petal, { p: [at[0], 0.3, at[1]], s: [1, 0.7, 1] });
  }
  for (let i = 0; i < 70; i++) {
    const at = spot();
    if (!at) continue;
    const size = 0.18 + rnd() * 0.22;
    b.add(new IcosahedronGeometry(size, 0), i % 2 ? C.stone : C.stoneDark, {
      p: [at[0], size * 0.3, at[1]],
      s: [1.2, 0.65, 1],
      r: [0, rnd() * 3, 0],
    });
  }

  return b.mesh();
}

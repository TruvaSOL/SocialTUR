import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Mesh,
} from 'three';
import { Builder, seededRandom } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { DOOR_LOCAL_X, HOUSE_HALF_DEPTH, HOUSE_POS, ISLAND_RADIUS, PATH, isOccupied, pathPoint } from './layout';

const PATH_Y = 0.04;

/** A flat ribbon following the walking ellipse. */
function pathRibbon(segments = 72): BufferGeometry {
  const half = PATH.width / 2;
  const positions: number[] = [];
  const edge = (i: number, offset: number): [number, number, number] => {
    const theta = (i / segments) * Math.PI * 2;
    const p = pathPoint(theta);
    // Outward normal of the ellipse at this point.
    let nx = Math.cos(theta) / PATH.rx;
    let nz = Math.sin(theta) / PATH.rz;
    const len = Math.hypot(nx, nz);
    nx /= len;
    nz /= len;
    return [p.x + nx * offset, PATH_Y, p.z + nz * offset];
  };
  const tri = (a: number[], b: number[], c: number[]) => {
    // Keep every triangle facing up, whatever order the corners arrive in.
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    positions.push(...a, ...(up >= 0 ? b : c), ...(up >= 0 ? c : b));
  };
  for (let i = 0; i < segments; i++) {
    const a = edge(i, -half);
    const b = edge(i, half);
    const c = edge(i + 1, -half);
    const d = edge(i + 1, half);
    tri(a, b, c);
    tri(c, b, d);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createGround(): Mesh {
  const b = new Builder();
  const R = ISLAND_RADIUS;

  // The patch itself: grass cap, grass rim, two bands of earth tapering underneath.
  b.add(new CylinderGeometry(R - 0.18, R, 0.14, 44), C.grass, { p: [0, -0.07, 0] });
  b.add(new CylinderGeometry(R, R - 0.06, 0.34, 44), C.grassDark, { p: [0, -0.31, 0] });
  b.add(new CylinderGeometry(R - 0.12, R - 1.7, 1.0, 44), C.earth, { p: [0, -0.98, 0] });
  b.add(new CylinderGeometry(R - 1.7, R - 5.2, 0.9, 44), C.earthDark, { p: [0, -1.93, 0] });

  // Soft colour patches so the lawn is not one flat green.
  const rnd = seededRandom(7);
  for (let i = 0; i < 9; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = rnd() * (R - 2.6);
    const radius = 0.9 + rnd() * 1.3;
    b.add(new CylinderGeometry(radius, radius, 0.02, 12), i % 2 ? C.grassLight : C.grassDark, {
      p: [Math.cos(angle) * dist, 0.004 + i * 0.003, Math.sin(angle) * dist],
      s: [1, 1, 0.7 + rnd() * 0.3],
      r: [0, rnd() * 3, 0],
    });
  }

  // Walking path, and a short link from the path to the front door.
  b.add(pathRibbon(), C.sand);
  const doorX = HOUSE_POS.x + DOOR_LOCAL_X;
  const linkStart = HOUSE_POS.z + HOUSE_HALF_DEPTH + 0.5;
  const linkEnd = PATH.cz - PATH.rz * Math.sqrt(1 - ((doorX - PATH.cx) / PATH.rx) ** 2) + 0.2;
  b.add(new BoxGeometry(PATH.width, 0.08, linkEnd - linkStart), C.sand, {
    p: [doorX, PATH_Y - 0.04, (linkStart + linkEnd) / 2],
  });

  // Grass tufts, flowers and stones scattered on free ground.
  const spot = (): [number, number] => {
    for (let tries = 0; tries < 40; tries++) {
      const angle = rnd() * Math.PI * 2;
      const dist = Math.sqrt(rnd()) * (R - 1);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (!isOccupied(x, z)) return [x, z];
    }
    return [0, R - 1.5];
  };
  for (let i = 0; i < 26; i++) {
    const [x, z] = spot();
    for (let k = 0; k < 3; k++) {
      b.add(new ConeGeometry(0.07, 0.24 + rnd() * 0.14, 4), k === 1 ? C.leafLight : C.grassDark, {
        p: [x + (k - 1) * 0.1, 0.12, z + (rnd() - 0.5) * 0.12],
        r: [(rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4],
      });
    }
  }
  for (let i = 0; i < 16; i++) {
    const [x, z] = spot();
    const petal = i % 3 === 0 ? C.flowerYellow : i % 3 === 1 ? C.flowerPink : C.cloud;
    b.add(new CylinderGeometry(0.02, 0.02, 0.26, 4), C.leafDark, { p: [x, 0.13, z] });
    b.add(new IcosahedronGeometry(0.09, 0), petal, { p: [x, 0.3, z], s: [1, 0.7, 1] });
  }
  for (let i = 0; i < 7; i++) {
    const [x, z] = spot();
    const size = 0.18 + rnd() * 0.2;
    b.add(new IcosahedronGeometry(size, 0), i % 2 ? C.stone : C.stoneDark, {
      p: [x, size * 0.3, z],
      s: [1.2, 0.65, 1],
      r: [0, rnd() * 3, 0],
    });
  }
  // Three round bushes to frame the house.
  const bushes: [number, number, number][] = [
    [HOUSE_POS.x + 2.75, HOUSE_POS.z + 1.9, 0.55],
    [HOUSE_POS.x - 2.75, HOUSE_POS.z + 1.5, 0.65],
    [HOUSE_POS.x - 2.9, HOUSE_POS.z + 0.5, 0.45],
  ];
  bushes.forEach(([x, z, r], i) => {
    b.add(new IcosahedronGeometry(r, 1), i === 1 ? C.leaf : C.leafDark, { p: [x, r * 0.6, z], s: [1, 0.8, 1] });
    b.add(new IcosahedronGeometry(r * 0.6, 1), C.leafLight, { p: [x + r * 0.45, r * 0.95, z + r * 0.3], s: [1, 0.8, 1] });
  });

  return b.mesh();
}

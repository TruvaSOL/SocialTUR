import { type BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';

/** One tree as a single geometry: trunk, four leaf blobs, a few fruit. */
export function buildTreeGeometry(): BufferGeometry {
  const b = new Builder();
  b.add(new CylinderGeometry(0.36, 0.52, 0.3, 6, 1, true), C.trunk, { p: [0, 0.15, 0] });
  b.add(new CylinderGeometry(0.22, 0.36, 1.7, 6, 1, true), C.trunk, { p: [0, 1.1, 0] });
  b.add(new CylinderGeometry(0.08, 0.13, 0.7, 5, 1, true), C.trunk, { p: [0.38, 1.75, 0.05], r: [0, 0, -0.9] });

  const blob = (x: number, y: number, z: number, r: number, color: number) =>
    b.add(new IcosahedronGeometry(r, 1), color, { p: [x, y + 1.9, z], s: [1, 0.86, 1], r: [x, y * 2, z] });
  blob(0, 0.95, 0, 1.4, C.leaf);
  blob(0.95, 0.5, 0.35, 0.95, C.leafDark);
  blob(-0.85, 0.6, -0.35, 1.0, C.leafDark);
  blob(-0.1, 1.75, 0.25, 0.95, C.leafLight);
  // A few fruit for a spot of warm colour.
  const fruit: [number, number, number][] = [
    [0.75, 0.75, 1.02],
    [-0.4, 0.5, 1.15],
    [1.55, 0.6, 0.45],
    [-1.3, 0.85, 0.75],
  ];
  fruit.forEach(([x, y, z]) => b.add(new IcosahedronGeometry(0.13, 0), C.fruit, { p: [x, y + 1.9, z] }));
  return b.geometry();
}

/** A pine: a short trunk and three stacked cones, each a little narrower and lighter. */
export function buildPineGeometry(): BufferGeometry {
  const b = new Builder();
  b.add(new CylinderGeometry(0.16, 0.26, 1.2, 6, 1, true), C.trunk, { p: [0, 0.6, 0] });
  const layers: [number, number, number, number][] = [
    [1.55, 2.0, 1.9, C.palmDark],
    [1.2, 1.8, 3.0, C.leafDark],
    [0.8, 1.5, 4.0, C.leaf],
  ];
  layers.forEach(([r, h, y, color], i) => b.add(new ConeGeometry(r, h, 7), color, { p: [0, y, 0], r: [0, i * 0.5, 0] }));
  return b.geometry();
}

/** One palm as a single geometry: a slightly curved trunk, a ring of drooping fronds, a few coconuts. */
export function buildPalmGeometry(): BufferGeometry {
  const b = new Builder();
  // Trunk: four short pieces, each leaning a little further, so it reads as a gentle curve.
  let x = 0;
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const lean = 0.05 + i * 0.05;
    const r = 0.2 - i * 0.025;
    b.add(new CylinderGeometry(r - 0.02, r, 1.4, 6, 1, true), i % 2 ? C.trunk : C.woodDark, { p: [x + Math.sin(lean) * 0.65, y + 0.65, 0], r: [0, 0, -lean] });
    x += Math.sin(lean) * 1.3;
    y += Math.cos(lean) * 1.3;
  }
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const droop = 1.75 + (i % 2) * 0.25;
    b.group({ p: [x, y, 0], r: [0, (i / fronds) * Math.PI * 2, 0] }, () => {
      b.add(new ConeGeometry(0.42, 2.5, 4), i % 2 ? C.palm : C.palmDark, {
        p: [0, Math.cos(droop) * 1.15 + 0.1, Math.sin(droop) * 1.15],
        r: [droop, 0, 0],
        s: [1, 1, 0.22],
      });
    });
  }
  b.add(new IcosahedronGeometry(0.3, 0), C.palmDark, { p: [x, y + 0.05, 0] });
  b.add(new IcosahedronGeometry(0.13, 0), C.woodDark, { p: [x + 0.2, y - 0.2, 0.12] });
  b.add(new IcosahedronGeometry(0.13, 0), C.woodDark, { p: [x - 0.15, y - 0.22, -0.14] });
  return b.geometry();
}
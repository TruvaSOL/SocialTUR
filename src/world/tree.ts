import { type BufferGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
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

import { CylinderGeometry, Group, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';

export interface Tree {
  group: Group;
  update(time: number): void;
}

export function createTree(): Tree {
  const group = new Group();

  const trunk = new Builder();
  trunk.add(new CylinderGeometry(0.36, 0.52, 0.3, 7), C.trunk, { p: [0, 0.15, 0] });
  trunk.add(new CylinderGeometry(0.22, 0.36, 1.7, 7), C.trunk, { p: [0, 1.1, 0] });
  trunk.add(new CylinderGeometry(0.08, 0.13, 0.7, 5), C.trunk, { p: [0.38, 1.75, 0.05], r: [0, 0, -0.9] });
  group.add(trunk.mesh());

  // The crown pivots at the top of the trunk so it can sway as one piece.
  const crown = new Group();
  crown.position.set(0, 1.9, 0);
  const leaves = new Builder();
  const blob = (x: number, y: number, z: number, r: number, color: number) =>
    leaves.add(new IcosahedronGeometry(r, 1), color, { p: [x, y, z], s: [1, 0.86, 1], r: [x, y * 2, z] });
  blob(0, 0.95, 0, 1.4, C.leaf);
  blob(0.95, 0.5, 0.35, 0.9, C.leafDark);
  blob(-0.9, 0.6, 0.3, 0.95, C.leafDark);
  blob(0.15, 0.55, -0.9, 0.9, C.leafDark);
  blob(0.1, 1.85, 0.1, 0.9, C.leafLight);
  blob(-0.55, 1.35, 0.6, 0.7, C.leafLight);
  // A few fruit for a spot of warm colour.
  const fruit: [number, number, number][] = [
    [0.75, 0.75, 1.02],
    [-0.35, 0.45, 1.16],
    [1.5, 0.6, 0.5],
    [-1.3, 0.85, 0.85],
    [0.35, 1.5, 1.1],
  ];
  fruit.forEach(([x, y, z]) => leaves.add(new IcosahedronGeometry(0.13, 1), C.fruit, { p: [x, y, z] }));
  crown.add(leaves.mesh());
  group.add(crown);

  return {
    group,
    update(time) {
      crown.rotation.z = Math.sin(time * 0.9) * 0.025;
      crown.rotation.x = Math.sin(time * 0.7 + 1.3) * 0.02;
    },
  };
}

import { Group, IcosahedronGeometry } from 'three';
import { Builder, seededRandom } from '../art/builder';
import { PALETTE as C } from '../art/palette';

export interface Clouds {
  group: Group;
  update(dt: number): void;
}

export function createClouds(): Clouds {
  const group = new Group();
  const rnd = seededRandom(21);
  const span = 26;
  const clouds = [0, 1, 2, 3].map((i) => {
    const b = new Builder();
    const lumps = 3 + (i % 2);
    for (let k = 0; k < lumps; k++) {
      const r = 0.7 + rnd() * 0.5;
      b.add(new IcosahedronGeometry(r, 1), C.cloud, {
        p: [(k - (lumps - 1) / 2) * 1.2, rnd() * 0.3, (rnd() - 0.5) * 0.8],
        s: [1.2, 0.6, 1],
      });
    }
    const mesh = b.mesh(undefined, false);
    mesh.position.set(-span / 2 + rnd() * span, 7 + rnd() * 3, -16 + i * 4 - rnd() * 3);
    group.add(mesh);
    return { mesh, speed: 0.15 + rnd() * 0.15 };
  });

  return {
    group,
    update(dt) {
      for (const cloud of clouds) {
        cloud.mesh.position.x += cloud.speed * dt;
        if (cloud.mesh.position.x > span / 2) cloud.mesh.position.x = -span / 2;
      }
    },
  };
}

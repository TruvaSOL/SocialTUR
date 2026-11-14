import { DynamicDrawUsage, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { Builder, flatMaterial, seededRandom } from '../art/builder';
import { PALETTE as C } from '../art/palette';

export interface Clouds {
  mesh: InstancedMesh;
  update(dt: number): void;
}

const COUNT = 9;
const SPAN = 260;

/** A handful of drifting clouds: one shape, drawn as one batch. */
export function createClouds(): Clouds {
  const rnd = seededRandom(21);
  const b = new Builder();
  for (let k = 0; k < 4; k++) {
    const r = 0.7 + rnd() * 0.5;
    b.add(new IcosahedronGeometry(r, 1), C.cloud, { p: [(k - 1.5) * 1.2, rnd() * 0.3, (rnd() - 0.5) * 0.8], s: [1.2, 0.6, 1] });
  }
  const mesh = new InstancedMesh(b.geometry(), flatMaterial, COUNT);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;

  const clouds = Array.from({ length: COUNT }, (_, i) => ({
    position: new Vector3(-SPAN / 2 + rnd() * SPAN, 34 + rnd() * 16, -110 + (i / COUNT) * 220 + rnd() * 12),
    scale: 4 + rnd() * 4,
    speed: 0.6 + rnd() * 0.6,
  }));
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();

  return {
    mesh,
    update(dt) {
      clouds.forEach((cloud, i) => {
        cloud.position.x += cloud.speed * dt;
        if (cloud.position.x > SPAN / 2) cloud.position.x = -SPAN / 2;
        mesh.setMatrixAt(i, m.compose(cloud.position, q, s.setScalar(cloud.scale)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

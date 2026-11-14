import { DynamicDrawUsage, Euler, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { Builder, flatMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { LOTS, TREES, lotToWorld } from './district';
import { HOUSE_STYLES, SMOKE_ORIGIN, buildHouseGeometry } from './house';
import { buildTreeGeometry } from './tree';

export interface Town {
  group: Group;
  update(time: number): void;
}

const PUFFS_PER_HOUSE = 3;

/** Splits the district in four so parts behind the camera are not drawn. */
const quadrant = (x: number, z: number) => (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0);

interface Placed {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

function instanced(geometry: ReturnType<typeof buildTreeGeometry>, items: Placed[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, flatMaterial, items.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  items.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.yaw, 0));
    m.compose(new Vector3(it.x, it.y, it.z), q, new Vector3(it.scale, it.scale, it.scale));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere(); // lets the renderer skip the whole batch when it is off screen
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Houses, trees and chimney smoke: every repeated model is drawn in batches. */
export function createTown(): Town {
  const group = new Group();

  // Houses: one batch per colour scheme and quadrant.
  HOUSE_STYLES.forEach((style, variant) => {
    const geometry = buildHouseGeometry(style);
    for (let quad = 0; quad < 4; quad++) {
      const items = LOTS.filter((l) => l.variant === variant && quadrant(l.x, l.z) === quad).map((l) => ({
        x: l.x,
        y: 0,
        z: l.z,
        yaw: l.yaw,
        scale: 1,
      }));
      if (items.length) group.add(instanced(geometry, items));
    }
  });

  // Trees: one batch per quadrant.
  const treeGeometry = buildTreeGeometry();
  for (let quad = 0; quad < 4; quad++) {
    const items = TREES.filter((t) => quadrant(t.x, t.z) === quad);
    if (items.length) group.add(instanced(treeGeometry, items));
  }

  // Chimney smoke: a few puffs per house, all in one batch. No transparency.
  const puffGeometry = new Builder().add(new IcosahedronGeometry(0.2, 0), C.cloud).geometry();
  const puffs = new InstancedMesh(puffGeometry, flatMaterial, LOTS.length * PUFFS_PER_HOUSE);
  puffs.instanceMatrix.setUsage(DynamicDrawUsage);
  puffs.frustumCulled = false;
  group.add(puffs);
  const origins = LOTS.map((lot) => lotToWorld(lot, SMOKE_ORIGIN.x, SMOKE_ORIGIN.z));
  const array = puffs.instanceMatrix.array;

  return {
    group,
    update(time) {
      let o = 0;
      for (let h = 0; h < origins.length; h++) {
        for (let i = 0; i < PUFFS_PER_HOUSE; i++) {
          const life = (time * 0.22 + i / PUFFS_PER_HOUSE + h * 0.37) % 1;
          const s = Math.sin(life * Math.PI) * (0.7 + life * 0.9);
          // A scale-and-move matrix written directly; the wind drifts the same way for every house.
          array.fill(0, o, o + 16);
          array[o] = s;
          array[o + 5] = s;
          array[o + 10] = s;
          array[o + 12] = origins[h].x + life * 0.7 + Math.sin(life * 6 + i) * 0.08;
          array[o + 13] = SMOKE_ORIGIN.y + life * 1.9;
          array[o + 14] = origins[h].z + life * 0.25;
          array[o + 15] = 1;
          o += 16;
        }
      }
      puffs.instanceMatrix.needsUpdate = true;
    },
  };
}

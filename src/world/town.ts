import {
  BoxGeometry,
  type BufferGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { Builder, flatMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { LOTS, SEA_LEVEL, TREES, type Lot, lotToWorld } from './district';
import { HOUSE_SHAPES, HOUSE_STYLES } from './house';
import { FERRY_BERTH, buildFerry, buildLandmarks } from './landmarks';
import { PROJECTS } from './projects';
import { buildTreeGeometry } from './tree';

export interface Town {
  group: Group;
  /** How many plots there are in total. */
  readonly lotCount: number;
  /** How many houses stand right now. */
  readonly houses: number;
  /** Highest stage any shared building can reach. */
  readonly maxStage: number;
  /** Builds houses on the first `count` plots (the town grows outwards from the plaza). */
  setHouses(count: number): void;
  /** Shows every shared building at the given stage (each stops at its own last stage). */
  setStage(stage: number): void;
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

function instanced(geometry: BufferGeometry, items: Placed[]): InstancedMesh {
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

const placeLot = (l: Lot): Placed => ({ x: l.x, y: 0, z: l.z, yaw: l.yaw, scale: 1 });

/** Marks a plot that has no house yet: four corner stakes and a small "reserved" board. */
function buildPlotMarker(): BufferGeometry {
  const b = new Builder();
  for (const x of [-2.6, 2.6]) {
    for (const z of [-2.2, 3.2]) {
      b.add(new BoxGeometry(0.14, 0.8, 0.14), C.woodDark, { p: [x, 0.4, z] });
      b.add(new BoxGeometry(0.18, 0.12, 0.18), C.clothRed, { p: [x, 0.8, z] });
    }
  }
  b.add(new BoxGeometry(0.1, 1.1, 0.1), C.woodDark, { p: [0, 0.55, 3.0] });
  b.add(new BoxGeometry(0.9, 0.55, 0.08), C.clothCream, { p: [0, 1.05, 3.05] });
  b.add(new BoxGeometry(0.9, 0.12, 0.1), C.clothTeal, { p: [0, 1.27, 3.05] });
  return b.geometry();
}

/**
 * Everything built on the island: houses, plot markers, trees, chimney smoke,
 * the fixed landmarks, the ferry, and the shared building projects.
 * Every repeated model is drawn in batches.
 */
export function createTown(): Town {
  const group = new Group();

  // The town grows outwards: the plots nearest the plaza are built on first.
  const order = [...LOTS].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const rank = new Map(order.map((lot, i) => [lot, i]));

  // Houses: one batch per model and colour scheme, each sorted so the first N are the built ones.
  const houseBatches: { mesh: InstancedMesh; ranks: number[] }[] = [];
  HOUSE_SHAPES.forEach((shape, s) => {
    HOUSE_STYLES.forEach((style, v) => {
      const lots = order.filter((l) => l.shape === s && l.variant === v);
      if (!lots.length) return;
      const mesh = instanced(shape.build(style), lots.map(placeLot));
      houseBatches.push({ mesh, ranks: lots.map((l) => rank.get(l)!) });
      group.add(mesh);
    });
  });

  // Plot markers: stored last-built first, so the first N are the plots still empty.
  const reversed = [...order].reverse();
  const markers = instanced(buildPlotMarker(), reversed.map(placeLot));
  markers.castShadow = false;
  group.add(markers);

  // Trees: one batch per quadrant.
  const treeGeometry = buildTreeGeometry();
  for (let quad = 0; quad < 4; quad++) {
    const items = TREES.filter((t) => quadrant(t.x, t.z) === quad);
    if (items.length) group.add(instanced(treeGeometry, items));
  }

  // Fixed landmarks in one mesh; the ferry separately so it can bob at its berth.
  const landmarks = new Mesh(buildLandmarks(), flatMaterial);
  landmarks.castShadow = true;
  landmarks.receiveShadow = true;
  group.add(landmarks);
  const ferry = new Mesh(buildFerry(), flatMaterial);
  ferry.position.set(FERRY_BERTH.x, SEA_LEVEL, FERRY_BERTH.z);
  ferry.rotation.y = FERRY_BERTH.yaw;
  group.add(ferry);

  // Shared building projects: one mesh each; its geometry is swapped when the stage changes.
  const projects = PROJECTS.map((project) => {
    const mesh = new Mesh(project.build(0), flatMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return { project, mesh, stage: 0 };
  });
  const maxStage = Math.max(...PROJECTS.map((p) => p.lastStage));

  // Chimney smoke: a few puffs per built house, all in one batch. No transparency.
  const puffGeometry = new Builder().add(new IcosahedronGeometry(0.2, 0), C.cloud).geometry();
  const puffs = new InstancedMesh(puffGeometry, flatMaterial, LOTS.length * PUFFS_PER_HOUSE);
  puffs.instanceMatrix.setUsage(DynamicDrawUsage);
  puffs.frustumCulled = false;
  group.add(puffs);
  const smoke = order.map((lot) => {
    const at = HOUSE_SHAPES[lot.shape].smoke;
    return { ...lotToWorld(lot, at.x, at.z), y: at.y };
  });
  const array = puffs.instanceMatrix.array;

  let houses = 0;
  const town: Town = {
    group,
    lotCount: LOTS.length,
    get houses() {
      return houses;
    },
    maxStage,
    setHouses(count) {
      houses = Math.max(0, Math.min(LOTS.length, Math.round(count)));
      for (const batch of houseBatches) batch.mesh.count = batch.ranks.filter((r) => r < houses).length;
      markers.count = LOTS.length - houses;
      puffs.count = houses * PUFFS_PER_HOUSE;
    },
    setStage(stage) {
      for (const entry of projects) {
        const next = Math.max(0, Math.min(entry.project.lastStage, stage));
        if (next === entry.stage) continue;
        entry.stage = next;
        entry.mesh.geometry.dispose();
        entry.mesh.geometry = entry.project.build(next);
      }
    },
    update(time) {
      let o = 0;
      for (let h = 0; h < houses; h++) {
        const at = smoke[h];
        for (let i = 0; i < PUFFS_PER_HOUSE; i++) {
          const life = (time * 0.22 + i / PUFFS_PER_HOUSE + h * 0.37) % 1;
          const s = Math.sin(life * Math.PI) * (0.7 + life * 0.9);
          // A scale-and-move matrix written directly; the wind drifts the same way for every house.
          array.fill(0, o, o + 16);
          array[o] = s;
          array[o + 5] = s;
          array[o + 10] = s;
          array[o + 12] = at.x + life * 0.7 + Math.sin(life * 6 + i) * 0.08;
          array[o + 13] = at.y + life * 1.9;
          array[o + 14] = at.z + life * 0.25;
          array[o + 15] = 1;
          o += 16;
        }
      }
      puffs.instanceMatrix.needsUpdate = true;

      // The ferry rides the swell at its berth.
      ferry.position.y = SEA_LEVEL + Math.sin(time * 1.1) * 0.07;
      ferry.rotation.z = Math.sin(time * 0.8) * 0.02;
      ferry.rotation.x = Math.sin(time * 0.6 + 1) * 0.012;
    },
  };
  town.setHouses(LOTS.length);
  return town;
}

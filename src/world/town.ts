import {
  BoxGeometry,
  type BufferGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { Builder, flatMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { LOTS, PALMS, SEA_LEVEL, TREES, type Lot } from './district';
import { HOUSE_SHAPES, HOUSE_STYLES } from './house';
import { FERRY_BERTH, buildFerry, buildLandmarks } from './landmarks';
import { PROJECTS } from './projects';
import { buildPalmGeometry, buildTreeGeometry } from './tree';

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
 * Everything built on the island: houses, plot markers, trees and palms,
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

  group.add(instanced(buildPalmGeometry(), PALMS));

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
      // The ferry rides the swell at its berth.
      ferry.position.y = SEA_LEVEL + Math.sin(time * 1.1) * 0.07;
      ferry.rotation.z = Math.sin(time * 0.8) * 0.02;
      ferry.rotation.x = Math.sin(time * 0.6 + 1) * 0.012;
    },
  };
  town.setHouses(LOTS.length);
  return town;
}

import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { PLACES, SEA_LEVEL } from './district';
import {
  barrel,
  bench,
  bollard,
  crate,
  dock,
  lamp,
  logPile,
  post,
  ridgeRoofX,
  sailBoat,
  scaffold,
  siteFence,
  siteSign,
  slab,
  stonePile,
} from './kit';

/**
 * A shared building the whole town raises together. Each has a fixed number of stages;
 * stage 0 is the staked-out site, the last stage is the finished building.
 * `build(stage)` returns the complete model for that stage as one geometry.
 */
export interface Project {
  id: 'harbor' | 'townHall' | 'cafe' | 'park';
  /** Highest stage number. */
  lastStage: number;
  build(stage: number): BufferGeometry;
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

/** A simple framed window on a +z wall, centred on the current group. */
function windowOn(b: Builder, w = 1.0, h = 1.1): void {
  b.add(box(w + 0.24, h + 0.24, 0.12), C.wood, { p: [0, 0, 0.02] });
  b.add(box(w, h, 0.1), C.glass, { p: [0, 0, 0.06] });
  b.add(box(0.07, h, 0.06), C.wood, { p: [0, 0, 0.1] });
  b.add(box(w + 0.36, 0.1, 0.22), C.woodDark, { p: [0, -h / 2 - 0.14, 0.08] });
}

/** Timber frame of a building going up: corner posts and top beams around a w x d footprint. */
function frame(b: Builder, w: number, d: number, base: number, height: number): void {
  for (const x of [-w / 2, 0, w / 2]) {
    for (const z of [-d / 2, d / 2]) b.add(box(0.2, height, 0.2), C.wood, { p: [x, base + height / 2, z] });
  }
  for (const z of [-d / 2, d / 2]) b.add(box(w + 0.2, 0.2, 0.2), C.wood, { p: [0, base + height, z] });
  for (const x of [-w / 2, w / 2]) b.add(box(0.2, 0.2, d + 0.2), C.wood, { p: [x, base + height, 0] });
}

// ------------------------------------------------------------------ Harbour
// Local frame: origin at the end of the south road, +z points out to sea.
// Stages: 0 site, 1 quay and piles, 2 pier, 3 warehouse, crane and lighthouse base, 4 finished.

function buildHarbor(stage: number): BufferGeometry {
  const b = new Builder();
  const deckTop = 0.35;
  b.group({ p: [PLACES.harbor.x, 0, PLACES.harbor.z] }, () => {
    if (stage < 4) {
      siteFence(b, -13, 13, -9, 5.4, 6);
      siteSign(b, 5, -9.6, C.clothNavy);
    }
    if (stage < 3) {
      logPile(b, 8.5, -5.5);
      stonePile(b, -10, -6);
      for (let i = 0; i < 4; i++) slab(b, 7, 10, -2.4 + i * 0.02, -1.6, i * 0.12, i * 0.12 + 0.1, i % 2 ? C.wood : C.sand);
    }

    if (stage >= 1) {
      // Quay: a stone wall along the shore with a paved yard behind it.
      slab(b, -13.5, 13.5, 5.6, 7.2, SEA_LEVEL - 1.5, 0.22, C.stone);
      slab(b, -13.7, 13.7, 6.6, 7.4, 0.22, 0.34, C.stoneDark);
      slab(b, -13, 13, -1, 5.6, 0.0, 0.07, C.stone);
      // Piles driven into the sea bed, waiting for their deck.
      if (stage === 1) {
        for (let z = 9; z <= 25; z += 4) for (const x of [-3, 3]) post(b, x, z, SEA_LEVEL - 1.6, 0.6, 0.2, C.trunk);
      }
    }

    if (stage >= 2) {
      dock(b, -3, 3, 7.2, 26, deckTop);
      dock(b, 3, 11, 18, 22, deckTop);
      for (const z of [10, 16, 24]) {
        bollard(b, -2.6, z, deckTop);
        bollard(b, 2.6, z === 16 ? 14 : z, deckTop);
      }
    }

    if (stage >= 3) {
      // Warehouse: a long timber-framed shed with big doors facing the yard.
      b.group({ p: [-8.3, 0.07, 1.4] }, () => {
        slab(b, -4.2, 4.2, -2.9, 2.9, 0, 0.25, C.stoneDark);
        b.add(box(8, 3.2, 5.4), C.wallWarm, { p: [0, 1.85, 0] });
        for (const x of [-4, -1.35, 1.35, 4]) b.add(box(0.18, 3.2, 5.5), C.woodDark, { p: [x, 1.85, 0] });
        b.add(box(8.1, 0.18, 5.5), C.woodDark, { p: [0, 3.45, 0] });
        // Gable ends.
        for (const side of [1, -1]) {
          b.add(new CylinderGeometry(0, 3.1, 1.9, 4), C.wallWarm, { p: [side * 3.96, 4.4, 0], s: [0.03, 1, 1] });
        }
        b.group({ p: [0, 3.45, 0] }, () => ridgeRoofX(b, 8, 5.4, 1.9, C.roofSlate, C.roofSlateDark));
        b.add(box(2.6, 2.5, 0.14), C.wood, { p: [2.66, 1.5, 2.72] });
        b.add(box(0.1, 2.5, 0.18), C.woodDark, { p: [2.66, 1.5, 2.74] });
        b.group({ p: [-2.66, 2.1, 2.7] }, () => windowOn(b, 1.5, 0.9));
        b.group({ p: [0, 2.1, 2.7] }, () => windowOn(b, 1.5, 0.9));
      });
      // Crane: a timber post and arm on the quay, a crate on its hook.
      b.group({ p: [9.2, 0.34, 6.2] }, () => {
        b.add(box(1.6, 0.5, 1.6), C.stoneDark, { p: [0, 0.25, 0] });
        b.add(box(0.36, 5.2, 0.36), C.wood, { p: [0, 3.1, 0] });
        b.add(box(0.28, 0.28, 5.4), C.wood, { p: [0, 5.3, 1.7], r: [-0.22, 0, 0] });
        b.add(box(0.2, 0.2, 2.6), C.woodDark, { p: [0, 4.2, 0.9], r: [-0.95, 0, 0] });
        b.add(box(0.05, 2.6, 0.05), C.shoe, { p: [0, 4.55, 4.1] });
        crate(b, 0, 4.1, 0.8, 2.45, 0.4);
      });
      crate(b, 5.2, 0.6, 0.9, 0.07, 0.2);
      crate(b, 6.2, 0.9, 0.9, 0.07, -0.3);
      crate(b, 5.7, 0.8, 0.8, 0.97, 0.5);
      barrel(b, 4.4, 3.4, 0.07);
      barrel(b, 5.2, 3.7, 0.07);
      barrel(b, 11.4, 2.6, 0.07);

      // Lighthouse rock at the end of the side dock.
      b.group({ p: [13.6, 0, 20] }, () => {
        for (const [x, z, s] of [[0, 0, 3.4], [2.2, 1.4, 1.9], [-1.6, -2.1, 2.1], [1.2, -2.4, 1.6], [-2.4, 1.6, 1.5]]) {
          b.add(new IcosahedronGeometry(s, 0), s > 2 ? C.stone : C.stoneDark, { p: [x, SEA_LEVEL - 0.2, z], s: [1, 0.5, 1], r: [0, x + z, 0] });
        }
        b.add(new CylinderGeometry(2.0, 2.3, 1.2, 12), C.stoneDark, { p: [0, 0.9, 0] });
        const bottom = 1.5;
        const rings = stage === 3 ? 2 : 4;
        for (let i = 0; i < rings; i++) {
          const r0 = 1.6 - i * 0.16;
          b.add(new CylinderGeometry(r0 - 0.16, r0, 1.8, 12), i % 2 ? C.fruit : C.cloud, { p: [0, bottom + 0.9 + i * 1.8, 0] });
        }
        if (stage === 3) {
          // Half built: poles and planks around the tower.
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            post(b, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1.2, 6.2, 0.06, C.wood, 5);
          }
          b.add(new CylinderGeometry(2.35, 2.35, 0.08, 12, 1, true), C.sand, { p: [0, 3.3, 0] });
          b.add(new CylinderGeometry(2.35, 2.35, 0.08, 12, 1, true), C.sand, { p: [0, 5.1, 0] });
        } else {
          const top = bottom + 4 * 1.8;
          b.add(new CylinderGeometry(1.45, 1.2, 0.22, 12), C.stoneDark, { p: [0, top + 0.11, 0] });
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            post(b, Math.cos(a) * 1.35, Math.sin(a) * 1.35, top + 0.2, top + 0.75, 0.04, C.shoe, 4);
          }
          b.add(new CylinderGeometry(0.8, 0.8, 1.1, 10), C.glass, { p: [0, top + 0.77, 0] });
          b.add(new IcosahedronGeometry(0.42, 0), C.brass, { p: [0, top + 0.8, 0] });
          b.add(new ConeGeometry(1.05, 0.95, 10), C.roofDark, { p: [0, top + 1.8, 0] });
          b.add(new IcosahedronGeometry(0.14, 0), C.brass, { p: [0, top + 2.35, 0] });
          b.add(box(0.5, 1.0, 0.1), C.door, { p: [-1.62, 2.0, 0], r: [0, Math.PI / 2, 0] });
        }
      });
    }

    if (stage >= 4) {
      // Opening day: a gateway with bunting, lamps along the pier, boats at the dock.
      for (const x of [-3.4, 3.4]) b.add(box(0.24, 3.6, 0.24), C.wood, { p: [x, 1.8, -8.6] });
      b.add(box(7.4, 0.3, 0.3), C.woodDark, { p: [0, 3.6, -8.6] });
      b.add(box(3.0, 0.8, 0.14), C.clothCream, { p: [0, 3.05, -8.6] });
      b.add(box(3.0, 0.16, 0.16), C.clothNavy, { p: [0, 3.4, -8.62] });
      const flags = [C.clothRed, C.clothMustard, C.clothTeal, C.flowerPink, C.clothNavy];
      for (let i = 0; i < 9; i++) {
        const x = -2.8 + i * 0.7;
        if (Math.abs(x) < 1.6) continue;
        b.add(new ConeGeometry(0.2, 0.45, 3), flags[i % flags.length], { p: [x, 3.1, -8.6], r: [Math.PI, 0, 0], s: [1, 1, 0.2] });
      }
      for (const z of [8.5, 14, 19.5, 25]) lamp(b, -2.7, z, deckTop);
      lamp(b, -12, 4.6, 0.07);
      lamp(b, 12, 4.6, 0.07);
      sailBoat(b, -5.4, 13, C.clothRed, Math.PI);
      sailBoat(b, -5.4, 20, C.cloud, 0);
      sailBoat(b, 6.6, 14, C.clothTeal, Math.PI / 2);
      bench(b, -1.2, 24.5, deckTop, Math.PI);
    }
  });
  return b.geometry();
}

// ------------------------------------------------------------------ Town hall
// Local frame: front faces +z (towards the plaza). Footprint about 7 x 5.
// Stages: 0 site, 1 foundation and frame, 2 walls and scaffolding, 3 finished with clock tower.

function buildTownHall(stage: number): BufferGeometry {
  const b = new Builder();
  const W = 7;
  const D = 4.6;
  const BASE = 0.4;
  const WALL = 3.5;
  b.group({ p: [PLACES.townHall.x, 0, PLACES.townHall.z], r: [0, Math.PI / 4, 0] }, () => {
    if (stage === 0) {
      siteFence(b, -3.8, 3.8, -2.6, 2.6, 2.4);
      siteSign(b, 2.6, 3.4, C.roofSlate);
      stonePile(b, -2.4, -1.2);
      logPile(b, 1.4, -0.8, 2.4);
      return;
    }
    slab(b, -W / 2 - 0.3, W / 2 + 0.3, -D / 2 - 0.3, D / 2 + 0.3, 0, BASE, C.stone);
    slab(b, -1.6, 1.6, D / 2 + 0.3, D / 2 + 1.1, 0, BASE * 0.5, C.stoneDark);
    if (stage === 1) {
      frame(b, W, D, BASE, WALL);
      stonePile(b, -5.6, 0.4);
      return;
    }
    // Walls, door and windows.
    b.add(box(W, WALL, D), C.wall, { p: [0, BASE + WALL / 2, 0] });
    b.add(box(W + 0.08, 0.2, D + 0.08), C.woodDark, { p: [0, BASE + WALL, 0] });
    const front = D / 2;
    b.add(box(1.7, 2.4, 0.14), C.woodDark, { p: [0, BASE + 1.2, front + 0.02] });
    b.add(box(1.4, 2.2, 0.12), C.door, { p: [0, BASE + 1.1, front + 0.07] });
    b.add(box(0.06, 2.2, 0.14), C.woodDark, { p: [0, BASE + 1.1, front + 0.09] });
    for (const x of [-2.35, 2.35]) b.group({ p: [x, BASE + 1.75, front] }, () => windowOn(b, 1.0, 1.5));
    for (const side of [1, -1]) {
      b.group({ p: [(side * W) / 2, BASE + 1.75, 0], r: [0, (side * Math.PI) / 2, 0] }, () => windowOn(b, 1.0, 1.5));
    }
    if (stage === 2) {
      scaffold(b, -W / 2, W / 2, front + 0.25, WALL + 0.8);
      // The tower has only begun.
      b.add(box(2.3, 1.2, 2.3), C.wall, { p: [0, BASE + WALL + 0.6, 0.6] });
      return;
    }
    // Finished: roof, clock tower over the entrance, columns, flag.
    b.group({ p: [0, BASE + WALL, 0] }, () => ridgeRoofX(b, W, D, 1.7, C.roofSlate, C.roofSlateDark));
    for (const side of [1, -1]) {
      b.add(new CylinderGeometry(0, D / 2 + 0.38, 1.7, 4), C.wall, { p: [side * (W / 2 - 0.02), BASE + WALL + 0.85, 0], s: [0.03, 1, 1] });
    }
    for (const x of [-1.25, 1.25]) {
      b.add(new CylinderGeometry(0.2, 0.22, 2.7, 8), C.cloud, { p: [x, BASE * 0.5 + 1.35, front + 0.8] });
      b.add(box(0.56, 0.14, 0.56), C.stone, { p: [x, BASE * 0.5 + 2.75, front + 0.8] });
    }
    b.add(box(3.4, 0.3, 1.3), C.stone, { p: [0, BASE * 0.5 + 2.95, front + 0.5] });
    const towerBase = BASE + WALL;
    b.add(box(2.3, 4.2, 2.3), C.wall, { p: [0, towerBase + 2.1, 0.6] });
    b.add(box(2.5, 0.2, 2.5), C.woodDark, { p: [0, towerBase + 2.3, 0.6] });
    b.add(box(2.6, 0.24, 2.6), C.woodDark, { p: [0, towerBase + 4.2, 0.6] });
    // Clock faces on the front and both sides.
    for (const [yaw, dx, dz] of [[0, 0, 1.16], [Math.PI / 2, 1.16, 0], [-Math.PI / 2, -1.16, 0]]) {
      b.group({ p: [dx, towerBase + 3.25, 0.6 + dz], r: [0, yaw, 0] }, () => {
        b.add(new CylinderGeometry(0.78, 0.78, 0.1, 14), C.woodDark, { r: [Math.PI / 2, 0, 0] });
        b.add(new CylinderGeometry(0.66, 0.66, 0.12, 14), C.cloud, { p: [0, 0, 0.02], r: [Math.PI / 2, 0, 0] });
        b.add(box(0.07, 0.5, 0.04), C.ink, { p: [0, 0.22, 0.09] });
        b.add(box(0.36, 0.07, 0.04), C.ink, { p: [0.16, 0, 0.09] });
      });
    }
    b.add(new ConeGeometry(1.95, 2.2, 4), C.roofSlate, { p: [0, towerBase + 5.4, 0.6], r: [0, Math.PI / 4, 0] });
    post(b, 0, 0.6, towerBase + 6.3, towerBase + 8.1, 0.04, C.shoe, 4);
    b.add(box(0.9, 0.5, 0.04), C.clothRed, { p: [0.47, towerBase + 7.8, 0.6] });
    lamp(b, -2.6, front + 1.5);
    lamp(b, 2.6, front + 1.5);
    for (const x of [-2.35, 2.35]) {
      b.add(box(1.5, 0.3, 0.5), C.wood, { p: [x, BASE + 0.1, front + 0.45] });
      for (let i = 0; i < 4; i++) {
        b.add(new IcosahedronGeometry(0.2, 0), i % 2 ? C.flowerPink : C.flowerYellow, { p: [x - 0.5 + i * 0.34, BASE + 0.38, front + 0.45] });
      }
    }
  });
  return b.geometry();
}

// ------------------------------------------------------------------ Cafe
// Local frame: front faces +z (towards the plaza). Footprint about 6 x 4.2 plus a terrace.
// Stages: 0 site, 1 foundation and frame, 2 walls and scaffolding, 3 finished with terrace.

function buildCafe(stage: number): BufferGeometry {
  const b = new Builder();
  const W = 6;
  const D = 4.2;
  const BASE = 0.25;
  const WALL = 2.8;
  b.group({ p: [PLACES.cafe.x, 0, PLACES.cafe.z], r: [0, (5 * Math.PI) / 4, 0] }, () => {
    if (stage === 0) {
      siteFence(b, -3.4, 3.4, -2.4, 2.4, 2.4);
      siteSign(b, -2.4, 3.2, C.roof);
      stonePile(b, 1.0, -1.2);
      logPile(b, -1.4, 0.2, 2.2);
      return;
    }
    slab(b, -W / 2 - 0.25, W / 2 + 0.25, -D / 2 - 0.25, D / 2 + 0.25, 0, BASE, C.stone);
    if (stage === 1) {
      frame(b, W, D, BASE, WALL);
      logPile(b, 4.6, 0, 2.2);
      return;
    }
    const front = D / 2;
    b.add(box(W, WALL, D), C.wallWarm, { p: [0, BASE + WALL / 2, 0] });
    b.add(box(W + 0.08, 0.18, D + 0.08), C.woodDark, { p: [0, BASE + WALL, 0] });
    // Shop front: door on the left, one wide window.
    b.add(box(1.2, 2.1, 0.14), C.woodDark, { p: [-1.9, BASE + 1.05, front + 0.02] });
    b.add(box(0.95, 1.9, 0.12), C.clothRed, { p: [-1.9, BASE + 0.95, front + 0.07] });
    b.add(box(0.5, 0.6, 0.06), C.glass, { p: [-1.9, BASE + 1.4, front + 0.12] });
    b.group({ p: [0.9, BASE + 1.45, front] }, () => windowOn(b, 2.8, 1.5));
    for (const side of [1, -1]) {
      b.group({ p: [(side * W) / 2, BASE + 1.5, 0], r: [0, (side * Math.PI) / 2, 0] }, () => windowOn(b, 1.2, 1.2));
    }
    if (stage === 2) {
      scaffold(b, -W / 2, W / 2, front + 0.25, WALL + 0.6);
      return;
    }
    b.group({ p: [0, BASE + WALL, 0] }, () => ridgeRoofX(b, W, D, 1.5, C.roof, C.roofDark));
    for (const side of [1, -1]) {
      b.add(new CylinderGeometry(0, D / 2 + 0.38, 1.5, 4), C.wallWarm, { p: [side * (W / 2 - 0.02), BASE + WALL + 0.75, 0], s: [0.03, 1, 1] });
    }
    b.add(box(0.6, 1.5, 0.6), C.stone, { p: [1.9, BASE + WALL + 1.3, -0.6] });
    // Striped awning across the front.
    for (let i = 0; i < 10; i++) {
      b.add(box(0.6, 0.08, 1.3), i % 2 ? C.cloud : C.clothRed, { p: [-2.7 + i * 0.6, BASE + 2.45, front + 0.6], r: [0.3, 0, 0] });
    }
    // Hanging sign: a round board with a cup on it.
    b.add(box(0.08, 0.08, 0.9), C.shoe, { p: [-2.95, BASE + 3.0, front + 0.45] });
    b.add(new CylinderGeometry(0.42, 0.42, 0.08, 10), C.clothCream, { p: [-2.95, BASE + 2.45, front + 0.8], r: [0, 0, Math.PI / 2] });
    b.add(new CylinderGeometry(0.16, 0.12, 0.2, 6), C.clothRed, { p: [-2.95, BASE + 2.42, front + 0.8], s: [1.4, 1, 1] });
    // Terrace: paved floor, three tables with stools, two parasols, planters.
    slab(b, -3.4, 3.4, front + 0.25, front + 3.3, 0, 0.1, C.stone);
    const tables: [number, number, number | null][] = [[-2.0, 1.9, C.clothMustard], [0.3, 2.3, null], [2.4, 1.8, C.clothTeal]];
    for (const [x, dz, parasol] of tables) {
      const z = front + dz;
      post(b, x, z, 0.1, 0.78, 0.05, C.shoe, 5);
      b.add(new CylinderGeometry(0.5, 0.5, 0.07, 10), C.clothCream, { p: [x, 0.82, z] });
      for (const sx of [-0.8, 0.8]) {
        post(b, x + sx, z + 0.1, 0.1, 0.45, 0.04, C.shoe, 4);
        b.add(new CylinderGeometry(0.2, 0.2, 0.07, 8), C.wood, { p: [x + sx, 0.48, z + 0.1] });
      }
      if (parasol !== null) {
        post(b, x, z, 0.8, 2.5, 0.035, C.woodDark, 4);
        b.add(new ConeGeometry(1.15, 0.55, 8), parasol, { p: [x, 2.6, z] });
      }
    }
    for (const x of [-3.2, 3.2]) {
      b.add(box(0.5, 0.45, 0.5), C.wood, { p: [x, 0.32, front + 3.0] });
      b.add(new IcosahedronGeometry(0.36, 1), C.leaf, { p: [x, 0.8, front + 3.0] });
    }
    // Chalkboard by the door.
    b.add(box(0.6, 0.9, 0.06), C.shoe, { p: [-3.0, 0.55, front + 0.9], r: [-0.25, 0.3, 0] });
  });
  return b.geometry();
}

// ------------------------------------------------------------------ Park
// Fills one block. Stages: 0 staked meadow, 1 paths and saplings, 2 pond, trees and benches, 3 gazebo and playground.

function buildPark(stage: number): BufferGeometry {
  const b = new Builder();
  const H = 8.6; // half the block that the park may use
  const youngTree = (x: number, z: number, size: number) => {
    post(b, x, z, 0, 1.0 * size, 0.09 * size, C.trunk, 5);
    b.add(new IcosahedronGeometry(0.85 * size, 1), size > 1.2 ? C.leaf : C.leafLight, { p: [x, 1.55 * size, z], s: [1, 0.9, 1] });
  };
  b.group({ p: [PLACES.park.x, 0, PLACES.park.z] }, () => {
    if (stage === 0) {
      siteFence(b, -H, H, -H, H, 4);
      siteSign(b, 3.4, -H - 0.6, C.leaf);
      return;
    }
    // Paths: a cross and a round middle.
    slab(b, -H, H, -0.8, 0.8, 0, 0.045, C.sand);
    slab(b, -0.8, 0.8, -H, H, 0, 0.045, C.sand);
    b.add(new CylinderGeometry(3.0, 3.0, 0.05, 16), C.sand, { p: [0, 0.03, 0] });
    const corners: [number, number][] = [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]];
    if (stage === 1) {
      corners.forEach(([x, z]) => youngTree(x, z, 0.75));
      youngTree(-6.5, 2, 0.6);
      youngTree(6.4, -2.2, 0.6);
      bench(b, -2.2, -2.2, 0.05, Math.PI / 4);
      siteSign(b, 3.4, -H - 0.6, C.leaf);
      return;
    }
    // Grown trees, flower beds, benches around the middle.
    youngTree(-5.6, -5.4, 1.5);
    youngTree(5.4, -5.8, 1.35);
    youngTree(-6.2, 2.4, 1.2);
    youngTree(-3.2, 6.2, 1.4);
    youngTree(6.6, -2.2, 1.1);
    youngTree(2.6, -6.6, 1.0);
    for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      bench(b, Math.sin(angle) * 3.7, Math.cos(angle) * 3.7, 0.05, angle + Math.PI);
    }
    const petals = [C.flowerPink, C.flowerYellow, C.cloud, C.fruit];
    for (const [bx, bz] of [[-2.6, -5.4], [2.4, 2.6], [-6.4, -1.8]] as [number, number][]) {
      b.add(new CylinderGeometry(1.1, 1.2, 0.16, 10), C.earthDark, { p: [bx, 0.08, bz] });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.65;
        b.add(new IcosahedronGeometry(0.2, 0), petals[i % petals.length], { p: [bx + Math.cos(a) * r, 0.3, bz + Math.sin(a) * r] });
      }
    }
    // Pond with a stone rim, a couple of lily pads.
    b.group({ p: [5.0, 0, 5.0] }, () => {
      b.add(new CylinderGeometry(2.7, 2.7, 0.12, 14), C.stone, { p: [0, 0.06, 0], s: [1, 1, 0.8] });
      b.add(new CylinderGeometry(2.35, 2.35, 0.1, 14), C.seaShallow, { p: [0, 0.09, 0], s: [1, 1, 0.8] });
      b.add(new CylinderGeometry(0.3, 0.3, 0.03, 7), C.leaf, { p: [-0.8, 0.15, 0.4] });
      b.add(new CylinderGeometry(0.24, 0.24, 0.03, 7), C.leafLight, { p: [0.7, 0.15, -0.5] });
      b.add(new IcosahedronGeometry(0.1, 0), C.flowerPink, { p: [-0.8, 0.2, 0.4] });
    });
    if (stage === 2) return;
    // Gazebo in the middle.
    b.add(new CylinderGeometry(2.3, 2.4, 0.3, 8), C.stone, { p: [0, 0.15, 0] });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      b.add(box(0.14, 2.5, 0.14), C.cloud, { p: [Math.cos(a) * 2.0, 1.55, Math.sin(a) * 2.0] });
    }
    b.add(new CylinderGeometry(2.3, 2.3, 0.16, 8, 1, true), C.cloud, { p: [0, 2.8, 0] });
    b.add(new ConeGeometry(2.7, 1.5, 8), C.roofTeal, { p: [0, 3.6, 0] });
    b.add(new IcosahedronGeometry(0.18, 0), C.brass, { p: [0, 4.45, 0] });
    // Playground: a swing and a seesaw.
    b.group({ p: [-5.2, 0, 5.4] }, () => {
      for (const x of [-1.3, 1.3]) {
        b.add(box(0.12, 2.5, 0.12), C.clothRed, { p: [x, 1.2, 0.45], r: [0.36, 0, 0] });
        b.add(box(0.12, 2.5, 0.12), C.clothRed, { p: [x, 1.2, -0.45], r: [-0.36, 0, 0] });
      }
      b.add(box(2.9, 0.12, 0.12), C.clothRed, { p: [0, 2.36, 0] });
      for (const x of [-0.55, 0.55]) {
        b.add(box(0.03, 1.7, 0.03), C.shoe, { p: [x - 0.2, 1.5, 0] });
        b.add(box(0.03, 1.7, 0.03), C.shoe, { p: [x + 0.2, 1.5, 0] });
        b.add(box(0.5, 0.06, 0.22), C.wood, { p: [x, 0.65, 0] });
      }
    });
    b.group({ p: [-5.6, 0, -1.6], r: [0, 0.5, 0] }, () => {
      b.add(box(0.3, 0.5, 0.5), C.clothMustard, { p: [0, 0.25, 0] });
      b.add(box(3.0, 0.08, 0.3), C.clothTeal, { p: [0, 0.56, 0], r: [0, 0, 0.16] });
    });
    for (const [x, z] of corners) lamp(b, x * 1.45, z * 1.45);
  });
  return b.geometry();
}

export const PROJECTS: Project[] = [
  { id: 'harbor', lastStage: 4, build: buildHarbor },
  { id: 'townHall', lastStage: 3, build: buildTownHall },
  { id: 'cafe', lastStage: 3, build: buildCafe },
  { id: 'park', lastStage: 3, build: buildPark },
];

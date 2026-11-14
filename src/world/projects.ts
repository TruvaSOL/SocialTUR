import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { PLACES, SEA_LEVEL } from './district';
import {
  bench,
  bollard,
  container,
  dock,
  lamp,
  logPile,
  post,
  sailBoat,
  scaffold,
  siteFence,
  siteSign,
  slab,
  stonePile,
  yacht,
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

/** A flat roof: a rim in the wall colour and a floor inside it, on top of a w x d block at height y. */
function flatRoof(b: Builder, w: number, d: number, y: number, wall: number, floor: number): void {
  const p = 0.34;
  b.add(box(w + 0.12, p, 0.18), wall, { p: [0, y + p / 2, d / 2 - 0.03] });
  b.add(box(w + 0.12, p, 0.18), wall, { p: [0, y + p / 2, -d / 2 + 0.03] });
  b.add(box(0.18, p, d + 0.12), wall, { p: [w / 2 - 0.03, y + p / 2, 0] });
  b.add(box(0.18, p, d + 0.12), wall, { p: [-w / 2 + 0.03, y + p / 2, 0] });
  b.add(box(w - 0.2, 0.06, d - 0.2), floor, { p: [0, y + 0.03, 0] });
}

/** A simple framed window on a +z wall, centred on the current group. */
function windowOn(b: Builder, w = 1.0, h = 1.1): void {
  b.add(box(w + 0.16, h + 0.16, 0.1), C.metalDark, { p: [0, 0, 0.02] });
  b.add(box(w, h, 0.1), C.glass, { p: [0, 0, 0.06] });
  b.add(box(0.06, h, 0.06), C.metalDark, { p: [0, 0, 0.1] });
  b.add(box(w + 0.3, 0.08, 0.2), C.white, { p: [0, -h / 2 - 0.12, 0.08] });
}

/** Concrete frame of a building going up: columns and top beams around a w x d footprint. */
function frame(b: Builder, w: number, d: number, base: number, height: number): void {
  for (const x of [-w / 2, 0, w / 2]) {
    for (const z of [-d / 2, d / 2]) b.add(box(0.28, height, 0.28), C.concrete, { p: [x, base + height / 2, z] });
  }
  for (const z of [-d / 2, d / 2]) b.add(box(w + 0.28, 0.28, 0.28), C.concreteDark, { p: [0, base + height, z] });
  for (const x of [-w / 2, w / 2]) b.add(box(0.28, 0.28, d + 0.28), C.concreteDark, { p: [x, base + height, 0] });
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
      siteSign(b, 5, -9.6, C.aegean);
    }
    if (stage < 3) {
      // Materials the town has brought so far: timber, cut stone, steel beams.
      logPile(b, 8.5, -5.5);
      stonePile(b, -10, -6);
      for (let i = 0; i < 4; i++) slab(b, 7, 10.5, -2.3 + (i % 2) * 0.25, -2.05 + (i % 2) * 0.25, i * 0.13, i * 0.13 + 0.12, C.metal);
    }

    if (stage >= 1) {
      // Quay: a concrete wall along the shore with a paved yard behind it and a yellow safety line.
      slab(b, -13.5, 13.5, 5.6, 7.2, SEA_LEVEL - 1.5, 0.22, C.concrete);
      slab(b, -13.5, 13.5, 6.75, 7.0, 0.22, 0.235, C.craneYellow);
      slab(b, -13, 13, -1, 5.6, 0.0, 0.07, C.paving);
      // Pillars standing in the sea, waiting for their deck.
      if (stage === 1) {
        for (let z = 9; z <= 25; z += 4) {
          for (const x of [-2.5, 2.5]) {
            b.add(box(0.5, 2.6, 0.5), C.concreteDark, { p: [x, SEA_LEVEL - 0.3, z] });
            for (const d of [-0.12, 0.12]) post(b, x + d, z + d, SEA_LEVEL + 1.0, SEA_LEVEL + 1.6, 0.025, C.metalDark, 4);
          }
        }
      }
    }

    if (stage >= 2) {
      dock(b, -3, 3, 7.2, 26, deckTop);
      dock(b, 3, 11, 18, 22, deckTop);
      for (const x of [-2.75, 2.75]) slab(b, x - 0.08, x + 0.08, 7.4, 25.8, deckTop, deckTop + 0.012, C.craneYellow);
      for (const z of [10, 16, 24]) {
        bollard(b, -2.4, z, deckTop);
        bollard(b, 2.4, z === 16 ? 14 : z, deckTop);
      }
    }

    if (stage >= 3) {
      // Harbour office: a white flat-roofed block with a glass front, a blue band and a lookout on the roof.
      b.group({ p: [-8.3, 0.07, 1.4] }, () => {
        slab(b, -4.3, 4.3, -3.0, 3.0, 0, 0.18, C.concrete);
        b.add(box(8, 3.3, 5.4), C.white, { p: [0, 1.83, 0] });
        flatRoof(b, 8, 5.4, 3.48, C.white, C.tile);
        b.add(box(8.06, 0.34, 5.46), C.aegean, { p: [0, 3.05, 0] });
        b.add(box(3.4, 2.2, 0.1), C.metalDark, { p: [1.9, 1.35, 2.7] });
        b.add(box(3.2, 2.0, 0.1), C.glass, { p: [1.9, 1.35, 2.73] });
        b.add(box(0.07, 2.0, 0.12), C.metalDark, { p: [1.9, 1.35, 2.75] });
        b.add(box(4.0, 0.1, 1.2), C.white, { p: [1.9, 2.55, 3.2] });
        for (const x of [0.1, 3.7]) post(b, x, 3.7, 0.18, 2.5, 0.05, C.metal, 5);
        b.group({ p: [-2.4, 1.7, 2.7] }, () => windowOn(b, 1.6, 1.0));
        for (const z of [-1.4, 1.2]) b.group({ p: [4, 1.7, z], r: [0, Math.PI / 2, 0] }, () => windowOn(b, 1.2, 1.0));
        // Lookout: a small glazed room on one corner of the roof, with a mast.
        b.add(box(2.2, 0.5, 2.2), C.white, { p: [-2.6, 3.9, -1.2] });
        b.add(box(2.1, 0.8, 2.1), C.glass, { p: [-2.6, 4.55, -1.2] });
        b.add(box(2.5, 0.14, 2.5), C.white, { p: [-2.6, 5.02, -1.2] });
        post(b, -2.6, -1.2, 5.1, 7.0, 0.03, C.metalDark, 4);
        b.add(box(0.5, 0.3, 0.03), C.coral, { p: [-2.33, 6.8, -1.2] });
      });
      // Crane: yellow steel, a cab half way up, a container on the hook.
      b.group({ p: [9.2, 0.22, 6.0] }, () => {
        for (const x of [-0.9, 0.9]) {
          b.add(box(0.35, 2.0, 0.35), C.craneYellow, { p: [x, 1.0, -0.8] });
          b.add(box(0.35, 2.0, 0.35), C.craneYellow, { p: [x, 1.0, 0.8] });
        }
        b.add(box(2.4, 0.3, 2.2), C.craneYellow, { p: [0, 2.1, 0] });
        b.add(box(0.5, 4.6, 0.5), C.craneYellow, { p: [0, 4.5, 0] });
        b.add(box(1.1, 1.0, 1.1), C.metalDark, { p: [0, 3.2, 0.2] });
        b.add(box(0.9, 0.5, 0.06), C.glass, { p: [0, 3.35, 0.78] });
        b.add(box(0.36, 0.36, 7.4), C.craneYellow, { p: [0, 6.9, 2.2], r: [-0.18, 0, 0] });
        b.add(box(0.2, 0.2, 2.6), C.craneYellow, { p: [0, 6.2, -1.6], r: [0.5, 0, 0] });
        b.add(box(0.9, 0.8, 0.9), C.concreteDark, { p: [0, 5.6, -2.6] });
        b.add(box(0.04, 3.4, 0.04), C.metalDark, { p: [0, 5.75, 5.0] });
        container(b, 0, 5.0, C.coral, 2.5, Math.PI / 2);
      });
      container(b, 5.0, 1.2, C.aegean, 0.07, 0);
      container(b, 6.8, 1.2, C.clothTeal, 0.07, 0);
      container(b, 5.9, 1.2, C.craneYellow, 1.57, 0);
      container(b, 11.2, 0.6, C.coral, 0.07, 0.1);

      // Lighthouse rock at the end of the side dock.
      b.group({ p: [13.6, 0, 20] }, () => {
        for (const [x, z, s] of [[0, 0, 3.4], [2.2, 1.4, 1.9], [-1.6, -2.1, 2.1], [1.2, -2.4, 1.6], [-2.4, 1.6, 1.5]]) {
          b.add(new IcosahedronGeometry(s, 0), s > 2 ? C.stone : C.stoneDark, { p: [x, SEA_LEVEL - 0.2, z], s: [1, 0.5, 1], r: [0, x + z, 0] });
        }
        b.add(new CylinderGeometry(2.0, 2.3, 1.2, 12), C.concrete, { p: [0, 0.9, 0] });
        const bottom = 1.5;
        const rings = stage === 3 ? 2 : 4;
        for (let i = 0; i < rings; i++) {
          const r0 = 1.6 - i * 0.16;
          b.add(new CylinderGeometry(r0 - 0.16, r0, 1.8, 12), i % 2 ? C.coral : C.white, { p: [0, bottom + 0.9 + i * 1.8, 0] });
        }
        if (stage === 3) {
          // Half built: steel poles and boards around the tower.
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            post(b, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1.2, 6.2, 0.05, C.metal, 5);
          }
          b.add(new CylinderGeometry(2.35, 2.35, 0.08, 12, 1, true), C.metalDark, { p: [0, 3.3, 0] });
          b.add(new CylinderGeometry(2.35, 2.35, 0.08, 12, 1, true), C.metalDark, { p: [0, 5.1, 0] });
        } else {
          const top = bottom + 4 * 1.8;
          b.add(new CylinderGeometry(1.45, 1.2, 0.22, 12), C.concreteDark, { p: [0, top + 0.11, 0] });
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            post(b, Math.cos(a) * 1.35, Math.sin(a) * 1.35, top + 0.2, top + 0.75, 0.04, C.metalDark, 4);
          }
          b.add(new CylinderGeometry(0.8, 0.8, 1.1, 10), C.glass, { p: [0, top + 0.77, 0] });
          b.add(new IcosahedronGeometry(0.42, 0), C.brass, { p: [0, top + 0.8, 0] });
          b.add(new ConeGeometry(1.05, 0.95, 10), C.coral, { p: [0, top + 1.8, 0] });
          b.add(new IcosahedronGeometry(0.14, 0), C.brass, { p: [0, top + 2.35, 0] });
          b.add(box(0.5, 1.0, 0.1), C.aegean, { p: [-1.62, 2.0, 0], r: [0, Math.PI / 2, 0] });
        }
      });

      // Marina: two floating pontoons off the west side of the pier.
      for (const z of [11.5, 19]) slab(b, -10, -3, z, z + 1.1, SEA_LEVEL + 0.02, SEA_LEVEL + 0.3, C.white);
    }

    if (stage >= 4) {
      // Opening day: a gateway with bunting, lights along the pier, yachts in the marina.
      for (const x of [-3.4, 3.4]) b.add(box(0.5, 3.8, 0.5), C.white, { p: [x, 1.9, -8.6] });
      b.add(box(7.6, 0.4, 0.6), C.aegean, { p: [0, 3.9, -8.6] });
      const flags = [C.coral, C.craneYellow, C.clothTeal, C.flowerPink, C.aegean];
      for (let i = 0; i < 9; i++) {
        b.add(new ConeGeometry(0.2, 0.45, 3), flags[i % flags.length], { p: [-2.6 + i * 0.65, 3.45, -8.6], r: [Math.PI, 0, 0], s: [1, 1, 0.2] });
      }
      for (const z of [8.5, 14, 19.5, 25]) lamp(b, 2.6, z, deckTop);
      lamp(b, -12, 4.6, 0.07);
      lamp(b, 12, 4.6, 0.07);
      yacht(b, -6.6, 10.2, C.aegean, Math.PI / 2);
      yacht(b, -6.6, 13.9, C.coral, Math.PI / 2, 1.15);
      yacht(b, -6.6, 17.7, C.clothTeal, -Math.PI / 2);
      yacht(b, -6.6, 21.4, C.clothNavy, Math.PI / 2, 0.9);
      sailBoat(b, 6.6, 13.5, C.white, Math.PI / 2);
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
      siteSign(b, 2.6, 3.4, C.aegean);
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
    b.add(box(W, WALL, D), C.white, { p: [0, BASE + WALL / 2, 0] });
    b.add(box(W + 0.08, 0.3, D + 0.08), C.aegean, { p: [0, BASE + WALL - 0.3, 0] });
    const front = D / 2;
    b.add(box(1.7, 2.4, 0.14), C.metalDark, { p: [0, BASE + 1.2, front + 0.02] });
    b.add(box(1.4, 2.2, 0.12), C.glass, { p: [0, BASE + 1.1, front + 0.07] });
    b.add(box(0.06, 2.2, 0.14), C.metalDark, { p: [0, BASE + 1.1, front + 0.09] });
    for (const x of [-2.35, 2.35]) b.group({ p: [x, BASE + 1.75, front] }, () => windowOn(b, 1.0, 1.5));
    for (const side of [1, -1]) {
      b.group({ p: [(side * W) / 2, BASE + 1.75, 0], r: [0, (side * Math.PI) / 2, 0] }, () => windowOn(b, 1.0, 1.5));
    }
    if (stage === 2) {
      scaffold(b, -W / 2, W / 2, front + 0.25, WALL + 0.8);
      // The tower has only begun.
      b.add(box(2.3, 1.2, 2.3), C.white, { p: [0, BASE + WALL + 0.6, 0.6] });
      return;
    }
    // Finished: roof, clock tower over the entrance, columns, flag.
    flatRoof(b, W, D, BASE + WALL, C.white, C.terracotta);
    for (const x of [-1.25, 1.25]) {
      b.add(new CylinderGeometry(0.2, 0.22, 2.7, 8), C.cloud, { p: [x, BASE * 0.5 + 1.35, front + 0.8] });
      b.add(box(0.56, 0.14, 0.56), C.stone, { p: [x, BASE * 0.5 + 2.75, front + 0.8] });
    }
    b.add(box(3.4, 0.3, 1.3), C.stone, { p: [0, BASE * 0.5 + 2.95, front + 0.5] });
    const towerBase = BASE + WALL;
    b.add(box(2.3, 4.2, 2.3), C.white, { p: [0, towerBase + 2.1, 0.6] });
    b.add(box(2.4, 0.2, 2.4), C.aegean, { p: [0, towerBase + 2.3, 0.6] });
    b.add(box(2.6, 0.24, 2.6), C.white, { p: [0, towerBase + 4.2, 0.6] });
    // Clock faces on the front and both sides.
    for (const [yaw, dx, dz] of [[0, 0, 1.16], [Math.PI / 2, 1.16, 0], [-Math.PI / 2, -1.16, 0]]) {
      b.group({ p: [dx, towerBase + 3.25, 0.6 + dz], r: [0, yaw, 0] }, () => {
        b.add(new CylinderGeometry(0.78, 0.78, 0.1, 14), C.aegean, { r: [Math.PI / 2, 0, 0] });
        b.add(new CylinderGeometry(0.66, 0.66, 0.12, 14), C.cloud, { p: [0, 0, 0.02], r: [Math.PI / 2, 0, 0] });
        b.add(box(0.07, 0.5, 0.04), C.ink, { p: [0, 0.22, 0.09] });
        b.add(box(0.36, 0.07, 0.04), C.ink, { p: [0.16, 0, 0.09] });
      });
    }
    // A small dome caps the tower.
    b.add(new IcosahedronGeometry(1.25, 1), C.terracotta, { p: [0, towerBase + 4.35, 0.6], s: [1, 0.75, 1] });
    post(b, 0, 0.6, towerBase + 5.1, towerBase + 7.2, 0.04, C.metalDark, 4);
    b.add(box(0.9, 0.5, 0.04), C.coral, { p: [0.47, towerBase + 6.9, 0.6] });
    lamp(b, -2.6, front + 1.5);
    lamp(b, 2.6, front + 1.5);
    for (const x of [-2.35, 2.35]) {
      b.add(box(1.5, 0.3, 0.5), C.white, { p: [x, BASE + 0.1, front + 0.45] });
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
      siteSign(b, -2.4, 3.2, C.coral);
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
    b.add(box(W, WALL, D), C.wallPeach, { p: [0, BASE + WALL / 2, 0] });
    // Shop front: door on the left, one wide window.
    b.add(box(1.2, 2.1, 0.14), C.white, { p: [-1.9, BASE + 1.05, front + 0.02] });
    b.add(box(0.95, 1.9, 0.12), C.coral, { p: [-1.9, BASE + 0.95, front + 0.07] });
    b.add(box(0.5, 0.6, 0.06), C.glass, { p: [-1.9, BASE + 1.4, front + 0.12] });
    b.group({ p: [0.9, BASE + 1.45, front] }, () => windowOn(b, 2.8, 1.5));
    for (const side of [1, -1]) {
      b.group({ p: [(side * W) / 2, BASE + 1.5, 0], r: [0, (side * Math.PI) / 2, 0] }, () => windowOn(b, 1.2, 1.2));
    }
    if (stage === 2) {
      scaffold(b, -W / 2, W / 2, front + 0.25, WALL + 0.6);
      return;
    }
    // Flat roof used as a second terrace: a pergola, a parasol, plants.
    flatRoof(b, W, D, BASE + WALL, C.wallPeach, C.tile);
    const roofY = BASE + WALL + 0.06;
    for (const x of [-2.4, -0.4]) for (const z of [-1.3, 1.1]) b.add(box(0.1, 2.0, 0.1), C.wood, { p: [x, roofY + 1.0, z] });
    for (let i = 0; i < 6; i++) b.add(box(0.07, 0.07, 2.9), C.wood, { p: [-2.5 + i * 0.44, roofY + 2.05, -0.1] });
    post(b, 1.6, 0, roofY, roofY + 1.9, 0.035, C.metalDark, 4);
    b.add(new ConeGeometry(1.1, 0.5, 8), C.coral, { p: [1.6, roofY + 2.0, 0] });
    b.add(new IcosahedronGeometry(0.34, 0), C.leaf, { p: [2.5, roofY + 0.4, 1.5] });
    b.add(new IcosahedronGeometry(0.3, 0), C.flowerPink, { p: [2.55, roofY + 0.75, 1.45] });    // Striped awning across the front.
    for (let i = 0; i < 10; i++) {
      b.add(box(0.6, 0.08, 1.3), i % 2 ? C.white : C.coral, { p: [-2.7 + i * 0.6, BASE + 2.45, front + 0.6], r: [0.3, 0, 0] });
    }
    // Hanging sign: a round board with a cup on it.
    b.add(box(0.08, 0.08, 0.9), C.shoe, { p: [-2.95, BASE + 3.0, front + 0.45] });
    b.add(new CylinderGeometry(0.42, 0.42, 0.08, 10), C.clothCream, { p: [-2.95, BASE + 2.45, front + 0.8], r: [0, 0, Math.PI / 2] });
    b.add(new CylinderGeometry(0.16, 0.12, 0.2, 6), C.clothRed, { p: [-2.95, BASE + 2.42, front + 0.8], s: [1.4, 1, 1] });
    // Terrace: paved floor, three tables with stools, two parasols, planters.
    slab(b, -3.4, 3.4, front + 0.25, front + 3.3, 0, 0.1, C.tile);
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
      b.add(box(0.5, 0.45, 0.5), C.white, { p: [x, 0.32, front + 3.0] });
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

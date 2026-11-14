import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry } from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { PLACES, SEA_LEVEL } from './district';
import { barrel, bench, bollard, crate, dock, lamp, logPile, post, ridgeRoofX, slab } from './kit';

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

/** Where the ferry is moored, and which way it points. */
export const FERRY_BERTH = { x: PLACES.ferry.x + 13, z: 4.9, yaw: Math.PI / 2 } as const;

/**
 * The places that are there from day one, merged into one geometry:
 * the ferry pier (where new residents arrive), the forest camp (lumberjacks)
 * and the fishing hut with its jetty (fishers).
 */
export function buildLandmarks(): BufferGeometry {
  const b = new Builder();
  const deckTop = 0.3;

  // ---- Ferry pier: east shore, running out along +x.
  b.group({ p: [PLACES.ferry.x, 0, PLACES.ferry.z] }, () => {
    dock(b, 2.5, 22, -2.2, 2.2, deckTop);
    slab(b, -1, 2.6, -2.4, 2.4, -1.2, deckTop, C.stone);
    // Welcome gate at the landward end.
    for (const z of [-2.5, 2.5]) {
      b.add(box(0.26, 3.8, 0.26), C.wood, { p: [0.4, 1.9, z] });
      b.add(new IcosahedronGeometry(0.2, 0), C.brass, { p: [0.4, 3.0, z * 0.82] });
    }
    b.add(box(0.3, 0.3, 5.6), C.woodDark, { p: [0.4, 3.8, 0] });
    b.add(box(0.14, 0.8, 3.0), C.clothCream, { p: [0.4, 3.25, 0] });
    b.add(box(0.16, 0.16, 3.0), C.clothTeal, { p: [0.42, 3.6, 0] });
    // Waiting shelter with a bench, half way along.
    b.group({ p: [12, deckTop, -1.3] }, () => {
      for (const x of [-1.5, 1.5]) for (const z of [-0.6, 0.6]) b.add(box(0.12, 2.3, 0.12), C.wood, { p: [x, 1.15, z] });
      b.add(box(3.6, 0.12, 1.9), C.roofTeal, { p: [0, 2.4, 0], r: [0.12, 0, 0] });
      b.add(box(3.0, 1.2, 0.08), C.wallWarm, { p: [0, 1.0, -0.6] });
      bench(b, 0, -0.15, 0, 0);
    });
    for (const x of [6, 17]) lamp(b, x, -1.9, deckTop);
    for (const x of [9, 15, 21]) bollard(b, x, 1.9, deckTop);
    crate(b, 19.5, -1.3, 0.8, deckTop, 0.3);
    barrel(b, 20.6, -1.2, deckTop);
  });

  // ---- Forest camp: west shore road. An open shed, a saw horse, logs and stumps.
  b.group({ p: [PLACES.camp.x, 0, PLACES.camp.z] }, () => {
    for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) b.add(box(0.2, 2.5, 0.2), C.woodDark, { p: [x, 1.25, z] });
    b.group({ p: [0, 2.5, 0] }, () => ridgeRoofX(b, 4, 3, 1.1, C.roof, C.roofDark));
    // Work bench with a saw under the roof.
    b.add(box(2.4, 0.12, 0.9), C.wood, { p: [0, 0.9, 0] });
    for (const x of [-1, 1]) b.add(box(0.12, 0.9, 0.8), C.woodDark, { p: [x, 0.45, 0] });
    b.add(box(1.1, 0.3, 0.04), C.stoneDark, { p: [0.2, 1.12, 0.1], r: [0, 0.3, 0] });
    logPile(b, 0.4, 3.9, 3.4);
    logPile(b, -4.4, -0.6, 2.6);
    // Stumps, one with an axe left in it.
    const stumps: [number, number][] = [[4.2, 1.2], [5.0, -1.6], [3.4, -3.2], [-3.6, 3.4]];
    stumps.forEach(([x, z]) => {
      b.add(new CylinderGeometry(0.36, 0.44, 0.45, 8), C.trunk, { p: [x, 0.225, z] });
      b.add(new CylinderGeometry(0.33, 0.33, 0.03, 8), C.sand, { p: [x, 0.46, z] });
    });
    b.add(box(0.07, 0.9, 0.07), C.wood, { p: [4.35, 0.85, 1.2], r: [0, 0, -0.5] });
    b.add(box(0.3, 0.2, 0.06), C.stoneDark, { p: [4.14, 0.56, 1.2], r: [0, 0, -0.5] });
    // Sawn planks stacked by the road.
    for (let i = 0; i < 5; i++) slab(b, -1.5, 1.5, -4.6, -3.7, i * 0.11, i * 0.11 + 0.09, i % 2 ? C.sand : C.wood);
  });

  // ---- Fishing hut: north shore. A plank hut, a drying rack, a jetty with a rowing boat.
  b.group({ p: [PLACES.fishing.x, 0, PLACES.fishing.z] }, () => {
    b.add(box(3.2, 2.2, 2.6), C.wood, { p: [0, 1.3, 0] });
    for (const x of [-1.6, -0.55, 0.55, 1.6]) b.add(box(0.06, 2.2, 2.66), C.woodDark, { p: [x, 1.3, 0] });
    slab(b, -1.8, 1.8, -1.5, 1.5, 0, 0.2, C.stoneDark);
    b.group({ p: [0, 2.4, 0] }, () => ridgeRoofX(b, 3.2, 2.6, 1.0, C.roofSlate, C.roofSlateDark));
    b.add(box(0.8, 1.6, 0.1), C.door, { p: [-0.6, 1.0, 1.32] });
    b.add(box(0.7, 0.6, 0.08), C.glass, { p: [0.7, 1.5, 1.32] });
    // Drying rack with the day's catch.
    b.group({ p: [3.6, 0, 0.6] }, () => {
      for (const z of [-1, 1]) b.add(box(0.1, 1.7, 0.1), C.woodDark, { p: [0, 0.85, z] });
      b.add(box(0.08, 0.08, 2.3), C.wood, { p: [0, 1.7, 0] });
      for (const z of [-0.6, -0.1, 0.4, 0.8]) b.add(box(0.06, 0.5, 0.2), C.roofSlate, { p: [0, 1.38, z], r: [0, 0, 0.1] });
    });
    barrel(b, -2.4, 1.2);
    crate(b, -2.6, 0.1, 0.7, 0, 0.2);
    // Jetty out over the water (the sea is towards -z here).
    b.group({ r: [0, Math.PI, 0] }, () => {
      dock(b, -3.4, -1.8, 3.0, 17, 0.25);
      // Rowing boat tied alongside.
      b.group({ p: [-0.5, SEA_LEVEL, 12] }, () => {
        b.add(box(1.2, 0.5, 2.6), C.clothRed, { p: [0, 0.15, 0] });
        b.add(new CylinderGeometry(0, 0.7, 0.9, 4), C.clothRed, { p: [0, 0.15, 1.75], r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.5] });
        b.add(box(0.95, 0.1, 2.3), C.woodDark, { p: [0, 0.38, 0] });
        b.add(box(1.1, 0.07, 0.3), C.wood, { p: [0, 0.45, -0.2] });
      });
      bollard(b, -2.0, 15.5, 0.25);
    });
  });

  return b.geometry();
}

/** The ferry that brings new residents. Built around its own centre, bow towards +z, waterline at y = 0. */
export function buildFerry(): BufferGeometry {
  const b = new Builder();
  b.add(box(3.4, 1.5, 8.5), C.cloud, { p: [0, 0.25, 0] });
  b.add(new CylinderGeometry(0, 1.95, 2.6, 4), C.cloud, { p: [0, 0.25, 5.5], r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.55] });
  b.add(box(3.5, 0.3, 8.6), C.clothRed, { p: [0, 0.35, 0] });
  b.add(box(3.1, 0.1, 8.2), C.wood, { p: [0, 1.02, 0] });
  // Cabin with a row of windows, wheelhouse on top, funnel behind.
  b.add(box(2.5, 1.5, 4.2), C.wallWarm, { p: [0, 1.8, -0.6] });
  for (const side of [1, -1]) {
    for (const z of [-2.0, -0.9, 0.2]) b.add(box(0.06, 0.6, 0.7), C.glass, { p: [side * 1.26, 1.95, z] });
  }
  b.add(box(2.8, 0.14, 4.6), C.roofTeal, { p: [0, 2.62, -0.6] });
  b.add(box(1.7, 1.0, 1.4), C.cloud, { p: [0, 3.2, 0.6] });
  b.add(box(1.4, 0.5, 0.06), C.glass, { p: [0, 3.3, 1.31] });
  b.add(box(1.9, 0.12, 1.6), C.roofTeal, { p: [0, 3.76, 0.6] });
  b.add(new CylinderGeometry(0.42, 0.48, 1.6, 8), C.clothRed, { p: [0, 3.45, -1.5] });
  b.add(new CylinderGeometry(0.44, 0.44, 0.3, 8, 1, true), C.shoe, { p: [0, 4.15, -1.5] });
  // Rail posts along the deck, a lifebuoy, a flag at the stern.
  for (const side of [1, -1]) {
    for (let z = -3.8; z <= 3.9; z += 1.1) post(b, side * 1.55, z, 1.05, 1.6, 0.03, C.shoe, 4);
    b.add(box(0.05, 0.05, 7.8), C.shoe, { p: [side * 1.55, 1.6, 0] });
  }
  b.add(new CylinderGeometry(0.28, 0.28, 0.1, 8), C.clothRed, { p: [1.28, 1.6, 2.0], r: [0, 0, Math.PI / 2] });
  post(b, 0, -4.0, 1.05, 2.9, 0.035, C.shoe, 4);
  b.add(new ConeGeometry(0.3, 0.7, 3), C.clothMustard, { p: [0, 2.65, -4.4], r: [-Math.PI / 2, 0, 0], s: [0.2, 1, 1] });
  return b.geometry();
}

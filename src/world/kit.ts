import { BoxGeometry, CylinderGeometry } from 'three';
import type { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { SEA_LEVEL } from './district';

// Small reusable pieces for docks, sheds and yards. Everything is placed in the
// coordinates of the Builder's current group.

/** A plain box given by its two corners on the ground plane and its bottom and top heights. */
export function slab(b: Builder, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, color: number): void {
  b.add(new BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0)), color, {
    p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  });
}

/** An upright round post from y0 to y1. */
export function post(b: Builder, x: number, z: number, y0: number, y1: number, radius: number, color: number, sides = 6): void {
  b.add(new CylinderGeometry(radius, radius, y1 - y0, sides, 1, true), color, { p: [x, (y0 + y1) / 2, z] });
}

/**
 * A concrete pier over water: a pale deck with a darker edge, an expansion joint every few metres,
 * and square pillars going down into the sea along both long sides.
 */
export function dock(b: Builder, x0: number, x1: number, z0: number, z1: number, top: number, piles = true): void {
  slab(b, x0, x1, z0, z1, top - 0.3, top, C.concrete);
  slab(b, x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06, top - 0.42, top - 0.3, C.concreteDark);
  const alongZ = Math.abs(z1 - z0) >= Math.abs(x1 - x0);
  const [a0, a1] = alongZ ? [Math.min(z0, z1), Math.max(z0, z1)] : [Math.min(x0, x1), Math.max(x0, x1)];
  for (let a = a0 + 4; a < a1 - 1; a += 4) {
    if (alongZ) slab(b, x0, x1, a - 0.04, a + 0.04, top, top + 0.012, C.concreteDark);
    else slab(b, a - 0.04, a + 0.04, z0, z1, top, top + 0.012, C.concreteDark);
  }
  if (!piles) return;
  const inset = 0.5;
  for (let a = a0 + 1; a <= a1 - 0.6; a += 4.5) {
    for (const side of [0, 1]) {
      const x = alongZ ? (side ? x1 - inset : x0 + inset) : a;
      const z = alongZ ? a : side ? z1 - inset : z0 + inset;
      b.add(new BoxGeometry(0.5, top - 0.3 - (SEA_LEVEL - 1.6), 0.5), C.concreteDark, { p: [x, (top - 0.3 + SEA_LEVEL - 1.6) / 2, z] });
    }
  }
}
/** A stack of logs lying along x: rows of 3, 2 and 1. */
export function logPile(b: Builder, x: number, z: number, length = 3, y = 0): void {
  const r = 0.27;
  [3, 2, 1].forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      b.add(new CylinderGeometry(r, r, length, 7), row === 1 && i === 0 ? C.woodDark : C.trunk, {
        p: [x, y + r + row * r * 1.75, z + (i - (n - 1) / 2) * r * 2.05],
        r: [0, 0, Math.PI / 2],
      });
    }
  });
}

/** A wooden crate with darker edge bands. */
export function crate(b: Builder, x: number, z: number, size = 0.9, y = 0, yaw = 0): void {
  b.group({ p: [x, y + size / 2, z], r: [0, yaw, 0] }, () => {
    b.add(new BoxGeometry(size, size, size), C.wood);
    b.add(new BoxGeometry(size + 0.04, 0.1, size + 0.04), C.woodDark, { p: [0, size / 2 - 0.08, 0] });
    b.add(new BoxGeometry(size + 0.04, 0.1, size + 0.04), C.woodDark, { p: [0, -size / 2 + 0.08, 0] });
  });
}

export function barrel(b: Builder, x: number, z: number, y = 0): void {
  b.add(new CylinderGeometry(0.34, 0.3, 0.85, 8), C.wood, { p: [x, y + 0.425, z] });
  b.add(new CylinderGeometry(0.36, 0.36, 0.08, 8, 1, true), C.woodDark, { p: [x, y + 0.62, z] });
  b.add(new CylinderGeometry(0.34, 0.34, 0.08, 8, 1, true), C.woodDark, { p: [x, y + 0.22, z] });
}

/** A modern street light: slim grey pole, a short arm, a flat warm lamp. */
export function lamp(b: Builder, x: number, z: number, y = 0): void {
  post(b, x, z, y, y + 3.2, 0.06, C.metalDark, 5);
  b.add(new BoxGeometry(0.7, 0.06, 0.08), C.metalDark, { p: [x + 0.3, y + 3.2, z] });
  b.add(new BoxGeometry(0.42, 0.08, 0.2), C.brass, { p: [x + 0.5, y + 3.14, z] });
}
/** A low mooring post. */
export function bollard(b: Builder, x: number, z: number, y: number): void {
  b.add(new CylinderGeometry(0.14, 0.18, 0.42, 6), C.metalDark, { p: [x, y + 0.21, z] });
  b.add(new CylinderGeometry(0.22, 0.22, 0.1, 6), C.craneYellow, { p: [x, y + 0.45, z] });
}

/** A gable roof whose ridge runs along x, centred on the current group's origin at eave height. */
export function ridgeRoofX(b: Builder, length: number, depth: number, rise: number, color: number, trim: number): void {
  const half = depth / 2 + 0.4;
  const angle = Math.atan2(rise, half);
  const slabLen = Math.hypot(half, rise) + 0.12;
  for (const side of [1, -1]) {
    b.group({ p: [0, rise / 2, (side * half) / 2], r: [side * angle, 0, 0] }, () => {
      b.add(new BoxGeometry(length + 0.8, 0.22, slabLen), color);
      b.add(new BoxGeometry(length + 0.86, 0.28, 0.3), trim, { p: [0, 0, (side * slabLen) / 2 - side * 0.1] });
    });
  }
  b.add(new BoxGeometry(length + 0.9, 0.24, 0.42), trim, { p: [0, rise + 0.05, 0] });
}

/** A small moored sailing boat pointing along +z. */
export function sailBoat(b: Builder, x: number, z: number, hull: number, yaw = 0): void {
  b.group({ p: [x, SEA_LEVEL, z], r: [0, yaw, 0] }, () => {
    b.add(new BoxGeometry(1.5, 0.7, 3.2), hull, { p: [0, 0.2, 0] });
    b.add(new CylinderGeometry(0, 0.86, 1.4, 4), hull, { p: [0, 0.2, 2.3], r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.5] });
    b.add(new BoxGeometry(1.2, 0.08, 2.9), C.wood, { p: [0, 0.56, 0] });
    post(b, 0, 0.3, 0.5, 4.2, 0.06, C.woodDark, 5);
    // Sail: a thin triangle made from a three-sided cylinder.
    b.add(new CylinderGeometry(0, 1.3, 3.0, 3), C.cloud, { p: [0, 2.5, -0.55], s: [0.06, 1, 1] });
  });
}

/** A park bench facing +z before `yaw` is applied. */
export function bench(b: Builder, x: number, z: number, y = 0, yaw = 0): void {
  b.group({ p: [x, y, z], r: [0, yaw, 0] }, () => {
    b.add(new BoxGeometry(1.7, 0.1, 0.5), C.wood, { p: [0, 0.45, 0] });
    b.add(new BoxGeometry(1.7, 0.36, 0.08), C.wood, { p: [0, 0.74, -0.24], r: [-0.14, 0, 0] });
    b.add(new BoxGeometry(0.1, 0.42, 0.44), C.woodDark, { p: [-0.7, 0.21, 0] });
    b.add(new BoxGeometry(0.1, 0.42, 0.44), C.woodDark, { p: [0.7, 0.21, 0] });
  });
}

/** A fenced building site: orange and white barriers all round, with a gap for the way in on the -z side. */
export function siteFence(b: Builder, x0: number, x1: number, z0: number, z1: number, gap = 5): void {
  const mid = (x0 + x1) / 2;
  barrier(b, x0, z0, mid - gap / 2, z0);
  barrier(b, mid + gap / 2, z0, x1, z0);
  barrier(b, x1, z0, x1, z1);
  barrier(b, x1, z1, x0, z1);
  barrier(b, x0, z1, x0, z0);
}
/** A notice board on two posts, facing -z: "something is being built here". */
export function siteSign(b: Builder, x: number, z: number, accent: number): void {
  b.group({ p: [x, 0, z] }, () => {
    b.add(new BoxGeometry(0.12, 1.9, 0.12), C.woodDark, { p: [-0.75, 0.95, 0] });
    b.add(new BoxGeometry(0.12, 1.9, 0.12), C.woodDark, { p: [0.75, 0.95, 0] });
    b.add(new BoxGeometry(1.9, 1.0, 0.1), C.clothCream, { p: [0, 1.5, -0.04] });
    b.add(new BoxGeometry(1.9, 0.22, 0.12), accent, { p: [0, 1.89, -0.04] });
    b.add(new BoxGeometry(1.1, 0.1, 0.12), C.woodDark, { p: [0, 1.5, -0.05] });
    b.add(new BoxGeometry(0.7, 0.1, 0.12), C.woodDark, { p: [-0.2, 1.25, -0.05] });
  });
}

/** A pile of cut stone blocks. */
export function stonePile(b: Builder, x: number, z: number): void {
  const at: [number, number, number][] = [[0, 0, 0], [0.95, 0, 0.1], [0.45, 0, 0.9], [0.5, 0.55, 0.3], [1.5, 0, 0.8]];
  at.forEach(([dx, dy, dz], i) =>
    b.add(new BoxGeometry(0.85, 0.5, 0.7), i % 2 ? C.stone : C.stoneDark, { p: [x + dx, 0.25 + dy, z + dz], r: [0, i * 0.4, 0] }),
  );
}

/** Builders' scaffolding against a wall: poles, two plank levels, a diagonal brace. Spans x0..x1 at depth z. */
export function scaffold(b: Builder, x0: number, x1: number, z: number, height: number): void {
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 2.2))) {
    b.add(new BoxGeometry(0.08, height, 0.08), C.metal, { p: [x, height / 2, z] });
    b.add(new BoxGeometry(0.08, height, 0.08), C.metal, { p: [x, height / 2, z + 0.8] });
  }
  for (const y of [height * 0.45, height * 0.9]) {
    b.add(new BoxGeometry(x1 - x0 + 0.3, 0.08, 0.9), C.sand, { p: [(x0 + x1) / 2, y, z + 0.4] });
  }
  b.add(new BoxGeometry(Math.hypot(x1 - x0, height * 0.45), 0.06, 0.06), C.metalDark, {
    p: [(x0 + x1) / 2, height * 0.225, z + 0.86],
    r: [0, 0, Math.atan2(height * 0.45, x1 - x0)],
  });
}
/** A shipping container lying along z. */
export function container(b: Builder, x: number, z: number, color: number, y = 0, yaw = 0): void {
  b.group({ p: [x, y, z], r: [0, yaw, 0] }, () => {
    b.add(new BoxGeometry(1.5, 1.5, 3.6), color, { p: [0, 0.75, 0] });
    for (const dz of [-1.2, -0.4, 0.4, 1.2]) b.add(new BoxGeometry(1.54, 1.3, 0.08), C.metalDark, { p: [0, 0.75, dz] });
    b.add(new BoxGeometry(1.3, 1.3, 0.06), C.metal, { p: [0, 0.75, 1.81] });
  });
}

/** A small motor yacht pointing along +z, waterline at the sea surface. */
export function yacht(b: Builder, x: number, z: number, stripe: number, yaw = 0, size = 1): void {
  b.group({ p: [x, SEA_LEVEL, z], r: [0, yaw, 0], s: size }, () => {
    b.add(new BoxGeometry(1.7, 0.8, 3.6), C.white, { p: [0, 0.2, 0] });
    b.add(new CylinderGeometry(0, 0.98, 1.6, 4), C.white, { p: [0, 0.2, 2.6], r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.58] });
    b.add(new BoxGeometry(1.74, 0.14, 3.64), stripe, { p: [0, 0.3, 0] });
    b.add(new BoxGeometry(1.3, 0.6, 1.7), C.white, { p: [0, 0.9, -0.3] });
    b.add(new BoxGeometry(1.34, 0.3, 1.2), C.metalDark, { p: [0, 0.95, -0.1] });
    b.add(new BoxGeometry(1.4, 0.06, 1.9), C.white, { p: [0, 1.23, -0.3] });
    post(b, 0, -1.0, 1.25, 2.0, 0.025, C.metal, 4);
  });
}

/** A lightweight barrier for building sites: orange and white boards on short legs, from (ax,az) to (bx,bz). */
export function barrier(b: Builder, ax: number, az: number, bx: number, bz: number): void {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(az - bz, bx - ax);
  const n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    b.group({ p: [ax + (bx - ax) * t, 0, az + (bz - az) * t], r: [0, yaw, 0] }, () => {
      const w = len / n - 0.15;
      b.add(new BoxGeometry(w, 0.22, 0.06), C.coral, { p: [0, 0.8, 0] });
      b.add(new BoxGeometry(w, 0.22, 0.06), C.white, { p: [0, 0.52, 0] });
      for (const sx of [-1, 1]) b.add(new BoxGeometry(0.08, 0.95, 0.3), C.metalDark, { p: [(sx * w) / 2.3, 0.47, 0] });
    });
  }
}
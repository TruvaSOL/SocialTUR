import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import {
  BLOCKS,
  LOWER,
  LOWER_TOP,
  ROW_D,
  SCREEN_BLOCKS,
  SEGMENTS,
  type Segment,
  type Tier,
  UPPER,
  UPPER_BACK_D,
  UPPER_TOP,
  outline,
  rowY,
  segmentLength,
  segmentSteps,
} from './layout';
import { Mesher, type P3, structureMaterial } from './mesher';

// Heights and distances of the parts around the seating. All derived from the layout.
export const LOWER_BACK_D = LOWER.d0 + LOWER.rows * ROW_D;
const SOFFIT_Y = UPPER.y0 - 1.6;
const VIP_D = LOWER_BACK_D + 2;
export const ROOF_IN_D = UPPER.d0 + 7;
export const ROOF_IN_Y = UPPER_TOP + 8;
export const ROOF_OUT_D = UPPER_BACK_D + 3.2;
export const ROOF_OUT_Y = UPPER_TOP + 5;
export const FACADE_D = UPPER_BACK_D + 2.6;
const FACADE_BASE_Y = 7;
const roofY = (d: number) => ROOF_IN_Y + ((d - ROOF_IN_D) / (ROOF_OUT_D - ROOF_IN_D)) * (ROOF_OUT_Y - ROOF_IN_Y);

interface RingPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  /** Distance travelled along the ring. */
  s: number;
}

/** Sample points all the way round the outline at distance d. The first point is repeated at the end. */
export function ring(d: number): RingPoint[] {
  const points: RingPoint[] = [];
  let s = 0;
  for (const seg of SEGMENTS) {
    const steps = segmentSteps(seg);
    for (let k = 0; k < steps; k++) {
      const o = outline(seg, k / steps, d);
      const prev = points[points.length - 1];
      if (prev) s += Math.hypot(o.x - prev.x, o.z - prev.z);
      points.push({ x: o.x, z: o.z, nx: o.nx, nz: o.nz, s });
    }
  }
  const first = points[0];
  const last = points[points.length - 1];
  points.push({ ...first, s: s + Math.hypot(first.x - last.x, first.z - last.z) });
  return points;
}

/** A surface all the way round the bowl, from edge (d0, y0) to edge (d1, y1). */
function band(m: Mesher, d0: number, y0: number, d1: number, y1: number, color: number): void {
  const a = ring(d0);
  const b = ring(d1);
  for (let i = 0; i < a.length - 1; i++) {
    m.quad([a[i].x, y0, a[i].z], [a[i + 1].x, y0, a[i + 1].z], [b[i + 1].x, y1, b[i + 1].z], [b[i].x, y1, b[i].z], color);
  }
}

/** Steps and risers of one tier. */
function terraces(m: Mesher, tier: Tier): void {
  let y = tier.y0;
  for (let r = 0; r < tier.rows; r++) {
    const d = tier.d0 + r * ROW_D;
    const next = y + tier.rise(r);
    band(m, d, y, d + ROW_D, y, C.tread);
    band(m, d + ROW_D, y, d + ROW_D, next, C.riser);
    y = next;
  }
}

/** Places of evenly spaced items around the ring, about `spacing` metres apart at distance d. */
export function around(d: number, spacing: number): { seg: Segment; f: number }[] {
  const places: { seg: Segment; f: number }[] = [];
  for (const seg of SEGMENTS) {
    const n = Math.max(1, Math.round(segmentLength(seg, d) / spacing));
    for (let i = 0; i < n; i++) places.push({ seg, f: (i + 0.5) / n });
  }
  return places;
}

/** A box beam from p to q, with the given cross-section. */
function beam(b: Builder, p: P3, q: P3, w: number, h: number, color: number): void {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const dz = q[2] - p[2];
  const length = Math.hypot(dx, dy, dz);
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.asin(dy / length);
  b.group({ p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], r: [0, yaw, 0] }, () => {
    b.add(new BoxGeometry(w, h, length), color, { r: [pitch, 0, 0] });
  });
}

/** A textured strip all the way round, the texture repeating every `repeat` metres. */
function texturedRing(d: number, y0: number, y1: number, repeat: number): BufferGeometry {
  const pts = ring(d);
  const pos: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ua = a.s / repeat;
    const ub = b.s / repeat;
    // Two triangles; the texture reads left to right when seen from the pitch.
    pos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y0, a.z, b.x, y1, b.z, a.x, y1, a.z);
    uv.push(ua, 0, ub, 0, ub, 1, ua, 0, ub, 1, ua, 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

export interface Structure {
  group: Group;
  /** Where the two big screens are, for the scoreboard. */
  screens: { x: number; y: number; z: number; yaw: number; width: number; height: number }[];
}

/**
 * The stadium itself: terraces, the hospitality level, the roof with its trusses and lights,
 * the facade, and the LED ribbons. Static parts are merged into as few meshes as possible.
 */
export function createStructure(ledTexture: Texture): Structure {
  const group = new Group();
  const m = new Mesher();
  const b = new Builder();

  // ---- Lower tier: pitch wall, terraces, walkway at the back.
  band(m, -0.05, 0, -0.05, LOWER.y0 + 0.95, C.white);
  band(m, -0.12, LOWER.y0 + 0.45, -0.12, LOWER.y0 + 0.95, C.aegean);
  band(m, -0.15, LOWER.y0 + 0.95, 0.05, LOWER.y0 + 0.95, C.white);
  terraces(m, LOWER);
  band(m, LOWER_BACK_D, LOWER_TOP, VIP_D, LOWER_TOP, C.tread);

  // ---- Hospitality level: a glass wall with mullions under the upper tier's overhang.
  band(m, VIP_D, LOWER_TOP, VIP_D, SOFFIT_Y, C.glassDark);
  band(m, VIP_D - 0.02, LOWER_TOP + 2.6, VIP_D - 0.02, LOWER_TOP + 2.75, C.steel);
  for (const { seg, f } of around(VIP_D, 3.2)) {
    const o = outline(seg, f, VIP_D - 0.05);
    b.add(new BoxGeometry(0.14, SOFFIT_Y - LOWER_TOP, 0.14), C.steel, { p: [o.x, (LOWER_TOP + SOFFIT_Y) / 2, o.z] });
  }
  band(m, UPPER.d0, SOFFIT_Y, VIP_D, SOFFIT_Y, C.steel);

  // ---- Upper tier: the front edge (carries an LED ribbon), terraces, the back wall.
  band(m, UPPER.d0, SOFFIT_Y, UPPER.d0, UPPER.y0 + 0.95, C.ledBack);
  band(m, UPPER.d0 - 0.1, UPPER.y0 + 0.95, UPPER.d0 + 0.2, UPPER.y0 + 0.95, C.white);
  terraces(m, UPPER);
  band(m, UPPER_BACK_D, UPPER_TOP, UPPER_BACK_D, UPPER_TOP + 3, C.white);
  band(m, UPPER_BACK_D, UPPER_TOP + 3, FACADE_D, UPPER_TOP + 3, C.concrete);

  // ---- Roof: an opaque outer ring, a light membrane over the seats, white trusses, a deep inner beam.
  band(m, UPPER_BACK_D - 1, roofY(UPPER_BACK_D - 1), ROOF_OUT_D, ROOF_OUT_Y, C.steel);
  band(m, ROOF_OUT_D, ROOF_OUT_Y, ROOF_OUT_D, ROOF_OUT_Y - 1.2, C.white);
  band(m, ROOF_IN_D, ROOF_IN_Y + 0.3, ROOF_IN_D + 1.4, roofY(ROOF_IN_D + 1.4) + 0.3, C.white);
  band(m, ROOF_IN_D, ROOF_IN_Y - 1.9, ROOF_IN_D + 1.4, ROOF_IN_Y - 1.7, C.steel);
  band(m, ROOF_IN_D + 1.4, roofY(ROOF_IN_D + 1.4) + 0.3, ROOF_IN_D + 1.4, ROOF_IN_Y - 1.7, C.steel);
  for (const { seg, f } of around(UPPER_BACK_D, 11)) {
    const out = outline(seg, f, ROOF_OUT_D - 0.6);
    const inn = outline(seg, f, ROOF_IN_D + 0.7);
    const foot = outline(seg, f, UPPER_BACK_D + 0.6);
    const top: P3 = [out.x, ROOF_OUT_Y - 0.3, out.z];
    const tip: P3 = [inn.x, ROOF_IN_Y - 0.4, inn.z];
    beam(b, top, tip, 0.45, 0.8, C.white);
    beam(b, [foot.x, UPPER_TOP + 3, foot.z], [inn.x, ROOF_IN_Y - 1.7, inn.z], 0.35, 0.35, C.steel);
    beam(b, [foot.x, UPPER_TOP + 3, foot.z], top, 0.35, 0.35, C.steel);
  }

  // ---- Facade: a plinth with entrances, then white fins over dark glass up to the roof.
  band(m, FACADE_D, 0, FACADE_D, FACADE_BASE_Y, C.concrete);
  band(m, FACADE_D + 0.05, FACADE_BASE_Y - 0.6, FACADE_D + 0.05, FACADE_BASE_Y, C.aegean);
  band(m, FACADE_D - 0.4, FACADE_BASE_Y, FACADE_D - 0.4, roofY(FACADE_D) - 0.2, C.glassDark);
  const fins = around(FACADE_D, 2.4);
  fins.forEach(({ seg, f }, i) => {
    const o = outline(seg, f, FACADE_D + 0.2);
    const top = roofY(FACADE_D) - 0.3;
    // A slow wave of colour runs round the facade.
    const wave = Math.sin(i * 0.11) + 0.5 * Math.sin(i * 0.037 + 1.3);
    const color = wave > 1.05 ? C.aegean : wave > 0.55 ? C.seatSky : C.white;
    b.group({ p: [o.x, (FACADE_BASE_Y + top) / 2, o.z], r: [0, Math.atan2(o.nx, o.nz), 0] }, () => {
      b.add(new BoxGeometry(0.4, top - FACADE_BASE_Y, 1.2), color);
    });
  });
  for (const { seg, f } of around(FACADE_D, 70)) {
    // Entrances: dark openings with a canopy.
    const o = outline(seg, f, FACADE_D + 0.1);
    b.group({ p: [o.x, 0, o.z], r: [0, Math.atan2(o.nx, o.nz), 0] }, () => {
      b.add(new BoxGeometry(6, 4.2, 0.3), C.glassDark, { p: [0, 2.1, 0] });
      b.add(new BoxGeometry(8, 0.3, 2.4), C.white, { p: [0, 4.6, 1.1] });
    });
  }

  // ---- Big screens in two upper corners, where those blocks have no seats.
  const screens: Structure['screens'] = [];
  for (const { seg, index } of SCREEN_BLOCKS) {
    const n = BLOCKS.filter((bl) => bl.tier === 0 && bl.seg === seg).length;
    const f = (index + 0.5) / n;
    const d = UPPER.d0 + 13;
    const o = outline(seg, f, d);
    const width = 26;
    const height = 12;
    // Stands on the terraces of its empty block, high enough to clear them.
    const ground = rowY(UPPER, Math.ceil((d - UPPER.d0) / ROW_D) + 2);
    const y = ground + height / 2 + 1.5;
    const yaw = Math.atan2(-o.nx, -o.nz);
    screens.push({ x: o.x - o.nx * 1.06, y, z: o.z - o.nz * 1.06, yaw, width, height });
    b.group({ p: [o.x, y, o.z], r: [0, yaw, 0] }, () => {
      b.add(new BoxGeometry(width + 1.2, height + 1.2, 1.2), C.ledBack, { p: [0, 0, 0.4] });
      const legs = y - height / 2 - ground + 4;
      b.add(new BoxGeometry(2, legs, 2), C.steel, { p: [-width / 3, -height / 2 - legs / 2, -0.6] });
      b.add(new BoxGeometry(2, legs, 2), C.steel, { p: [width / 3, -height / 2 - legs / 2, -0.6] });
    });
  }

  const solid = new Mesh(mergeGeometries([m.geometry(), b.geometry()], false), structureMaterial);
  solid.castShadow = true;
  solid.receiveShadow = true;
  group.add(solid);

  // ---- The translucent membrane: lets light through, so it casts no shadow.
  const membrane = new Mesher();
  band(membrane, ROOF_IN_D + 1.4, roofY(ROOF_IN_D + 1.4) + 0.25, UPPER_BACK_D - 1, roofY(UPPER_BACK_D - 1), C.membrane);
  const membraneMesh = new Mesh(
    membrane.geometry(),
    new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false }),
  );
  membraneMesh.renderOrder = 2;
  group.add(membraneMesh);

  // ---- Floodlights under the roof's inner edge: unlit, so they always read as bright.
  const lights = new Builder();
  for (const { seg, f } of around(ROOF_IN_D, 4.2)) {
    const o = outline(seg, f, ROOF_IN_D + 0.7);
    lights.group({ p: [o.x, ROOF_IN_Y - 2.05, o.z], r: [0, Math.atan2(-o.nx, -o.nz), 0] }, () => {
      lights.add(new BoxGeometry(1.5, 0.28, 0.5), C.flood, { r: [-0.6, 0, 0] });
    });
  }
  group.add(new Mesh(lights.geometry(), new MeshBasicMaterial({ vertexColors: true })));

  // ---- LED ribbons: the upper tier's front edge and the roof's inner edge, both facing the pitch.
  const led = new MeshBasicMaterial({ map: ledTexture, side: DoubleSide });
  group.add(new Mesh(texturedRing(UPPER.d0 - 0.06, SOFFIT_Y + 0.1, UPPER.y0 + 0.85, 24), led));
  group.add(new Mesh(texturedRing(ROOF_IN_D - 0.06, ROOF_IN_Y - 1.75, ROOF_IN_Y + 0.25, 30), led));

  return { group, screens };
}

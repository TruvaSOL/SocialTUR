import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, smoothMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { BOTTOMS, HAIRS, type Look, SHOES, SKINS, TOPS } from '../world/looks';
import { RIG, computeSeatedPose, createPose } from '../world/pose';
import { waveAt, waveLift } from './fans';
import { SEATS, SEAT_H } from './layout';

/** Characters are drawn a little smaller than people, so a toon head fits a real seat. */
export const FAN_SCALE = 0.85;
/** How far below the seat the feet rest, in the character's own units. */
export const FLOOR = SEAT_H / FAN_SCALE;

const WHITE = 0xffffff;
const one = (build: (b: Builder) => void): BufferGeometry => {
  const b = new Builder();
  build(b);
  return b.geometry();
};

/** Crowd body parts: the detailed character's shapes with fewer triangles, white where the look's colour goes. */
const PARTS = {
  pelvis: () => one((b) => b.add(new BoxGeometry(0.4, 0.2, 0.28), WHITE, { p: [0, 0.04, 0] })),
  torso: () => one((b) => b.add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 1, 0.13), WHITE, { p: [0, 0.31, 0] })),
  head: () =>
    one((b) => {
      b.add(new SphereGeometry(0.3, 10, 7), WHITE, { p: [0, 0.27, 0], s: [1, 0.93, 0.96] });
      for (const side of [1, -1]) {
        b.add(new SphereGeometry(0.036, 4, 2), C.ink, { p: [side * 0.105, 0.27, 0.272], s: [1, 1.25, 0.5] });
      }
    }),
  hair: () =>
    one((b) => {
      b.add(new SphereGeometry(0.318, 10, 5, 0, Math.PI * 2, 0, 1.75), WHITE, { p: [0, 0.275, 0], r: [-0.5, 0, 0], s: [1, 0.95, 0.98] });
      b.add(new SphereGeometry(0.1, 5, 3), WHITE, { p: [0.04, 0.585, 0.02] });
    }),
  sleeve: () => one((b) => b.add(new CapsuleGeometry(0.068, 0.2, 2, 6), WHITE, { p: [0, -0.13, 0] })),
  hand: () => one((b) => b.add(new SphereGeometry(0.075, 5, 3), WHITE, { p: [0, -0.33, 0] })),
  leg: () => one((b) => b.add(new CapsuleGeometry(0.085, 0.2, 2, 6), WHITE, { p: [0, -0.17, 0] })),
  shoe: () => one((b) => b.add(new BoxGeometry(0.18, 0.12, 0.28), WHITE, { p: [0, -0.36, 0.04] })),
};
type PartName = keyof typeof PARTS;
/** Which look colour tints each part: 0 skin, 1 hair, 2 top, 3 bottom, 4 shoes. */
const TINT: Record<PartName, number> = { pelvis: 3, torso: 2, head: 0, hair: 1, sleeve: 2, hand: 0, leg: 3, shoe: 4 };
const PAIRED: Record<PartName, boolean> = {
  pelvis: false, torso: false, head: false, hair: false, sleeve: true, hand: true, leg: true, shoe: true,
};

const Y_AXIS = new Vector3(0, 1, 0);
const UNIT = new Vector3(1, 1, 1);

/**
 * The fans nearest the camera, as full 3D characters. The flat cut-outs hide themselves
 * inside the same radius, so every fan is drawn exactly once.
 */
export class NearFans {
  readonly group = new Group();
  /** Most characters drawn in 3D at once (quality control). */
  max = 120;
  /** The radius used last frame. */
  radius = 0;
  /** How many were drawn last frame. */
  drawn = 0;

  private batches = {} as Record<PartName, { mesh: InstancedMesh; m: Float32Array; c: Float32Array; tint: number }>;
  private colors: Float32Array;
  private eye = new Vector3(0, 1e6, 0);
  private candidates: { index: number; d2: number }[] = [];
  private pose = createPose();
  private root = new Matrix4();
  private pelvis = new Matrix4();
  private torso = new Matrix4();
  private bone = new Matrix4();
  private local = new Matrix4();
  private v = new Vector3();
  private s = new Vector3();
  private q = new Quaternion();
  private e = new Euler();
  private looks: (Look | null)[] = [];
  /** Set when the fans or their looks change, so the 3D set is chosen again. */
  private stale = true;

  constructor(private capacity = 240) {
    this.colors = new Float32Array(SEATS.count * 15);
    for (const name of Object.keys(PARTS) as PartName[]) {
      const n = capacity * (PAIRED[name] ? 2 : 1);
      const mesh = new InstancedMesh(PARTS[name](), smoothMaterial, n);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(n * 3), 3);
      mesh.instanceColor.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.batches[name] = { mesh, m: mesh.instanceMatrix.array as Float32Array, c: mesh.instanceColor.array as Float32Array, tint: TINT[name] };
      this.group.add(mesh);
    }
  }

  /** Remembers a fan's look (null: seat empty or drawn elsewhere, like the player's own). */
  setFan(index: number, look: Look | null): void {
    this.looks[index] = look;
    this.stale = true;
    if (!look) return;
    const color = new Color();
    [SKINS[look.skin], HAIRS[look.hair], TOPS[look.top], BOTTOMS[look.bottom], SHOES[look.shoes]].forEach((hex, k) => {
      color.set(hex).toArray(this.colors, index * 15 + k * 3);
    });
  }

  /** Forces the 3D set to be chosen again on the next update (after a quality change, for example). */
  refresh(): void {
    this.stale = true;
  }

  /** The camera position the near/far split was last decided from. */
  get splitEye(): Vector3 {
    return this.eye;
  }

  /**
   * Chooses the fans to draw in 3D: those within `reach` of the camera, at most `max` of them.
   * The radius shrinks when there are more, and the flat cut-outs use the same radius.
   */
  update(time: number, camera: Vector3, count: number, reach: number): void {
    // Re-choose only when the camera has moved noticeably; in between, pose the same set.
    if (this.stale || camera.distanceToSquared(this.eye) > 0.04) {
      this.stale = false;
      this.eye.copy(camera);
      const r2 = reach * reach;
      this.candidates.length = 0;
      const pos = SEATS.pos;
      for (let i = 0; i < count; i++) {
        if (!this.looks[i]) continue;
        const dx = pos[i * 3] - camera.x;
        const dy = pos[i * 3 + 1] - camera.y;
        const dz = pos[i * 3 + 2] - camera.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        // Fans right at the camera are left out, so it never looks out from inside a head.
        if (d2 < r2 && d2 > 1.1) this.candidates.push({ index: i, d2 });
      }
      let radius = reach;
      if (this.candidates.length > this.max) {
        this.candidates.sort((a, b) => a.d2 - b.d2);
        // Split half way between the last fan kept and the first one left out.
        radius = (Math.sqrt(this.candidates[this.max - 1].d2) + Math.sqrt(this.candidates[this.max].d2)) / 2;
        this.candidates.length = this.max;
      }
      this.radius = this.max > 0 && this.candidates.length ? radius : 0;
      if (this.max === 0) this.candidates.length = 0;
    }

    const wave = waveAt(time);
    let n = 0;
    for (const { index } of this.candidates) {
      if (n >= this.capacity) break;
      this.write(n++, index, time, wave);
    }
    this.drawn = n;
    for (const name of Object.keys(this.batches) as PartName[]) {
      const { mesh } = this.batches[name];
      mesh.count = n * (PAIRED[name] ? 2 : 1);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
  }

  private put(name: PartName, slot: number, index: number, matrix: Matrix4): void {
    const batch = this.batches[name];
    matrix.toArray(batch.m, slot * 16);
    const from = index * 15 + batch.tint * 3;
    batch.c[slot * 3] = this.colors[from];
    batch.c[slot * 3 + 1] = this.colors[from + 1];
    batch.c[slot * 3 + 2] = this.colors[from + 2];
  }

  private write(n: number, i: number, time: number, wave: { angle: number; on: number }): void {
    const x = SEATS.pos[i * 3];
    const y = SEATS.pos[i * 3 + 1];
    const z = SEATS.pos[i * 3 + 2];
    const seed = (i * 0.6180339887) % 1;
    const lift = waveLift(x, z, wave);
    // Same rule as the cut-outs for the occasional cheer, so a fan does not change mood when it swaps.
    const slot = Math.floor(time * 0.4 + seed * 97);
    const r = Math.sin(slot * 12.9898 + seed * 311.7) * 43758.5453;
    const cheer = r - Math.floor(r) > 0.975 ? 1 : 0;
    const p = computeSeatedPose(this.pose, time, seed, Math.max(lift, cheer), lift * 0.9, FLOOR);
    const { root, pelvis, torso, bone, local, v, s, q, e } = this;

    root.compose(v.set(x, y, z), q.setFromAxisAngle(Y_AXIS, SEATS.yaw[i]), s.setScalar(FAN_SCALE));
    local.compose(v.set(p.pelvisX, p.pelvisY, 0), q.setFromEuler(e.set(p.pelvisRX, p.pelvisRY, p.pelvisRZ)), UNIT);
    pelvis.multiplyMatrices(root, local);
    this.put('pelvis', n, i, pelvis);
    local.compose(v.set(0, 0, 0), q.setFromAxisAngle(Y_AXIS, p.torsoRY), s.set(1, p.torsoSY, 1));
    torso.multiplyMatrices(pelvis, local);
    this.put('torso', n, i, torso);
    local.compose(v.set(0, RIG.headY, 0), q.setFromEuler(e.set(p.headRX, p.headRY, p.headRZ)), UNIT);
    bone.multiplyMatrices(torso, local);
    this.put('head', n, i, bone);
    this.put('hair', n, i, bone);
    local.compose(v.set(RIG.armX, RIG.armY, 0), q.setFromEuler(e.set(p.armLX, 0, p.armLZ)), UNIT);
    bone.multiplyMatrices(torso, local);
    this.put('sleeve', n * 2, i, bone);
    this.put('hand', n * 2, i, bone);
    local.compose(v.set(-RIG.armX, RIG.armY, 0), q.setFromEuler(e.set(p.armRX, 0, p.armRZ)), UNIT);
    bone.multiplyMatrices(torso, local);
    this.put('sleeve', n * 2 + 1, i, bone);
    this.put('hand', n * 2 + 1, i, bone);
    local.compose(v.set(RIG.legX, p.liftL, 0), q.setFromEuler(e.set(p.legL, 0, 0)), UNIT);
    bone.multiplyMatrices(pelvis, local);
    this.put('leg', n * 2, i, bone);
    this.put('shoe', n * 2, i, bone);
    local.compose(v.set(-RIG.legX, p.liftR, 0), q.setFromEuler(e.set(p.legR, 0, 0)), UNIT);
    bone.multiplyMatrices(pelvis, local);
    this.put('leg', n * 2 + 1, i, bone);
    this.put('shoe', n * 2 + 1, i, bone);
  }
}

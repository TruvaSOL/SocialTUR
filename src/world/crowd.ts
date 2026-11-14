import {
  BoxGeometry,
  type BufferGeometry,
  type Camera,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  Frustum,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Sphere,
  SphereGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, seededRandom, smoothMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { RIG, computePose, createPose } from './pose';
import { Walker } from './walker';

export const CROWD_MAX = 200;

const WHITE = 0xffffff;
const SKINS = [C.skinLight, C.skinLight, C.skinTan, C.skinBrown];
const HAIRS = [C.hairBrown, C.hairBlack, C.hairBlond, C.woodDark];
const TOPS = [C.clothMustard, C.clothRed, C.clothTeal, C.clothNavy, C.clothPlum, C.clothCream, C.flowerPink, C.leaf];
const BOTTOMS = [C.clothNavy, C.shoe, C.stoneDark, C.woodDark, C.clothTeal, C.clothCream];
const SHOES = [C.shoe, C.ink, C.wood];

/** Soft dark disc under a character. Far cheaper than a real shadow for a moving crowd. */
export const blobGeometry = new CircleGeometry(0.34, 10).rotateX(-Math.PI / 2);
export const blobMaterial = new MeshBasicMaterial({ color: 0x2e3b22, transparent: true, opacity: 0.22, depthWrite: false });
export const BLOB_Y = 0.1;

const one = (build: (b: Builder) => void): BufferGeometry => {
  const b = new Builder();
  build(b);
  return b.geometry();
};

/**
 * Crowd body parts: the same shapes as the detailed character with fewer triangles.
 * They are white where the look's colour applies; the colour arrives per character.
 */
const PARTS = {
  pelvis: () => one((b) => b.add(new BoxGeometry(0.4, 0.2, 0.28), WHITE, { p: [0, 0.04, 0] })),
  torso: () => one((b) => b.add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 1, 0.13), WHITE, { p: [0, 0.31, 0] })),
  head: () =>
    one((b) => {
      b.add(new SphereGeometry(0.3, 8, 6), WHITE, { p: [0, 0.27, 0], s: [1, 0.93, 0.96] });
      for (const side of [1, -1]) {
        b.add(new SphereGeometry(0.036, 4, 2), C.ink, { p: [side * 0.105, 0.27, 0.272], s: [1, 1.25, 0.5] });
      }
    }),
  hair: () =>
    one((b) => {
      b.add(new SphereGeometry(0.318, 8, 4, 0, Math.PI * 2, 0, 1.75), WHITE, { p: [0, 0.275, 0], r: [-0.5, 0, 0], s: [1, 0.95, 0.98] });
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
/** Parts that exist twice per character (left and right). */
const PAIRED: Record<PartName, boolean> = {
  pelvis: false, torso: false, head: false, hair: false, sleeve: true, hand: true, leg: true, shoe: true,
};

interface Batch {
  mesh: InstancedMesh;
  matrices: Float32Array;
  colors: Float32Array;
  tint: number;
}

const Y_AXIS = new Vector3(0, 1, 0);
const UNIT = new Vector3(1, 1, 1);

/**
 * Every other character on screen. Each body part is one batch for the whole crowd,
 * so 200 people cost about ten draw calls. Only characters in view are posed and drawn.
 */
export class Crowd {
  readonly group = new Group();
  /** How many characters exist. */
  count = 150;
  /** Characters farther than this from the point of interest are skipped (quality control). */
  range = Infinity;
  /** How many were drawn last frame. */
  visible = 0;

  /** Characters drawn elsewhere (the player) that the crowd should step around. */
  guests: Walker[] = [];

  private walkers: Walker[] = [];
  /** Five colours per character (skin, hair, top, bottom, shoes), linear RGB. */
  private looks = new Float32Array(CROWD_MAX * 15);
  private batches = {} as Record<PartName, Batch>;
  private blobs: InstancedMesh;

  private pose = createPose();
  private frustum = new Frustum();
  private sphere = new Sphere(new Vector3(), 1.1);
  private proj = new Matrix4();
  private root = new Matrix4();
  private pelvis = new Matrix4();
  private torso = new Matrix4();
  private bone = new Matrix4();
  private local = new Matrix4();
  private v = new Vector3();
  private s = new Vector3();
  private q = new Quaternion();
  private e = new Euler();

  constructor() {
    const rnd = seededRandom(1234);
    const pick = (list: readonly number[]) => list[Math.floor(rnd() * list.length)];
    const color = new Color();
    for (let i = 0; i < CROWD_MAX; i++) {
      this.walkers.push(new Walker(rnd));
      [pick(SKINS), pick(HAIRS), pick(TOPS), pick(BOTTOMS), pick(SHOES)].forEach((hex, k) => {
        color.set(hex).toArray(this.looks, i * 15 + k * 3);
      });
    }

    for (const name of Object.keys(PARTS) as PartName[]) {
      const capacity = CROWD_MAX * (PAIRED[name] ? 2 : 1);
      const mesh = new InstancedMesh(PARTS[name](), smoothMaterial, capacity);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      mesh.instanceColor.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false; // culling is done per character below
      this.batches[name] = {
        mesh,
        matrices: mesh.instanceMatrix.array as Float32Array,
        colors: mesh.instanceColor.array as Float32Array,
        tint: TINT[name],
      };
      this.group.add(mesh);
    }

    this.blobs = new InstancedMesh(blobGeometry, blobMaterial, CROWD_MAX);
    this.blobs.instanceMatrix.setUsage(DynamicDrawUsage);
    this.blobs.frustumCulled = false;
    this.group.add(this.blobs);
  }

  /** Moves everyone, then poses and uploads only the characters the camera can see. */
  update(dt: number, camera: Camera, focus: Vector3): void {
    camera.updateMatrixWorld();
    this.proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.proj);
    const range2 = this.range * this.range;

    for (let i = 0; i < this.count; i++) this.walkers[i].update(dt);
    this.separate(dt);

    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const w = this.walkers[i];
      const dx = w.x - focus.x;
      const dz = w.z - focus.z;
      if (dx * dx + dz * dz > range2) continue;
      this.sphere.center.set(w.x, 0.8, w.z);
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      this.write(n++, i, w);
    }
    this.visible = n;

    for (const name of Object.keys(this.batches) as PartName[]) {
      const { mesh } = this.batches[name];
      mesh.count = n * (PAIRED[name] ? 2 : 1);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  /**
   * Keeps people from walking through each other: anyone closer than a body width
   * is eased apart. Characters in `guests` (the player) push others but are not moved.
   */
  private separate(dt: number): void {
    const gap = 0.62;
    const push = Math.min(1, dt * 5);
    const all = this.walkers;
    const total = this.count + this.guests.length;
    for (let a = 0; a < total; a++) {
      const wa = a < this.count ? all[a] : this.guests[a - this.count];
      for (let b = 0; b < Math.min(a, this.count); b++) {
        const wb = all[b];
        const dx = wb.x - wa.x;
        if (dx > gap || dx < -gap) continue;
        const dz = wb.z - wa.z;
        if (dz > gap || dz < -gap) continue;
        const d = Math.hypot(dx, dz);
        if (d >= gap) continue;
        // Standing exactly on top of each other gives no direction; pick one from the indices.
        const nx = d > 0.001 ? dx / d : Math.cos(a + b);
        const nz = d > 0.001 ? dz / d : Math.sin(a + b);
        const move = (gap - d) * push;
        if (a < this.count) {
          wa.x -= nx * move * 0.5;
          wa.z -= nz * move * 0.5;
          wb.x += nx * move * 0.5;
          wb.z += nz * move * 0.5;
        } else {
          wb.x += nx * move;
          wb.z += nz * move;
        }
      }
    }
  }

  private put(name: PartName, slot: number, character: number, matrix: Matrix4): void {
    const batch = this.batches[name];
    matrix.toArray(batch.matrices, slot * 16);
    const from = character * 15 + batch.tint * 3;
    const to = slot * 3;
    batch.colors[to] = this.looks[from];
    batch.colors[to + 1] = this.looks[from + 1];
    batch.colors[to + 2] = this.looks[from + 2];
  }

  /** Works out one character's joints for this frame and writes them into slot `n` of every batch. */
  private write(n: number, i: number, w: Walker): void {
    const p = computePose(this.pose, w.phase, w.time, w.walk, w.wave);
    const { root, pelvis, torso, bone, local, v, s, q, e } = this;

    root.compose(v.set(w.x, 0, w.z), q.setFromAxisAngle(Y_AXIS, w.yaw), s.setScalar(w.scale));

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

    // Ground blob: flat, at the feet.
    const blob = this.blobs.instanceMatrix.array;
    const o = n * 16;
    blob.fill(0, o, o + 16);
    blob[o] = blob[o + 5] = blob[o + 10] = w.scale;
    blob[o + 12] = w.x;
    blob[o + 13] = BLOB_Y;
    blob[o + 14] = w.z;
    blob[o + 15] = 1;
  }
}

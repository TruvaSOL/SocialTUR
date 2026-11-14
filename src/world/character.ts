import { CapsuleGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, smoothMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';

/** The swappable parts of a character. Each maps to one palette colour for now. */
export interface Look {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  shoes: number;
}

export const DEFAULT_LOOK: Look = {
  skin: C.skinLight,
  hair: C.hairBrown,
  top: C.clothMustard,
  bottom: C.clothNavy,
  shoes: C.shoe,
};

const HIP_Y = 0.42;
/** Ground covered by one full walk cycle, matched to the leg swing so feet do not slide. */
const STRIDE = 0.92;

function part(build: (b: Builder) => void): Mesh {
  const b = new Builder();
  build(b);
  return b.mesh(smoothMaterial);
}

/**
 * One skeleton for every character: pelvis -> torso -> head and arms, plus two legs.
 * Limbs are rigid pieces on joints, which is cheap enough to draw crowds of them.
 */
export class Character {
  readonly root = new Group();
  /** 0 = standing, 1 = full walk. Callers set this; the pose blends smoothly. */
  walkAmount = 1;
  /** 0..1, raises the right arm and waves. */
  waveAmount = 0;

  private pelvis = new Group();
  private torso = new Group();
  private head = new Group();
  private armL = new Group();
  private armR = new Group();
  private legL = new Group();
  private legR = new Group();
  private phase = 0;
  private time = 0;

  constructor(look: Look = DEFAULT_LOOK) {
    this.pelvis.position.y = HIP_Y;
    this.root.add(this.pelvis);

    this.pelvis.add(part((b) => b.add(new RoundedBoxGeometry(0.4, 0.2, 0.28, 1, 0.09), look.bottom, { p: [0, 0.04, 0] })));

    this.pelvis.add(this.torso);
    this.torso.add(part((b) => b.add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 2, 0.13), look.top, { p: [0, 0.31, 0] })));

    for (const [leg, side] of [
      [this.legL, 1],
      [this.legR, -1],
    ] as const) {
      leg.position.set(side * 0.1, 0, 0);
      leg.add(
        part((b) => {
          b.add(new CapsuleGeometry(0.085, 0.2, 3, 8), look.bottom, { p: [0, -0.17, 0] });
          b.add(new RoundedBoxGeometry(0.18, 0.12, 0.28, 1, 0.05), look.shoes, { p: [0, -0.36, 0.04] });
        }),
      );
      this.pelvis.add(leg);
    }

    for (const [arm, side] of [
      [this.armL, 1],
      [this.armR, -1],
    ] as const) {
      arm.position.set(side * 0.25, 0.44, 0);
      arm.add(
        part((b) => {
          b.add(new CapsuleGeometry(0.07, 0.1, 3, 8), look.top, { p: [0, -0.08, 0] });
          b.add(new CapsuleGeometry(0.06, 0.1, 3, 8), look.skin, { p: [0, -0.22, 0] });
          b.add(new SphereGeometry(0.075, 8, 6), look.skin, { p: [0, -0.33, 0] });
        }),
      );
      this.torso.add(arm);
    }

    this.head.position.y = 0.5;
    this.head.add(
      part((b) => {
        b.add(new SphereGeometry(0.3, 16, 12), look.skin, { p: [0, 0.27, 0], s: [1, 0.93, 0.96] });
        // Hair: a cap tilted back so the fringe sits above the eyes and covers the neck.
        b.add(new SphereGeometry(0.318, 16, 8, 0, Math.PI * 2, 0, 1.75), look.hair, {
          p: [0, 0.275, 0],
          r: [-0.5, 0, 0],
          s: [1, 0.95, 0.98],
        });
        b.add(new SphereGeometry(0.1, 8, 6), look.hair, { p: [0.04, 0.585, 0.02] });
        for (const side of [1, -1]) {
          b.add(new SphereGeometry(0.036, 6, 4), C.ink, { p: [side * 0.105, 0.27, 0.272], s: [1, 1.25, 0.5] });
          b.add(new SphereGeometry(0.045, 6, 4), C.blush, { p: [side * 0.175, 0.2, 0.222], s: [1, 0.7, 0.3] });
        }
        b.add(new TorusGeometry(0.035, 0.011, 6, 10, Math.PI), C.mouth, { p: [0, 0.19, 0.276], r: [0, 0, Math.PI] });
      }),
    );
    this.torso.add(this.head);
  }

  /** Metres per second at full walk. */
  get speed(): number {
    return 1.25 * this.walkAmount;
  }

  update(dt: number): void {
    this.time += dt;
    this.phase += (this.speed / STRIDE) * Math.PI * 2 * dt;
    const w = this.walkAmount;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const breath = Math.sin(this.time * 2.2);

    // Legs: swing from the hip; the leg moving forward lifts so the foot clears the ground.
    const swing = 0.6 * w;
    this.legL.rotation.x = -s * swing;
    this.legR.rotation.x = s * swing;
    this.legL.position.y = Math.max(0, c) * 0.07 * w;
    this.legR.position.y = Math.max(0, -c) * 0.07 * w;

    // Weight: the body drops as both feet land, rises as one leg passes the other,
    // and shifts sideways over the leg that is carrying it.
    this.pelvis.position.y = HIP_Y + (0.03 * Math.cos(this.phase * 2) - 0.012) * w + breath * 0.004 * (1 - w);
    this.pelvis.position.x = -c * 0.022 * w;
    this.pelvis.rotation.z = c * 0.045 * w;
    this.pelvis.rotation.x = 0.07 * w;
    this.pelvis.rotation.y = -s * 0.1 * w;

    // Shoulders counter the hips; the head stays level and lags the bounce slightly.
    this.torso.rotation.y = s * 0.22 * w;
    this.torso.scale.y = 1 + breath * 0.012 * (1 - w);
    this.head.rotation.y = -s * 0.12 * w;
    this.head.rotation.x = 0.045 * Math.cos(this.phase * 2 - 0.7) * w;
    this.head.rotation.z = -c * 0.03 * w + Math.sin(this.time * 1.3) * 0.03 * (1 - w);

    // Arms swing opposite to the legs.
    const armSwing = 0.55 * w;
    this.armL.rotation.set(s * armSwing, 0, 0.12);
    const wave = this.waveAmount;
    this.armR.rotation.set(
      -s * armSwing * (1 - wave),
      0,
      -0.12 - wave * (2.35 + Math.sin(this.time * 11) * 0.32),
    );
  }
}

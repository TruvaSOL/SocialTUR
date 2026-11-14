import { CapsuleGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, smoothMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { RIG, type Pose } from './pose';

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
  private pelvis = new Group();
  private torso = new Group();
  private head = new Group();
  private armL = new Group();
  private armR = new Group();
  private legL = new Group();
  private legR = new Group();

  constructor(look: Look = DEFAULT_LOOK) {
    this.pelvis.position.y = RIG.hipY;
    this.root.add(this.pelvis);

    this.pelvis.add(part((b) => b.add(new RoundedBoxGeometry(0.4, 0.2, 0.28, 1, 0.09), look.bottom, { p: [0, 0.04, 0] })));

    this.pelvis.add(this.torso);
    this.torso.add(part((b) => b.add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 2, 0.13), look.top, { p: [0, 0.31, 0] })));

    for (const [leg, side] of [
      [this.legL, 1],
      [this.legR, -1],
    ] as const) {
      leg.position.set(side * RIG.legX, 0, 0);
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
      arm.position.set(side * RIG.armX, RIG.armY, 0);
      arm.add(
        part((b) => {
          b.add(new CapsuleGeometry(0.07, 0.1, 3, 8), look.top, { p: [0, -0.08, 0] });
          b.add(new CapsuleGeometry(0.06, 0.1, 3, 8), look.skin, { p: [0, -0.22, 0] });
          b.add(new SphereGeometry(0.075, 8, 6), look.skin, { p: [0, -0.33, 0] });
        }),
      );
      this.torso.add(arm);
    }

    this.head.position.y = RIG.headY;
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

  /** Puts the body in the given pose. */
  applyPose(p: Pose): void {
    this.legL.rotation.x = p.legL;
    this.legR.rotation.x = p.legR;
    this.legL.position.y = p.liftL;
    this.legR.position.y = p.liftR;
    this.pelvis.position.set(p.pelvisX, p.pelvisY, 0);
    this.pelvis.rotation.set(p.pelvisRX, p.pelvisRY, p.pelvisRZ);
    this.torso.rotation.y = p.torsoRY;
    this.torso.scale.y = p.torsoSY;
    this.head.rotation.set(p.headRX, p.headRY, p.headRZ);
    this.armL.rotation.set(p.armLX, 0, p.armLZ);
    this.armR.rotation.set(p.armRX, 0, p.armRZ);
  }
}
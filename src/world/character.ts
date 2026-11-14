import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, smoothMaterial } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { BOTTOMS, DEFAULT_LOOK, HAIRS, type Look, SHOES, SKINS, TOPS } from './looks';
import { RIG, type Pose } from './pose';

function part(build: (b: Builder) => void): Mesh {
  const b = new Builder();
  build(b);
  const mesh = b.mesh(smoothMaterial);
  // Moving things use a ground blob instead of the real shadow, which is drawn only once.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * One skeleton for every character: pelvis -> torso -> head and arms, plus two legs.
 * Limbs are rigid pieces on joints, which is cheap enough to draw crowds of them.
 * The joints stay; `setLook` swaps the pieces hanging on them.
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
  private parts: Mesh[] = [];

  constructor(look: Look = DEFAULT_LOOK) {
    this.pelvis.position.y = RIG.hipY;
    this.root.add(this.pelvis);
    this.pelvis.add(this.torso, this.legL, this.legR);
    this.legL.position.set(RIG.legX, 0, 0);
    this.legR.position.set(-RIG.legX, 0, 0);
    this.torso.add(this.armL, this.armR, this.head);
    this.armL.position.set(RIG.armX, RIG.armY, 0);
    this.armR.position.set(-RIG.armX, RIG.armY, 0);
    this.head.position.y = RIG.headY;
    this.setLook(look);
  }

  /** Rebuilds the body pieces for a new look. Cheap enough to call on every tap in the editor. */
  setLook(look: Look): void {
    for (const mesh of this.parts) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.parts = [];
    const skin = SKINS[look.skin];
    const hair = HAIRS[look.hair];
    const top = TOPS[look.top];
    const bottom = BOTTOMS[look.bottom];
    const shoes = SHOES[look.shoes];
    const attach = (joint: Group, build: (b: Builder) => void) => {
      const mesh = part(build);
      this.parts.push(mesh);
      joint.add(mesh);
    };

    attach(this.pelvis, (b) => b.add(new RoundedBoxGeometry(0.4, 0.2, 0.28, 1, 0.09), bottom, { p: [0, 0.04, 0] }));
    attach(this.torso, (b) => b.add(new RoundedBoxGeometry(0.42, 0.42, 0.3, 2, 0.13), top, { p: [0, 0.31, 0] }));

    for (const leg of [this.legL, this.legR]) {
      attach(leg, (b) => {
        b.add(new CapsuleGeometry(0.085, 0.2, 3, 8), bottom, { p: [0, -0.17, 0] });
        b.add(new RoundedBoxGeometry(0.18, 0.12, 0.28, 1, 0.05), shoes, { p: [0, -0.36, 0.04] });
      });
    }
    for (const arm of [this.armL, this.armR]) {
      attach(arm, (b) => {
        b.add(new CapsuleGeometry(0.07, 0.1, 3, 8), top, { p: [0, -0.08, 0] });
        b.add(new CapsuleGeometry(0.06, 0.1, 3, 8), skin, { p: [0, -0.22, 0] });
        b.add(new SphereGeometry(0.075, 8, 6), skin, { p: [0, -0.33, 0] });
      });
    }

    attach(this.head, (b) => {
      b.add(new SphereGeometry(0.3, 16, 12), skin, { p: [0, 0.27, 0], s: [1, 0.93, 0.96] });
      // Hair: a cap tilted back so the fringe sits above the eyes and covers the neck.
      b.add(new SphereGeometry(0.318, 16, 8, 0, Math.PI * 2, 0, 1.75), hair, {
        p: [0, 0.275, 0],
        r: [-0.5, 0, 0],
        s: [1, 0.95, 0.98],
      });
      if (look.hairStyle === 0) {
        b.add(new SphereGeometry(0.1, 8, 6), hair, { p: [0.04, 0.585, 0.02] }); // bun
      } else if (look.hairStyle === 2) {
        // Long: hair falls behind the head to the shoulders.
        b.add(new RoundedBoxGeometry(0.56, 0.5, 0.2, 1, 0.09), hair, { p: [0, 0.06, -0.2] });
      }
      for (const side of [1, -1]) {
        b.add(new SphereGeometry(0.036, 6, 4), C.ink, { p: [side * 0.105, 0.27, 0.272], s: [1, 1.25, 0.5] });
        b.add(new SphereGeometry(0.045, 6, 4), C.blush, { p: [side * 0.175, 0.2, 0.222], s: [1, 0.7, 0.3] });
      }
      b.add(new TorusGeometry(0.035, 0.011, 6, 10, Math.PI), C.mouth, { p: [0, 0.19, 0.276], r: [0, 0, Math.PI] });

      if (look.accessory === 1) {
        // Cap: a shallow dome and a brim over the eyes.
        b.add(new SphereGeometry(0.325, 12, 6, 0, Math.PI * 2, 0, 1.25), C.coral, { p: [0, 0.3, 0], s: [1, 0.9, 1] });
        b.add(new CylinderGeometry(0.2, 0.2, 0.03, 10), C.coral, { p: [0, 0.4, 0.3], s: [1, 1, 0.9] });
      } else if (look.accessory === 2) {
        // Glasses: two dark frames and a bridge.
        for (const side of [1, -1]) {
          b.add(new BoxGeometry(0.15, 0.11, 0.03), C.ink, { p: [side * 0.105, 0.275, 0.292] });
          b.add(new BoxGeometry(0.11, 0.07, 0.035), C.glass, { p: [side * 0.105, 0.275, 0.295] });
        }
        b.add(new BoxGeometry(0.07, 0.025, 0.03), C.ink, { p: [0, 0.285, 0.292] });
      }
    });
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

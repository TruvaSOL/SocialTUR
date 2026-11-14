/** Joint positions shared by every character, detailed or crowd. Units are metres. */
export const RIG = {
  hipY: 0.42,
  legX: 0.1,
  armX: 0.25,
  armY: 0.44,
  headY: 0.5,
  /** Ground covered by one full walk cycle, matched to the leg swing so feet do not slide. */
  stride: 0.92,
  /** Metres per second at full walk for a character of scale 1. */
  speed: 1.25,
} as const;

/** Every joint value of one animation frame. Angles are radians. */
export interface Pose {
  legL: number;
  legR: number;
  liftL: number;
  liftR: number;
  pelvisX: number;
  pelvisY: number;
  pelvisRX: number;
  pelvisRY: number;
  pelvisRZ: number;
  torsoRY: number;
  torsoSY: number;
  headRX: number;
  headRY: number;
  headRZ: number;
  armLX: number;
  armLZ: number;
  armRX: number;
  armRZ: number;
}

export function createPose(): Pose {
  return {
    legL: 0, legR: 0, liftL: 0, liftR: 0,
    pelvisX: 0, pelvisY: RIG.hipY, pelvisRX: 0, pelvisRY: 0, pelvisRZ: 0,
    torsoRY: 0, torsoSY: 1,
    headRX: 0, headRY: 0, headRZ: 0,
    armLX: 0, armLZ: 0.12, armRX: 0, armRZ: -0.12,
  };
}

/**
 * The one walk in the game. `phase` advances with distance walked, `time` with the clock,
 * `walk` blends standing (0) to walking (1), `wave` raises the right arm (0..1).
 */
export function computePose(out: Pose, phase: number, time: number, walk: number, wave: number): Pose {
  const w = walk;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const breath = Math.sin(time * 2.2);

  // Legs: swing from the hip; the leg moving forward lifts so the foot clears the ground.
  const swing = 0.6 * w;
  out.legL = -s * swing;
  out.legR = s * swing;
  out.liftL = Math.max(0, c) * 0.07 * w;
  out.liftR = Math.max(0, -c) * 0.07 * w;

  // Weight: the body drops as both feet land, rises as one leg passes the other,
  // and shifts sideways over the leg that is carrying it.
  out.pelvisY = RIG.hipY + (0.03 * Math.cos(phase * 2) - 0.012) * w + breath * 0.004 * (1 - w);
  out.pelvisX = -c * 0.022 * w;
  out.pelvisRZ = c * 0.045 * w;
  out.pelvisRX = 0.07 * w;
  out.pelvisRY = -s * 0.1 * w;

  // Shoulders counter the hips; the head stays level and lags the bounce slightly.
  out.torsoRY = s * 0.22 * w;
  out.torsoSY = 1 + breath * 0.012 * (1 - w);
  out.headRY = -s * 0.12 * w;
  out.headRX = 0.045 * Math.cos(phase * 2 - 0.7) * w;
  out.headRZ = -c * 0.03 * w + Math.sin(time * 1.3) * 0.03 * (1 - w);

  // Arms swing opposite to the legs; a wave takes over the right arm.
  const armSwing = 0.55 * w;
  out.armLX = s * armSwing;
  out.armLZ = 0.12;
  out.armRX = -s * armSwing * (1 - wave);
  out.armRZ = -0.12 - wave * (2.35 + Math.sin(time * 11) * 0.32);
  return out;
}

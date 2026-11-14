import { nodePos } from './district';
import { RIG } from './pose';

const STOP_SECONDS = 3.4;
const LAST = 4; // street crossings are numbered 0..4 in each direction

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export interface WalkerOptions {
  /** Body size; stride length follows it so feet do not slide. */
  scale?: number;
  /** Step rate multiplier. */
  cadence?: number;
  /** How far to the right of the street's centre line this walker keeps. */
  lane?: number;
}

/**
 * Stand-in for a real player until the server exists: strolls the street grid,
 * keeps to the right, picks a random turn at each crossing, and now and then stops to wave.
 */
export class Walker {
  x = 0;
  z = 0;
  yaw = 0;
  /** 0 = standing, 1 = full walk. */
  walk = 1;
  /** 0..1, raises the right arm and waves. */
  wave = 0;
  phase: number;
  time: number;
  readonly scale: number;

  private cadence: number;
  private lane: number;
  private fromI: number;
  private fromJ: number;
  private toI = 0;
  private toJ = 0;
  private targetX = 0;
  private targetZ = 0;
  private untilStop: number;
  private stopClock = 0;

  constructor(
    private rnd: () => number,
    options: WalkerOptions = {},
  ) {
    this.scale = options.scale ?? 0.9 + rnd() * 0.18;
    this.cadence = options.cadence ?? 0.92 + rnd() * 0.2;
    this.lane = options.lane ?? 1.3 + rnd() * 0.8;
    this.phase = rnd() * Math.PI * 2;
    this.time = rnd() * 10;
    this.untilStop = 6 + rnd() * 45;

    // Start somewhere along a random street.
    this.fromI = Math.floor(rnd() * (LAST + 1));
    this.fromJ = Math.floor(rnd() * (LAST + 1));
    this.pickNext(-1, -1);
    const a = nodePos(this.fromI, this.fromJ);
    const dx = this.toI - this.fromI;
    const dz = this.toJ - this.fromJ;
    const along = 2 + rnd() * 18;
    this.x = a.x + -dz * this.lane + dx * along;
    this.z = a.z + dx * this.lane + dz * along;
    this.yaw = Math.atan2(dx, dz);
  }

  /** Chooses the next crossing, avoiding a U-turn unless it is a dead end, and aims at it. */
  private pickNext(prevI: number, prevJ: number): void {
    const options: [number, number][] = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = this.fromI + di;
      const j = this.fromJ + dj;
      if (i < 0 || j < 0 || i > LAST || j > LAST) continue;
      if (i === prevI && j === prevJ) continue;
      options.push([i, j]);
    }
    const [i, j] = options.length ? options[Math.floor(this.rnd() * options.length)] : [prevI, prevJ];
    this.toI = i;
    this.toJ = j;
    // Aim at a point on the right-hand lane, just short of the crossing, so corners are cut naturally.
    const b = nodePos(i, j);
    const dx = i - this.fromI;
    const dz = j - this.fromJ;
    this.targetX = b.x + (-dz - dx) * this.lane;
    this.targetZ = b.z + (dx - dz) * this.lane;
  }

  update(dt: number): void {
    this.time += dt;

    // Now and then: ease to a stop, wave, walk on.
    this.untilStop -= dt;
    if (this.untilStop <= 0) {
      const t = (this.stopClock += dt);
      const stopped = smooth(t / 0.45) * (1 - smooth((t - (STOP_SECONDS - 0.45)) / 0.45));
      this.walk = 1 - stopped;
      this.wave = smooth((t - 0.7) / 0.3) * (1 - smooth((t - 2.4) / 0.3));
      if (t >= STOP_SECONDS) {
        this.untilStop = 15 + this.rnd() * 45;
        this.stopClock = 0;
        this.walk = 1;
        this.wave = 0;
      }
    }

    let dx = this.targetX - this.x;
    let dz = this.targetZ - this.z;
    let dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      const prevI = this.fromI;
      const prevJ = this.fromJ;
      this.fromI = this.toI;
      this.fromJ = this.toJ;
      this.pickNext(prevI, prevJ);
      dx = this.targetX - this.x;
      dz = this.targetZ - this.z;
      dist = Math.hypot(dx, dz);
    }

    const pace = this.cadence * this.walk;
    const stepLength = RIG.speed * this.scale * pace * dt;
    this.x += (dx / dist) * stepLength;
    this.z += (dz / dist) * stepLength;
    this.phase += pace * (RIG.speed / RIG.stride) * Math.PI * 2 * dt;

    // Turn towards the direction of travel, the shortest way round.
    let turn = Math.atan2(dx, dz) - this.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.yaw += turn * Math.min(1, dt * 6) * this.walk;
  }
}

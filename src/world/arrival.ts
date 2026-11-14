import type { Mesh } from 'three';
import { FERRY_BERTH, FERRY_DECK } from './landmarks';
import { RIG } from './pose';

export type ArrivalPhase = 'waiting' | 'sailing' | 'walking' | 'greeting' | 'done';

/** How far out to sea the ferry waits while the newcomer makes their character. */
const OFFSHORE = 78;
const SAIL_SECONDS = 9;
const GREET_SECONDS = 4.2;
const WALK_SPEED = 1.5;
/** Height of the pier deck, and where the ramp down to the road begins and ends (x). */
const PIER_TOP = 0.3;
const RAMP_FROM = 71.6;
const RAMP_TO = 70.4;
/** The way off the boat: across to the pier, along it, down to the road. */
const ROUTE: [number, number][] = [
  [FERRY_BERTH.x - FERRY_DECK.z, 1.5],
  [72.5, 1.5],
  [69.5, 1.6],
];

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * A newcomer's first minute: they wait on the ferry out at sea (this is where the
 * character editor shows them), the ferry sails in, they walk down the pier,
 * stop where the road begins and wave. After that the game takes over.
 */
export class Arrival {
  phase: ArrivalPhase = 'done';
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  walk = 0;
  wave = 0;
  /** Walk-cycle position and clock, for the pose. */
  cycle = 0;
  time = 0;

  private clock = 0;
  private leg = 0;

  constructor(private ferry: Mesh) {
    this.moor();
  }

  /** Ferry at its berth, nobody aboard. */
  private moor(): void {
    this.ferry.position.x = FERRY_BERTH.x;
    this.ferry.position.z = FERRY_BERTH.z;
  }

  /** Puts the ferry out at sea with the newcomer at the bow, looking towards the island (and the editor camera). */
  wait(): void {
    this.phase = 'waiting';
    this.ferry.position.x = FERRY_BERTH.x + OFFSHORE;
    this.yaw = -Math.PI / 2;
    this.walk = 0;
    this.wave = 0;
    this.onDeck();
  }

  sail(): void {
    this.phase = 'sailing';
    this.clock = 0;
  }

  private onDeck(): void {
    // The bow points towards the island, so the fore deck is on the -x side.
    this.x = this.ferry.position.x - FERRY_DECK.z;
    this.z = this.ferry.position.z;
    this.y = this.ferry.position.y + FERRY_DECK.y;
  }

  private turnTo(target: number, dt: number): void {
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 5);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'done') return;
    if (this.phase === 'waiting') {
      this.onDeck();
      return;
    }
    this.clock += dt;

    if (this.phase === 'sailing') {
      const t = Math.min(1, this.clock / SAIL_SECONDS);
      const eased = 1 - (1 - t) ** 3; // fast at sea, gentle at the berth
      this.ferry.position.x = FERRY_BERTH.x + OFFSHORE * (1 - eased);
      this.onDeck();
      this.turnTo(-Math.PI / 2, dt); // turn to look at the island
      if (t >= 1) {
        this.phase = 'walking';
        this.leg = 0;
      }
      return;
    }

    if (this.phase === 'walking') {
      const [tx, tz] = ROUTE[this.leg];
      const dx = tx - this.x;
      const dz = tz - this.z;
      const dist = Math.hypot(dx, dz);
      this.walk = Math.min(1, this.walk + dt * 3);
      const stepLength = WALK_SPEED * this.walk * dt;
      if (dist <= stepLength + 0.05) {
        if (++this.leg >= ROUTE.length) {
          this.phase = 'greeting';
          this.clock = 0;
        }
      } else {
        this.x += (dx / dist) * stepLength;
        this.z += (dz / dist) * stepLength;
        this.turnTo(Math.atan2(dx, dz), dt);
      }
      this.cycle += (WALK_SPEED / RIG.stride) * Math.PI * 2 * this.walk * dt;
      // Height: boat deck, then the pier, then the ramp down to the road.
      const ramp = smooth((this.x - RAMP_TO) / (RAMP_FROM - RAMP_TO));
      const target = this.leg === 0 ? Math.max(PIER_TOP, this.y - dt) : PIER_TOP * ramp;
      this.y += (target - this.y) * Math.min(1, dt * 10);
      return;
    }

    // Greeting: ease to a stop, wave to the town, then hand over.
    this.walk = Math.max(0, this.walk - dt * 3);
    this.wave = smooth((this.clock - 0.5) / 0.3) * (1 - smooth((this.clock - 3.4) / 0.4));
    this.y += (0 - this.y) * Math.min(1, dt * 10);
    if (this.clock >= GREET_SECONDS) {
      this.phase = 'done';
      this.wave = 0;
    }
  }
}

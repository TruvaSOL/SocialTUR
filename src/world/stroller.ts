import type { Camera } from 'three';
import { Character } from './character';
import { pathPoint, pathTangent } from './layout';

const WALK_SECONDS = 11;
const STOP_SECONDS = 3.4;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Stage 1 demo behaviour: walk the loop, and every so often stop,
 * turn to the camera and wave. It shows walking, stopping, idling and waving.
 */
export class Stroller {
  private theta = 2.2;
  private clock = 0;
  private yaw = 0;

  constructor(readonly character: Character) {
    this.place();
  }

  private place(): void {
    const p = pathPoint(this.theta);
    this.character.root.position.set(p.x, 0, p.z);
  }

  update(dt: number, camera: Camera): void {
    this.clock = (this.clock + dt) % (WALK_SECONDS + STOP_SECONDS);
    const stopT = this.clock - WALK_SECONDS; // negative while walking
    const ch = this.character;

    // Ease out of the walk, hold, ease back in.
    const stopped = smooth(stopT / 0.45) * (1 - smooth((stopT - (STOP_SECONDS - 0.45)) / 0.45));
    ch.walkAmount = stopT < 0 ? 1 : 1 - stopped;
    ch.waveAmount = stopT < 0 ? 0 : smooth((stopT - 0.7) / 0.3) * (1 - smooth((stopT - 2.4) / 0.3));

    const tangent = pathTangent(this.theta);
    this.theta += (ch.speed * dt) / Math.hypot(tangent.x, tangent.z);
    this.place();

    // Face along the path while walking, towards the viewer while stopped.
    const pathYaw = Math.atan2(tangent.x, tangent.z);
    const pos = ch.root.position;
    const cameraYaw = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
    const facing = stopT > 0.3 && stopT < STOP_SECONDS - 0.6 ? cameraYaw : pathYaw;
    let delta = facing - this.yaw;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // shortest way round
    this.yaw += delta * Math.min(1, dt * 7);
    ch.root.rotation.y = this.yaw;

    ch.update(dt);
  }
}

import type { Stage } from './stage';

interface Step {
  /** Fraction of the device's base pixel ratio. */
  pixel: number;
  shadow: boolean;
  /** Most fans drawn as full 3D characters near the camera; the rest are flat cut-outs. */
  near3d: number;
}

/** From best to cheapest: resolution goes first, then the shadow, then the nearby 3D fans. */
const STEPS: Step[] = [
  { pixel: 1, shadow: true, near3d: 140 },
  { pixel: 0.85, shadow: true, near3d: 120 },
  { pixel: 0.7, shadow: true, near3d: 100 },
  { pixel: 0.7, shadow: false, near3d: 70 },
  { pixel: 0.55, shadow: false, near3d: 40 },
  { pixel: 0.55, shadow: false, near3d: 0 },
];
const WINDOW_SECONDS = 1.5;
const WARMUP_SECONDS = 3;

/**
 * Measures the frame rate and trades quality for speed when the device
 * cannot hold 30 fps, and gives it back when there is headroom.
 */
export class AutoQuality {
  fps = 0;
  step = 0;

  private frames = 0;
  private elapsed = 0;
  private age = 0;
  private goodWindows = 0;

  constructor(private stage: Stage) {}

  private locked = false;

  get label(): string {
    return `${this.step + 1}/${STEPS.length}${this.locked ? ' *' : ''}`;
  }

  /** Measurement aid: hold one quality step (1 = best) so the raw frame rate can be read. */
  lock(oneBased: number): void {
    this.locked = true;
    this.apply(Math.min(STEPS.length, Math.max(1, Math.round(oneBased))) - 1);
  }

  get near3d(): number {
    return STEPS[this.step].near3d;
  }

  frame(dt: number): void {
    // Skip stalls (tab hidden, page loading); they say nothing about the device.
    if (document.hidden || dt > 0.25) return;
    this.age += dt;
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < WINDOW_SECONDS) return;

    this.fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (this.age < WARMUP_SECONDS || this.locked) return;

    if (this.fps < 27 && this.step < STEPS.length - 1) {
      this.goodWindows = 0;
      this.apply(this.step + 1);
    } else if (this.fps > 55 && this.step > 0) {
      // Wait for several good windows in a row before stepping back up, to avoid flip-flopping.
      if (++this.goodWindows >= 5) {
        this.goodWindows = 0;
        this.apply(this.step - 1);
      }
    } else {
      this.goodWindows = 0;
    }
  }

  private apply(step: number): void {
    this.step = step;
    const { renderer, basePixelRatio } = this.stage;
    renderer.setPixelRatio(basePixelRatio * STEPS[step].pixel);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.stage.setShadows(STEPS[step].shadow);
  }
}

import type { Stage } from './stage';

/** Resolution steps, as a fraction of the device's base pixel ratio. The last step also drops the shadow. */
const STEPS = [1, 0.85, 0.7, 0.55];
const WINDOW_SECONDS = 1.5;
const WARMUP_SECONDS = 3;

/**
 * Measures the frame rate and trades resolution (then the shadow) for speed
 * when the device cannot hold 30 fps, and gives it back when there is headroom.
 */
export class AutoQuality {
  fps = 0;
  step = 0;

  private frames = 0;
  private elapsed = 0;
  private age = 0;
  private goodWindows = 0;

  constructor(private stage: Stage) {}

  get label(): string {
    return `${this.step + 1}/${STEPS.length}`;
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
    if (this.age < WARMUP_SECONDS) return;

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
    const { renderer, sun, basePixelRatio } = this.stage;
    renderer.setPixelRatio(basePixelRatio * STEPS[step]);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    sun.castShadow = step < STEPS.length - 1;
  }
}

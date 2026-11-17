import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { type TextKey, t } from '../i18n';
import { SEATS } from '../stadium/layout';

/**
 * Advert mode (`?reklam`): plays a fixed sequence of camera moves, fills the stands and shows
 * captions, so a screen recording of it is a finished clip to put a voice-over on.
 * Nothing is sent to the server; the crowd is the made-up preview crowd.
 */

export interface AdStage {
  camera: PerspectiveCamera;
  /** How many of the (pre-made) fans are in the stands. */
  setCount(count: number): void;
  /** Where the eyes of someone in a seat are. */
  eyePoint(index: number): Vector3;
  /** One of the big screens: its centre and the way it faces. */
  screen: { x: number; y: number; z: number; yaw: number };
  capacity: number;
}

interface Shot {
  seconds: number;
  /** Two caption lines (text keys); the second may be empty. */
  caption: [TextKey, TextKey | null];
  /** Places the camera for progress k (0..1 through the shot) and returns how full the stands are (0..1). */
  frame(k: number, s: AdStage): number;
}

const ease = (k: number) => k * k * (3 - 2 * k);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const target = new Vector3();

/** An upright phone sees a narrow slice: the wide shots step back and open the lens so the stadium still fits. */
const upright = (s: AdStage) => s.camera.aspect < 1;

function orbit(s: AdStage, angle: number, radius: number, height: number, lookY: number, fov: number): void {
  if (upright(s)) {
    radius *= 1.32;
    height *= 1.25;
    fov = 64;
  }
  s.camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  s.camera.up.set(0, 1, 0);
  s.camera.lookAt(target.set(0, lookY, 0));
  setFov(s, fov);
}

function fromSeat(s: AdStage, index: number, turn: number, pitch: number, fov: number): void {
  s.camera.position.copy(s.eyePoint(index));
  s.camera.rotation.set(pitch, SEATS.yaw[index] + Math.PI + turn, 0, 'YXZ');
  setFov(s, fov);
}

function setFov(s: AdStage, fov: number): void {
  if (s.camera.fov !== fov) {
    s.camera.fov = fov;
    s.camera.updateProjectionMatrix();
  }
}

/** The clip, shot by shot. Durations follow the voice-over's sentences. */
const SHOTS: Shot[] = [
  {
    // "This stadium has fifty thousand seats. And right now every one is empty."
    seconds: 4.6,
    caption: ['ad.seats', 'ad.empty'],
    frame(k, s) {
      const e = ease(k);
      orbit(s, mix(0.75, 1.3, e), mix(330, 285, e), mix(135, 105, e), 10, 34);
      return 0;
    },
  },
  {
    // "First come, best seat."
    seconds: 3.6,
    caption: ['ad.first', null],
    frame(k, s) {
      const e = ease(k);
      s.camera.position.set(mix(-34, 30, e), mix(2.6, 5.5, e), mix(14, -4, e));
      s.camera.up.set(0, 1, 0);
      s.camera.lookAt(target.set(mix(-20, 25, e), 17, -75));
      setFov(s, 52);
      return 0;
    },
  },
  {
    // "Centre line, front row."
    seconds: 3.4,
    caption: ['ad.best', null],
    frame(k, s) {
      fromSeat(s, 0, mix(0.55, -0.55, ease(k)), -0.06, 66);
      return 0;
    },
  },
  {
    // "Make your character, take your place, fill the stadium with us."
    seconds: 5.2,
    caption: ['ad.fill', null],
    frame(k, s) {
      const e = ease(k);
      orbit(s, mix(2.2, 3.1, e), mix(225, 205, e), mix(112, 88, e), 8, 34);
      // Slow at first, then a rush: the stands fill from the centre outwards.
      return Math.min(1, Math.pow(k / 0.86, 1.8));
    },
  },
  {
    // "Your seat is yours for good. So is your number."
    seconds: 4.0,
    caption: ['ad.yours', null],
    frame(k, s) {
      fromSeat(s, 420, mix(-0.7, 0.45, ease(k)), -0.05, 68);
      return 1;
    },
  },
  {
    // "The ticket is free. Follow, comment 'stadium' ..."
    seconds: 5.2,
    caption: ['ad.free', 'ad.cta'],
    frame(k, s) {
      const e = ease(k);
      const { x, y, z, yaw } = s.screen;
      const d = upright(s) ? mix(125, 64, e) : mix(95, 46, e);
      s.camera.position.set(x + Math.sin(yaw) * d, y - mix(10, 2, e), z + Math.cos(yaw) * d);
      s.camera.up.set(0, 1, 0);
      s.camera.lookAt(target.set(x, y - 1, z));
      setFov(s, upright(s) ? 58 : 30);
      return 1;
    },
  },
];

const TOTAL = SHOTS.reduce((sum, shot) => sum + shot.seconds, 0);
const COUNTDOWN = 3;

export interface Ad {
  /** Advances the clip. Call once a frame instead of the normal camera controls. */
  update(dt: number): void;
  /** Starts again from the countdown. */
  restart(): void;
  readonly seconds: number;
}

export function createAd(stage: AdStage, overlay: HTMLElement): Ad {
  overlay.hidden = false;
  const lines = [document.createElement('strong'), document.createElement('span')];
  const caption = document.createElement('div');
  caption.className = 'ad-caption';
  caption.append(...lines);
  const countdown = document.createElement('div');
  countdown.className = 'ad-countdown';
  overlay.append(caption, countdown);

  let clock = -COUNTDOWN;
  let shown = -1;
  let lastCount = -1;

  const show = (index: number) => {
    if (index === shown) return;
    shown = index;
    const shot = SHOTS[index];
    lines[0].textContent = shot ? t(shot.caption[0]) : '';
    lines[1].textContent = shot && shot.caption[1] ? t(shot.caption[1]) : '';
    // Restart the entrance animation for the new caption.
    caption.classList.remove('in');
    void caption.offsetWidth;
    caption.classList.add('in');
  };

  const ad: Ad = {
    seconds: TOTAL,
    restart() {
      clock = -COUNTDOWN;
      shown = -1;
    },
    update(dt) {
      clock += dt;
      // Before the clip: the opening frame and a countdown, time to start the screen recording.
      if (clock < 0) {
        countdown.textContent = `${t('ad.ready')} ${Math.ceil(-clock)}`;
        countdown.hidden = false;
        caption.hidden = true;
        SHOTS[0].frame(0, stage);
        if (lastCount !== 0) stage.setCount((lastCount = 0));
        return;
      }
      countdown.hidden = true;
      caption.hidden = false;
      // After the clip: hold the last frame.
      let time = Math.min(clock, TOTAL - 0.0001);
      let index = 0;
      while (time >= SHOTS[index].seconds) time -= SHOTS[index++].seconds;
      const shot = SHOTS[index];
      const fill = shot.frame(time / shot.seconds, stage);
      const count = Math.round(fill * stage.capacity);
      if (count !== lastCount) stage.setCount((lastCount = count));
      show(index);
    },
  };
  // A tap plays it again.
  overlay.addEventListener('click', () => ad.restart());
  return ad;
}

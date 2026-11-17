import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three';
import { GAME } from '../config/game';
import { getLocale, t } from '../i18n';
import type { Structure } from './structure';

const FONT = "ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif";

/**
 * The scrolling LED ribbon text: the game's name and a slogan, repeated.
 * One texture is shared by every ribbon and the boards around the pitch.
 */
export function createLedTexture(): { texture: CanvasTexture; redraw(): void; update(dt: number): void } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  const redraw = () => {
    const g = canvas.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0, '#1b2c52');
    bg.addColorStop(1, '#0f1a33');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 64);
    g.font = `800 34px ${FONT}`;
    g.textBaseline = 'middle';
    const parts = [GAME.name.toUpperCase(), t('led.slogan').toUpperCase()];
    let x = 18;
    for (let i = 0; i < 2; i++) {
      for (const [k, text] of parts.entries()) {
        g.fillStyle = k === 0 ? '#ffffff' : '#ffd166';
        g.fillText(text, x, 34);
        x += g.measureText(text).width + 22;
        g.fillStyle = '#f0705a';
        g.beginPath();
        g.arc(x, 33, 6, 0, Math.PI * 2);
        g.fill();
        x += 28;
      }
    }
    texture.needsUpdate = true;
  };
  redraw();
  return {
    texture,
    redraw,
    update(dt) {
      texture.offset.x = (texture.offset.x + dt * 0.05) % 1;
    },
  };
}

export interface Scoreboard {
  group: Group;
  /** Shows how full the stadium is and who arrived last. */
  set(count: number, capacity: number, latest: string | null): void;
  /** Redraws in the current language. */
  redraw(): void;
}

/** The two big screens in the upper corners: the crowd counter and the latest arrival. */
export function createScoreboard(places: Structure['screens']): Scoreboard {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 472;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new MeshBasicMaterial({ map: texture });
  const group = new Group();
  for (const place of places) {
    const screen = new Mesh(new PlaneGeometry(place.width, place.height), material);
    screen.position.set(place.x, place.y, place.z);
    screen.rotation.y = place.yaw;
    group.add(screen);
  }

  let state = { count: 0, capacity: 0, latest: null as string | null };
  const draw = () => {
    const g = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#13244a');
    bg.addColorStop(1, '#1f5a8f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Header strip with the game's name.
    g.fillStyle = '#f0705a';
    g.fillRect(0, 0, W, 78);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 48px ${FONT}`;
    g.fillText(GAME.name.toUpperCase(), W / 2, 41);
    // The counter.
    const locale = getLocale() === 'tr' ? 'tr-TR' : 'en-GB';
    g.font = `900 150px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(state.count.toLocaleString(locale), W / 2, 196);
    g.font = `700 40px ${FONT}`;
    g.fillStyle = '#9fd3f5';
    g.fillText(t('board.fans', { capacity: state.capacity.toLocaleString(locale) }), W / 2, 296);
    // Progress bar.
    const fill = state.capacity ? state.count / state.capacity : 0;
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(96, 336, W - 192, 22);
    g.fillStyle = '#ffd166';
    g.fillRect(96, 336, (W - 192) * fill, 22);
    // Latest arrival.
    g.font = `600 38px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(state.latest ? t('board.latest', { name: state.latest }) : t('board.empty'), W / 2, 412);
    texture.needsUpdate = true;
  };
  draw();

  return {
    group,
    set(count, capacity, latest) {
      if (count === state.count && capacity === state.capacity && latest === state.latest) return;
      state = { count, capacity, latest };
      draw();
    },
    redraw: draw,
  };
}

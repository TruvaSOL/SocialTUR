import type { WebGLRenderer } from 'three';
import { t } from '../i18n';
import type { AutoQuality } from './quality';

function downloadedBytes(): number {
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource'),
  ] as PerformanceResourceTiming[];
  // transferSize is 0 for cached files; fall back to the stored size so the number stays meaningful.
  return entries.reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0);
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** The measurement overlay: frame rate, draw calls, triangles, memory, download size. */
export class StatsOverlay {
  private timer = 0;
  private calls = 0;
  private triangles = 0;

  constructor(
    private el: HTMLElement,
    private renderer: WebGLRenderer,
    private quality: AutoQuality,
  ) {}

  get visible(): boolean {
    return !this.el.hidden;
  }

  toggle(show = this.el.hidden): void {
    this.el.hidden = !show;
    if (show) this.render();
  }

  /** Call right after each rendered frame. */
  frame(dt: number): void {
    this.calls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
    if (!this.visible) return;
    this.timer += dt;
    if (this.timer > 0.5) {
      this.timer = 0;
      this.render();
    }
  }

  private render(): void {
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const { geometries, textures } = this.renderer.info.memory;
    const rows: [string, string][] = [
      [t('stats.fps'), this.quality.fps ? this.quality.fps.toFixed(0) : '…'],
      [t('stats.calls'), String(this.calls)],
      [t('stats.triangles'), this.triangles.toLocaleString()],
      [t('stats.memory'), heap ? mb(heap.usedJSHeapSize) : t('stats.unknown')],
      [t('stats.gpu'), `${geometries} / ${textures}`],
      [t('stats.download'), mb(downloadedBytes())],
      [t('stats.quality'), this.quality.label],
    ];
    const width = Math.max(...rows.map(([label]) => label.length));
    this.el.textContent = rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join('\n');
  }
}

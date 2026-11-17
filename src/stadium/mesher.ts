import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MeshLambertMaterial } from 'three';

export type P3 = [number, number, number];

/** Stadium surfaces are seen from both sides, so they are drawn double sided and never depend on winding. */
export const structureMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });

/**
 * Collects flat coloured quads and triangles straight into arrays. Far quicker than
 * building thousands of small three.js geometries for the stands' long strips.
 */
export class Mesher {
  private pos: number[] = [];
  private col: number[] = [];
  private nrm: number[] = [];
  /** Extra per-vertex data (for example seat coordinates), when the mesh needs it. */
  private extra: number[] = [];
  private c = new Color();

  constructor(private extraSize = 0) {}

  tri(a: P3, b: P3, c: P3, color: number, ea?: number[], eb?: number[], ec?: number[]): void {
    this.c.set(color);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
      this.nrm.push(nx, ny, nz);
    }
    if (this.extraSize) for (const e of [ea, eb, ec]) this.extra.push(...(e ?? new Array(this.extraSize).fill(0)));
  }

  /** Quad a-b-c-d in order around its edge. */
  quad(a: P3, b: P3, c: P3, d: P3, color: number, ea?: number[], eb?: number[], ec?: number[], ed?: number[]): void {
    this.tri(a, b, c, color, ea, eb, ec);
    this.tri(a, c, d, color, ea, ec, ed);
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  geometry(extraName = 'extra'): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    if (this.extraSize) g.setAttribute(extraName, new Float32BufferAttribute(this.extra, this.extraSize));
    return g;
  }
}

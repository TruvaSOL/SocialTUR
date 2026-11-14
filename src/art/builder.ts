import {
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** World pieces: faceted low-poly look. One material for everything static. */
export const flatMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
/** Characters: same palette, smooth shading so faces and limbs read as soft. */
export const smoothMaterial = new MeshLambertMaterial({ vertexColors: true });

export interface Placement {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number] | number;
}

function toMatrix(at: Placement): Matrix4 {
  const s = at.s ?? 1;
  const scale = typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(...s);
  return new Matrix4().compose(
    new Vector3(...(at.p ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(at.r ?? [0, 0, 0]))),
    scale,
  );
}

/**
 * Collects coloured shapes and merges them into one geometry, so a whole
 * object (a house, a tree) costs a single draw call.
 */
export class Builder {
  private parts: BufferGeometry[] = [];
  private stack: Matrix4[] = [new Matrix4()];

  /** Runs `fn` with every added shape placed relative to `at`. */
  group(at: Placement, fn: () => void): this {
    const top = this.stack[this.stack.length - 1];
    this.stack.push(top.clone().multiply(toMatrix(at)));
    fn();
    this.stack.pop();
    return this;
  }

  add(source: BufferGeometry, color: number, at: Placement = {}): this {
    const geo = source.index ? source.toNonIndexed() : source.clone();
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    geo.applyMatrix4(this.stack[this.stack.length - 1].clone().multiply(toMatrix(at)));

    const c = new Color(color);
    const count = geo.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.parts.push(geo);
    source.dispose();
    return this;
  }

  geometry(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return merged;
  }

  mesh(material = flatMaterial, shadows = true): Mesh {
    const mesh = new Mesh(this.geometry(), material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
  }
}

/** Small deterministic random generator, so the scene looks the same on every device. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

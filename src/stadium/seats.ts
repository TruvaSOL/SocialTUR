import { Color, DoubleSide, Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { PALETTE as C } from '../art/palette';
import { BLOCKS, RUNS, RUN_SEATS, outline, segmentSteps } from './layout';
import { Mesher, type P3 } from './mesher';

/** The four seat colours: deep navy by the pitch, through blue and sky blue, to white under the roof. */
export const seatColors = [C.seatNavy, C.aegean, C.seatSky, C.white].map((hex) => new Color(hex));

/**
 * The seat mosaic, shared by the far strips and the near 3D seats so a seat keeps its colour
 * when it swaps from one to the other. A gradient rising from navy to white, bent into three
 * slow waves that sweep round the bowl, and dithered seat by seat so the bands dissolve.
 * `s` is the seat's number in its row, `r` its row's number, `y` its height, `xz` its place.
 */
export const SEAT_MOSAIC = /* glsl */ `
uniform vec3 uSeatColors[4];
vec3 seatMosaic(float s, float r, float y, vec2 xz) {
  float h = fract(sin(s * 12.9898 + r * 78.233) * 43758.5453);
  float height = clamp(y / 39.0, 0.0, 1.0);
  float sweep = 0.5 + 0.5 * sin(atan(xz.y, xz.x) * 3.0 + height * 5.0);
  float tone = height * 0.78 + sweep * 0.3 + (h - 0.5) * 0.34;
  return tone < 0.27 ? uSeatColors[0] : tone < 0.52 ? uSeatColors[1] : tone < 0.78 ? uSeatColors[2] : uSeatColors[3];
}
`;

const STRIP_FRAGMENT = /* glsl */ `
  // Seats close to the camera are drawn as real 3D seats instead.
  if (distance(vSeatWorld, uSeatEye) < uSeatNear) discard;
  float u = fract(vSeat.x);
  float v = vSeat.y;
  // Far away a seat is narrower than a pixel or two: cutting gaps and dithering colours there
  // only makes the stand shimmer. So with distance the gaps close, the seat-by-seat dither
  // fades into the smooth colour bands, and the shading becomes its average.
  float far = smoothstep(0.3, 0.8, fwidth(vSeat.x));
  if (far < 0.5) {
    // Gaps between seats.
    if (u < 0.07 || u > 0.93) discard;
    // Rounded top corners on the seat back.
    if (v > 0.78) {
      vec2 q = vec2(max(abs(u - 0.5) - 0.2, 0.0) / 0.23, (v - 0.78) / 0.22);
      if (dot(q, q) > 1.0) discard;
    }
  }
  vec3 seatColor = seatMosaicSoft(floor(vSeat.x), vSeat.z, vSeat.w, vSeatWorld.xz, 1.0 - far);
  // Shading that gives the flat strip some form: a bright front lip on the pan, a dark fold
  // where pan meets back, the back a touch darker, its top edge catching the light.
  float shade = v < 0.05 ? 1.1 : v < 0.33 ? 1.0 : v < 0.45 ? 0.7 : v > 0.9 ? 1.08 : 0.9;
  seatColor *= mix(shade, 0.9, far);
  vec4 diffuseColor = vec4(seatColor, opacity);
`;

/** The mosaic with the seat-by-seat dither scaled by `dither` (1 near, 0 far: smooth bands). */
const SEAT_MOSAIC_SOFT = /* glsl */ `
vec3 seatMosaicSoft(float s, float r, float y, vec2 xz, float dither) {
  float h = fract(sin(s * 12.9898 + r * 78.233) * 43758.5453);
  float height = clamp(y / 39.0, 0.0, 1.0);
  float sweep = 0.5 + 0.5 * sin(atan(xz.y, xz.x) * 3.0 + height * 5.0);
  float tone = height * 0.78 + sweep * 0.3 + (h - 0.5) * 0.34 * dither;
  return tone < 0.27 ? uSeatColors[0] : tone < 0.52 ? uSeatColors[1] : tone < 0.78 ? uSeatColors[2] : uSeatColors[3];
}
`;

export interface Seats {
  mesh: Mesh;
  /** Hides the strips within `radius` of `eye`; the near 3D seats are drawn there. */
  setNear(eye: Vector3, radius: number): void;
}

/**
 * Every seat in the stadium, drawn as one long strip per row rather than 50,000 models.
 * A small shader cuts the strip into separate seats and paints the seat mosaic,
 * so that empty stands already look designed.
 */
export function createSeats(): Seats {
  // Extra data per vertex: seat number along the row, height on the seat (0 front of pan .. 1 top of back),
  // the row's number, and the row's height.
  const m = new Mesher(4);
  const p = { x: 0, z: 0, nx: 0, nz: 0 };
  const at = (seg: number, f: number, d: number, y: number): P3 => {
    outline(seg as 0, f, d, p);
    return [p.x, y, p.z];
  };

  RUNS.forEach((run, r) => {
    const block = BLOCKS[run.block];
    const exists = RUN_SEATS[r];
    const y = run.y;
    // Draw each unbroken stretch of seats (spare seats may have been left out at the ends).
    let i = 0;
    while (i < run.seats) {
      if (!exists[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < run.seats && exists[j]) j++;
      const fAt = (k: number) => block.f0 + (run.g0 + (k / run.seats) * (run.g1 - run.g0)) * (block.f1 - block.f0);
      const f0 = fAt(i);
      const f1 = fAt(j);
      const steps = Math.max(1, Math.ceil((f1 - f0) * segmentSteps(block.seg) * 3));
      for (let s = 0; s < steps; s++) {
        const fa = f0 + ((f1 - f0) * s) / steps;
        const fb = f0 + ((f1 - f0) * (s + 1)) / steps;
        const ua = i + ((j - i) * s) / steps;
        const ub = i + ((j - i) * (s + 1)) / steps;
        // Seat pan.
        m.quad(
          at(block.seg, fa, run.d - 0.22, y), at(block.seg, fb, run.d - 0.22, y),
          at(block.seg, fb, run.d + 0.18, y), at(block.seg, fa, run.d + 0.18, y),
          C.white, [ua, 0, r, y], [ub, 0, r, y], [ub, 0.4, r, y], [ua, 0.4, r, y],
        );
        // Seat back, leaning back slightly.
        m.quad(
          at(block.seg, fa, run.d + 0.2, y), at(block.seg, fb, run.d + 0.2, y),
          at(block.seg, fb, run.d + 0.28, y + 0.42), at(block.seg, fa, run.d + 0.28, y + 0.42),
          C.white, [ua, 0.4, r, y], [ub, 0.4, r, y], [ub, 1, r, y], [ua, 1, r, y],
        );
      }
      i = j;
    }
  });

  const uniforms = {
    uSeatColors: { value: seatColors },
    uSeatEye: { value: new Vector3(0, 1e6, 0) },
    uSeatNear: { value: 0 },
  };
  const material = new MeshLambertMaterial({ vertexColors: false, side: DoubleSide, flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 seat;\nvarying vec4 vSeat;\nvarying vec3 vSeatWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeat = seat;\nvSeatWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec4 vSeat;\nvarying vec3 vSeatWorld;\nuniform vec3 uSeatEye;\nuniform float uSeatNear;\n${SEAT_MOSAIC}\n${SEAT_MOSAIC_SOFT}`,
      )
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', STRIP_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'stadium-seat-strips';

  const mesh = new Mesh(m.geometry('seat'), material);
  mesh.receiveShadow = true;
  return {
    mesh,
    setNear(eye, radius) {
      uniforms.uSeatEye.value.copy(eye);
      uniforms.uSeatNear.value = radius;
    },
  };
}

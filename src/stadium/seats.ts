import { Color, DoubleSide, Mesh, MeshLambertMaterial } from 'three';
import { PALETTE as C } from '../art/palette';
import { BLOCKS, RUNS, RUN_SEATS, outline, segmentSteps } from './layout';
import { Mesher, type P3 } from './mesher';

const SEAT_FRAGMENT = /* glsl */ `
  float u = fract(vSeat.x);
  float v = vSeat.y;
  // Gaps between seats.
  if (u < 0.07 || u > 0.93) discard;
  // Rounded top corners on the seat back.
  if (v > 0.78) {
    vec2 q = vec2(max(abs(u - 0.5) - 0.2, 0.0) / 0.23, (v - 0.78) / 0.22);
    if (dot(q, q) > 1.0) discard;
  }
  // The seat mosaic: a gradient rising from navy to white, bent into three slow waves that
  // sweep round the bowl, and dithered seat by seat so the bands dissolve into each other.
  float h = fract(sin(floor(vSeat.x) * 12.9898 + floor(vSeat.z * 0.5) * 78.233) * 43758.5453);
  float height = clamp(vSeatWorld.y / 39.0, 0.0, 1.0);
  float sweep = 0.5 + 0.5 * sin(atan(vSeatWorld.z, vSeatWorld.x) * 3.0 + height * 5.0);
  float tone = height * 0.78 + sweep * 0.3 + (h - 0.5) * 0.34;
  vec3 seatColor = tone < 0.27 ? uSeatColors[0] : tone < 0.52 ? uSeatColors[1] : tone < 0.78 ? uSeatColors[2] : uSeatColors[3];
  // The back is a touch darker than the pan, and its top edge catches the light.
  seatColor *= v < 0.4 ? 1.0 : (v > 0.9 ? 1.08 : 0.9);
  vec4 diffuseColor = vec4(seatColor, opacity);
`;

/**
 * Every seat in the stadium, drawn as one long strip per row rather than 50,000 models.
 * A small shader cuts the strip into separate seats and paints the seat mosaic: a dithered
 * gradient from navy to white, so that empty stands already look designed.
 */
export function createSeats(): Mesh {
  // Extra data per vertex: seat number along the row, height on the seat (0 front of pan .. 1 top of back), row seed.
  const m = new Mesher(3);
  const p = { x: 0, z: 0, nx: 0, nz: 0 };
  const at = (seg: number, f: number, d: number, y: number): P3 => {
    outline(seg as 0, f, d, p);
    return [p.x, y, p.z];
  };

  RUNS.forEach((run, r) => {
    const block = BLOCKS[run.block];
    const exists = RUN_SEATS[r];
    const seed = r * 2; // seeds each row's dither
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
        const y = run.y;
        // Seat pan.
        m.quad(
          at(block.seg, fa, run.d - 0.22, y), at(block.seg, fb, run.d - 0.22, y),
          at(block.seg, fb, run.d + 0.18, y), at(block.seg, fa, run.d + 0.18, y),
          C.white, [ua, 0, seed], [ub, 0, seed], [ub, 0.4, seed], [ua, 0.4, seed],
        );
        // Seat back, leaning back slightly.
        m.quad(
          at(block.seg, fa, run.d + 0.2, y), at(block.seg, fb, run.d + 0.2, y),
          at(block.seg, fb, run.d + 0.28, y + 0.42), at(block.seg, fa, run.d + 0.28, y + 0.42),
          C.white, [ua, 0.4, seed], [ub, 0.4, seed], [ub, 1, seed], [ua, 1, seed],
        );
      }
      i = j;
    }
  });

  const material = new MeshLambertMaterial({ vertexColors: false, side: DoubleSide, flatShading: true });
  // Deep navy by the pitch, through blue and sky blue, to white under the roof.
  const colors = [C.seatNavy, C.aegean, C.seatSky, C.white].map((hex) => new Color(hex));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeatColors = { value: colors };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 seat;\nvarying vec3 vSeat;\nvarying vec3 vSeatWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeat = seat;\nvSeatWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeat;\nvarying vec3 vSeatWorld;\nuniform vec3 uSeatColors[4];')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', SEAT_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'stadium-seats-mosaic';

  const mesh = new Mesh(m.geometry('seat'), material);
  mesh.receiveShadow = true;
  return mesh;
}

import { Color, DoubleSide, Mesh, MeshLambertMaterial } from 'three';
import { PALETTE as C } from '../art/palette';
import { BLOCKS, RUNS, RUN_SEATS, outline, segmentSteps } from './layout';
import { Mesher, type P3 } from './mesher';

/**
 * Every seat in the stadium, drawn as one long strip per row rather than 50,000 models.
 * A small shader cuts the strip into separate seats and gives each its colour: a mix of
 * blues, as modern stadiums use, so that empty stands still look lively.
 */
export function createSeats(): Mesh {
  // Extra data per vertex: seat number along the row, height on the seat (0 front of pan .. 1 top of back), tier.
  const m = new Mesher(3);
  const p = { x: 0, z: 0, nx: 0, nz: 0 };
  const at = (seg: number, f: number, d: number, y: number): P3 => {
    outline(seg as 0, f, d, p);
    return [p.x, y, p.z];
  };

  RUNS.forEach((run, r) => {
    const block = BLOCKS[run.block];
    const exists = RUN_SEATS[r];
    const tier = block.tier + r * 2; // tier in the lowest bit, row run above it: seeds each row's colours
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
          C.white, [ua, 0, tier], [ub, 0, tier], [ub, 0.4, tier], [ua, 0.4, tier],
        );
        // Seat back, leaning back slightly.
        m.quad(
          at(block.seg, fa, run.d + 0.2, y), at(block.seg, fb, run.d + 0.2, y),
          at(block.seg, fb, run.d + 0.28, y + 0.42), at(block.seg, fa, run.d + 0.28, y + 0.42),
          C.white, [ua, 0.4, tier], [ub, 0.4, tier], [ub, 1, tier], [ua, 1, tier],
        );
      }
      i = j;
    }
  });

  const material = new MeshLambertMaterial({ vertexColors: false, side: DoubleSide, flatShading: true });
  const colors = [C.seatNavy, C.aegean, C.seatSky, C.white, C.seatTeal].map((hex) => new Color(hex));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeatColors = { value: colors };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 seat;\nvarying vec3 vSeat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeat = seat;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeat;\nuniform vec3 uSeatColors[5];')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `
        float u = fract(vSeat.x);
        float v = vSeat.y;
        // Gaps between seats.
        if (u < 0.07 || u > 0.93) discard;
        // Rounded top corners on the seat back.
        if (v > 0.78) {
          vec2 q = vec2(max(abs(u - 0.5) - 0.2, 0.0) / 0.23, (v - 0.78) / 0.22);
          if (dot(q, q) > 1.0) discard;
        }
        float tierBit = mod(vSeat.z, 2.0);
        float h = fract(sin(floor(vSeat.x) * 12.9898 + floor(vSeat.z * 0.5) * 78.233) * 43758.5453);
        vec3 seatColor;
        if (tierBit < 0.5) {
          seatColor = h < 0.16 ? uSeatColors[0] : h < 0.62 ? uSeatColors[1] : h < 0.9 ? uSeatColors[2] : uSeatColors[3];
        } else {
          seatColor = h < 0.3 ? uSeatColors[1] : h < 0.58 ? uSeatColors[2] : h < 0.84 ? uSeatColors[4] : uSeatColors[3];
        }
        // The back is a touch darker than the pan, and its top edge catches the light.
        seatColor *= v < 0.4 ? 1.0 : (v > 0.9 ? 1.08 : 0.9);
        vec4 diffuseColor = vec4(seatColor, opacity);
        `,
      );
  };
  material.customProgramCacheKey = () => 'stadium-seats';

  const mesh = new Mesh(m.geometry('seat'), material);
  mesh.receiveShadow = true;
  return mesh;
}

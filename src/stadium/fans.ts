import {
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
} from 'three';
import { HAIRS, type Look, SKINS, TOPS } from '../world/looks';
import { SEATS } from './layout';

/** How long one lap of the Mexican wave takes, and how often a wave starts. */
const WAVE_LAP = 24;
const WAVE_EVERY = 75;
const WAVE_LAPS = 2;

/** Where the Mexican wave is right now: its angle round the bowl and how strong it is (0 = no wave). */
export function waveAt(time: number): { angle: number; on: number } {
  const t = time % WAVE_EVERY;
  const length = WAVE_LAP * WAVE_LAPS;
  if (t > length) return { angle: 0, on: 0 };
  const on = Math.min(1, t / 3, (length - t) / 3);
  return { angle: (t / WAVE_LAP) * Math.PI * 2 - Math.PI, on };
}

/** How strongly a seat at this angle is lifted by the wave. Same formula as the shader. */
export function waveLift(x: number, z: number, wave: { angle: number; on: number }): number {
  if (wave.on <= 0) return 0;
  let d = Math.atan2(z, x) - wave.angle + Math.PI;
  d = d - Math.floor(d / (Math.PI * 2)) * Math.PI * 2 - Math.PI;
  return wave.on * Math.exp(-d * d * 60);
}

const VERTEX = /* glsl */ `
attribute vec4 aSeat;
attribute vec4 aLook;
uniform vec3 uEye;
uniform float uNear;
uniform float uTime;
uniform float uWaveAngle;
uniform float uWaveOn;
uniform vec2 uSun;
uniform vec3 uTops[${TOPS.length}];
uniform vec3 uSkins[${SKINS.length}];
uniform vec3 uHairs[${HAIRS.length}];
varying vec2 vP;
varying vec3 vTop;
varying vec3 vSkin;
varying vec3 vHair;
varying float vArms;
varying float vFace;
varying float vLight;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec3 base = aSeat.xyz;
  vec3 toEye = uEye - base;
  // Hidden: no one in this seat yet (top < 0), or close enough that a full 3D character stands in.
  if (aLook.x < 0.0 || dot(toEye, toEye) < uNear * uNear) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 h = normalize(cameraPosition.xz - base.xz + vec2(1e-4));
  vec3 right = vec3(h.y, 0.0, -h.x);
  vec2 forward = vec2(sin(aSeat.w), cos(aSeat.w));
  vFace = dot(forward, h);

  float seed = aLook.w;
  // The Mexican wave runs round the bowl by angle.
  float d = mod(atan(base.z, base.x) - uWaveAngle + PI, PI2) - PI;
  float wave = uWaveOn * exp(-d * d * 60.0);
  // Now and then someone throws both arms up.
  float slot = floor(uTime * 0.4 + seed * 97.0);
  float cheer = step(0.975, fract(sin(slot * 12.9898 + seed * 311.7) * 43758.5453));
  vArms = max(wave, cheer);
  float bob = sin(uTime * 2.3 + seed * 40.0) * 0.012;

  vP = vec2(position.x * 0.7, position.y * 1.4);
  vec3 p = base + right * vP.x + vec3(0.0, vP.y + wave * 0.26 + bob, 0.0);
  vTop = uTops[int(aLook.x)];
  // Pull the clothes a little towards each other so the crowd reads as one mass, not noise.
  vTop = mix(vTop, vec3(dot(vTop, vec3(0.3, 0.59, 0.11))), 0.14);
  vSkin = uSkins[int(aLook.y)];
  vHair = uHairs[int(aLook.z)];
  // Fans facing the sun are bright; those with the sun behind them sit in their own stand's shade.
  vLight = 0.66 + 0.34 * clamp(dot(forward, uSun) * 1.3 + 0.45, 0.0, 1.0);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
varying vec2 vP;
varying vec3 vTop;
varying vec3 vSkin;
varying vec3 vHair;
varying float vArms;
varying float vFace;
varying float vLight;
#include <common>
#include <fog_pars_fragment>

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float segment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - r;
}

vec3 color;
float alpha;
float aa;
// Paints a shape over what is already there, with a soft dark rim like the 3D characters' shading.
void paint(float d, vec3 c) {
  float m = 1.0 - smoothstep(-aa, aa, d);
  float rim = mix(0.74, 1.0, smoothstep(0.0, 0.03, -d));
  color = mix(color, c * rim, m);
  alpha = max(alpha, m);
}

void main() {
  vec2 p = vP;
  aa = max(fwidth(p.y), 0.002);
  color = vec3(0.0);
  alpha = 0.0;

  float arms = vArms;
  vec2 handL = vec2(0.26, 0.42 + 0.82 * arms);
  if (arms > 0.02) {
    paint(segment(p, vec2(0.14, 0.4), handL, 0.055), vTop);
    paint(segment(p, vec2(-0.14, 0.4), vec2(-handL.x, handL.y), 0.055), vTop);
  }
  paint(roundBox(p - vec2(0.0, 0.25), vec2(0.18, 0.22), 0.1), vTop);
  vec2 head = p - vec2(0.0, 0.71);
  float dHead = length(head) - 0.25;
  if (vFace > -0.1) {
    paint(dHead, vSkin);
    // Hair: a cap over the top, lower at the sides.
    float cap = max(length(head) - 0.262, 0.75 - 0.07 * abs(p.x) / 0.26 - p.y);
    paint(cap, vHair);
    // Eyes when the face is towards the camera.
    if (vFace > 0.25) {
      paint(length(p - vec2(0.085, 0.69)) - 0.028, vec3(0.13, 0.09, 0.08));
      paint(length(p - vec2(-0.085, 0.69)) - 0.028, vec3(0.13, 0.09, 0.08));
    }
  } else {
    paint(length(head) - 0.262, vHair);
  }
  if (arms > 0.02) {
    paint(length(p - handL) - 0.065, vSkin);
    paint(length(p - vec2(-handL.x, handL.y)) - 0.065, vSkin);
  }
  if (alpha < 0.5) discard;
  color *= vLight * (0.9 + 0.12 * clamp(p.y, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export interface Fans {
  mesh: Mesh;
  /** How many seats are taken (they are always the best `count` seats). */
  readonly count: number;
  /** Sets the look of the fan in seat `index` (0-based, best first). Null leaves the seat empty. */
  setFan(index: number, look: Look | null): void;
  /** Makes seats 0..count-1 the taken ones. */
  setCount(count: number): void;
  /** Call each frame. `eye` and `near` say which fans the 3D crowd is drawing instead. */
  update(time: number, eye: Vector3, near: number): void;
}

/**
 * Everyone in the stands, as flat cut-outs that always turn to the camera: one quad each,
 * all 50,000 in a single draw call. Fans close to the camera are hidden here and drawn as
 * full 3D characters by the near crowd.
 */
export function createFans(sunDirection: Vector3): Fans {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const seat = new Float32Array(SEATS.count * 4);
  const look = new Float32Array(SEATS.count * 4).fill(-1);
  for (let i = 0; i < SEATS.count; i++) {
    seat[i * 4] = SEATS.pos[i * 3];
    seat[i * 4 + 1] = SEATS.pos[i * 3 + 1];
    seat[i * 4 + 2] = SEATS.pos[i * 3 + 2];
    seat[i * 4 + 3] = SEATS.yaw[i];
  }
  geometry.setAttribute('aSeat', new InstancedBufferAttribute(seat, 4));
  const lookAttribute = new InstancedBufferAttribute(look, 4);
  geometry.setAttribute('aLook', lookAttribute);
  geometry.instanceCount = 0;

  const linear = (list: readonly number[]) => list.map((hex) => new Color(hex));
  const sun = new Vector2(sunDirection.x, sunDirection.z).normalize();
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uEye: { value: new Vector3(0, 1e6, 0) },
        uNear: { value: 0 },
        uTime: { value: 0 },
        uWaveAngle: { value: 0 },
        uWaveOn: { value: 0 },
        uSun: { value: sun },
      },
    ]),
  });
  // Colour lists are set after merge (merge would clone them into plain objects).
  material.uniforms.uTops = { value: linear(TOPS) };
  material.uniforms.uSkins = { value: linear(SKINS) };
  material.uniforms.uHairs = { value: linear(HAIRS) };

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false; // one batch spread over the whole bowl
  let count = 0;
  // Small changes upload only their own bytes; a big batch (many fans at once) uploads everything.
  let dirty = 0;

  return {
    mesh,
    get count() {
      return count;
    },
    setFan(index, value) {
      const o = index * 4;
      if (!value) {
        look[o] = -1;
      } else {
        look[o] = value.top;
        look[o + 1] = value.skin;
        look[o + 2] = value.hair;
        look[o + 3] = ((index * 0.6180339887) % 1) * 0.999; // a fixed per-seat seed
      }
      dirty++;
      if (dirty <= 32) lookAttribute.addUpdateRange(o, 4);
      else if (dirty === 33) lookAttribute.clearUpdateRanges();
      lookAttribute.needsUpdate = true;
    },
    setCount(next) {
      count = Math.max(0, Math.min(SEATS.count, next));
      geometry.instanceCount = count;
    },
    update(time, eye, near) {
      dirty = 0;
      const wave = waveAt(time);
      material.uniforms.uTime.value = time;
      material.uniforms.uWaveAngle.value = wave.angle;
      material.uniforms.uWaveOn.value = wave.on;
      material.uniforms.uEye.value.copy(eye);
      material.uniforms.uNear.value = near;
    },
  };
}

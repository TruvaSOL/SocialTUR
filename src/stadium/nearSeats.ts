import {
  BoxGeometry,
  type BufferGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { Builder } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { SEATS } from './layout';
import { SEAT_MOSAIC, seatColors } from './seats';

const WHITE = 0xffffff;

/**
 * One stadium seat as a real model. Seat coordinates: origin on the seat pan, +z towards the pitch.
 * White parts take the seat's mosaic colour; the dark parts are the steel frame.
 * `up` gives the empty seat: stadium seats tip up when nobody is sitting on them.
 */
function buildSeat(up: boolean): BufferGeometry {
  const b = new Builder();
  // Back: a centre panel and two wings turned in, so it wraps slightly, leaning back.
  b.group({ p: [0, 0.03, -0.2], r: [-0.13, 0, 0] }, () => {
    b.add(new BoxGeometry(0.27, 0.42, 0.04), WHITE, { p: [0, 0.21, 0] });
    for (const side of [1, -1]) {
      b.add(new BoxGeometry(0.11, 0.42, 0.04), WHITE, { p: [side * 0.185, 0.21, 0.015], r: [0, -side * 0.3, 0] });
    }
    // Rolled top edge and a small number plate.
    b.add(new BoxGeometry(0.46, 0.035, 0.06), WHITE, { p: [0, 0.43, -0.005] });
    b.add(new BoxGeometry(0.08, 0.03, 0.012), C.white, { p: [0, 0.36, 0.027] });
  });
  // Pan: flat when someone sits, tipped up against the back when empty.
  b.group({ p: [0, 0, -0.17], r: [up ? -1.32 : 0, 0, 0] }, () => {
    b.add(new BoxGeometry(0.45, 0.05, 0.38), WHITE, { p: [0, 0, 0.2] });
    b.add(new BoxGeometry(0.45, 0.07, 0.05), WHITE, { p: [0, -0.005, 0.385] }); // rounded front lip
  });
  // Steel: two side arms holding the pan's hinge, a beam under them, a bracket to the step behind.
  for (const side of [1, -1]) {
    b.add(new BoxGeometry(0.025, 0.26, 0.05), C.metalDark, { p: [side * 0.24, 0.04, -0.17] });
  }
  b.add(new BoxGeometry(0.5, 0.04, 0.06), C.metalDark, { p: [0, -0.09, -0.17] });
  b.add(new BoxGeometry(0.06, 0.06, 0.16), C.metalDark, { p: [0, -0.09, -0.26] });
  return b.geometry();
}

/**
 * The seats nearest the camera, as real 3D models: in the first-person view the flat strips
 * that serve from afar would look like paper. The strips hide themselves inside the same radius.
 */
export class NearSeats {
  readonly group = new Group();
  /** The radius inside which the strips should hide. */
  radius = 0;
  /** How many seat models were drawn last time. */
  drawn = 0;

  private down: InstancedMesh;
  private up: InstancedMesh;
  private eye = new Vector3(0, 1e6, 0);
  private stale = true;
  private picked: { index: number; d2: number }[] = [];

  constructor(private capacity = 420, private reach = 7) {
    const uniforms = { uSeatColors: { value: seatColors } };
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aSeat;\nvarying vec2 vNearSeat;\nvarying vec3 vNearOrigin;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvNearSeat = aSeat;\nvNearOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vNearSeat;\nvarying vec3 vNearOrigin;\n${SEAT_MOSAIC}`)
        .replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( seatMosaic(vNearSeat.x, vNearSeat.y, vNearOrigin.y, vNearOrigin.xz), opacity );',
        );
    };
    material.customProgramCacheKey = () => 'stadium-seat-models';

    const make = (geometry: BufferGeometry) => {
      const mesh = new InstancedMesh(geometry, material, capacity);
      mesh.geometry.setAttribute('aSeat', new InstancedBufferAttribute(new Float32Array(capacity * 2), 2));
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    this.down = make(buildSeat(false));
    this.up = make(buildSeat(true));
  }

  /** Call when seats fill or empty, so tipped-up seats are chosen again. */
  refresh(): void {
    this.stale = true;
  }

  /** Chooses the seats near the camera and places a model on each. `taken` says whether someone sits there. */
  update(camera: Vector3, taken: (index: number) => boolean): void {
    if (!this.stale && camera.distanceToSquared(this.eye) < 0.02) return;
    this.stale = false;
    this.eye.copy(camera);

    const pos = SEATS.pos;
    const r2 = this.reach * this.reach;
    const picked = this.picked;
    picked.length = 0;
    for (let i = 0; i < SEATS.count; i++) {
      const dx = pos[i * 3] - camera.x;
      if (dx > this.reach || dx < -this.reach) continue;
      const dz = pos[i * 3 + 2] - camera.z;
      if (dz > this.reach || dz < -this.reach) continue;
      const dy = pos[i * 3 + 1] - camera.y;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) picked.push({ index: i, d2 });
    }
    let radius = this.reach;
    if (picked.length > this.capacity) {
      picked.sort((a, b) => a.d2 - b.d2);
      radius = Math.sqrt(picked[this.capacity].d2);
      picked.length = this.capacity;
    }
    // The strips stop a little short of the models' edge, so no seat goes missing at the boundary.
    this.radius = picked.length ? Math.max(0, radius - 0.45) : 0;

    const m = new Matrix4();
    const q = new Quaternion();
    const v = new Vector3();
    const one = new Vector3(1, 1, 1);
    const axis = new Vector3(0, 1, 0);
    let nDown = 0;
    let nUp = 0;
    for (const { index } of picked) {
      const mesh = taken(index) ? this.down : this.up;
      const slot = mesh === this.down ? nDown++ : nUp++;
      m.compose(v.set(pos[index * 3], pos[index * 3 + 1], pos[index * 3 + 2]), q.setFromAxisAngle(axis, SEATS.yaw[index]), one);
      mesh.setMatrixAt(slot, m);
      const ids = mesh.geometry.getAttribute('aSeat') as InstancedBufferAttribute;
      // The same numbers the strips use: seat number within its row (0-based) and the row's number.
      ids.setXY(slot, SEATS.num[index] - 1, SEATS.run[index]);
    }
    for (const [mesh, n] of [[this.down, nDown], [this.up, nUp]] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.geometry.getAttribute('aSeat') as InstancedBufferAttribute).needsUpdate = true;
    }
    this.drawn = nDown + nUp;
  }
}

import { BoxGeometry, Color, CylinderGeometry, Euler, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { Builder, flatMaterial, seededRandom } from '../art/builder';
import { PALETTE as C } from '../art/palette';
import { buildPalmGeometry, buildTreeGeometry } from '../world/tree';
import { Mesher, structureMaterial } from './mesher';
import { FACADE_D, ring } from './structure';

const PLAZA = 34;

function instanced(geometry: ReturnType<typeof buildTreeGeometry>, items: { x: number; z: number; s: number; yaw: number }[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, flatMaterial, items.length);
  const m = new Matrix4();
  items.forEach((it, i) => {
    m.compose(new Vector3(it.x, 0, it.z), new Quaternion().setFromEuler(new Euler(0, it.yaw, 0)), new Vector3(it.s, it.s, it.s));
    mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingSphere();
  return mesh;
}

/** What lies around the stadium: a paved plaza, lawns with trees and palms, and a low town on the horizon. */
export function createSurroundings(): Group {
  const group = new Group();
  const rnd = seededRandom(31);

  // Lawn to the horizon, then the plaza ring hugging the stadium, with a walkway stripe.
  const lawn = new Mesh(new Builder().add(new CylinderGeometry(2600, 2600, 0.2, 64), C.lawn, { p: [0, -0.35, 0] }).geometry(), flatMaterial);
  lawn.receiveShadow = true;
  group.add(lawn);
  const m = new Mesher();
  const ringBand = (d0: number, d1: number, y: number, color: number) => {
    const a = ring(d0);
    const b = ring(d1);
    for (let i = 0; i < a.length - 1; i++) {
      m.quad([a[i].x, y, a[i].z], [a[i + 1].x, y, a[i + 1].z], [b[i + 1].x, y, b[i + 1].z], [b[i].x, y, b[i].z], color);
    }
  };
  ringBand(FACADE_D - 1, FACADE_D + PLAZA, 0.04, C.plaza);
  ringBand(FACADE_D + 12, FACADE_D + 14, 0.14, C.plazaDark);
  ringBand(FACADE_D + PLAZA, FACADE_D + PLAZA + 1.2, 0.14, C.white);
  const plaza = new Mesh(m.geometry(), structureMaterial);
  plaza.receiveShadow = true;
  group.add(plaza);

  // Trees and palms on the lawn around the plaza.
  const trees: { x: number; z: number; s: number; yaw: number }[] = [];
  const palms: typeof trees = [];
  const outer = ring(FACADE_D + PLAZA + 6);
  for (const p of outer) {
    if (rnd() < 0.25) continue;
    palms.push({ x: p.x, z: p.z, s: 1.6 + rnd() * 0.4, yaw: rnd() * 6 });
  }
  for (let i = 0; i < 260; i++) {
    const angle = rnd() * Math.PI * 2;
    const r = 175 + rnd() * 140;
    trees.push({ x: Math.cos(angle) * r * 1.15, z: Math.sin(angle) * r, s: 1.8 + rnd() * 1.4, yaw: rnd() * 6 });
  }
  group.add(instanced(buildTreeGeometry(), trees), instanced(buildPalmGeometry(), palms));

  // A low town on the horizon: pastel blocks, softened by the haze.
  const block = new Builder().add(new BoxGeometry(1, 1, 1), C.white, { p: [0, 0.5, 0] }).geometry();
  const count = 340;
  const town = new InstancedMesh(block, flatMaterial, count);
  const tints = [C.white, C.wallPeach, C.wallLemon, C.wallSky, C.tile, C.concrete].map((hex) => new Color(hex));
  const mtx = new Matrix4();
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2;
    const r = 430 + rnd() * 520;
    const tall = rnd() < 0.12;
    const h = tall ? 40 + rnd() * 70 : 8 + rnd() * 22;
    const w = 14 + rnd() * 22;
    mtx.compose(
      new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
      new Quaternion().setFromEuler(new Euler(0, rnd() * Math.PI, 0)),
      new Vector3(w, h, w * (0.6 + rnd() * 0.8)),
    );
    town.setMatrixAt(i, mtx);
    town.setColorAt(i, tints[Math.floor(rnd() * tints.length)]);
  }
  town.computeBoundingSphere();
  group.add(town);
  return group;
}

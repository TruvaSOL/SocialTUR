import { DirectionalLight, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  sun: DirectionalLight;
  /** Largest pixel ratio this device will be rendered at. */
  basePixelRatio: number;
}

const FOCUS = new Vector3(0, 1.3, 0.6);
const VIEW_DIR = new Vector3(0.6, 0.5, 0.78).normalize();
/** Radius around the focus point that must stay in view on any screen shape. */
const FIT_RADIUS = 7.4;

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(basePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.5, 120);

  // Cheap lighting: sky/ground ambient plus one warm sun with the scene's only shadow.
  scene.add(new HemisphereLight(0xcfe8ff, 0xe8cfa0, 1.15));
  const sun = new DirectionalLight(0xfff1d6, 2.7);
  sun.position.set(7, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(FOCUS);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 60;
  controls.maxPolarAngle = 1.5; // never dip below the ground
  controls.autoRotate = true; // gentle turntable until the player touches the screen
  controls.autoRotateSpeed = 0.35;

  let touched = false;
  controls.addEventListener('start', () => {
    touched = true;
    controls.autoRotate = false;
  });
  // Keep the pan target near the patch so the scene cannot be lost.
  controls.addEventListener('change', () => {
    const t = controls.target;
    const d = Math.hypot(t.x, t.z);
    if (d > 8) t.multiplyScalar(8 / d).setY(t.y);
    t.y = Math.min(4, Math.max(0, t.y));
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!touched) {
      // Frame the whole patch whether the phone is upright or sideways.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      // Width must fit the whole patch edge to edge; height only needs the tighter radius.
      // Taking the larger distance also covers near-square screens.
      const dist = Math.max((FIT_RADIUS + 2) / Math.sin(hFov / 2), FIT_RADIUS / Math.sin(vFov / 2));
      camera.position.copy(FOCUS).addScaledVector(VIEW_DIR, dist);
    }
  };
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, controls, sun, basePixelRatio };
}

import { DirectionalLight, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 'overview' is the free camera over the district; 'eye' follows a character at head height. */
export type ViewMode = 'overview' | 'eye';

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  sun: DirectionalLight;
  /** Largest pixel ratio this device will be rendered at. */
  basePixelRatio: number;
  readonly mode: ViewMode;
  /** Switches the view. For 'eye', `focus` is the head to follow and `yaw` the way it faces. */
  setMode(mode: ViewMode, focus?: Vector3, yaw?: number): void;
  /** Call every frame with the followed character's head position. Does nothing in overview. */
  follow(focus: Vector3): void;
  /** Call after buildings appear or change: the shadow is drawn once and must be redrawn. */
  refreshShadows(): void;
  /** Turns the sun's shadow on or off. */
  setShadows(on: boolean): void;
}

const VIEW_DIR = new Vector3(0.6, 0.5, 0.78).normalize();
const SUN_DIR = new Vector3(7, 12, 6).normalize();
/** Radius that must fit the screen's height, and its width, when the district is first shown. */
const FIT_HEIGHT = 72;
const FIT_WIDTH = 98;
/** How far from the centre the camera target may be dragged. */
const TARGET_LIMIT = 80;
const OVERVIEW_FOV = 32;
const EYE_FOV = 55;

export function createStage(canvas: HTMLCanvasElement): Stage {
  // Fail with a clear message (shown by the on-screen crash box) when 3D drawing is unavailable.
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('WebGL2 is not available in this browser');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const basePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(basePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  // Everything that casts a shadow stands still, so the shadow is drawn once, not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(OVERVIEW_FOV, 1, 0.4, 600);

  // Cheap lighting: sky/ground ambient plus one warm sun with the scene's only shadow.
  scene.add(new HemisphereLight(0xcfe8ff, 0xe8cfa0, 1.15));
  const sun = new DirectionalLight(0xfff1d6, 2.7);
  sun.position.copy(SUN_DIR).multiplyScalar(160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 300;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.08;
  scene.add(sun);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  let mode: ViewMode = 'overview';
  let touched = false;
  const savedPosition = new Vector3();
  const savedTarget = new Vector3();
  const delta = new Vector3();

  const applyLimits = () => {
    const eye = mode === 'eye';
    controls.enablePan = !eye;
    controls.minDistance = eye ? 2.2 : 8;
    controls.maxDistance = eye ? 7 : 380;
    controls.minPolarAngle = eye ? 0.95 : 0;
    controls.maxPolarAngle = eye ? 1.56 : 1.45; // never dip below the ground
    controls.autoRotate = !eye && !touched; // gentle turntable until the player touches the screen
    controls.autoRotateSpeed = 0.25;
    camera.fov = eye ? EYE_FOV : OVERVIEW_FOV;
    camera.updateProjectionMatrix();
  };
  applyLimits();

  controls.addEventListener('start', () => {
    touched = true;
    controls.autoRotate = false;
  });
  // Keep the pan target over the district so the scene cannot be lost.
  controls.addEventListener('change', () => {
    if (mode !== 'overview') return;
    const t = controls.target;
    const d = Math.hypot(t.x, t.z);
    if (d > TARGET_LIMIT) t.multiplyScalar(TARGET_LIMIT / d);
    t.y = Math.min(6, Math.max(0, t.y));
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!touched && mode === 'overview') {
      // Frame the whole district whether the phone is upright or sideways.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist = Math.max(FIT_WIDTH / Math.sin(hFov / 2), FIT_HEIGHT / Math.sin(vFov / 2));
      controls.target.set(0, 0, 0);
      camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    }
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    controls,
    sun,
    basePixelRatio,
    get mode() {
      return mode;
    },
    setMode(next, focus, yaw = 0) {
      if (next === mode) return;
      if (next === 'eye' && focus) {
        savedPosition.copy(camera.position);
        savedTarget.copy(controls.target);
        mode = next;
        applyLimits();
        // Start just behind and slightly above the character's shoulder.
        controls.target.copy(focus);
        camera.position.set(focus.x - Math.sin(yaw) * 3.6, focus.y + 0.7, focus.z - Math.cos(yaw) * 3.6);
      } else {
        mode = 'overview';
        applyLimits();
        controls.target.copy(savedTarget);
        camera.position.copy(savedPosition);
      }
      controls.update();
    },
    follow(focus) {
      if (mode !== 'eye') return;
      // Carry the camera along with the character, keeping whatever angle the player chose.
      delta.subVectors(focus, controls.target);
      camera.position.add(delta);
      controls.target.copy(focus);
    },
    refreshShadows() {
      renderer.shadowMap.needsUpdate = true;
    },
    setShadows(on) {
      if (sun.castShadow === on) return;
      sun.castShadow = on;
      if (on) renderer.shadowMap.needsUpdate = true;
    },
  };
}

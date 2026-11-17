import { DirectionalLight, Fog, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** 'overview' is the free camera round the stadium; 'eye' sits just behind a character (the player's seat). */
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
  /** In eye view: puts the camera distance behind a head that faces yaw (add pi to see the face). */
  lookFrom(focus: Vector3, yaw: number, distance?: number): void;
  /** Call every frame with the followed character's head position. Does nothing in overview. */
  follow(focus: Vector3): void;
  /** Moves the picture up by this fraction of the screen height, to keep the subject clear of a bottom sheet. 0 resets. */
  setLift(fraction: number): void;
  /** Call after buildings appear or change: the shadow is drawn once and must be redrawn. */
  refreshShadows(): void;
  /** Turns the sun's shadow on or off. */
  setShadows(on: boolean): void;
}

const VIEW_DIR = new Vector3(0.5, 0.62, 0.6).normalize();
/** Towards the sun: high in the south-west, so one stand is in its own shade and the other bright. */
export const SUN_DIR = new Vector3(-0.42, 0.78, 0.46).normalize();
/** The sky's colour at the horizon; the haze fades distant things into it. */
export const HORIZON = 0xdfeaf0;
/** Radius that must fit the screen's height, and its width, when the stadium is first shown. */
const FIT_HEIGHT = 112;
const FIT_WIDTH = 118;
/** How far from the centre the camera target may be dragged. */
const TARGET_LIMIT = 150;
const OVERVIEW_FOV = 34;
const EYE_FOV = 58;

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
  scene.fog = new Fog(HORIZON, 420, 2400);
  const camera = new PerspectiveCamera(OVERVIEW_FOV, 1, 0.25, 3200);

  // Cheap lighting: sky/ground ambient plus one warm sun with the scene's only shadow.
  scene.add(new HemisphereLight(0xd2e9ff, 0xa89c86, 1.1));
  const sun = new DirectionalLight(0xfff0d8, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.camera.near = 150;
  sun.shadow.camera.far = 650;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.3;
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
    controls.minDistance = eye ? 1.4 : 20;
    controls.maxDistance = eye ? 10 : 1100;
    controls.minPolarAngle = eye ? 0.45 : 0;
    controls.maxPolarAngle = eye ? 1.62 : 1.42; // never dip below the ground
    controls.autoRotate = !eye && !touched; // gentle turntable until the player touches the screen
    controls.autoRotateSpeed = 0.25;
    camera.fov = eye ? EYE_FOV : OVERVIEW_FOV;
    // Depth precision: a close near plane only in the seat view; far views keep thin layers apart.
    camera.near = eye ? 0.15 : 2;
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
    t.y = Math.min(45, Math.max(0, t.y));
  });

  let lift = 0;
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (lift) camera.setViewOffset(w, h, 0, lift * h, w, h);
    else camera.clearViewOffset();
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
    lookFrom(focus, yaw, distance = 3.6) {
      if (mode !== 'eye') return;
      controls.target.copy(focus);
      camera.position.set(focus.x - Math.sin(yaw) * distance, focus.y + 0.25 * distance, focus.z - Math.cos(yaw) * distance);
      controls.update();
    },
    follow(focus) {
      if (mode !== 'eye') return;
      // Carry the camera along with the character, keeping whatever angle the player chose.
      delta.subVectors(focus, controls.target);
      camera.position.add(delta);
      controls.target.copy(focus);
    },
    setLift(fraction) {
      if (fraction === lift) return;
      lift = fraction;
      resize();
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

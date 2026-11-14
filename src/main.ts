import { Mesh, Timer, Vector3 } from 'three';
import { seededRandom } from './art/builder';
import { GAME } from './config/game';
import { AutoQuality } from './engine/quality';
import { createStage } from './engine/stage';
import { StatsOverlay } from './engine/stats';
import { applyToDom, getLocale, onLocaleChange, setLocale, t } from './i18n';
import { Character } from './world/character';
import { createClouds } from './world/clouds';
import { BLOB_Y, CROWD_MAX, Crowd, blobGeometry, blobMaterial } from './world/crowd';
import { createGround } from './world/ground';
import { computePose, createPose } from './world/pose';
import { createTown } from './world/town';
import { Walker } from './world/walker';

const stage = createStage(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera, controls } = stage;

// World: the district floor, houses and trees, clouds, the crowd, and the player's own character.
scene.add(createGround());
const town = createTown();
scene.add(town.group);
const clouds = createClouds();
scene.add(clouds.mesh);
const crowd = new Crowd();
scene.add(crowd.group);

// The player's character. Until accounts exist it strolls by itself like everyone else.
const player = new Character();
const playerWalker = new Walker(seededRandom(99), { scale: 1, cadence: 1, lane: 1.6 });
crowd.guests.push(playerWalker);
const playerPose = createPose();
const playerBlob = new Mesh(blobGeometry, blobMaterial);
player.root.traverse((o) => {
  // Moving things use the ground blob instead of the real shadow, which is drawn only once.
  o.castShadow = false;
  o.receiveShadow = false;
});
scene.add(player.root, playerBlob);
const HEAD_HEIGHT = 1.25;
const head = new Vector3();

// Interface.
document.title = GAME.name;
document.querySelector('#game-name')!.textContent = GAME.name;
const langButton = document.querySelector<HTMLButtonElement>('#btn-lang')!;
const viewButton = document.querySelector<HTMLButtonElement>('#btn-view')!;
const crowdButton = document.querySelector<HTMLButtonElement>('#btn-crowd')!;
const housesButton = document.querySelector<HTMLButtonElement>('#btn-houses')!;
const buildButton = document.querySelector<HTMLButtonElement>('#btn-build')!;
const CROWD_SIZES = [50, 100, 150, CROWD_MAX];
// Preview controls until the server drives them: how full the town is, and how far the shared buildings have got.
const HOUSE_FRACTIONS = [0.1, 0.35, 0.65, 1];
let houseStep = HOUSE_FRACTIONS.length - 1;
let buildStage = town.maxStage;
town.setStage(buildStage);

const showLabels = () => {
  // Each button shows what pressing it would switch to.
  langButton.textContent = getLocale() === 'tr' ? 'EN' : 'TR';
  viewButton.textContent = t(stage.mode === 'eye' ? 'view.overview' : 'view.eye');
  crowdButton.textContent = `${t('crowd.button')}: ${crowd.count}`;
  housesButton.textContent = `${t('houses.button')}: ${town.houses}/${town.lotCount}`;
  buildButton.textContent = `${t('build.button')}: ${buildStage}/${town.maxStage}`;
};
langButton.addEventListener('click', () => setLocale(getLocale() === 'tr' ? 'en' : 'tr'));
viewButton.addEventListener('click', () => {
  stage.setMode(stage.mode === 'eye' ? 'overview' : 'eye', head, playerWalker.yaw);
  showLabels();
});
crowdButton.addEventListener('click', () => {
  crowd.count = CROWD_SIZES[(CROWD_SIZES.indexOf(crowd.count) + 1) % CROWD_SIZES.length];
  showLabels();
});
housesButton.addEventListener('click', () => {
  houseStep = (houseStep + 1) % HOUSE_FRACTIONS.length;
  town.setHouses(town.lotCount * HOUSE_FRACTIONS[houseStep]);
  stage.refreshShadows();
  showLabels();
});
buildButton.addEventListener('click', () => {
  buildStage = (buildStage + 1) % (town.maxStage + 1);
  town.setStage(buildStage);
  stage.refreshShadows();
  showLabels();
});
onLocaleChange(showLabels);
applyToDom();
showLabels();

const quality = new AutoQuality(stage);
const stats = new StatsOverlay(document.querySelector<HTMLElement>('#stats')!, renderer, quality, () => [
  [t('stats.people'), `${crowd.visible} / ${crowd.count}`],
]);
document.querySelector('#btn-stats')!.addEventListener('click', () => stats.toggle());
// Address options for measuring: ?stats opens the overlay, ?quality=1..6 holds one quality step.
const params = new URLSearchParams(location.search);
if (params.has('stats')) stats.toggle(true);
if (params.has('quality')) quality.lock(Number(params.get('quality')));

const hint = document.querySelector<HTMLElement>('.hint')!;
controls.addEventListener('start', () => hint.classList.add('gone'));

// Main loop.
let time = 0;
function step(dt: number): void {
  time += dt;

  playerWalker.update(dt);
  player.root.position.set(playerWalker.x, 0, playerWalker.z);
  player.root.rotation.y = playerWalker.yaw;
  player.applyPose(computePose(playerPose, playerWalker.phase, playerWalker.time, playerWalker.walk, playerWalker.wave));
  playerBlob.position.set(playerWalker.x, BLOB_Y, playerWalker.z);
  head.set(playerWalker.x, HEAD_HEIGHT, playerWalker.z);

  stage.follow(head);
  controls.update();

  crowd.range = quality.crowdRange;
  crowd.update(dt, camera, controls.target);
  town.update(time);
  clouds.update(dt);
  renderer.render(scene, camera);
}

const timer = new Timer();
timer.connect(document);
renderer.setAnimationLoop((now) => {
  timer.update(now);
  const raw = timer.getDelta();
  step(Math.min(raw, 0.1));
  quality.frame(raw);
  stats.frame(raw);
});

// Development only: lets a test advance the scene by exact amounts of time.
if (import.meta.env.DEV) {
  Object.assign(window, { __dev: { step, stage, crowd, quality, renderer, town } });
}

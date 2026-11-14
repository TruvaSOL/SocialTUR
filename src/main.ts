import { Timer } from 'three';
import { GAME } from './config/game';
import { AutoQuality } from './engine/quality';
import { createStage } from './engine/stage';
import { StatsOverlay } from './engine/stats';
import { applyToDom, getLocale, setLocale } from './i18n';
import { Character } from './world/character';
import { createClouds } from './world/clouds';
import { createGround } from './world/ground';
import { createHouse } from './world/house';
import { HOUSE_POS, TREE_POS } from './world/layout';
import { Stroller } from './world/stroller';
import { createTree } from './world/tree';

const stage = createStage(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera, controls } = stage;

// World: one ground patch, one house, one tree, one character.
scene.add(createGround());

const house = createHouse();
house.group.position.set(HOUSE_POS.x, 0, HOUSE_POS.z);
scene.add(house.group);

const tree = createTree();
tree.group.position.set(TREE_POS.x, 0, TREE_POS.z);
tree.group.rotation.y = 0.6;
scene.add(tree.group);

const clouds = createClouds();
scene.add(clouds.group);

const stroller = new Stroller(new Character());
stroller.character.root.traverse((o) => {
  o.receiveShadow = false; // tiny parts shadowing each other only adds noise
});
scene.add(stroller.character.root);

// Interface.
document.title = GAME.name;
document.querySelector('#game-name')!.textContent = GAME.name;
const langButton = document.querySelector<HTMLButtonElement>('#btn-lang')!;
const showLang = () => {
  // The button shows the language you would switch to.
  langButton.textContent = getLocale() === 'tr' ? 'EN' : 'TR';
};
langButton.addEventListener('click', () => {
  setLocale(getLocale() === 'tr' ? 'en' : 'tr');
  showLang();
});
applyToDom();
showLang();

const quality = new AutoQuality(stage);
const stats = new StatsOverlay(document.querySelector<HTMLElement>('#stats')!, renderer, quality);
document.querySelector('#btn-stats')!.addEventListener('click', () => stats.toggle());
if (new URLSearchParams(location.search).has('stats')) stats.toggle(true);

const hint = document.querySelector<HTMLElement>('.hint')!;
controls.addEventListener('start', () => hint.classList.add('gone'));

// Main loop.
let time = 0;
function step(dt: number): void {
  time += dt;
  stroller.update(dt, camera);
  tree.update(time);
  house.update(time);
  clouds.update(dt);
  controls.update();
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
  Object.assign(window, { __dev: { step, camera, controls, character: stroller.character } });
}

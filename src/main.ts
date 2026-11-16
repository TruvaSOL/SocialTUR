import { Mesh, Timer, Vector3 } from 'three';
import { seededRandom } from './art/builder';
import { GAME } from './config/game';
import { AutoQuality } from './engine/quality';
import { createStage } from './engine/stage';
import { StatsOverlay } from './engine/stats';
import { type Profile, loadProfile, saveProfile } from './game/profile';
import { arrive, loadOwnProfile, onSignedIn, saveCharacter, sendSignInLink, serverReady, signedInUser } from './game/server';
import { applyToDom, getLocale, onLocaleChange, setLocale, t } from './i18n';
import { Onboarding } from './ui/onboarding';
import { Arrival } from './world/arrival';
import { Character } from './world/character';
import { createClouds } from './world/clouds';
import { BLOB_Y, CROWD_MAX, Crowd, blobGeometry, blobMaterial } from './world/crowd';
import { createGround } from './world/ground';
import { computePose, createPose } from './world/pose';
import { createTown } from './world/town';
import { Walker } from './world/walker';

const stage = createStage(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera, controls } = stage;

// World: the island floor, the town, clouds, the crowd, and the player's own character.
scene.add(createGround());
const town = createTown();
scene.add(town.group);
const clouds = createClouds();
scene.add(clouds.mesh);
const crowd = new Crowd();
scene.add(crowd.group);

// The player's character. Until the server exists it strolls by itself once it has arrived.
let profile: Profile | null = loadProfile();
const player = new Character(profile?.look);
const playerWalker = new Walker(seededRandom(99), { scale: 1, cadence: 1, lane: 1.6 });
crowd.guests.push(playerWalker);
const playerPose = createPose();
const playerBlob = new Mesh(blobGeometry, blobMaterial);
scene.add(player.root, playerBlob);
const HEAD_HEIGHT = 1.25;
const head = new Vector3();
const arrival = new Arrival(town.ferry);

/**
 * What the player is doing:
 * 'intro' reading the welcome and age steps over a view of the town,
 * 'creating' making a character on the ferry, 'arriving' sailing in and walking ashore,
 * 'playing' in town, 'editing' changing the character later.
 */
type Mode = 'intro' | 'creating' | 'arriving' | 'playing' | 'editing';
let mode: Mode = 'playing';
/** Where the character stands and faces while it is not walking the streets. */
const pose = { x: 0, y: 0, z: 0, yaw: 0, walk: 0, wave: 0, cycle: 0, time: 0 };

// Interface.
const ui = document.querySelector<HTMLElement>('#ui')!;
document.title = GAME.name;
document.querySelector('#game-name')!.textContent = GAME.name;
const langButton = document.querySelector<HTMLButtonElement>('#btn-lang')!;
const viewButton = document.querySelector<HTMLButtonElement>('#btn-view')!;
const crowdButton = document.querySelector<HTMLButtonElement>('#btn-crowd')!;
const housesButton = document.querySelector<HTMLButtonElement>('#btn-houses')!;
const buildButton = document.querySelector<HTMLButtonElement>('#btn-build')!;
const characterButton = document.querySelector<HTMLButtonElement>('#btn-character')!;
const accountButton = document.querySelector<HTMLButtonElement>('#btn-account')!;
const banner = document.querySelector<HTMLElement>('#banner')!;
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

const setMode = (next: Mode) => {
  mode = next;
  ui.classList.toggle('onboarding', next !== 'playing');
};

const onboarding = new Onboarding(document.querySelector<HTMLElement>('#sheet')!, {
  onEditorOpen() {
    // Close-up of the character from the front.
    if (mode === 'intro') setMode('creating');
    stage.setMode('eye', head, pose.yaw + Math.PI);
    stage.lookFrom(head, pose.yaw + Math.PI, 3.3);
    stage.setLift(0.31); // the sheet covers the lower half; keep the character above it
    showLabels();
  },
  onLookChange(look) {
    player.setLook(look);
  },
});

function showBanner(current: Profile): void {
  banner.querySelector('strong')!.textContent = t('arrival.banner', { name: current.name });
  banner.querySelector('span')!.textContent =
    current.residentNo === null ? t('arrival.guest') : t('arrival.resident', { no: String(current.residentNo).padStart(4, '0') });
  banner.hidden = false;
  window.setTimeout(() => (banner.hidden = true), 9000);
}

/**
 * Brings this device and the server into agreement about who the player is.
 * Signed in with a record on the server: the server's record wins.
 * Signed in without one: the guest made on this device becomes a resident and gets a number.
 */
let syncing = false;
async function syncAccount(): Promise<void> {
  if (!serverReady || syncing) return;
  syncing = true;
  try {
    const userId = await signedInUser();
    accountButton.hidden = userId !== null;
    if (!userId) return;
    const own = await loadOwnProfile(userId);
    if (own) {
      profile = own;
      saveProfile(own);
      player.setLook(own.look);
      if (mode === 'intro' || mode === 'creating') {
        // A resident on a new device: no need to make a character again.
        onboarding.dismiss();
        arrival.moor();
        stage.setLift(0);
        stage.setMode('overview');
        setMode('playing');
        showLabels();
      }
    } else if (profile && profile.residentNo === null) {
      const residentNo = await arrive(profile, getLocale());
      if (residentNo !== null) {
        profile = { ...profile, residentNo };
        saveProfile(profile);
        showBanner(profile);
      }
    }
  } finally {
    syncing = false;
  }
}

function beginFirstVisit(): void {
  setMode('intro');
  arrival.wait();
  onboarding.startNew((resident) => {
    // No account yet: the newcomer is a guest kept on this device.
    profile = { ...resident, residentNo: null };
    saveProfile(profile);
    setMode('arriving');
    arrival.sail();
    stage.setMode('eye', head, arrival.yaw);
    stage.setLift(0);
    stage.lookFrom(head, -Math.PI / 2 - 0.9, 9); // off the ferry's side, looking past the character at the island
    showLabels();
    void syncAccount(); // already signed in: the new character becomes a resident straight away
  });
}

langButton.addEventListener('click', () => setLocale(getLocale() === 'tr' ? 'en' : 'tr'));
viewButton.addEventListener('click', () => {
  stage.setMode(stage.mode === 'eye' ? 'overview' : 'eye', head, pose.yaw);
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
characterButton.addEventListener('click', () => {
  if (!profile || mode !== 'playing') return;
  setMode('editing');
  pose.walk = 0;
  pose.wave = 0;
  onboarding.edit(profile.name, profile.look, (name, look) => {
    profile = { ...profile!, name, look };
    saveProfile(profile);
    if (profile.residentNo !== null) void saveCharacter(name, look);
    stage.setLift(0);
    setMode('playing');
  });
});
accountButton.addEventListener('click', () => {
  if (mode !== 'playing') return;
  setMode('editing'); // stand still while the sheet is open
  pose.walk = 0;
  pose.wave = 0;
  onboarding.askAccount(sendSignInLink, () => setMode('playing'));
});
accountButton.hidden = true;
onSignedIn(() => void syncAccount());
void syncAccount();

onLocaleChange(() => {
  showLabels();
  onboarding.refresh();
});
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

if (!profile) beginFirstVisit();

// Main loop.
let time = 0;
function step(dt: number): void {
  time += dt;
  town.update(time); // first: it moves the ferry the newcomer may be standing on

  if (mode === 'playing') {
    playerWalker.update(dt);
    pose.x = playerWalker.x;
    pose.y = 0;
    pose.z = playerWalker.z;
    pose.yaw = playerWalker.yaw;
    pose.walk = playerWalker.walk;
    pose.wave = playerWalker.wave;
    pose.cycle = playerWalker.phase;
    pose.time = playerWalker.time;
  } else if (mode === 'editing') {
    pose.time += dt; // standing still, breathing
  } else {
    const before = arrival.phase;
    arrival.update(dt);
    pose.x = arrival.x;
    pose.y = arrival.y;
    pose.z = arrival.z;
    pose.yaw = arrival.yaw;
    pose.walk = arrival.walk;
    pose.wave = arrival.wave;
    pose.cycle = arrival.cycle;
    pose.time = arrival.time;
    if (before === 'walking' && arrival.phase === 'greeting' && profile) {
      // Stepping onto the island: the announcement goes up and people nearby wave back.
      showBanner(profile);
      crowd.greetNear(pose.x, pose.z, 30);
    }
    if (mode === 'arriving' && arrival.phase === 'done') {
      playerWalker.placeNear(pose.x, pose.z, 5, 2);
      playerWalker.yaw = pose.yaw;
      setMode('playing');
    }
    // Keep the stand-in walker where the character is, so the crowd steps around it.
    playerWalker.x = pose.x;
    playerWalker.z = pose.z;
  }

  player.root.position.set(pose.x, pose.y, pose.z);
  player.root.rotation.y = pose.yaw;
  player.applyPose(computePose(playerPose, pose.cycle, pose.time, pose.walk, pose.wave));
  playerBlob.position.set(pose.x, pose.y + BLOB_Y, pose.z);
  head.set(pose.x, pose.y + HEAD_HEIGHT, pose.z);

  stage.follow(head);
  controls.update();

  crowd.range = quality.crowdRange;
  crowd.update(dt, camera, controls.target);
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
  Object.assign(window, { __dev: { step, stage, crowd, quality, renderer, town, arrival } });
}

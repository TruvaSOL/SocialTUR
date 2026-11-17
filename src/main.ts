import { Timer, Vector3 } from 'three';
import { type Ad, createAd } from './ad/director';
import { seededRandom } from './art/builder';
import { GAME } from './config/game';
import { AutoQuality } from './engine/quality';
import { SUN_DIR, createStage } from './engine/stage';
import { StatsOverlay } from './engine/stats';
import { type Profile, ageFromBirthYear, loadProfile, saveProfile } from './game/profile';
import {
  type FanRow,
  checkTicket,
  existingUser,
  loadChat,
  loadFans,
  loadOwnProfile,
  redeem,
  saveCharacter,
  sendChat,
  serverReady,
  subscribe,
} from './game/server';
import { type TextKey, applyToDom, getLocale, onLocaleChange, setLocale, t } from './i18n';
import { createFans, waveAt, waveLift } from './stadium/fans';
import { CAPACITY, SEATS, seatLabel } from './stadium/layout';
import { FAN_SCALE, FLOOR, NearFans } from './stadium/nearFans';
import { createPitch } from './stadium/pitch';
import { NearSeats } from './stadium/nearSeats';
import { createSeats } from './stadium/seats';
import { createLedTexture, createScoreboard } from './stadium/screens';
import { createStructure } from './stadium/structure';
import { createSurroundings } from './stadium/surroundings';
import { Chat } from './ui/chat';
import { Onboarding } from './ui/onboarding';
import { Character } from './world/character';
import { createClouds } from './world/clouds';
import { type Look, fanLook } from './world/looks';
import { computePose, computeSeatedPose, createPose } from './world/pose';

const stage = createStage(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera, controls } = stage;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- the stadium
const led = createLedTexture();
const structure = createStructure(led.texture);
const seats = createSeats();
const nearSeats = new NearSeats();
scene.add(createSurroundings(), structure.group, seats.mesh, nearSeats.group, createPitch(led.texture));
const board = createScoreboard(structure.screens);
scene.add(board.group);
const clouds = createClouds();
scene.add(clouds.mesh);
const fans = createFans(SUN_DIR);
scene.add(fans.mesh);
const near = new NearFans();
scene.add(near.group);

// The player's own character: on the centre spot while being made, then in their seat.
const player = new Character();
player.root.visible = false;
scene.add(player.root);
const playerPose = createPose();
const head = new Vector3();
/** The player's seat (0-based, best first), once they have one. */
let mySeat: number | null = null;
let profile: Profile | null = loadProfile();

/** Everyone in the stands, by seat. */
const crowd: (FanRow | null)[] = [];
let latestName: string | null = null;

function setFan(row: FanRow): void {
  const index = row.no - 1;
  if (index < 0 || index >= SEATS.count) return;
  crowd[index] = row;
  // The player's own seat is drawn by their own character.
  const look = index === mySeat ? null : row.look;
  fans.setFan(index, look);
  near.setFan(index, look);
  if (row.no > fans.count) {
    fans.setCount(row.no);
    latestName = row.name;
  }
  nearSeats.refresh();
}

// ---------------------------------------------------------------- interface
const ui = document.querySelector<HTMLElement>('#ui')!;
document.title = GAME.name;
document.querySelector('#game-name')!.textContent = GAME.name;
const langButton = document.querySelector<HTMLButtonElement>('#btn-lang')!;
const ticketButton = document.querySelector<HTMLButtonElement>('#btn-ticket')!;
const viewButton = document.querySelector<HTMLButtonElement>('#btn-view')!;
const characterButton = document.querySelector<HTMLButtonElement>('#btn-character')!;
const demoButton = document.querySelector<HTMLButtonElement>('#btn-demo')!;
const counter = document.querySelector<HTMLElement>('#counter')!;
const seatChip = document.querySelector<HTMLElement>('#seat-label')!;
const banner = document.querySelector<HTMLElement>('#banner')!;
const numberFormat = () => new Intl.NumberFormat(getLocale() === 'tr' ? 'tr-TR' : 'en-GB');

/** 'spectating' looks around; 'joining' is going through the ticket sheet; 'seated' has a seat. */
type Mode = 'spectating' | 'joining' | 'seated';
let mode: Mode = 'spectating';

function seatText(index: number): string {
  const s = seatLabel(index);
  return t('seat.label', { stand: t(`stand.${s.stand}` as TextKey), block: s.block, row: s.row, seat: s.seat });
}

function refreshLabels(): void {
  langButton.textContent = getLocale() === 'tr' ? 'EN' : 'TR';
  const fmt = numberFormat();
  counter.textContent = t('counter', { count: fmt.format(fans.count), capacity: fmt.format(CAPACITY) });
  // The view button names the view it would switch to.
  viewButton.textContent = t(nextView() === 'first' ? (mySeat === null ? 'view.trySeat' : 'view.first') : nextView() === 'eye' ? 'view.shoulder' : 'view.overview');
  ticketButton.hidden = mode !== 'spectating' || !serverReady;
  viewButton.hidden = mode === 'joining';
  characterButton.hidden = mode !== 'seated';
  seatChip.hidden = mySeat === null;
  if (mySeat !== null) seatChip.textContent = seatText(mySeat);
  demoButton.textContent = t('demo.button', { count: fmt.format(fans.count) });
  board.set(fans.count, CAPACITY, latestName);
}

function setMode(next: Mode): void {
  mode = next;
  ui.classList.toggle('onboarding', next === 'joining');
  refreshLabels();
}

function showBanner(name: string, fanNo: number): void {
  banner.querySelector('strong')!.textContent = t('arrival.banner', { name });
  banner.querySelector('span')!.textContent = `${seatText(fanNo - 1)} · ${t('arrival.fanNo', { no: fanNo })}`;
  banner.hidden = false;
  window.setTimeout(() => (banner.hidden = true), 10000);
}

// ---------------------------------------------------------------- camera moves
/** A smooth camera move from wherever it is to a new view. */
let flight: { from: Vector3; fromTarget: Vector3; to: Vector3; toTarget: Vector3; t: number; then: () => void } | null = null;
function flyTo(to: Vector3, toTarget: Vector3, then: () => void): void {
  controls.enabled = false;
  flight = { from: camera.position.clone(), fromTarget: controls.target.clone(), to, toTarget, t: 0, then };
}

/** Where the eyes of someone sitting in a seat are, just in front of the face. */
function eyePoint(index: number): Vector3 {
  const yaw = SEATS.yaw[index];
  return new Vector3(
    SEATS.pos[index * 3] + Math.sin(yaw) * 0.22,
    SEATS.pos[index * 3 + 1] + 0.92, // sitting tall, so the heads in the row in front stay low in the picture
    SEATS.pos[index * 3 + 2] + Math.cos(yaw) * 0.22,
  );
}

/** The seat the camera sits in: the player's own, or for a visitor the next free one (the seat they would get). */
function viewSeat(): number {
  return mySeat ?? Math.min(fans.count, SEATS.count - 1);
}

/** The views in the order the button steps through them. Visitors have no character to look over the shoulder of. */
function nextView(): 'overview' | 'first' | 'eye' {
  if (stage.mode === 'overview') return 'first';
  if (stage.mode === 'first' && mySeat !== null) return 'eye';
  return 'overview';
}

function goFirstPerson(fly: boolean): void {
  const index = viewSeat();
  const eye = eyePoint(index);
  const yaw = SEATS.yaw[index];
  const settle = () => {
    stage.enterFirstPerson(eye, yaw);
    refreshLabels();
  };
  if (fly) flyTo(eye, new Vector3(eye.x + Math.sin(yaw) * 30, eye.y - 4, eye.z + Math.cos(yaw) * 30), settle);
  else settle();
}

function seatView(index: number): { eye: Vector3; target: Vector3 } {
  const x = SEATS.pos[index * 3];
  const y = SEATS.pos[index * 3 + 1];
  const z = SEATS.pos[index * 3 + 2];
  const yaw = SEATS.yaw[index];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // Looking over the character's shoulder at the pitch, from high enough to clear the heads behind.
  const target = new Vector3(x + fx * 3.5, y + 0.7, z + fz * 3.5);
  const eye = new Vector3(x - fx * 1.3, y + 2.2, z - fz * 1.3);
  return { eye, target };
}

function goToSeat(fly: boolean): void {
  if (mySeat === null) return;
  const { eye, target } = seatView(mySeat);
  const settle = () => {
    stage.setMode('eye', target, SEATS.yaw[mySeat!]);
    camera.position.copy(eye);
    controls.target.copy(target);
    controls.update();
    refreshLabels();
  };
  if (fly) flyTo(eye, target, settle);
  else settle();
}

function takeSeat(index: number, fly: boolean): void {
  mySeat = index;
  // Whoever was drawn there by the crowd (it is us) steps aside for the real character.
  fans.setFan(index, null);
  near.setFan(index, null);
  if (index + 1 > fans.count) fans.setCount(index + 1);
  player.root.visible = true;
  setMode('seated');
  chat.setWriter(profile && ageFromBirthYear(profile.birthYear) >= 18 ? 'free' : 'presets', index + 1);
  nearSeats.refresh();
  goFirstPerson(fly);
}

// ---------------------------------------------------------------- joining
const onboarding = new Onboarding(document.querySelector<HTMLElement>('#sheet')!, {
  onEditorOpen() {
    if (mode !== 'seated') {
      // Being made on the centre spot, the whole stadium around.
      player.root.visible = true;
      // Low and close, so the stands rise behind the character.
      stage.setMode('eye', new Vector3(0, 1.05, 3), 0);
      camera.position.set(0, 1.2, 7.6);
      controls.target.set(0, 1.05, 3);
      controls.update();
    }
    stage.setLift(0.3);
  },
  onLookChange(look) {
    player.setLook(look);
  },
  checkTicket,
  async takeSeat(fan) {
    const result = await redeem(fan.code, { name: fan.name, birthYear: fan.birthYear, look: fan.look }, getLocale());
    if (!result.ok) return result;
    profile = { name: fan.name, birthYear: fan.birthYear, look: fan.look, residentNo: result.fanNo };
    saveProfile(profile);
    stage.setLift(0);
    crowd[result.fanNo - 1] = { no: result.fanNo, name: fan.name, look: fan.look };
    latestName = fan.name;
    takeSeat(result.fanNo - 1, true);
    showBanner(fan.name, result.fanNo);
    return result;
  },
  onSpectate() {
    stage.setLift(0);
    player.root.visible = false;
    stage.setMode('overview');
    setMode('spectating');
  },
});

function startJoining(): void {
  setMode('joining');
  stage.setLift(0.18); // keep the stadium clear of the sheet
  onboarding.startNew(params.get('kod') ?? params.get('code') ?? '');
}

langButton.addEventListener('click', () => setLocale(getLocale() === 'tr' ? 'en' : 'tr'));
ticketButton.addEventListener('click', startJoining);
viewButton.addEventListener('click', () => {
  if (flight) return;
  const next = nextView();
  if (next === 'first') goFirstPerson(true);
  else if (next === 'eye') goToSeat(false);
  else {
    stage.setMode('overview');
    refreshLabels();
  }
});
characterButton.addEventListener('click', () => {
  if (!profile || mode !== 'seated') return;
  goToSeat(false); // the editor needs to see the character
  onboarding.edit(profile.name, profile.look, (name, look) => {
    profile = { ...profile!, name, look };
    saveProfile(profile);
    stage.setLift(0);
    void saveCharacter(name, look);
    goFirstPerson(false);
  });
});

const chat = new Chat(document.querySelector<HTMLElement>('#chat')!, document.querySelector<HTMLButtonElement>('#btn-chat')!, sendChat);

onLocaleChange(() => {
  refreshLabels();
  onboarding.refresh();
  chat.refresh();
  led.redraw();
  board.redraw();
});
applyToDom();

// ---------------------------------------------------------------- preview fill (?demo)
// Fills the stands with made-up fans so the stadium can be judged empty, half full or full.
// Nothing is sent to the server; only this screen changes.
const DEMO_STEPS = [0, 1000, 10000, 25000, 50000];
let demoStep = 0;
function demoFill(count: number): void {
  const rnd = seededRandom(2024);
  for (let i = 0; i < SEATS.count; i++) {
    const look: Look | null = i < count ? fanLook(rnd) : null;
    fans.setFan(i, look);
    near.setFan(i, look);
  }
  fans.setCount(count);
  nearSeats.refresh();
  latestName = null;
  refreshLabels();
}
if (params.has('demo')) {
  demoButton.hidden = false;
  demoButton.addEventListener('click', () => {
    demoStep = (demoStep + 1) % DEMO_STEPS.length;
    demoFill(DEMO_STEPS[demoStep]);
  });
  const start = Number(params.get('demo'));
  if (start > 0) {
    const known = DEMO_STEPS.indexOf(start);
    demoStep = known >= 0 ? known : 0;
    demoFill(Math.min(SEATS.count, start));
  }
}

// ---------------------------------------------------------------- advert mode (?reklam)
// Plays a fixed clip for screen recording. Uses the preview crowd; nothing is sent to the server.
let ad: Ad | null = null;
if (params.has('reklam')) {
  demoFill(SEATS.count);
  fans.setCount(0);
  ui.classList.add('ad');
  controls.enabled = false;
  controls.autoRotate = false;
  camera.near = 0.3;
  camera.updateProjectionMatrix();
  let boardAt = 0;
  ad = createAd(
    {
      camera,
      capacity: CAPACITY,
      eyePoint,
      screen: structure.screens[0],
      setCount(count) {
        fans.setCount(count);
        near.refresh();
        nearSeats.refresh();
        // Redrawing the big screen is not free; a few times a second is plenty while the stands fill.
        const now = performance.now();
        if (count === 0 || count === CAPACITY || now - boardAt > 120) {
          boardAt = now;
          board.set(count, CAPACITY, null);
        }
      },
    },
    document.querySelector<HTMLElement>('#ad')!,
  );
}

// ---------------------------------------------------------------- measuring
const quality = new AutoQuality(stage);
const stats = new StatsOverlay(document.querySelector<HTMLElement>('#stats')!, renderer, quality, () => [
  [t('stats.fans'), numberFormat().format(fans.count)],
  [t('stats.near'), `${near.drawn} + ${nearSeats.drawn}`],
]);
document.querySelector('#btn-stats')!.addEventListener('click', () => stats.toggle());
if (params.has('stats')) stats.toggle(true);
if (params.has('quality')) quality.lock(Number(params.get('quality')));

const hint = document.querySelector<HTMLElement>('.hint')!;
controls.addEventListener('start', () => hint.classList.add('gone'));

// ---------------------------------------------------------------- start-up
async function boot(): Promise<void> {
  refreshLabels();
  if (!serverReady || params.has('demo') || params.has('reklam')) return;

  const userId = await existingUser();
  if (userId) {
    const own = await loadOwnProfile(userId);
    if (own) {
      profile = own;
      saveProfile(own);
    }
  }
  if (profile?.residentNo && userId) {
    player.setLook(profile.look);
    takeSeat(profile.residentNo - 1, false);
  } else {
    profile = null;
    startJoining();
  }

  subscribe(
    (row) => {
      setFan(row);
      refreshLabels();
    },
    (message) => chat.add([message]),
  );
  void loadChat().then((messages) => chat.add(messages));
  await loadFans((rows) => {
    for (const row of rows) setFan(row);
    refreshLabels();
  });
  // The latest arrival is the highest number.
  const last = crowd[fans.count - 1];
  if (last) latestName = last.name;
  refreshLabels();
}
void boot();

// ---------------------------------------------------------------- main loop
let time = 0;
function step(dt: number): void {
  time += dt;

  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 2.6);
    const k = flight.t * flight.t * (3 - 2 * flight.t);
    camera.position.lerpVectors(flight.from, flight.to, k);
    // Rise in the middle of the move, so the camera sweeps over the stands rather than through them.
    camera.position.y += Math.sin(Math.PI * k) * 30;
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
    camera.lookAt(controls.target);
    if (flight.t >= 1) {
      const done = flight.then;
      flight = null;
      controls.enabled = true;
      done();
    }
  }

  // The player's character: in their seat, or standing on the centre spot while being made.
  // Looking out of their own eyes they do not see themselves.
  player.root.visible = stage.mode !== 'first' && (mySeat !== null || onboarding.open);
  if (player.root.visible) {
    if (mySeat !== null) {
      const x = SEATS.pos[mySeat * 3];
      const y = SEATS.pos[mySeat * 3 + 1];
      const z = SEATS.pos[mySeat * 3 + 2];
      player.root.position.set(x, y, z);
      player.root.rotation.y = SEATS.yaw[mySeat];
      player.root.scale.setScalar(FAN_SCALE);
      const lift = waveLift(x, z, waveAt(time));
      player.applyPose(computeSeatedPose(playerPose, time, 0.5, lift, lift * 0.9, FLOOR));
      head.set(x, y + 1.0, z);
    } else {
      player.root.position.set(0, 0, 3);
      player.root.rotation.y = 0;
      player.root.scale.setScalar(1);
      player.applyPose(computePose(playerPose, 0, time, 0, 0));
    }
  }

  if (ad) ad.update(dt);
  else if (!flight) stage.update();
  near.max = quality.near3d;
  // Looking out of a seat, only that seat's own occupant steps aside; the neighbours stay.
  near.keepOut = ad || stage.mode === 'first' ? 1.0 : 1.05;
  nearSeats.update(camera.position, (i) => i === mySeat || fans.taken(i));
  seats.setNear(camera.position, nearSeats.radius);
  near.update(time, camera.position, fans.count, 11);
  fans.update(time, near.splitEye, near.radius);
  led.update(dt);
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
  Object.assign(window, { __dev: { step, stage, fans, near, nearSeats, ad, quality, renderer, demoFill, takeSeat, chat, onboarding, goFirstPerson } });
}

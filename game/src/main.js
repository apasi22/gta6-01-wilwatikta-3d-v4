// WILWATIKTA 3D v4 — boot, game loop, input, camera, rendering, screens.
// One open world: drive, walk, fight, chase, and run 12 missions across six
// districts, staged deterministically for screenshots with ?shot=&seed=.
import { RNG, hashSeed } from './random.js';
import { WORLD, roadAt, districtAt, paletteAt, CARS, WEAPONS, MISSIONS, RADIOS, DISPATCH, FACADES } from './config.js';
import { Renderer, Mesh, matPerspective, matLookAt, matMul, matModel } from './gl.js';
import { buildCity } from './city.js';
import {
  buildCarBody, buildCarDetail, buildLightBar, buildBarrier, buildCone,
  makeCar, driveCar, updateTraffic, drawCar, collideCircle,
} from './vehicles.js';
import { buildPersonBody, buildPersonRest, buildPersonLegs, buildRing, makePerson, updatePed, drawPerson } from './character.js';
import {
  buildHeliBody, buildHeliRotor, buildConeMesh, buildPoolMesh,
  makeHeli, updateHeli, drawHeli, makePolice, updatePolice, addWanted, wantedLabel,
} from './police.js';
import {
  buildFlashMesh, buildTracerMesh, buildSparkMesh, buildSmokeMesh, buildPickupMesh,
  buildBeaconMesh, buildDiamondMesh, makeEffects, updateEffects, drawEffects,
  fireWeapon, startReload, finishReload, damagePlayer, spawnSmoke, spawnSparks,
} from './combat.js';
import { makeMissions, startMission, updateMissions, drawBeacon } from './missions.js';
import { makeAudio } from './audio.js';
import { saveGame, loadGame, applySave } from './save.js';
import { initHUD, showScreen, updateHUD } from './hud.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT = params.get('shot') || '';

const canvas = document.getElementById('game');
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const rng = RNG(hashSeed('wilwatikta-v4-' + SEED));
const renderer = new Renderer(canvas);
const city = buildCity(rng);
const cityBuf = renderer.upload(city.mesh);

// Upload all dynamic meshes once.
const carBodyMesh = buildCarBody(4.6, 2.0);
const carDetailMesh = buildCarDetail(4.6, 2.0);
const dentMesh = (() => { const m = new Mesh(); m.box(-1.9, 1.0, 0, 0.9, 0.12, 1.5, [0.1, 0.1, 0.1], 0.0); return m; })();
const bufs = {
  body: renderer.upload(carBodyMesh),
  detail: renderer.upload(carDetailMesh),
  dent: renderer.upload(dentMesh),
  bar: renderer.upload(buildLightBar()),
  barrier: renderer.upload(buildBarrier()),
  cone: renderer.upload(buildCone()),
  personBody: renderer.upload(buildPersonBody()),
  personLegs: (() => { const l = buildPersonLegs(); return { left: renderer.upload(l.left), right: renderer.upload(l.right) }; })(),
  ring: renderer.upload(buildRing()),
  heliBody: renderer.upload(buildHeliBody()),
  heliRotor: renderer.upload(buildHeliRotor()),
  coneMesh: renderer.upload(buildConeMesh()),
  pool: renderer.upload(buildPoolMesh()),
  flash: renderer.upload(buildFlashMesh()),
  tracer: renderer.upload(buildTracerMesh()),
  spark: renderer.upload(buildSparkMesh()),
  smoke: renderer.upload(buildSmokeMesh()),
  pickup: renderer.upload(buildPickupMesh()),
  beacon: renderer.upload(buildBeaconMesh()),
  diamond: renderer.upload(buildDiamondMesh()),
};
const personRests = {};
function restBuf(skinKey) {
  if (!personRests[skinKey]) personRests[skinKey] = renderer.upload(buildPersonRest([0.80, 0.60, 0.45]));
  return personRests[skinKey];
}

const game = {
  rng, time: 0, hour: 18.6, day: 1, hourFixed: false,
  cash: 500, rep: 0, wanted: 0, wantedFlash: 0,
  colliders: city.colliders, cars: [], peds: [], enemies: [],
  police: makePolice(), heli: makeHeli(), effects: makeEffects(),
  missions: makeMissions(), missionKills: 0, missionHeli: false,
  audio: makeAudio(), dialogue: null, dispatchLine: 'quiet evening in Wilwatikta. All units routine patrol.',
  dispatchT: 0, shake: 0, godT: 0, showPassed: null, stealTarget: null,
  stats: { kills: 0, stolen: 0, missions: 0 },
  upgrades: { engine: 0, armor: 0, paint: 0 },
  camRig: { back: 8.5, height: 3.6, ahead: 6, ty: 1.6, fov: 62 },
  camPos: [0, 8, 20], camTarget: [0, 1, 0],
  paused: false, screen: 'title', screenReturn: 'title',
  shotMode: false, staged: false, shotFinish: null,
  camYaw: 0, crew: { z: 0, x: 0, c: 0 }, heliBan: 0,
  keys: {}, mouseDown: false,
  player: null, playerCar: null,
};
game.showScreen = (name) => { game.screen = name; showScreen(game, name); };
game.action = (name, arg) => doAction(name, arg);

// Player + starting car.
const playerCar = makeCar(0, -23, 46, 0.4, 'player');
playerCar.speed = 0;
game.playerCar = playerCar;
game.cars.push(playerCar);
game.player = {
  x: -23, z: 46, heading: 0.4, aimHeading: 0.4, walk: 0, speed: 0,
  inCar: true, car: playerCar, hp: 100, armor: 0,
  weapon: 1, ammo: 12, reserve: 60, reload: 0, cooldown: 0, dead: false,
  jacket: [0.80, 0.25, 0.20], skin: [0.80, 0.60, 0.45],
};

// Traffic: 18 cars looping the grid + 8 parked cars along curbs.
for (let k = 0; k < 18; k++) {
  const vertical = rng.chance(0.5);
  const road = roadAt(rng.int(0, 6));
  const along = rng.range(-150, 150);
  const heading = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(rng.int(0, CARS.length - 1), vertical ? road : along, vertical ? along : road, heading, 'traffic');
  car.cruise = rng.range(8, 13);
  car.speed = car.cruise;
  game.cars.push(car);
}
for (let k = 0; k < 8; k++) {
  const road = roadAt(rng.int(0, 6));
  const along = rng.range(-140, 140);
  const side = rng.pick([-1, 1]);
  const vertical = rng.chance(0.5);
  const car = makeCar(rng.int(0, CARS.length - 1),
    vertical ? road + side * 4.6 : along, vertical ? along : road + side * 4.6,
    vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2), 'parked');
  car.stealable = true;
  game.cars.push(car);
}
// Pedestrians: 28 walking the sidewalks.
const JACKETS = [[0.80, 0.30, 0.25], [0.25, 0.55, 0.75], [0.90, 0.70, 0.20], [0.40, 0.65, 0.35], [0.75, 0.45, 0.65], [0.55, 0.40, 0.70], [0.30, 0.60, 0.55]];
for (let k = 0; k < 28; k++) {
  const vertical = rng.chance(0.5);
  const road = roadAt(rng.int(0, 6));
  const along = rng.range(-150, 150);
  const off = rng.pick([-8.5, 8.5]);
  const p = makePerson(vertical ? road + off : along, vertical ? along : road + off,
    JACKETS[k % JACKETS.length], [0.80, 0.60, 0.45], 'ped');
  game.peds.push(p);
}
// Pickups: health + ammo at fixed spots.
for (const [x, z, col, kind] of [[69, 30, [0.25, 0.9, 0.45], 'hp'], [23, -108, [0.95, 0.80, 0.25], 'ammo'], [-30, 132, [0.25, 0.9, 0.45], 'hp'], [108, -108, [0.95, 0.80, 0.25], 'ammo']])
  game.effects.pickups.push({ x, z, col, kind, bob: Math.random() * 6 });

initHUD(game);

// Input.
const KEYMAP = {};
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') e.preventDefault();
  game.keys[e.key.toLowerCase()] = true;
  game.audio.ensure();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'p' || k === 'escape') togglePause();
  if (k === 'm') { game.audio.setMuted(!game.audio.muted); }
  if (k === 't') game.audio.nextStation();
  if (k === 'h') game.audio.horn();
  if (k === 'tab') toggleMap();
  if (k === 'e') enterExitCar();
  if (k === 'r') startReload(game);
  if (k === 'q') cycleWeapon();
  if (k >= '1' && k <= '4') selectWeapon(+k - 1);
  if (k === 'z' || k === 'x' || k === 'c') crewAbility(k);
  if (k === 'g') { if (nearGarage()) game.showScreen('garage'); }
  if (k === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => { game.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', (e) => { game.mouseDown = true; game.audio.ensure(); });
window.addEventListener('mouseup', () => { game.mouseDown = false; });
window.addEventListener('blur', () => { game.keys = {}; game.mouseDown = false; });

function togglePause() {
  if (game.screen === 'title' || game.screen === 'busted' || game.screen === 'wasted') return;
  if (game.screen === 'pause') { game.showScreen(null); game.paused = false; }
  else { game.showScreen('pause'); game.paused = true; }
}
function toggleMap() {
  if (game.screen === 'map') { game.showScreen(null); game.paused = false; }
  else if (!game.screen) { game.showScreen('map'); }
}
function nearGarage() {
  return Math.hypot(game.player.x - 69, game.player.z - 23) < 16;
}
function cycleWeapon() {
  const p = game.player;
  p.weapon = (p.weapon + 1) % WEAPONS.length;
  if (p.weapon === 2 && game.missions.done < 3) p.weapon = 0; // SMG unlocks after mission 3
  const w = WEAPONS[p.weapon];
  if (p.weapon > 0 && p.ammo === 0 && p.reserve === 0) { p.ammo = w.mag; p.reserve = w.reserve; }
  p.reload = 0;
}
function selectWeapon(i) {
  const p = game.player;
  if (i === 3) return; // AR-9 stays locked
  if (i === 2 && game.missions.done < 3) return; // SMG unlocks after mission 3
  p.weapon = i;
  const w = WEAPONS[i];
  if (i > 0 && p.ammo === 0 && p.reserve === 0) { p.ammo = w.mag; p.reserve = w.reserve; }
  p.reload = 0;
}
function crewAbility(key) {
  // Sugeng's crew: real, paid abilities with cooldowns (the crew-card system).
  const p = game.player;
  const defs = {
    z: { cost: 100, cd: 25, who: 'AGUS', line: 'My guy in the WPD lost the paperwork. Roadblocks are gone — for now.' },
    x: { cost: 150, cd: 20, who: 'BAMBANG', line: 'Bengkel Bambang to the rescue. Good as new, Sugeng.' },
    c: { cost: 200, cd: 30, who: 'RATNA', line: 'Follow my route through Kampung Batik. They lost your trail.' },
  };
  const d = defs[key];
  if (!d || game.crew[key] > 0 || game.cash < d.cost) return;
  if (key === 'x' && !p.inCar) return;
  game.cash -= d.cost;
  game.crew[key] = d.cd;
  if (key === 'z') { game.police.roadblocks = []; game.missionHeli = false; game.heli.active = false; game.heliBan = 12; }
  if (key === 'x' && p.car) { p.car.damage = 0; p.car.smoke = 0; }
  if (key === 'c') { game.wanted = Math.max(0, game.wanted - 1); game.police.seenT = 0; }
  game.dialogue = { who: d.who, line: d.line, t: 4.5 };
  game.audio.pickup();
}
function enterExitCar() {
  const p = game.player;
  if (p.dead) return;
  if (p.inCar) {
    p.inCar = false;
    p.x = p.car.x + 2.4; p.z = p.car.z + 1.2;
    p.heading = p.car.heading;
    p.car = null;
    return;
  }
  let best = null, bestD = 3.6;
  for (const c of game.cars) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) return;
  if (best.kind === 'parked' || best.kind === 'traffic') {
    best.kind = 'player';
    game.stats.stolen++;
    if (best !== game.stealTarget) addWanted(game, 1);
    game.audio.pickup();
  }
  p.inCar = true; p.car = best;
  p.x = best.x; p.z = best.z;
}

function doAction(name, arg) {
  const p = game.player;
  switch (name) {
    case 'new':
      game.showScreen(null); game.paused = false;
      if (!game.missions.active && game.missions.done === 0) startMission(game, 0);
      break;
    case 'continue': {
      const d = loadGame(0);
      if (d) { applySave(game, d); game.showScreen(null); game.paused = false; if (!game.missions.active) startMission(game, Math.min(11, game.missions.done)); }
      break;
    }
    case 'howto': game.screenReturn = game.screen || 'title'; game.showScreen('howto'); break;
    case 'saves': game.screenReturn = game.screen || 'title'; game.showScreen('saves'); break;
    case 'garage': game.screenReturn = game.screen || 'title'; game.showScreen('garage'); break;
    case 'map': game.showScreen('map'); break;
    case 'resume': game.showScreen(null); game.paused = false; break;
    case 'back': {
      const ret = game.screenReturn;
      if (ret === 'pause') { game.showScreen('pause'); }
      else if (ret === 'title') { game.showScreen('title'); }
      else { game.showScreen(null); game.paused = false; }
      break;
    }
    case 'title': game.showScreen('title'); game.paused = false; break;
    case 'respawn':
      p.dead = false; p.hp = 100; p.armor = 0;
      p.x = -23; p.z = 46; p.inCar = false; p.car = null;
      game.wanted = 0; game.police.cars = []; game.police.roadblocks = [];
      game.heli.active = false; game.godT = 3;
      game.showScreen(null); game.paused = false;
      break;
    case 'save-slot': saveGame(arg, game); showScreen(game, 'saves'); game.hud.screen = 'saves-refresh'; showScreen(game, null); game.showScreen('saves'); break;
    case 'load-slot': {
      const d = loadGame(arg);
      if (d) { applySave(game, d); game.showScreen(null); game.paused = false; }
      break;
    }
    case 'upgrade': {
      const u = game.upgrades;
      const prices = { engine: 600 + u.engine * 400, armor: 500 + u.armor * 350, paint: 250, repair: 150 };
      const price = prices[arg];
      if (game.cash < price) break;
      if (arg === 'engine' && u.engine >= 3) break;
      if (arg === 'armor' && u.armor >= 3) break;
      game.cash -= price;
      if (arg === 'engine') u.engine++;
      if (arg === 'armor') { u.armor++; p.armor = Math.min(100, p.armor + 25); }
      if (arg === 'paint') { u.paint = (u.paint + 1) % FACADES.length; if (p.car) p.car.spec = { ...p.car.spec, col: FACADES[u.paint] }; }
      if (arg === 'repair' && p.car) { p.car.damage = 0; p.car.smoke = 0; }
      game.audio.pickup();
      game.hud.screen = 'garage-refresh'; game.showScreen('garage');
      break;
    }
  }
}

// Staged shots: run fixed steps synchronously, then render + flag ready.
let shotSteps = 0;
if (SHOT) {
  game.hourFixed = true;
  shotSteps = setupShot(game, SHOT);
  game.showScreen(null);
  game.paused = false;
} else {
  game.showScreen('title');
}

function stepGame(dt) {
  game.time += dt;
  if (!game.hourFixed) {
    game.hour += dt / 150;
    if (game.hour >= 24) { game.hour -= 24; game.day++; }
  }
  const p = game.player;
  const k = game.keys;
  // Player update.
  if (!p.dead) {
    if (p.inCar && p.car) {
      const input = {
        forward: !!(k['w'] || k['arrowup']),
        back: !!(k['s'] || k['arrowdown']),
        left: !!(k['a'] || k['arrowleft']),
        right: !!(k['d'] || k['arrowright']),
        handbrake: !!k[' '],
      };
      if (SHOT && game.shotName === 'cover') { input.forward = true; }
      if (SHOT && game.shotName === 'night') { input.forward = true; }
      const boost = 1 + game.upgrades.engine * 0.12;
      const savedTop = p.car.spec.top;
      p.car.spec = { ...p.car.spec, top: savedTop * boost };
      driveCar(p.car, input, dt, game.colliders, game.cars);
      p.car.spec = { ...p.car.spec, top: savedTop };
      p.x = p.car.x; p.z = p.car.z; p.heading = p.car.heading;
      p.aimHeading = p.heading;
      p.speed = Math.abs(p.car.speed);
      if (p.car.smoke > 0.4 && Math.random() < 0.3)
        spawnSmoke(game.effects, p.car.x, 1.2, p.car.z);
      // Drive-by shooting.
      if (game.mouseDown) fireWeapon(game, dt);
    } else {
      // On foot: move relative to camera heading (use player heading).
      let mx = 0, mz = 0;
      if (k['w'] || k['arrowup']) { mx += -Math.sin(p.heading); mz += -Math.cos(p.heading); }
      if (k['s'] || k['arrowdown']) { mx += Math.sin(p.heading); mz += Math.cos(p.heading); }
      if (k['a'] || k['arrowleft']) { mx += -Math.cos(p.heading); mz += Math.sin(p.heading); }
      if (k['d'] || k['arrowright']) { mx += Math.cos(p.heading); mz += -Math.sin(p.heading); }
      const ml = Math.hypot(mx, mz);
      const run = k['shift'] ? 7.5 : 4.6;
      if (ml > 0) {
        mx /= ml; mz /= ml;
        p.heading = Math.atan2(-mx, -mz);
        p.aimHeading = p.heading;
        const nx = p.x + mx * run * dt, nz = p.z + mz * run * dt;
        [p.x, p.z] = collideCircle(game.colliders, nx, nz, 0.55);
        p.walk += dt * (k['shift'] ? 10 : 6.5);
        p.speed = run;
      } else p.speed = 0;
      if (game.mouseDown || k['f']) fireWeapon(game, dt);
      if (k[' ']) { /* punch = fists fire */ if (p.weapon === 0) fireWeapon(game, dt); }
    }
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) finishReload(game); }
    if (p.cooldown > 0) p.cooldown -= dt;
    if (game.godT > 0) game.godT -= dt;
  }
  // Traffic + peds + enemies.
  for (const c of game.cars) {
    if (c.kind === 'traffic') updateTraffic(c, dt, game.colliders, game.cars, rng);
  }
  for (const ped of game.peds) updatePed(ped, dt, game.colliders, p.x, p.z, p.speed, rng);
  for (const e of game.enemies) {
    if (e.dead) { e.fall = Math.min(1, e.fall + dt * 3); continue; }
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 30) {
      e.heading = Math.atan2(-dx, -dz);
      const nx = e.x + (-Math.sin(e.heading)) * 2.6 * dt;
      const nz = e.z + (-Math.cos(e.heading)) * 2.6 * dt;
      [e.x, e.z] = collideCircle(game.colliders, nx, nz, 0.55);
      e.walk += dt * 6;
      if (d < 2.2 && Math.random() < dt * 1.2) damagePlayer(game, 8);
    }
  }
  updatePolice(game.police, game, dt);
  updateHeli(game.heli, p.x, p.z, game.staged ? 0 : dt, game.time);
  updateMissions(game, dt);
  updateEffects(game.effects, dt);
  // Pickups.
  for (const pk of game.effects.pickups) {
    pk.bob += dt * 2;
    if (Math.hypot(p.x - pk.x, p.z - pk.z) < 2.2 && !p.inCar) {
      if (pk.kind === 'hp' && p.hp < 100) { p.hp = Math.min(100, p.hp + 40); game.audio.pickup(); pk.taken = 1; }
      if (pk.kind === 'ammo') { p.reserve += 30; game.audio.pickup(); pk.taken = 1; }
    }
  }
  game.effects.pickups = game.effects.pickups.filter((pk) => !pk.taken);
  // Dialogue + dispatch.
  if (game.dialogue && game.dialogue.t < 90) game.dialogue.t -= dt;
  game.dispatchT -= dt;
  if (game.dispatchT <= 0 && !game.shotMode) {
    game.dispatchT = 12;
    const part = game.hour < 12 ? 'day' : game.hour < 19 ? 'dusk' : 'night';
    const line = DISPATCH[part][Math.floor(Math.random() * DISPATCH[part].length)];
    game.dispatchLine = line.replace('{d}', districtAt(p.x, p.z).name.charAt(0) + districtAt(p.x, p.z).name.slice(1).toLowerCase());
  }
  if (game.wantedFlash > 0) game.wantedFlash -= dt;
  game.shake = Math.max(0, game.shake - dt * 1.4);
  // Busted: 5 stars + police adjacent + slow.
  if (game.wanted >= 5 && !p.dead) {
    const near = game.police.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 5);
    if (near && p.speed < 2) {
      game.bustedT = (game.bustedT || 0) + dt;
      if (game.bustedT > 3) { game.bustedT = 0; game.cash = Math.max(0, game.cash - 300); game.showScreen('busted'); game.paused = true; }
    } else game.bustedT = 0;
  }
  if (p.dead && game.screen !== 'wasted') { game.showScreen('wasted'); game.paused = true; }
  if (game.showPassed) {
    game.showPassed.time -= dt;
    if (game.showPassed.time <= 0) game.showPassed = null;
  }
  for (const k of ['z', 'x', 'c']) if (game.crew[k] > 0) game.crew[k] -= dt;
  if (game.heliBan > 0) game.heliBan -= dt;
  // Audio.
  game.audio.engine(p.inCar ? Math.abs(p.car.speed) : 0, p.inCar);
  game.audio.siren(game.police.cars.length > 0);
  game.audio.radioTick(dt);
}

function render() {
  const p = game.player;
  const pal = paletteAt(game.hour);
  const rig = game.camRig;
  const speed = p.inCar ? Math.abs(p.car.speed) : p.speed;
  // Camera: smoothed chase / foot follow (camYaw slews the view for shots).
  const fx0 = -Math.sin(p.heading), fz0 = -Math.cos(p.heading);
  const cy = Math.cos(game.camYaw || 0), sy = Math.sin(game.camYaw || 0);
  const fx = fx0 * cy + fz0 * sy, fz = -fx0 * sy + fz0 * cy;
  const tx = p.x + fx * rig.ahead, tz = p.z + fz * rig.ahead;
  const ex = p.x - fx * rig.back, ez = p.z - fz * rig.back;
  const ey = (p.inCar ? 0.6 : 1.4) + rig.height;
  const lerp = 1 - Math.exp(-0.12);
  game.camPos[0] += (ex - game.camPos[0]) * lerp;
  game.camPos[1] += (ey - game.camPos[1]) * lerp;
  game.camPos[2] += (ez - game.camPos[2]) * lerp;
  game.camTarget[0] += (tx - game.camTarget[0]) * lerp;
  game.camTarget[1] += (rig.ty - game.camTarget[1]) * lerp;
  game.camTarget[2] += (tz - game.camTarget[2]) * lerp;
  const shx = (Math.random() - 0.5) * game.shake * 0.5;
  const shy = (Math.random() - 0.5) * game.shake * 0.5;
  const eye = [game.camPos[0] + shx, game.camPos[1] + shy, game.camPos[2]];
  const fov = (rig.fov + Math.min(14, speed * 0.35)) * Math.PI / 180;
  const proj = matPerspective(fov, canvas.width / canvas.height, 0.3, WORLD.far);
  const view = matLookAt(eye, game.camTarget, [0, 1, 0]);
  const vp = matMul(proj, view);
  renderer.begin(vp, eye, pal);
  renderer.draw(cityBuf, matModel(0, 0, 0, 0, 1), 1, [1, 1, 1]);
  // Blob shadows under cars + people (translucent pass, after opaque).
  for (const c of game.cars)
    renderer.drawTranslucent(bufs.pool, matModel(c.x, 0.14, c.z, c.heading, 2.3), 0.22, [0.05, 0.05, 0.06]);
  for (const ped of game.peds)
    if (!ped.dead) renderer.drawTranslucent(bufs.pool, matModel(ped.x, 0.14, ped.z, 0, 0.7), 0.20, [0.05, 0.05, 0.06]);
  // Cars.
  for (const c of game.cars) drawCar(renderer, bufs, c);
  // People.
  const personBufs = { body: bufs.personBody, rest: restBuf('default'), legs: bufs.personLegs, ring: bufs.ring };
  for (const ped of game.peds) drawPerson(renderer, personBufs, ped, false);
  for (const e of game.enemies) drawPerson(renderer, personBufs, e, false);
  if (!p.inCar) {
    const pb = { body: bufs.personBody, rest: restBuf('default'), legs: bufs.personLegs, ring: bufs.ring };
    drawPerson(renderer, pb, p, true);
  }
  // Helicopter + searchlight.
  drawHeli(renderer, { heliBody: bufs.heliBody, heliRotor: bufs.heliRotor, cone: bufs.coneMesh, pool: bufs.pool }, game.heli, p.x, p.z);
  // Roadblocks + cones.
  for (const rb of game.police.roadblocks) {
    renderer.draw(bufs.barrier, matModel(rb.x, 0, rb.z, rb.heading, 1), 1, [1, 1, 1]);
    for (const s of [-4, 4]) {
      const cx = rb.x + Math.cos(rb.heading) * s, cz = rb.z - Math.sin(rb.heading) * s;
      renderer.draw(bufs.cone, matModel(cx, 0, cz, 0, 1), 1, [1, 1, 1]);
    }
  }
  // Headlight pools at night.
  if (pal.glow > 0.6) {
    for (const c of game.cars) {
      if (c.kind === 'parked') continue;
      const hx = c.x - Math.sin(c.heading) * 5, hz = c.z - Math.cos(c.heading) * 5;
      renderer.drawTranslucent(bufs.pool, matModel(hx, 0.16, hz, 0, 2.6), 0.30, [1.0, 0.90, 0.60]);
    }
  }
  // Mission beacon.
  drawBeacon(game, renderer, { beacon: bufs.beacon, diamond: bufs.diamond }, game.time);
  // Effects + pickups.
  drawEffects(renderer, { flash: bufs.flash, tracer: bufs.tracer, spark: bufs.spark, smoke: bufs.smoke, pickup: bufs.pickup }, game.effects);
  updateHUD(game);
}

// Staged shots run their fixed steps synchronously, then freeze the heli.
if (SHOT && shotSteps > 0) {
  const dt = 1 / 60;
  for (let i = 0; i < shotSteps; i++) stepGame(dt);
  // Parked cars staged by the shot (spawned after stepping so they don't drift).
  if (game.stagedParked) {
    for (const [x, z, h] of game.stagedParked) {
      const c = makeCar(rng.int(0, CARS.length - 1), x, z, h, 'parked');
      c.stealable = true;
      game.cars.push(c);
    }
  }
  if (game.shotFinish) game.shotFinish(game);
  game.staged = true;
  // Snap the camera to its staged framing (no smoothing lag in the shot).
  const p = game.player;
  const rig = game.camRig;
  const fx0 = -Math.sin(p.heading), fz0 = -Math.cos(p.heading);
  const cy = Math.cos(game.camYaw || 0), sy = Math.sin(game.camYaw || 0);
  const fx = fx0 * cy + fz0 * sy, fz = -fx0 * sy + fz0 * cy;
  game.camPos = [p.x - fx * rig.back, (p.inCar ? 0.6 : 1.4) + rig.height, p.z - fz * rig.back];
  game.camTarget = [p.x + fx * rig.ahead, rig.ty, p.z + fz * rig.ahead];
  render();
  window.__shotReady = true;
}

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.paused || game.screen === 'title' || game.staged) { render(); return; }
  acc += dt;
  const step = 1 / 60;
  let n = 0;
  while (acc >= step && n < 4) { stepGame(step); acc -= step; n++; }
  render();
}
requestAnimationFrame(loop);
if (!SHOT) window.__shotReady = false;

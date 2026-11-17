// Screenshot staging: deterministic scripted states per shot. Place, don't
// hope: the player, traffic, police, and helicopter are positioned exactly,
// the simulation runs a fixed number of steps, and staged dialogue is forced
// after stepping so it survives. Same staging set as v3, enriched.
import { makeCar } from './vehicles.js';
import { makePerson } from './character.js';
import { startMission } from './missions.js';

function basePlayer(game, opts) {
  const p = game.player;
  Object.assign(p, { hp: 100, armor: opts.armor ?? 0, weapon: opts.weapon ?? 1, ammo: opts.ammo ?? 12, reserve: opts.reserve ?? 60 });
  game.cash = opts.cash; game.rep = opts.rep ?? 0; game.wanted = opts.wanted ?? 0;
  game.hour = opts.hour; game.day = 1;
  game.missions.done = opts.done ?? 0;
  startMission(game, opts.mission);
  game.missions.talkIdx = game.missions.talk.length; // staged lines win
  game.wanted = opts.wanted ?? 0;
  game.missionHeli = !!opts.heli;
  game.heli.active = !!opts.heli;
}

function stagePolice(game, spots, speed) {
  for (const [x, z, h] of spots) {
    const car = makeCar(0, x, z, h, 'police');
    car.spec = { ...car.spec, col: [0.92, 0.93, 0.95], top: 30, acc: 14, name: 'WPD CRUISER' };
    car.speed = speed; car.staged = true;
    game.police.cars.push(car);
    game.cars.push(car);
  }
}
function stageTraffic(game, spots) {
  for (const [model, x, z, h, cruise] of spots) {
    const car = makeCar(model, x, z, h, 'traffic');
    car.cruise = cruise; car.speed = cruise;
    game.cars.push(car);
  }
}
function stagePeds(game, spots, rng) {
  const jackets = [[0.80, 0.30, 0.25], [0.25, 0.55, 0.75], [0.90, 0.70, 0.20], [0.40, 0.65, 0.35], [0.75, 0.45, 0.65]];
  for (const [x, z] of spots) {
    const p = makePerson(x, z, jackets[game.peds.length % jackets.length], [0.80, 0.60, 0.45], 'ped');
    p.tx = x + 6; p.tz = z + 4;
    game.peds.push(p);
  }
}

export const SHOTS = {
  cover: {
    steps: 70,
    setup(game) {
      basePlayer(game, { cash: 12480, rep: 200, wanted: 4, weapon: 2, ammo: 30, reserve: 90, armor: 60, hour: 18.6, done: 8, mission: 8, heli: true });
      const p = game.player;
      p.inCar = true; p.car = game.playerCar;
      p.car.x = -140; p.car.z = 40; p.car.heading = 0; p.car.speed = 26;
      p.x = -140; p.z = 40; p.heading = 0;
      game.camRig = { back: 7.2, height: 3.0, ahead: 7, ty: 1.9, fov: 66 };
      game.camYaw = 0.22; // slew the view toward the sea + sunset
      const h = game.heli;
      h.orbit = -2.26; h.radius = 21; h.height = 16;
      h.x = p.x + Math.cos(h.orbit) * h.radius; h.z = p.z + Math.sin(h.orbit) * h.radius; h.y = 16;
      stagePolice(game, [[-140, 58, 0], [-140, 72, 0]], 26);
      game.police.roadblocks.push({ x: -140, z: -3, heading: Math.PI / 2, life: 999 });
      const rbCar = makeCar(0, -134, -2, Math.PI / 2, 'police');
      rbCar.spec = { ...rbCar.spec, col: [0.92, 0.93, 0.95], name: 'WPD CRUISER' };
      rbCar.staged = true; rbCar.speed = 0;
      game.police.cars.push(rbCar); game.cars.push(rbCar);
      stageTraffic(game, [
        [3, -140, -22, 0, 13], [6, -140, -52, 0, 11], [4, -135, -30, Math.PI, 12],
        [7, -135, -70, Math.PI, 10], [2, -140, -88, 0, 14], [5, -92, 40, Math.PI / 2, 10],
      ]);
      stagePeds(game, [[-150, 20], [-152, 32], [-149, 8], [-151, -14], [-126, 26], [-126, -4]]);
      game.stagedParked = [[-130, 12, 0.1], [-130, -24, -0.1], [-130, 52, 0.05]];
    },
    finish(game) {
      // Place the helicopter EXACTLY: open sky right of the mission panel.
      const p = game.player, h = game.heli;
      h.x = p.x + 6; h.z = p.z - 24; h.y = 14;
      h.heading = Math.atan2(-(p.x - h.x), -(p.z - h.z)) + Math.PI / 2;
      h.rotor = 0.7;
      game.dialogue = { who: 'SUGENG', line: 'Four stars and a helicopter. Time to show WPD my taillights.', t: 99 };
      game.dispatchLine = 'air support on scene, suspect heading north on the beachfront.';
    },
  },
  map: {
    steps: 5,
    setup(game) {
      basePlayer(game, { cash: 12480, rep: 200, wanted: 0, weapon: 1, ammo: 12, reserve: 60, armor: 40, hour: 18.6, done: 11, mission: 11, heli: false });
      const p = game.player;
      p.inCar = true; p.car = game.playerCar;
      p.car.x = -23; p.car.z = 23; p.car.heading = 0.6; p.car.speed = 0;
      p.x = -23; p.z = 23; p.heading = 0.6;
      game.camRig = { back: 8.5, height: 3.6, ahead: 6, ty: 1.6, fov: 62 };
      game.heli.active = false;
    },
    finish(game) {
      game.showScreen('map');
      game.dialogue = null;
    },
  },
  title: {
    steps: 5,
    setup(game) {
      basePlayer(game, { cash: 12480, rep: 200, wanted: 0, weapon: 1, ammo: 12, reserve: 60, armor: 40, hour: 18.4, done: 8, mission: 8, heli: false });
      const p = game.player;
      p.inCar = true; p.car = game.playerCar;
      p.car.x = -152; p.car.z = 40; p.car.heading = 0; p.car.speed = 0;
      p.x = -152; p.z = 40; p.heading = 0;
      game.camRig = { back: 7, height: 2.8, ahead: 8, ty: 2.0, fov: 60 };
      game.camYaw = -0.18; // swing the view toward the road + city
      game.heli.active = false;
      // A red Garuda GT parked on the beachfront road, sunset behind the card.
      const gt = makeCar(0, -138, 18, 0.2, 'parked');
      game.cars.push(gt);
      stageTraffic(game, [[3, -140, -20, 0, 12], [6, -135, -50, Math.PI, 11], [2, -140, -80, 0, 13]]);
      stagePeds(game, [[-152, 28], [-150, 48], [-158, 20], [-148, 60], [-126, 30], [-126, 52]]);
      game.stagedParked = [[-130, 0, 0.05], [-130, 44, -0.05]];
    },
    finish(game) {
      game.missions.bannerT = 0;
      game.showScreen('title');
      document.getElementById('screen-title').style.background = 'rgba(8,6,16,0.45)';
      for (const id of ['district-panel', 'mission-panel', 'status-panel', 'weapon-bar', 'crew-bar', 'wpd-panel', 'dispatch', 'radio', 'controls-footer', 'watermark', 'minimap-wrap', 'speedo-wrap'])
        document.getElementById(id).style.display = 'none';
      game.dialogue = null;
    },
  },
  night: {
    steps: 60,
    setup(game) {
      basePlayer(game, { cash: 9800, rep: 200, wanted: 3, weapon: 2, ammo: 24, reserve: 66, armor: 40, hour: 21.5, done: 10, mission: 10, heli: true });
      const p = game.player;
      p.inCar = true; p.car = game.playerCar;
      p.car.model = 2; p.car.spec = { ...p.car.spec, col: [0.65, 0.72, 0.80], name: 'ARJUNA' };
      p.car.x = -46; p.car.z = 80; p.car.heading = 0; p.car.speed = 22;
      p.x = -46; p.z = 80; p.heading = 0;
      game.camRig = { back: 7.5, height: 3.8, ahead: 9, ty: 2.6, fov: 64 };
      // Heli LOW + CLOSE + AHEAD so it is unmissable in frame.
      const h = game.heli;
      h.orbit = -0.92; h.radius = 16; h.height = 13;
      h.x = p.x + Math.cos(h.orbit) * h.radius; h.z = p.z + Math.sin(h.orbit) * h.radius; h.y = 13;
      stagePolice(game, [[-46, 98, 0]], 22);
      game.police.roadblocks.push({ x: -46, z: 44, heading: Math.PI / 2, life: 999 });
      const rbCar = makeCar(0, -41, 42, Math.PI / 2, 'police');
      rbCar.spec = { ...rbCar.spec, col: [0.92, 0.93, 0.95], name: 'WPD CRUISER' };
      rbCar.staged = true; rbCar.speed = 0;
      game.police.cars.push(rbCar); game.cars.push(rbCar);
      stageTraffic(game, [
        [4, -46, 26, 0, 11], [3, -46, 2, 0, 12], [6, -51, 60, Math.PI, 10],
        [7, 0, 23, Math.PI / 2, 9], [2, -92, 23, -Math.PI / 2, 10],
      ]);
      stagePeds(game, [[-38, 64], [-54, 72], [-38, 40]]);
    },
    finish(game) {
      // Place the helicopter EXACTLY: up-left of the player, clear of panels.
      const p = game.player, h = game.heli;
      h.x = p.x - 10; h.z = p.z - 18; h.y = 12;
      h.heading = Math.atan2(-(p.x - h.x), -(p.z - h.z)) + Math.PI / 2;
      h.rotor = 0.7;
      game.dialogue = { who: 'AGUS', line: 'Double cross at the marina, Sugeng. Wanto set the whole thing up.', t: 99 };
      game.dispatchLine = 'units respond in Alun-Alun — suspect armed.';
    },
  },
};

export function setupShot(game, name) {
  const shot = SHOTS[name];
  if (!shot) return 0;
  game.shotMode = true;
  game.shotName = name;
  shot.setup(game);
  game.shotFinish = shot.finish;
  return shot.steps;
}

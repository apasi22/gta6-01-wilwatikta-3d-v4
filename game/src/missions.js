// Mission system: the 12-mission story chain, objective state machine,
// dialogue queue, beacons, checkpoints, rewards, and pass/fail flow.
import { MISSIONS, POI } from './config.js';
import { makePerson } from './character.js';
import { addWanted } from './police.js';
import { matModel } from './gl.js';

export function makeMissions() {
  return {
    index: 0, active: false, done: 0, state: 'idle',
    timer: 0, target: null, checkpoints: [], cpIndex: 0,
    collectLeft: 0, killsNeeded: 0, killsStart: 0,
    talk: [], talkT: 0, talkIdx: 0, passed: false, failed: false,
    banner: '', bannerT: 0,
  };
}

export function startMission(game, idx) {
  const m = game.missions;
  const def = MISSIONS[idx];
  m.index = idx; m.active = true; m.state = 'run';
  m.timer = def.time; m.passed = false; m.failed = false;
  m.target = { x: def.x, z: def.z };
  m.checkpoints = []; m.cpIndex = 0; m.collectLeft = 0;
  m.killsNeeded = 0; m.killsStart = game.missionKills;
  m.talk = def.talk.map(([who, line]) => ({ who, line }));
  m.talkT = 0; m.talkIdx = 0;
  m.banner = def.name; m.bannerT = 3.2;
  game.missionHeli = false;
  if (def.type === 'race') {
    m.checkpoints = [
      { x: -138, z: -69 }, { x: -138, z: 69 }, { x: -46, z: 138 },
      { x: 92, z: 138 }, { x: 138, z: 0 }, { x: 46, z: -138 }, { x: -138, z: -138 },
    ];
    m.target = m.checkpoints[0];
  }
  if (def.type === 'collect') {
    m.collectLeft = 3;
    m.checkpoints = [
      { x: 55, z: -8 }, { x: 83, z: 14 }, { x: 69, z: 38 },
    ];
    m.target = m.checkpoints[0];
  }
  if (def.type === 'clear') {
    m.killsNeeded = 5;
    game.enemies = [];
    for (let k = 0; k < 5; k++) {
      const e = makePerson(def.x + (k - 2) * 6, def.z + (k % 2) * 8 - 4, [0.55, 0.15, 0.15], [0.75, 0.58, 0.45], 'enemy');
      e.hp = 60;
      game.enemies.push(e);
    }
  }
  if (def.type === 'escape' || def.name === 'Heat Wave') {
    addWanted(game, def.name === 'Heat Wave' ? 4 : 3);
    if (def.name === 'Heat Wave') game.missionHeli = true;
  }
  if (def.type === 'survive') {
    addWanted(game, 5);
    game.missionHeli = true;
  }
  if (def.type === 'steal') {
    // The target car waits near the mission start; stealing = entering it.
    game.stealTarget = game.cars.find((c) => c.stealable) || null;
  }
  game.audio.missionStart();
}

export function failMission(game, why) {
  const m = game.missions;
  m.active = false; m.state = 'failed'; m.failed = true;
  m.banner = 'MISSION FAILED — ' + why; m.bannerT = 3.5;
  game.audio.missionFail();
}

export function passMission(game) {
  const m = game.missions;
  const def = MISSIONS[m.index];
  m.active = false; m.state = 'passed'; m.passed = true;
  m.done = Math.max(m.done, m.index + 1);
  game.cash += def.rw;
  game.stats.missions++;
  game.rep += 18;
  m.banner = 'MISSION PASSED — ' + def.name + '  +$' + def.rw; m.bannerT = 4;
  game.showPassed = { name: def.name, reward: def.rw, time: 3.2 };
  game.audio.missionPass();
  game.missionHeli = false;
  if (m.index + 1 < MISSIONS.length) {
    m.nextT = 4;
  }
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (m.bannerT > 0) m.bannerT -= dt;
  if (m.nextT > 0) {
    m.nextT -= dt;
    if (m.nextT <= 0 && !m.active && m.index + 1 < MISSIONS.length) startMission(game, m.index + 1);
  }
  // Dialogue queue: one line every 4.5s while the mission runs.
  if (m.active && m.talkIdx < m.talk.length) {
    m.talkT += dt;
    if (m.talkT > 4.5 || m.talkIdx === 0) {
      const t = m.talk[m.talkIdx];
      game.dialogue = { who: t.who, line: t.line, t: 4.2 };
      m.talkIdx++;
      m.talkT = 0;
    }
  }
  if (!m.active) return;
  const def = MISSIONS[m.index];
  m.timer -= dt;
  if (m.timer <= 0) { failMission(game, 'TIME UP'); return; }
  const p = game.player;
  const dTarget = Math.hypot(p.x - m.target.x, p.z - m.target.z);
  switch (def.type) {
    case 'goto':
    case 'deliver':
      if (dTarget < 9) passMission(game);
      break;
    case 'steal': {
      // Pass when the player drives the stealable car to the target.
      if (p.inCar && p.car && p.car.stealable && dTarget < 10) passMission(game);
      else if (p.inCar && p.car && p.car.stealable) m.target = { x: def.x, z: def.z };
      else if (game.stealTarget) m.target = { x: game.stealTarget.x, z: game.stealTarget.z };
      break;
    }
    case 'collect':
      if (dTarget < 7) {
        m.collectLeft--;
        game.cash += 50;
        game.audio.pickup();
        m.cpIndex++;
        if (m.collectLeft <= 0) passMission(game);
        else m.target = m.checkpoints[m.cpIndex];
      }
      break;
    case 'race':
      if (dTarget < 11) {
        m.cpIndex++;
        game.audio.checkpoint();
        if (m.cpIndex >= m.checkpoints.length) passMission(game);
        else m.target = m.checkpoints[m.cpIndex];
      }
      break;
    case 'clear':
      if (game.missionKills - m.killsStart >= m.killsNeeded) passMission(game);
      break;
    case 'escape':
      if (game.wanted === 0 && dTarget < 12) passMission(game);
      break;
    case 'survive':
      if (dTarget < 10 && game.wanted <= 2) passMission(game);
      break;
  }
  // Busted / wasted fail states are handled by main.js.
}

export function missionObjectiveText(game) {
  const m = game.missions;
  if (!m.active) {
    if (m.done >= MISSIONS.length) return 'ALL MISSIONS COMPLETE — Wilwatikta is yours.';
    return 'Next mission starting soon…';
  }
  const def = MISSIONS[m.index];
  return def.brief;
}

export function drawBeacon(game, r, bufs, time) {
  const m = game.missions;
  if (!m.active || !m.target) return;
  const { x, z } = m.target;
  // Thin beam + small floating diamond (v3 fix: never a wide slab).
  r.drawTranslucent(bufs.beacon, matModel(x, 0, z, 0, 1), 0.30, [1.0, 0.80, 0.25]);
  const bob = 6.5 + Math.sin(time * 2.2) * 0.5;
  r.draw(bufs.diamond, matModel(x, bob, z, time * 1.4, 1), 1, [1, 1, 1]);
}

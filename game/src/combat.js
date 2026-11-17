// Combat: hitscan weapons, muzzle flashes, tracers, sparks, smoke, damage,
// pickups, and hostile mission enemies.
import { Mesh, matModel } from './gl.js';
import { WEAPONS } from './config.js';
import { addWanted } from './police.js';

export function buildFlashMesh() {
  const m = new Mesh();
  m.box(0, 0, 0, 0.7, 0.16, 0.16, [1.0, 0.85, 0.35], 0.95);
  m.box(0, 0, 0, 0.16, 0.7, 0.16, [1.0, 0.85, 0.35], 0.95);
  m.box(0, 0, 0, 0.16, 0.16, 0.7, [1.0, 0.85, 0.35], 0.95);
  return m;
}
export function buildTracerMesh() {
  const m = new Mesh();
  m.box(0, 0, 0, 1.0, 0.05, 0.05, [1.0, 0.90, 0.55], 0.9);
  return m;
}
export function buildSparkMesh() {
  const m = new Mesh();
  m.box(0, 0, 0, 0.22, 0.22, 0.22, [1.0, 0.70, 0.25], 0.9);
  return m;
}
export function buildSmokeMesh() {
  const m = new Mesh();
  m.box(0, 0, 0, 0.8, 0.8, 0.8, [0.55, 0.55, 0.58], 0.0);
  return m;
}
export function buildPickupMesh() {
  const m = new Mesh();
  m.box(0, 0, 0, 0.7, 0.7, 0.7, [0.25, 0.90, 0.45], 0.8);
  m.box(0, 0, 0, 0.9, 0.25, 0.25, [0.25, 0.90, 0.45], 0.8);
  return m;
}
export function buildBeaconMesh() {
  const m = new Mesh();
  m.prism(0, 0, 0, 0.30, 26, 8, [1.0, 0.80, 0.25], 0.85);
  return m;
}
export function buildDiamondMesh() {
  const m = new Mesh();
  m.cone(0, 0, 0, 0.7, 0.9, 6, [1.0, 0.80, 0.25], 0.95);
  m.cone(0, -0.9, 0, 0.7, 0.9, 6, [1.0, 0.80, 0.25], 0.95);
  return m;
}

export function makeEffects() {
  return { list: [], pickups: [] };
}

export function spawnFlash(fx, x, y, z, heading) {
  fx.list.push({ type: 'flash', x, y, z, heading, life: 0.09, max: 0.09 });
}
export function spawnTracer(fx, x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz) || 1;
  fx.list.push({
    type: 'tracer', x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2,
    heading: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len), len, life: 0.12, max: 0.12,
  });
}
export function spawnSparks(fx, x, y, z, n) {
  for (let i = 0; i < n; i++) {
    fx.list.push({
      type: 'spark', x, y, z,
      vx: (Math.random() - 0.5) * 7, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 7,
      life: 0.35 + Math.random() * 0.2, max: 0.5,
    });
  }
}
export function spawnSmoke(fx, x, y, z) {
  fx.list.push({ type: 'smoke', x, y, z, vy: 1.6, life: 1.1, max: 1.1, s: 0.7 });
}

export function updateEffects(fx, dt) {
  for (const e of fx.list) {
    e.life -= dt;
    if (e.type === 'spark') { e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.vy -= 12 * dt; }
    if (e.type === 'smoke') { e.y += e.vy * dt; e.s += dt * 0.9; }
  }
  fx.list = fx.list.filter((e) => e.life > 0);
}

export function drawEffects(r, bufs, fx) {
  for (const e of fx.list) {
    const a = Math.max(0, e.life / e.max);
    if (e.type === 'flash') r.drawTranslucent(bufs.flash, matModel(e.x, e.y, e.z, e.heading, 1), a, [1, 1, 1]);
    else if (e.type === 'spark') r.drawTranslucent(bufs.spark, matModel(e.x, e.y, e.z, 0, 1), a, [1, 1, 1]);
    else if (e.type === 'smoke') r.drawTranslucent(bufs.smoke, matModel(e.x, e.y, e.z, 0, e.s), a * 0.45, [1, 1, 1]);
    else if (e.type === 'tracer') {
      const ch = Math.cos(e.heading), sh = Math.sin(e.heading);
      const cp = Math.cos(e.pitch), sp = Math.sin(e.pitch);
      const m = new Float32Array([
        ch * e.len, 0, -sh * e.len, 0,
        sh * sp * e.len, cp * 1, ch * sp * e.len, 0,
        sh * cp * e.len, -sp * 1, ch * cp * e.len, 0,
        e.x, e.y, e.z, 1,
      ]);
      r.drawTranslucent(bufs.tracer, m, a, [1, 1, 1]);
    }
  }
  for (const p of fx.pickups) {
    const bob = Math.sin(p.bob) * 0.15;
    r.draw(bufs.pickup, matModel(p.x, 1.1 + bob, p.z, p.bob, 1), 1, p.col);
  }
}

// Fire the current weapon from the player. Returns true if a shot went out.
export function fireWeapon(game, dt) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.reload > 0) return false;
  if (p.weapon > 0 && p.ammo <= 0) { startReload(game); return false; }
  if (p.cooldown > 0) return false;
  p.cooldown = w.rate;
  if (p.weapon > 0) p.ammo--;
  const px = p.x, pz = p.z;
  const py = p.inCar ? 1.3 : 1.5;
  const h = p.aimHeading;
  const fx = -Math.sin(h), fz = -Math.cos(h);
  const mx = px + fx * 1.2, mz = pz + fz * 1.2;
  spawnFlash(game.effects, mx, py, mz, h);
  game.audio.shot(w.name);
  game.shake = Math.min(0.5, game.shake + 0.12);
  // Hitscan: nearest ped/enemy/car within range and a narrow cone.
  let best = null, bestD = w.range;
  const consider = (x, z, radius, target) => {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.1) return;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < 0.92) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > radius + 0.6) return;
    best = target; bestD = d;
  };
  for (const ped of game.peds) if (!ped.dead) consider(ped.x, ped.z, 0.6, { kind: 'ped', ref: ped });
  for (const e of game.enemies) if (!e.dead) consider(e.x, e.z, 0.7, { kind: 'enemy', ref: e });
  for (const c of game.cars) if (c !== p.car) consider(c.x, c.z, 1.9, { kind: 'car', ref: c });
  const ex = px + fx * bestD, ez = pz + fz * bestD;
  spawnTracer(game.effects, mx, py, mz, ex, py, ez);
  if (best) {
    spawnSparks(game.effects, ex, py, ez, 5);
    if (best.kind === 'car') {
      best.ref.damage = Math.min(1, best.ref.damage + w.dmg * 0.012);
      best.ref.smoke = Math.min(1, best.ref.smoke + 0.2);
    } else {
      best.ref.hp -= w.dmg;
      if (best.ref.hp <= 0) {
        best.ref.dead = true;
        game.stats.kills++;
        if (best.kind === 'ped') addWanted(game, 1);
        game.missionKills++;
      } else if (best.kind === 'ped') {
        best.ref.scared = 4;
        addWanted(game, 1);
      }
    }
    game.audio.hit();
  } else {
    spawnSparks(game.effects, ex, py, ez, 2);
  }
  if (p.weapon > 0) addWanted(game, 0); // firing alone does not add stars; hits do
  return true;
}

export function startReload(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 0 || p.reload > 0 || p.reserve <= 0 || p.ammo === w.mag) return;
  p.reload = 1.1;
  game.audio.reload();
}

export function finishReload(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  const take = Math.min(w.mag - p.ammo, p.reserve);
  p.ammo += take; p.reserve -= take;
  p.reload = 0;
}

export function damagePlayer(game, dmg) {
  const p = game.player;
  if (p.dead || game.godT > 0) return;
  const absorbed = Math.min(p.armor, dmg * 0.6);
  p.armor -= absorbed;
  p.hp -= (dmg - absorbed);
  game.shake = Math.min(0.6, game.shake + 0.25);
  game.audio.hurt();
  if (p.hp <= 0) { p.hp = 0; p.dead = true; }
}

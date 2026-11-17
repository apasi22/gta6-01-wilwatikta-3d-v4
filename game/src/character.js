// On-foot character and pedestrians: low-poly people from boxes, walk
// animation from swinging limbs, sidewalk loops, and scatter behavior.
import { Mesh, matModel } from './gl.js';
import { collideCircle } from './vehicles.js';
import { roadAt, WORLD } from './config.js';

export function buildPersonBody() {
  // Jacket + arms: tinted per person.
  const m = new Mesh();
  const W = [1, 1, 1];
  m.box(0, 1.18, 0, 0.62, 0.72, 0.34, W, 0.03); // torso
  m.box(-0.42, 1.18, 0, 0.2, 0.62, 0.24, W, 0.03); // left arm
  m.box(0.42, 1.18, 0, 0.2, 0.62, 0.24, W, 0.03); // right arm
  return m;
}
export function buildPersonRest(skin) {
  const m = new Mesh();
  m.box(-0.17, 0.42, 0, 0.26, 0.84, 0.28, [0.20, 0.22, 0.30], 0.02); // left leg
  m.box(0.17, 0.42, 0, 0.26, 0.84, 0.28, [0.20, 0.22, 0.30], 0.02); // right leg
  m.box(0, 1.78, 0, 0.46, 0.5, 0.44, skin, 0.02); // head
  m.box(0, 2.06, 0, 0.52, 0.14, 0.5, [0.12, 0.12, 0.13], 0.02); // cap
  m.box(0, 2.0, -0.30, 0.4, 0.06, 0.24, [0.12, 0.12, 0.13], 0.02); // cap brim
  return m;
}
export function buildPersonLegs() {
  // Separate leg meshes so the walk swing can rotate them.
  const mk = (sx) => {
    const m = new Mesh();
    m.box(sx * 0.17, -0.42, 0, 0.26, 0.84, 0.28, [0.20, 0.22, 0.30], 0.02);
    return m;
  };
  return { left: mk(-1), right: mk(1) };
}

export function makePerson(x, z, jacket, skin, kind) {
  return {
    kind: kind || 'ped', x, z, heading: 0, speed: 0, walk: Math.random() * 6,
    jacket, skin, hp: 100, dead: false, fall: 0,
    // Ped wandering: current sidewalk waypoint.
    tx: x, tz: z, pause: 0, scared: 0,
  };
}

export function updatePed(p, dt, colliders, playerX, playerZ, playerSpeed, rng) {
  if (p.dead) { p.fall = Math.min(1, p.fall + dt * 3); return; }
  const dx = p.x - playerX, dz = p.z - playerZ;
  const d = Math.hypot(dx, dz);
  if (d < 7 && playerSpeed > 8) p.scared = 2.5;
  if (p.scared > 0) {
    p.scared -= dt;
    const run = 5.5;
    p.heading = Math.atan2(-dx, -dz);
    const nx = p.x - Math.sin(p.heading) * run * dt;
    const nz = p.z - Math.cos(p.heading) * run * dt;
    [p.x, p.z] = collideCircle(colliders, nx, nz, 0.5);
    p.walk += dt * 9;
    p.speed = run;
    return;
  }
  if (p.pause > 0) { p.pause -= dt; p.speed = 0; return; }
  const tx = p.tx - p.x, tz = p.tz - p.z;
  const dist = Math.hypot(tx, tz);
  if (dist < 1.2) {
    // New waypoint: along a sidewalk edge near a road.
    const vertical = rng.chance(0.5);
    const road = roadAt(rng.int(0, 6));
    const off = rng.pick([-8.5, 8.5]);
    if (vertical) { p.tx = road + off; p.tz = rng.range(-150, 150); }
    else { p.tx = rng.range(-150, 150); p.tz = road + off; }
    if (rng.chance(0.3)) p.pause = rng.range(1, 4);
    return;
  }
  p.heading = Math.atan2(-tx, -tz);
  const spd = 1.6;
  const nx = p.x + (-Math.sin(p.heading)) * spd * dt;
  const nz = p.z + (-Math.cos(p.heading)) * spd * dt;
  [p.x, p.z] = collideCircle(colliders, nx, nz, 0.5);
  p.walk += dt * 5;
  p.speed = spd;
}

export function drawPerson(r, bufs, p, isPlayer) {
  const sink = p.dead ? p.fall * 0.5 : 0;
  const tilt = p.dead ? p.fall * 1.35 : 0;
  const swing = Math.sin(p.walk) * (p.speed > 0.2 ? 0.55 : 0.08);
  const base = matModel(p.x, -sink, p.z, p.heading, 1);
  // Body leans forward slightly when running; falls over when dead.
  const bodyM = tilt !== 0
    ? matModel(p.x, 0.1, p.z, p.heading, 1)
    : base;
  r.draw(bufs.body, bodyM, 1, p.jacket);
  r.draw(bufs.rest, bodyM, 1, [1, 1, 1]);
  // Legs swing around the hip (y = 0.84).
  const hipY = 0.84 - sink;
  for (const [leg, s] of [[bufs.legs.left, 1], [bufs.legs.right, -1]]) {
    const a = swing * s;
    const c = Math.cos(p.heading), si = Math.sin(p.heading);
    const lx = p.x + (s * 0.17) * c, lz = p.z - (s * 0.17) * si;
    // Rotate leg mesh about the hip: translate to hip, rotate X by swing in facing space.
    const ch = Math.cos(p.heading), sh = Math.sin(p.heading);
    const ca = Math.cos(a), sa = Math.sin(a);
    // R = Ry(heading) * Rx(a)
    const m = new Float32Array([
      ch * 1, 0, -sh * 1, 0,
      sh * sa, ca, ch * sa, 0,
      sh * ca, -sa, ch * ca, 0,
      lx, hipY, lz, 1,
    ]);
    r.draw(leg, m, 1, [1, 1, 1]);
  }
  if (isPlayer) {
    // White ring under the player so they read clearly on foot.
    r.drawTranslucent(bufs.ring, matModel(p.x, 0.16, p.z, 0, 1), 0.85, [1, 1, 1]);
  }
}

export function buildRing() {
  const m = new Mesh();
  m.disc(0, 0, 0, 1.15, 20, [1, 1, 1], 0.6);
  m.disc(0, 0.01, 0, 0.85, 20, [0.1, 0.1, 0.1], 0.0);
  return m;
}

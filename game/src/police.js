// Wanted system, police pursuit, roadblocks, and the WPD helicopter with
// searchlight. The helicopter is built BIG and detailed so it reads clearly
// in every shot, including the night mission.
import { Mesh, matModel, matModelTilt } from './gl.js';
import { makeCar, driveCar, collideCircle } from './vehicles.js';
import { CARS } from './config.js';

export function buildHeliBody() {
  const m = new Mesh();
  const navy = [0.12, 0.18, 0.32], yellow = [0.95, 0.75, 0.15];
  const glass = [0.15, 0.30, 0.42];
  // Rounded-ish fuselage: main box + nose wedge + tail boom.
  m.box(0, 0, 0, 3.4, 1.5, 1.7, navy, 0.08);
  m.box(-1.9, -0.1, 0, 1.0, 1.1, 1.4, navy, 0.08);
  m.box(-2.4, -0.15, 0, 0.5, 0.7, 1.0, glass, 0.5); // nose glass
  m.box(-1.2, 0.35, 0, 1.6, 0.8, 1.75, glass, 0.5); // cockpit glass
  m.box(0, 0.35, 0, 2.6, 0.35, 1.78, yellow, 0.15); // yellow stripe
  m.box(2.8, 0.1, 0, 2.6, 0.55, 0.55, navy, 0.08); // tail boom
  m.box(4.1, 0.5, 0, 0.25, 1.1, 0.18, navy, 0.08); // tail fin
  m.box(4.15, 0.9, 0, 0.15, 0.5, 0.9, [0.20, 0.20, 0.22], 0.05); // tail rotor disc hint
  // Skids.
  for (const s of [-1, 1]) {
    m.box(-0.3, -1.05, s * 0.85, 2.6, 0.14, 0.14, [0.15, 0.15, 0.16], 0.05);
    m.box(-0.9, -0.85, s * 0.85, 0.14, 0.5, 0.14, [0.15, 0.15, 0.16], 0.05);
    m.box(0.4, -0.85, s * 0.85, 0.14, 0.5, 0.14, [0.15, 0.15, 0.16], 0.05);
  }
  // Belly searchlight housing + nav lights.
  m.box(-0.6, -0.85, 0, 0.5, 0.3, 0.5, [0.90, 0.90, 0.85], 0.9);
  m.box(0, 0.95, 0, 0.5, 0.3, 0.5, [0.20, 0.20, 0.22], 0.05); // rotor mast
  m.box(-2.0, 0.4, 0.9, 0.2, 0.2, 0.2, [1.0, 0.15, 0.10], 0.95); // left nav (red)
  m.box(-2.0, 0.4, -0.9, 0.2, 0.2, 0.2, [0.20, 1.0, 0.30], 0.95); // right nav (green)
  m.box(4.2, 0.1, 0, 0.2, 0.2, 0.2, [1.0, 1.0, 1.0], 0.95); // tail light
  return m;
}
export function buildHeliRotor() {
  const m = new Mesh();
  const dark = [0.10, 0.10, 0.11];
  m.box(0, 0, 0, 7.6, 0.08, 0.42, dark, 0.05);
  m.box(0, 0, 0, 0.42, 0.08, 7.6, dark, 0.05);
  m.box(0, -0.1, 0, 0.5, 0.2, 0.5, [0.25, 0.25, 0.27], 0.05);
  return m;
}
export function buildConeMesh() {
  // Searchlight cone: apex at origin, opening downward (-y), length 1, radius 1.
  const m = new Mesh();
  const apex = [0, 0, 0];
  const sides = 10;
  const ring = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    ring.push([Math.cos(a), -1, Math.sin(a)]);
  }
  for (let k = 0; k < sides; k++) m.tri(apex, ring[k], ring[(k + 1) % sides], [1, 1, 1], 0.9);
  return m;
}
export function buildPoolMesh() {
  const m = new Mesh();
  m.disc(0, 0, 0, 1, 16, [1.0, 0.95, 0.70], 0.9);
  return m;
}

export function makeHeli() {
  return {
    active: false, x: 0, z: 0, y: 26, heading: 0,
    orbit: 0, radius: 24, height: 24, rotor: 0, lightOn: true,
  };
}

export function updateHeli(h, px, pz, dt, time) {
  if (!h.active) return;
  h.orbit += dt * 0.45;
  const tx = px + Math.cos(h.orbit) * h.radius;
  const tz = pz + Math.sin(h.orbit) * h.radius;
  h.x += (tx - h.x) * Math.min(1, dt * 1.6);
  h.z += (tz - h.z) * Math.min(1, dt * 1.6);
  h.y += (h.height - h.y) * Math.min(1, dt * 1.2);
  h.heading = Math.atan2(-(px - h.x), -(pz - h.z)) + Math.PI / 2;
  h.rotor += dt * 22;
}

export function drawHeli(r, bufs, h, px, pz) {
  if (!h.active) return;
  const tilt = Math.sin(h.orbit * 2) * 0.05;
  const bodyM = matModelTilt(h.x, h.y, h.z, h.heading, 1, tilt, 0.06);
  r.draw(bufs.heliBody, bodyM, 1, [1, 1, 1]);
  const rotorM = matModel(h.x, h.y + 1.15, h.z, h.rotor, 1);
  r.draw(bufs.heliRotor, rotorM, 0.9, [1, 1, 1]);
  // Searchlight cone from the belly to the ground near the player.
  const dx = px - h.x, dz = pz - h.z;
  const dist = Math.hypot(dx, dz);
  const aim = Math.atan2(dx, h.y);
  const coneLen = Math.hypot(dist, h.y);
  const yaw = Math.atan2(dx, dz);
  // Cone mesh points down -y; tilt it toward the player and scale to length.
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ca = Math.cos(aim), sa = Math.sin(aim);
  const sc = coneLen;
  const m = new Float32Array([
    c * 3.2, 0, -s * 3.2, 0,
    s * sa * 3.2, ca * sc, c * sa * 3.2, 0,
    s * ca * 3.2, -sa * sc, c * ca * 3.2, 0,
    h.x, h.y - 0.9, h.z, 1,
  ]);
  r.drawTranslucent(bufs.cone, m, 0.20, [1.0, 0.98, 0.85]);
  // Bright ground pool under the cone's foot.
  const poolX = h.x + dx * 0.92, poolZ = h.z + dz * 0.92;
  r.drawTranslucent(bufs.pool, matModel(poolX, 0.22, poolZ, 0, 3.4), 0.55, [1.0, 0.95, 0.70]);
  // Blob shadow under the helicopter.
  r.drawTranslucent(bufs.pool, matModel(h.x, 0.18, h.z, 0, 3.0), 0.20, [0.05, 0.05, 0.06]);
}

// Wanted + police pursuit.
const CALLSIGNS = ['GARUDA-11', 'ELANG-7', 'CENDRAWASIH-3', 'MERPATI-9', 'RAJAWALI-5', 'KUTILANG-2'];
export function makePolice() {
  return { cars: [], roadblocks: [], spawnT: 0, siren: 0, seenT: 0, spawned: 0 };
}

export function wantedLabel(w) {
  return ['CLEAN', 'SUSPECT', 'WANTED', 'WANTED', 'MOST WANTED', 'MOST WANTED'][w] || 'CLEAN';
}

export function updatePolice(pol, game, dt) {
  const w = game.wanted;
  const px = game.player.x, pz = game.player.z;
  // Desired police cars: 0 at 0 stars, up to 4 at 5 stars.
  const want = w === 0 ? 0 : Math.min(4, 1 + Math.floor(w / 2));
  pol.spawnT -= dt;
  if (pol.cars.length < want && pol.spawnT <= 0 && !game.shotMode) {
    pol.spawnT = 3;
    const a = Math.random() * Math.PI * 2;
    const car = makeCar(0, px + Math.cos(a) * 70, pz + Math.sin(a) * 70, 0, 'police');
    car.spec = { ...CARS[0], col: [0.92, 0.93, 0.95], top: 30, acc: 14, name: 'WPD CRUISER' };
    pol.cars.push(car);
  }
  if (!game.shotMode && pol.cars.length > want) pol.cars.length = want;
  // Helicopter at 3+ stars.
  game.heli.active = (w >= 3 || game.missionHeli) && game.heliBan <= 0;
  if (game.heli.active && !game.shotMode) {
    game.heli.radius = w >= 4 ? 20 : 26;
    game.heli.height = w >= 4 ? 20 : 26;
  }
  // Roadblocks at 3+ stars: one barrier across the road ahead of the player.
  if (w >= 3 && pol.roadblocks.length === 0 && game.player.inCar) {
    const h = game.player.car.heading;
    const fx = -Math.sin(h), fz = -Math.cos(h);
    pol.roadblocks.push({ x: px + fx * 34, z: pz + fz * 34, heading: h + Math.PI / 2, life: 25 });
  }
  for (const rb of pol.roadblocks) rb.life -= dt;
  pol.roadblocks = pol.roadblocks.filter((rb) => rb.life > 0 && w >= 3);
  // Pursuit: steer toward the player, ram gently, avoid buildings via collide.
  for (const car of pol.cars) {
    if (!car.callsign) car.callsign = CALLSIGNS[pol.spawned++ % CALLSIGNS.length];
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    if (car.staged) {
      // Staged shot cars hold formation: straight ahead, constant speed.
      car.x += -Math.sin(car.heading) * car.speed * dt;
      car.z += -Math.cos(car.heading) * car.speed * dt;
      car.barTint = Math.floor(game.time * 6) % 2 === 0 ? [1, 0.15, 0.15] : [0.2, 0.4, 1];
      continue;
    }
    const wantHeading = Math.atan2(-dx, -dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const input = {
      forward: dist > 5, back: false, handbrake: false,
      left: dh > 0.08, right: dh < -0.08,
    };
    driveCar(car, input, dt, game.colliders, game.cars);
    car.barTint = Math.floor(game.time * 6) % 2 === 0 ? [1, 0.15, 0.15] : [0.2, 0.4, 1];
    if (dist < 4 && game.player.inCar) {
      game.player.car.damage = Math.min(1, game.player.car.damage + dt * 0.03);
    }
  }
  // Wanted decay: only when no police car is close and the heli is off.
  const nearest = pol.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), 999);
  if (w > 0 && nearest > 34 && !game.heli.active) {
    pol.seenT += dt;
    if (pol.seenT > 6) { game.wanted = Math.max(0, w - 1); pol.seenT = 0; }
  } else pol.seenT = 0;
  pol.siren += dt;
}

export function addWanted(game, n) {
  game.wanted = Math.min(5, game.wanted + n);
  game.wantedFlash = 1.2;
}

// Vehicles: car meshes (tinted body + fixed details), driving physics,
// traffic loops, parked cars, and circle-vs-box collision.
import { WORLD, roadAt, CARS } from './config.js';
import { Mesh, matModel } from './gl.js';

export function buildCarBody(len, wid) {
  const m = new Mesh();
  const W = [1, 1, 1]; // tinted per car
  const h = 0.62;
  m.box(0, h, 0, len, 0.62, wid, W, 0.06); // lower body
  m.box(-len * 0.06, h + 0.55, 0, len * 0.52, 0.5, wid * 0.86, W, 0.06); // cabin shell
  m.box(-len * 0.48, h + 0.28, 0, 0.5, 0.34, wid * 0.9, W, 0.06); // hood scoop hint
  m.box(len * 0.48, h + 0.42, 0, 0.3, 0.3, wid * 0.8, W, 0.06); // spoiler lip
  return m;
}
export function buildCarDetail(len, wid) {
  const m = new Mesh();
  const glass = [0.12, 0.18, 0.26];
  const dark = [0.08, 0.08, 0.09];
  // Windshield + rear glass + side glass.
  m.quad([-len * 0.24, 1.18, 0], [0, 0, wid * 0.40], [0.28, 0.42, 0], glass, 0.35);
  m.quad([len * 0.16, 1.18, 0], [0, 0, wid * 0.40], [-0.28, 0.42, 0], glass, 0.35);
  m.quad([0, 1.18, wid * 0.435], [len * 0.22, 0, 0], [0, 0.40, 0], glass, 0.35);
  m.quad([0, 1.18, -wid * 0.435], [-len * 0.22, 0, 0], [0, 0.40, 0], glass, 0.35);
  // Wheels.
  for (const [wx, wz] of [[-len * 0.32, wid / 2], [-len * 0.32, -wid / 2], [len * 0.32, wid / 2], [len * 0.32, -wid / 2]]) {
    m.box(wx, 0.36, wz, 0.62, 0.72, 0.3, dark, 0.0);
    m.box(wx, 0.36, wz + (wz > 0 ? 0.16 : -0.16), 0.3, 0.3, 0.06, [0.70, 0.72, 0.75], 0.2);
  }
  // Bumpers, grille, mirrors.
  m.box(-len / 2 - 0.06, 0.55, 0, 0.18, 0.3, wid * 0.92, dark, 0.0);
  m.box(len / 2 + 0.06, 0.55, 0, 0.18, 0.3, wid * 0.92, dark, 0.0);
  m.box(-len / 2 - 0.05, 0.78, 0, 0.1, 0.22, wid * 0.5, [0.30, 0.30, 0.32], 0.1);
  m.box(-len * 0.10, 1.05, wid / 2 + 0.08, 0.22, 0.14, 0.12, dark, 0.0);
  m.box(-len * 0.10, 1.05, -wid / 2 - 0.08, 0.22, 0.14, 0.12, dark, 0.0);
  // Headlights (front = -x) + taillights.
  for (const s of [-1, 1]) {
    m.box(-len / 2 - 0.08, 0.82, s * wid * 0.32, 0.1, 0.22, 0.42, [1.0, 0.95, 0.75], 0.95);
    m.box(len / 2 + 0.08, 0.82, s * wid * 0.32, 0.1, 0.22, 0.42, [0.95, 0.12, 0.10], 0.95);
  }
  return m;
}
export function buildLightBar() {
  const m = new Mesh();
  m.box(0, 1.52, 0, 0.7, 0.22, 1.1, [1, 1, 1], 0.95);
  m.box(0, 1.40, 0, 0.5, 0.1, 0.9, [0.10, 0.10, 0.11], 0.0);
  return m;
}
export function buildBarrier() {
  const m = new Mesh();
  const orange = [0.90, 0.45, 0.10], white = [0.92, 0.90, 0.85];
  m.box(0, 0.55, 0, 0.5, 1.1, 6.4, orange, 0.08);
  for (let k = -2; k <= 2; k++) m.box(0, 0.55, k * 1.28, 0.56, 0.5, 0.6, white, 0.15);
  for (const s of [-1, 1]) {
    m.box(0, 0.3, s * 2.9, 0.9, 0.6, 0.5, [0.25, 0.25, 0.27], 0.0);
    m.box(0, 1.25, s * 2.9, 0.3, 0.3, 0.3, [1.0, 0.30, 0.10], 0.9);
  }
  return m;
}
export function buildCone() {
  const m = new Mesh();
  m.box(0, 0.08, 0, 0.62, 0.16, 0.62, [0.90, 0.45, 0.10], 0.05);
  m.cone(0, 0.12, 0, 0.30, 0.75, 8, [0.95, 0.50, 0.12], 0.08);
  m.cone(0, 0.42, 0, 0.22, 0.22, 8, [0.95, 0.95, 0.92], 0.15);
  return m;
}

export function collideCircle(colliders, x, z, r) {
  for (const b of colliders) {
    const nx = Math.max(b.x0, Math.min(x, b.x1));
    const nz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-6) { x = b.x1 + r; continue; }
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r; z = nz + (dz / d) * r;
    }
  }
  x = Math.max(-158, Math.min(158, x));
  z = Math.max(-158, Math.min(158, z));
  return [x, z];
}

export function makeCar(modelIdx, x, z, heading, kind) {
  const spec = CARS[modelIdx];
  return {
    kind: kind || 'traffic', model: modelIdx, spec,
    x, z, heading, speed: 0, steer: 0, damage: 0, smoke: 0,
    // Traffic state: axis ('x'|'z'), direction, target speed.
    axis: Math.abs(Math.sin(heading)) > 0.5 ? 'z' : 'x',
    dir: 1, cruise: 9 + Math.random() * 4, wait: 0,
  };
}

export function driveCar(car, input, dt, colliders, cars) {
  const spec = car.spec;
  const max = spec.top * (1 - car.damage * 0.45);
  if (input.forward) car.speed += spec.acc * dt;
  if (input.back) car.speed -= (car.speed > 0.5 ? spec.acc * 1.4 : spec.acc * 0.6) * dt;
  car.speed -= car.speed * 0.55 * dt;
  if (input.handbrake) car.speed -= car.speed * 2.6 * dt;
  car.speed = Math.max(-8, Math.min(max, car.speed));
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  const spd = Math.abs(car.speed);
  if (spd > 0.2) car.heading += car.steer * (car.speed >= 0 ? 1 : -1) * Math.min(2.1, 0.9 + spd * 0.03) * dt * (spd > 18 ? 0.75 : 1);
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  const before = [nx, nz];
  [nx, nz] = collideCircle(colliders, nx, nz, 1.7);
  if (nx !== before[0] || nz !== before[1]) {
    if (spd > 6) { car.damage = Math.min(1, car.damage + spd * 0.008); car.smoke = Math.min(1, car.smoke + 0.3); }
    car.speed *= 0.55;
  }
  // Car-car soft push.
  for (const o of cars) {
    if (o === car) continue;
    const dx = nx - o.x, dz = nz - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 12.5 && d2 > 1e-4) {
      const d = Math.sqrt(d2), push = (3.55 - d) * 0.5;
      nx += (dx / d) * push; nz += (dz / d) * push;
      if (spd > 8) car.damage = Math.min(1, car.damage + 0.02);
    }
  }
  car.x = nx; car.z = nz;
  car.smoke = Math.max(0, car.smoke - dt * 0.15);
}

export function updateTraffic(car, dt, colliders, cars, rng) {
  // Follow the road grid: drive along one axis, sometimes turn at intersections.
  if (car.wait > 0) { car.wait -= dt; car.speed *= 0.9; return; }
  const target = car.cruise;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  // Near an intersection? Maybe turn.
  const nearX = roadAt(Math.round((car.x + 138) / WORLD.pitch));
  const nearZ = roadAt(Math.round((car.z + 138) / WORLD.pitch));
  const atX = Math.abs(car.x - nearX) < 1.2, atZ = Math.abs(car.z - nearZ) < 1.2;
  if (atX && atZ && rng.next() < 0.02) {
    car.heading += rng.pick([-Math.PI / 2, Math.PI / 2]);
    car.axis = car.axis === 'x' ? 'z' : 'x';
  }
  // Snap back onto the road center line gently.
  if (car.axis === 'x') nz += (nearZ - nz) * Math.min(1, dt * 2);
  else nx += (nearX - nx) * Math.min(1, dt * 2);
  // Keep inside the city: U-turn at the edges.
  if (nx < -152 || nx > 152 || nz < -152 || nz > 152) car.heading += Math.PI;
  // Don't rear-end the car ahead.
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 8 && side < 2.4) { car.speed = Math.min(car.speed, Math.max(0, o.speed - 1)); }
  }
  [nx, nz] = collideCircle(colliders, nx, nz, 1.7);
  car.x = nx; car.z = nz;
}

export function drawCar(r, bufs, car, modelOverride) {
  const model = modelOverride || matModel(car.x, 0, car.z, car.heading, 1);
  const spec = car.spec;
  const body = bufs.body, detail = bufs.detail;
  r.draw(body, model, 1, spec.col);
  r.draw(detail, model, 1, [1, 1, 1]);
  if (car.kind === 'police') {
    r.draw(bufs.bar, model, 1, car.barTint || [1, 0.2, 0.2]);
  }
  if (car.damage > 0.45) {
    // Bent hood hint: dark patch box drawn slightly above the hood.
    const m2 = matModel(car.x, 0.02, car.z, car.heading, 1);
    r.draw(bufs.dent, m2, 0.85, [0.15, 0.15, 0.15]);
  }
}

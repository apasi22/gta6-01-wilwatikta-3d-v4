// Wilwatikta city generation: road grid, segmented facades with dense small
// windows on ALL faces, storefronts, balconies, roof clutter, palms, beach,
// docks, skyline ring and mountains. One merged static mesh + colliders.
import { WORLD, roadAt, districtAt, FACADES, ROOFS, AWNINGS, NEON, WIN_LIT, WIN_DARK, POI } from './config.js';
import { Mesh } from './gl.js';

const ASPHALT = [0.26, 0.27, 0.31]; // v4: lighter, readable asphalt
const SIDEWALK = [0.52, 0.48, 0.42];
const SAND = [0.86, 0.74, 0.52];
const SEA = [0.20, 0.48, 0.62];
const GRASS = [0.35, 0.48, 0.28];

function windows(m, cx, cz, w, d, h, y0, rng, litRatio) {
  const floors = Math.max(1, Math.floor((h - 3.6) / 3.0));
  const paint = (faceLen, fixed, isX, sign) => {
    const cols = Math.max(2, Math.floor(faceLen / 2.6));
    const step = faceLen / cols;
    for (let f = 0; f < floors; f++) {
      const y = y0 + 3.4 + f * 3.0 + 0.8;
      if (y + 0.8 > y0 + h - 0.7) break;
      for (let c = 0; c < cols; c++) {
        const o = -faceLen / 2 + step * (c + 0.5);
        const lit = rng.next() < litRatio;
        const col = lit ? rng.pick(WIN_LIT) : rng.pick(WIN_DARK);
        const glow = lit ? 0.95 : 0.04;
        if (isX) m.quad([fixed, y, cz + o], [0, 0, -0.62 * sign], [0, 0.8, 0], col, glow);
        else m.quad([cx + o, y, fixed], [0.62 * sign, 0, 0], [0, 0.8, 0], col, glow);
      }
    }
  };
  paint(d, cx + w / 2 + 0.08, true, 1);
  paint(d, cx - w / 2 - 0.08, true, -1);
  paint(w, cz + d / 2 + 0.08, false, 1);
  paint(w, cz - d / 2 - 0.08, false, -1);
}

function storefront(m, cx, cz, w, d, rng) {
  // Darker ground-floor band + awnings + neon signs on all four faces.
  const band = [0.23, 0.20, 0.19];
  m.box(cx, 1.6, cz, w + 0.3, 3.2, d + 0.3, band, 0.02);
  const awn = rng.pick(AWNINGS);
  const faces = [
    { c: [cx, 3.1, cz + d / 2 + 0.9], s: [w * 0.7, 0.25, 1.8] },
    { c: [cx, 3.1, cz - d / 2 - 0.9], s: [w * 0.7, 0.25, 1.8] },
    { c: [cx + w / 2 + 0.9, 3.1, cz], s: [1.8, 0.25, d * 0.7] },
    { c: [cx - w / 2 - 0.9, 3.1, cz], s: [1.8, 0.25, d * 0.7] },
  ];
  for (const f of faces) m.box(f.c[0], f.c[1], f.c[2], f.s[0], f.s[1], f.s[2], awn, 0.1);
  const neon = rng.pick(NEON);
  m.box(cx, 4.6, cz + d / 2 + 0.35, Math.min(w * 0.55, 8), 0.9, 0.3, neon, 0.9);
  m.box(cx + w / 2 + 0.35, 4.6, cz, 0.3, 0.9, Math.min(d * 0.55, 8), neon, 0.9);
  // Door + display glass on two faces.
  m.quad([cx - w * 0.2, 1.4, cz + d / 2 + 0.18], [0.7, 0, 0], [0, 1.3, 0], [0.10, 0.12, 0.14], 0.15);
  m.quad([cx + w * 0.2, 1.4, cz + d / 2 + 0.18], [1.4, 0, 0], [0, 1.0, 0], [0.65, 0.80, 0.90], 0.35);
}

function roofProps(m, cx, cz, w, d, h, rng) {
  const roof = rng.pick(ROOFS);
  m.box(cx, h + 0.25, cz, w + 0.7, 0.5, d + 0.7, roof, 0.02); // cornice slab
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    m.box(cx + rng.range(-w / 4, w / 4), h + 1.0, cz + rng.range(-d / 4, d / 4),
      rng.range(1.2, 2.4), 1.4, rng.range(1.2, 2.4), [0.45, 0.46, 0.48], 0.02);
  }
  if (rng.chance(0.4)) {
    const ax = cx + rng.range(-w / 3, w / 3), az = cz + rng.range(-d / 3, d / 3);
    m.box(ax, h + 3.2, az, 0.18, 6.0, 0.18, [0.25, 0.25, 0.28], 0.02);
    m.box(ax, h + 6.4, az, 0.4, 0.4, 0.4, [1.0, 0.25, 0.2], 0.9);
  }
  if (rng.chance(0.16) && w > 12) {
    const tx = cx + w * 0.28, tz = cz - d * 0.28;
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      m.box(tx + lx * 0.9, h + 1.6, tz + lz * 0.9, 0.22, 3.2, 0.22, [0.30, 0.26, 0.22], 0.02);
    m.prism(tx, h + 3.2, tz, 1.7, 2.6, 8, [0.55, 0.42, 0.32], 0.02);
    m.cone(tx, h + 5.8, tz, 2.0, 1.4, 8, [0.40, 0.30, 0.24], 0.02);
  }
}

function balconies(m, cx, cz, w, d, h) {
  const levels = Math.floor((h - 6) / 9);
  for (let f = 0; f < levels; f++) {
    const y = 7.5 + f * 9;
    m.box(cx + w / 2 + 0.6, y, cz, 1.2, 0.3, d * 0.6, [0.38, 0.34, 0.30], 0.02);
    m.box(cx - w / 2 - 0.6, y, cz, 1.2, 0.3, d * 0.6, [0.38, 0.34, 0.30], 0.02);
    m.box(cx + w / 2 + 1.15, y + 0.55, cz, 0.15, 0.8, d * 0.6, [0.30, 0.28, 0.26], 0.02);
    m.box(cx - w / 2 - 1.15, y + 0.55, cz, 0.15, 0.8, d * 0.6, [0.30, 0.28, 0.26], 0.02);
  }
}

function building(m, colliders, cx, cz, w, d, h, rng, district) {
  // Split wide footprints into two color segments — never one huge flat wall.
  const segs = w > 19 ? 2 : 1;
  const litRatio = 0.5;
  for (let s = 0; s < segs; s++) {
    const sw = w / segs;
    const sx = cx - w / 2 + sw * (s + 0.5);
    const sh = h - (segs === 2 ? s * rng.range(0, 3) : 0);
    const col = rng.pick(FACADES);
    m.box(sx, sh / 2, cz, sw - 0.4, sh, d, col, 0.02, rng.pick(ROOFS));
    windows(m, sx, cz, sw - 0.4, d, sh, 0, rng, litRatio);
    roofProps(m, sx, cz, sw - 0.4, d, sh, rng);
    if (sh >= 22) balconies(m, sx, cz, sw - 0.4, d, sh);
    if (sh < 20 && rng.next() < district.store) storefront(m, sx, cz, sw - 0.4, d, rng);
  }
  colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
}

function palm(m, x, z, rng, big) {
  const h = big ? rng.range(7, 9.5) : rng.range(5, 7);
  const trunk = [0.42, 0.30, 0.20];
  m.prism(x, 0, z, 0.42, h * 0.55, 7, trunk, 0.02);
  m.prism(x + 0.35, h * 0.5, z + 0.2, 0.34, h * 0.55, 7, trunk, 0.02);
  const topX = x + 0.35, topZ = z + 0.2, topY = h;
  const greens = [[0.20, 0.55, 0.25], [0.25, 0.62, 0.28], [0.16, 0.48, 0.22]];
  const nF = 8;
  for (let ring = 0; ring < 2; ring++) {
    for (let k = 0; k < nF; k++) {
      const a = (k / nF) * Math.PI * 2 + ring * 0.4;
      m.frond(topX, topY - ring * 0.5, topZ, Math.cos(a), Math.sin(a),
        ring === 0 ? 4.6 : 3.6, 0.85, greens[(k + ring) % 3], 0.05);
    }
  }
  m.cone(topX, topY - 0.4, topZ, 0.9, 1.0, 7, [0.30, 0.55, 0.25], 0.05);
  for (let k = 0; k < 3; k++)
    m.box(topX + Math.cos(k * 2.1) * 0.7, topY - 0.7, topZ + Math.sin(k * 2.1) * 0.7, 0.5, 0.5, 0.5, [0.45, 0.32, 0.18], 0.02);
}

function lampPost(m, x, z) {
  m.box(x, 2.6, z, 0.22, 5.2, 0.22, [0.16, 0.16, 0.18], 0.02);
  m.box(x, 5.3, z, 0.7, 0.25, 0.7, [0.16, 0.16, 0.18], 0.02);
  m.box(x, 5.0, z, 0.45, 0.5, 0.45, [1.0, 0.85, 0.55], 0.85);
}

function stall(m, x, z, rng) {
  const canopy = rng.pick(AWNINGS);
  for (const [px, pz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]])
    m.box(x + px, 1.3, z + pz, 0.18, 2.6, 0.18, [0.35, 0.26, 0.18], 0.02);
  m.box(x, 2.8, z, 4.2, 0.3, 3.2, canopy, 0.1);
  m.box(x, 1.0, z, 3.6, 1.0, 2.4, [0.50, 0.38, 0.26], 0.02);
  const fruit = rng.pick([[0.95, 0.50, 0.10], [0.85, 0.20, 0.25], [0.95, 0.80, 0.20], [0.30, 0.70, 0.30]]);
  for (let k = 0; k < 5; k++)
    m.box(x + rng.range(-1.4, 1.4), 1.7, z + rng.range(-0.8, 0.8), 0.5, 0.4, 0.5, fruit, 0.1);
}

function umbrella(m, x, z, rng) {
  const col = rng.pick(AWNINGS);
  m.box(x, 1.2, z, 0.14, 2.4, 0.14, [0.80, 0.78, 0.72], 0.02);
  m.cone(x, 2.4, z, 2.2, 1.0, 8, col, 0.08);
  m.quad([x + 1.8, 0.12, z + 0.6], [0.9, 0, 0], [0, 0, 0.5], rng.pick(AWNINGS), 0.05);
}

function beachFigure(m, x, z, rng) {
  const skin = [0.80, 0.60, 0.45];
  const suit = rng.pick(AWNINGS);
  if (rng.chance(0.5)) { // standing
    m.box(x, 0.9, z, 0.55, 1.8, 0.35, suit, 0.02);
    m.box(x, 2.1, z, 0.5, 0.55, 0.5, skin, 0.02);
  } else { // lying on a towel
    m.quad([x, 0.12, z], [1.0, 0, 0], [0, 0, 0.5], rng.pick(AWNINGS), 0.05);
    m.box(x, 0.35, z, 1.7, 0.4, 0.55, skin, 0.02);
    m.box(x - 1.0, 0.4, z, 0.45, 0.45, 0.45, skin, 0.02);
  }
}

function boat(m, x, z, rng, heading) {
  const hull = rng.pick([[0.75, 0.72, 0.68], [0.30, 0.45, 0.60], [0.80, 0.55, 0.25]]);
  const c = Math.cos(heading), s = Math.sin(heading);
  const put = (lx, ly, lz, sx, sy, sz, col, g) => {
    m.box(x + lx * c - lz * s, ly, z + lx * s + lz * c, sx, sy, sz, col, g);
  };
  put(0, 0.8, 0, 7, 1.6, 2.6, hull, 0.05);
  put(-1, 2.0, 0, 2.6, 1.6, 2.0, [0.90, 0.90, 0.88], 0.05);
  put(1.5, 1.9, 0, 0.25, 2.6, 0.25, [0.30, 0.30, 0.32], 0.02);
}

function crane(m, x, z) {
  const y = [0.90, 0.65, 0.15];
  m.box(x, 9, z, 1.6, 18, 1.6, y, 0.05);
  m.box(x + 5, 18, z, 12, 1.4, 1.4, y, 0.05);
  m.box(x - 3.5, 18, z, 3, 1.4, 1.4, y, 0.05);
  m.box(x + 9, 15.5, z, 0.15, 5, 0.15, [0.15, 0.15, 0.16], 0.02);
  m.box(x + 9, 12.8, z, 1.4, 1.2, 1.4, [0.70, 0.30, 0.20], 0.05);
}

function billboard(m, x, z, h, w, col) {
  // Two posts + a big glowing double-sided panel (Halcyon-style neon).
  for (const s of [-1, 1]) m.box(x + s * w * 0.32, h / 2, z, 0.5, h, 0.5, [0.25, 0.25, 0.28], 0.02);
  m.box(x, h + 1.6, z, w, 3.4, 0.5, [0.12, 0.12, 0.14], 0.02);
  m.box(x, h + 1.6, z + 0.3, w - 0.6, 2.8, 0.1, col, 0.95);
  m.box(x, h + 1.6, z - 0.3, w - 0.6, 2.8, 0.1, col, 0.95);
  m.box(x, h + 3.6, z, w, 0.3, 0.6, [1.0, 0.85, 0.4], 0.9);
}
function trafficLight(m, x, z, dir, lit) {
  // Pole + arm over the road + lamp head; one lamp lit.
  m.box(x, 2.6, z, 0.3, 5.2, 0.3, [0.18, 0.18, 0.20], 0.02);
  m.box(x + dir * 1.2, 5.0, z, 2.4, 0.3, 0.3, [0.18, 0.18, 0.20], 0.02);
  const hx = x + dir * 2.2;
  m.box(hx, 4.4, z, 0.6, 1.5, 0.5, [0.10, 0.10, 0.11], 0.02);
  const off = [0.30, 0.28, 0.24];
  m.box(hx, 4.8, z + 0.28, 0.34, 0.34, 0.06, lit === 'r' ? [1.0, 0.2, 0.15] : off, lit === 'r' ? 0.95 : 0.1);
  m.box(hx, 4.4, z + 0.28, 0.34, 0.34, 0.06, off, 0.1);
  m.box(hx, 4.0, z + 0.28, 0.34, 0.34, 0.06, lit === 'g' ? [0.2, 0.9, 0.3] : off, lit === 'g' ? 0.95 : 0.1);
}

export function buildCity(rng) {
  const m = new Mesh();
  const colliders = [];
  const P = WORLD.pitch;

  // Ground, sand, sea.
  m.quad([0, -0.05, 0], [330, 0, 0], [0, 0, 330], [0.42, 0.40, 0.34], 0.0);
  m.quad([-173, 0.0, 0], [23, 0, 0], [0, 0, 330], SAND, 0.0);
  m.quad([-280, -0.25, 0], [90, 0, 0], [0, 0, 340], SEA, 0.18);
  // Sun streaks on the water.
  for (let k = 0; k < 7; k++)
    m.quad([-240 - k * 8, -0.15, -40 + k * 14], [10 - k, 0, 0], [0, 0, 1.1], [1.0, 0.70, 0.40], 0.55);
  // Promenade walkway along the beach.
  m.quad([-147, 0.08, 0], [3, 0, 0], [0, 0, 330], [0.62, 0.56, 0.46], 0.0);

  // Roads: asphalt strips + center dashes + crosswalks.
  for (let i = 0; i < WORLD.roads; i++) {
    const c = roadAt(i);
    m.quad([c, 0.06, 0], [WORLD.roadW / 2, 0, 0], [0, 0, 168], ASPHALT, 0.0);
    m.quad([0, 0.06, c], [168, 0, 0], [0, 0, WORLD.roadW / 2], ASPHALT, 0.0);
    for (let d = -156; d <= 156; d += 12) {
      m.quad([c, 0.10, d], [0.28, 0, 0], [0, 0, 2.2], [0.90, 0.75, 0.30], 0.05);
      m.quad([d, 0.10, c], [2.2, 0, 0], [0, 0, 0.28], [0.90, 0.75, 0.30], 0.05);
    }
    for (let j = 0; j < WORLD.roads; j++) {
      const c2 = roadAt(j);
      for (let k = -2; k <= 2; k++) {
        m.quad([c + k * 2.2, 0.10, c2 + 7.5], [0.8, 0, 0], [0, 0, 1.6], [0.88, 0.86, 0.80], 0.03);
        m.quad([c + 7.5, 0.10, c2 + k * 2.2], [1.6, 0, 0], [0, 0, 0.8], [0.88, 0.86, 0.80], 0.03);
      }
    }
  }
  // Puddles: warm sunset reflections on the roads.
  for (let k = 0; k < 26; k++) {
    const vertical = rng.chance(0.5);
    const c = roadAt(rng.int(0, 6));
    const d = rng.range(-150, 150);
    if (vertical) m.quad([c + rng.range(-4, 4), 0.09, d], [1.6, 0, 0], [0, 0, 3.2], [0.95, 0.60, 0.35], 0.4);
    else m.quad([d, 0.09, c + rng.range(-4, 4)], [3.2, 0, 0], [0, 0, 1.6], [0.95, 0.60, 0.35], 0.4);
  }

  // Blocks: sidewalks + buildings + props.
  const special = new Map();
  special.set('69,23', 'garage'); special.set('115,-115', 'mansion');
  special.set('23,-115', 'casino'); special.set('-23,115', 'warehouse');
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const cx = -115 + bx * P, cz = -115 + bz * P;
    const district = districtAt(cx, cz);
    m.box(cx, 0.06, cz, WORLD.block + 2, 0.24, WORLD.block + 2, SIDEWALK, 0.0);
    const key = cx + ',' + cz;
    if (special.has(key)) {
      const kind = special.get(key);
      if (kind === 'garage') {
        m.box(cx, 4, cz, 26, 8, 20, [0.55, 0.45, 0.36], 0.02, [0.35, 0.30, 0.26]);
        m.box(cx, 2.2, cz + 10.2, 16, 4.4, 0.5, [0.12, 0.11, 0.10], 0.05);
        m.box(cx, 6.4, cz + 10.3, 14, 1.4, 0.4, [1.0, 0.55, 0.15], 0.9);
        windows(m, cx, cz, 26, 20, 8, 0, rng, 0.4);
        colliders.push({ x0: cx - 13, z0: cz - 10, x1: cx + 13, z1: cz + 10 });
      } else if (kind === 'mansion') {
        m.box(cx, 5, cz, 24, 10, 18, [0.88, 0.84, 0.76], 0.02, [0.60, 0.30, 0.24]);
        for (const px of [-8, -3, 3, 8]) m.prism(cx + px, 0, cz + 10, 0.7, 6, 8, [0.92, 0.88, 0.80], 0.02);
        m.box(cx, 6.8, cz + 10, 20, 1.2, 3, [0.88, 0.84, 0.76], 0.02);
        windows(m, cx, cz, 24, 18, 10, 0, rng, 0.6);
        m.quad([cx + 16, 0.25, cz + 4], [4, 0, 0], [0, 0, 3], [0.35, 0.70, 0.85], 0.5);
        colliders.push({ x0: cx - 12, z0: cz - 9, x1: cx + 12, z1: cz + 9 });
      } else if (kind === 'casino') {
        m.box(cx, 9, cz, 28, 18, 22, [0.42, 0.28, 0.42], 0.02, [0.30, 0.22, 0.30]);
        windows(m, cx, cz, 28, 22, 18, 0, rng, 0.7);
        m.box(cx, 15, cz + 11.4, 20, 3, 0.5, [1.0, 0.80, 0.25], 0.95);
        m.box(cx, 11, cz + 11.4, 12, 1.6, 0.5, [1.0, 0.35, 0.55], 0.95);
        m.box(cx, 2, cz + 11.4, 10, 4, 0.5, [0.15, 0.12, 0.14], 0.1);
        colliders.push({ x0: cx - 14, z0: cz - 11, x1: cx + 14, z1: cz + 11 });
      } else { // warehouse
        m.box(cx, 4.5, cz, 30, 9, 20, [0.50, 0.42, 0.34], 0.02, [0.38, 0.32, 0.26]);
        m.box(cx, 9.6, cz, 30.5, 0.7, 20.5, [0.38, 0.32, 0.26], 0.02);
        for (let k = 0; k < 4; k++)
          m.box(cx - 12 + k * 8, 2.6, cz + 10.3, 4, 5.2, 0.4, [0.30, 0.26, 0.22], 0.05);
        windows(m, cx, cz, 30, 20, 9, 0, rng, 0.3);
        colliders.push({ x0: cx - 15, z0: cz - 10, x1: cx + 15, z1: cz + 10 });
      }
      continue;
    }
    // Regular block: 1-3 buildings on subdivided lots.
    const nB = rng.int(1, 3);
    const vertical = rng.chance(0.5);
    for (let b = 0; b < nB; b++) {
      const lot = WORLD.block / nB;
      const lx = vertical ? cx - WORLD.block / 2 + lot * (b + 0.5) : cx + rng.range(-3, 3);
      const lz = vertical ? cz + rng.range(-3, 3) : cz - WORLD.block / 2 + lot * (b + 0.5);
      const w = vertical ? lot - rng.range(4, 8) : rng.range(12, 26);
      const d = vertical ? rng.range(12, 26) : lot - rng.range(4, 8);
      let h = rng.range(district.hMin, district.hMax);
      if (Math.abs(cx) < 60 && Math.abs(cz) < 60) h += rng.range(4, 14); // downtown boost
      building(m, colliders, lx, lz, Math.max(8, w), Math.max(8, d), h, rng, district);
    }
    // Block props: palms, shrubs, stalls.
    const nP = Math.round(district.palm * rng.int(1, 3));
    for (let k = 0; k < nP; k++)
      palm(m, cx + rng.range(-14, 14), cz + rng.range(-14, 14), rng, false);
    for (let k = 0; k < rng.int(1, 3); k++) {
      const sx = cx + rng.range(-15, 15), sz = cz + rng.range(-15, 15);
      m.cone(sx, 0, sz, rng.range(0.8, 1.4), rng.range(0.8, 1.5), 6, [0.25, 0.50, 0.25], 0.03);
    }
    if (district.id === 'pasar' || district.id === 'batik') {
      for (let k = 0; k < rng.int(1, 2); k++) {
        const sx = cx + rng.range(-10, 10), sz = cz + rng.range(-10, 10);
        stall(m, sx, sz, rng);
        colliders.push({ x0: sx - 2, z0: sz - 1.6, x1: sx + 2, z1: sz + 1.6 });
      }
    }
  }

  // Beachfront avenue palms: dense double row, both sides of the west road.
  for (let z = -154; z <= 154; z += 13) {
    palm(m, -151, z + rng.range(-2, 2), rng, true);
    if ((Math.round(z) / 13) % 2 === 0) palm(m, -125, z + 6, rng, false);
  }
  // Beach life: umbrellas + figures.
  for (let k = 0; k < 22; k++) {
    const z = rng.range(-155, 155);
    umbrella(m, rng.range(-192, -158), z, rng);
  }
  for (let k = 0; k < 26; k++) beachFigure(m, rng.range(-192, -152), rng.range(-155, 155), rng);
  // Docks: cranes, containers, boats.
  crane(m, -52, 128); crane(m, -58, 92);
  const contCols = [[0.80, 0.35, 0.20], [0.25, 0.50, 0.65], [0.75, 0.65, 0.25], [0.35, 0.60, 0.40]];
  for (let k = 0; k < 10; k++) {
    const x = -46 + (k % 5) * 7, z = 108 + Math.floor(k / 5) * 8;
    m.box(x, 1.4, z, 6, 2.8, 2.6, contCols[k % 4], 0.03);
    colliders.push({ x0: x - 3, z0: z - 1.3, x1: x + 3, z1: z + 1.3 });
  }
  boat(m, -215, 120, rng, 0.4); boat(m, -225, 60, rng, -0.3); boat(m, -210, -40, rng, 0.9);
  boat(m, -180, 150, rng, 0.2);
  // Street lamps along every road, alternating sides.
  for (let i = 0; i < WORLD.roads; i++) {
    const c = roadAt(i);
    for (let d = -150; d <= 150; d += 30) {
      lampPost(m, c + 7.5, d);
      lampPost(m, d + 15, c - 7.5);
    }
  }
  // Skyline ring: distant towers, never rising out of the western sea.
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    const x = Math.cos(a) * WORLD.ringR, z = Math.sin(a) * WORLD.ringR;
    if (x < -170) continue;
    const h = rng.range(28, 72);
    const col = rng.pick([[0.45, 0.42, 0.48], [0.52, 0.46, 0.44], [0.40, 0.44, 0.50]]);
    m.box(x, h / 2 - 2, z, rng.range(12, 22), h, rng.range(12, 22), col, 0.02);
  }
  // Neon billboards on the promenade + east edge (glow landmarks).
  billboard(m, -144, -60, 10, 12, [0.95, 0.25, 0.55]);
  billboard(m, -144, 90, 12, 14, [0.20, 0.75, 0.95]);
  billboard(m, 144, -40, 11, 12, [0.95, 0.65, 0.15]);
  billboard(m, 144, 80, 10, 11, [0.55, 0.95, 0.35]);
  // Traffic lights at two busy junctions.
  trafficLight(m, -145, -16, 1, 'g');
  trafficLight(m, -145, 30, 1, 'r');
  trafficLight(m, 53, -16, -1, 'r');
  trafficLight(m, 53, 30, -1, 'g');
  // Mountains over the sea horizon + far north (depth cue, Maré Alta language).
  const mtn = [[-390, -120, 60, 40], [-410, 20, 72, 48], [-385, 130, 55, 36], [60, -390, 70, 44], [-120, -390, 60, 38]];
  for (const [x, z, r, h] of mtn) m.cone(x, -4, z, r, h, 7, [0.24, 0.30, 0.27], 0.0);

  return { mesh: m, colliders };
}

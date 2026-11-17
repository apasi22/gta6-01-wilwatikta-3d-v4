// WILWATIKTA 3D v4 — tuning, palettes, districts, vehicles, missions, radio.
// All numbers here shape the city, the look, and the story. No code from any
// earlier version was read or reused; every value was chosen fresh for v4.
export const WORLD = {
  pitch: 46, roads: 7, half: 161, roadW: 12, block: 34,
  seaX: -166, sandX: -196, ringR: 235, far: 620,
};
export function roadAt(i) { return (i - 3) * WORLD.pitch; }

// Districts: name, tagline, palette key, building height profile.
export const DISTRICTS = [
  { id: 'pantai', name: 'PANTAI KIDUL', sub: 'Beachfront avenue, palms and gold light', hMin: 6, hMax: 20, store: 0.9, palm: 1.0 },
  { id: 'alun', name: 'ALUN-ALUN', sub: 'Old square, new towers, gold teeth', hMin: 12, hMax: 46, store: 0.5, palm: 0.3 },
  { id: 'pasar', name: 'PASAR SENJA', sub: 'Spices, noise and second chances', hMin: 6, hMax: 18, store: 1.0, palm: 0.4 },
  { id: 'segara', name: 'PELABUHAN SEGARA', sub: 'Docks, cranes and quiet deals', hMin: 5, hMax: 14, store: 0.4, palm: 0.2 },
  { id: 'batik', name: 'KAMPUNG BATIK', sub: 'Dye vats, batik stalls, old money', hMin: 5, hMax: 16, store: 0.8, palm: 0.5 },
  { id: 'emas', name: 'LORONG EMAS', sub: 'Casinos, neon and fast talk', hMin: 10, hMax: 40, store: 0.7, palm: 0.3 },
];
export function districtAt(x, z) {
  if (x < -69) return DISTRICTS[0];
  if (z < -23) return DISTRICTS[5];
  if (z < 69) return x < 23 ? DISTRICTS[1] : DISTRICTS[2];
  return x < 23 ? DISTRICTS[3] : DISTRICTS[4];
}
// Points of interest on the map (x east, z south).
export const POI = {
  garage: { x: 69, z: 23, label: 'GARAGE' },
  docks: { x: -23, z: 138, label: 'DOCKS' },
  safehouse: { x: -46, z: 138, label: 'SAFEHOUSE' },
  mansion: { x: 115, z: -115, label: 'MANSION' },
  market: { x: 69, z: 0, label: 'MARKET' },
  casino: { x: 23, z: -115, label: 'CASINO' },
  warehouse: { x: -23, z: 115, label: 'WAREHOUSE' },
};

// Time-of-day palettes: sky gradient, sun, fog, window light.
export const PALETTES = {
  day: {
    skyTop: [0.25, 0.47, 0.78], skyMid: [0.55, 0.72, 0.90], skyBot: [0.88, 0.86, 0.78],
    sunDir: [-0.45, 0.75, 0.35], sunCol: [1.0, 0.95, 0.82], amb: 0.62,
    fogCol: [0.78, 0.80, 0.82], fogNear: 190, fogFar: 520, winLit: 0.22, lamp: 0.15, glow: 0.30,
    sunPos: [0.30, 0.72], sunCol2: [1.0, 0.95, 0.75],
  },
  dusk: {
    skyTop: [0.30, 0.16, 0.48], skyMid: [0.82, 0.36, 0.42], skyBot: [1.0, 0.68, 0.38],
    sunDir: [-0.85, 0.22, 0.15], sunCol: [1.0, 0.55, 0.30], amb: 0.42,
    fogCol: [0.85, 0.52, 0.42], fogNear: 150, fogFar: 470, winLit: 0.55, lamp: 0.7, glow: 0.75,
    sunPos: [0.26, 0.60], sunCol2: [1.0, 0.62, 0.30],
  },
  night: {
    skyTop: [0.03, 0.04, 0.12], skyMid: [0.08, 0.10, 0.26], skyBot: [0.22, 0.18, 0.32],
    sunDir: [-0.3, 0.9, 0.2], sunCol: [0.45, 0.55, 0.85], amb: 0.34,
    fogCol: [0.10, 0.11, 0.22], fogNear: 120, fogFar: 420, winLit: 0.78, lamp: 1.0, glow: 1.0,
    sunPos: [0.76, 0.78], sunCol2: [0.85, 0.88, 1.0],
  },
};
export function paletteAt(hour) {
  // Blend day -> dusk -> night -> day across the 24h clock.
  const keys = [[6, 'day'], [17, 'day'], [18.5, 'dusk'], [20, 'night'], [24, 'night'], [30, 'day']];
  let h = hour < 6 ? hour + 24 : hour;
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, k0] = keys[i]; const [h1, k1] = keys[i + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0 || 1);
      const a = PALETTES[k0]; const b = PALETTES[k1]; const out = {};
      for (const k of Object.keys(a)) {
        const va = a[k]; const vb = b[k];
        out[k] = Array.isArray(va) ? va.map((v, j) => v + (vb[j] - v) * t) : va + (vb - va) * t;
      }
      return out;
    }
  }
  return PALETTES.day;
}

// Facade colors: varied, saturated, NO dominant pale yellow. [r,g,b] 0..1.
export const FACADES = [
  [0.72, 0.42, 0.30], [0.62, 0.32, 0.26], [0.78, 0.55, 0.36], [0.55, 0.48, 0.38],
  [0.42, 0.55, 0.52], [0.36, 0.48, 0.58], [0.68, 0.52, 0.42], [0.58, 0.38, 0.44],
  [0.48, 0.58, 0.42], [0.74, 0.62, 0.44], [0.52, 0.42, 0.52], [0.66, 0.46, 0.30],
  [0.40, 0.44, 0.50], [0.80, 0.66, 0.50], [0.56, 0.56, 0.46], [0.46, 0.52, 0.60],
];
export const ROOFS = [[0.30, 0.26, 0.24], [0.38, 0.30, 0.26], [0.28, 0.32, 0.30], [0.42, 0.34, 0.28]];
export const AWNINGS = [
  [0.85, 0.25, 0.20], [0.20, 0.55, 0.75], [0.90, 0.65, 0.15], [0.25, 0.65, 0.35],
  [0.75, 0.30, 0.55], [0.95, 0.80, 0.25], [0.35, 0.40, 0.80], [0.90, 0.45, 0.20],
];
export const NEON = [
  [1.0, 0.35, 0.45], [0.35, 0.90, 1.0], [1.0, 0.80, 0.25], [0.55, 1.0, 0.45],
  [1.0, 0.55, 0.20], [0.85, 0.45, 1.0], [0.35, 1.0, 0.75],
];
export const WIN_LIT = [[1.0, 0.82, 0.45], [1.0, 0.70, 0.35], [0.75, 0.88, 1.0], [1.0, 0.90, 0.60]];
export const WIN_DARK = [[0.16, 0.20, 0.26], [0.20, 0.24, 0.30], [0.13, 0.17, 0.22]];

export const CARS = [
  { name: 'GARUDA GT', col: [0.85, 0.12, 0.10], len: 4.6, wid: 2.0, top: 34, acc: 15 },
  { name: 'KENCANA S', col: [0.90, 0.70, 0.15], len: 4.4, wid: 1.9, top: 32, acc: 14 },
  { name: 'ARJUNA', col: [0.65, 0.72, 0.80], len: 4.5, wid: 2.0, top: 31, acc: 13 },
  { name: 'SRIKANDI', col: [0.15, 0.60, 0.55], len: 4.2, wid: 1.9, top: 29, acc: 13 },
  { name: 'GATOTKACA', col: [0.20, 0.35, 0.22], len: 4.9, wid: 2.1, top: 27, acc: 11 },
  { name: 'BIMA', col: [0.90, 0.45, 0.10], len: 4.3, wid: 1.9, top: 30, acc: 14 },
  { name: 'TAKSI KOTA', col: [0.95, 0.80, 0.20], len: 4.4, wid: 1.9, top: 26, acc: 11 },
  { name: 'PICKUP', col: [0.45, 0.50, 0.55], len: 4.8, wid: 2.0, top: 25, acc: 10 },
];
export const WEAPONS = [
  { name: 'FISTS', dmg: 12, mag: 0, reserve: 0, rate: 0.45, auto: false, range: 2.6 },
  { name: 'PISTOL', dmg: 22, mag: 12, reserve: 60, rate: 0.30, auto: false, range: 55 },
  { name: 'SMG', dmg: 14, mag: 30, reserve: 90, rate: 0.09, auto: true, range: 48 },
];
export const REP_TITLES = ['PENDATANG', 'JAGOAN', 'BANDIT', 'LEGENDA', 'RAJA JALANAN'];

// The 12-mission story chain. Types: goto, steal, deliver, collect, race, clear, escape, survive.
export const MISSIONS = [
  { name: 'Selamat Datang', brief: 'Meet Agus at the market. He has work for a driver.', type: 'goto', x: 69, z: 0, time: 150, rw: 200,
    talk: [['AGUS', 'Sugeng! Wilwatikta missed its fastest driver.'], ['SUGENG', 'I was away two years, Agus. What changed?'], ['AGUS', 'Everything. Wanto runs the WPD now. Careful.']] },
  { name: 'Hot Wheels', brief: 'Steal the gold coupe — bring it to Bengkel Bambang.', type: 'steal', x: 69, z: 23, time: 180, rw: 450,
    talk: [['AGUS', 'The gold coupe is yours, Sugeng. Don\u2019t scratch the paint.'], ['SUGENG', 'Since when do I scratch paint?'], ['BAMBANG', 'Bring her here. I will make her disappear.']] },
  { name: 'Antar Paket', brief: 'Deliver the package to the docks before the clock runs out.', type: 'deliver', x: -23, z: 138, time: 120, rw: 500,
    talk: [['AGUS', 'No questions about the package. Just drive.'], ['SUGENG', 'I never ask. That is why I am still alive.']] },
  { name: 'Tagihan Pasar', brief: 'Collect from three stalls in Pasar Senja.', type: 'collect', x: 69, z: 0, time: 240, rw: 600,
    talk: [['AGUS', 'Three stalls owe the boss. Be polite. Be firm.'], ['SUGENG', 'Polite is my middle name.']] },
  { name: 'Mata-Mata', brief: 'Reach the lookout above Lorong Emas and watch the casino.', type: 'goto', x: 23, z: -115, time: 180, rw: 550,
    talk: [['AGUS', 'Wanto meets someone at the casino. Find out who.'], ['SUGENG', 'I see better from high up.']] },
  { name: 'Balapan Senja', brief: 'Win the sunset race: hit every checkpoint.', type: 'race', x: -138, z: -69, time: 150, rw: 800,
    talk: [['RATNA', 'Beat me around the beachfront and the purse is yours.'], ['SUGENG', 'You should have kept your money, Ratna.']] },
  { name: 'Gudang Segara', brief: 'Clear the warehouse crew at Pelabuhan Segara.', type: 'clear', x: -23, z: 115, time: 300, rw: 900,
    talk: [['AGUS', 'The crew at the warehouse works for Wanto now.'], ['SUGENG', 'Then the warehouse needs new management.']] },
  { name: 'Kabur dari WPD', brief: 'Lose the heat. Break line of sight and stay hidden.', type: 'escape', x: -46, z: 138, time: 180, rw: 700,
    talk: [['WPD DISPATCH', 'All units: suspect heading south on the beachfront.'], ['SUGENG', 'Time to show WPD my taillights.']] },
  { name: 'Heat Wave', brief: 'Outrun the helicopter — reach the docks!', type: 'deliver', x: -23, z: 138, time: 150, rw: 1100,
    talk: [['SUGENG', 'Four stars and a helicopter. Time to show WPD my taillights.'], ['AGUS', 'The docks, Sugeng! Lose them in the cranes!']] },
  { name: 'Kencana Hilang', brief: 'Recover the stolen Kencana S from the casino strip.', type: 'steal', x: 115, z: -115, time: 210, rw: 950,
    talk: [['RATNA', 'They took my Kencana. Get it back and I owe you one.'], ['SUGENG', 'You already owe me three.']] },
  { name: 'Double Cross', brief: 'Reach the safehouse. Lose the heat if you can.', type: 'escape', x: -46, z: 138, time: 180, rw: 1000,
    talk: [['AGUS', 'Double cross at the marina, Sugeng. Wanto set the whole thing up.'], ['SUGENG', 'Then Wanto and I need to talk.']] },
  { name: 'The Last Ride', brief: 'Drive to the mansion. Finish this, whatever it takes.', type: 'survive', x: 115, z: -115, time: 240, rw: 2500,
    talk: [['SUGENG', 'Twelve jobs. One city. Tonight it ends.'], ['WANTO', 'You were always too fast for your own good, Sugeng.']] },
];

export const RADIOS = [
  { name: 'GAMELAN FM 101.1', track: 'Saron Senja', scale: [0, 2, 4, 7, 9, 12, 14, 16], base: 220, tempo: 0.42, wave: 'triangle' },
  { name: 'RADIO WILWATIKTA', track: 'Kroncong Pelabuhan', scale: [0, 3, 5, 7, 10, 12, 15, 17], base: 196, tempo: 0.34, wave: 'sine' },
];
export const DISPATCH = {
  day: ['quiet morning in {d}. All units routine patrol.', 'traffic flowing on the beachfront. No incidents.', 'patrol 4 requesting coffee near {d}.'],
  dusk: ['air support on scene, suspect heading north on the beachfront.', 'units respond in {d} — suspect armed.', 'roadblock requested at the {d} junction.'],
  night: ['all units: suspect vehicle last seen near {d}.', 'helicopter refuelling. Ground units hold position.', 'quiet night in {d}. Keep the lights on.'],
};
export const PED_NAMES = ['Bambang', 'Ratna', 'Dedi', 'Sari', 'Eko', 'Wulan', 'Joko', 'Rina', 'Agus', 'Dewi'];

// HUD: DOM panels, circular minimap, speedometer, all overlay screens, and
// the full-city map. The map's mission list uses two fixed columns (title +
// status) so long titles never wrap into their status — the v3 map flaw.
import { WORLD, roadAt, districtAt, MISSIONS, POI, REP_TITLES, WEAPONS } from './config.js';
import { wantedLabel } from './police.js';
import { slotInfo } from './save.js';

function $(id) { return document.getElementById(id); }
function fmtClock(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function starsStr(w) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < w ? '\u2605' : '\u2606';
  return s;
}
const ROLES = { SUGENG: 'GETAWAY DRIVER', AGUS: 'FIXER', WANTO: 'KOMISARIS WPD', BAMBANG: 'MECHANIC', RATNA: 'STREET RACER', DISPATCH: 'WPD RADIO' };

export function initHUD(game) {
  game.hud = {
    districtName: $('district-name'), districtSub: $('district-sub'), clock: $('clock'),
    mTitle: $('mission-title'), mBrief: $('mission-brief'), mTimer: $('mission-timer'), mDist: $('mission-dist'),
    stageBar: $('stage-bar'), missionNext: $('mission-next'),
    standingVal: $('standing-val'), standingBar: $('standing-bar'),
    cash: $('cash'), stars: $('stars'), wantedLabel: $('wanted-label'),
    wslots: [$('wslot-0'), $('wslot-1'), $('wslot-2'), $('wslot-3')],
    wammo: [$('wammo-0'), $('wammo-1'), $('wammo-2'), $('wammo-3')],
    crewZ: $('crew-z'), crewZCost: $('crew-z-cost'),
    crewX: $('crew-x'), crewXCost: $('crew-x-cost'),
    crewC: $('crew-c'), crewCCost: $('crew-c-cost'),
    wpd: $('wpd-panel'), wpdHead: $('wpd-head'), wpdRows: $('wpd-rows'), wpdFoot: $('wpd-foot'),
    hpBar: $('hp-bar'), armorBar: $('armor-bar'), rep: $('rep-level'), repTitle: $('rep-title'),
    dialogue: $('dialogue'), dWho: $('dialogue-who'), dLine: $('dialogue-line'),
    portrait: $('portrait-initials'),
    dispatch: $('dispatch'), radioStation: $('radio-station'), radioTrack: $('radio-track'), banner: $('banner'),
    wmName: $('watermark-name'), wmSub: $('watermark-sub'),
    vignette: $('vignette'), minimap: $('minimap'), speedo: $('speedo'),
    screens: {}, screen: null,
  };
  for (const name of ['title', 'pause', 'garage', 'howto', 'passed', 'busted', 'wasted', 'saves', 'map'])
    game.hud.screens[name] = $('screen-' + name);
  // Wire menu buttons to game actions (defined by main.js).
  const wire = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  wire('btn-new', () => game.action('new'));
  wire('btn-continue', () => game.action('continue'));
  wire('btn-howto', () => game.action('howto'));
  wire('btn-saves', () => game.action('saves'));
  wire('btn-resume', () => game.action('resume'));
  wire('btn-pause-garage', () => game.action('garage'));
  wire('btn-pause-map', () => game.action('map'));
  wire('btn-pause-howto', () => game.action('howto'));
  wire('btn-pause-save', () => game.action('saves'));
  wire('btn-pause-title', () => game.action('title'));
  wire('btn-howto-close', () => game.action('back'));
  wire('btn-passed-ok', () => game.action('resume'));
  wire('btn-busted-ok', () => game.action('respawn'));
  wire('btn-wasted-ok', () => game.action('respawn'));
  wire('btn-saves-close', () => game.action('back'));
  wire('btn-garage-close', () => game.action('back'));
  wire('btn-map-close', () => game.action('back'));
  for (let s = 0; s < 3; s++) {
    wire('slot-' + s + '-save', () => game.action('save-slot', s));
    wire('slot-' + s + '-load', () => game.action('load-slot', s));
  }
  for (const key of ['engine', 'armor', 'paint', 'repair'])
    wire('up-' + key, () => game.action('upgrade', key));
}

export function showScreen(game, name) {
  const h = game.hud;
  if (h.screen === name) return; // rebuild overlays only on screen change
  h.screen = name;
  for (const [k, el] of Object.entries(h.screens)) el.style.display = k === name ? 'flex' : 'none';
  if (name === 'garage') buildGarage(game);
  if (name === 'saves') buildSaves(game);
  if (name === 'map') drawMapScreen(game);
  if (name === 'passed' && game.showPassed) {
    $('passed-name').textContent = game.showPassed.name;
    $('passed-reward').textContent = '+$' + game.showPassed.reward;
  }
}

export function buildGarage(game) {
  $('garage-cash').textContent = '$' + game.cash.toLocaleString();
  const u = game.upgrades;
  const rows = [
    ['engine', 'Engine Tuning', 'Top speed +' + (u.engine * 3) + ' km/h', 600 + u.engine * 400, u.engine < 3],
    ['armor', 'Armor Plating', 'Max armor +' + (u.armor * 25), 500 + u.armor * 350, u.armor < 3],
    ['paint', 'Fresh Paint', 'A new look for your ride', 250, true],
    ['repair', 'Full Repair', 'Fix all damage', 150, true],
  ];
  for (const [key, name, desc, price, avail] of rows) {
    $('up-' + key + '-name').textContent = name;
    $('up-' + key + '-desc').textContent = desc;
    $('up-' + key + '-price').textContent = '$' + price;
    $('up-' + key).disabled = !avail || game.cash < price;
  }
}

export function buildSaves(game) {
  for (let s = 0; s < 3; s++) {
    const info = slotInfo(s);
    $('slot-' + s + '-info').textContent = info
      ? '$' + info.cash.toLocaleString() + ' · ' + info.missions + '/12 missions · Day ' + info.day
      : 'Empty slot';
    $('slot-' + s + '-load').disabled = !info;
  }
}

export function updateHUD(game) {
  const h = game.hud;
  const p = game.player;
  const d = districtAt(p.x, p.z);
  h.districtName.textContent = d.name;
  h.districtSub.textContent = d.sub;
  h.clock.textContent = fmtClock(game.hour) + ' · DAY ' + game.day;
  h.wmName.textContent = d.name;
  h.wmSub.textContent = d.sub;
  // Mission banner.
  const m = game.missions;
  if (m.active) {
    const def = MISSIONS[m.index];
    h.mTitle.textContent = 'MISSION ' + (m.index + 1) + '/12 — ' + def.name;
    h.mBrief.textContent = def.brief;
    h.mTimer.textContent = Math.max(0, Math.ceil(m.timer)) + 's';
    const dist = Math.hypot(p.x - m.target.x, p.z - m.target.z);
    h.mDist.textContent = Math.round(dist) + ' m';
  } else {
    h.mTitle.textContent = m.done >= 12 ? 'WILWATIKTA COMPLETE' : 'FREE ROAM';
    h.mBrief.textContent = m.done >= 12 ? 'Every mission done. The city is yours.' : 'Next mission starting soon…';
    h.mTimer.textContent = '';
    h.mDist.textContent = '';
  }
  h.cash.textContent = '$' + game.cash.toLocaleString();
  h.stars.textContent = starsStr(game.wanted);
  h.stars.style.color = game.wanted >= 3 ? '#ff5040' : '#ffd75e';
  h.wantedLabel.textContent = wantedLabel(game.wanted);
  h.wantedLabel.style.color = game.wanted === 0 ? '#7ddb8a' : '#ff5040';
  // Stage progress (12 segments) + next mission.
  let segs = '';
  for (let i = 0; i < 12; i++) segs += '<span class="' + (i < m.done ? 'done' : (m.active && i === m.index ? 'active' : '')) + '"></span>';
  h.stageBar.innerHTML = segs;
  const nextIdx = m.active ? m.index + 1 : m.done;
  h.missionNext.innerHTML = nextIdx < 12 ? 'NEXT: <b>' + (nextIdx + 1) + '. ' + MISSIONS[nextIdx].name + '</b>' : 'NEXT: <b>STORY COMPLETE</b>';
  // District standing.
  const standing = Math.min(99, 20 + game.rep);
  h.standingVal.textContent = (standing >= 70 ? 'FEARED' : standing >= 45 ? 'RESPECTED' : 'NEUTRAL') + ' · ' + standing;
  h.standingBar.style.width = standing + '%';
  // Weapon slot bar: numbered slots, ammo, current highlighted, locked shown.
  const smgLocked = m.done < 3;
  for (let i = 0; i < 4; i++) {
    const slot = h.wslots[i], ammoEl = h.wammo[i];
    const locked = (i === 2 && smgLocked) || i === 3;
    slot.className = 'wslot' + (i === p.weapon ? ' active' : '') + (locked ? ' locked' : '');
    if (locked) ammoEl.textContent = 'LOCKED';
    else if (i === 0) ammoEl.textContent = '∞';
    else if (i === p.weapon) ammoEl.textContent = p.reload > 0 ? '…' : p.ammo + ' / ' + p.reserve;
    else ammoEl.textContent = WEAPONS[i].mag + ' / ' + WEAPONS[i].reserve;
  }
  // Crew cards: cost + cooldown states.
  for (const [key, cost] of [['z', 100], ['x', 150], ['c', 200]]) {
    const card = h['crew' + key.toUpperCase()], costEl = h['crew' + key.toUpperCase() + 'Cost'];
    const cd = game.crew[key];
    card.className = 'crew-card' + (cd > 0 ? ' cooling' : game.cash < cost ? ' poor' : ' ready');
    costEl.textContent = cd > 0 ? Math.ceil(cd) + 's' : '$' + cost;
  }
  // WPD response panel — named units, distances, status pills. Wanted only.
  if (game.wanted > 0) {
    h.wpd.style.display = 'block';
    const n = game.police.cars.length + (game.heli.active ? 1 : 0);
    h.wpdHead.textContent = 'WPD RESPONSE — ' + n + ' UNIT' + (n === 1 ? '' : 'S') + ' · CODE ' + game.wanted;
    let rows = '';
    for (const c of game.police.cars) {
      const dist = Math.round(Math.hypot(c.x - p.x, c.z - p.z));
      const st = dist < 20 ? ['RAMMING', 'ram'] : dist < 50 ? ['FLANKING', 'pur'] : ['PURSUIT', 'pur'];
      rows += '<div class="wpd-row"><span class="u">' + (c.callsign || 'WPD UNIT') + '</span><span class="d">' + dist + ' m</span><span class="pill ' + st[1] + '">' + st[0] + '</span></div>';
    }
    if (game.heli.active) rows += '<div class="wpd-row"><span class="u">HELI-1</span><span class="d">AIR</span><span class="pill air">SPOTLIGHT</span></div>';
    if (game.police.roadblocks.length > 0) rows += '<div class="wpd-row"><span class="u">BLOCKADE</span><span class="d">AHEAD</span><span class="pill rb">ROADBLOCK</span></div>';
    h.wpdRows.innerHTML = rows;
    h.wpdFoot.textContent = game.wanted >= 3 ? 'SEARCH ZONE ACTIVE — BREAK LINE OF SIGHT · SWAP CARS' : 'UNITS CONVERGING ON YOUR POSITION';
  } else h.wpd.style.display = 'none';
  h.hpBar.style.width = Math.max(0, p.hp) + '%';
  h.armorBar.style.width = Math.max(0, p.armor) + '%';
  const repLvl = Math.min(4, Math.floor(game.rep / 60));
  h.rep.textContent = 'REP LVL ' + (repLvl + 1);
  h.repTitle.textContent = REP_TITLES[repLvl];
  // Dialogue + dispatch + radio.
  if (game.dialogue && game.dialogue.t > 0) {
    h.dialogue.style.display = 'flex';
    const who = game.dialogue.who;
    h.portrait.textContent = who.split(' ').map((w2) => w2[0]).join('').slice(0, 2);
    h.dWho.innerHTML = who + ' <span>· ' + (ROLES[who] || 'WILWATIKTA') + '</span>';
    h.dLine.textContent = game.dialogue.line;
  } else h.dialogue.style.display = 'none';
  h.dispatch.innerHTML = '<b>WPD DISPATCH:</b> ' + game.dispatchLine;
  const rn = game.audio.radioName().split(' · ');
  h.radioStation.textContent = (rn[0] || '') + (game.audio.muted ? ' · MUTED' : '');
  h.radioTrack.textContent = rn[1] || '';
  // Center banner.
  if (m.bannerT > 0) {
    h.banner.style.display = 'block';
    h.banner.textContent = m.banner;
  } else h.banner.style.display = 'none';
  h.vignette.style.opacity = p.hp < 30 ? String(0.5 - p.hp * 0.012) : '0';
  drawMinimap(game);
  drawSpeedo(game);
}

function drawMinimap(game) {
  const cv = game.hud.minimap;
  const ctx = cv.getContext('2d');
  const S = cv.width, C = S / 2;
  const p = game.player;
  const range = 130; // world units shown across the circle
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();
  // Sand + sea + blocks.
  ctx.fillStyle = '#c9b489'; ctx.fillRect(0, 0, S, S);
  const toMap = (x, z) => [C + (x - p.x) * (S / range), C + (z - p.z) * (S / range)];
  const [seaX] = toMap(-150, 0);
  ctx.fillStyle = '#3f8fb5'; ctx.fillRect(0, 0, Math.max(0, seaX), S);
  ctx.fillStyle = '#e2cd96'; ctx.fillRect(Math.max(0, seaX), 0, 8, S);
  // Blocks.
  ctx.fillStyle = '#b7a67f';
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const [mx, mz] = toMap(-115 + bx * 46, -115 + bz * 46);
    const s = 34 * (S / range);
    ctx.fillRect(mx - s / 2, mz - s / 2, s, s);
  }
  // Roads.
  ctx.strokeStyle = '#6d675c'; ctx.lineWidth = 12 * (S / range);
  for (let i = 0; i < 7; i++) {
    const [rx] = toMap(roadAt(i), 0);
    const [, rz] = toMap(0, roadAt(i));
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(S, rz); ctx.stroke();
  }
  // Route to mission target.
  const m = game.missions;
  if (m.active && m.target) {
    const [tx, tz] = toMap(m.target.x, m.target.z);
    ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(tx, tz); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.arc(tx, tz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5b00';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', tx, tz + 3);
  }
  // Police + heli blips.
  ctx.fillStyle = '#4d8dff';
  for (const c of game.police.cars) {
    const [mx, mz] = toMap(c.x, c.z);
    ctx.beginPath(); ctx.arc(mx, mz, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (game.heli.active) {
    const [hx, hz] = toMap(game.heli.x, game.heli.z);
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('H', hx, hz + 4);
  }
  // Search zone ring while wanted.
  if (game.wanted > 0) {
    ctx.strokeStyle = 'rgba(255,80,64,0.85)'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(C, C, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Player arrow.
  ctx.translate(C, C);
  ctx.rotate(-p.heading + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // Ring + north.
  ctx.strokeStyle = '#ffd75e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', C, 14);
}

function drawSpeedo(game) {
  const cv = game.hud.speedo;
  const ctx = cv.getContext('2d');
  const S = cv.width, C = S / 2;
  const p = game.player;
  const kmh = p.inCar ? Math.abs(p.car.speed) * 3.4 : 0;
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(C, C, C - 8, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  const frac = Math.min(1, kmh / 130);
  ctx.strokeStyle = kmh > 100 ? '#ff5040' : '#ffd75e';
  ctx.beginPath(); ctx.arc(C, C, C - 8, Math.PI * 0.75, Math.PI * 0.75 + frac * Math.PI * 1.5); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(String(Math.round(kmh)), C, C + 8);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#ffd75e';
  ctx.fillText('KM/H', C, C + 22);
  const gear = !p.inCar ? 'N' : Math.min(5, 1 + Math.floor(kmh / 26));
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffd75e'; ctx.textAlign = 'right';
  ctx.fillText(p.inCar ? 'G' + gear : 'N', S - 10, 18);
  ctx.textAlign = 'center';
  if (p.inCar) {
    const cond = Math.round((1 - p.car.damage) * 100);
    ctx.fillStyle = cond > 50 ? '#7ddb8a' : '#ff5040';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('COND ' + cond + '%', C, C + 36);
  }
  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(p.inCar ? p.car.spec.name : 'ON FOOT', C, S - 6);
}

export function drawMapScreen(game) {
  const cv = $('map-canvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const toMap = (x, z) => [(x + 170) / 340 * W, (z + 170) / 340 * H];
  // Sea + sand + land.
  ctx.fillStyle = '#2f7ba3'; ctx.fillRect(0, 0, W, H);
  const [sandX] = toMap(-150, 0);
  ctx.fillStyle = '#e2cd96'; ctx.fillRect(sandX, 0, 10, H);
  ctx.fillStyle = '#d8c49a'; ctx.fillRect(sandX + 10, 0, W, H);
  // District tints.
  const tints = { pantai: '#e8d5a0', alun: '#d9b48f', pasar: '#e3c39a', segara: '#c2cdb0', batik: '#e8b8c8', emas: '#d9c48f' };
  const rects = [
    ['pantai', -161, -161, 92, 322], ['alun', -69, -23, 92, 92], ['pasar', 23, -23, 138, 92],
    ['segara', -69, 69, 92, 92], ['batik', 23, 69, 138, 92], ['emas', -69, -161, 230, 138],
  ];
  for (const [id, x0, z0, w, d] of rects) {
    const [mx, mz] = toMap(x0, z0);
    ctx.fillStyle = tints[id];
    ctx.fillRect(mx, mz, w / 340 * W, d / 340 * H);
  }
  // City blocks: dense building pattern inside each district.
  ctx.fillStyle = 'rgba(105,90,66,0.45)';
  for (let bx = 0; bx < 6; bx++) for (let bz = 0; bz < 6; bz++) {
    const [mx, mz] = toMap(-115 + bx * 46, -115 + bz * 46);
    for (const [ox, oz] of [[-17, -15], [17, -15], [-17, 15], [17, 15]])
      ctx.fillRect(mx + ox - 13, mz + oz - 11, 26, 22);
  }
  // Roads.
  ctx.strokeStyle = '#4a4640'; ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    const [rx] = toMap(roadAt(i), 0);
    const [, rz] = toMap(0, roadAt(i));
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(W, rz); ctx.stroke();
  }
  ctx.strokeStyle = '#8a8478'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const [rx] = toMap(roadAt(i), 0);
    const [, rz] = toMap(0, roadAt(i));
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(W, rz); ctx.stroke();
  }
  // POI stars.
  ctx.textAlign = 'center';
  for (const [key, poi] of Object.entries(POI)) {
    const [mx, mz] = toMap(poi.x, poi.z);
    ctx.fillStyle = '#7a2ea6';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('★', mx, mz + 5);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(poi.label, mx, mz - 10);
  }
  // District labels.
  ctx.fillStyle = 'rgba(20,20,20,0.75)';
  ctx.font = 'bold 12px sans-serif';
  const labels = [['PANTAI KIDUL', -115, 0], ['ALUN-ALUN', -23, 23], ['PASAR SENJA', 100, 46], ['PELABUHAN SEGARA', -60, 95], ['KAMPUNG BATIK', 92, 115], ['LORONG EMAS', 46, -92]];
  for (const [t, x, z] of labels) { const [mx, mz] = toMap(x, z); ctx.fillText(t, mx, mz); }
  // Route + player.
  const m = game.missions;
  if (m.active && m.target) {
    const [px, pz] = toMap(game.player.x, game.player.z);
    const [tx, tz] = toMap(m.target.x, m.target.z);
    ctx.strokeStyle = '#c9a400'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(tx, tz); ctx.stroke();
    ctx.setLineDash([]);
  }
  const [px, pz] = toMap(game.player.x, game.player.z);
  ctx.save();
  ctx.translate(px, pz); ctx.rotate(-game.player.heading + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // Mission list: two fixed columns, no wrapping into the status.
  const list = $('map-list');
  let html = '';
  for (let i = 0; i < MISSIONS.length; i++) {
    const st = i < m.done ? 'DONE' : (m.active && i === m.index ? 'ACTIVE' : '—');
    const cls = st === 'ACTIVE' ? 'map-active' : (st === 'DONE' ? 'map-done' : 'map-todo');
    html += '<div class="map-row ' + cls + '"><span class="map-name">' + (i + 1) + '. ' + MISSIONS[i].name + '</span><span class="map-status">' + st + '</span></div>';
  }
  list.innerHTML = html;
  const repLvl = Math.min(4, Math.floor(game.rep / 60));
  $('map-stats').textContent = 'Cash $' + game.cash.toLocaleString() + ' · Missions ' + m.done + '/12 · STORY ' + Math.round(m.done / 12 * 100) + '% · REP ' + REP_TITLES[repLvl] + ' · Kills ' + game.stats.kills + ' · Stolen ' + game.stats.stolen;
}

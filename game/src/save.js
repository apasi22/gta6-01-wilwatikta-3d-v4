// Save slots in localStorage: cash, progress, upgrades, position, stats.
// Three slots; the save screen reads/writes through these helpers.
const KEY = 'wilwatikta3d-v4-slot-';

export function saveGame(slot, game) {
  try {
    const data = {
      cash: game.cash, rep: game.rep, missionsDone: game.missions.done,
      upgrades: game.upgrades, x: game.player.x, z: game.player.z,
      hp: game.player.hp, armor: game.player.armor,
      weapon: game.player.weapon, ammo: game.player.ammo, reserve: game.player.reserve,
      stats: game.stats, hour: game.hour, day: game.day, savedAt: Date.now(),
    };
    localStorage.setItem(KEY + slot, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}
export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(KEY + slot);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function slotInfo(slot) {
  const d = loadGame(slot);
  if (!d) return null;
  return { cash: d.cash, missions: d.missionsDone, day: d.day, savedAt: d.savedAt };
}
export function applySave(game, d) {
  game.cash = d.cash; game.rep = d.rep;
  game.missions.done = d.missionsDone;
  game.upgrades = { ...game.upgrades, ...d.upgrades };
  game.player.x = d.x; game.player.z = d.z;
  game.player.hp = d.hp; game.player.armor = d.armor;
  game.player.weapon = d.weapon; game.player.ammo = d.ammo; game.player.reserve = d.reserve;
  game.stats = { ...game.stats, ...d.stats };
  game.hour = d.hour; game.day = d.day;
}

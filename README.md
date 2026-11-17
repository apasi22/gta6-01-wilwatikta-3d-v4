# WILWATIKTA 3D — Javanese open-world crime in a sunset city

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/apasi22/gta6-01-wilwatikta-3d-v4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/apasi22/gta6-01-wilwatikta-3d-v4/reward.svg)](https://make.fun/bounty/gta6-01)

Sugeng Wibowo is back in Wilwatikta: a 3D open-world crime game built from
scratch in raw WebGL — no libraries, no downloaded assets, everything
procedural. Six named districts, a beachfront avenue with palms and
beachgoers, docks with cranes, a casino strip, a batik quarter, and a night
city full of lit windows.

**What is in the game**

- **Driving & on-foot play** — steal and drive 8 car models, walk the
  sidewalks, enter and exit cars, car damage and smoke.
- **12-mission story chain** — deliveries, car theft, a sunset race, a
  warehouse fight, helicopter escapes, and a finale at the mansion, with
  dialogue from Agus, Ratna, Bambang, and Komisaris Wanto.
- **WPD wanted system** — 5 stars, pursuing cruisers, roadblocks, and a
  police helicopter with a searchlight that blocks wanted decay.
- **Combat** — fists, pistol, SMG, reloads, tracers, sparks, and pickups.
- **Progression** — cash, reputation levels, garage upgrades (engine, armor,
  paint, repair), and 3 save slots.
- **Full HUD** — cash, stars, weapon, health/armor, mission banner with timer
  and distance, circular minimap with route, speedometer, district banners,
  dispatch lines, and two synthesized radio stations (Gamelan FM, Radio
  Wilwatikta).
- **Day / dusk / night** — a full time-of-day palette cycle with fog, sun
  disc, headlight pools, and window glow.

**Controls** — WASD drive/walk, E enter/exit car, mouse click shoot, Space
handbrake, F punch, R reload, Q weapon, T radio, G garage, Tab map, P pause,
M mute, H horn.

**Files** — `game/index.html` plus single-job modules under `game/src/`:
renderer (`gl.js`), city (`city.js`), vehicles, characters, police and
helicopter, combat, missions, HUD and map, audio, saves, screenshot staging,
and the main loop. Screenshots are staged deterministically with
`?shot=cover|map|foot|night&seed=1`.

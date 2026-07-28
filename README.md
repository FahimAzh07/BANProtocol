# BAN's Protocol — Adaptive Horde Survival

A fuzzy-logic-driven survival shooter. The default presentation is HTML5 Canvas + JS,
with an optional integrated Three.js first-person view. A 729-rule Mamdani fuzzy controller reads the player's live state and
continuously adjusts enemy aggression, horde size, and spawn behaviour across a scrolling
maze world with stealth (vision/noise/fog) mechanics. Q cycles weapons.

The first-person renderer is loaded and can be enabled in Settings. It shares the same
world, combat, objectives, enemies, and fuzzy director as the top-down presentation.

## Play online (clickable links)

- **▶ Play the game:** https://claude.ai/code/artifact/d0585e97-0d79-4e1c-97dc-036b0461d796
- **📊 Read the report:** https://claude.ai/code/artifact/7ef6cbff-9b7d-4007-b52c-d3bd0d0a7db3

*(The hosted game is a self-contained, music-less build — click once to enable the procedural SFX. The full
version with the Molchat Doma soundtrack runs from `game/index.html` locally, or deploy the `game/` folder to
Netlify. Rebuild the single-file artifact with `node game/build_artifact.js <outDir>`.)*

## Folder layout

```
Project ISP568/
├── README.md            ← this file
├── game/                ← the playable game (open game/index.html to run)
│   ├── index.html
│   ├── css/style.css
│   ├── audio/ … (bgm1–6.mp3 — the Molchat Doma soundtrack)
│   └── js/ … (+ js/lib/three.min.js)
└── report/              ← the ISP568 assessment report
    ├── Progress_Report_1_UPDATED.{pdf,html,md,txt}
    ├── _report_src.html        ← HTML template (build input)
    ├── report_build.js         ← renders the SVG fuzzy graphs into the report
    └── supporting-docs/        ← extra fuzzy-logic write-ups
```

## Run it

Just open `game/index.html` in a browser (double-click works — plain script tags, no server needed).
Or in VS Code: right-click `game/index.html` → *Open with Live Server* for auto-reload while editing.

**Rebuild the report** (after any change to the fuzzy graphs): `cd report && node report_build.js`,
then open `Progress_Report_1_UPDATED.html` and *Print → Save as PDF*.

**Verify and simulate the director:** from `game/`, run `node tests/fuzzy.test.js` and
`node tests/simulate_balance.js 20`. The simulator uses identical seeds for Fuzzy,
Static, Linear, and Chaos synthetic state trajectories.

## Project structure

All paths below are inside **`game/`**.

| File | What's inside | Modify this to… |
|---|---|---|
| `index.html` | Canvas + script load order + display font | add new script files (order matters) |
| `css/style.css` | Page chrome only (game UI is canvas-drawn) | change page background / hint bar |
| `js/config.js` | Canvas, `ctx`, `W`/`H`, resize | change resolution |
| `js/audio.js` | **Music + WebAudio**: shuffled BGM playlist from `audio/` (loading screen + gameplay, auto-advancing, **N** skips), **beat-reactive lighting** (real FFT beat detection on a server; tempo-pulse fallback on `file://`), procedurally-synthesised SFX, subtle Threat drone + low-HP heartbeat, mute (**M**) | swap tracks/BPM in `PLAYLIST`, tune sounds/ducking |
| `js/post.js` | Full-screen **bloom** post-process (downsample → blur → additive composite) | bloom strength / buffer size |
| `js/world.js` | Maze generation (39×23 tiles → 3900×2300 px world), wall collision, line-of-sight, fog zones, minimap prerender | maze size/density, fog count |
| `js/fuzzy.js` | **The fuzzy engine**: 6 inputs, complete 729-rule base, Threat/Supply/Composition outputs, Mamdani/Sugeno comparison — plus `MicroFuzzy`, a 27-rule per-enemy controller | tune MF breakpoints, scoring coefficients, band thresholds |
| `js/state.js` | `G` global state object + `reset()` | change starting values, add new run state |
| `js/weapons.js` | Weapons (rifle/shotgun/bazooka), levelling, power-ups, coin meta (localStorage) | weapon stats/costs, power-up kinds/durations, coin rewards |
| `js/mechanics.js` | `update()` loop, shooting, reload, `spawnWave()` director | change weapon feel, threat→gameplay formulas, add enemy types |
| `js/input.js` | Keyboard + mouse handlers | add keybinds |
| `js/render.js` | World rendering (camera, walls, fog), additive lights + shockwave rings, pseudo-3D `drawCharacter()`, UI palette | change visuals, add new entity rendering |
| `js/advanced.js` | v7 experiments, missions, themes, telemetry/history, saves, weapon modules, squad navigation, accessibility | extend the advanced systems |
| `js/render3d.js` | Integrated optional first-person Three.js renderer | change the 3D presentation |
| `js/hud.js` | Threat gauge, MF graphs, active-rules panel, vitals | change HUD layout / visualisation |
| `js/screens.js` | Setup screen (sliders + deploy), pause/death, click routing | add settings sliders, menus, buttons |
| `js/main.js` | `requestAnimationFrame` loop | add new game states to the draw switch |

## How the fuzzy loop works (short version)

Every 10 frames, `mechanics.js` samples six crisp inputs (0–100):
Health %, total Ammo %, Noise (gunfire + movement, decays −0.35/frame),
Pressure (how swarmed the player already is), **Exposure** (detection: enemies
with line-of-sight push it to 100; hiding in fog drains it ~5× faster; loud noise
sets a "suspicious" floor of 65), and **Skill** (accuracy, kill rate, depth, and damage).
`Fuzzy.infer()` fires the complete 729-rule base (3⁶ combinations; AND = min, OR = max)
and defuzzifies Threat, Supply, and Composition outputs.

Exposure dominates the rule scoring, so an *unseen* player keeps Threat low no matter
how strong they are — and when Detection < 15 the spawn director switches to pure
noise-driven spawning (dead silence ⇒ almost nothing spawns; gunfire ⇒ waves scale
with how loud you are).

Enemy AI is perception-based: **see you** (LOS, blocked by walls & fog) → chase;
**hear you** (range scales with Noise) → hunt the sound with positional error;
neither → wander dumbly. The minimap (left panel) tracks you, walls, fog, and every
enemy as a red dot.

Full v1 walkthrough with worked example: `report/supporting-docs/Section3_Fuzzy_Logic_Walkthrough.md`.
Rule-base expansion (11 → 81 → 243 rules): `report/supporting-docs/Inference_Engine_Expansion_Report.md`.

## Quick tuning cheat-sheet

- **Game too easy/hard overall** → setup-screen slider ranges in `js/screens.js` (`sliders` array) or defaults in `js/state.js` (`settings`).
- **Director reacts too slow/fast** → inference interval (`G.fuzzyTimer>=10`) and noise gain/decay in `js/mechanics.js`.
- **Difficulty curve shape** → rule weights `w` and MF breakpoints in `js/fuzzy.js`.
- **Threat→pressure mapping** → formulas in `spawnWave()` and the `cadence` line in `js/mechanics.js`.

## Progression systems (v3)

- **Coins** — earned per kill (grunt 5¢ / runner 8¢ / brute 15¢), shown in the MISSION panel,
  **banked to localStorage on death** so they persist between runs (key `bansProtocolMeta_v1`).
- **Weapons & levelling** — RIFLE (free), SHOTGUN (350¢, 6-pellet spread), BAZOOKA (900¢, AoE blast).
  Buy/upgrade/equip in the **ARMORY** (setup screen); each upgrade is +25% damage, max level 5.
  Switch in-game with **1 / 2 / 3** or the bottom-left weapon pills.
- **Power-ups** — randomized drop **guaranteed every 10 kills** + rare (4%) random drops:
  Shield 10 s · Rapid Fire 8 s · 2× Damage 8 s · Speed 8 s · Freeze 5 s ·
  **Instant Kill** (everything on screen dies, white flash).
  Active effects show as timed pills at the bottom-right.
- **Operative upgrades** (ARMORY, bottom strip) — permanent levels bought with coins:
  Move Speed (+8%/lvl) · Max Health (+25 HP/lvl) · Ammo Stock (+30 reserve/lvl) ·
  Power-Ups (+15% duration/lvl). Applied automatically at every deploy.

## What's new in v4 — "advanced & modern"

- **Procedural audio (`audio.js`)** — every sound is synthesised (no files): per-weapon
  gunshots, hits, kills, explosions, pickups, power-ups, damage, UI clicks. The
  **ambient drone is scored by the fuzzy Threat output** — its loudness and filter
  cutoff rise with the director's tension. Low-HP heartbeat. Toggle with **M**.
- **Second fuzzy output — SUPPLY (`fuzzy.js`)** — the 243-rule base now defuzzifies a
  *second* Mamdani output alongside Threat: how generous pickup drops are. It helps
  the desperate (low health/ammo, swarmed) and starves the comfortable, **decoupled**
  from how hard the horde hits. Shown as a live gauge (MISSION panel) and as a sixth
  membership-function graph (`SUPPLY (OUTPUT)`); it actually scales drop rates in `mechanics.js`.
- **Per-enemy micro-FIS (`MicroFuzzy`)** — each creature runs its own 27-rule fuzzy
  controller (distance · own-health · allies-nearby → **Flee / Flank / Swarm**), so the
  horde shows fuzzy behaviour at the *micro* scale too, not just the global director.
  Turn on the RULES panel (**B**) to see each enemy's state as a coloured dot.
- **Modern visuals** — full-screen **bloom** (`post.js`), additive **dynamic lighting**
  (player aura + muzzle flash + explosion light), **shockwave rings**, **hit-stop** on
  big kills/explosions, and an **Orbitron** display font for the titles.
- **Waves & boss fights** — a fading banner announces every wave (every 15 kills);
  **every 5th wave is a BOSS wave** — a slow, armoured *Juggernaut* (HP scales with
  wave) with escorts, its own bottom-screen health bar, and a guaranteed double
  power-up drop on death.
- **Persistent records** — best wave + best score survive death (localStorage); shown
  on the setup screen (top-left) and the death screen, with a "★ NEW RECORD ★" flash.
- **Map overhaul (v5)** — raised **2.5D neon walls** with contact shadows + threat-tinted
  rims, a layered **tech-grid floor** with glowing nodes, drifting **dust**, animated
  **volumetric fog**, persistent **scorch & blood decals**, and whole-map **threat-reactive
  colour grading** (cyan → amber → red as the fuzzy Threat climbs).
- **Roguelike sectors (v5)** — clearing a boss wave fades out, **reshuffles the entire maze**
  into a new SECTOR (keeping your stats/loadout), and fades back in — endless randomised
  layouts until you die. Sector shown in the HUD.
- **Combat depth (v6, Phase 1)** — **spitter** (ranged) enemy + enemy projectiles · **elite**
  affixes (shielded / volatile / frenzied, coloured auras, double reward) · **boss attack patterns**
  (telegraphed radial burst + charge) · **dodge dash** (Shift, i-frames) · **melee knife** (F / RMB)
  with silent **stealth takedowns** on unaware enemies · **combo/killstreak** score multiplier ·
  **damage-direction indicator** + **boss minimap ping**.
- **Roguelite variety (v6, Phase 2, `js/roguelite.js`)** — after each boss, **pick 1 of 3 perks**
  (12 run modifiers) · random **sector modifiers** (Dense Fog / Runner Pack / Gold Rush / Overclocked /
  Supply Drop) · **deployables**: proximity **mine [E]** + fuzzy auto-**turret [T]** · **exploding barrels**
  + **destructible walls** (bazooka/blasts carve new paths) · an **extraction beacon** bonus objective ·
  **11 achievements** (localStorage, toasts) · a **Daily Seed** toggle (deterministic maze for the day).
- **Fuzzy depth (v6, Phase 3)** — the engine grew to **6 inputs → 3 outputs → 729 rules**: added a
  **Skill** input (adaptive difficulty from accuracy/kill-rate/depth) and a **Composition** output
  (fuzzy-controlled enemy-type mix). New **Fuzzy Analytics** overlay (**C**): live **control-surface plot**
  (Threat over Exposure×Noise), **rule-firing heatmap**, **defuzzification comparison** (centroid /
  bisector / mean-of-maxima / **Sugeno**, with a runtime Mamdani↔Sugeno toggle), a **"why this threat?"
  explainability** line, a **fuzzy weapon advisor**, and a **CSV data-logger export**.
- **UX & polish (v6, Phase 4)** — **settings menu** (master / music / SFX volume, screen-shake &
  ambient-motion toggles; ⚙ on setup + in pause) · **pause menu** with run stats (Resume / Settings /
  Restart / Quit) · first-run **tutorial** overlay · **threat-dynamic music** (fuller as Threat rises) ·
  **player-cast wall shadows** · per-sector **weather** (embers / rain / flicker) · **gib** death effects ·
  **gamepad + touch** controls · offscreen **floor-grid cache** · central **`js/balance.js`** tuning config.

## What's new in v7

- **Research comparison modes** — Fuzzy AI, Static, Linear, and Chaos directors can replay the same seed. Run summaries capture accuracy, time, score, objectives, and average/peak threat.
- **Run archive and resume** — the latest 12 runs are graphed and replayable; active runs autosave locally and can be resumed from setup.
- **Dynamic objectives** — hold an uplink, breach terminals, purge nests, or recover a data core. Mission completion unlocks a sector cache.
- **Themed procedural sectors** — laboratory bays, foundry lanes, cryo crossways, infested tunnels, and blackout grids have different layouts, hazards, ambience, and landmarks.
- **Coordinated specialist AI** — medics, commanders, and stalkers share sightings and use cached flow-field navigation alongside the per-enemy fuzzy controller.
- **Weapon modules and alternate fire** — suppressors, chokes, elemental ammunition, warheads, status effects, and weapon-specific alternate attacks (`X`).
- **Accessibility** — complete key rebinding, aim assist, color-blind-safe threat colors, reduced flashing, HUD scaling, and the existing shake/motion/audio controls.
- **Integrated first-person view** — optional pointer-lock 3D presentation with v7 world markers; simulation logic remains shared with 2D.
- **Automated verification** — `index.html?smoke=1` deploys a deterministic browser smoke test and reports its result through `document.body.dataset`.

## Historical roadmap (completed)

- ~~New fuzzy input for battlefield situation~~ ✔ shipped (Pressure, v2)
- ~~Enemy archetypes~~ ✔ shipped (grunt / runner / brute, v2)
- ~~Weapons, levelling, coins, power-ups~~ ✔ shipped (v3)
- ~~Second fuzzy output: pickup drop rate~~ ✔ shipped (Supply, v4)
- ~~Sound (WebAudio), screen-space lighting~~ ✔ shipped (v4)
- ~~Boss waves; local-storage high scores~~ ✔ shipped (v4.1)
- ~~Ranged enemy (spitter); Mamdani vs. Sugeno defuzzification toggle~~ ✔ shipped (v6)

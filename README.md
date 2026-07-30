BAN's Protocol — Adaptive Horde Survival

A MISO (Multiple-Input Single-Output) fuzzy-logic-driven survival shooter. The default presentation is HTML5 Canvas + JS, with an optional integrated Three.js first-person view. A 81-rule Mamdani fuzzy controller reads the player's live state (Health, Ammo, Noise, Pressure) and continuously adjusts enemy aggression, horde size, and spawn behaviour across a scrolling maze world with stealth (vision/noise/fog) mechanics. Q cycles weapons, Tab toggles the Logic Dashboard showing the full fuzzy pipeline.

The first-person renderer can be enabled in Settings. It shares the same world, combat, objectives, enemies, and fuzzy director as the top-down presentation.
Play online (clickable links)

    ▶ Play the game: https://fahimazh07.github.io/BANProtocol/

    📊 Read the report: https://fahimazh07.github.io/BANProtocol/report/dossier.html

(The hosted game is a fully self-contained build with procedural SFX and the Molchat Doma soundtrack. Click once to enable audio. The full version runs from docs/index.html locally, or deploy the docs/ folder to GitHub Pages / Netlify.)
Folder layout
text

Project ISP568/
├── README.md            ← this file
├── docs/                ← the playable game (deployed to GitHub Pages)
│   ├── index.html
│   ├── css/style.css
│   ├── audio/ … (bgm1–6.mp3 — the Molchat Doma soundtrack)
│   ├── js/
│   │   ├── lib/three.min.js (optional 3D renderer)
│   │   ├── fuzzy.js       ← MISO engine (4 inputs → 1 output · 81 rules)
│   │   ├── mechanics.js   ← game loop & director integration
│   │   ├── hud.js         ← HUD + Logic Dashboard
│   │   ├── ... (all other JS files)
│   └── report/            ← the ISP568 assessment report
│       └── dossier.html   ← interactive fuzzy logic report
└── report/              ← source report files (build scripts, supporting docs)

Run it
Local Development

Just open docs/index.html in a browser (double-click works — plain script tags, no server needed).
Or in VS Code: right-click docs/index.html → Open with Live Server for auto-reload while editing.
Deploy to GitHub Pages

    Rename your game/ folder to docs/.

    Push to GitHub.

    In repository Settings → Pages, set source to main branch, /docs folder.

    Your game is live at https://<username>.github.io/<repo>/.

Rebuild the Report

The interactive report is at docs/report/dossier.html. It loads the live fuzzy.js engine and lets you drive the inference with sliders.

To regenerate the static report:
bash

cd report && node report_build.js

Then open Progress_Report_1_UPDATED.html and Print → Save as PDF.
Verify and Simulate the Director

From the root folder, run:
bash

node tests/fuzzy.test.js
node tests/simulate_balance.js 20

The simulator uses identical seeds for Fuzzy, Static, Linear, and Chaos synthetic state trajectories.
Project structure

All paths below are inside docs/.
File	What's inside	Modify this to…
index.html	Canvas + script load order + display font + tap-to-start overlay	add new script files (order matters)
css/style.css	Page chrome + mobile touch support + responsive styling	change page background, hint bar, mobile layout
js/config.js	Canvas, ctx, W/H, responsive resize	change resolution or scaling
js/audio.js	Music + WebAudio: shuffled BGM playlist from audio/ (auto-advancing, N skips), beat-reactive lighting, procedurally-synthesised SFX, Threat drone + low-HP heartbeat, mute (M)	swap tracks/BPM in PLAYLIST, tune sounds
js/post.js	Full-screen bloom post-process	bloom strength / buffer size
js/world.js	Maze generation (39×23 tiles → 3900×2300 px world), wall collision, line-of-sight, fog zones, minimap prerender	maze size/density, fog count
js/fuzzy.js	The fuzzy engine – MISO system: 4 inputs (Health, Ammo, Noise, Pressure) → 1 output (Threat) · 81 rules (3⁴). Mamdani inference (AND=min, OR=max, centroid defuzzification) + MicroFuzzy (27-rule per-enemy controller)	tune MF breakpoints, rule heuristic, band thresholds
js/state.js	G global state object + reset()	change starting values, add new run state
js/weapons.js	Weapons (rifle/shotgun/bazooka), levelling, power-ups, coin meta (localStorage)	weapon stats/costs, power-up kinds/durations
js/mechanics.js	update() loop, shooting, reload, spawnWave() director – computes the 4 crisp inputs and calls Fuzzy.infer()	change weapon feel, threat→gameplay formulas, add enemy types
js/input.js	Keyboard + mouse + gamepad + touch handlers	add keybinds (Tab toggles Logic Dashboard)
js/render.js	World rendering (camera, walls, fog), additive lights + shockwave rings, pseudo-3D characters, UI palette	change visuals, add new entity rendering
js/render3d.js	Integrated optional first-person Three.js renderer	change the 3D presentation
js/hud.js	Threat gauge, MF graphs, active-rules panel, vitals, Logic Dashboard	change HUD layout, dashboard content
js/screens.js	Setup screen (sliders + deploy), armory, pause/death, click routing	add settings sliders, menus, buttons
js/analytics.js	Fuzzy analytics overlay (C): control surface, rule heatmap, defuzz comparison, CSV export	change analytics visualisation
js/advanced.js	v7 experiments: run archive, resume, objectives, themes, weapon modules, squad AI	extend advanced systems
js/roguelite.js	Perks, sector modifiers, deployables, barrels, extraction beacon, achievements	add new perks or sector modifiers
js/main.js	requestAnimationFrame loop – draws drawLogicDashboard()	add new game states to the draw switch
How the fuzzy loop works (short version)

Every 10 frames, mechanics.js samples 4 crisp inputs (0–100):

    Health – how hurt you are.

    Ammo – magazine + reserve fraction.

    Noise – sound made by shooting / sprinting (decays −0.35/frame).

    Pressure – how many enemies are already engaging you (based on distance and count).

Fuzzy.infer() fires the complete 81-rule base (3⁴ combinations; AND = min, OR = max) and defuzzifies a single Threat output using centroid defuzzification.

The Threat value directly controls:

    Spawn cadence – higher Threat = faster spawns.

    Horde size – higher Threat = more enemies per wave.

    Drop generosity – higher Threat = more health/ammo drops (helps the desperate).

    Enemy composition – higher Threat = more brutes and spitters.

Enemy AI is perception-based:

    See you (line-of-sight, blocked by walls & fog) → chase.

    Hear you (range scales with Noise) → hunt the sound with positional error.

    Neither → wander dumbly.

The Logic Dashboard (toggle with Tab) shows the full fuzzy pipeline in real-time:

    Fuzzification – crisp inputs → membership degrees (Low/Medium/High).

    Active Rules – top 5 firing rules with antecedents and firing strengths.

    Aggregation – clipped output sets (Low/Medium/High).

    Defuzzification – final crisp Threat value with linguistic label.

Full walkthrough with worked example: report/supporting-docs/Section3_Fuzzy_Logic_Walkthrough.md.
Rule-base expansion: report/supporting-docs/Inference_Engine_Expansion_Report.md.
Quick tuning cheat-sheet

    Game too easy/hard overall → setup-screen slider ranges in js/screens.js (sliders array) or defaults in js/state.js (settings).

    Director reacts too slow/fast → inference interval (G.fuzzyTimer >= 10) and noise gain/decay in js/mechanics.js.

    Difficulty curve shape → rule heuristic score = (2-H) + (2-A) + N + P and MF breakpoints in js/fuzzy.js.

    Threat→pressure mapping → formulas in spawnWave() and the cadence line in js/mechanics.js.

Progression systems

    Coins — earned per kill (grunt 5¢ / runner 8¢ / brute 15¢), shown in the MISSION panel, banked to localStorage on death so they persist between runs (key bansProtocolMeta_v1).

    Weapons & levelling — RIFLE (free), SHOTGUN (350¢, 6-pellet spread), BAZOOKA (900¢, AoE blast). Buy/upgrade/equip in the ARMORY (setup screen); each upgrade is +25% damage, max level 5. Switch in-game with 1 / 2 / 3 or the bottom-left weapon pills.

    Power-ups — randomized drop guaranteed every 10 kills + rare (4%) random drops: Shield 10 s · Rapid Fire 8 s · 2× Damage 8 s · Speed 8 s · Freeze 5 s · Instant Kill (everything on screen dies, white flash). Active effects show as timed pills at the bottom-right.

    Operative upgrades (ARMORY, bottom strip) — permanent levels bought with coins: Move Speed (+8%/lvl) · Max Health (+25 HP/lvl) · Ammo Stock (+30 reserve/lvl) · Power-Ups (+15% duration/lvl). Applied automatically at every deploy.

What's new
Core MISO System (Final Assessment)

    4 inputs → 1 output → 81 rules (simplified from 6→3→729).

    Clear rule heuristic: score = (2-H) + (2-A) + N + P → mapped to Low (≤3), Medium (4-5), High (≥6).

    Centroid defuzzification with a clean, easy-to-understand pipeline.

    Live Logic Dashboard (toggle with Tab) showing Fuzzification → Rules → Aggregation → Defuzzification.

    Interactive report (report/dossier.html) where you can drive the engine with sliders.

Combat & Roguelite

    Spitter (ranged) enemy + enemy projectiles.

    Elite affixes (shielded / volatile / frenzied, coloured auras, double reward).

    Boss attack patterns (telegraphed radial burst + charge).

    Dodge dash (Shift, i-frames) · melee knife (F / RMB) with silent stealth takedowns.

    Combo/killstreak score multiplier · damage-direction indicator + boss minimap ping.

    Perks (pick 1 of 3 after each boss) · random sector modifiers · deployable mine [E] + turret [T] · exploding barrels + destructible walls · extraction beacon bonus objective · 11 achievements · Daily Seed toggle.

Visual & Audio

    Full-screen bloom, additive dynamic lighting, shockwave rings, hit-stop.

    Raised 2.5D neon walls with threat-tinted rims · tech-grid floor · drifting dust · volumetric fog · scorch & blood decals · threat-reactive colour grading.

    Procedural audio (every sound is synthesised) · ambient drone scored by Threat · low-HP heartbeat · threat-dynamic music.

UX & Accessibility

    Settings menu (volume, screen-shake, ambient motion, colour-blind mode, reduced flashing, aim assist, HUD scaling).

    Pause menu with run stats (Resume / Settings / Restart / Quit).

    First-run tutorial overlay · per-sector weather · gib death effects · gamepad + touch controls.

    Run archive and resume – latest 12 runs graphed and replayable.

Historical roadmap

    ~~11-rule hand-written base~~ ✔ shipped (v1)

    ~~New fuzzy input: Pressure~~ ✔ shipped (v2)

    ~~Enemy archetypes (grunt / runner / brute)~~ ✔ shipped (v2)

    ~~243 rules (5 inputs → 2 outputs)~~ ✔ shipped (v3)

    ~~Weapons, levelling, coins, power-ups~~ ✔ shipped (v3)

    ~~Second fuzzy output: Supply~~ ✔ shipped (v4)

    ~~Sound (WebAudio), screen-space lighting~~ ✔ shipped (v4)

    ~~Boss waves; local-storage high scores~~ ✔ shipped (v4.1)

    ~~Ranged enemy (spitter)~~ ✔ shipped (v6)

    ~~729 rules (6 inputs → 3 outputs)~~ ✔ shipped (v6)

    ~~Mamdani vs. Sugeno defuzzification toggle~~ ✔ shipped (v6)

    MISO simplification (4 inputs → 1 output → 81 rules) ✔ shipped (Final)

    Logic Dashboard (Tab) ✔ shipped (Final)

    Interactive report (dossier.html) ✔ shipped (Final)

    GitHub Pages deployment ✔ shipped (Final)

Credits

    Molchat Doma – soundtrack (6 tracks, used under fair use for academic demonstration).

    Three.js – optional 3D renderer (loaded from CDN or local fallback).

    ISP568 Fuzzy Logic Systems – final assessment project.
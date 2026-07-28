# Progress Report 1 (Updated)

## BAN's Protocol: Adaptive Horde Survival
*A fuzzy-logic-driven survival shooter (HTML5 Canvas + JavaScript)*
**Course:** ISP568 — Fuzzy Logic Systems · **Coursework Weight:** 15%

> **What changed since the first submission.** The original report described a single
> `bans-protocol.html` file with **3 fuzzy inputs** (Health, Ammo, Noise) and an **11-rule**
> hand-written base, rendered as a flat top-down arena. The prototype has since been rebuilt into a
> **modular codebase** (`index.html` + a `js/` module set) and the fuzzy controller has grown to
> **5 inputs** (Health, Ammo, Noise, **Pressure**, **Exposure**) driving a **complete 243-rule
> Mamdani grid** (3⁵ combinations). Around it we added a **procedurally generated maze world** with
> **line-of-sight, fog hiding zones and a stealth/detection mechanic**, **perception-based enemy AI**
> (see / hear / wander), and a full **progression layer** (coins, three weapons with levelling,
> power-ups, permanent operative upgrades, persistent save). This report supersedes the previous one.
>
> **v4 update.** The controller now defuzzifies a **second output, Supply** (drop generosity) from the same
> five inputs — a MISO system became **MIMO** — and a separate **per-enemy 27-rule micro-FIS** (Flee/Hold/Swarm)
> was added. The fuzzification section is now a fully **drawn, step-by-step worked example** (membership graphs →
> clipping → aggregation → centroid). *The rendered SVG graphs and the dual-output Appendix B live in the
> companion file `Progress_Report_1_UPDATED.html` / `.pdf` — open the HTML and Print → Save as PDF to regenerate.*

---

## 1. App / Game Prototype Generation

### 1.1 Concept & Idea
**BAN's Protocol: Adaptive Horde Survival** is a top-down survival shooter set inside a randomly
generated maze. The enemy horde is not driven by random spawns or a fixed difficulty curve — a
**fuzzy-logic "AI director"** continuously reads the player's live state and decides how aggressive
the horde should be and how many enemies to send.

The defining idea added since the last report is **stealth-aware difficulty**: the director now cares
not only about *how strong* the player is, but about **whether the horde actually knows where the
player is**. A player who hides in fog and stays quiet is left alone almost regardless of how
well-armed they are; a player who is seen, loud and loaded gets the full swarm. Difficulty has become
a resource the player manages through *positioning and noise discipline*, not just through health and
ammo.

### 1.2 Problem Statement
Conventional games scale difficulty with crisp thresholds or fixed timers (e.g. "after 60 seconds,
spawn 10 enemies"). These rules are brittle: they snap between levels, ignore the player's actual
situation, and cause either boredom (too easy) or a frustrating death spiral (piling enemies onto an
already-weak player). The problem we address is **dynamic difficulty balancing under multiple,
overlapping, vague conditions**: how can a game smoothly and believably adapt its challenge to the
player's moment-to-moment condition — health, firepower, noise, how swarmed they already are, and
how exposed they are — when every one of those signals is naturally fuzzy ("fairly low health",
"kind of loud", "mostly hidden")?

### 1.3 Target Users
- **Casual and mid-core action / survival players** who want a challenge that always feels fair.
- **Game designers and students** studying adaptive / dynamic-difficulty AI directors.
- **Educators and learners** using the live on-screen fuzzy visualisation as an interactive
  demonstration of Mamdani fuzzy inference.

### 1.4 Prototype — UI Layout & Interaction Flow
The prototype is a **complete, playable build** in pure HTML5 Canvas + JavaScript. Every control and
readout is drawn on the canvas (no HTML form widgets). The interaction flow is:

- **Mission Setup screen:** canvas-drawn draggable sliders — **Game Pace, Horde Density,
  Survivability** — a **God-mode toggle** for demos, and a **DEPLOY** button.
- **ARMORY (shop):** buy/upgrade/equip the three weapons and four permanent operative upgrades using
  coins earned in previous runs.
- **Gameplay:** **WASD/Arrows** move, mouse aims, **Click/Space** shoots, **R** reloads,
  **Q / 1 / 2 / 3** switch weapons, **G** toggles god mode, **B / V** toggle HUD panels, **Esc** pauses.
- **Live HUD:** operative vitals (Health, Ammo, Noise), a circular **Threat / Aggression gauge**,
  mission stats and coins, a **minimap** (walls, fog, player and every enemy as a red dot), **five
  live membership-function graphs**, and an **Active Fuzzy Rules** panel.
- **Game Over (OVERRUN) screen** with score/kills/wave and a **REDEPLOY** button; coins are banked to
  local storage on death so they persist between runs.

### 1.5 Core Functional Components
All core components are implemented and working (not placeholders):

- **Fuzzy inference engine** (`js/fuzzy.js`) — triangular/trapezoidal membership functions, a
  **complete 243-rule** Mamdani base (AND = min, aggregation = max), centroid defuzzification. The
  module is pure and game-agnostic: it takes `{health, ammo, noise, pressure, exposure}` in 0–100 and
  returns a crisp Threat plus all inference internals.
- **Procedural maze world** (`js/world.js`) — a 39×23-tile maze (3900×2300 px) carved by recursive
  backtracking, then *braided* (loops opened) with a few open plazas, regenerated every deploy;
  wall collision, **line-of-sight sampling**, **fog hiding zones**, and a prerendered minimap.
- **Real-time game loop** (`js/mechanics.js`) — player movement with wall-sliding, aiming, shooting,
  reloading, explosions, pickups, and the situation-aware spawn director.
- **Perception-based enemy AI** — enemies **chase** only with line-of-sight (blocked by walls and
  fog), **hunt** toward noise with positional error that shrinks as the player gets louder, and
  otherwise **wander**; three visually distinct archetypes (grunt / runner / brute).
- **Live fuzzy visualisation** (`js/hud.js`) — threat gauge with needle, five MF graphs with a moving
  marker per input, and an active-rules panel listing which rules fire and at what strength.
- **Progression systems** (`js/weapons.js`) — coins, three weapons with +25%/level upgrades,
  six power-ups, four permanent operative upgrades, all persisted to `localStorage`.

### 1.6 Rationale — Why Fuzzy Logic Is Appropriate
The director's decision depends on human, imprecise concepts: "a bit low on health", "fairly loud",
"almost out of ammo", "kind of swarmed", "barely spotted". These categories overlap and have no sharp
boundary — exactly the uncertainty fuzzy logic is designed for. Concretely:

- **Smooth blending** — overlapping membership functions interpolate between rules, so difficulty
  ramps and eases gradually instead of snapping between levels.
- **Natural rule authoring** — rules read in plain language ("IF health is Low AND ammo is Depleted
  THEN threat is Passive").
- **Multi-input fusion** — *five* uncertain inputs are combined into one coherent decision. With five
  variables, hand-coding every combination is infeasible; fuzzy inference fuses them cleanly (and we
  generate the full 243-rule grid from one transparent scoring policy — see §2.4).
- **Believable behaviour** — the resulting difficulty curve feels reactive and intentional rather than
  scripted, and the stealth dimension (Exposure) gives the player real agency over the challenge.

---

## 2. Identification of Fuzzy Inputs

### 2.1 Proposed Fuzzy Input Variables
Five crisp game-state values are normalised to a 0–100 universe of discourse and fuzzified. A single
fuzzy output drives the horde.

| Variable | Type | Universe (0–100) | Linguistic terms | Justification |
|---|---|---|---|---|
| **Player Health** | Input | % of max HP | Low, Medium, High | How close the player is to death; the baseline signal of how much pressure is fair. |
| **Ammo Count** | Input | % of total capacity | Depleted, Adequate, Surplus | The player's ability to fight back; low ammo should not be punished with a swarm. |
| **Noise Level** | Input | accumulates on firing/moving, decays over time | Quiet, Moderate, Loud | How much attention the player draws; rewards stealthy play and explains *why* the horde grows. |
| **Pressure** *(added v2)* | Input | nearest-enemy distance + crowd count | Safe, Engaged, Swarmed | How swarmed the player *already* is — a relief valve so the director does not pile onto a buried player. |
| **Exposure** *(added v3)* | Input | detection meter (line-of-sight, fog, noise) | Hidden, Suspicious, Spotted | Whether the horde actually *knows where the player is*; the dominant input — an unseen player is left alone. |
| **Threat / Aggression** | **Output 1** | enemy intensity | Passive, Tactical, Overwhelming | Defuzzified value that sets horde size, spawn cadence, spawn position, enemy speed, damage and colour. |
| **Supply / Director Aid** *(added v4)* | **Output 2** | drop generosity | Scarce, Balanced, Generous | Defuzzified value that scales how often kills drop health / ammo / power-ups — generous to the desperate, stingy to the comfortable, decoupled from Threat. |

**How the two new crisp inputs are computed** (in `js/mechanics.js`, every 10 frames):

```js
// Pressure: closer + more crowded ⇒ higher
const press = G.enemies.length===0 ? 0
            : Math.max(0, Math.min(100, (100 - nd/5) + near*2 ));   // nd = nearest-enemy distance

// Exposure (G.detect): line-of-sight ramps it up, fog drains it, loud noise sets a floor
if(seen)        G.detect = Math.min(100, G.detect + 9);             // any enemy with LOS
else            G.detect = Math.max(0, G.detect - (inFog ? 2.5 : 0.5));   // fog hides ~5× faster
if(G.noise>45)  G.detect = Math.max(G.detect, Math.min(65, G.noise*0.65)); // "suspicious" floor
```

### 2.2 Crisp → Linguistic Mapping (Fuzzy Graphs)
Each input is mapped from a crisp number to degrees of membership in its terms. In the running
prototype these graphs are drawn live on the canvas, one per input, with a moving marker crossing each
curve. The exact shapes implemented in `js/fuzzy.js` are:

| Variable | Term | MF shape | Defining points (0–100) |
|---|---|---|---|
| Player Health | Low | Left shoulder | 1 below 15, ramps to 0 at 40 |
| Player Health | Medium | Triangle | 0 at 25, peak 50, 0 at 75 |
| Player Health | High | Right shoulder | 0 at 60, ramps to 1 at 85 |
| Ammo Count | Depleted | Left shoulder | 1 below 10, ramps to 0 at 35 |
| Ammo Count | Adequate | Triangle | 0 at 25, peak 55, 0 at 80 |
| Ammo Count | Surplus | Right shoulder | 0 at 65, ramps to 1 at 90 |
| Noise Level | Quiet | Left shoulder | 1 below 15, ramps to 0 at 40 |
| Noise Level | Moderate | Triangle | 0 at 30, peak 55, 0 at 80 |
| Noise Level | Loud | Right shoulder | 0 at 65, ramps to 1 at 90 |
| **Pressure** | Safe | Left shoulder | 1 below 20, ramps to 0 at 45 |
| **Pressure** | Engaged | Triangle | 0 at 35, peak 60, 0 at 85 |
| **Pressure** | Swarmed | Right shoulder | 0 at 70, ramps to 1 at 90 |
| **Exposure** | Hidden | Left shoulder | 1 below 15, ramps to 0 at 40 |
| **Exposure** | Suspicious | Triangle | 0 at 30, peak 55, 0 at 80 |
| **Exposure** | Spotted | Right shoulder | 0 at 65, ramps to 1 at 90 |
| Threat *(output 1)* | Passive | Triangle | 0 at 0, peak 18, 0 at 40 |
| Threat *(output 1)* | Tactical | Triangle | 0 at 30, peak 50, 0 at 70 |
| Threat *(output 1)* | Overwhelming | Right shoulder | 0 at 60, ramps to 1 at 90 |
| **Supply** *(output 2)* | Scarce | Triangle | 0 at 0, peak 18, 0 at 40 |
| **Supply** *(output 2)* | Balanced | Triangle | 0 at 30, peak 50, 0 at 70 |
| **Supply** *(output 2)* | Generous | Right shoulder | 0 at 60, ramps to 1 at 90 |

### 2.3 Membership Function Ideas (not yet finalised)
- Triangular and trapezoidal functions are kept for speed and easy real-time plotting; Gaussian curves
  may be trialled later for smoother transitions.
- The overlap points (e.g. Health Low/Medium crossing near 30–40, Exposure Hidden/Suspicious near
  30–40) are tuning targets to be balanced through playtesting.
- Noise gain-per-shot (12–32 depending on weapon), the −0.35/frame decay, the Exposure ramp/drain
  rates and the noise "suspicious" floor are provisional and will be calibrated so each input
  meaningfully influences the output.

### 2.4 Expected Fuzzy Rules
The inference is a **Mamdani** model with **AND = minimum**, **aggregation = maximum**, defuzzified by
**centroid**. Rather than hand-write rules (which invites inconsistency at 243 entries), the engine
**generates the complete 3⁵ = 243-rule grid** from one transparent scoring policy, so *every reachable
game situation is explicitly handled*:

```
score = 0.55·(health + ammo) + 0.8·noise − 0.6·pressure + 1.7·exposure     (term levels 0/1/2)

consequent:  score ≤ 2.3 → Passive   ·   score ≤ 4.6 → Tactical   ·   else → Overwhelming
weight:      w = 0.6 (at a band boundary) … 1.0 (deep inside a band)
```

- **Capability raises threat** but is damped (coeff 0.55) — strong, loaded players get pushed.
- **Noise raises threat** (coeff 0.8) — being loud is punished.
- **Pressure lowers threat** (coeff −0.6) — already-swarmed players get relief, not a pile-on.
- **Exposure dominates** (coeff 1.7) — a *Hidden & Quiet* player caps at score 2.2 → **always
  Passive**, no matter how strong; a *Spotted, healthy, loaded, loud* player reaches 7.2 → deep
  *Overwhelming*.

**Rule-base composition (machine-enumerated):** 90 Passive · 104 Tactical · 49 Overwhelming = **243**.
The distribution is deliberately mercy-biased — fewer than a fifth of situations unleash the full
horde, reserved for players who are healthy, loaded, loud, **and** seen.

**Required draft rules + representative sample** (the brief asks for ≥2; all 243 are implemented):

| # | Antecedent (IF) | Score | Consequent (THEN Threat) | Design intent |
|---|---|---|---|---|
| 1 | Health Low **AND** Ammo Depleted (∧ Quiet ∧ Safe ∧ Hidden) | 0.0 | **Passive** | Mercy: a wounded, defenceless, unseen player gets breathing room. |
| 2 | Health High **AND** Ammo Surplus ∧ Loud ∧ Safe ∧ **Spotted** | 7.2 | **Overwhelming** | Challenge: a strong, loud, fully-armed player who is *seen* gets the hardest fight. |
| 3 | Health High ∧ Ammo Surplus ∧ Quiet ∧ Safe ∧ **Hidden** | 2.2 | **Passive** | Stealth override: even a strong player, if hidden and quiet, is left alone. |
| 4 | Health Medium ∧ Ammo Adequate ∧ Moderate ∧ Engaged ∧ Suspicious | ~3.6 | **Tactical** | Balanced, partially-spotted state gets standard, steady pressure. |
| 5 | Health High ∧ Ammo Surplus ∧ Quiet ∧ **Swarmed** ∧ Spotted | ~3.9 | **Tactical** | A strong player already buried in enemies gets *relief*, not a pile-on. |

Rules 1 and 2 satisfy the "at least 2 draft rules" requirement; the full set of 243 is implemented and
visualised live. **The complete, exhaustive list of all 243 rules — exactly as generated by the engine,
in engine order, with each rule's situation score, consequent and firing weight — is given in
Appendix B.**

### 2.5 Latest Rule Additions (v4) — Second Output & Per-Enemy Micro-FIS

**(a) Second output — SUPPLY (drop generosity).** Every one of the 243 rules now carries a *second* consequent
beside its Threat band, so one inference pass defuzzifies two outputs. The Supply consequent comes from a second
transparent policy (term levels 0/1/2):

```
supplyScore = (2 − health) + (2 − ammo) + 0.6·pressure       (desperation index)
consequent:  ≤ 1.6 → Scarce   ·   ≤ 3.0 → Balanced   ·   else → Generous
```

Low health/ammo and being swarmed raise Supply; it ignores Noise and Exposure, so it is **decoupled from Threat**
(a hidden, hurt player gets left alone yet still showered with pickups). **Supply composition: 63 Scarce · 90 Balanced
· 90 Generous = 243.** In-game it scales the kill-drop probability (`0.20 + 0.30·supply`), shown as the SUPPLY bar and
the 6th membership graph.

**(b) Per-enemy micro-FIS.** Each enemy runs its own tiny **3-input, 27-rule** Mamdani controller (Distance ·
Own-Health · Allies-Nearby → **Flee / Hold / Swarm**), generated from `aggression = ownHealth + alliesNearby +
0.4·closeness` and defuzzified by centroid — fuzzy logic at the *micro* scale (a hurt, isolated creature retreats; a
healthy creature in a pack swarms). **Composition: 7 Flee · 13 Hold · 7 Swarm = 27.**

*(The fully drawn, step-by-step worked example with membership graphs, clipping, aggregation and the dual-output
centroid is in the companion `Progress_Report_1_UPDATED.html` / `.pdf`.)*

---

## 3. Project Explanation & Fuzzy Logic Functionality

The system is a **modular codebase** (no single mega-file). `index.html` loads the modules in
dependency order; the fuzzy engine lives in `js/fuzzy.js` and is queried by the game loop ~6 times/sec.

### 3.1 What We Built — System Overview
Subsystems communicate through a shared game-state object `G`:

- **Fuzzy engine** (`Fuzzy`, `js/fuzzy.js`) — pure functions for membership, inference, defuzzification.
- **World** (`js/world.js`) — maze generation, wall collision, line-of-sight, fog, minimap.
- **Game state** (`G`, `js/state.js`) — player, enemies, bullets, particles, settings, latest fuzzy result.
- **Update loop** (`js/mechanics.js`) — input, movement, collisions, enemy AI, samples the player's
  state and asks the fuzzy engine for a Threat value.
- **Director / spawner** (`js/mechanics.js`) — turns Threat into spawning decisions.
- **Renderer + HUD** (`js/render.js`, `js/hud.js`) — world plus the fuzzy visualisations.
- **Progression** (`js/weapons.js`) — coins, weapons, power-ups, upgrades, persistence.

The key idea is a **closed feedback loop**: the player's actions change Health / Ammo / Noise /
Pressure / Exposure → the fuzzy engine converts that into a Threat level → the director spawns enemies
accordingly → fighting and hiding changes the player's state again → repeat. Fuzzy logic sits at the
centre as the decision-maker.

### 3.2 The Fuzzy Pipeline (Step by Step)
Every inference pass follows the classic Mamdani sequence. Each step corresponds to real code.

**Step 1 — Sampling & Normalisation.** Every 10 frames the loop reads five raw values and normalises
each to 0–100:
- Health = HP / maxHP × 100
- Ammo = (magazine + reserve) / total capacity × 100
- Noise = a running meter (+12…32 per shot by weapon, +0.5/frame while moving, −0.35/frame decay)
- Pressure = `(100 − nearestDist/5) + nearbyCount·2`, clamped 0–100
- Exposure = the detection meter `G.detect` (LOS up, fog down, loud-noise floor)

**Step 2 — Fuzzification.** Each crisp value passes through its term functions (`tri`, `trapL`,
`trapR`) to give a membership 0–1. Overlap lets the system blend between rules instead of snapping.

**Step 3 — Rule evaluation.** Each of the 243 rules combines its five antecedents with AND = min, then
multiplies by the designer weight `w`:
`strength = min(μ₁, μ₂, μ₃, μ₄, μ₅) · w`. Firing rules (strength > 0.001) are recorded for the
on-screen panel.

**Step 4 — Aggregation.** Rules pointing at the same output term are combined with OR = max, giving one
aggregated strength per output set (Passive / Tactical / Overwhelming).

**Step 5 — Defuzzification.** Centroid over the clipped, unioned output sets, sampled in steps of 2:
```
for x = 0..100 step 2:
    μ = max over terms of min(agg[term], term_MF(x))
    num += x·μ ; den += μ
threat = num / den
```
Centroid gives smooth, continuous output — small state changes move Threat gently, exactly what a
dynamic-difficulty director needs.

### 3.3 From Threat Number to Gameplay
The crisp Threat (and its band) drives the director:

| Parameter | How Threat affects it |
|---|---|
| **Horde size per wave** | `count = round((0.5 + aggr·4.5) · Density)` — higher Threat sends more enemies (enemy cap 40). |
| **Spawn cadence** | `spawnTimer = (240 − Threat·1.5) / Pace` — a strong, seen player faces wave after wave. |
| **Spawn position** | ring around the player at open maze tiles, off-screen; tighter ring at high aggression. |
| **Enemy speed & damage** | both scale with aggression; archetype mix shifts (runners when Loud, brutes when pushing). |
| **Enemy colour** | blue (Passive) → orange (Tactical) → red (Overwhelming) for instant visual feedback. |
| **Warm-up grace** | for the first 600 frames (~10 s) the effective Threat is capped at 40 so runs start readable. |

**Stealth override:** when detection < 15 the director **ignores Threat entirely** and spawns purely
from Noise — dead silence yields at most a lone wanderer; gunfire scales the swarm with how loud you are.

### 3.4 The Stealth Loop — Closing It with Exposure
Noise and Exposure together give the player agency over difficulty. Firing is loud and draws line-of-
sight, pushing Exposure toward *Spotted*, which fires high-threat rules. Slipping into **fog** drains
detection ~5× faster (hiding resets aggression in about a second) and holding fire lets Noise decay to
*Quiet*, dropping Threat. Difficulty becomes a strategic resource — cleanly expressible only because
Noise and Exposure are fuzzy quantities, not hard on/off flags.

### 3.5 Live Visualisation of the Fuzzy System
So the inference is not a black box, the game renders it in real time: the **Threat gauge** (needle +
band arc), **five MF graphs** (one per input, moving marker + dominant-term highlight), and the
**Active Rules panel** (which rules fire and at what strength, as percentage bars) — an X-ray of the
inference each instant. A **minimap** shows walls, fog, the player and enemies so the stealth state is
legible too.

### 3.6 Worked Example
The player is healthy and fully loaded but **hiding in fog and not shooting**: Health ≈ 90 (High ≈ 1),
Ammo ≈ 95 (Surplus ≈ 1), Noise ≈ 5 (Quiet ≈ 1), Pressure ≈ 0 (Safe ≈ 1), Exposure ≈ 5 (Hidden ≈ 1).
The dominant rule is *High ∧ Surplus ∧ Quiet ∧ Safe ∧ Hidden → Passive* (score 2.2). Despite the
player being objectively strong, **Exposure's dominance holds Threat in the Passive band**, so the
director sends almost nothing. The moment the player breaks cover and opens fire, Noise climbs and
line-of-sight ramps Exposure toward *Spotted*; high-threat rules begin to fire and Threat rises
smoothly toward Overwhelming — the swarm converges.

**Dual-output trace (the HTML/PDF shows this drawn step-by-step).** Taking the mid-game state
*Health 50, Ammo 55, Noise 55, Pressure 15, Exposure 70*: only Exposure straddles two terms
(Suspicious 0.40, Spotted 0.20), so exactly **two rules fire**. For **Threat** they clip *Tactical @ 0.40*
and *Overwhelming @ 0.176*; aggregating (max) and taking the centroid gives **Threat ≈ 61**. For **Supply**
both rules carry *Balanced*, clipping at max(0.40, 0.176) = 0.40 → centroid **Supply ≈ 50** ("normal drops").
A *desperate* player (HP 15, ammo 10, swarmed) would instead clip *Generous* → Supply ≈ 84; a *comfortable*
one clips *Scarce* ≈ 19 — the two outputs move independently.

---

## 4. Requirements Compliance Checklist

| Requirement | Where addressed | Status |
|---|---|---|
| Basic UI layout / interaction flow | §1.4 — setup, armory, HUD, minimap, gameplay, game-over | Met |
| Core functional components | §1.5 and §3.1 | Met |
| Clear problem statement | §1.2 — stealth-aware dynamic difficulty balancing | Met |
| Target users | §1.3 | Met |
| Rationale for fuzzy logic | §1.6 and §3 | Met |
| Proposed fuzzy input variables | §2.1 — Health, Ammo, Noise, **Pressure, Exposure** (+ Threat) | **Exceeded** (5 inputs) |
| Crisp → linguistic mapping (fuzzy graph) | §2.2 + five live on-canvas graphs | Met |
| Membership function ideas | §2.3 and §3.2 | Met |
| At least 2 draft fuzzy rules | §2.4 — **243 rules** implemented (2 highlighted) | **Exceeded** |

---

## 5. Self-Assessment vs Evaluation Criteria (15%)

| Criterion | Weight | How this submission addresses it |
|---|---|---|
| Clarity & feasibility of idea | 5% | A focused, well-scoped concept with a clear problem, named users and an already-running modular build — demonstrably feasible. |
| Prototype completeness (UI + functionality) | 5% | A fully playable game with a working 243-rule fuzzy engine, procedural maze + stealth, perception AI, progression, and live visualisation — well beyond a UI mock-up. |
| Fuzzy input identification & justification | 5% | **Five** justified inputs with universes, membership shapes, mapping graphs, a complete **243-rule** generated base, and a full pipeline explanation (§3). |

---

## 6. How to Run the Prototype
- Open **`index.html`** in any modern browser (Chrome, Edge, Firefox) — plain script tags, no server
  needed (double-click works; or right-click → *Open with Live Server* in VS Code).
- On the **Mission Setup** screen, set the sliders (and optionally God mode), visit the **ARMORY** to
  spend coins, then click **DEPLOY**.
- Play with **WASD + mouse**; **Q / 1 / 2 / 3** switch weapons, **R** reloads, **G** toggles god mode,
  **B / V** toggle the rules/graphs panels, **Esc** pauses.
- Watch the **Threat gauge**, the **five membership-function graphs**, the **Active Fuzzy Rules** panel
  and the **minimap** respond live to your health, ammo, noise, how swarmed you are and how exposed you
  are. Hide in fog and stop firing to watch the horde lose interest.

---

### Appendix — Code Map (for assessors)
| File | Responsibility |
|---|---|
| `index.html` | Canvas + module load order |
| `js/config.js` | Canvas, `ctx`, `W`/`H`, resize |
| `js/world.js` | Maze generation, wall collision, line-of-sight, fog, minimap |
| `js/fuzzy.js` | **Fuzzy engine** — 5 inputs, 243-rule base, Mamdani inference, centroid defuzzification |
| `js/state.js` | `G` global state + `reset()` |
| `js/weapons.js` | Weapons, levelling, power-ups, coin meta (localStorage) |
| `js/mechanics.js` | `update()` loop, shooting, enemy AI, spawn director |
| `js/input.js` | Keyboard + mouse |
| `js/render.js` | World rendering + pseudo-3D characters |
| `js/hud.js` | Threat gauge, MF graphs, rules panel, vitals |
| `js/screens.js` | Setup / armory / pause / death screens, click routing |
| `js/main.js` | `requestAnimationFrame` loop |
| `js/render3d.js` + `js/lib/three.min.js` | *Experimental* first-person three.js renderer (not loaded by default) |

---

## Appendix B — Complete 243-Rule Base

Every rule below is generated by `js/fuzzy.js` from the scoring policy in §2.4 —
`score = 0.55·(health+ammo) + 0.8·noise − 0.6·pressure + 1.7·exposure`, banded at ≤2.3 (Passive) /
≤4.6 (Tactical) / else (Overwhelming), with weight `w = max(0.6, min(1, 0.6 + 0.4·dist-to-nearest-band-edge))`.
Rules are listed in the exact order the engine builds them (Health → Ammo → Noise → Pressure → Exposure,
each cycling Low/Medium/High-equivalent terms). Every antecedent is joined by **AND (min)**; the THEN column
is the defuzzified output band.

**Totals: 90 Passive · 104 Tactical · 49 Overwhelming = 243 rules.** *(The companion HTML/PDF prints the
same table with an added **THEN Supply** column — 63 Scarce · 90 Balanced · 90 Generous — for the v4 second output.)*

| # | Health | Ammo | Noise | Pressure | Exposure | Score | THEN Threat | w |
|---|---|---|---|---|---|---|---|---|
| 1 | Low | Depleted | Quiet | Safe | Hidden | 0.00 | **Passive** | 1.00 |
| 2 | Low | Depleted | Quiet | Safe | Suspicious | 1.70 | **Passive** | 0.84 |
| 3 | Low | Depleted | Quiet | Safe | Spotted | 3.40 | **Tactical** | 1.00 |
| 4 | Low | Depleted | Quiet | Engaged | Hidden | -0.60 | **Passive** | 1.00 |
| 5 | Low | Depleted | Quiet | Engaged | Suspicious | 1.10 | **Passive** | 1.00 |
| 6 | Low | Depleted | Quiet | Engaged | Spotted | 2.80 | **Tactical** | 0.80 |
| 7 | Low | Depleted | Quiet | Swarmed | Hidden | -1.20 | **Passive** | 1.00 |
| 8 | Low | Depleted | Quiet | Swarmed | Suspicious | 0.50 | **Passive** | 1.00 |
| 9 | Low | Depleted | Quiet | Swarmed | Spotted | 2.20 | **Passive** | 0.64 |
| 10 | Low | Depleted | Moderate | Safe | Hidden | 0.80 | **Passive** | 1.00 |
| 11 | Low | Depleted | Moderate | Safe | Suspicious | 2.50 | **Tactical** | 0.68 |
| 12 | Low | Depleted | Moderate | Safe | Spotted | 4.20 | **Tactical** | 0.76 |
| 13 | Low | Depleted | Moderate | Engaged | Hidden | 0.20 | **Passive** | 1.00 |
| 14 | Low | Depleted | Moderate | Engaged | Suspicious | 1.90 | **Passive** | 0.76 |
| 15 | Low | Depleted | Moderate | Engaged | Spotted | 3.60 | **Tactical** | 1.00 |
| 16 | Low | Depleted | Moderate | Swarmed | Hidden | -0.40 | **Passive** | 1.00 |
| 17 | Low | Depleted | Moderate | Swarmed | Suspicious | 1.30 | **Passive** | 1.00 |
| 18 | Low | Depleted | Moderate | Swarmed | Spotted | 3.00 | **Tactical** | 0.88 |
| 19 | Low | Depleted | Loud | Safe | Hidden | 1.60 | **Passive** | 0.88 |
| 20 | Low | Depleted | Loud | Safe | Suspicious | 3.30 | **Tactical** | 1.00 |
| 21 | Low | Depleted | Loud | Safe | Spotted | 5.00 | **Overwhelming** | 0.76 |
| 22 | Low | Depleted | Loud | Engaged | Hidden | 1.00 | **Passive** | 1.00 |
| 23 | Low | Depleted | Loud | Engaged | Suspicious | 2.70 | **Tactical** | 0.76 |
| 24 | Low | Depleted | Loud | Engaged | Spotted | 4.40 | **Tactical** | 0.68 |
| 25 | Low | Depleted | Loud | Swarmed | Hidden | 0.40 | **Passive** | 1.00 |
| 26 | Low | Depleted | Loud | Swarmed | Suspicious | 2.10 | **Passive** | 0.68 |
| 27 | Low | Depleted | Loud | Swarmed | Spotted | 3.80 | **Tactical** | 0.92 |
| 28 | Low | Adequate | Quiet | Safe | Hidden | 0.55 | **Passive** | 1.00 |
| 29 | Low | Adequate | Quiet | Safe | Suspicious | 2.25 | **Passive** | 0.62 |
| 30 | Low | Adequate | Quiet | Safe | Spotted | 3.95 | **Tactical** | 0.86 |
| 31 | Low | Adequate | Quiet | Engaged | Hidden | -0.05 | **Passive** | 1.00 |
| 32 | Low | Adequate | Quiet | Engaged | Suspicious | 1.65 | **Passive** | 0.86 |
| 33 | Low | Adequate | Quiet | Engaged | Spotted | 3.35 | **Tactical** | 1.00 |
| 34 | Low | Adequate | Quiet | Swarmed | Hidden | -0.65 | **Passive** | 1.00 |
| 35 | Low | Adequate | Quiet | Swarmed | Suspicious | 1.05 | **Passive** | 1.00 |
| 36 | Low | Adequate | Quiet | Swarmed | Spotted | 2.75 | **Tactical** | 0.78 |
| 37 | Low | Adequate | Moderate | Safe | Hidden | 1.35 | **Passive** | 0.98 |
| 38 | Low | Adequate | Moderate | Safe | Suspicious | 3.05 | **Tactical** | 0.90 |
| 39 | Low | Adequate | Moderate | Safe | Spotted | 4.75 | **Overwhelming** | 0.66 |
| 40 | Low | Adequate | Moderate | Engaged | Hidden | 0.75 | **Passive** | 1.00 |
| 41 | Low | Adequate | Moderate | Engaged | Suspicious | 2.45 | **Tactical** | 0.66 |
| 42 | Low | Adequate | Moderate | Engaged | Spotted | 4.15 | **Tactical** | 0.78 |
| 43 | Low | Adequate | Moderate | Swarmed | Hidden | 0.15 | **Passive** | 1.00 |
| 44 | Low | Adequate | Moderate | Swarmed | Suspicious | 1.85 | **Passive** | 0.78 |
| 45 | Low | Adequate | Moderate | Swarmed | Spotted | 3.55 | **Tactical** | 1.00 |
| 46 | Low | Adequate | Loud | Safe | Hidden | 2.15 | **Passive** | 0.66 |
| 47 | Low | Adequate | Loud | Safe | Suspicious | 3.85 | **Tactical** | 0.90 |
| 48 | Low | Adequate | Loud | Safe | Spotted | 5.55 | **Overwhelming** | 0.98 |
| 49 | Low | Adequate | Loud | Engaged | Hidden | 1.55 | **Passive** | 0.90 |
| 50 | Low | Adequate | Loud | Engaged | Suspicious | 3.25 | **Tactical** | 0.98 |
| 51 | Low | Adequate | Loud | Engaged | Spotted | 4.95 | **Overwhelming** | 0.74 |
| 52 | Low | Adequate | Loud | Swarmed | Hidden | 0.95 | **Passive** | 1.00 |
| 53 | Low | Adequate | Loud | Swarmed | Suspicious | 2.65 | **Tactical** | 0.74 |
| 54 | Low | Adequate | Loud | Swarmed | Spotted | 4.35 | **Tactical** | 0.70 |
| 55 | Low | Surplus | Quiet | Safe | Hidden | 1.10 | **Passive** | 1.00 |
| 56 | Low | Surplus | Quiet | Safe | Suspicious | 2.80 | **Tactical** | 0.80 |
| 57 | Low | Surplus | Quiet | Safe | Spotted | 4.50 | **Tactical** | 0.64 |
| 58 | Low | Surplus | Quiet | Engaged | Hidden | 0.50 | **Passive** | 1.00 |
| 59 | Low | Surplus | Quiet | Engaged | Suspicious | 2.20 | **Passive** | 0.64 |
| 60 | Low | Surplus | Quiet | Engaged | Spotted | 3.90 | **Tactical** | 0.88 |
| 61 | Low | Surplus | Quiet | Swarmed | Hidden | -0.10 | **Passive** | 1.00 |
| 62 | Low | Surplus | Quiet | Swarmed | Suspicious | 1.60 | **Passive** | 0.88 |
| 63 | Low | Surplus | Quiet | Swarmed | Spotted | 3.30 | **Tactical** | 1.00 |
| 64 | Low | Surplus | Moderate | Safe | Hidden | 1.90 | **Passive** | 0.76 |
| 65 | Low | Surplus | Moderate | Safe | Suspicious | 3.60 | **Tactical** | 1.00 |
| 66 | Low | Surplus | Moderate | Safe | Spotted | 5.30 | **Overwhelming** | 0.88 |
| 67 | Low | Surplus | Moderate | Engaged | Hidden | 1.30 | **Passive** | 1.00 |
| 68 | Low | Surplus | Moderate | Engaged | Suspicious | 3.00 | **Tactical** | 0.88 |
| 69 | Low | Surplus | Moderate | Engaged | Spotted | 4.70 | **Overwhelming** | 0.64 |
| 70 | Low | Surplus | Moderate | Swarmed | Hidden | 0.70 | **Passive** | 1.00 |
| 71 | Low | Surplus | Moderate | Swarmed | Suspicious | 2.40 | **Tactical** | 0.64 |
| 72 | Low | Surplus | Moderate | Swarmed | Spotted | 4.10 | **Tactical** | 0.80 |
| 73 | Low | Surplus | Loud | Safe | Hidden | 2.70 | **Tactical** | 0.76 |
| 74 | Low | Surplus | Loud | Safe | Suspicious | 4.40 | **Tactical** | 0.68 |
| 75 | Low | Surplus | Loud | Safe | Spotted | 6.10 | **Overwhelming** | 1.00 |
| 76 | Low | Surplus | Loud | Engaged | Hidden | 2.10 | **Passive** | 0.68 |
| 77 | Low | Surplus | Loud | Engaged | Suspicious | 3.80 | **Tactical** | 0.92 |
| 78 | Low | Surplus | Loud | Engaged | Spotted | 5.50 | **Overwhelming** | 0.96 |
| 79 | Low | Surplus | Loud | Swarmed | Hidden | 1.50 | **Passive** | 0.92 |
| 80 | Low | Surplus | Loud | Swarmed | Suspicious | 3.20 | **Tactical** | 0.96 |
| 81 | Low | Surplus | Loud | Swarmed | Spotted | 4.90 | **Overwhelming** | 0.72 |
| 82 | Medium | Depleted | Quiet | Safe | Hidden | 0.55 | **Passive** | 1.00 |
| 83 | Medium | Depleted | Quiet | Safe | Suspicious | 2.25 | **Passive** | 0.62 |
| 84 | Medium | Depleted | Quiet | Safe | Spotted | 3.95 | **Tactical** | 0.86 |
| 85 | Medium | Depleted | Quiet | Engaged | Hidden | -0.05 | **Passive** | 1.00 |
| 86 | Medium | Depleted | Quiet | Engaged | Suspicious | 1.65 | **Passive** | 0.86 |
| 87 | Medium | Depleted | Quiet | Engaged | Spotted | 3.35 | **Tactical** | 1.00 |
| 88 | Medium | Depleted | Quiet | Swarmed | Hidden | -0.65 | **Passive** | 1.00 |
| 89 | Medium | Depleted | Quiet | Swarmed | Suspicious | 1.05 | **Passive** | 1.00 |
| 90 | Medium | Depleted | Quiet | Swarmed | Spotted | 2.75 | **Tactical** | 0.78 |
| 91 | Medium | Depleted | Moderate | Safe | Hidden | 1.35 | **Passive** | 0.98 |
| 92 | Medium | Depleted | Moderate | Safe | Suspicious | 3.05 | **Tactical** | 0.90 |
| 93 | Medium | Depleted | Moderate | Safe | Spotted | 4.75 | **Overwhelming** | 0.66 |
| 94 | Medium | Depleted | Moderate | Engaged | Hidden | 0.75 | **Passive** | 1.00 |
| 95 | Medium | Depleted | Moderate | Engaged | Suspicious | 2.45 | **Tactical** | 0.66 |
| 96 | Medium | Depleted | Moderate | Engaged | Spotted | 4.15 | **Tactical** | 0.78 |
| 97 | Medium | Depleted | Moderate | Swarmed | Hidden | 0.15 | **Passive** | 1.00 |
| 98 | Medium | Depleted | Moderate | Swarmed | Suspicious | 1.85 | **Passive** | 0.78 |
| 99 | Medium | Depleted | Moderate | Swarmed | Spotted | 3.55 | **Tactical** | 1.00 |
| 100 | Medium | Depleted | Loud | Safe | Hidden | 2.15 | **Passive** | 0.66 |
| 101 | Medium | Depleted | Loud | Safe | Suspicious | 3.85 | **Tactical** | 0.90 |
| 102 | Medium | Depleted | Loud | Safe | Spotted | 5.55 | **Overwhelming** | 0.98 |
| 103 | Medium | Depleted | Loud | Engaged | Hidden | 1.55 | **Passive** | 0.90 |
| 104 | Medium | Depleted | Loud | Engaged | Suspicious | 3.25 | **Tactical** | 0.98 |
| 105 | Medium | Depleted | Loud | Engaged | Spotted | 4.95 | **Overwhelming** | 0.74 |
| 106 | Medium | Depleted | Loud | Swarmed | Hidden | 0.95 | **Passive** | 1.00 |
| 107 | Medium | Depleted | Loud | Swarmed | Suspicious | 2.65 | **Tactical** | 0.74 |
| 108 | Medium | Depleted | Loud | Swarmed | Spotted | 4.35 | **Tactical** | 0.70 |
| 109 | Medium | Adequate | Quiet | Safe | Hidden | 1.10 | **Passive** | 1.00 |
| 110 | Medium | Adequate | Quiet | Safe | Suspicious | 2.80 | **Tactical** | 0.80 |
| 111 | Medium | Adequate | Quiet | Safe | Spotted | 4.50 | **Tactical** | 0.64 |
| 112 | Medium | Adequate | Quiet | Engaged | Hidden | 0.50 | **Passive** | 1.00 |
| 113 | Medium | Adequate | Quiet | Engaged | Suspicious | 2.20 | **Passive** | 0.64 |
| 114 | Medium | Adequate | Quiet | Engaged | Spotted | 3.90 | **Tactical** | 0.88 |
| 115 | Medium | Adequate | Quiet | Swarmed | Hidden | -0.10 | **Passive** | 1.00 |
| 116 | Medium | Adequate | Quiet | Swarmed | Suspicious | 1.60 | **Passive** | 0.88 |
| 117 | Medium | Adequate | Quiet | Swarmed | Spotted | 3.30 | **Tactical** | 1.00 |
| 118 | Medium | Adequate | Moderate | Safe | Hidden | 1.90 | **Passive** | 0.76 |
| 119 | Medium | Adequate | Moderate | Safe | Suspicious | 3.60 | **Tactical** | 1.00 |
| 120 | Medium | Adequate | Moderate | Safe | Spotted | 5.30 | **Overwhelming** | 0.88 |
| 121 | Medium | Adequate | Moderate | Engaged | Hidden | 1.30 | **Passive** | 1.00 |
| 122 | Medium | Adequate | Moderate | Engaged | Suspicious | 3.00 | **Tactical** | 0.88 |
| 123 | Medium | Adequate | Moderate | Engaged | Spotted | 4.70 | **Overwhelming** | 0.64 |
| 124 | Medium | Adequate | Moderate | Swarmed | Hidden | 0.70 | **Passive** | 1.00 |
| 125 | Medium | Adequate | Moderate | Swarmed | Suspicious | 2.40 | **Tactical** | 0.64 |
| 126 | Medium | Adequate | Moderate | Swarmed | Spotted | 4.10 | **Tactical** | 0.80 |
| 127 | Medium | Adequate | Loud | Safe | Hidden | 2.70 | **Tactical** | 0.76 |
| 128 | Medium | Adequate | Loud | Safe | Suspicious | 4.40 | **Tactical** | 0.68 |
| 129 | Medium | Adequate | Loud | Safe | Spotted | 6.10 | **Overwhelming** | 1.00 |
| 130 | Medium | Adequate | Loud | Engaged | Hidden | 2.10 | **Passive** | 0.68 |
| 131 | Medium | Adequate | Loud | Engaged | Suspicious | 3.80 | **Tactical** | 0.92 |
| 132 | Medium | Adequate | Loud | Engaged | Spotted | 5.50 | **Overwhelming** | 0.96 |
| 133 | Medium | Adequate | Loud | Swarmed | Hidden | 1.50 | **Passive** | 0.92 |
| 134 | Medium | Adequate | Loud | Swarmed | Suspicious | 3.20 | **Tactical** | 0.96 |
| 135 | Medium | Adequate | Loud | Swarmed | Spotted | 4.90 | **Overwhelming** | 0.72 |
| 136 | Medium | Surplus | Quiet | Safe | Hidden | 1.65 | **Passive** | 0.86 |
| 137 | Medium | Surplus | Quiet | Safe | Suspicious | 3.35 | **Tactical** | 1.00 |
| 138 | Medium | Surplus | Quiet | Safe | Spotted | 5.05 | **Overwhelming** | 0.78 |
| 139 | Medium | Surplus | Quiet | Engaged | Hidden | 1.05 | **Passive** | 1.00 |
| 140 | Medium | Surplus | Quiet | Engaged | Suspicious | 2.75 | **Tactical** | 0.78 |
| 141 | Medium | Surplus | Quiet | Engaged | Spotted | 4.45 | **Tactical** | 0.66 |
| 142 | Medium | Surplus | Quiet | Swarmed | Hidden | 0.45 | **Passive** | 1.00 |
| 143 | Medium | Surplus | Quiet | Swarmed | Suspicious | 2.15 | **Passive** | 0.66 |
| 144 | Medium | Surplus | Quiet | Swarmed | Spotted | 3.85 | **Tactical** | 0.90 |
| 145 | Medium | Surplus | Moderate | Safe | Hidden | 2.45 | **Tactical** | 0.66 |
| 146 | Medium | Surplus | Moderate | Safe | Suspicious | 4.15 | **Tactical** | 0.78 |
| 147 | Medium | Surplus | Moderate | Safe | Spotted | 5.85 | **Overwhelming** | 1.00 |
| 148 | Medium | Surplus | Moderate | Engaged | Hidden | 1.85 | **Passive** | 0.78 |
| 149 | Medium | Surplus | Moderate | Engaged | Suspicious | 3.55 | **Tactical** | 1.00 |
| 150 | Medium | Surplus | Moderate | Engaged | Spotted | 5.25 | **Overwhelming** | 0.86 |
| 151 | Medium | Surplus | Moderate | Swarmed | Hidden | 1.25 | **Passive** | 1.00 |
| 152 | Medium | Surplus | Moderate | Swarmed | Suspicious | 2.95 | **Tactical** | 0.86 |
| 153 | Medium | Surplus | Moderate | Swarmed | Spotted | 4.65 | **Overwhelming** | 0.62 |
| 154 | Medium | Surplus | Loud | Safe | Hidden | 3.25 | **Tactical** | 0.98 |
| 155 | Medium | Surplus | Loud | Safe | Suspicious | 4.95 | **Overwhelming** | 0.74 |
| 156 | Medium | Surplus | Loud | Safe | Spotted | 6.65 | **Overwhelming** | 1.00 |
| 157 | Medium | Surplus | Loud | Engaged | Hidden | 2.65 | **Tactical** | 0.74 |
| 158 | Medium | Surplus | Loud | Engaged | Suspicious | 4.35 | **Tactical** | 0.70 |
| 159 | Medium | Surplus | Loud | Engaged | Spotted | 6.05 | **Overwhelming** | 1.00 |
| 160 | Medium | Surplus | Loud | Swarmed | Hidden | 2.05 | **Passive** | 0.70 |
| 161 | Medium | Surplus | Loud | Swarmed | Suspicious | 3.75 | **Tactical** | 0.94 |
| 162 | Medium | Surplus | Loud | Swarmed | Spotted | 5.45 | **Overwhelming** | 0.94 |
| 163 | High | Depleted | Quiet | Safe | Hidden | 1.10 | **Passive** | 1.00 |
| 164 | High | Depleted | Quiet | Safe | Suspicious | 2.80 | **Tactical** | 0.80 |
| 165 | High | Depleted | Quiet | Safe | Spotted | 4.50 | **Tactical** | 0.64 |
| 166 | High | Depleted | Quiet | Engaged | Hidden | 0.50 | **Passive** | 1.00 |
| 167 | High | Depleted | Quiet | Engaged | Suspicious | 2.20 | **Passive** | 0.64 |
| 168 | High | Depleted | Quiet | Engaged | Spotted | 3.90 | **Tactical** | 0.88 |
| 169 | High | Depleted | Quiet | Swarmed | Hidden | -0.10 | **Passive** | 1.00 |
| 170 | High | Depleted | Quiet | Swarmed | Suspicious | 1.60 | **Passive** | 0.88 |
| 171 | High | Depleted | Quiet | Swarmed | Spotted | 3.30 | **Tactical** | 1.00 |
| 172 | High | Depleted | Moderate | Safe | Hidden | 1.90 | **Passive** | 0.76 |
| 173 | High | Depleted | Moderate | Safe | Suspicious | 3.60 | **Tactical** | 1.00 |
| 174 | High | Depleted | Moderate | Safe | Spotted | 5.30 | **Overwhelming** | 0.88 |
| 175 | High | Depleted | Moderate | Engaged | Hidden | 1.30 | **Passive** | 1.00 |
| 176 | High | Depleted | Moderate | Engaged | Suspicious | 3.00 | **Tactical** | 0.88 |
| 177 | High | Depleted | Moderate | Engaged | Spotted | 4.70 | **Overwhelming** | 0.64 |
| 178 | High | Depleted | Moderate | Swarmed | Hidden | 0.70 | **Passive** | 1.00 |
| 179 | High | Depleted | Moderate | Swarmed | Suspicious | 2.40 | **Tactical** | 0.64 |
| 180 | High | Depleted | Moderate | Swarmed | Spotted | 4.10 | **Tactical** | 0.80 |
| 181 | High | Depleted | Loud | Safe | Hidden | 2.70 | **Tactical** | 0.76 |
| 182 | High | Depleted | Loud | Safe | Suspicious | 4.40 | **Tactical** | 0.68 |
| 183 | High | Depleted | Loud | Safe | Spotted | 6.10 | **Overwhelming** | 1.00 |
| 184 | High | Depleted | Loud | Engaged | Hidden | 2.10 | **Passive** | 0.68 |
| 185 | High | Depleted | Loud | Engaged | Suspicious | 3.80 | **Tactical** | 0.92 |
| 186 | High | Depleted | Loud | Engaged | Spotted | 5.50 | **Overwhelming** | 0.96 |
| 187 | High | Depleted | Loud | Swarmed | Hidden | 1.50 | **Passive** | 0.92 |
| 188 | High | Depleted | Loud | Swarmed | Suspicious | 3.20 | **Tactical** | 0.96 |
| 189 | High | Depleted | Loud | Swarmed | Spotted | 4.90 | **Overwhelming** | 0.72 |
| 190 | High | Adequate | Quiet | Safe | Hidden | 1.65 | **Passive** | 0.86 |
| 191 | High | Adequate | Quiet | Safe | Suspicious | 3.35 | **Tactical** | 1.00 |
| 192 | High | Adequate | Quiet | Safe | Spotted | 5.05 | **Overwhelming** | 0.78 |
| 193 | High | Adequate | Quiet | Engaged | Hidden | 1.05 | **Passive** | 1.00 |
| 194 | High | Adequate | Quiet | Engaged | Suspicious | 2.75 | **Tactical** | 0.78 |
| 195 | High | Adequate | Quiet | Engaged | Spotted | 4.45 | **Tactical** | 0.66 |
| 196 | High | Adequate | Quiet | Swarmed | Hidden | 0.45 | **Passive** | 1.00 |
| 197 | High | Adequate | Quiet | Swarmed | Suspicious | 2.15 | **Passive** | 0.66 |
| 198 | High | Adequate | Quiet | Swarmed | Spotted | 3.85 | **Tactical** | 0.90 |
| 199 | High | Adequate | Moderate | Safe | Hidden | 2.45 | **Tactical** | 0.66 |
| 200 | High | Adequate | Moderate | Safe | Suspicious | 4.15 | **Tactical** | 0.78 |
| 201 | High | Adequate | Moderate | Safe | Spotted | 5.85 | **Overwhelming** | 1.00 |
| 202 | High | Adequate | Moderate | Engaged | Hidden | 1.85 | **Passive** | 0.78 |
| 203 | High | Adequate | Moderate | Engaged | Suspicious | 3.55 | **Tactical** | 1.00 |
| 204 | High | Adequate | Moderate | Engaged | Spotted | 5.25 | **Overwhelming** | 0.86 |
| 205 | High | Adequate | Moderate | Swarmed | Hidden | 1.25 | **Passive** | 1.00 |
| 206 | High | Adequate | Moderate | Swarmed | Suspicious | 2.95 | **Tactical** | 0.86 |
| 207 | High | Adequate | Moderate | Swarmed | Spotted | 4.65 | **Overwhelming** | 0.62 |
| 208 | High | Adequate | Loud | Safe | Hidden | 3.25 | **Tactical** | 0.98 |
| 209 | High | Adequate | Loud | Safe | Suspicious | 4.95 | **Overwhelming** | 0.74 |
| 210 | High | Adequate | Loud | Safe | Spotted | 6.65 | **Overwhelming** | 1.00 |
| 211 | High | Adequate | Loud | Engaged | Hidden | 2.65 | **Tactical** | 0.74 |
| 212 | High | Adequate | Loud | Engaged | Suspicious | 4.35 | **Tactical** | 0.70 |
| 213 | High | Adequate | Loud | Engaged | Spotted | 6.05 | **Overwhelming** | 1.00 |
| 214 | High | Adequate | Loud | Swarmed | Hidden | 2.05 | **Passive** | 0.70 |
| 215 | High | Adequate | Loud | Swarmed | Suspicious | 3.75 | **Tactical** | 0.94 |
| 216 | High | Adequate | Loud | Swarmed | Spotted | 5.45 | **Overwhelming** | 0.94 |
| 217 | High | Surplus | Quiet | Safe | Hidden | 2.20 | **Passive** | 0.64 |
| 218 | High | Surplus | Quiet | Safe | Suspicious | 3.90 | **Tactical** | 0.88 |
| 219 | High | Surplus | Quiet | Safe | Spotted | 5.60 | **Overwhelming** | 1.00 |
| 220 | High | Surplus | Quiet | Engaged | Hidden | 1.60 | **Passive** | 0.88 |
| 221 | High | Surplus | Quiet | Engaged | Suspicious | 3.30 | **Tactical** | 1.00 |
| 222 | High | Surplus | Quiet | Engaged | Spotted | 5.00 | **Overwhelming** | 0.76 |
| 223 | High | Surplus | Quiet | Swarmed | Hidden | 1.00 | **Passive** | 1.00 |
| 224 | High | Surplus | Quiet | Swarmed | Suspicious | 2.70 | **Tactical** | 0.76 |
| 225 | High | Surplus | Quiet | Swarmed | Spotted | 4.40 | **Tactical** | 0.68 |
| 226 | High | Surplus | Moderate | Safe | Hidden | 3.00 | **Tactical** | 0.88 |
| 227 | High | Surplus | Moderate | Safe | Suspicious | 4.70 | **Overwhelming** | 0.64 |
| 228 | High | Surplus | Moderate | Safe | Spotted | 6.40 | **Overwhelming** | 1.00 |
| 229 | High | Surplus | Moderate | Engaged | Hidden | 2.40 | **Tactical** | 0.64 |
| 230 | High | Surplus | Moderate | Engaged | Suspicious | 4.10 | **Tactical** | 0.80 |
| 231 | High | Surplus | Moderate | Engaged | Spotted | 5.80 | **Overwhelming** | 1.00 |
| 232 | High | Surplus | Moderate | Swarmed | Hidden | 1.80 | **Passive** | 0.80 |
| 233 | High | Surplus | Moderate | Swarmed | Suspicious | 3.50 | **Tactical** | 1.00 |
| 234 | High | Surplus | Moderate | Swarmed | Spotted | 5.20 | **Overwhelming** | 0.84 |
| 235 | High | Surplus | Loud | Safe | Hidden | 3.80 | **Tactical** | 0.92 |
| 236 | High | Surplus | Loud | Safe | Suspicious | 5.50 | **Overwhelming** | 0.96 |
| 237 | High | Surplus | Loud | Safe | Spotted | 7.20 | **Overwhelming** | 1.00 |
| 238 | High | Surplus | Loud | Engaged | Hidden | 3.20 | **Tactical** | 0.96 |
| 239 | High | Surplus | Loud | Engaged | Suspicious | 4.90 | **Overwhelming** | 0.72 |
| 240 | High | Surplus | Loud | Engaged | Spotted | 6.60 | **Overwhelming** | 1.00 |
| 241 | High | Surplus | Loud | Swarmed | Hidden | 2.60 | **Tactical** | 0.72 |
| 242 | High | Surplus | Loud | Swarmed | Suspicious | 4.30 | **Tactical** | 0.72 |
| 243 | High | Surplus | Loud | Swarmed | Spotted | 6.00 | **Overwhelming** | 1.00 |

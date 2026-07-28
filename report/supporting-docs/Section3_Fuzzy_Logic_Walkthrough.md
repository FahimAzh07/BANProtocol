# 3. System Walkthrough — Fuzzy Logic as it Actually Runs in BAN's Protocol

*All code snippets below are taken verbatim from `bans-protocol.html`. Line numbers refer to that file.*

---

## 3.1 System Overview

The game is a single self-contained HTML file: pure HTML5 Canvas + JavaScript, no HTML inputs and no libraries. Everything the player sees and touches — sliders, buttons, gauges, graphs, the pseudo-3D characters — is drawn on one 1280×720 canvas.

Five subsystems cooperate:

| Subsystem | Where in code | Role |
|---|---|---|
| **Fuzzy engine** (`Fuzzy` module) | lines 42–98 | Pure, stateless Mamdani inference: membership functions, rule base, aggregation, centroid defuzzification. Knows nothing about the game. |
| **Game state** (`G` object) | lines 122–135 | Single source of truth: player, ammo, noise, entities, the latest fuzzy result (`G.fuzzy`), and the difficulty settings chosen on the setup screen. |
| **Update loop** (`update()`) | lines 195–276 | Runs every frame: movement, shooting, collisions, noise decay — and every 10 frames it samples the player's state and calls `Fuzzy.infer()`. |
| **Director / spawner** (`spawnWave()`) | lines 173–190, 229–231 | Translates the crisp Threat number into horde size, spawn cadence, and per-enemy stats. |
| **Renderer** | lines 338–500 | Draws the world, plus the *explainability layer*: threat gauge, three membership-function graphs, and the live active-rules panel. |

**The closed feedback loop** is the heart of the design:

```
player behaviour → crisp inputs (Health, Ammo, Noise)
      ↑                                   ↓
gameplay pressure  ←  Threat (0–100)  ←  fuzzy inference
```

The player's actions change the inputs; the inputs change the Threat; the Threat changes how hard the horde pushes; the pressure changes the player's behaviour. Unlike a scripted difficulty curve, the system has no timeline — difficulty is an *emergent equilibrium* between the player and the director.

A small state machine (`G.state`: `setup → play ⇄ paused → dead → setup`, line 123) wraps the loop. Difficulty preferences (`pace`, `density`, `toughness`, line 134) are set on the canvas-drawn setup screen *before* deployment and act as fixed scaling factors on top of the fuzzy output — the fuzzy system decides *relative* pressure, the player decides the *absolute* range.

---

## 3.2 The Fuzzy Pipeline, Step by Step

The engine is a classic **Mamdani** controller: fuzzify → evaluate rules (min) → aggregate (max) → defuzzify (centroid).

### Step 1 — Sampling & normalisation (crisp inputs)

Every 10 frames (~6× per second — fast enough to feel responsive, cheap enough to be free), `update()` builds three crisp values on a common 0–100 scale and runs inference (lines 222–226):

```js
// FUZZY INFERENCE
if(++G.fuzzyTimer>=10){ G.fuzzyTimer=0;
  const inputs={health:(p.hp/p.maxhp)*100,
    ammo:((G.ammo+G.reserve)/(G.maxAmmo+120))*100, noise:G.noise};
  G.fuzzy=Fuzzy.infer(inputs); G._inputs=inputs; }
```

- **Health** — current HP as a percentage of max.
- **Ammo** — *total* ammunition (magazine + reserve) against the starting total (24 + 120). Using the total, not just the magazine, stops the threat from spiking mid-reload.
- **Noise** — already 0–100; it is an accumulator the gameplay itself maintains (see §3.4).

### Step 2 — Fuzzification

Three shape helpers build every membership function (lines 43–45):

```js
const tri  = (x,a,b,c)=> Math.max(0, Math.min((x-a)/(b-a||1e-9), (c-x)/(c-b||1e-9)));
const trapL= (x,a,b)=> x<=a?1: x>=b?0: (b-x)/(b-a);   // left shoulder (full, then ramps down)
const trapR= (x,a,b)=> x<=a?0: x>=b?1: (x-a)/(b-a);   // right shoulder (ramps up, then full)
```

`tri(x,a,b,c)` is a triangle peaking at `b`; `trapL` is an open-left shoulder ("anything below *a* is fully this"); `trapR` the mirror. The `||1e-9` guards against division by zero for degenerate parameters.

Each input variable gets three linguistic terms (lines 47–49):

```js
const health = { Low:x=>trapL(x,15,40), Medium:x=>tri(x,25,50,75), High:x=>trapR(x,60,85) };
const ammo   = { Depleted:x=>trapL(x,10,35), Adequate:x=>tri(x,25,55,80), Surplus:x=>trapR(x,65,90) };
const noise  = { Quiet:x=>trapL(x,15,40), Moderate:x=>tri(x,30,55,80), Loud:x=>trapR(x,65,90) };
```

Note the deliberate **overlaps** (e.g. Health 25–40 is partly Low *and* partly Medium). This is what makes the output glide smoothly instead of snapping between difficulty tiers — the whole reason fuzzy logic was chosen over `if hp < 40` thresholds.

The output variable, **Threat**, has its own three sets (lines 51–55):

```js
const threatSets = {
  Passive:      x=>tri(x,0,18,40),
  Tactical:     x=>tri(x,30,50,70),
  Overwhelming: x=>trapR(x,60,90),
};
```

`fuzzify()` (lines 72–76) simply evaluates every term of every variable, producing a table of membership degrees, e.g. `{health:{Low:0.8, Medium:0, High:0}, …}`.

### Step 3 — Rule evaluation (AND = min, × weight)

The rule base is 11 weighted IF–THEN rules (lines 57–69). Each antecedent is a list of `[variable, term]` pairs combined with fuzzy AND; each rule has a weight `w` expressing the designer's confidence, and a human-readable design note:

```js
const rules = [
  {if:[['health','Low'],['ammo','Depleted']],     then:'Passive',      w:1.0, note:'Wounded & dry → breathing room'},
  {if:[['health','Low'],['ammo','Surplus']],      then:'Tactical',     w:0.9, note:'Wounded but armed → measured'},
  {if:[['health','Low'],['noise','Loud']],        then:'Overwhelming', w:0.8, note:'Bleeding & loud → punished'},
  {if:[['health','Medium'],['ammo','Adequate']],  then:'Tactical',     w:1.0, note:'Balanced → standard pressure'},
  {if:[['health','Medium'],['noise','Loud']],     then:'Overwhelming', w:0.9, note:'Loud → horde converges'},
  {if:[['health','High'],['ammo','Surplus']],     then:'Overwhelming', w:1.0, note:'Strong & loaded → max challenge'},
  {if:[['health','High'],['ammo','Adequate']],    then:'Tactical',     w:0.85,note:'Comfortable → keep busy'},
  {if:[['health','High'],['noise','Quiet']],      then:'Tactical',     w:0.7, note:'Strong & stealthy → moderate'},
  {if:[['noise','Quiet'],['ammo','Depleted']],    then:'Passive',      w:0.8, note:'Quiet & dry → let them rearm'},
  {if:[['noise','Loud'],['ammo','Surplus']],      then:'Overwhelming', w:0.95,note:'Loud & loaded → swarm'},
  {if:[['health','Medium'],['ammo','Depleted']],  then:'Passive',      w:0.75,note:'Mid HP, no ammo → relief wave'},
];
```

The collective design intent: **the game pushes hardest when the player can take it, and eases off when they are desperate** — the opposite of naive "punish the weak" scaling.

Evaluation inside `infer()` (lines 81–85): firing strength = min over antecedents, scaled by the weight:

```js
for(const r of rules){
  let s=1; for(const [v,t] of r.if) s=Math.min(s,f[v][t]);  // AND = min
  s*=r.w;                                                    // rule weight
  if(s>0.001) fired.push({rule:r,strength:s});               // for the live rules panel
  agg[r.then]=Math.max(agg[r.then],s);
```

### Step 4 — Aggregation (OR = max per output term)

The last line above is the aggregation: every rule that concludes, say, `Tactical` competes, and the *strongest* wins (`Math.max`). The result is one clipping level per output set, e.g. `agg = {Passive:0.8, Tactical:0.15, Overwhelming:0}`.

### Step 5 — Defuzzification (centroid / centre of gravity)

The aggregated fuzzy output is collapsed to one crisp number by sampling the combined output surface every 2 units across 0–100 and computing its centre of gravity (lines 87–93):

```js
let num=0,den=0;
for(let x=0;x<=100;x+=2){
  let mu=0;
  for(const s in threatSets) mu=Math.max(mu,Math.min(agg[s],threatSets[s](x)));  // clip & union
  num+=x*mu; den+=mu;
}
const crisp=den>0?num/den:0;
```

For each sample point `x`, each output set is **clipped** at its aggregation level (`min(agg[s], μ_set(x))` — Mamdani implication) and the clipped sets are **unioned** (`max`). The centroid `Σx·μ / Σμ` of that composite shape is the final **Threat ∈ [0,100]**. 51 samples is plenty for piecewise-linear sets, and the whole pipeline runs in well under a millisecond.

`infer()` returns everything — `{fuzzified, aggregate, threat, fired}` — not just the number, so the HUD can visualise the *internals* of the inference (§3.5).

---

## 3.3 From Threat Number to Gameplay

The crisp Threat drives the director in `spawnWave()` (lines 173–190) and the spawn cadence (lines 229–231). With `aggr = threat/100` and the player's setup-screen settings as multipliers:

| Game parameter | Formula (code) | At Threat = 0 | At Threat = 100 |
|---|---|---|---|
| **Horde size** per wave | `max(1, round((1 + aggr*5) * density))` (line 175) | 1 × density | 6 × density |
| **Spawn cadence** (frames between waves) | `(210 − aggr*120) / pace` (line 230) | 210/pace ≈ 5.8 s | 90/pace ≈ 2.5 s |
| **Enemy speed** (px/frame) | `(0.45 + aggr*1.25) * pace` (line 185) | 0.45·pace | 1.70·pace |
| **Enemy HP** | `18 + aggr*28` (line 184) | 18 | 46 |
| **Enemy damage** per hit | `(6 + aggr*9) * 0.5 / toughness` (lines 186, 241) | 3/toughness | 7.5/toughness |
| **Enemy colour** (hue) | `aggr>0.66 ? red : aggr>0.33 ? orange : blue` (line 187) | blue (calm) | red (frenzied) |
| **Arena vignette** | radial gradient reddens with threat (lines 343–346) | cool blue edge | blood-red edge |

Every mapping is **linear and continuous** in Threat, so the smoothness produced by the fuzzy overlap survives all the way into gameplay — when Threat drifts from 48 to 52 nothing "switches on"; waves just get slightly bigger, slightly faster, slightly sooner. The colour coding (enemies and vignette) means the player can *read* the current threat level diegetically, without looking at the HUD.

The `pace` / `density` / `toughness` settings chosen on the setup screen scale these formulas but never feed back into the inference — the fuzzy director stays player-state-driven; the sliders only set the stage it performs on.

---

## 3.4 The Noise Mechanic — Closing the Loop

Health and Ammo change *because of* the horde; Noise is the input the player **directly authors**, which is what turns difficulty into a playable system rather than a hidden score:

- **Shooting** is loud: `G.noise = min(100, G.noise + 15)` per shot (line 163) — ~7 quick shots saturate it.
- **Moving** is faintly audible: `+0.5` per frame while walking (line 207).
- **Stillness and patience** pay off: noise decays by `0.35` per frame (line 220), draining from 100 to 0 in roughly 5 seconds of silence.

Because `noise.Loud` antecedents feed three of the strongest *Overwhelming* rules (R3, R5, R10) and `noise.Quiet` feeds the *Passive* "let them rearm" rule (R9), the player faces a genuine, continuous trade-off every moment: **spray-and-pray summons the swarm; conserve ammo, pick shots, and go quiet, and the director audibly backs off.** The player can *feel* themselves steering the fuzzy controller — and verify it on the noise bar, the graphs, and the threat gauge in real time.

---

## 3.5 Live Visualisation — an On-Screen X-Ray of the Inference

Three HUD elements (all canvas-drawn, all toggleable via the canvas buttons at bottom-left, lines 445–452) expose each stage of the pipeline while you play:

1. **Threat gauge** (`threatGauge()`, lines 385–402) — the *output*. A semicircular dial with the three output bands tinted blue/amber/red, a glowing needle at the crisp centroid value, the rounded Threat number, and the dominant linguistic label (PASSIVE / TACTICAL / OVERWHELMING).

2. **Membership-function graphs** (`mfGraph()`, lines 405–443; invoked at 473–478) — the *fuzzification* stage. Three large panels (308×150 px, stacked on the right) draw the actual MF curves for Health, Ammo and Noise as filled, colour-coded shapes over a grid. A dashed white vertical line marks the live crisp input, with a dot on every curve it intersects showing the exact membership degree, plus the numeric readout and a legend that highlights the dominant term in bold. These are not illustrations — they evaluate the *same* `Fuzzy.health/ammo/noise` functions the engine uses, so the graphs are the inference.

3. **Active rules panel** (lines 480–493) — the *rule evaluation* stage. The top five firing rules (sorted by strength, from `fired`) are listed live as `IF Low ∧ Depleted → Passive` with a horizontal bar and percentage showing each rule's firing strength.

Together they satisfy the visual-feedback requirement and double as a debugging/teaching tool: any Threat value on the gauge can be traced backwards through the rules panel to the membership dots that caused it.

---

## 3.6 Worked Example — "Wounded and Out of Ammo"

A concrete trace through the whole pipeline. The player has been mauled and is nearly dry, but has stopped shooting and gone quiet:

**Crisp inputs** (sampling step): HP 20/100, ammo 4 in magazine + 10 reserve, noise decayed to 12.

```
health = (20/100)·100                = 20.0
ammo   = ((4+10)/(24+120))·100       ≈  9.7
noise  =                               12.0
```

**Fuzzification:**

| | Term 1 | Term 2 | Term 3 |
|---|---|---|---|
| health = 20 | Low = trapL(20,15,40) = (40−20)/25 = **0.80** | Medium = 0 | High = 0 |
| ammo = 9.7 | Depleted = trapL(9.7,10,35) = **1.00** (below the shoulder) | Adequate = 0 | Surplus = 0 |
| noise = 12 | Quiet = trapL(12,15,40) = **1.00** | Moderate = 0 | Loud = 0 |

**Rule evaluation** — only two rules have all antecedents non-zero:

| Rule | Firing strength |
|---|---|
| R1: IF health Low ∧ ammo Depleted → Passive (w 1.0) | min(0.80, 1.00) × 1.0 = **0.80** |
| R9: IF noise Quiet ∧ ammo Depleted → Passive (w 0.8) | min(1.00, 1.00) × 0.8 = **0.80** |

Every rule concluding *Tactical* or *Overwhelming* contains `Medium`, `High`, `Surplus`, `Adequate`, `Moderate` or `Loud` — all zero here — so they fire at 0.

**Aggregation:** `Passive = max(0.80, 0.80) = 0.80`, `Tactical = 0`, `Overwhelming = 0`.

**Defuzzification:** the only contributing shape is the Passive triangle `tri(x,0,18,40)` clipped at height 0.8 — a trapezoid flat between x ≈ 14.4 and x ≈ 22.4. Its centroid:

```
Threat = Σ x·μ(x) / Σ μ(x)  ≈ 19.4   →  rounds to 19 on the gauge
```

(slightly above the unclipped triangle's centroid of 19.33, because clipping flattens the peak toward the longer right slope). **19 sits squarely in the Passive band** (< 33) — exactly the "breathing room" the rule notes promise.

**Resulting gameplay** (default settings: pace 0.6, density 1.0, toughness 1.2; `aggr = 0.194`):

- Horde size: `round((1 + 0.194·5)·1.0)` = **2 enemies** per wave (vs 6 at max threat)
- Cadence: `(210 − 0.194·120)/0.6` ≈ 311 frames ≈ **one wave every ~5.2 s**
- Enemy speed: `(0.45 + 0.194·1.25)·0.6` ≈ **0.42 px/frame** — easily outrun
- Enemy damage: `(6 + 0.194·9)·0.5/1.2` ≈ **3.2 HP per hit**
- Enemies spawn **blue** (hue 205); the vignette stays cool.

The director has read "wounded, dry, quiet" and answered with sparse, slow, fragile stragglers — long enough for the player to grab pickups, reload, and recover. The moment HP and ammo climb back up (and especially if the player gets loud doing it), the Surplus/Loud rules wake, the centroid slides right, and the pressure returns — *continuously*, with no visible difficulty "step" anywhere. That round trip is the whole thesis of the project.

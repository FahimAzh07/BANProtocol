# Inference Engine Expansion Report — BAN's Protocol v2

*Date: 2026-06-11 · File: `js/fuzzy.js`*

## 1. Headline numbers

| | v1 (before) | v2 (after) | Change |
|---|---|---|---|
| Fuzzy input variables | 3 (Health, Ammo, Noise) | **4** (+ Pressure) | +1 |
| Linguistic terms | 9 (3 per input) | **12** (3 per input) | +3 |
| Inference rules | 11 (hand-curated) | **81** (complete grid) | **+70 rules (+636%)** |
| Rule coverage of input space | partial — many input combinations hit no rule at full strength | **total** — every one of the 3⁴ = 81 term combinations has an explicit rule | complete |
| Output terms | 3 (Passive / Tactical / Overwhelming) | 3 (unchanged) | — |
| Inference method | Mamdani, min/max, centroid | Mamdani, min/max, centroid (unchanged) | — |

The 81 figure is not arbitrary: with 4 input variables × 3 linguistic terms each, the full
AND-combination space is 3⁴ = **81**, and the v2 rule base covers all of it. No reachable game
situation is ever unhandled by the inference engine.

## 2. The new input: Pressure

**What it measures:** how swarmed the player *already* is — the battlefield situation, computed
each inference tick in `js/mechanics.js` from the distance to the nearest enemy plus a crowd bonus:

```js
let nd=Infinity; for(const e of G.enemies) nd=Math.min(nd,Math.hypot(p.x-e.x,p.y-e.y));
const press = G.enemies.length===0 ? 0
            : Math.max(0,Math.min(100, (100-nd/5) + G.enemies.length*2 ));
```

**Membership functions** (`js/fuzzy.js`):

```js
pressure = { Safe:x=>trapL(x,20,45), Engaged:x=>tri(x,35,60,85), Swarmed:x=>trapR(x,70,90) };
```

**Why it was added:** the user-facing requirement "enemies spawn based on the character's game
situation". In v1 the director saw only the player's *internal* state; it would happily pile a new
wave onto a player already buried in enemies. Pressure is a *negative* (relieving) factor: being
swarmed pulls the Threat down, so the director throttles spawning until the player digs out —
a self-balancing relief valve that closes a second feedback loop (enemy count → Threat → enemy count).

## 3. How the 81 rules are produced

Hand-writing 81 rules invites inconsistency, so v2 generates the complete grid from a transparent
scoring policy (the design intent is unchanged from v1: *push hardest when the player can take it*):

```
score = health + ammo + 0.9·noise − 0.7·pressure        (term levels: 0 / 1 / 2)

consequent:  score ≤ 1.5 → Passive   ·   score ≤ 3.4 → Tactical   ·   else → Overwhelming
weight:      w = 0.6 … 1.0, growing with distance from the nearest band boundary
             (borderline situations speak softly, clear-cut ones at full strength)
```

- **Capability raises threat** — healthy and well-stocked players get pushed (coeff 1.0 + 1.0).
- **Exposure raises threat** — being loud is punished (coeff 0.9).
- **Pressure lowers threat** — already-swarmed players get relief, not a pile-on (coeff −0.7).

Scores are rounded to 2 decimals before banding so floating-point noise cannot flip a boundary rule.
Each generated rule is a normal `{if, then, w}` object — the inference loop itself is untouched, and
every rule still appears live in the on-screen ACTIVE FUZZY RULES panel with its firing strength.

## 4. Rule-base composition (verified by hand enumeration)

| Consequent | Rules | Share |
|---|---|---|
| Passive | 29 | 35.8 % |
| Tactical | 36 | 44.4 % |
| Overwhelming | 16 | 19.8 % |
| **Total** | **81** | 100 % |

The distribution is deliberately mercy-biased: under half the situations call for standard pressure,
over a third call for relief, and fewer than a fifth unleash the full horde — those are reserved for
players who are healthy, loaded, loud, and not yet under pressure.

**Sample generated rules:**

| IF (health ∧ ammo ∧ noise ∧ pressure) | score | THEN | w |
|---|---|---|---|
| Low ∧ Depleted ∧ Quiet ∧ Swarmed | −1.4 | Passive | 1.00 |
| Low ∧ Depleted ∧ Quiet ∧ Safe | 0.0 | Passive | 1.00 |
| Medium ∧ Adequate ∧ Moderate ∧ Engaged | 2.2 | Tactical | 0.88 |
| High ∧ Surplus ∧ Quiet ∧ Swarmed | 2.6 | Tactical | 0.92 |
| High ∧ Surplus ∧ Quiet ∧ Safe | 4.0 | Overwhelming | 0.84 |
| High ∧ Surplus ∧ Loud ∧ Safe | 5.8 | Overwhelming | 1.00 |

Note how the same "strong & loaded & quiet" player flips from *Overwhelming* to *Tactical* purely
because enemies are already on top of them — that is the new input doing its job.

## 5. Knock-on effects in the director (`js/mechanics.js`)

Beyond the engine itself, the Threat number is now applied in a situation-aware way:

- **Spawn position:** Threat < 33 → spawn at the edge *farthest* from the player (breathing room);
  33–60 → random edge; > 60 → ring-surround centred on the player.
- **Enemy archetypes:** *runners* (fast, fragile) become likely when the player's Noise is Loud —
  they heard you; *brutes* (slow, tanky, hard-hitting) only appear when the director is genuinely
  pushing (Threat > 50); *grunts* are the baseline.
- **Warm-up grace:** for the first 10 seconds after deploy, the effective Threat used by the
  spawner is capped at 40 so every run starts readable.

## 6. Other changes shipped alongside (changelog)

- **Player/enemy differentiation** — player is an armored humanoid with helmet, visor, antenna light
  and a pulsing cyan ground-ring; enemies are now spiked organic creatures with glowing eyes, in
  three visually distinct archetypes (`js/render.js`).
- **Combat economy** — bullet damage 10 → **25**; drop rate 0.2 → **0.35**; drops biased toward ammo
  (55 %), **guaranteed ammo** when the player's total ammo falls below 25 %; ammo pickup 24 → **36**
  (reserve capped at 240); score now varies by archetype (10/15/25).
- **God mode (demo testing)** — toggle on the setup screen or with **G** in-game: infinite HP and
  ammo, "BLOCKED" feedback instead of damage, ⚡ badge on the HUD, ∞ readouts on the vitals bars.
- **UI consistency pass** — one shared palette object (`UI` in `js/render.js`) used by every panel,
  bar, button and gauge; gradient panels with hairline borders and title dividers; all buttons share
  hover states; rounded pill bars; four equal MF graphs (Pressure added); rules panel re-laid-out
  for 4-antecedent rules.

## 7. Documentation note

`Section3_Fuzzy_Logic_Walkthrough.md` describes the v1 engine (11 rules, 3 inputs) and its worked
example; treat it as the "before" snapshot that this report extends. The pipeline mechanics it
explains (fuzzification → min → max → centroid) are unchanged in v2.

---

# v3 Addendum — Exposure input & the 243-rule base (2026-06-11)

The maze/vision update added a **5th fuzzy input, EXPOSURE** (how *detected* the player is),
and regenerated the complete rule grid: 3 terms ^ 5 inputs = **243 rules** (+162 over v2's 81;
+232 over the original 11).

**Exposure crisp value (`G.detect`):** any enemy with line-of-sight (blocked by maze walls
and fog) ramps it +9/frame toward 100; it decays -0.5/frame normally and **-2.5/frame inside
fog** (hiding resets aggression in about a second); loud noise sets a "suspicious" floor of 65.
Membership: Hidden trapL(15,40) / Suspicious tri(30,55,80) / Spotted trapR(65,90).

**v3 scoring policy** (exposure dominates):

    score = 0.55*(health + ammo) + 0.8*noise - 0.6*pressure + 1.7*exposure
    bands: score <= 2.3 Passive | <= 4.6 Tactical | else Overwhelming

A Hidden & Quiet player caps at score 2.2 -> always Passive, regardless of capability.
A Spotted, healthy, loaded, loud player reaches 7.2 -> deep Overwhelming.

**Composition (machine-enumerated):** 90 Passive / 104 Tactical / 49 Overwhelming = 243.

**Director changes:** base horde size lowered (0.5 + aggr*4.5 per wave, was 1 + aggr*5);
when Detection < 15 the spawner ignores Threat entirely and spawns purely from Noise
(silence = a lone wanderer at most). Enemy AI is perception-driven: sight -> chase,
sound -> hunt with positional error shrinking as noise grows, neither -> wander.

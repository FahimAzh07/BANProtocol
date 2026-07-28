"use strict";
/* ----------------------------------------------------------------------------
   fuzzy.js — MISO version: 4 inputs → 1 output, 81 rules (3⁴).
   Inputs: Health, Ammo, Noise, Pressure  (each 0–100)
   Output: Threat (0–100)
   Mamdani inference with centroid defuzzification.
   Includes rule‑firing tracking and a plain‑English explanation.
   ---------------------------------------------------------------------------- */
const Fuzzy = (() => {
  // ----- Membership function helpers -----
  const tri   = (x, a, b, c) => Math.max(0, Math.min((x - a) / (b - a || 1e-9), (c - x) / (c - b || 1e-9)));
  const trapL = (x, a, b) => x <= a ? 1 : x >= b ? 0 : (b - x) / (b - a);
  const trapR = (x, a, b) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);

  // ----- 4 inputs, each with 3 linguistic terms -----
  const health   = { Low: x => trapL(x, 15, 40),   Medium: x => tri(x, 25, 50, 75),   High: x => trapR(x, 60, 85) };
  const ammo     = { Low: x => trapL(x, 10, 35),   Medium: x => tri(x, 25, 55, 80),   High: x => trapR(x, 65, 90) };
  const noise    = { Low: x => trapL(x, 15, 40),   Medium: x => tri(x, 30, 55, 80),   High: x => trapR(x, 65, 90) };
  const pressure = { Low: x => trapL(x, 20, 45),   Medium: x => tri(x, 35, 60, 85),   High: x => trapR(x, 70, 90) };

  // ----- 1 output: Threat (also Low, Medium, High) -----
  const threatSets = { Low: x => tri(x, 0, 18, 40), Medium: x => tri(x, 30, 50, 70), High: x => trapR(x, 60, 90) };

  // Map linguistic names to numeric indices (0=Low, 1=Medium, 2=High)
  const levels = {
    health:   { Low: 0, Medium: 1, High: 2 },
    ammo:     { Low: 0, Medium: 1, High: 2 },
    noise:    { Low: 0, Medium: 1, High: 2 },
    pressure: { Low: 0, Medium: 1, High: 2 }
  };

  const termNames = ['Low', 'Medium', 'High'];
  const inputNames = ['health', 'ammo', 'noise', 'pressure'];

  // ----- Generate all 81 rules (3⁴) -----
  const rules = [];
  for (const h in levels.health)
    for (const a in levels.ammo)
      for (const n in levels.noise)
        for (const p in levels.pressure) {
          const H = levels.health[h];
          const A = levels.ammo[a];
          const N = levels.noise[n];
          const P = levels.pressure[p];

          // score = (2 - H) + (2 - A) + N + P   (range 0 .. 8)
          const score = (2 - H) + (2 - A) + N + P;
          let outputTerm;
          if (score <= 3)      outputTerm = 'Low';
          else if (score <= 5) outputTerm = 'Medium';
          else                 outputTerm = 'High';

          rules.push({
            antecedents: [H, A, N, P],
            consequent: outputTerm,
            antecedentTerms: [h, a, n, p]
          });
        }

  console.log(`[Fuzzy] Generated ${rules.length} MISO rules.`);

  // ----- Rule‑firing tracking -----
  const fireCount = new Array(rules.length).fill(0);
  let inferCount = 0;

  // ----- Fuzzification -----
  function fuzzify(inputs) {
    return {
      health:   { Low: health.Low(inputs.health),   Medium: health.Medium(inputs.health),   High: health.High(inputs.health) },
      ammo:     { Low: ammo.Low(inputs.ammo),       Medium: ammo.Medium(inputs.ammo),       High: ammo.High(inputs.ammo) },
      noise:    { Low: noise.Low(inputs.noise),     Medium: noise.Medium(inputs.noise),     High: noise.High(inputs.noise) },
      pressure: { Low: pressure.Low(inputs.pressure), Medium: pressure.Medium(inputs.pressure), High: pressure.High(inputs.pressure) }
    };
  }

  // ----- Centroid defuzzification -----
  function centroid(agg) {
    let num = 0, den = 0;
    for (let x = 0; x <= 100; x += 2) {
      let mu = 0;
      for (const term of ['Low', 'Medium', 'High']) {
        const mfVal = threatSets[term](x);
        const clipped = Math.min(mfVal, agg[term]);
        if (clipped > mu) mu = clipped;
      }
      num += x * mu;
      den += mu;
    }
    return den > 0 ? num / den : 0;
  }

  // ----- Explanation -----
  function explain(fired, threat) {
    if (!fired || fired.length === 0) return 'No rule is firing — the field is empty.';
    const top = fired[0];
    const terms = top.rule.antecedentTerms || [];
    const desc = terms.map((t, i) => `${inputNames[i]} is ${t}`).join(', ');
    const band = threat > 66 ? 'OVERWHELMING' : threat > 33 ? 'TACTICAL' : 'PASSIVE';
    return `${desc} → the director goes ${band} (${Math.round(threat)}).`;
  }

  // ----- Main inference -----
  function infer(inputs, opts) {
    const track = opts && opts.track;
    const f = fuzzify(inputs);
    const agg = { Low: 0, Medium: 0, High: 0 };
    const fired = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const [Hidx, Aidx, Nidx, Pidx] = rule.antecedents;
      const degH = f.health[termNames[Hidx]];
      const degA = f.ammo[termNames[Aidx]];
      const degN = f.noise[termNames[Nidx]];
      const degP = f.pressure[termNames[Pidx]];

      const firing = Math.min(degH, degA, degN, degP);
      if (firing > 0.001) {
        const term = rule.consequent;
        if (firing > agg[term]) agg[term] = firing;
        fired.push({ rule, strength: firing });
        if (track && firing > 0.05) fireCount[i]++;
      }
    }

    if (track) inferCount++;
    fired.sort((a, b) => b.strength - a.strength);

    const crisp = centroid(agg);
    const threat = Math.round(Math.min(100, Math.max(0, crisp)));

    return {
      threat: threat,
      fired: fired.slice(0, 10),
      explain: () => explain(fired, threat),
      aggregate: agg
    };
  }

  // ----- Stub for threatAt (used by analytics overlay) -----
  function threatAt(inputs) {
    const result = infer(inputs);
    return result.threat;
  }

  // ----- Stubs for defuzzification methods (used by setup screen) -----
  function bisector(agg) {
    // Dummy stub – just returns centroid
    return centroid(agg);
  }
  function mom(agg) {
    // Dummy stub – just returns centroid
    return centroid(agg);
  }
  function defuzzMethods(agg) {
    return { centroid: centroid(agg), bisector: bisector(agg), mom: mom(agg) };
  }

  // ----- Public API (including stubs for removed properties) -----
  return {
    // Core MISO
    infer,
    health,
    ammo,
    noise,
    pressure,
    threatSets,
    rules,
    getRuleCount: () => rules.length,
    fireCount,
    resetStats: () => { fireCount.fill(0); inferCount = 0; },
    stats: () => ({ inferCount }),
    threatAt,
    centroid,
    bisector,
    mom,
    defuzzMethods,
    explain: (res) => res && res.fired ? explain(res.fired, res.threat || 0) : 'No data',

    // ----- Stubs for old API (prevents setup screen crashes) -----
    exposure: {},        // dummy – no longer used
    skill: {},           // dummy – no longer used
    supplySets: {},      // dummy – no longer used
    compoSets: {},       // dummy – no longer used
    levels: levels,      // keep for compatibility
    fuzzify: fuzzify,    // keep for compatibility
    ruleStats: { total: rules.length, Low: 27, Medium: 27, High: 27 },
    K: { Low: 19, Medium: 50, High: 84 },
    getMode: () => 'mamdani',
    setMode: (m) => {},
    // Re-export threatAt for the control surface
    threatAt
  };
})();

/* ----------------------------------------------------------------------------
   MicroFuzzy — per-enemy 27-rule controller (distance · own-health · allies →
   Flee / Hold / Swarm). Fuzzy logic at the micro scale.
   ---------------------------------------------------------------------------- */
const MicroFuzzy = (() => {
  const tri  = (x, a, b, c) => Math.max(0, Math.min((x - a) / (b - a || 1e-9), (c - x) / (c - b || 1e-9)));
  const trapL = (x, a, b) => x <= a ? 1 : x >= b ? 0 : (b - x) / (b - a);
  const trapR = (x, a, b) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  const dist   = { Close: x => trapL(x, 25, 55), Mid: x => tri(x, 30, 55, 80), Far: x => trapR(x, 60, 90) };
  const health = { Low: x => trapL(x, 20, 45),   Med: x => tri(x, 30, 55, 80), High: x => trapR(x, 65, 90) };
  const allies = { Few: x => trapL(x, 20, 45),   Some: x => tri(x, 30, 55, 80), Many: x => trapR(x, 60, 90) };
  const out    = { Flee: x => tri(x, 0, 18, 40), Hold: x => tri(x, 30, 50, 70), Swarm: x => trapR(x, 60, 90) };
  const sets = { dist, health, allies };
  const dl = { Close: 2, Mid: 1, Far: 0 }, hl = { Low: 0, Med: 1, High: 2 }, al = { Few: 0, Some: 1, Many: 2 };
  const rules = [];
  for (const d in dist) for (const h in health) for (const a in allies) {
    const s = hl[h] + al[a] + 0.4 * dl[d];
    const then = s <= 1.5 ? 'Flee' : s <= 3.0 ? 'Hold' : 'Swarm';
    rules.push({ if: [['dist', d], ['health', h], ['allies', a]], then });
  }
  function infer(inp) {
    const f = {}; for (const v in sets) { f[v] = {}; for (const t in sets[v]) f[v][t] = sets[v][t](inp[v]); }
    const agg = { Flee: 0, Hold: 0, Swarm: 0 };
    for (const r of rules) { let s = 1; for (const [v, t] of r.if) s = Math.min(s, f[v][t]); agg[r.then] = Math.max(agg[r.then], s); }
    let num = 0, den = 0;
    for (let x = 0; x <= 100; x += 4) { let mu = 0; for (const o in out) mu = Math.max(mu, Math.min(agg[o], out[o](x))); num += x * mu; den += mu; }
    return den > 0 ? num / den : 50;
  }
  return { infer, rules, sets, out };
})();

/* ----------------------------------------------------------------------------
   WeaponAdvisor — a tiny fuzzy recommender: given the nearest-enemy distance and
   how crowded you are, it suggests the best weapon (a fuzzy decision-support demo).
   ---------------------------------------------------------------------------- */
const WeaponAdvisor = (() => {
  const tri  = (x, a, b, c) => Math.max(0, Math.min((x - a) / (b - a || 1e-9), (c - x) / (c - b || 1e-9)));
  const trapL = (x, a, b) => x <= a ? 1 : x >= b ? 0 : (b - x) / (b - a);
  const trapR = (x, a, b) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  function infer(distPx, crowdN) {
    const close = trapL(distPx, 140, 320), far = trapR(distPx, 430, 780), mid = tri(distPx, 220, 420, 660);
    const pack = trapR(crowdN, 5, 11), lone = trapL(crowdN, 1, 4);
    const score = {
      shotgun: Math.min(close, Math.max(pack, 0.35)),
      bazooka: Math.min(Math.max(mid, far), pack),
      rifle: Math.max(0.4, Math.min(Math.max(mid, far), lone))
    };
    let best = 'rifle', bv = 0; for (const k in score) if (score[k] > bv) { bv = score[k]; best = k; }
    return { weapon: best, conf: bv };
  }
  return { infer };
})();
"use strict";
/* ----------------------------------------------------------------------------
   analytics.js — Phase 3 "fuzzy analytics" teaching/report overlay (toggle: C).
   Updated for MISO system: 4 inputs → 1 output, 81 rules.
   Shows:
     • a CONTROL SURFACE — Threat as a function of Noise × Pressure
     • a RULE-FIRING HEATMAP — which of the 81 rules fire most this run
     • a DEFUZZIFICATION comparison — centroid / bisector / mean-of-maxima (Sugeno removed)
     • a plain-English EXPLANATION + the crisp Threat output
     • buttons: Export CSV · Reset stats · Close
   ---------------------------------------------------------------------------- */
const anaBtns = {
  // Removed mode button (Mamdani/Sugeno toggle) – not needed for MISO.
  csv:   { x: W/2 - 168, y: H - 56, w: 150, h: 38 },
  reset: { x: W/2 - 6,   y: H - 56, w: 150, h: 38 },
  close: { x: W/2 + 156, y: H - 56, w: 150, h: 38 },
};

function _thColor(t) {
  t = Math.max(0, Math.min(1, (t || 0) / 100));
  const c = t < 0.5
    ? [95 + (255 - 95) * (t / 0.5), 170 + (175 - 170) * (t / 0.5), 255 + (80 - 255) * (t / 0.5)]
    : [255, 175 + (70 - 175) * ((t - 0.5) / 0.5), 80 + (95 - 80) * ((t - 0.5) / 0.5)];
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function computeSurface() {
  const N = 20;
  const b = G._inputs || { health: 60, ammo: 60, noise: 40, pressure: 20 };
  const grid = [];
  for (let j = 0; j < N; j++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      // Vary Noise (x) and Pressure (y); keep Health and Ammo at current values.
      const noiseVal = (i / (N - 1)) * 100;
      const pressureVal = (j / (N - 1)) * 100;
      row.push(Fuzzy.threatAt({
        health: b.health,
        ammo: b.ammo,
        noise: noiseVal,
        pressure: pressureVal
      }));
    }
    grid.push(row);
  }
  G._surface = { N, grid };
}

function exportCSV() {
  // Header matches the new csvLog format: [t, health, ammo, noise, pressure, threat]
  const head = 't,health,ammo,noise,pressure,threat\n';
  const body = G.csvLog.map(r => r.join(',')).join('\n');
  try {
    const url = URL.createObjectURL(new Blob([head + body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bans-protocol-fuzzy-log.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('CSV export failed:', e);
  }
  floater(G.player.x, G.player.y - 30, 'CSV EXPORTED (' + G.csvLog.length + ' rows)', '#7CFF9B');
}

function drawAnalytics() {
  // Background overlay
  ctx.fillStyle = 'rgba(2,6,12,0.88)';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = UI.accent;
  ctx.font = '800 30px ' + UI.display;
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#0af';
  ctx.fillText('FUZZY ANALYTICS', W / 2, 50);
  ctx.shadowBlur = 0;

  // Info line: 4 inputs → 1 output, 81 rules
  ctx.fillStyle = '#9cf';
  ctx.font = '13px Consolas';
  const modeLabel = G.directorMode ? G.directorMode.toUpperCase() : 'FUZZY';
  ctx.fillText(
    '4 inputs → 1 output · ' + Fuzzy.rules.length + ' rules · ' + modeLabel + ' director · ' +
    G.perf.avg.toFixed(1) + ' ms / ' + G.perf.entities + ' entities',
    W / 2, 72
  );

  // ----- CONTROL SURFACE (Noise × Pressure) -----
  if (!G._surface) computeSurface();
  const sx = 44, sy = 110, sw = 320, sh = 320;
  panel(sx - 12, sy - 32, sw + 24, sh + 58, 'CONTROL SURFACE  ·  Threat( Noise × Pressure )');
  const N = G._surface.N, cw = sw / N, ch = sh / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = _thColor(G._surface.grid[j][i]);
      ctx.fillRect(sx + i * cw, sy + sh - (j + 1) * ch, cw + 0.6, ch + 0.6);
    }
  }
  ctx.strokeStyle = 'rgba(150,190,230,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.fillStyle = UI.dim;
  ctx.font = '10px Consolas';
  ctx.textAlign = 'center';
  ctx.fillText('Noise →', sx + sw / 2, sy + sh + 18);
  ctx.save();
  ctx.translate(sx - 18, sy + sh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Pressure →', 0, 0);
  ctx.restore();

  // Current point on surface (based on current noise and pressure)
  const cur = G._inputs;
  if (cur && cur.noise != null && cur.pressure != null) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      sx + (cur.noise / 100) * sw,
      sy + sh - (cur.pressure / 100) * sh,
      5, 0, 7
    );
    ctx.stroke();
  }

  // ----- RULE-FIRING HEATMAP (81 rules → 9×9 grid) -----
  const hx = 410, hy = 110;
  const cols = 9, cell = 12; // 9×9 = 81
  panel(hx - 12, hy - 32, cols * cell + 24, cols * cell + 58, 'RULE-FIRING HEATMAP');
  let mxf = 1;
  for (const v of Fuzzy.fireCount) if (v > mxf) mxf = v;
  for (let i = 0; i < Fuzzy.fireCount.length; i++) {
    const c = i % cols;
    const r = (i / cols) | 0;
    const f = Fuzzy.fireCount[i] / mxf;
    ctx.fillStyle = f <= 0
      ? 'rgba(40,50,64,0.45)'
      : `rgba(${120 + 135 * f | 0},${200 - 120 * f | 0},${255 - 180 * f | 0},${0.25 + 0.72 * f})`;
    ctx.fillRect(hx + c * cell, hy + r * cell, cell - 1, cell - 1);
  }
  ctx.fillStyle = UI.dim;
  ctx.font = '10px Consolas';
  ctx.textAlign = 'left';
  ctx.fillText('brighter = fired more this run · each cell = 1 rule', hx, hy + cols * cell + 18);

  // ----- DEFUZZIFICATION COMPARISON + READOUTS -----
  const dx = 744;
  panel(dx - 12, 78, W - dx - 32, 224, 'DEFUZZIFICATION  ·  Threat');
  // Use the aggregate from the latest inference (if available)
  const agg = G.fuzzy.aggregate || { Low: 0, Medium: 0, High: 0 };
  const dm = Fuzzy.defuzzMethods(agg, Fuzzy.threatSets);
  const rows = [
    ['Centroid', dm.centroid, '#5fd0ff'],
    ['Bisector', dm.bisector, '#7CFF9B'],
    ['Mean-of-Max', dm.mom, '#ffb648']
  ];
  let yy = 112;
  for (const m of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.text;
    ctx.font = '12px Consolas';
    ctx.fillText(m[0], dx, yy + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(dx + 108, yy - 8, W - dx - 168, 12, 6);
    ctx.fill();
    ctx.fillStyle = m[2];
    roundRect(dx + 108, yy - 8, (W - dx - 168) * Math.min(1, (m[1] || 0) / 100), 12, 6);
    ctx.fill();
    ctx.fillStyle = UI.text;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(m[1] || 0), W - 44, yy + 4);
    yy += 30;
  }

  yy += 8;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Consolas';
  ctx.fillStyle = UI.accent;
  ctx.fillText('Threat  ' + Math.round(G.fuzzy.threat || 0), dx, yy + 4);

  yy += 22;
  ctx.fillStyle = UI.dim;
  ctx.font = '11px Consolas';
  ctx.textAlign = 'left';
  // Plain‑English explanation (uses new explain() from fuzzy)
  if (typeof Fuzzy.explain === 'function') {
    const explanation = Fuzzy.explain(G.fuzzy);
    if (typeof wrapText === 'function') {
      wrapText(explanation, dx, yy + 4, W - dx - 44, 14);
    } else {
      ctx.fillText(explanation, dx, yy + 4);
    }
  } else {
    ctx.fillText('No explanation available.', dx, yy + 4);
  }

  // ----- BUTTONS -----
  // Only CSV, Reset, and Close (Mode toggle removed)
  menuBtn(anaBtns.csv, '⤓ EXPORT CSV');
  menuBtn(anaBtns.reset, '↻ RESET STATS');
  menuBtn(anaBtns.close, 'CLOSE  [C]');
}

function handleAnalytics(p) {
  if (inRect(p, anaBtns.csv)) {
    exportCSV();
    if (window.Sound) Sound.ui();
    return;
  }
  if (inRect(p, anaBtns.reset)) {
    Fuzzy.resetStats();
    if (window.Sound) Sound.ui();
    return;
  }
  if (inRect(p, anaBtns.close)) {
    G.showAnalytics = false;
    if (window.Sound) Sound.ui();
    return;
  }
}
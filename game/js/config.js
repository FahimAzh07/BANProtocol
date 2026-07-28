"use strict";
/* ============================================================================
   BAN's PROTOCOL — Adaptive Horde Survival
   Pure HTML5 Canvas + JS. No HTML inputs, no external libraries.
   A fuzzy-logic engine drives enemy aggression & horde size from the player's
   live state (Health, Ammo, Noise). Gauges, graphs, buttons, sliders and the
   pseudo-3D character are ALL drawn on the canvas.

   config.js — canvas setup and global constants.
   ========================================================================== */

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 1280, H = 720;

function resize(){
  const s = Math.min(window.innerWidth/W, window.innerHeight/H);
  cv.width = W; cv.height = H;
  cv.style.width = (W*s)+'px'; cv.style.height = (H*s)+'px';
}
window.addEventListener('resize', resize); resize();

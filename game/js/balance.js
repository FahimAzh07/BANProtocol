"use strict";
/* ----------------------------------------------------------------------------
   balance.js — central tuning config. Edit these numbers to rebalance the game
   without hunting through the code. (Kept as a JS object, not a .json file, so
   it still loads when you double-click index.html — browsers block fetch() of
   local files, but a <script> works everywhere.)
   ---------------------------------------------------------------------------- */
const BALANCE = {
  enemyCap:        40,     // max simultaneous enemies on the field
  comboStep:       0.04,   // score multiplier gained per combo kill
  comboMax:        2.0,    // cap on the combo multiplier bonus (so ×3 total)
  dashCd:          48,     // base dash cooldown (frames)
  mineDmg:         40, mineRadius: 46,
  turretRange:     380, turretLife: 600,
  eliteChanceBase: 0.05,   // elite spawn chance floor (+ threat & wave scaling)
  extractBonusPerSector: 60,
  breakableChance: 0.10,   // fraction of interior walls that are destructible
};

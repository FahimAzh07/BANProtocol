"use strict";
/* ----------------------------------------------------------------------------
   main.js — the requestAnimationFrame loop. update() then draw by state.
   ---------------------------------------------------------------------------- */
function frame(){
  const frameStart=performance.now();
  if(G.hitstop>0) G.hitstop--;   // freeze-frame on big kills/explosions for punch
  else update();
  if(window.Sound) Sound.tick(G.state, G.directorThreat==null?G.fuzzy.threat:G.directorThreat);   // music, ambient, heartbeat, beat
  BEAT = (window.Sound && Sound.beat) ? Sound.beat() : 0; // music beat → beat-reactive lighting/bloom
  ctx.clearRect(0,0,W,H);
  ctx.save();
  const shakeOn = !(G.meta&&G.meta.opts) || G.meta.opts.shake;
  if(G.state==='play'&&G.shake>0.3&&shakeOn) ctx.translate((Math.random()-0.5)*G.shake,(Math.random()-0.5)*G.shake);
  if(G.state==='setup'){ drawSetup(); applyBloom(0.30+BEAT*0.22); }
  else if(G.state==='shop') drawShop();
  else if(G.state==='play'){
    if(G.meta.opts.view3d&&typeof render3D==='function'){ctx.clearRect(0,0,W,H);render3D();ctx.restore();ctx.save();drawAccessibleHUD();}
    else {drawWorld(); ctx.restore(); applyBloom(0.5+BEAT*0.28); ctx.save(); drawAccessibleHUD();}
  }
  else if(G.state==='perk') drawPerks();
  else if(G.state==='paused') drawPause();
  else if(G.state==='dead') drawDead();
  else if(G.state==='report') drawReport();   // in-game SYSTEM DOSSIER (canvas briefing)
  else if(G.state==='history'&&typeof drawRunHistory==='function')drawRunHistory();
  ctx.restore();
  if(G.state==='play' && G.showAnalytics) drawAnalytics();   // fuzzy analytics overlay [C]
  else if(G.state==='play' && G.tutorial) drawTutorial();    // first-run overlay
  if(G.showSettings) drawSettings();                         // settings on top of any screen
  if(typeof recordFramePerformance==='function')recordFramePerformance(performance.now()-frameStart);
  requestAnimationFrame(frame);
}
/* Automated browser smoke route: index.html?smoke=1 deploys a deterministic
   run and exposes a compact result in body.dataset for CI/headless checks. */
if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('smoke')){
  const qp=new URLSearchParams(location.search);G.replaySeed=5682026;G.meta.tutorialSeen=true;
  if(qp.has('view3d')){G.meta.opts.view3d=true;if(typeof set3DEnabled==='function')set3DEnabled(true);}
  reset();G.tutorial=false;G.state='play';G.spawnTimer=1;spawnWave(4);alternateFire();
  setTimeout(()=>{const seed=G.runSeed;if(saveRun()){G.state='setup';resumeSavedRun();}G._smokeSeedOk=G.runSeed===seed;},350);
  setTimeout(()=>{document.body.dataset.smoke=G.t>10&&G.objective&&G.theme&&G.enemies.length>0&&G._smokeSeedOk?'pass':'fail';
    document.body.dataset.smokeState=[G.t,G.enemies.length,G.objective&&G.objective.id,G.theme&&G.theme.id,G.directorMode,G._smokeSeedOk].join(',');},1200);
}
frame();

"use strict";
/* ----------------------------------------------------------------------------
   state.js — GAME STATE & SETTINGS
   G is the single source of truth for everything mutable in the game.
   ---------------------------------------------------------------------------- */
const G = {
  state:'setup',          // setup | shop | play | paused | dead | report
  reportScroll:0,_reportMax:0,   // in-game SYSTEM DOSSIER scroll position
  t:0,
  player:{x:W/2,y:H/2,r:16,hp:100,maxhp:100,speed:3.0,angle:0,recoil:0,walk:0,muzzle:0,
          dash:0,dashCd:0,iframes:0,melee:0,meleeCd:0,dashX:0,dashY:0},
  ammo:24,maxAmmo:24,reserve:120,reloading:0,
  weapon:'rifle',mags:{},runCoins:0,reserveCap:240,
  power:{shield:0,rapid:0,double:0,speed:0,freeze:0},
  noise:0,detect:0,flash:0,hurt:0,pitch:0,
  cam:{x:0,y:0},
  bullets:[],enemies:[],particles:[],pickups:[],floaters:[],
  eBullets:[],combo:0,comboTimer:0,comboBest:0,hitDir:0,hitDirT:0,bossPing:0,
  run:{dmgMul:1,reloadMul:1,dashCdMul:1,coinMul:1,moveMul:1,pierce:0,meleeLife:0,thorns:0,maxHp:0,magnet:0,turret:false},
  perks:[],perkChoices:null,sectorMod:null,
  mines:[],turrets:[],barrels:[],extract:null,achToasts:[],
  mineCd:0,turretCd:0,sectorDmg:0,awaitPerk:false,daily:false,
  showSettings:false,tutorial:false,weather:null,flicker:0,gibs:[],
  rings:[],lights:[],hitstop:0,
  sector:1,roomChangeTimer:0,scorch:[],bloodPools:[],
  waveBanner:null,newRecord:false,
  spawnTimer:90,score:0,kills:0,wave:1,
  fuzzy:{threat:25,supply:50,compo:50,aggregate:{},supplyAgg:{},compoAgg:{},fuzzified:{},fired:[]},
  fuzzyTimer:0,shake:0,
  skill:50,shotsFired:0,shotsHit:0,csvLog:[],showAnalytics:false,advisor:null,
  showRules:false,showGraphs:false,
  showDashboard:false,  // <-- NEW: Toggle Logic Dashboard with Tab key
  _inputs:{health:100,ammo:100,noise:0,pressure:0},
  settings:{ pace:0.6, density:1.0, toughness:1.2, god:false },   // set on the setup screen
};

function reset(){
  G.runSeed=typeof makeRunSeed==='function'?makeRunSeed():(G.daily?dailySeed():(Date.now()>>>0));
  setWorldSeed(G.runSeed);                 // every run is replayable and deterministic
  // fresh per-run roguelite state (perks, deployables, modifiers)
  G.run={dmgMul:1,reloadMul:1,dashCdMul:1,coinMul:1,moveMul:1,pierce:0,meleeLife:0,thorns:0,maxHp:0,magnet:0,turret:false};
  G.perks=[];G.perkChoices=null;G.mines=[];G.turrets=[];G.barrels=[];G.extract=null;G.achToasts=[];
  G.mineCd=0;G.turretCd=0;G.sectorDmg=0;G.awaitPerk=false;
  G.weather=null;G.flicker=0;G.gibs=[];G.tutorial=!G.meta.tutorialSeen;   // first-run tutorial
  G.sector=1;
  if(typeof rollSectorTheme==='function')G.theme=rollSectorTheme();
  genWorld();                       // new maze + fog layout every deploy
  const sp=spawnPlayerPos();
  Object.assign(G.player,{x:sp.x,y:sp.y,hp:100,recoil:0,walk:0,muzzle:0,angle:0,
    dash:0,dashCd:0,iframes:0,melee:0,meleeCd:0});
  G.reserve=120; G.reloading=0; G.noise=0; G.detect=0; G.flash=0; G.hurt=0; G.pitch=0;
  G.bullets=[];G.enemies=[];G.particles=[];G.pickups=[];G.floaters=[];
  G.eBullets=[];G.combo=0;G.comboTimer=0;G.hitDir=0;G.hitDirT=0;G.bossPing=0;
  G.rings=[];G.lights=[];G.hitstop=0;G.waveBanner=null;G.newRecord=false;
  G.sector=1;G.roomChangeTimer=0;G.scorch=[];G.bloodPools=[];
  G.score=0;G.kills=0;G.wave=1;G.spawnTimer=150;G.t=0;
  G.skill=50;G.shotsFired=0;G.shotsHit=0;G.csvLog=[];G.advisor=null;
  if(typeof Fuzzy!=='undefined') Fuzzy.resetStats();   // clear the rule-firing heatmap each run
  announceWave(1);                  // opening "WAVE 1" banner on deploy
  G.fuzzy={threat:25,supply:50,compo:50,aggregate:{},supplyAgg:{},compoAgg:{},fuzzified:{},fired:[]};
  G._inputs={health:100,ammo:100,noise:0,pressure:0,exposure:0};
  G.showDashboard=false;  // <-- NEW: Reset dashboard state on new run
  G.cam.x=Math.max(0,Math.min(WORLD_W-W,sp.x-W/2));
  G.cam.y=Math.max(0,Math.min(WORLD_H-H,sp.y-H/2));
  initLoadout();   // weapons.js: equipped weapon, mags, upgrades, power timers
  if(typeof beginAdvancedRun==='function')beginAdvancedRun();
  startSector();   // roguelite.js: roll sector modifier, scatter barrels, place beacon
  if(typeof build3DWorld==='function') build3DWorld();   // rebuild the 3D maze
}
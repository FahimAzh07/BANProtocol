"use strict";
/* ----------------------------------------------------------------------------
   weapons.js — weapon definitions, levelling, power-ups, and the persistent
   meta-progression (coins + unlocks survive death via localStorage).
   ---------------------------------------------------------------------------- */
const WEAPONS={
  rifle:  {name:'RIFLE',   cost:0,   dmg:25, cd:8,  pellets:1, spread:0.05, bspeed:11,  range:70, mag:24, reloadSpd:0.020, noise:12, kick:6,
           blurb:'Accurate all-rounder', upCost:[120,240,420,650]},
  shotgun:{name:'SHOTGUN', cost:350, dmg:13, cd:30, pellets:6, spread:0.42, bspeed:10,  range:26, mag:8,  reloadSpd:0.014, noise:22, kick:10,
           blurb:'6-pellet close-range burst', upCost:[160,300,500,750]},
  bazooka:{name:'BAZOOKA', cost:900, dmg:55, cd:60, pellets:1, spread:0.02, bspeed:7.5, range:90, mag:3,  reloadSpd:0.008, noise:32, kick:12,
           blurb:'Explosive area damage', explosive:true, blast:95, upCost:[250,450,700,999]},
};

const POWERUPS={
  shield:{dur:600,col:'#5fd0ff',label:'SHIELD',      icon:'◉'},  // 10 s invulnerable
  rapid: {dur:480,col:'#ffd36b',label:'RAPID FIRE',  icon:'R'},  // 8 s half fire cooldown
  double:{dur:480,col:'#ff7b4d',label:'2× DAMAGE',   icon:'2'},  // 8 s double damage
  speed: {dur:480,col:'#7CFF9B',label:'SPEED',       icon:'»'},  // 8 s +60% move speed
  freeze:{dur:300,col:'#9bdcff',label:'FREEZE',      icon:'❄'},  // 5 s enemies stop
  nuke:  {dur:0,  col:'#ffffff',label:'INSTANT KILL',icon:'☠'},  // kills all on screen
};

/* permanent operative upgrades, bought with coins in the ARMORY */
const PLAYER_UPS={
  speed: {name:'MOVE SPEED', desc:'+8% per level',          cost:[100,200,350,550]},
  health:{name:'MAX HEALTH', desc:'+25 HP per level',       cost:[120,240,400,600]},
  ammo:  {name:'AMMO STOCK', desc:'+30 reserve per level',  cost:[100,200,340,520]},
  power: {name:'POWER-UPS',  desc:'+15% duration per level',cost:[140,280,450,680]},
};
/* effective power-up duration at the player's POWER-UPS level */
function powDur(def){ return Math.round(def.dur*(1+0.15*(G.meta.player.power-1))); }

/* persistent meta — coins & weapon unlocks survive death */
const META_KEY='bansProtocolMeta_v1';
function loadMeta(){
  let m=null;
  try{ m=JSON.parse(localStorage.getItem(META_KEY)); }catch(e){}
  if(!m||!m.weapons||!m.weapons.rifle)
    m={coins:0, equipped:'rifle',
       weapons:{rifle:{owned:true,lvl:1}, shotgun:{owned:false,lvl:1}, bazooka:{owned:false,lvl:1}}};
  if(!m.player) m.player={speed:1,health:1,ammo:1,power:1};   // migrate older saves
  if(m.bestWave==null)  m.bestWave=0;                         // persistent records
  if(m.bestScore==null) m.bestScore=0;
  if(!m.ach) m.ach={};                                        // unlocked achievements
  if(!m.opts) m.opts={master:0.5,music:0.5,sfx:0.6,shake:true,motion:true};   // settings
  if(m.tutorialSeen==null) m.tutorialSeen=false;
  return m;
}
function saveMeta(){ try{ localStorage.setItem(META_KEY,JSON.stringify(G.meta)); }catch(e){} }
G.meta=loadMeta();

/* current stats of a weapon at its owned level (+25% dmg per level) */
function wstats(key){
  const w=WEAPONS[key], lvl=G.meta.weapons[key].lvl;
  const out=Object.assign({},w,{lvl, dmg:Math.round(w.dmg*(1+0.25*(lvl-1)))});
  return typeof applyWeaponModule==='function'?applyWeaponModule(key,out):out;
}

function initLoadout(){
  G.weapon=(G.meta.weapons[G.meta.equipped]&&G.meta.weapons[G.meta.equipped].owned)?G.meta.equipped:'rifle';
  G.mags={}; for(const k in WEAPONS) G.mags[k]=WEAPONS[k].mag;
  G.ammo=G.mags[G.weapon]; G.maxAmmo=WEAPONS[G.weapon].mag;
  G.power={shield:0,rapid:0,double:0,speed:0,freeze:0};
  G.runCoins=0;
  // apply permanent operative upgrades
  const pu=G.meta.player;
  G.player.maxhp=100+25*(pu.health-1); G.player.hp=G.player.maxhp;
  G.player.speed=3.0*(1+0.08*(pu.speed-1));
  G.reserve=120+30*(pu.ammo-1);
  G.reserveCap=240+40*(pu.ammo-1);
}

function switchWeapon(key){
  if(G.state!=='play'||key===G.weapon||!WEAPONS[key]) return;
  if(!G.meta.weapons[key].owned){
    floater(G.player.x,G.player.y-30,'LOCKED · buy in ARMORY','#ff5470'); return; }
  G.mags[G.weapon]=G.ammo;
  G.weapon=key; G.meta.equipped=key;
  G.ammo=G.mags[key]; G.maxAmmo=WEAPONS[key].mag;
  G.reloading=0; fireCd=Math.max(fireCd,10);
  floater(G.player.x,G.player.y-30,WEAPONS[key].name,'#5fd0ff');
}

function cycleWeapon(){                 // Q: next owned weapon
  const owned=['rifle','shotgun','bazooka'].filter(k=>G.meta.weapons[k].owned);
  if(owned.length<2) return;
  switchWeapon(owned[(owned.indexOf(G.weapon)+1)%owned.length]);
}

function dropPowerup(x,y){
  const kinds=Object.keys(POWERUPS);
  const kind=kinds[(rand()*kinds.length)|0];   // randomized power-up
  G.pickups.push({x,y,type:'power',kind,r:11,bob:rand()*6});
}

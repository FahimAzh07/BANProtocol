"use strict";
/* ----------------------------------------------------------------------------
   roguelite.js — Phase 2 "roguelite variety":
     • between-sector PERKS (pick 1 of 3 after every boss)
     • per-sector MODIFIERS (random rule each sector)
     • DEPLOYABLES — proximity mine [E] + fuzzy auto-turret [T]
     • exploding BARRELS + destructible walls (carved by blasts, see explode())
     • an EXTRACTION beacon objective (reach it for a bonus)
     • persistent ACHIEVEMENTS with toasts
   Applied through G.run (per-run modifiers) + G.meta (persistent).
   ---------------------------------------------------------------------------- */

/* ---------------- PERKS (per-run, chosen 3-at-a-time after each boss) -------- */
const PERKS=[
  {id:'dmg',    name:'HOLLOW-POINT',     desc:'+25% weapon damage',        apply:()=>G.run.dmgMul*=1.25},
  {id:'hp',     name:'NANO-WEAVE',       desc:'+30 max HP (healed now)',   apply:()=>{G.run.maxHp+=30;G.player.maxhp+=30;G.player.hp+=30;}},
  {id:'reload', name:'FAST HANDS',       desc:'+35% reload speed',         apply:()=>G.run.reloadMul*=1.35},
  {id:'dash',   name:'KINETIC BOOTS',    desc:'−35% dash cooldown',   apply:()=>G.run.dashCdMul*=0.65},
  {id:'pierce', name:'RAILGUN ROUNDS',   desc:'bullets pierce +1 enemy',   apply:()=>G.run.pierce+=1},
  {id:'life',   name:'VAMPIRE EDGE',     desc:'melee kills heal +8 HP',    apply:()=>G.run.meleeLife+=8},
  {id:'thorns', name:'REACTIVE PLATING', desc:'attackers take 8 damage',   apply:()=>G.run.thorns+=8},
  {id:'coin',   name:'PROSPECTOR',       desc:'+40% coins',                apply:()=>G.run.coinMul*=1.4},
  {id:'magnet', name:'MAGNETIC FIELD',   desc:'auto-collect nearby drops', apply:()=>G.run.magnet=Math.max(G.run.magnet,150)},
  {id:'move',   name:'ADRENALINE',       desc:'+12% move speed',           apply:()=>G.run.moveMul*=1.12},
  {id:'ammo',   name:'BANDOLIER',        desc:'+60 reserve ammo',          apply:()=>{G.reserveCap+=60;G.reserve=Math.min(G.reserveCap,G.reserve+60);}},
  {id:'turret', name:'SENTRY UPLINK',    desc:'unlock deploy turret [T]',  once:true, apply:()=>G.run.turret=true},
];
function rollPerks(){
  const pool=PERKS.filter(p=>!(p.once && G.perks.includes(p.id)));
  const pick=[];
  while(pick.length<3 && pool.length) pick.push(pool.splice((rand()*pool.length)|0,1)[0]);
  G.perkChoices=pick;
}
function choosePerk(i){
  const p=G.perkChoices && G.perkChoices[i]; if(!p) return;
  p.apply(); G.perks.push(p.id);
  if(G.perks.length>=5) unlockAch('loadout');
  G.perkChoices=null; G.state='play';
  if(window.Sound) Sound.powerup();
}

/* ---------------- SECTOR MODIFIERS (a random rule for each sector) ----------- */
const SECTOR_MODS=[
  {id:'none',    name:'STANDARD',    col:'#8fa9c4'},
  {id:'fog',     name:'DENSE FOG',   col:'#9bb'},
  {id:'runners', name:'RUNNER PACK', col:'#ffb648'},
  {id:'rich',    name:'GOLD RUSH',   col:'#ffd36b'},
  {id:'swift',   name:'OVERCLOCKED', col:'#ff4d6d'},
  {id:'bounty',  name:'SUPPLY DROP', col:'#7CFF9B'},
];
function rollSectorMod(){
  G.sectorMod = G.sector<=1 ? SECTOR_MODS[0]
              : SECTOR_MODS[1 + ((rand()*(SECTOR_MODS.length-1))|0)];
}
function modIs(id){ return G.sectorMod && G.sectorMod.id===id; }

/* start-of-sector setup: roll modifier, scatter barrels, place the beacon */
function startSector(){
  rollSectorMod();
  G.weather = modIs('fog')?'embers' : ['none','none','embers','rain','flicker'][(rand()*5)|0];
  placeBarrels(4 + (modIs('bounty')?3:0) + ((rand()*3)|0));
  placeExtract();
  G.sectorDmg=0;
  if(modIs('fog')) for(let i=0;i<6;i++){ const t=randomOpenTile(); fogs.push({x:t.x,y:t.y,r:130+rand()*70}); }
  if(typeof setupThemedWorld==='function')setupThemedWorld();
  if(typeof startObjective==='function')startObjective();
  if(typeof rebuildMinimap==='function')rebuildMinimap();
}

/* ---------------- ACHIEVEMENTS (persistent, toast on unlock) ----------------- */
const ACHIEVEMENTS={
  firstblood:{name:'First Blood',    desc:'Get your first kill'},
  slayer:    {name:'Giant Slayer',   desc:'Defeat a Juggernaut'},
  ghost:     {name:'Ghost',          desc:'5 stealth takedowns in a run'},
  combo20:   {name:'Unstoppable',    desc:'Reach a ×20 combo'},
  deep:      {name:'Deep Diver',     desc:'Reach Sector 3'},
  labyrinth: {name:'Labyrinth Lord', desc:'Reach Sector 5'},
  exterm:    {name:'Exterminator',   desc:'100 kills in one run'},
  untouch:   {name:'Untouchable',    desc:'Clear a sector taking no damage'},
  tycoon:    {name:'Tycoon',         desc:'Bank 1000 total coins'},
  engineer:  {name:'Engineer',       desc:'Deploy a turret'},
  loadout:   {name:'Loadout',        desc:'Take 5 perks in one run'},
};
function unlockAch(id){
  if(!ACHIEVEMENTS[id] || (G.meta.ach && G.meta.ach[id])) return;
  if(!G.meta.ach) G.meta.ach={};
  G.meta.ach[id]=1; saveMeta();
  G.achToasts.push({name:ACHIEVEMENTS[id].name, desc:ACHIEVEMENTS[id].desc, life:200});
  if(window.Sound) Sound.powerup();
}

/* ---------------- DEPLOYABLES: proximity mine [E] + fuzzy turret [T] --------- */
function deployMine(){
  if(G.state!=='play'||G.mineCd>0||G.mines.length>=4) return;
  G.mines.push({x:G.player.x,y:G.player.y,arm:26,pulse:0}); G.mineCd=45;
  if(window.Sound) Sound.ui();
}
function deployTurret(){
  if(G.state!=='play'||!G.run.turret||G.turretCd>0||G.turrets.length>=2) return;
  G.turrets.push({x:G.player.x,y:G.player.y,life:600,cd:0,ang:G.player.angle}); G.turretCd=180;
  unlockAch('engineer'); if(window.Sound) Sound.ui();
}

/* ---------------- placement helpers ----------------------------------------- */
function placeBarrels(n){ G.barrels=[];
  for(let i=0;i<n;i++){ const t=randomOpenTile(); G.barrels.push({x:t.x,y:t.y,r:13}); } }
function placeExtract(){ const t=openTileNear(G.player.x,G.player.y,700,1600);
  G.extract={x:t.x,y:t.y,r:26,done:false}; }
function detonateBarrel(b){ b.dead=true; explode(b.x,b.y,110,26);
  const dd=Math.hypot(G.player.x-b.x,G.player.y-b.y);
  if(dd<110) hurtPlayer(26*(1-dd/110), b.x, b.y); }

/* ---------------- per-frame update for all Phase-2 entities ------------------ */
function updateRoguelite(){
  const p=G.player;
  if(G.mineCd>0)G.mineCd--; if(G.turretCd>0)G.turretCd--;
  for(const a of G.achToasts) a.life--; G.achToasts=G.achToasts.filter(a=>a.life>0);
  if(G.meta.coins>=1000) unlockAch('tycoon');

  // magnet: draw nearby pickups toward the player
  if(G.run.magnet>0) for(const k of G.pickups){ const d=Math.hypot(p.x-k.x,p.y-k.y);
    if(d<G.run.magnet && d>1){ k.x+=(p.x-k.x)/d*3.2; k.y+=(p.y-k.y)/d*3.2; } }

  // proximity mines: arm, then detonate when an enemy comes close
  for(const m of G.mines){ if(m.arm>0){m.arm--;continue;} m.pulse++;
    for(const e of G.enemies){ if(Math.hypot(e.x-m.x,e.y-m.y)<46){ explode(m.x,m.y,100,40); m.dead=true; break; } } }
  G.mines=G.mines.filter(m=>!m.dead);

  // fuzzy auto-turrets: live timer + auto-fire (closer target ⇒ faster cadence)
  for(const tr of G.turrets){ tr.life--; if(tr.cd>0)tr.cd--;
    let best=null,bd=380;
    for(const e of G.enemies){ const d=Math.hypot(e.x-tr.x,e.y-tr.y);
      if(d<bd && los(tr.x,tr.y,e.x,e.y)){bd=d;best=e;} }
    if(best){ tr.ang=Math.atan2(best.y-tr.y,best.x-tr.x);
      if(tr.cd<=0){ tr.cd=Math.round(6+(bd/380)*10);
        G.bullets.push({x:tr.x+Math.cos(tr.ang)*16,y:tr.y+Math.sin(tr.ang)*16,
          vx:Math.cos(tr.ang)*12,vy:Math.sin(tr.ang)*12,life:60,r:2.4,
          dmg:14*G.run.dmgMul,explosive:false,blast:0,pierce:0}); } } }
  G.turrets=G.turrets.filter(tr=>tr.life>0);

  // extraction beacon: reach it for a coin bonus + a power-up
  if(G.extract && !G.extract.done && Math.hypot(p.x-G.extract.x,p.y-G.extract.y)<G.extract.r+p.r){
    G.extract.done=true; const bonus=60*G.sector;
    G.meta.coins+=bonus; G.runCoins+=bonus; saveMeta();
    floater(p.x,p.y-30,'EXTRACTION +'+bonus+'¢','#7CFF9B'); dropPowerup(p.x,p.y);
    if(window.Sound) Sound.powerup();
  }
}

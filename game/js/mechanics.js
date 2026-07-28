"use strict";
/* ----------------------------------------------------------------------------
   mechanics.js — GAMEPLAY: shooting, explosions, power-ups, coins, the
   vision/hearing enemy AI, situation-aware spawning, and the update loop.
   Enemies only know where you are if they SEE you (line of sight, blocked by
   maze walls and fog). Otherwise they hunt the noise you make — or wander.
   ---------------------------------------------------------------------------- */
/* transient visual juice — additive light flashes & expanding shockwave rings */
function pushLight(x,y,r,rgb,life){ G.lights.push({x,y,r,rgb,life,max:life}); }
function ring(x,y,rgb,maxr){ G.rings.push({x,y,r:8,maxr,spd:(maxr-8)/14,life:14,max:14,rgb}); }
/* persistent floor decals — scorch from blasts (capped) and blood pools (fade) */
function scorch(x,y,r){ G.scorch.push({x,y,r}); if(G.scorch.length>48) G.scorch.shift(); }
function bloodPool(x,y,r){ G.bloodPools.push({x,y,r,life:480}); if(G.bloodPools.length>60) G.bloodPools.shift(); }

/* enemy projectiles (spitters + boss bursts) */
function enemyShoot(e,ang,speed,dmg,col){
  G.eBullets.push({x:e.x+Math.cos(ang)*e.r,y:e.y+Math.sin(ang)*e.r,
    vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life:150,r:5,dmg,col:col||'#b46bff'});
}

/* player death — banks coins + records once (called from every damage source) */
function playerDies(){
  G.player.hp=0; G.state='dead';
  G.newRecord = (G.wave>G.meta.bestWave)||(G.score>G.meta.bestScore);
  if(G.wave>G.meta.bestWave)  G.meta.bestWave=G.wave;
  if(G.score>G.meta.bestScore)G.meta.bestScore=G.score;
  if(typeof finalizeRun==='function')finalizeRun('overrun');
  saveMeta();
}
/* apply a hit to the player, honouring god / shield / dash i-frames */
function hurtPlayer(dmg,srcX,srcY){
  const p=G.player;
  if(G.settings.god||G.power.shield>0||p.iframes>0){
    if(G.power.shield>0) floater(p.x,p.y-20,'BLOCKED','#5fd0ff'); return; }
  dmg/=G.settings.toughness;
  p.hp-=dmg; blood(p.x,p.y); G.hurt=14; G.sectorDmg=(G.sectorDmg||0)+dmg;
  floater(p.x,p.y-20,'-'+Math.round(dmg),'#ff5470');
  G.shake=Math.min(10,G.shake+3);
  G.hitDir=Math.atan2(srcY-p.y,srcX-p.x); G.hitDirT=32;   // damage-direction indicator
  if(window.Sound) Sound.hurt();
  if(p.hp<=0) playerDies();
}

/* DASH — a short i-frame dodge (Shift); melee KNIFE (F / right-click) with a
   silent STEALTH TAKEDOWN on unaware (wandering) enemies. */
function dash(){
  const p=G.player;
  if(G.state!=='play'||p.dash>0||p.dashCd>0) return;
  let mx=0,my=0;
  if((typeof actionDown==='function'&&actionDown('up'))||keys['arrowup'])my--;
  if((typeof actionDown==='function'&&actionDown('down'))||keys['arrowdown'])my++;
  if((typeof actionDown==='function'&&actionDown('left'))||keys['arrowleft'])mx--;
  if((typeof actionDown==='function'&&actionDown('right'))||keys['arrowright'])mx++;
  if(!mx&&!my){ mx=Math.cos(p.angle); my=Math.sin(p.angle); }   // no input → dash toward aim
  const l=Math.hypot(mx,my)||1; p.dashX=mx/l; p.dashY=my/l;
  p.dash=10; p.iframes=13; p.dashCd=Math.round(48*G.run.dashCdMul); G.noise=Math.min(100,G.noise+3);
  if(window.Sound) Sound.dash();
}
function melee(){
  const p=G.player;
  if(G.state!=='play'||p.melee>0||p.meleeCd>0) return;
  p.melee=12; p.meleeCd=28;
  const reach=54, ang=p.angle; let silent=false;
  for(const e of G.enemies){
    if(e.dead||e.boss) continue;
    const dx=e.x-p.x, dy=e.y-p.y, d=Math.hypot(dx,dy);
    if(d>reach+e.r) continue;
    let da=Math.abs(((Math.atan2(dy,dx)-ang+Math.PI*3)%(Math.PI*2))-Math.PI);
    if(da>1.1) continue;                                   // ~125° arc in front only
    if(e.mode==='wander'){ hitEnemy(e,e.hp+e.maxhp+999); floater(e.x,e.y-20,'SILENT','#a0ffd0'); silent=true;
      G.run.stealth=(G.run.stealth||0)+1; if(G.run.stealth>=5) unlockAch('ghost'); }
    else hitEnemy(e,34,Math.cos(ang)*7,Math.sin(ang)*7);   // normal swing + knockback
    if(e.dead && G.run.meleeLife) p.hp=Math.min(p.maxhp,p.hp+G.run.meleeLife);   // lifesteal perk
  }
  if(!silent) G.noise=Math.min(100,G.noise+6);
  if(window.Sound) Sound.melee();
}

/* ROOM REGENERATION — after each boss is cleared the maze reshuffles into a new
   sector, keeping the player's stats/loadout but randomising the whole layout.
   Runs at the dark midpoint of the fade transition so the swap is unseen. */
function regenerateRoom(){
  if(G.sectorDmg===0) unlockAch('untouch');        // cleared the previous sector unscathed
  G.sector++;
  if(G.sector>=3) unlockAch('deep'); if(G.sector>=5) unlockAch('labyrinth');
  if(typeof rollSectorTheme==='function')G.theme=rollSectorTheme();
  genWorld();                                   // new maze + fog + minimap
  const sp=spawnPlayerPos();
  G.player.x=sp.x; G.player.y=sp.y; G.player.recoil=0; G.player.muzzle=0;
  G.enemies=[]; G.bullets=[]; G.eBullets=[]; G.pickups=[]; G.particles=[];
  G.rings=[]; G.lights=[]; G.scorch=[]; G.bloodPools=[]; G.combo=0; G.comboTimer=0;
  G.mines=[]; G.turrets=[];
  G.noise=0; G.detect=0; G.shake=0; G.spawnTimer=130;
  G.cam.x=Math.max(0,Math.min(WORLD_W-W,sp.x-W/2));
  G.cam.y=Math.max(0,Math.min(WORLD_H-H,sp.y-H/2));
  startSector();                                // roll modifier, scatter barrels, place beacon
  const mn = G.sectorMod && G.sectorMod.id!=='none' ? '◈ '+G.sectorMod.name : 'the maze has reconfigured';
  G.waveBanner={text:'SECTOR '+G.sector, sub:mn, life:150, max:150, col:G.sectorMod?G.sectorMod.col:'#7CFF9B', boss:false};
  if(typeof build3DWorld==='function') build3DWorld();
}

function reload(){
  if(G.state!=='play'||G.reloading>0||G.ammo===G.maxAmmo||G.reserve<=0) return;
  G.reloading=0.02;
  if(window.Sound) Sound.reload();
}

let fireCd=0;
function shoot(){
  if(G.state!=='play'||G.reloading>0||fireCd>0) return;
  const w=wstats(G.weapon);
  if(G.ammo<=0&&!G.settings.god){ reload(); return; }
  fireCd=Math.round(w.cd*(G.power.rapid>0?0.5:1));
  if(!G.settings.god) G.ammo--;
  const dmg=w.dmg*(G.power.double>0?2:1)*G.run.dmgMul;
  const a=G.player.angle;
  for(let i=0;i<w.pellets;i++){
    const sp=(rand()-0.5)*w.spread;
    G.bullets.push({x:G.player.x+Math.cos(a)*22,y:G.player.y+Math.sin(a)*22,
      vx:Math.cos(a+sp)*w.bspeed,vy:Math.sin(a+sp)*w.bspeed,
      life:w.range,r:w.explosive?5:(w.pellets>1?2.2:3),
      dmg,explosive:!!w.explosive,blast:w.blast||0,pierce:G.run.pierce,hitCd:0,status:w.status||null});
  }
  G.player.recoil=w.kick; G.player.muzzle=4; G.shotsFired++;   // for the adaptive-skill estimate
  G.noise=Math.min(100,G.noise+w.noise);   // gunfire is what the horde hears
  G.shake=Math.min(8,G.shake+w.kick*0.5);
  for(let i=0;i<4;i++) G.particles.push(spark(G.player.x+Math.cos(a)*24,G.player.y+Math.sin(a)*24,a,'#ffd36b'));
  pushLight(G.player.x+Math.cos(a)*26,G.player.y+Math.sin(a)*26, 95, [255,210,120], 6);  // muzzle flash lights the maze
  if(window.Sound) Sound.shot(G.weapon);
}

function spark(x,y,a,col){ const s=rand()*3+1,ang=a+(rand()-0.5);
  return {x,y,vx:Math.cos(ang)*s,vy:Math.sin(ang)*s,life:18+rand()*10,r:rand()*2+1,col}; }
function blood(x,y){ for(let i=0;i<10;i++){const a=rand()*7,s=rand()*3+1;
  G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:20+rand()*15,r:rand()*2.5+1,col:'#c0263b'});} }
function floater(x,y,txt,col){ G.floaters.push({x:x+(rand()-0.5)*22,y,txt,col,life:50}); }
/* death variety — flying gib chunks that spin, tumble and fade */
function spawnGibs(x,y,col,n){ for(let i=0;i<n;i++){ const a=rand()*7,s=rand()*4+1.5;
  G.gibs.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,rot:rand()*7,vr:(rand()-0.5)*0.5,
    life:26+rand()*20,size:2+rand()*3,col}); } }

/* shared kill/damage handling — bullets, explosions and nukes land here */
function hitEnemy(e,dmg,kx,ky){
  if(e.dead) return;
  if(e.dmgResist) dmg*=e.dmgResist;                     // shielded elite soaks damage
  e.hp-=dmg; blood(e.x,e.y);
  if(kx)e.x+=kx; if(ky)e.y+=ky;
  if(e.hp<=0){
    e.dead=true; G.kills++;
    if(G.kills===1) unlockAch('firstblood'); if(G.kills>=100) unlockAch('exterm');
    G.combo++; if(G.combo>G.comboBest)G.comboBest=G.combo; G.comboTimer=150;   // killstreak
    if(G.combo>=20) unlockAch('combo20');
    if(G.combo%5===0 && window.Sound) Sound.powerup();
    G.score += Math.round(e.pts * (1 + Math.min(BALANCE.comboMax, G.combo*BALANCE.comboStep)));   // combo multiplier
    if(e.elite==='volatile'){                            // exploding elite hurts nearby foes AND the player
      explode(e.x,e.y,80,14);
      const dd=Math.hypot(G.player.x-e.x,G.player.y-e.y);
      if(dd<80) hurtPlayer(14*(1-dd/80), e.x, e.y);
    }
    let coins=(e.type==='boss'?120:e.type==='brute'?15:e.type==='runner'?8:5)*(e.elite?2:1);
    coins=Math.round(coins*G.run.coinMul*(modIs('rich')?2:1));                 // coin perk + Gold-Rush sector
    G.meta.coins+=coins; G.runCoins+=coins;
    floater(e.x,e.y,'+'+coins+'¢','#ffd36b');
    for(let i=0;i<14;i++)G.particles.push(spark(e.x,e.y,Math.random()*7,e.col));
    spawnGibs(e.x,e.y,e.col,Math.min(10,3+(e.r/4)|0));   // death variety: chunks fly off
    ring(e.x,e.y,[255,120,140],e.r*2.4);
    bloodPool(e.x,e.y,e.r*1.3);
    if(window.Sound) Sound.kill();
    if(e.type==='brute'){ G.hitstop=Math.max(G.hitstop,3); G.shake=Math.min(12,G.shake+5); }  // punchy big kill
    if(e.type==='boss'){                                   // boss kill: big reward, spectacle, ROOM CHANGE
      G.hitstop=Math.max(G.hitstop,6); G.shake=Math.min(14,G.shake+9); unlockAch('slayer');
      ring(e.x,e.y,[255,120,255],240); pushLight(e.x,e.y,400,[255,120,255],16); scorch(e.x,e.y,90);
      dropPowerup(e.x,e.y); dropPowerup(e.x,e.y);
      floater(e.x,e.y-30,'ROOM CLEARED!','#ff6bff');
      if(window.Sound) Sound.explosion();
      for(const o of G.enemies) if(o!==e && !o.dead){ o.dead=true;       // clear the rest of the room
        for(let i=0;i<6;i++) G.particles.push(spark(o.x,o.y,Math.random()*7,o.col)); }
      G.roomChangeTimer=120; G.awaitPerk=true;             // → fade, reshuffle maze, PERK PICK, fade in
    }
    // ---- DROP LOGIC: now uses THREAT instead of SUPPLY ----
    const threat = G.fuzzy.threat != null ? G.fuzzy.threat : 50;  // 0-100
    const sup = threat / 100;  // 0-1 (higher threat = more generous drops)
    const bmul = modIs('bounty') ? 1.8 : 1;
    if (G.kills % 10 === 0) {
      dropPowerup(e.x, e.y);  // guaranteed every 10 kills
    } else if (rand() < 0.04 * (0.6 + sup) * bmul) {
      dropPowerup(e.x, e.y);  // rare random power drop
    } else if (rand() < (0.20 + 0.30 * sup) * bmul) {
      // hp or ammo drop
      const ammoFrac = (G.ammo + G.reserve) / (G.maxAmmo + 120);
      const type = ammoFrac < 0.25 ? 'ammo' : (rand() < 0.55 ? 'ammo' : 'hp');
      G.pickups.push({x:e.x, y:e.y, type, r:10, bob:rand()*6});
    }
    // ----------------------------------------------------------
    if(G.kills%15===0){ G.wave++; announceWave(G.wave); }   // new wave → banner (+ boss every 5th)
  } else if(window.Sound) Sound.hit();
}
function explode(x,y,blast,dmg){
  G.shake=Math.min(14,G.shake+8);
  G.hitstop=Math.max(G.hitstop,3);
  for(let i=0;i<26;i++)G.particles.push(spark(x,y,Math.random()*7,Math.random()<0.5?'#ffd36b':'#ff7b4d'));
  G.particles.push({x,y,vx:0,vy:0,life:12,r:blast*0.55,col:'rgba(255,170,80,0.35)'});
  ring(x,y,[255,176,96],blast*1.4);
  pushLight(x,y,blast*1.7,[255,150,60],14);
  scorch(x,y,blast*0.7);
  if(window.Sound) Sound.explosion();
  for(const e of G.enemies){
    const d=Math.hypot(e.x-x,e.y-y);
    if(d<blast) hitEnemy(e, dmg*(1-0.6*d/blast));
  }
  // carve DESTRUCTIBLE walls + chain-detonate BARRELS inside the blast
  const tr=Math.ceil(blast/TILE), cc=(x/TILE)|0, rr=(y/TILE)|0;
  for(let r=rr-tr;r<=rr+tr;r++)for(let c=cc-tr;c<=cc+tr;c++){
    if(Math.hypot((c+0.5)*TILE-x,(r+0.5)*TILE-y)<blast && breakWallAt(c*TILE+TILE/2,r*TILE+TILE/2))
      for(let i=0;i<5;i++) G.particles.push(spark(c*TILE+TILE/2,r*TILE+TILE/2,Math.random()*7,'#8a9bb0'));
  }
  if(G.barrels) for(const b of G.barrels) if(!b.dead && Math.hypot(b.x-x,b.y-y)<blast+b.r) detonateBarrel(b);
}
function nukeScreen(){      // INSTANT KILL power-up: everything on screen dies
  G.flash=14; G.shake=12; G.hitstop=Math.max(G.hitstop,4);
  scorch(G.player.x,G.player.y,120);
  ring(G.player.x,G.player.y,[255,255,255],700);
  pushLight(G.player.x,G.player.y,900,[255,255,255],16);
  if(window.Sound) Sound.nuke();
  for(const e of G.enemies)
    if(e.x>G.cam.x-40&&e.x<G.cam.x+W+40&&e.y>G.cam.y-40&&e.y<G.cam.y+H+40)
      hitEnemy(e,e.hp+1);
  G.enemies=G.enemies.filter(e=>!e.dead);
}

/* ----------------------------------------------------------------------------
   THE DIRECTOR — spawns are lower at base, scale with Threat, and when the
   player is HIDDEN the spawn rate is driven purely by the noise they make.
   Enemies spawn at open maze tiles in a ring around the player (off screen).
   ---------------------------------------------------------------------------- */
function makeEnemy(aggr){
  const ring=aggr>0.6?[450,800]:[700,1200];
  const pos=openTileNear(G.player.x,G.player.y,ring[0],ring[1]);
  // Use threat to influence composition instead of a dedicated 'comp' output
  const threat = G.fuzzy.threat != null ? G.fuzzy.threat : 50;
  const comp = threat / 100;  // 0-1
  const loud = (G.fuzzy.fuzzified && G.fuzzy.fuzzified.noise) ? (G.fuzzy.fuzzified.noise.Loud || 0) : 0;
  let type='grunt';
  const roll=rand();
  const bruteP = (aggr>0.5 ? 0.12 + aggr*0.18 : 0) + comp * 0.14;
  const runnerP = 0.15 + loud * 0.35 + (modIs('runners') ? 0.35 : 0);
  const spitterP = (aggr>0.3 ? 0.12 + aggr*0.10 : 0) + comp * 0.08;
  if(roll<bruteP) type='brute';
  else if(roll<bruteP+runnerP) type='runner';
  else if(roll<bruteP+runnerP+spitterP) type='spitter';
  if(G.wave>=3&&rand()<0.055+aggr*0.035) type=rand()<0.34?'medic':rand()<0.62?'commander':'stalker';
  const hue=aggr>0.66?0:aggr>0.33?32:205;
  const e={x:pos.x,y:pos.y,wob:rand()*7,atk:0,lunge:0,hue,type,
           mode:'wander',tx:pos.x,ty:pos.y,wT:0,hearT:0,stuck:0,
           aggr:55,micro:'hold',flankDir:rand()<0.5?-1:1};
  if(type==='runner') Object.assign(e,{r:11+rand()*2,
    hp:12+aggr*14, maxhp:12+aggr*14,
    speed:(0.85+aggr*1.6)*G.settings.pace, dmg:4+aggr*6,
    col:`hsl(${hue},85%,62%)`, pts:15});
  else if(type==='brute') Object.assign(e,{r:21+rand()*4,
    hp:55+aggr*55, maxhp:55+aggr*55,
    speed:(0.3+aggr*0.6)*G.settings.pace, dmg:12+aggr*12,
    col:`hsl(${hue},60%,40%)`, pts:25});
  else if(type==='spitter') Object.assign(e,{r:12+rand()*2,
    hp:16+aggr*20, maxhp:16+aggr*20,
    speed:(0.5+aggr*0.8)*G.settings.pace, dmg:6+aggr*7,
    col:'hsl(140,72%,52%)', pts:18, shootCd:30+rand()*50});
  else if(type==='medic') Object.assign(e,{r:13,hp:28+aggr*30,maxhp:28+aggr*30,
    speed:(0.48+aggr*0.75)*G.settings.pace,dmg:5+aggr*5,col:'hsl(165,75%,58%)',pts:28,supportCd:45});
  else if(type==='commander') Object.assign(e,{r:17,hp:48+aggr*45,maxhp:48+aggr*45,
    speed:(0.4+aggr*0.65)*G.settings.pace,dmg:9+aggr*8,col:'hsl(275,72%,62%)',pts:38});
  else if(type==='stalker') Object.assign(e,{r:12,hp:20+aggr*22,maxhp:20+aggr*22,
    speed:(0.9+aggr*1.25)*G.settings.pace,dmg:9+aggr*10,col:'hsl(215,55%,36%)',pts:32,stalker:true});
  else Object.assign(e,{r:14+rand()*4,
    hp:18+aggr*28, maxhp:18+aggr*28,
    speed:(0.45+aggr*1.25)*G.settings.pace, dmg:6+aggr*9,
    col:`hsl(${hue},70%,55%)`, pts:10});
  // ELITE affixes — rare, tougher, double reward, coloured aura
  if(rand() < BALANCE.eliteChanceBase + aggr*0.10 + comp*0.06 + Math.min(0.15, G.wave*0.006)){
    const A=['shielded','volatile','frenzied']; e.elite=A[(rand()*A.length)|0];
    e.hp*=1.7; e.maxhp*=1.7; e.pts=Math.round(e.pts*2);
    if(e.elite==='frenzied'){ e.speed*=1.5; e.dmg*=1.4; }
    if(e.elite==='shielded'){ e.dmgResist=0.5; }
    e.eliteCol = e.elite==='shielded'?'#5fd0ff':e.elite==='volatile'?'#ff8a3d':'#ff4d6d';
  }
  if(modIs('swift')) e.speed*=1.25;              // OVERCLOCKED sector
  return e;
}
function spawnWave(count){
  for(let i=0;i<count&&G.enemies.length<BALANCE.enemyCap;i++)
    G.enemies.push(makeEnemy((G.t<600?Math.min(G.directorThreat||G.fuzzy.threat,40):(G.directorThreat||G.fuzzy.threat))/100));
}

/* ----------------------------------------------------------------------------
   WAVES — a banner announces every wave; every 5th is a BOSS wave (a slow,
   armoured Juggernaut with a screen-top health bar + escorts).
   ---------------------------------------------------------------------------- */
function announceWave(n){
  const boss = n%5===0;
  G.waveBanner = boss
    ? {text:'BOSS WAVE '+n, sub:'⚠  JUGGERNAUT INCOMING  ⚠', life:160, max:160, col:'#ff4d6d', boss:true}
    : {text:'WAVE '+n,      sub:'Incoming hostiles',          life:120, max:120, col:'#5fd0ff', boss:false};
  if(window.Sound){ boss?Sound.boss():Sound.wave(); }
  if(boss) spawnBoss(n);
}
function makeBoss(n){
  const pos=openTileNear(G.player.x,G.player.y,560,1000);
  const hp=260+n*45;
  return {x:pos.x,y:pos.y,wob:rand()*7,atk:0,lunge:0,hue:300,type:'boss',
    mode:'hunt',tx:G.player.x,ty:G.player.y,wT:0,hearT:0,stuck:0,
    aggr:80,micro:'swarm',flankDir:rand()<0.5?-1:1,
    atkTimer:150,telegraph:0,chargeT:0,atkKind:'burst',       // attack-pattern state machine
    r:38,hp,maxhp:hp,speed:0.6*G.settings.pace,dmg:24,col:'hsl(300,55%,52%)',pts:200,boss:true};
}
function spawnBoss(n){
  G.enemies.push(makeBoss(n));
  for(let i=0;i<3;i++) G.enemies.push(makeEnemy(Math.max(0.6,G.fuzzy.threat/100)));   // escorts
  G.bossPing=110;   // minimap ping so the player can find the Juggernaut
}

function update(){
  if(G.state==='setup'||G.state==='shop'){ G.t++; return; }
  if(G.state!=='play'){ return; }
  G.t++;
  if(G.tutorial) return;   // freeze while the first-run tutorial overlay is up
  if(G.showAnalytics) return;   // freeze while the fuzzy-analytics overlay is open

  // ROOM-CHANGE TRANSITION — freeze the sim; reshuffle the maze at the dark midpoint
  if(G.roomChangeTimer>0){
    G.roomChangeTimer--;
    if(G.roomChangeTimer===60) regenerateRoom();
    if(G.roomChangeTimer===0 && G.awaitPerk){ G.awaitPerk=false; rollPerks(); G.state='perk'; }  // pick a perk
    for(const k in G.power) if(G.power[k]>0) G.power[k]--;
    if(G.flash>0)G.flash--; if(G.shake>0)G.shake*=0.85;
    if(G.waveBanner && --G.waveBanner.life<=0) G.waveBanner=null;
    for(const r of G.rings){ r.r+=r.spd; r.life--; } G.rings=G.rings.filter(r=>r.life>0);
    for(const l of G.lights) l.life--; G.lights=G.lights.filter(l=>l.life>0);
    for(const s of G.particles){s.x+=s.vx;s.y+=s.vy;s.vx*=0.92;s.vy*=0.92;s.life--;}
    G.particles=G.particles.filter(s=>s.life>0);
    return;
  }

  if(fireCd>0)fireCd--;
  const p=G.player;

  for(const k in G.power) if(G.power[k]>0) G.power[k]--;
  if(G.flash>0)G.flash--;
  if(G.hurt>0)G.hurt--;
  if(G.hitDirT>0)G.hitDirT--;
  if(G.bossPing>0)G.bossPing--;
  if(G.comboTimer>0 && --G.comboTimer<=0) G.combo=0;
  if(p.dashCd>0)p.dashCd--; if(p.meleeCd>0)p.meleeCd--;
  if(p.melee>0)p.melee--; if(p.iframes>0)p.iframes--;

  // movement (walls block, slide along) — dash overrides with an i-frame burst
  let mx=0,my=0;
  if((typeof actionDown==='function'&&actionDown('up'))||keys['arrowup'])my--;
  if((typeof actionDown==='function'&&actionDown('down'))||keys['arrowdown'])my++;
  if((typeof actionDown==='function'&&actionDown('left'))||keys['arrowleft'])mx--;
  if((typeof actionDown==='function'&&actionDown('right'))||keys['arrowright'])mx++;
  const gp=(typeof gamepadState==='function')?gamepadState():{active:false};   // controller
  if(gp.active){ mx+=gp.mx; my+=gp.my; if(gp.dash) dash(); if(gp.melee) melee(); }
  if(typeof touchMove!=='undefined' && touchMove){                             // touch move-stick
    const dx=touchMove.x-touchMove.sx, dy=touchMove.y-touchMove.sy, dl=Math.hypot(dx,dy);
    if(dl>14){ mx+=dx/dl; my+=dy/dl; } }
  const spd=p.speed*(G.power.speed>0?1.6:1)*G.run.moveMul;
  if(p.dash>0){
    p.dash--; p.walk+=0.5; moveCircle(p, p.dashX*8.2, p.dashY*8.2);
    pushLight(p.x,p.y,42,[95,208,255],9);            // cyan dash trail
  } else {
    if(mx||my){const l=Math.hypot(mx,my);mx/=l;my/=l;p.walk+=0.3;G.noise=Math.min(100,G.noise+0.5);}
    moveCircle(p,mx*spd,my*spd);
  }

  // camera follows player, clamped to world
  G.cam.x=Math.max(0,Math.min(WORLD_W-W,p.x-W/2));
  G.cam.y=Math.max(0,Math.min(WORLD_H-H,p.y-H/2));

  // aim — right stick if a controller is aiming, else mouse
  if(gp.active && Math.hypot(gp.ax,gp.ay)>0.3) p.angle=Math.atan2(gp.ay,gp.ax);
  else if(G.meta.opts.view3d){p.angle=G.fpAngle;}
  else {p.angle=Math.atan2(mouse.y+G.cam.y-p.y,mouse.x+G.cam.x-p.x);
    if(G.meta.opts.aimAssist&&typeof assistedAimAngle==='function')p.angle=assistedAimAngle(p.angle);}
  if(p.recoil>0)p.recoil*=0.8;
  if(p.muzzle>0)p.muzzle--;
  if(mouse.down||(typeof actionDown==='function'?actionDown('shoot'):keys[' '])||(gp.active&&gp.shoot)) shoot();

  if(G.reloading>0){ G.reloading+=wstats(G.weapon).reloadSpd*G.run.reloadMul;
    if(G.reloading>=1){const need=G.maxAmmo-G.ammo,take=Math.min(need,G.reserve);
      G.ammo+=take;G.reserve-=take;G.reloading=0;} }

  G.noise=Math.max(0,G.noise-0.35);

  /* ------ ENEMY AI: vision → chase · hearing → hunt · neither → wander ---- */
  const inFogP=!!fogAt(p.x,p.y);
  const frozen=G.power.freeze>0;
  let seen=false, ei=0;
  if(typeof rebuildEnemyIndex==='function')rebuildEnemyIndex();
  for(const e of G.enemies){ ei++;
    const d=Math.hypot(p.x-e.x,p.y-e.y);
    if(!frozen){
      // VISION: needs range + clear line of sight; fog hides the player
      // unless the enemy stumbles right into them
      const canSee = d<480 && (!inFogP||d<110) && los(e.x,e.y,p.x,p.y);
      if(canSee){ e.mode='chase'; e.tx=p.x; e.ty=p.y; seen=true;
        if(typeof reportEnemySight==='function')reportEnemySight(p.x,p.y); }
      else if(G.noise>25 && d<G.noise*9){
        // HEARING: head roughly toward the sound — error shrinks as noise grows
        e.mode='hunt';
        if(--e.hearT<=0){ const err=(110-G.noise)*1.6;
          e.tx=p.x+(rand()-0.5)*err; e.ty=p.y+(rand()-0.5)*err; e.hearT=30; }
      }
      else if(e.mode==='chase') e.mode='hunt';          // lost sight → last known pos
      if(e.mode==='hunt' && Math.hypot(e.tx-e.x,e.ty-e.y)<45) e.mode='wander';
      if(e.mode==='wander' && (--e.wT<=0 || Math.hypot(e.tx-e.x,e.ty-e.y)<45)){
        const t=openTileNear(e.x,e.y,80,420); e.tx=t.x; e.ty=t.y; e.wT=180;
      }
      // PER-ENEMY MICRO-FUZZY (throttled, staggered): decide HOW to approach
      if((G.t+ei)%14===0){
        let allies=0;
        const nearList=typeof nearbyEnemies==='function'?nearbyEnemies(e.x,e.y,200):G.enemies;
        for(const o of nearList) if(o!==e && Math.abs(o.x-e.x)+Math.abs(o.y-e.y)<200) allies++;
        e.aggr=MicroFuzzy.infer({ dist:Math.min(100,d/600*100),
                                  health:(e.hp/e.maxhp)*100,
                                  allies:Math.min(100,allies*25) });
        e.micro = e.aggr<32 ? 'flee' : e.aggr<64 ? 'flank' : 'swarm';
      }
      // SPITTER — ranged: fire on line of sight, then kite to mid-range
      if(e.type==='spitter'){
        if(e.shootCd>0)e.shootCd--;
        if(e.mode==='chase' && d>90 && d<470 && e.shootCd<=0 && los(e.x,e.y,p.x,p.y)){
          enemyShoot(e, Math.atan2(p.y-e.y,p.x-e.x)+(rand()-0.5)*0.12, 5, e.dmg, '#8bffb0');
          e.shootCd=72; G.noise=Math.min(100,G.noise+2);
        }
      }
      // BOSS — telegraphed radial burst + charge attacks
      if(e.boss){
        if(e.chargeT>0){ e.chargeT--; e.tx=p.x; e.ty=p.y; }
        else if(e.telegraph>0){ if(--e.telegraph===0){
            if(e.atkKind==='burst'){ for(let k=0;k<14;k++) enemyShoot(e,k/14*Math.PI*2,4.6,12,'#ff7be6');
              ring(e.x,e.y,[255,90,210],150); pushLight(e.x,e.y,240,[255,90,210],16); if(window.Sound)Sound.boss(); }
            else e.chargeT=26; } }
        else if(--e.atkTimer<=0){ e.atkTimer=170+((rand()*120)|0); e.telegraph=48;
          e.atkKind=rand()<0.55?'burst':'charge'; }
      }
      // move toward target, sliding along walls; detour when stuck
      let baseAng=Math.atan2(e.ty-e.y,e.tx-e.x), microSp=1;
      if(e.mode!=='wander'&&e.micro!=='flee'&&typeof navigationAngle==='function')baseAng=navigationAngle(e,e.tx,e.ty,baseAng);
      if(e.micro==='flee' && d<300){ baseAng=Math.atan2(e.y-p.y,e.x-p.x); microSp=1.05; }       // hurt & alone → retreat
      else if(e.micro==='flank' && e.mode==='chase'){ baseAng+=e.flankDir*0.7; microSp=0.95; }   // circle the player
      else if(e.micro==='swarm'){ microSp=1.12; }                                                // commit, push straight in
      if(e.type==='spitter' && e.mode==='chase'){                 // keep the player at mid-range
        if(d<240){ baseAng=Math.atan2(e.y-p.y,e.x-p.x); microSp=1.0; }
        else if(d>360) microSp=0.9;
        else { baseAng+=Math.PI/2*e.flankDir; microSp=0.7; }
      }
      let bsp=1;
      if(e.boss) bsp = e.chargeT>0?3.4 : e.telegraph>0?0.12 : 1;  // charge fast / stand while winding up
      const statusMul=e.slow>0?0.55:e.shock>0?0.78:1, squadMul=e.commandBuff>0?1.14:1;
      const sp=e.speed*(e.mode==='chase'?1:e.mode==='hunt'?0.8:0.45)*microSp*bsp*statusMul*squadMul;
      const ang=baseAng+Math.sin(G.t*0.1+e.wob)*(e.mode==='chase'?0.25:0.5);
      const ox=e.x,oy=e.y;
      moveCircle(e,Math.cos(ang)*sp,Math.sin(ang)*sp);
      if(Math.abs(e.x-ox)+Math.abs(e.y-oy)<sp*0.5){
        if(++e.stuck>14){const t=openTileNear(e.x,e.y,60,260);e.tx=t.x;e.ty=t.y;e.stuck=0;}
      } else e.stuck=0;
      // contact attack
      if(e.atk>0)e.atk--;
      if(d<e.r+p.r && e.atk<=0){
        e.atk=45; e.lunge=6;
        hurtPlayer(e.dmg*0.5, e.x, e.y);   // honours god / shield / dash i-frames + sets damage direction
        if(G.run.thorns) hitEnemy(e, G.run.thorns);   // reactive-plating perk
      }
    }
    if(e.lunge>0)e.lunge*=0.8;
  }
  // DETECTION: sight ramps it up fast; fog drains it fast; noise sets a floor
  if(seen) G.detect=Math.min(100,G.detect+9);
  else G.detect=Math.max(0,G.detect-(inFogP?2.5:0.5));
  if(G.noise>45) G.detect=Math.max(G.detect,Math.min(65,G.noise*0.65));

  updateRoguelite();   // mines, turrets, barrels, extraction beacon, magnet, achievement toasts
  if(typeof updateAdvancedSystems==='function')updateAdvancedSystems();

  // ----- FUZZY INFERENCE — now 4 inputs → 1 output (Threat) -----
  if (++G.fuzzyTimer >= 10) {
    G.fuzzyTimer = 0;
    // Sample the 4 crisp inputs
    const health = (p.hp / p.maxhp) * 100;
    const ammo = Math.min(100, ((G.ammo + G.reserve) / (G.maxAmmo + 120)) * 100);
    const noise = G.noise;
    // Pressure: based on nearest enemy distance and count within 600px
    let nd = Infinity, near = 0;
    for (const e of G.enemies) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < nd) nd = d;
      if (d < 600) near++;
    }
    const pressure = G.enemies.length === 0 ? 0 :
      Math.max(0, Math.min(100, (100 - nd / 5) + near * 2));

    const inputs = { health, ammo, noise, pressure };
    // Call the MISO fuzzy engine (returns { threat, fired, explain, ... })
    G.fuzzy = Fuzzy.infer(inputs, { track: true });
    G._inputs = inputs;

    // Optional: let other systems read the threat value
    if (typeof directorThreatValue === 'function')
      G.directorThreat = directorThreatValue(G.fuzzy.threat);
    // Weapon advisor still works (uses distance and enemy count)
    G.advisor = WeaponAdvisor.infer(nd === Infinity ? 900 : nd, near);

    // Data logger – now only logs threat (no supply/compo)
    if (G.csvLog.length < 3000) {
      G.csvLog.push([
        G.t,
        inputs.health | 0,
        inputs.ammo | 0,
        inputs.noise | 0,
        inputs.pressure | 0,
        Math.round(G.fuzzy.threat)
      ]);
    }
  }

  // SPAWN DIRECTOR — hidden ⇒ noise-driven; otherwise Threat-driven
  G.spawnTimer--;
  const rawDirector=G.directorThreat==null?G.fuzzy.threat:G.directorThreat;
  const effThreat=G.t<600?Math.min(rawDirector,40):rawDirector;
  const aggr=effThreat/100;
  if(G.spawnTimer<=0){
    if(G.detect<15){                       // hidden: they spawn toward sound only
      if(G.noise>=20){
        spawnWave(Math.max(1,Math.round((0.5+G.noise/100*2.5)*G.settings.density)));
        G.spawnTimer=(300-G.noise*2.2)/G.settings.pace;
      } else if(G.enemies.length<3){       // dead quiet: a lone wanderer roams in
        spawnWave(1); G.spawnTimer=360/G.settings.pace;
      } else G.spawnTimer=60;              // silence — recheck soon, no spawns
    } else {
      spawnWave(Math.max(1,Math.round((0.5+aggr*4.5)*G.settings.density)));
      G.spawnTimer=(240-effThreat*1.5)/G.settings.pace;
    }
  }

  // bullets: fly, trail, stop on walls (bazooka explodes on them)
  for(const b of G.bullets){ b.x+=b.vx;b.y+=b.vy;b.life--; if(b.hitCd>0)b.hitCd--;
    if(b.explosive&&Math.random()<0.6) G.particles.push(spark(b.x,b.y,Math.atan2(-b.vy,-b.vx),'#ff9b5d'));
    if(isSolidAt(b.x,b.y)){ if(b.explosive) explode(b.x,b.y,b.blast,b.dmg); b.life=0; } }
  G.bullets=G.bullets.filter(b=>b.life>0);

  for(const b of G.bullets){
    if(b.hitCd>0) continue;
    let done=false;
    for(const bar of G.barrels){ if(!bar.dead && Math.hypot(b.x-bar.x,b.y-bar.y)<bar.r+b.r){   // shoot a barrel
      b.life=0; detonateBarrel(bar); done=true; break; } }
    if(done) continue;
    for(const e of G.enemies){
      if(e.dead) continue;
      if(Math.hypot(b.x-e.x,b.y-e.y)<e.r){
        if(b.explosive){ explode(b.x,b.y,b.blast,b.dmg); b.life=0; break; }
        hitEnemy(e,b.dmg,b.vx*0.4,b.vy*0.4);
        if(typeof applyBulletStatus==='function')applyBulletStatus(e,b);
        G.shotsHit++;   // accuracy → adaptive skill
        if(b.pierce>0){ b.pierce--; b.hitCd=3; } else b.life=0;   // RAILGUN pierce perk
        break;
      }
    }
  }
  G.barrels=G.barrels.filter(b=>!b.dead);
  G.bullets=G.bullets.filter(b=>b.life>0);
  G.enemies=G.enemies.filter(e=>!e.dead);

  // enemy projectiles: fly, stop on walls, damage the player
  for(const b of G.eBullets){ b.x+=b.vx; b.y+=b.vy; b.life--;
    if(isSolidAt(b.x,b.y)){ b.life=0; continue; }
    if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+b.r){ b.life=0; hurtPlayer(b.dmg, b.x, b.y); }
  }
  G.eBullets=G.eBullets.filter(b=>b.life>0);

  for(const k of G.pickups){ k.bob+=0.1;
    if(Math.hypot(p.x-k.x,p.y-k.y)<p.r+k.r){ k.taken=true;
      if(k.type==='hp'){p.hp=Math.min(p.maxhp,p.hp+25);floater(p.x,p.y-20,'+25 HP','#7CFF9B');if(window.Sound)Sound.pickup();}
      else if(k.type==='ammo'){G.reserve=Math.min(G.reserveCap,G.reserve+36);floater(p.x,p.y-20,'+36 AMMO','#ffd36b');if(window.Sound)Sound.pickup();}
      else if(k.type==='power'){ const def=POWERUPS[k.kind];
        if(k.kind==='nuke') nukeScreen();
        else { G.power[k.kind]=powDur(def); if(window.Sound)Sound.powerup(); }
        floater(p.x,p.y-26,def.label+'!',def.col); } } }
  G.pickups=G.pickups.filter(k=>!k.taken);

  for(const s of G.particles){s.x+=s.vx;s.y+=s.vy;s.vx*=0.92;s.vy*=0.92;s.life--;}
  G.particles=G.particles.filter(s=>s.life>0);
  for(const f of G.floaters){f.y-=0.6;f.life--;}
  G.floaters=G.floaters.filter(f=>f.life>0);
  for(const r of G.rings){ r.r+=r.spd; r.life--; }
  G.rings=G.rings.filter(r=>r.life>0);
  for(const l of G.lights){ l.life--; }
  G.lights=G.lights.filter(l=>l.life>0);
  for(const b of G.bloodPools) b.life--;
  G.bloodPools=G.bloodPools.filter(b=>b.life>0);
  for(const g of G.gibs){ g.x+=g.vx; g.y+=g.vy; g.vx*=0.9; g.vy*=0.9; g.rot+=g.vr; g.life--; }
  G.gibs=G.gibs.filter(g=>g.life>0);
  if(G.weather==='flicker' && Math.random()<0.006) G.flicker=10;   // ambient light flicker
  if(G.flicker>0)G.flicker--;
  if(G.waveBanner){ if(--G.waveBanner.life<=0) G.waveBanner=null; }
  if(G.shake>0)G.shake*=0.85;
}
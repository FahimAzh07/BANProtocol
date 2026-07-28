"use strict";
/* --------------------------------------------------------------------------
   advanced.js - v7 integrated systems
   Experiment directors, deterministic run seeds, objectives, sector themes,
   run history/save-resume, weapon modules, specialist coordination, grid
   navigation, accessibility helpers, and their lightweight canvas UI.
   Updated for MISO system: 4 inputs → 1 output · 81 rules.
   -------------------------------------------------------------------------- */

const DIRECTOR_MODES={
  fuzzy:{name:'FUZZY AI',desc:'81-rule adaptive director'},
  static:{name:'STATIC',desc:'fixed traditional difficulty'},
  linear:{name:'LINEAR',desc:'difficulty rises with time'},
  random:{name:'CHAOS',desc:'smoothed random director'},
};
const DIRECTOR_KEYS=Object.keys(DIRECTOR_MODES);

const SECTOR_THEMES=[
  {id:'lab',name:'ABANDONED LAB',col:'#5fd0ff',hazard:'electric',desc:'arcing security floors'},
  {id:'foundry',name:'IRON FOUNDRY',col:'#ff9b4d',hazard:'fire',desc:'unstable heat vents'},
  {id:'cryo',name:'CRYO ARCHIVE',col:'#9bdcff',hazard:'ice',desc:'slippery coolant fields'},
  {id:'infested',name:'INFESTED TUNNELS',col:'#b8ff68',hazard:'spore',desc:'toxic spore growth'},
  {id:'blackout',name:'BLACKOUT GRID',col:'#c9a0ff',hazard:'dark',desc:'intermittent power loss'},
];

const OBJECTIVE_DEFS={
  hold:{name:'HOLD THE UPLINK',desc:'Remain inside the uplink zone'},
  terminals:{name:'BREACH TERMINALS',desc:'Stand near every terminal to decrypt it'},
  nests:{name:'PURGE THE NESTS',desc:'Shoot and destroy every infestation'},
  courier:{name:'RECOVER THE CORE',desc:'Collect the data core, then reach extraction'},
};

const WEAPON_MODULES={
  rifle:[
    {id:'standard',name:'STANDARD ISSUE',desc:'balanced configuration'},
    {id:'suppressor',name:'GHOST SUPPRESSOR',desc:'-65% noise, -10% damage',noise:0.35,dmg:0.90,spread:0.8},
    {id:'shock',name:'ARC CAPACITOR',desc:'shots shock and chain',status:'shock',dmg:0.92},
  ],
  shotgun:[
    {id:'standard',name:'STANDARD CHOKE',desc:'wide six-pellet blast'},
    {id:'tight',name:'HUNTER CHOKE',desc:'tighter spread, longer range',spread:0.48,range:1.35},
    {id:'fire',name:'THERMITE SHELLS',desc:'pellets ignite targets',status:'burn',dmg:0.88},
  ],
  bazooka:[
    {id:'standard',name:'HE WARHEAD',desc:'balanced blast warhead'},
    {id:'cluster',name:'CLUSTER RACK',desc:'larger blast, slower reload',blast:1.30,reload:0.78},
    {id:'cryo',name:'CRYO WARHEAD',desc:'blast slows survivors',status:'slow',dmg:0.90},
  ],
};

const DEFAULT_BINDS={up:'w',down:'s',left:'a',right:'d',shoot:' ',reload:'r',cycle:'q',dash:'shift',
  melee:'f',mine:'e',turret:'t',alt:'x',analytics:'c',pause:'escape'};
const RUN_SAVE_KEY='bansProtocolRun_v7';
const RUN_HISTORY_MAX=12;

function initAdvancedMeta(){
  const m=G.meta;
  if(!m.directorMode)m.directorMode='fuzzy';
  if(!m.modules)m.modules={rifle:'standard',shotgun:'standard',bazooka:'standard'};
  if(!m.binds)m.binds=Object.assign({},DEFAULT_BINDS);
  else for(const k in DEFAULT_BINDS)if(!m.binds[k])m.binds[k]=DEFAULT_BINDS[k];
  if(!Array.isArray(m.history))m.history=[];
  if(!m.opts)m.opts={};
  if(m.opts.colorblind==null)m.opts.colorblind=false;
  if(m.opts.reducedFlash==null)m.opts.reducedFlash=false;
  if(m.opts.aimAssist==null)m.opts.aimAssist=false;
  if(m.opts.textScale==null)m.opts.textScale=1;
  if(m.opts.view3d==null)m.opts.view3d=false;
}
initAdvancedMeta();

Object.assign(G,{
  runSeed:null,replaySeed:null,directorMode:G.meta.directorMode,runStarted:0,runFinalized:false,
  directorThreat:25,chaosThreat:35,telemetry:[],objective:null,theme:null,
  hazards:[],landmarks:[],squadIntel:{x:0,y:0,t:0},navField:null,navCell:'',
  altCd:0,saveToast:0,bindCapture:null,fpAngle:0,perf:{avg:0,max:0,frames:0,entities:0},
});

function makeRunSeed(){
  if(G.replaySeed!=null){const s=G.replaySeed>>>0;G.replaySeed=null;return s;}
  if(G.daily)return dailySeed()>>>0;
  if(window.crypto&&crypto.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}
  return (Date.now()^(Math.random()*0xffffffff))>>>0;
}
function directorThreatValue(fuzzyValue){
  const mode=G.directorMode||'fuzzy';
  if(mode==='static')return Math.max(15,Math.min(85,42+(G.settings.density-1)*12+(G.settings.pace-0.8)*14));
  if(mode==='linear')return Math.max(12,Math.min(96,14+G.t/150+G.wave*2.4+G.sector*4));
  if(mode==='random'){
    if(G.t%180===0)G.chaosThreat=15+rand()*80;
    return G.directorThreat+(G.chaosThreat-G.directorThreat)*0.035;
  }
  return fuzzyValue;
}
function setDirectorMode(mode){
  if(!DIRECTOR_MODES[mode])return;
  G.directorMode=mode;G.meta.directorMode=mode;saveMeta();
}
function cycleDirectorMode(){setDirectorMode(DIRECTOR_KEYS[(DIRECTOR_KEYS.indexOf(G.directorMode)+1)%DIRECTOR_KEYS.length]);}

// ---- UPDATED for MISO: supply/composition now derived from Threat ----
function effectiveSupply(){
  // In the MISO system, supply (drop generosity) is driven by Threat.
  return G.directorMode==='fuzzy' ? (G.fuzzy.threat != null ? G.fuzzy.threat : 50) : 50;
}
function effectiveComposition(){
  // Composition (enemy mix) also follows Threat.
  return G.directorMode==='fuzzy' ? (G.fuzzy.threat != null ? G.fuzzy.threat : 50) : Math.max(20, Math.min(80, G.directorThreat));
}

function currentModule(key){
  const list=WEAPON_MODULES[key]||[];
  return list.find(x=>x.id===G.meta.modules[key])||list[0]||{};
}
function cycleWeaponModule(key){
  if(!G.meta.weapons[key].owned)return;
  const list=WEAPON_MODULES[key],i=list.findIndex(x=>x.id===G.meta.modules[key]);
  G.meta.modules[key]=list[(i+1)%list.length].id;saveMeta();
}
function applyWeaponModule(key,w){
  const m=currentModule(key),o=Object.assign({},w,{module:m});
  if(m.dmg)o.dmg*=m.dmg;if(m.noise)o.noise*=m.noise;if(m.spread)o.spread*=m.spread;
  if(m.range)o.range*=m.range;if(m.blast)o.blast*=m.blast;if(m.reload)o.reloadSpd*=m.reload;
  if(m.status)o.status=m.status;
  return o;
}
function alternateFire(){
  if(G.state!=='play'||G.altCd>0||G.reloading>0)return;
  const p=G.player,a=p.angle,w=wstats(G.weapon);
  if(G.weapon==='rifle'){
    if(G.reserve<6&&!G.settings.god)return; if(!G.settings.god)G.reserve-=6;
    G.bullets.push({x:p.x+Math.cos(a)*24,y:p.y+Math.sin(a)*24,vx:Math.cos(a)*7.5,vy:Math.sin(a)*7.5,
      life:75,r:6,dmg:w.dmg*1.8,explosive:true,blast:72,pierce:0,status:w.status,hitCd:0});G.altCd=150;
  }else if(G.weapon==='shotgun'){
    if(G.ammo<2&&!G.settings.god)return;if(!G.settings.god)G.ammo-=2;
    G.bullets.push({x:p.x+Math.cos(a)*24,y:p.y+Math.sin(a)*24,vx:Math.cos(a)*15,vy:Math.sin(a)*15,
      life:95,r:3.5,dmg:w.dmg*6.5,explosive:false,blast:0,pierce:3,status:w.status,hitCd:0});G.altCd=110;
  }else{
    if(G.ammo<1&&!G.settings.god)return;if(!G.settings.god)G.ammo--;
    for(let i=-1;i<=1;i++){const q=a+i*0.17;G.bullets.push({x:p.x+Math.cos(q)*24,y:p.y+Math.sin(q)*24,
      vx:Math.cos(q)*6.4,vy:Math.sin(q)*6.4,life:82,r:5,dmg:w.dmg*0.62,explosive:true,
      blast:(w.blast||90)*0.72,pierce:0,status:w.status,hitCd:0});}G.altCd=210;
  }
  G.noise=Math.min(100,G.noise+w.noise*1.25);G.player.muzzle=6;G.shake+=5;
  if(window.Sound)Sound.shot(G.weapon);
}
function applyBulletStatus(e,b){
  if(!b.status||e.dead)return;
  if(b.status==='burn')e.burn=Math.max(e.burn||0,180);
  else if(b.status==='slow')e.slow=Math.max(e.slow||0,150);
  else if(b.status==='shock'){
    e.shock=Math.max(e.shock||0,45);
    let best=null,bd=150;for(const o of G.enemies)if(o!==e&&!o.dead){const d=Math.hypot(o.x-e.x,o.y-e.y);if(d<bd){bd=d;best=o;}}
    if(best){best.hp-=Math.max(3,b.dmg*0.28);ring(best.x,best.y,[100,210,255],34);if(best.hp<=0)hitEnemy(best,1);}
  }
}
function updateEnemyStatuses(e){
  if(e.burn>0){e.burn--;if(e.burn%30===0)hitEnemy(e,3);}
  if(e.slow>0)e.slow--;
  if(e.shock>0)e.shock--;
}

function rollSectorTheme(){return SECTOR_THEMES[((Math.max(1,G.sector)-1)+((rand()*SECTOR_THEMES.length)|0))%SECTOR_THEMES.length];}
function setupThemedWorld(){
  G.hazards=[];G.landmarks=[];G.navField=null;G.navCell='';if(typeof NAV_CACHE!=='undefined')NAV_CACHE.clear();
  const theme=G.theme||SECTOR_THEMES[0],n=theme.id==='foundry'?8:5;
  for(let i=0;i<n;i++){const t=openTileNear(G.player.x||WORLD_W/2,G.player.y||WORLD_H/2,280,1800);
    G.hazards.push({x:t.x,y:t.y,r:42+rand()*32,type:theme.hazard,phase:rand()*100,cd:0});}
  const cache=openTileNear(G.player.x||WORLD_W/2,G.player.y||WORLD_H/2,500,1600);
  G.landmarks.push({x:cache.x,y:cache.y,r:30,type:'cache',opened:false});
}

function startObjective(){
  const ids=Object.keys(OBJECTIVE_DEFS),id=ids[(G.sector-1)%ids.length],p=G.player;
  const o={id,name:OBJECTIVE_DEFS[id].name,desc:OBJECTIVE_DEFS[id].desc,done:false,rewarded:false,progress:0,items:[]};
  if(id==='hold'){const t=openTileNear(p.x,p.y,450,1100);o.x=t.x;o.y=t.y;o.r=95;o.target=900;}
  else if(id==='terminals'){for(let i=0;i<3;i++){const t=openTileNear(p.x,p.y,350,1600);o.items.push({x:t.x,y:t.y,r:22,progress:0,done:false});}}
  else if(id==='nests'){for(let i=0;i<3;i++){const t=openTileNear(p.x,p.y,350,1600);o.items.push({x:t.x,y:t.y,r:28,hp:75,maxhp:75,done:false});}}
  else {const t=openTileNear(p.x,p.y,550,1500);o.x=t.x;o.y=t.y;o.r=18;o.carried=false;}
  G.objective=o;
}
function objectiveProgressText(){
  const o=G.objective;if(!o)return 'NO OBJECTIVE';if(o.done)return 'COMPLETE - CACHE UNLOCKED';
  if(o.id==='hold')return Math.round(o.progress/o.target*100)+'% SECURED';
  if(o.id==='courier')return o.carried?'DELIVER CORE TO EXTRACTION':'LOCATE THE DATA CORE';
  return o.items.filter(x=>x.done).length+'/'+o.items.length+' COMPLETE';
}
function completeObjective(){
  const o=G.objective;if(!o||o.done)return;o.done=true;
  const bonus=80*G.sector;G.meta.coins+=bonus;G.runCoins+=bonus;G.score+=500*G.sector;
  for(const l of G.landmarks)if(l.type==='cache')l.unlocked=true;
  floater(G.player.x,G.player.y-30,'MISSION COMPLETE +'+bonus+'c','#7CFF9B');dropPowerup(G.player.x,G.player.y);saveMeta();
  if(window.Sound)Sound.powerup();
}
function updateObjective(){
  const o=G.objective,p=G.player;if(!o||o.done)return;
  if(o.id==='hold'){
    if(Math.hypot(p.x-o.x,p.y-o.y)<o.r+p.r){o.progress++;if(G.t%240===0)spawnWave(2+G.sector);}
    else o.progress=Math.max(0,o.progress-0.25);
    if(o.progress>=o.target)completeObjective();
  }else if(o.id==='terminals'){
    for(const x of o.items)if(!x.done&&Math.hypot(p.x-x.x,p.y-x.y)<x.r+p.r){if(++x.progress>=90)x.done=true;}
    if(o.items.every(x=>x.done))completeObjective();
  }else if(o.id==='nests'){
    for(const b of G.bullets)for(const x of o.items)if(!x.done&&b.life>0&&Math.hypot(b.x-x.x,b.y-x.y)<x.r+b.r){
      x.hp-=b.dmg;b.life=0;if(x.hp<=0){x.done=true;explode(x.x,x.y,75,12);}}
    if(o.items.every(x=>x.done))completeObjective();
  }else{
    if(!o.carried&&Math.hypot(p.x-o.x,p.y-o.y)<o.r+p.r)o.carried=true;
    if(o.carried&&G.extract&&Math.hypot(p.x-G.extract.x,p.y-G.extract.y)<G.extract.r+p.r)completeObjective();
  }
}

function updateHazards(){
  const p=G.player;for(const h of G.hazards){h.phase++;if(h.cd>0)h.cd--;
    const inside=Math.hypot(p.x-h.x,p.y-h.y)<h.r+p.r;if(!inside)continue;
    if(h.type==='ice'){p.walk+=0.2;continue;}
    const active=h.type==='electric'?(h.phase%120<35):h.type==='fire'?(h.phase%150<55):h.type==='spore';
    if(active&&h.cd<=0){hurtPlayer(h.type==='spore'?3:6,h.x,h.y);h.cd=45;}
  }
  for(const l of G.landmarks)if(l.type==='cache'&&l.unlocked&&!l.opened&&Math.hypot(p.x-l.x,p.y-l.y)<l.r+p.r){
    l.opened=true;G.reserve=Math.min(G.reserveCap,G.reserve+80);p.hp=Math.min(p.maxhp,p.hp+40);dropPowerup(l.x,l.y);
    floater(l.x,l.y-30,'SECURE CACHE OPENED','#ffd36b');
  }
}

function reportEnemySight(x,y){G.squadIntel.x=x;G.squadIntel.y=y;G.squadIntel.t=180;}
function updateSquadSystems(){
  if(G.squadIntel.t>0)G.squadIntel.t--;
  for(const e of G.enemies){
    updateEnemyStatuses(e);
    if(G.squadIntel.t>0&&e.mode==='wander'){e.mode='hunt';e.tx=G.squadIntel.x;e.ty=G.squadIntel.y;}
    if(e.type==='medic'&&(--e.supportCd||0)<=0){let target=null,loss=0;for(const o of nearbyEnemies(e.x,e.y,240))if(o!==e&&!o.dead){const q=o.maxhp-o.hp;if(q>loss){loss=q;target=o;}}
      if(target&&loss>0){target.hp=Math.min(target.maxhp,target.hp+12);e.supportCd=90;ring(target.x,target.y,[100,255,170],42);}else e.supportCd=30;}
    if(e.type==='commander')for(const o of nearbyEnemies(e.x,e.y,240))if(o!==e)o.commandBuff=3;
    if(e.commandBuff>0)e.commandBuff--;
  }
}

/* Spatial hash used by micro-FIS ally counts and specialist support queries. */
const ENEMY_GRID=new Map(),ENEMY_CELL=220;
function rebuildEnemyIndex(){ENEMY_GRID.clear();for(const e of G.enemies){const k=((e.x/ENEMY_CELL)|0)+','+((e.y/ENEMY_CELL)|0);if(!ENEMY_GRID.has(k))ENEMY_GRID.set(k,[]);ENEMY_GRID.get(k).push(e);}}
function nearbyEnemies(x,y,r){const out=[],cx=(x/ENEMY_CELL)|0,cy=(y/ENEMY_CELL)|0,n=Math.ceil(r/ENEMY_CELL);
  for(let yy=cy-n;yy<=cy+n;yy++)for(let xx=cx-n;xx<=cx+n;xx++)for(const e of (ENEMY_GRID.get(xx+','+yy)||[]))if(Math.hypot(e.x-x,e.y-y)<=r)out.push(e);return out;}
function recordFramePerformance(ms){const p=G.perf||(G.perf={avg:0,max:0,frames:0,entities:0});p.frames++;p.avg+=((ms||0)-p.avg)*0.04;p.max=Math.max(p.max,ms||0);p.entities=G.enemies.length+G.bullets.length+G.eBullets.length;}

/* Shared reverse breadth-first fields guide squads through the maze. Targets
   are quantized and cached, avoiding one path search per enemy. */
const NAV_CACHE=new Map();
function rebuildNavField(tx,ty){
  let tc=Math.max(0,Math.min(MW-1,(tx/TILE)|0)),tr=Math.max(0,Math.min(MH-1,(ty/TILE)|0));
  tc=Math.max(1,Math.min(MW-2,Math.round(tc/3)*3));tr=Math.max(1,Math.min(MH-2,Math.round(tr/3)*3));
  if(solid[tr][tc]){outer:for(let rr=1;rr<5;rr++)for(let y=tr-rr;y<=tr+rr;y++)for(let x=tc-rr;x<=tc+rr;x++)
    if(y>0&&y<MH-1&&x>0&&x<MW-1&&!solid[y][x]){tr=y;tc=x;break outer;}}
  const key=tc+','+tr,hit=NAV_CACHE.get(key);
  if(hit&&G.t-hit.t<180){G.navField=hit.field;G.navCell=key;return;}
  const d=Array.from({length:MH},()=>Array(MW).fill(1e6)),q=[[tr,tc]];d[tr][tc]=0;
  for(let qi=0;qi<q.length;qi++){const [r,c]=q[qi],nd=d[r][c]+1;for(const z of [[1,0],[-1,0],[0,1],[0,-1]]){const nr=r+z[0],nc=c+z[1];
    if(nr>=0&&nr<MH&&nc>=0&&nc<MW&&!solid[nr][nc]&&d[nr][nc]>nd){d[nr][nc]=nd;q.push([nr,nc]);}}}
  G.navField=d;G.navCell=key;NAV_CACHE.set(key,{field:d,t:G.t});
  if(NAV_CACHE.size>12)NAV_CACHE.delete(NAV_CACHE.keys().next().value);
}
function navigationAngle(e,tx,ty,fallback){
  rebuildNavField(tx,ty);const c=(e.x/TILE)|0,r=(e.y/TILE)|0;if(!G.navField||r<0||c<0||r>=MH||c>=MW)return fallback;
  let best=null,bd=G.navField[r][c];for(const z of [[1,0],[-1,0],[0,1],[0,-1]]){const nr=r+z[0],nc=c+z[1];
    if(nr>=0&&nr<MH&&nc>=0&&nc<MW&&G.navField[nr][nc]<bd){bd=G.navField[nr][nc];best=[nr,nc];}}
  return best?Math.atan2((best[0]+0.5)*TILE-e.y,(best[1]+0.5)*TILE-e.x):fallback;
}

function beginAdvancedRun(){
  G.runStarted=Date.now();G.runFinalized=false;G.telemetry=[];G.objective=null;G.altCd=0;G.saveToast=0;G.perf={avg:0,max:0,frames:0,entities:0};
  G.squadIntel={x:0,y:0,t:0};G.navField=null;G.navCell='';NAV_CACHE.clear();clearSavedRun();
}
function telemetryTick(){
  if(G.t%60!==0)return;
  G.telemetry.push({t:G.t,th:+G.directorThreat.toFixed(1),fuzzy:+G.fuzzy.threat.toFixed(1),hp:+G.player.hp.toFixed(1),
    enemies:G.enemies.length,kills:G.kills,score:G.score,objective:G.objective?objectiveProgressText():''});
  if(G.telemetry.length>2400)G.telemetry.shift();
}
function buildRunSummary(reason){
  const avg=G.telemetry.length?G.telemetry.reduce((s,x)=>s+x.th,0)/G.telemetry.length:0;
  return {date:new Date().toISOString(),reason:reason||'quit',seed:G.runSeed>>>0,mode:G.directorMode,score:G.score,kills:G.kills,
    wave:G.wave,sector:G.sector,seconds:Math.round(G.t/60),accuracy:G.shotsFired?Math.round(G.shotsHit/G.shotsFired*100):0,
    avgThreat:Math.round(avg),peakThreat:Math.round(Math.max(0,...G.telemetry.map(x=>x.th))),weapon:G.weapon,module:currentModule(G.weapon).id,
    objective:!!(G.objective&&G.objective.done),trace:G.telemetry.filter((_,i)=>i%5===0).map(x=>[x.th,x.hp,x.enemies]).slice(-180)};
}
function finalizeRun(reason){
  if(G.runFinalized)return;G.runFinalized=true;
  G.meta.history.unshift(buildRunSummary(reason));G.meta.history=G.meta.history.slice(0,RUN_HISTORY_MAX);saveMeta();clearSavedRun();
}
function saveRun(){
  if(G.state!=='play'&&G.state!=='paused')return false;
  const omit=new Set(['meta','navField']);const gs={};for(const k in G)if(!omit.has(k))gs[k]=G[k];
  try{localStorage.setItem(RUN_SAVE_KEY,JSON.stringify({v:7,g:gs,solid,breakable,fogs,worldSeedState:getWorldSeedState()}));G.saveToast=120;return true;}catch(e){return false;}
}
function hasSavedRun(){try{return !!localStorage.getItem(RUN_SAVE_KEY);}catch(e){return false;}}
function clearSavedRun(){try{localStorage.removeItem(RUN_SAVE_KEY);}catch(e){}}
function resumeSavedRun(){
  try{const s=JSON.parse(localStorage.getItem(RUN_SAVE_KEY));if(!s||s.v!==7)return false;
    const meta=G.meta;Object.assign(G,s.g);G.meta=meta;solid=s.solid;breakable=s.breakable;fogs=s.fogs;setWorldSeedState(s.worldSeedState||{seed:G.runSeed,state:G.runSeed});
    G.navField=null;G.navCell='';NAV_CACHE.clear();G.state='play';if(typeof rebuildMinimap==='function')rebuildMinimap();if(typeof build3DWorld==='function')build3DWorld();return true;
  }catch(e){clearSavedRun();return false;}
}
function updateAdvancedSystems(){
  if(G.altCd>0)G.altCd--;if(G.saveToast>0)G.saveToast--;
  G.directorThreat=directorThreatValue(G.fuzzy.threat||25);telemetryTick();updateObjective();updateHazards();updateSquadSystems();
  if(G.t>0&&G.t%600===0)saveRun();
}
addEventListener('beforeunload',()=>{if(G.state==='play'||G.state==='paused')saveRun();});

function actionKey(action){return (G.meta.binds&&G.meta.binds[action])||DEFAULT_BINDS[action];}
function actionDown(action){return !!keys[actionKey(action)];}
function actionPressed(key,action){return key===actionKey(action);}
function displayKey(action){const k=actionKey(action);return k===' '?'SPACE':k.toUpperCase();}
function assistedAimAngle(base){
  let best=base,score=0.20;const p=G.player;
  for(const e of G.enemies){if(e.dead||!los(p.x,p.y,e.x,e.y))continue;const a=Math.atan2(e.y-p.y,e.x-p.x);
    const d=Math.abs(((a-base+Math.PI*3)%(Math.PI*2))-Math.PI),range=Math.hypot(e.x-p.x,e.y-p.y);
    const s=0.24-d-range/9000;if(s>score){score=s;best=a;}}
  return best;
}
function drawAccessibleHUD(){
  const s=Math.max(0.9,Math.min(1.15,G.meta.opts.textScale||1));
  ctx.save();ctx.translate(W/2,H/2);ctx.scale(s,s);ctx.translate(-W/2,-H/2);drawHUD();ctx.restore();
}

function drawAdvancedWorld(){
  const theme=G.theme||SECTOR_THEMES[0];
  for(const h of G.hazards){const pulse=0.5+0.5*Math.sin((G.t+h.phase)*0.08);ctx.save();
    const col=h.type==='fire'?'255,110,50':h.type==='electric'?'80,190,255':h.type==='ice'?'150,230,255':h.type==='spore'?'130,255,80':'130,90,220';
    ctx.fillStyle=`rgba(${col},${0.08+pulse*0.09})`;ctx.strokeStyle=`rgba(${col},${0.28+pulse*0.35})`;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,7);ctx.fill();ctx.stroke();ctx.restore();}
  for(const l of G.landmarks){ctx.save();ctx.translate(l.x,l.y);ctx.fillStyle=l.opened?'#26313a':l.unlocked?'#ffd36b':'#52606d';
    ctx.fillRect(-22,-16,44,32);ctx.strokeStyle=l.unlocked?'#ffd36b':'#8899aa';ctx.strokeRect(-22,-16,44,32);
    ctx.fillStyle='#081018';ctx.font='bold 10px Consolas';ctx.textAlign='center';ctx.fillText(l.opened?'EMPTY':l.unlocked?'OPEN':'LOCKED',0,4);ctx.restore();}
  const o=G.objective;if(!o||o.done)return;ctx.save();
  if(o.id==='hold'){ctx.strokeStyle=theme.col;ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,7);ctx.stroke();ctx.setLineDash([]);}
  else if(o.id==='courier'&&!o.carried){ctx.fillStyle='#fff';ctx.shadowBlur=18;ctx.shadowColor=theme.col;ctx.fillRect(o.x-9,o.y-9,18,18);}
  else for(const x of o.items)if(!x.done){ctx.strokeStyle=o.id==='nests'?'#b8ff68':theme.col;ctx.fillStyle=o.id==='nests'?'rgba(100,180,40,.35)':'rgba(60,170,255,.22)';
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(x.x,x.y,x.r,0,7);ctx.fill();ctx.stroke();if(o.id==='nests'){ctx.fillStyle='#ff5470';ctx.fillRect(x.x-22,x.y-x.r-10,44*(x.hp/x.maxhp),4);}}
  ctx.restore();
}
function drawObjectiveHUD(){
  const o=G.objective;if(!o)return;const x=W/2-220,y=92,w=440,theme=G.theme||SECTOR_THEMES[0];
  ctx.fillStyle='rgba(4,12,22,.78)';roundRect(x,y,w,34,8);ctx.fill();ctx.strokeStyle=theme.col;ctx.lineWidth=1;ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle=UI.text;ctx.font='bold 10px Consolas';ctx.fillText(o.name,x+12,y+21);
  ctx.textAlign='right';ctx.fillStyle=o.done?UI.good:theme.col;ctx.fillText(objectiveProgressText(),x+w-12,y+21);
  if(G.saveToast>0){ctx.fillStyle=UI.good;ctx.textAlign='right';ctx.fillText('RUN SAVED',W-20,H-18);}
}
function drawRunHistory(){
  drawGrid();ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 38px '+UI.display;ctx.fillText('RUN ARCHIVE',W/2,66);
  ctx.fillStyle=UI.dim;ctx.font='12px Consolas';ctx.fillText('Comparable seeded evidence across fuzzy and traditional directors',W/2,92);
  panel(90,116,W-180,500,'LAST '+RUN_HISTORY_MAX+' RUNS');
  const rows=G.meta.history||[];ctx.font='12px Consolas';ctx.textAlign='left';let y=150;
  ctx.fillStyle='#9cf';ctx.fillText('MODE        SEED        SCORE   KILLS  SECTOR  TIME   ACC   AVG/PEAK',112,y);y+=27;
  rows.slice(0,8).forEach((r,i)=>{ctx.fillStyle=i%2?'#9bb0c2':'#d5e5f4';ctx.fillText(`${String(r.mode).toUpperCase().padEnd(11)} ${String(r.seed).padEnd(11)} ${String(r.score).padEnd(7)} ${String(r.kills).padEnd(6)} ${String(r.sector).padEnd(7)} ${String(r.seconds+'s').padEnd(6)} ${String(r.accuracy+'%').padEnd(5)} ${r.avgThreat}/${r.peakThreat}`,112,y);y+=31;});
  const chart={x:112,y:430,w:W-224,h:130};ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(chart.x,chart.y,chart.w,chart.h);
  ctx.strokeStyle='rgba(120,150,180,.25)';for(let q=0;q<=4;q++){ctx.beginPath();ctx.moveTo(chart.x,chart.y+q*chart.h/4);ctx.lineTo(chart.x+chart.w,chart.y+q*chart.h/4);ctx.stroke();}
  const cc=['#5fd0ff','#ffb648','#ff6bd0','#7CFF9B'];rows.slice(0,4).forEach((r,ri)=>{if(!r.trace||r.trace.length<2)return;ctx.strokeStyle=cc[ri];ctx.lineWidth=2;ctx.beginPath();
    r.trace.forEach((v,i)=>{const xx=chart.x+i/(r.trace.length-1)*chart.w,yy=chart.y+chart.h-(v[0]/100)*chart.h;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);});ctx.stroke();
    ctx.fillStyle=cc[ri];ctx.font='10px Consolas';ctx.fillText((ri+1)+': '+r.mode.toUpperCase(),chart.x+ri*140,chart.y+chart.h+15);});
  ctx.fillStyle=UI.dim;ctx.textAlign='center';ctx.fillText(rows.length?'Threat traces for the four latest runs - click a row to replay its seed':'Complete a run to create comparable evidence',W/2,590);
  menuBtn({x:W/2-100,y:638,w:200,h:44},'BACK');
}
function handleHistoryClick(p){
  if(p.y>=638){G.state='setup';return;}
  const i=Math.floor((p.y-177)/31);if(i>=0&&i<G.meta.history.length){G.replaySeed=G.meta.history[i].seed;G.state='setup';G.daily=false;}
}

const advancedSetupBtns={
  director:{x:730,y:200,w:480,h:50},history:{x:370,y:542,w:240,h:24},resume:{x:370,y:584,w:240,h:34}
};
function drawAdvancedSetupWidgets(){
  const d=DIRECTOR_MODES[G.directorMode]||DIRECTOR_MODES.fuzzy,b=advancedSetupBtns.director;
  ctx.fillStyle=inRect(mouse,b)?'rgba(95,208,255,.20)':'rgba(11,26,41,.88)';roundRect(b.x,b.y,b.w,b.h,9);ctx.fill();
  ctx.strokeStyle=inRect(mouse,b)?UI.accent:'rgba(95,208,255,.28)';ctx.lineWidth=1.2;ctx.stroke();ctx.textAlign='left';
  ctx.fillStyle='#6f8da7';ctx.font='9px Consolas';ctx.fillText('ACTIVE DIRECTOR  /  CLICK TO CHANGE',b.x+14,b.y+17);
  ctx.fillStyle=UI.accent;ctx.font='bold 13px Consolas';ctx.fillText(d.name,b.x+14,b.y+37);
  ctx.textAlign='right';ctx.fillStyle=UI.dim;ctx.font='10px Consolas';ctx.fillText(d.desc,b.x+b.w-14,b.y+37);
  menuBtn(advancedSetupBtns.history,'RUN ARCHIVE');
  if(hasSavedRun())menuBtn(advancedSetupBtns.resume,'RESUME SAVED RUN','rgba(124,255,155,.20)');
  else {const r=advancedSetupBtns.resume;ctx.fillStyle='rgba(14,29,45,.55)';roundRect(r.x,r.y,r.w,r.h,8);ctx.fill();ctx.strokeStyle='rgba(120,150,180,.15)';ctx.stroke();
    ctx.fillStyle='#526779';ctx.font='bold 11px Consolas';ctx.textAlign='center';ctx.fillText('NO SAVED RUN',r.x+r.w/2,r.y+22);}
  if(G.replaySeed!=null){ctx.fillStyle=UI.ammo;ctx.font='bold 10px Consolas';ctx.textAlign='right';ctx.fillText('REPLAY SEED '+G.replaySeed,b.x+b.w,b.y+68);}
}
function handleAdvancedSetupClick(p){
  if(inRect(p,advancedSetupBtns.director)){cycleDirectorMode();if(window.Sound)Sound.ui();return true;}
  if(inRect(p,advancedSetupBtns.history)){G.state='history';if(window.Sound)Sound.ui();return true;}
  if(hasSavedRun()&&inRect(p,advancedSetupBtns.resume)){resumeSavedRun();if(window.Sound)Sound.ui();return true;}
  return false;
}
function moduleButtonForCard(c){return {x:c.x+35,y:c.y+276,w:300,h:18};}
function drawModuleChip(c){
  const b=moduleButtonForCard(c),m=currentModule(c.key),owned=G.meta.weapons[c.key].owned;
  ctx.fillStyle=owned?(inRect(mouse,b)?'rgba(95,208,255,.30)':'rgba(95,208,255,.12)'):'rgba(30,40,50,.5)';roundRect(b.x,b.y,b.w,b.h,6);ctx.fill();
  ctx.strokeStyle=owned?UI.accent:'#556';ctx.stroke();ctx.fillStyle=owned?UI.accent:'#667';ctx.font='bold 10px Consolas';ctx.textAlign='center';
  ctx.fillText('MODULE: '+m.name+'  [click to cycle]',b.x+b.w/2,b.y+13);
}
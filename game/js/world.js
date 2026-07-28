"use strict";
/* ----------------------------------------------------------------------------
   world.js — the maze world: generation, wall collision, line-of-sight,
   fog hiding zones, and the prerendered minimap.
   World = 39×23 tiles of 100px → 3900×2300 px, regenerated every deploy.
   ---------------------------------------------------------------------------- */
const TILE=100, MW=39, MH=23;
const WORLD_W=MW*TILE, WORLD_H=MH*TILE;
let solid=[], fogs=[], breakable=[];         // breakable[r][c] = destructible wall tile

/* world RNG — Math.random by default; a seeded stream for the DAILY challenge
   so the maze (and sector sequence) is identical for everyone on a given day. */
let worldRand=Math.random, worldSeed=0, worldSeedState=0;
function rand(){ return worldRand(); }
function setWorldSeed(seed){
  if(seed==null){ worldRand=Math.random; worldSeed=0; worldSeedState=0; return; }
  worldSeed=seed>>>0; worldSeedState=worldSeed;
  worldRand=function(){ let s=worldSeedState=(worldSeedState+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
}
function getWorldSeedState(){ return {seed:worldSeed,state:worldSeedState}; }
function setWorldSeedState(o){ setWorldSeed(o&&o.seed); if(o)worldSeedState=o.state|0; }
function dailySeed(){ const d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }

const MM_W=272, MM_H=160;                 // minimap prerender (walls + fog)
const mmCanvas=document.createElement('canvas');
mmCanvas.width=MM_W; mmCanvas.height=MM_H;

function genWorld(){
  const theme=(typeof G!=='undefined'&&G.theme)?G.theme.id:'lab';
  // start fully solid; carve a maze with recursive backtracking
  solid=Array.from({length:MH},()=>Array(MW).fill(true));
  const CW=(MW-1)/2, CH=(MH-1)/2;
  const vis=Array.from({length:CH},()=>Array(CW).fill(false));
  const stack=[[0,0]]; vis[0][0]=true; solid[1][1]=false;
  while(stack.length){
    const [ci,cj]=stack[stack.length-1];
    const dirs=[[0,1],[0,-1],[1,0],[-1,0]].filter(([di,dj])=>{
      const ni=ci+di,nj=cj+dj;
      return ni>=0&&ni<CH&&nj>=0&&nj<CW&&!vis[ni][nj];
    });
    if(!dirs.length){stack.pop();continue;}
    const [di,dj]=dirs[(rand()*dirs.length)|0];
    const ni=ci+di,nj=cj+dj;
    vis[ni][nj]=true;
    solid[2*ni+1][2*nj+1]=false;
    solid[2*ci+1+di][2*cj+1+dj]=false;
    stack.push([ni,nj]);
  }
  // braiding: open ~22% of removable walls so the maze has loops, not dead ends
  for(let r=1;r<MH-1;r++)for(let c=1;c<MW-1;c++){
    if(!solid[r][c])continue;
    const h=!solid[r][c-1]&&!solid[r][c+1], v=!solid[r-1][c]&&!solid[r+1][c];
    const braid=theme==='infested'?0.12:theme==='foundry'?0.30:0.22;
    if((h||v)&&rand()<braid) solid[r][c]=false;
  }
  // a few open plazas for big fights
  const plazaCount=theme==='lab'?10:theme==='cryo'?9:theme==='infested'?4:7;
  for(let k=0;k<plazaCount;k++){
    const r0=1+((rand()*(MH-6))|0), c0=1+((rand()*(MW-6))|0);
    for(let r=r0;r<Math.min(MH-1,r0+4);r++)
      for(let c=c0;c<Math.min(MW-1,c0+4);c++) solid[r][c]=false;
  }
  // recognizable sector templates: laboratory bays, foundry lanes, archive crossways
  if(theme==='lab')for(const c0 of [7,19,31])for(let r=7;r<=11;r++)for(let c=c0-2;c<=c0+2;c++)solid[r][c]=false;
  if(theme==='foundry')for(const r of [5,11,17])for(let c=2;c<MW-2;c++)if(c%7!==0)solid[r][c]=false;
  if(theme==='cryo'){const cr=(MH/2)|0,cc=(MW/2)|0;for(let c=2;c<MW-2;c++)solid[cr][c]=false;for(let r=2;r<MH-2;r++)solid[r][cc]=false;}
  // flag ~10% of interior walls as DESTRUCTIBLE (blasts carve them open)
  breakable=Array.from({length:MH},()=>Array(MW).fill(false));
  for(let r=1;r<MH-1;r++)for(let c=1;c<MW-1;c++)
    if(solid[r][c] && rand()<0.10) breakable[r][c]=true;
  // fog hiding zones
  fogs=[];
  const fogCount=theme==='blackout'?15:theme==='infested'?12:9;
  for(let k=0;k<fogCount;k++){ const t=randomOpenTile();
    fogs.push({x:t.x,y:t.y,r:130+rand()*60}); }
  rebuildMinimap();
}
function rebuildMinimap(){
  // prerender minimap walls + fog
  const m=mmCanvas.getContext('2d');
  const sx=MM_W/WORLD_W, sy=MM_H/WORLD_H;
  m.fillStyle='rgba(8,14,22,0.95)';m.fillRect(0,0,MM_W,MM_H);
  m.fillStyle='rgba(80,140,200,0.5)';
  for(let r=0;r<MH;r++)for(let c=0;c<MW;c++)
    if(solid[r][c]) m.fillRect(c*TILE*sx,r*TILE*sy,TILE*sx+0.5,TILE*sy+0.5);
  m.fillStyle='rgba(170,180,200,0.3)';
  for(const f of fogs){m.beginPath();m.arc(f.x*sx,f.y*sy,f.r*sx,0,7);m.fill();}
}

function isSolidAt(x,y){
  const c=(x/TILE)|0, r=(y/TILE)|0;
  if(r<0||r>=MH||c<0||c>=MW) return true;
  return solid[r][c];
}
/* carve a destructible wall tile at (x,y) — returns true if one was destroyed */
function breakWallAt(x,y){
  const c=(x/TILE)|0, r=(y/TILE)|0;
  if(r<1||r>=MH-1||c<1||c>=MW-1||!solid[r][c]||!breakable[r][c]) return false;
  solid[r][c]=false; breakable[r][c]=false; return true;
}
/* circle vs wall-tiles overlap test (closest-point) */
function circleHits(x,y,rad){
  const c0=Math.max(0,Math.floor((x-rad)/TILE)), c1=Math.min(MW-1,Math.floor((x+rad)/TILE));
  const r0=Math.max(0,Math.floor((y-rad)/TILE)), r1=Math.min(MH-1,Math.floor((y+rad)/TILE));
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
    if(!solid[r][c])continue;
    const nx=Math.max(c*TILE,Math.min(x,c*TILE+TILE));
    const ny=Math.max(r*TILE,Math.min(y,r*TILE+TILE));
    if((x-nx)*(x-nx)+(y-ny)*(y-ny) < rad*rad) return true;
  }
  return false;
}
/* axis-separated movement: lets entities slide along walls */
function moveCircle(o,dx,dy){
  if(dx&&!circleHits(o.x+dx,o.y,o.r)) o.x+=dx;
  if(dy&&!circleHits(o.x,o.y+dy,o.r)) o.y+=dy;
}
/* line of sight: sample the segment against wall tiles */
function los(x1,y1,x2,y2){
  const d=Math.hypot(x2-x1,y2-y1), steps=Math.ceil(d/24);
  for(let i=1;i<steps;i++){ const t=i/steps;
    if(isSolidAt(x1+(x2-x1)*t,y1+(y2-y1)*t)) return false; }
  return true;
}
function fogAt(x,y){ for(const f of fogs) if(Math.hypot(x-f.x,y-f.y)<f.r) return f; return null; }

function randomOpenTile(){
  for(let i=0;i<300;i++){ const r=(rand()*MH)|0,c=(rand()*MW)|0;
    if(!solid[r][c]) return {x:c*TILE+TILE/2,y:r*TILE+TILE/2}; }
  return {x:TILE*1.5,y:TILE*1.5};
}
function openTileNear(px,py,minD,maxD){
  for(let i=0;i<50;i++){ const t=randomOpenTile();
    const d=Math.hypot(t.x-px,t.y-py);
    if(d>=minD&&d<=maxD) return t; }
  return randomOpenTile();
}
function spawnPlayerPos(){       // open tile nearest the world centre
  let best=null,bd=1e9;
  for(let r=0;r<MH;r++)for(let c=0;c<MW;c++) if(!solid[r][c]){
    const x=c*TILE+TILE/2,y=r*TILE+TILE/2, d=Math.hypot(x-WORLD_W/2,y-WORLD_H/2);
    if(d<bd){bd=d;best={x,y};} }
  return best;
}

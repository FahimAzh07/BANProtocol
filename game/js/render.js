"use strict";
/* ----------------------------------------------------------------------------
   render.js — shared UI palette, draw helpers, characters, and the world.
   Player and enemies are visually distinct: the player is an armored humanoid
   with a pulsing cyan team-ring and rifle; enemies are spiked organic
   creatures with glowing eyes (grunt / runner / brute archetypes).
   ---------------------------------------------------------------------------- */

/* One palette for every UI element — keeps the interface consistent */
const UI={
  panelTop:'rgba(18,26,40,0.92)', panelBot:'rgba(9,14,23,0.92)',
  line:'rgba(95,170,255,0.28)',   accent:'#5fd0ff',
  text:'#e8f4ff', dim:'#8fa9c4',
  good:'#46e08c', warn:'#ffb648', bad:'#ff4d6d',
  ammo:'#ffd36b', noiseCol:'#9b7bff', player:'#39c2ff',
  display:'Orbitron, "Segoe UI", sans-serif',   // display font for big titles
};

/* additive radial light — used for the player aura, muzzle flash, explosions */
function radialLight(x,y,r,rgb,a){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  g.addColorStop(1,`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
}
let BEAT=0;   // 0–1 music beat pulse (set each frame in main.js from Sound.beat())
function drawLights(){
  ctx.save();ctx.globalCompositeOperation='lighter';
  radialLight(G.player.x,G.player.y,150+BEAT*55,[80,190,255],0.10+BEAT*0.14);   // aura throbs on the beat
  for(const l of G.lights) radialLight(l.x,l.y,l.r,l.rgb,(l.life/l.max)*0.5);
  ctx.restore();
}
function drawRings(){
  for(const r of G.rings){ const a=r.life/r.max;
    ctx.strokeStyle=`rgba(${r.rgb[0]},${r.rgb[1]},${r.rgb[2]},${a*0.8})`;
    ctx.lineWidth=3*a+1;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke(); }
}

/* threat-reactive colour: cool cyan (Passive) → amber → hot red (Overwhelming) */
function lerp3(a,b,t){ return [Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)]; }
function threatRGB(){ const live=G.directorThreat==null?G.fuzzy.threat:G.directorThreat,t=Math.max(0,Math.min(1,(live||0)/100));
  return t<0.5 ? lerp3([95,170,255],[255,175,80],t/0.5) : lerp3([255,175,80],[255,70,95],(t-0.5)/0.5); }

/* battle-worn floor decals: scorch marks (persistent) + blood pools (fade) */
function drawDecals(){
  for(const d of G.scorch){
    const g=ctx.createRadialGradient(d.x,d.y,1,d.x,d.y,d.r);
    g.addColorStop(0,'rgba(6,5,5,0.85)');g.addColorStop(0.5,'rgba(22,13,9,0.5)');g.addColorStop(1,'rgba(22,13,9,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,7);ctx.fill();
  }
  for(const b of G.bloodPools){ const a=Math.min(1,b.life/180)*0.5;
    const g=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,b.r);
    g.addColorStop(0,`rgba(120,18,28,${a})`);g.addColorStop(1,'rgba(120,18,28,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
  }
}

/* drifting dust / embers — screen-space with subtle parallax + twinkle */
let _dust=null;
function drawDust(){
  if(G.meta && G.meta.opts && !G.meta.opts.motion) return;   // reduced-motion setting
  if(!_dust){ _dust=[]; for(let i=0;i<46;i++)_dust.push({x:Math.random()*W,y:Math.random()*H,z:0.3+Math.random()*0.7,ph:Math.random()*7}); }
  const rgb=threatRGB();
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const m of _dust){
    m.x+=0.18*m.z; m.y+=Math.cos(G.t*0.012+m.ph)*0.12*m.z;
    let sx=m.x-G.cam.x*0.12*m.z, sy=m.y-G.cam.y*0.12*m.z;
    sx=((sx%W)+W)%W; sy=((sy%H)+H)%H;
    const tw=0.4+0.6*Math.abs(Math.sin(G.t*0.04+m.ph));
    ctx.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.05*tw*m.z+0.015})`;
    ctx.beginPath();ctx.arc(sx,sy,m.z*1.5,0,7);ctx.fill();
  }
  ctx.restore();
}

function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function shade(hex,amt){ if(hex[0]!=='#')return hex;
  let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const f=amt<0?0:255,t=Math.abs(amt);
  r=Math.round(r+(f-r)*t);g=Math.round(g+(f-g)*t);b=Math.round(b+(f-b)*t);
  return `rgb(${r},${g},${b})`; }

/* Modern panel: soft gradient, hairline border, accent title + divider */
function panel(x,y,w,h,title){
  const g=ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,UI.panelTop);g.addColorStop(1,UI.panelBot);
  ctx.fillStyle=g;roundRect(x,y,w,h,10);ctx.fill();
  ctx.strokeStyle=UI.line;ctx.lineWidth=1;roundRect(x,y,w,h,10);ctx.stroke();
  if(title){
    ctx.fillStyle=UI.accent;ctx.font='bold 12px Consolas';ctx.textAlign='left';
    ctx.fillText(title,x+14,y+19);
    ctx.strokeStyle='rgba(95,170,255,0.15)';ctx.beginPath();
    ctx.moveTo(x+12,y+26);ctx.lineTo(x+w-12,y+26);ctx.stroke();
  }
}

/* Pseudo-3D characters */
function drawCharacterLegacy(x,y,angle,opts){
  const {scale=1,body=UI.player,accent='#0a2a4a',walk=0,recoil=0,lunge=0,enemy=false,hue=null,player=false}=opts;
  ctx.save();ctx.translate(x,y);
  // drop shadow
  ctx.save();ctx.scale(1,0.5);ctx.beginPath();ctx.arc(0,18*scale,16*scale,0,7);
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fill();ctx.restore();
  // player team-ring (drawn unrotated so it reads as ground marker)
  if(player){
    const pulse=2+Math.sin(G.t*0.12)*1.5;
    ctx.strokeStyle='rgba(95,208,255,0.7)';ctx.lineWidth=2;
    ctx.save();ctx.scale(1,0.55);
    ctx.beginPath();ctx.arc(0,16*scale,(20+pulse)*scale,0,7);ctx.stroke();
    ctx.globalAlpha=0.25;ctx.lineWidth=6;
    ctx.beginPath();ctx.arc(0,16*scale,(20+pulse)*scale,0,7);ctx.stroke();
    ctx.restore();ctx.globalAlpha=1;
  }
  ctx.rotate(angle);
  const bob=Math.sin(walk)*2*scale, lunged=lunge*scale;
  function sphere(cx,cy,r,col,light='#ffffff'){
    const g=ctx.createRadialGradient(cx-r*0.35,cy-r*0.4,r*0.1,cx,cy,r);
    g.addColorStop(0,light);g.addColorStop(0.25,col);g.addColorStop(1,shade(col,-0.55));
    ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle=g;ctx.fill();
  }

  if(enemy){
    /* ---- spiked organic creature ---- */
    ctx.fillStyle=`hsla(${hue},70%,30%,1)`;
    ctx.beginPath();
    const spikes=7;
    for(let i=0;i<spikes;i++){
      const sa=i/spikes*Math.PI*2;
      const r2=(16+Math.sin(walk*2+i*1.7)*2.5)*scale, r1=10*scale;
      ctx.lineTo(Math.cos(sa)*r2,Math.sin(sa)*r2+bob);
      ctx.lineTo(Math.cos(sa+0.45)*r1,Math.sin(sa+0.45)*r1+bob);
    }
    ctx.closePath();ctx.fill();
    sphere(lunged,bob,11*scale,body);                      // main body blob
    ctx.fillStyle='#160409';                               // maw
    ctx.beginPath();ctx.arc(7*scale+lunged,bob,4.2*scale,-1,1);ctx.fill();
    ctx.shadowBlur=9;ctx.shadowColor=`hsl(${hue},100%,65%)`;
    ctx.fillStyle=`hsl(${hue},100%,78%)`;                  // glowing eyes
    ctx.beginPath();ctx.arc(9.5*scale+lunged,-3.5*scale+bob,1.8*scale,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(9.5*scale+lunged,3.5*scale+bob,1.8*scale,0,7);ctx.fill();
    ctx.shadowBlur=0;
  } else {
    /* ---- armored humanoid operative ---- */
    const lp=Math.sin(walk)*4*scale;
    ctx.strokeStyle=shade(body,-0.4);ctx.lineWidth=6*scale;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-2*scale,4*scale);ctx.lineTo(-6*scale,12*scale+lp);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-2*scale,-4*scale);ctx.lineTo(-6*scale,-12*scale-lp);ctx.stroke();
    sphere(lunged-2*scale,bob,12*scale,body);              // torso
    ctx.beginPath();ctx.arc(2*scale+lunged,bob,7*scale,-1,1);ctx.fillStyle=shade(accent,0.1);ctx.fill();
    sphere(0,-9*scale+bob,5*scale,body); sphere(0,9*scale+bob,5*scale,body);  // shoulders
    sphere(8*scale+lunged,bob,7*scale,'#dfeefc','#ffffff');                   // helmet
    ctx.fillStyle='#0bf';ctx.globalAlpha=0.9;                                  // visor
    ctx.beginPath();ctx.ellipse(11*scale,bob,3*scale,4*scale,0,0,7);ctx.fill();ctx.globalAlpha=1;
    ctx.fillStyle=UI.accent;                                                   // antenna light
    ctx.beginPath();ctx.arc(4*scale,-11*scale+bob,1.4*scale,0,7);ctx.fill();
    if(player){
      ctx.strokeStyle=shade(body,-0.2);ctx.lineWidth=5*scale;                  // arms + rifle
      ctx.beginPath();ctx.moveTo(2*scale,6*scale+bob);ctx.lineTo(16*scale-recoil,4*scale+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(2*scale,-6*scale+bob);ctx.lineTo(16*scale-recoil,-1*scale+bob);ctx.stroke();
      ctx.fillStyle='#11161d';ctx.fillRect(14*scale-recoil,-2*scale+bob,14*scale,4*scale);
      ctx.fillStyle='#222a33';ctx.fillRect(16*scale-recoil,1*scale+bob,5*scale,5*scale);
      if(G.player.muzzle>0){ ctx.save();ctx.translate(28*scale-recoil,bob);
        ctx.fillStyle='rgba(255,220,120,'+(G.player.muzzle/4)+')';ctx.beginPath();
        for(let i=0;i<8;i++){const a=i/8*7,rr=(i%2?3:8)*scale*(0.6+G.player.muzzle/4);ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
        ctx.closePath();ctx.fill();ctx.restore(); }
    }
  }
  ctx.restore();
}

/* v7.2 character language: crisp tactical silhouettes for the operative and
   role-specific creature bodies. Everything remains canvas-native and scales
   cleanly for the setup preview, normal play, and accessibility zoom. */
function drawCharacter(x,y,angle,opts){
  const {scale=1,body=UI.player,accent='#0a2a4a',walk=0,recoil=0,lunge=0,
    enemy=false,player=false,type='grunt',elite=null,hue=0}=opts;
  const S=scale,bob=Math.sin(walk)*1.15*S,step=Math.sin(walk)*3.2*S;
  ctx.save();ctx.translate(x,y);
  // grounded soft shadow and restrained team marker
  ctx.save();ctx.scale(1,.48);ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(0,24*S,18*S,11*S,0,0,7);ctx.fill();ctx.restore();
  if(player){ctx.save();ctx.scale(1,.55);ctx.strokeStyle='rgba(76,202,255,.48)';ctx.lineWidth=1.5*S;
    ctx.beginPath();ctx.arc(0,18*S,(20+Math.sin(G.t*.1))*S,0,7);ctx.stroke();ctx.restore();}
  ctx.rotate(angle);

  if(!enemy){
    // boots and segmented legs
    ctx.lineCap='round';ctx.strokeStyle='#101923';ctx.lineWidth=7*S;
    ctx.beginPath();ctx.moveTo(-5*S,-5*S);ctx.lineTo((-10*S)-step,-10*S);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-5*S,5*S);ctx.lineTo((-10*S)+step,10*S);ctx.stroke();
    ctx.fillStyle='#26384a';ctx.beginPath();ctx.ellipse((-12*S)-step,-10*S,5*S,3*S,-.2,0,7);ctx.fill();
    ctx.beginPath();ctx.ellipse((-12*S)+step,10*S,5*S,3*S,.2,0,7);ctx.fill();
    // armored torso with a readable forward point
    const tg=ctx.createLinearGradient(-12*S,0,15*S,0);tg.addColorStop(0,'#152638');tg.addColorStop(.55,body);tg.addColorStop(1,'#bdefff');
    ctx.fillStyle=tg;ctx.strokeStyle='#071019';ctx.lineWidth=2*S;ctx.beginPath();
    ctx.moveTo(-12*S,-10*S);ctx.lineTo(7*S,-12*S);ctx.lineTo(15*S,-6*S);ctx.lineTo(16*S,6*S);ctx.lineTo(7*S,12*S);ctx.lineTo(-12*S,10*S);ctx.lineTo(-16*S,0);ctx.closePath();ctx.fill();ctx.stroke();
    // shoulder plates and central armor seam
    ctx.fillStyle='#28445d';ctx.strokeStyle='#8bdfff';ctx.lineWidth=1*S;
    for(const sy of [-1,1]){roundRect(-1*S,sy*7*S-4*S,12*S,8*S,3*S);ctx.fill();ctx.stroke();}
    ctx.strokeStyle='rgba(170,230,255,.55)';ctx.beginPath();ctx.moveTo(-8*S,0);ctx.lineTo(7*S,0);ctx.stroke();
    // helmet + cyan visor
    ctx.fillStyle='#d9eaf4';ctx.strokeStyle='#071019';ctx.lineWidth=2*S;ctx.beginPath();ctx.arc(11*S,bob,7.4*S,0,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#08283b';ctx.beginPath();ctx.ellipse(14.2*S,bob,3.8*S,5*S,0,0,7);ctx.fill();
    ctx.fillStyle='#5fe5ff';ctx.shadowBlur=8*S;ctx.shadowColor='#42dfff';ctx.fillRect(14*S,-2.2*S+bob,2.2*S,4.4*S);ctx.shadowBlur=0;
    // arms and weapon silhouette change with equipped weapon
    ctx.strokeStyle='#1b2d3d';ctx.lineWidth=5*S;
    ctx.beginPath();ctx.moveTo(3*S,-7*S);ctx.lineTo((17*S)-recoil,-3*S);ctx.stroke();
    ctx.beginPath();ctx.moveTo(3*S,7*S);ctx.lineTo((17*S)-recoil,3*S);ctx.stroke();
    const gun=G.weapon||'rifle',gw=gun==='bazooka'?19:gun==='shotgun'?18:16,gh=gun==='bazooka'?7:4;
    ctx.fillStyle=gun==='bazooka'?'#3f4b54':'#101820';ctx.strokeStyle='#5d7182';ctx.lineWidth=1*S;
    ctx.fillRect((14*S)-recoil,-gh*S/2,gw*S,gh*S);ctx.strokeRect((14*S)-recoil,-gh*S/2,gw*S,gh*S);
    if(gun==='bazooka'){ctx.fillStyle='#ff7755';ctx.fillRect((29*S)-recoil,-4.5*S,4*S,9*S);}
    if(G.player.muzzle>0){ctx.fillStyle='rgba(255,211,107,.85)';ctx.shadowBlur=12*S;ctx.shadowColor='#ffd36b';ctx.beginPath();ctx.moveTo((31+gw-16)*S-recoil,0);
      ctx.lineTo((40+gw-16)*S-recoil,-5*S);ctx.lineTo((37+gw-16)*S-recoil,0);ctx.lineTo((40+gw-16)*S-recoil,5*S);ctx.closePath();ctx.fill();ctx.shadowBlur=0;}
  } else {
    const kind=type||'grunt',isBoss=kind==='boss',isBrute=kind==='brute'||isBoss;
    const core=kind==='spitter'?'#83ffad':kind==='medic'?'#62ffd1':kind==='commander'?'#d49cff':kind==='stalker'?'#6d8eb8':isBoss?'#ff5ad2':`hsl(${hue},68%,52%)`;
    // role-specific legs: fast types are swept, heavy types are planted
    ctx.strokeStyle=shade(core,-.62);ctx.lineWidth=(isBrute?7:4.5)*S;ctx.lineCap='round';
    const legN=isBrute?6:kind==='spitter'?4:kind==='runner'?4:5;
    for(let i=0;i<legN;i++){const a=(i/(legN-1)-.5)*2.5,back=kind==='runner'?-13:-8;
      ctx.beginPath();ctx.moveTo(-3*S,Math.sin(a)*8*S);ctx.lineTo((back-Math.cos(a)*7)*S,(Math.sin(a)*17+step*(i%2?.3:-.3))*S);ctx.stroke();}
    // primary silhouette
    ctx.strokeStyle='#110b13';ctx.lineWidth=2*S;
    const eg=ctx.createRadialGradient(5*S,-4*S,1*S,0,0,(isBrute?24:16)*S);eg.addColorStop(0,shade(core,.35));eg.addColorStop(.45,core);eg.addColorStop(1,shade(core,-.65));ctx.fillStyle=eg;
    ctx.beginPath();
    if(kind==='runner'){ctx.moveTo(18*S+lunge*S,0);ctx.lineTo(-8*S,-9*S);ctx.lineTo(-14*S,0);ctx.lineTo(-8*S,9*S);}
    else if(kind==='spitter'){ctx.ellipse(-3*S,0,17*S,13*S,0,0,7);}
    else if(isBrute){for(let i=0;i<8;i++){const a=i/8*7,r=(isBoss?27:20)*S;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}}
    else {for(let i=0;i<7;i++){const a=i/7*7,r=(i%2?12:16)*S;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}}
    ctx.closePath();ctx.fill();ctx.stroke();
    // unique role identifiers
    if(kind==='spitter'){ctx.fillStyle='#173725';ctx.beginPath();ctx.ellipse(14*S+lunge*S,0,9*S,6*S,0,0,7);ctx.fill();ctx.fillStyle='#9dffc0';ctx.beginPath();ctx.arc(20*S+lunge*S,0,3*S,0,7);ctx.fill();}
    if(kind==='medic'){ctx.strokeStyle='#c8ffe8';ctx.lineWidth=2.5*S;ctx.beginPath();ctx.arc(0,0,10*S,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(-5*S,0);ctx.lineTo(5*S,0);ctx.moveTo(0,-5*S);ctx.lineTo(0,5*S);ctx.stroke();}
    if(kind==='commander'){ctx.strokeStyle='#e3bdff';ctx.lineWidth=2*S;for(const sy of [-1,1]){ctx.beginPath();ctx.moveTo(-4*S,sy*8*S);ctx.lineTo(-12*S,sy*17*S);ctx.stroke();}}
    if(kind==='stalker'){ctx.strokeStyle='#9bc8ff';ctx.lineWidth=2*S;ctx.beginPath();ctx.arc(-2*S,0,10*S,-1.1,1.1);ctx.stroke();}
    // forward face and luminous eyes
    ctx.fillStyle='#10060a';ctx.beginPath();ctx.ellipse((isBrute?14:10)*S+lunge*S,0,(isBrute?7:5)*S,(isBrute?8:6)*S,0,0,7);ctx.fill();
    ctx.fillStyle=isBoss?'#fff':shade(core,.55);ctx.shadowBlur=9*S;ctx.shadowColor=core;
    for(const ey of [-3,3]){ctx.beginPath();ctx.arc((isBrute?17:12)*S+lunge*S,ey*S,1.6*S,0,7);ctx.fill();}ctx.shadowBlur=0;
    if(elite){ctx.strokeStyle=opts.eliteCol||'#fff';ctx.lineWidth=1.5*S;ctx.beginPath();ctx.arc(0,0,(isBrute?25:20)*S,0,7);ctx.stroke();}
  }
  ctx.restore();
}

/* threat-tinted vignette (screen space) */
function vignette(){
  const th=G.fuzzy.threat/100;
  const g=ctx.createRadialGradient(W/2,H/2,200,W/2,H/2,820);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(1,`rgba(${Math.round(th*120)},0,${Math.round(30+(1-th)*60)},0.45)`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
/* menu background (no camera/world) — opaque, since the canvas is transparent */
function drawGrid(){
  ctx.fillStyle='#06070d';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(40,90,120,0.15)';ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  vignette();
}
/* maze walls — raised 2.5D blocks with contact shadows + threat-tinted neon rims.
   Only the viewport tiles are touched (already culled). Three passes keep the
   look coherent: floor shadows ground the blocks, bodies give them height, and
   the neon rim is drawn ONLY on edges that face open floor (outlining the maze). */
const EXT=7;  // apparent block height (px)
function drawWalls(){
  const c0=Math.max(0,(G.cam.x/TILE)|0), c1=Math.min(MW-1,((G.cam.x+W)/TILE)|0);
  const r0=Math.max(0,(G.cam.y/TILE)|0), r1=Math.min(MH-1,((G.cam.y+H)/TILE)|0);
  const open=(rr,cc)=> rr<0||rr>=MH||cc<0||cc>=MW ? false : !solid[rr][cc];
  const rgb=threatRGB(), rim=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1,0.6+BEAT*0.35)})`;

  // PASS A — floor shadow, cast AWAY from the player (screen-space light source)
  const px=G.player.x, py=G.player.y;
  ctx.fillStyle='rgba(0,0,0,0.40)';
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){ if(!solid[r][c])continue;
    let dx=c*TILE+TILE/2-px, dy=r*TILE+TILE/2-py, dl=Math.hypot(dx,dy)||1;
    const off=Math.min(13,dl/38);
    ctx.fillRect(c*TILE+dx/dl*off, r*TILE+dy/dl*off+4, TILE, TILE); }

  // PASS B — block bodies: dark base (the front "thickness") + lighter raised top
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){ if(!solid[r][c])continue;
    const x=c*TILE,y=r*TILE, brk=breakable[r]&&breakable[r][c];
    ctx.fillStyle='#0a1320';ctx.fillRect(x,y,TILE,TILE);                 // side / thickness
    ctx.fillStyle=brk?'#3a2a18':'#16273b';ctx.fillRect(x,y,TILE,TILE-EXT); // raised top (destructible = amber)
    ctx.fillStyle='rgba(150,195,245,0.05)';ctx.fillRect(x,y,TILE,6);    // top sheen
    if(brk){ ctx.strokeStyle='rgba(255,150,80,0.45)';ctx.lineWidth=1;    // crack marks
      ctx.beginPath();ctx.moveTo(x+18,y+8);ctx.lineTo(x+40,y+34);ctx.lineTo(x+30,y+58);
      ctx.moveTo(x+62,y+14);ctx.lineTo(x+74,y+44);ctx.stroke(); }
  }

  // PASS C — neon rim on exposed edges only (bloom amplifies this; pulses on the beat)
  ctx.strokeStyle=rim;ctx.lineWidth=1.6+BEAT*1.2;ctx.shadowBlur=7+BEAT*11;ctx.shadowColor=rim;
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){ if(!solid[r][c])continue;
    const x=c*TILE,y=r*TILE;
    ctx.beginPath();
    if(open(r-1,c)){ctx.moveTo(x,y+0.5);ctx.lineTo(x+TILE,y+0.5);}                       // top
    if(open(r+1,c)){ctx.moveTo(x,y+TILE-EXT+0.5);ctx.lineTo(x+TILE,y+TILE-EXT+0.5);}     // front lip
    if(open(r,c-1)){ctx.moveTo(x+0.5,y);ctx.lineTo(x+0.5,y+TILE-EXT);}                   // left
    if(open(r,c+1)){ctx.moveTo(x+TILE-0.5,y);ctx.lineTo(x+TILE-0.5,y+TILE-EXT);}         // right
    ctx.stroke();
  }
  ctx.shadowBlur=0;
}
/* fog hiding zones — layered, drifting volumetric mist (over entities, so the
   player visually disappears inside) */
function drawFogClouds(){
  for(const f of fogs){
    if(f.x+f.r<G.cam.x||f.x-f.r>G.cam.x+W||f.y+f.r<G.cam.y||f.y-f.r>G.cam.y+H)continue;
    const dx=Math.sin(G.t*0.010+f.x*0.01)*7, dy=Math.cos(G.t*0.013+f.y*0.01)*7;
    for(let L=0;L<2;L++){
      const cx=f.x+dx*(L?-1:1), cy=f.y+dy, r=f.r*(L?0.72:1)+Math.sin(G.t*0.02+f.x+L)*6;
      const g=ctx.createRadialGradient(cx,cy,r*0.12,cx,cy,r);
      g.addColorStop(0,`rgba(172,182,206,${0.34-L*0.10})`);
      g.addColorStop(0.6,`rgba(150,165,196,${0.16-L*0.05})`);
      g.addColorStop(1,'rgba(150,165,196,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();
    }
  }
}
/* death-variety gib chunks (world space) */
function drawGibs(){ for(const g of G.gibs){ const a=Math.max(0,g.life/40);
  ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.rot);ctx.globalAlpha=a;ctx.fillStyle=g.col;
  ctx.fillRect(-g.size,-g.size,g.size*2,g.size*2);ctx.restore(); } ctx.globalAlpha=1; }

/* ambient weather (screen space) — embers / rain / flicker, per sector */
function drawWeather(){
  const w=G.weather; if(!w||w==='none') return;
  if(G.meta && G.meta.opts && !G.meta.opts.motion && w!=='flicker') return;   // reduced motion
  if(w==='embers'){ ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<44;i++){ const y=H-((G.t*0.6+i*89)%(H+40)), x=(i*151+Math.sin(G.t*0.02+i)*34)%W;
      ctx.fillStyle=`rgba(255,${150+((i*13)%80)},80,${0.12+0.1*Math.abs(Math.sin(G.t*0.05+i))})`;
      ctx.fillRect(x,y,2,2); } ctx.restore(); }
  else if(w==='rain'){ ctx.strokeStyle='rgba(150,180,230,0.18)';ctx.lineWidth=1;ctx.beginPath();
    for(let i=0;i<90;i++){ const x=(i*67+G.t*7)%W, y=(i*53+G.t*17)%H; ctx.moveTo(x,y);ctx.lineTo(x-4,y+14); }
    ctx.stroke(); }
  if(w==='flicker' && G.flicker>0){ ctx.fillStyle=`rgba(0,0,12,${G.flicker/10*0.4})`;ctx.fillRect(0,0,W,H); }
}

/* offscreen cache for the tech-grid floor (rebuilt only when the threat band
   changes) — one blit per frame instead of ~500 line/node draws */
const _floorGS=44, _floorCv=document.createElement('canvas');
_floorCv.width=W+_floorGS; _floorCv.height=H+_floorGS;
const _floorCtx=_floorCv.getContext('2d'); let _floorBand=-1;
function rebuildFloor(rgb){
  const c=_floorCtx, w=W+_floorGS, h=H+_floorGS; c.clearRect(0,0,w,h);
  c.strokeStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.06)`; c.lineWidth=1;
  for(let x=0;x<=w;x+=_floorGS){ c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke(); }
  for(let y=0;y<=h;y+=_floorGS){ c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke(); }
  c.fillStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.16)`;
  for(let x=0;x<=w;x+=_floorGS)for(let y=0;y<=h;y+=_floorGS) c.fillRect(x-0.9,y-0.9,1.8,1.8);
}

/* Phase-2 world entities: extraction beacon, exploding barrels, mines, turrets */
function drawRoguelite(){
  if(G.extract && !G.extract.done){ const e=G.extract, pu=1+Math.sin(G.t*0.1)*0.3;
    ctx.save();ctx.globalCompositeOperation='lighter';radialLight(e.x,e.y,e.r*2.4*pu,[120,255,160],0.16);ctx.restore();
    ctx.strokeStyle='#7CFF9B';ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor='#7CFF9B';
    ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,7);ctx.stroke();
    ctx.beginPath();ctx.arc(e.x,e.y,e.r*0.5*pu,0,7);ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#7CFF9B';ctx.font='bold 10px Consolas';ctx.textAlign='center';ctx.fillText('◎ EXTRACT',e.x,e.y-e.r-6);
  }
  for(const b of G.barrels){ ctx.save();ctx.translate(b.x,b.y);
    ctx.fillStyle='#b23a2a';ctx.beginPath();ctx.arc(0,0,b.r,0,7);ctx.fill();
    ctx.fillStyle='#ffb648';ctx.fillRect(-b.r,-3,b.r*2,2.2);                     // hazard stripe
    ctx.strokeStyle='#1a0f08';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.r,0,7);ctx.stroke();
    ctx.restore(); }
  for(const m of G.mines){ const on=m.arm>0?(G.t%20<10):((m.pulse||0)%14<7);
    ctx.save();ctx.fillStyle=m.arm>0?'#8899aa':(on?'#ff4d6d':'#552222');ctx.strokeStyle='#223';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(m.x,m.y,7,0,7);ctx.fill();ctx.stroke();
    if(on){ ctx.shadowBlur=8;ctx.shadowColor='#ff4d6d';ctx.fillStyle='#ff4d6d';
      ctx.beginPath();ctx.arc(m.x,m.y,2.4,0,7);ctx.fill();ctx.shadowBlur=0; } ctx.restore(); }
  for(const tr of G.turrets){ if(tr.life<120&&G.t%16<8)continue;   // blink out at end of life
    ctx.save();ctx.translate(tr.x,tr.y);
    ctx.fillStyle='#243444';ctx.strokeStyle='#5fd0ff';ctx.lineWidth=1.5;ctx.shadowBlur=6;ctx.shadowColor='#5fd0ff';
    ctx.beginPath();ctx.arc(0,0,9,0,7);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.rotate(tr.ang);ctx.fillStyle='#5fd0ff';ctx.fillRect(0,-2,16,4);ctx.restore(); }
}
function drawWorld(){
  // ---- layered floor: threat-tinted base wash + tech grid with glowing nodes ----
  const rgb=threatRGB();
  const fg=ctx.createRadialGradient(W/2,H*0.42,80,W/2,H/2,Math.max(W,H)*0.78);
  fg.addColorStop(0,`rgb(${10+((rgb[0]*0.05)|0)},${14+((rgb[1]*0.05)|0)},${22+((rgb[2]*0.05)|0)})`);
  fg.addColorStop(1,'#05070c');
  ctx.fillStyle=fg;ctx.fillRect(0,0,W,H);
  // tech grid + nodes from the offscreen cache (rebuilt only on threat-band change)
  const liveThreat=G.directorThreat==null?G.fuzzy.threat:G.directorThreat;
  const band=liveThreat<33?0:liveThreat<66?1:2;
  if(band!==_floorBand){ _floorBand=band; rebuildFloor(rgb); }
  const fox=-(G.cam.x%_floorGS), foy=-(G.cam.y%_floorGS);
  ctx.drawImage(_floorCv,fox,foy);
  if(BEAT>0.05){ ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=BEAT*0.5;   // beat pulse
    ctx.drawImage(_floorCv,fox,foy);ctx.restore(); }

  ctx.save();ctx.translate(-G.cam.x,-G.cam.y);
  drawDecals();          // scorch + blood on the floor, under the raised walls
  drawWalls();
  drawLights();
  drawRoguelite();       // extraction beacon, barrels, mines, turrets
  if(typeof drawAdvancedWorld==='function')drawAdvancedWorld();
  for(const k of G.pickups){ const yo=Math.sin(k.bob)*3;
    ctx.save();ctx.translate(k.x,k.y+yo);ctx.shadowBlur=15;
    if(k.type==='power'){ const def=POWERUPS[k.kind];
      ctx.shadowColor=def.col;ctx.strokeStyle=def.col;ctx.fillStyle=def.col;
      ctx.lineWidth=2;                                       // spinning hex + initial
      ctx.beginPath();
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2+k.bob*0.5;
        i===0?ctx.moveTo(Math.cos(a)*11,Math.sin(a)*11):ctx.lineTo(Math.cos(a)*11,Math.sin(a)*11);}
      ctx.closePath();ctx.stroke();
      ctx.font='bold 11px Consolas';ctx.textAlign='center';
      ctx.fillText(def.icon,0,4);
    } else {
      ctx.shadowColor=k.type==='hp'?UI.good:UI.ammo;ctx.fillStyle=k.type==='hp'?UI.good:UI.ammo;
      if(k.type==='hp'){ctx.fillRect(-3,-9,6,18);ctx.fillRect(-9,-3,18,6);}
      else{ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(7,7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();}
    }
    ctx.restore(); }
  const frozen=G.power.freeze>0;
  for(const e of G.enemies){
    if(e.x<G.cam.x-80||e.x>G.cam.x+W+80||e.y<G.cam.y-80||e.y>G.cam.y+H+80)continue;
    if(e.elite){                                   // pulsing affix aura
      ctx.save();ctx.strokeStyle=e.eliteCol;ctx.lineWidth=2;
      ctx.globalAlpha=0.55+0.35*Math.sin(G.t*0.2+e.wob);ctx.shadowBlur=10;ctx.shadowColor=e.eliteCol;
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+6,0,7);ctx.stroke();ctx.restore();
    }
    if(e.boss && e.telegraph>0){                    // winding-up warning ring
      const g=1-e.telegraph/48;ctx.save();
      ctx.strokeStyle=`rgba(255,90,210,${0.85*(1-g)+0.15})`;ctx.lineWidth=3;ctx.shadowBlur=14;ctx.shadowColor='#ff5ad2';
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+8+g*72,0,7);ctx.stroke();ctx.restore();
    }
    if(e.stalker&&(fogAt(e.x,e.y)||e.mode==='wander'))ctx.globalAlpha=0.28;
    drawCharacter(e.x,e.y,Math.atan2(G.player.y-e.y,G.player.x-e.x),
      {scale:e.r/16,body:e.col,accent:'#220',walk:frozen?e.wob:G.t*0.15+e.wob,lunge:e.lunge,enemy:true,hue:e.hue,
       type:e.type,elite:e.elite,eliteCol:e.eliteCol});
    ctx.globalAlpha=1;
    if(frozen){ ctx.fillStyle='rgba(155,220,255,0.3)';
      ctx.beginPath();ctx.arc(e.x,e.y,e.r+4,0,7);ctx.fill(); }
    if(e.hp<e.maxhp){const bw=e.r*2;
      ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(e.x-bw/2,e.y-e.r-10,bw,4);
      ctx.fillStyle=UI.bad;ctx.fillRect(e.x-bw/2,e.y-e.r-10,bw*(e.hp/e.maxhp),4);}
    // micro-FIS state marker (debug view): blue=flee · amber=flank · red=swarm
    if(G.showRules){
      ctx.fillStyle=e.micro==='flee'?'#5fd0ff':e.micro==='flank'?'#ffb648':'#ff4d6d';
      ctx.beginPath();ctx.arc(e.x,e.y-e.r-16,2.4,0,7);ctx.fill();
    }
  }
  for(const b of G.bullets){ ctx.save();ctx.shadowBlur=10;ctx.shadowColor=UI.ammo;
    ctx.fillStyle='#fff3c4';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,210,120,.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx,b.y-b.vy);ctx.stroke();ctx.restore(); }
  for(const b of G.eBullets){ ctx.save();ctx.shadowBlur=12;ctx.shadowColor=b.col;   // enemy projectiles
    ctx.fillStyle=b.col;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,7);ctx.fill();
    ctx.globalAlpha=0.5;ctx.strokeStyle=b.col;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*1.6,b.y-b.vy*1.6);ctx.stroke();ctx.restore(); }
  drawCharacter(G.player.x,G.player.y,G.player.angle,
    {scale:1,body:UI.player,accent:'#0a2a4a',walk:G.player.walk,recoil:G.player.recoil,player:true});
  if(G.player.melee>0){ const p=G.player, g=p.melee/12; ctx.save();   // melee swipe arc
    ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.strokeStyle=`rgba(225,240,255,${g})`;ctx.lineWidth=4;ctx.shadowBlur=10;ctx.shadowColor='#dff';
    ctx.beginPath();ctx.arc(0,0,46,-0.85,0.85);ctx.stroke();ctx.restore(); }
  if(G.power.shield>0){            // shield bubble (blinks in the last 2 s)
    const blink=G.power.shield<120&&(G.t%20<10);
    if(!blink){ ctx.save();
      ctx.strokeStyle='rgba(95,208,255,0.8)';ctx.lineWidth=2;ctx.shadowBlur=18;ctx.shadowColor='#5fd0ff';
      ctx.beginPath();ctx.arc(G.player.x,G.player.y,28+Math.sin(G.t*0.15)*2,0,7);ctx.stroke();
      ctx.fillStyle='rgba(95,208,255,0.07)';ctx.fill();
      ctx.restore(); }
  }
  for(const s of G.particles){ ctx.globalAlpha=Math.max(0,s.life/30);ctx.fillStyle=s.col;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill();ctx.globalAlpha=1; }
  drawGibs();
  drawRings();
  drawFogClouds();
  ctx.textAlign='center';ctx.font='bold 14px Consolas';
  for(const f of G.floaters){ ctx.globalAlpha=Math.max(0,f.life/50);ctx.fillStyle=f.col;
    ctx.fillText(f.txt,f.x,f.y);ctx.globalAlpha=1; }
  ctx.restore();
  drawDust();
  drawWeather();
  vignette();
  if(G.flash>0){ const flashMul=G.meta&&G.meta.opts&&G.meta.opts.reducedFlash?0.16:0.8;
    ctx.fillStyle=`rgba(255,255,255,${(G.flash/14)*flashMul})`;ctx.fillRect(0,0,W,H); }
  // room-regeneration transition: fade to black at the midpoint where the maze swaps
  if(G.roomChangeTimer>0){ const tt=G.roomChangeTimer;
    const a=Math.min(1, tt>60 ? (120-tt)/60 : tt/60);
    ctx.fillStyle=`rgba(2,6,10,${a})`;ctx.fillRect(0,0,W,H);
    if(a>0.15){ const yy=(1-((tt%60)/60))*H;        // green reconfiguration sweep
      ctx.strokeStyle=`rgba(124,255,155,${a*0.55})`;ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor='#7CFF9B';
      ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke();ctx.shadowBlur=0; }
  }
}

"use strict";
/* ----------------------------------------------------------------------------
   hud.js — HUD & fuzzy-logic visualisation: vitals bars, threat gauge,
   four membership-function graphs, active-rules panel, buttons, crosshair.
   Also includes the Logic Dashboard (toggle with Tab).
   ---------------------------------------------------------------------------- */
function bar(x,y,w,h,frac,col,label,val){
  ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(x,y,w,h,h/2);ctx.fill();
  if(frac>0.02){
    const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,shade(col,-0.2));g.addColorStop(1,col);
    ctx.fillStyle=g;roundRect(x,y,Math.max(h,w*frac),h,h/2);ctx.fill();
  }
  ctx.fillStyle=UI.text;ctx.font='bold 11px Consolas';ctx.textAlign='left';ctx.fillText(label,x+8,y+h/2+4);
  ctx.textAlign='right';ctx.fillText(val,x+w-8,y+h/2+4);
}

function threatGauge(cx,cy,rad){
  const th=G.directorThreat==null?G.fuzzy.threat:G.directorThreat;
  const cols=G.meta.opts.colorblind?['#56b4e9','#f0e442','#d55e00']:[UI.player,UI.warn,UI.bad];
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,cy,rad,Math.PI*(1+i/3),Math.PI*(1+(i+1)/3));
    ctx.lineWidth=14;ctx.strokeStyle=cols[i];ctx.globalAlpha=0.3;ctx.stroke();}
  ctx.globalAlpha=1;
  const liveCol=th>66?UI.bad:th>33?UI.warn:UI.player;
  ctx.beginPath();ctx.arc(cx,cy,rad,Math.PI,Math.PI+Math.PI*(th/100));
  ctx.lineWidth=14;ctx.strokeStyle=liveCol;
  ctx.shadowBlur=14;ctx.shadowColor=liveCol;ctx.stroke();ctx.shadowBlur=0;
  const a=Math.PI+Math.PI*(th/100);
  ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);
  ctx.lineTo(cx+Math.cos(a)*(rad-4),cy+Math.sin(a)*(rad-4));ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy,5,0,7);ctx.fill();
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 22px Consolas';ctx.fillText(Math.round(th),cx,cy+38);
  const lbl=th>66?'OVERWHELMING':th>33?'TACTICAL':'PASSIVE';
  ctx.fillStyle=liveCol;ctx.font='bold 12px Consolas';ctx.fillText(lbl,cx,cy+56);
  ctx.fillStyle=UI.accent;ctx.font='bold 11px Consolas';ctx.fillText('THREAT / '+String(G.directorMode||'fuzzy').toUpperCase(),cx,cy-rad-12);
}

/* Membership-function graph (filled curves + grid + live readouts) */
function mfGraph(x,y,w,h,title,sets,value,colors){
  panel(x,y,w,h,title);
  const gx=x+14, gy=y+32, gw=w-28, gh=h-62;
  ctx.strokeStyle='rgba(120,160,200,0.12)';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const yy=gy+gh*i/4;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}
  for(let i=0;i<=4;i++){const xx=gx+gw*i/4;ctx.beginPath();ctx.moveTo(xx,gy);ctx.lineTo(xx,gy+gh);ctx.stroke();}
  ctx.strokeStyle='rgba(150,190,230,0.5)';ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.stroke();
  const terms=Object.keys(sets);
  terms.forEach((term,ci)=>{
    ctx.beginPath();ctx.moveTo(gx,gy+gh);
    for(let i=0;i<=gw;i++){const xv=i/gw*100,mu=sets[term](xv);ctx.lineTo(gx+i,gy+gh-mu*gh);}
    ctx.lineTo(gx+gw,gy+gh);ctx.closePath();
    ctx.globalAlpha=0.13;ctx.fillStyle=colors[ci];ctx.fill();ctx.globalAlpha=1;
    ctx.beginPath();
    for(let i=0;i<=gw;i++){const xv=i/gw*100,mu=sets[term](xv);const px=gx+i,py=gy+gh-mu*gh;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}
    ctx.strokeStyle=colors[ci];ctx.lineWidth=2.5;ctx.stroke();
  });
  const vx=gx+(value/100)*gw;
  ctx.strokeStyle='#fff';ctx.setLineDash([4,3]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(vx,gy-2);ctx.lineTo(vx,gy+gh);ctx.stroke();ctx.setLineDash([]);
  let best=-1,bestTerm='';
  terms.forEach((term,ci)=>{ const mu=sets[term](value);
    if(mu>0.01){ const py=gy+gh-mu*gh;
      ctx.fillStyle=colors[ci];ctx.beginPath();ctx.arc(vx,py,4,0,7);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(vx,py,4,0,7);ctx.stroke(); }
    if(mu>best){best=mu;bestTerm=term;} });
  ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='bold 13px Consolas';
  ctx.fillText(Math.round(value),x+w-14,y+19);
  const lw=gw/terms.length;
  terms.forEach((term,ci)=>{ const lx=gx+ci*lw;
    ctx.fillStyle=colors[ci];ctx.fillRect(lx,gy+gh+9,9,9);
    ctx.fillStyle= term===bestTerm?'#fff':UI.dim;ctx.font=(term===bestTerm?'bold ':'')+'10px Consolas';
    ctx.textAlign='left';ctx.fillText(term,lx+13,gy+gh+17); });
}

const btnRules ={x:W/2-110, y:H-36, w:100, h:24, label:'RULES [B]',   get on(){return G.showRules;}};
const btnGraphs={x:W/2+10,  y:H-36, w:100, h:24, label:'GRAPHS [V]',  get on(){return G.showGraphs;}};

/* weapon slots (1/2/3) — bottom-left above the toggle buttons */
const weaponPills=[
  {key:'rifle',  x:16,  y:H-80, w:104, h:28},
  {key:'shotgun',x:128, y:H-80, w:104, h:28},
  {key:'bazooka',x:240, y:H-80, w:104, h:28},
];
function drawWeaponPills(){
  weaponPills.forEach((b,i)=>{
    const owned=G.meta.weapons[b.key].owned, eq=G.weapon===b.key;
    ctx.fillStyle=eq?'rgba(60,160,255,0.35)':owned?'rgba(20,30,40,0.7)':'rgba(12,16,22,0.7)';
    roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
    ctx.strokeStyle=eq?UI.accent:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
    ctx.fillStyle=eq?UI.text:owned?'#9ab':'#556';ctx.font='bold 11px Consolas';ctx.textAlign='center';
    ctx.fillText(owned?`${i+1} ${WEAPONS[b.key].name}`:`${i+1} 🔒`,b.x+b.w/2,b.y+18);
  });
}

/* active power-ups — bottom-right, label + remaining-time bar */
function drawPowerPills(){
  let x=W-16;
  for(const k in G.power){
    if(G.power[k]<=0) continue;
    const def=POWERUPS[k], pw=130; x-=pw+8;
    ctx.fillStyle='rgba(10,16,26,0.85)';roundRect(x,H-44,pw,30,8);ctx.fill();
    ctx.strokeStyle=def.col;ctx.lineWidth=1.5;roundRect(x,H-44,pw,30,8);ctx.stroke();
    ctx.fillStyle=def.col;ctx.font='bold 10px Consolas';ctx.textAlign='left';
    ctx.fillText(def.label,x+10,H-31);
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x+10,H-25,pw-20,5);
    ctx.fillStyle=def.col;ctx.fillRect(x+10,H-25,(pw-20)*Math.min(1,G.power[k]/powDur(def)),5);
  }
}
function drawButton(b){
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=b.on?(hov?'rgba(95,208,255,0.4)':'rgba(60,160,255,0.3)')
                    :(hov?'rgba(40,60,80,0.8)':'rgba(20,30,40,0.7)');
  roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
  ctx.strokeStyle=b.on?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
  ctx.fillStyle=b.on?UI.text:'#89a';ctx.font='bold 11px Consolas';ctx.textAlign='center';
  ctx.fillText((b.on?'● ':'○ ')+b.label,b.x+b.w/2,b.y+b.h/2+4);
}

/* minimap: prerendered walls/fog + live dots (player cyan, enemies red) */
function drawMinimap(){
  panel(16,160,300,202,'TACTICAL MAP');
  const mx=30,my=190,sx=MM_W/WORLD_W,sy=MM_H/WORLD_H;
  ctx.drawImage(mmCanvas,mx,my);
  // viewport rectangle
  ctx.strokeStyle='rgba(95,208,255,0.5)';ctx.lineWidth=1;
  ctx.strokeRect(mx+G.cam.x*sx,my+G.cam.y*sy,W*sx,H*sy);
  // enemies as dots (elites tinted, boss = pinging magenta marker)
  for(const e of G.enemies){
    if(e.boss){
      const bx=mx+e.x*sx, by=my+e.y*sy, pulse=2+Math.abs(Math.sin(G.t*0.15))*2;
      if(G.bossPing>0){ ctx.strokeStyle=`rgba(255,90,220,${G.bossPing/110})`;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(bx,by,(110-G.bossPing)*0.4,0,7);ctx.stroke(); }   // expanding ping
      ctx.fillStyle='#ff5ad2';ctx.shadowBlur=8;ctx.shadowColor='#ff5ad2';
      ctx.beginPath();ctx.arc(bx,by,3.5+pulse*0.5,0,7);ctx.fill();ctx.shadowBlur=0;
    } else {
      ctx.fillStyle=e.elite?e.eliteCol:'#ff3b5c';
      ctx.beginPath();ctx.arc(mx+e.x*sx,my+e.y*sy,e.elite?2.8:2.2,0,7);ctx.fill();
    }
  }
  // player: pulsing cyan dot + facing line
  const px=mx+G.player.x*sx, py=my+G.player.y*sy;
  ctx.strokeStyle='#5fd0ff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(px,py);
  ctx.lineTo(px+Math.cos(G.player.angle)*11,py+Math.sin(G.player.angle)*11);ctx.stroke();
  ctx.fillStyle='#5fd0ff';ctx.shadowBlur=6;ctx.shadowColor='#5fd0ff';
  ctx.beginPath();ctx.arc(px,py,3+Math.sin(G.t*0.15),0,7);ctx.fill();
  ctx.shadowBlur=0;
  // extraction beacon marker
  if(G.extract && !G.extract.done){ ctx.strokeStyle='#7CFF9B';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(mx+G.extract.x*sx,my+G.extract.y*sy,3+Math.abs(Math.sin(G.t*0.1))*2,0,7);ctx.stroke(); }
  // sector + modifier label
  ctx.textAlign='left';ctx.font='bold 10px Consolas';ctx.fillStyle=UI.dim;
  ctx.fillText('SECTOR '+G.sector,30,354);
  if(G.sectorMod && G.sectorMod.id!=='none'){ ctx.fillStyle=G.sectorMod.col;ctx.fillText('◈ '+G.sectorMod.name,112,354); }
}

/* deployable cooldown chips (mine [E] · turret [T]) next to the weapon pills */
function drawDeployables(){
  const y=H-80, items=[['E','MINE',G.mineCd,45,true],['T','TURR',G.turretCd,180,G.run.turret]];
  let x=356;
  for(const it of items){ const w=64, cd=it[2], max=it[3], on=it[4];
    ctx.fillStyle=on?'rgba(20,30,40,0.7)':'rgba(12,16,22,0.6)';roundRect(x,y,w,28,8);ctx.fill();
    if(on&&cd>0){ ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(x,y,w*Math.min(1,cd/max),28,8);ctx.fill(); }
    ctx.strokeStyle=on?'rgba(120,150,180,0.4)':'rgba(80,90,100,0.3)';ctx.lineWidth=1.5;roundRect(x,y,w,28,8);ctx.stroke();
    ctx.fillStyle=on?UI.text:'#556';ctx.font='bold 10px Consolas';ctx.textAlign='center';
    ctx.fillText(it[0]+' '+it[1],x+w/2,y+18); x+=w+6; }
}
/* achievement toasts — slide up from the bottom-centre */
function drawAchToasts(){
  let y=G.enemies.some(e=>e.boss)?H-230:H-150;
  for(const a of G.achToasts){ const sl=Math.max(0,Math.min(1,(200-a.life)/15)*Math.min(1,a.life/22));
    const w=300,x=W/2-w/2; ctx.save();ctx.globalAlpha=sl;
    ctx.fillStyle='rgba(16,26,18,0.92)';roundRect(x,y,w,42,8);ctx.fill();
    ctx.strokeStyle='#7CFF9B';ctx.lineWidth=1.5;roundRect(x,y,w,42,8);ctx.stroke();
    ctx.fillStyle='#7CFF9B';ctx.font='bold 12px Consolas';ctx.textAlign='left';ctx.fillText('★ '+a.name,x+14,y+18);
    ctx.fillStyle=UI.dim;ctx.font='10px Consolas';ctx.fillText(a.desc,x+14,y+33);
    ctx.restore(); y-=48; }
}

/* killstreak / combo meter — centre-top, escalates in size & colour */
function drawComboMeter(){
  if(G.combo<2) return;
  const cx=W/2, cy=232, col = G.combo>=20?'#ff4d6d':G.combo>=10?'#ffb648':'#5fd0ff';
  const sz = 20+Math.min(18,G.combo);
  ctx.save();ctx.textAlign='center';
  ctx.fillStyle=col;ctx.shadowBlur=14;ctx.shadowColor=col;ctx.font='900 '+sz+'px '+UI.display;
  ctx.fillText('×'+G.combo,cx,cy);ctx.shadowBlur=0;
  ctx.fillStyle=UI.dim;ctx.font='bold 10px Consolas';ctx.fillText('COMBO',cx,cy+14);
  const bw=120, f=Math.max(0,G.comboTimer/150);              // shrinking timer bar
  ctx.fillStyle='rgba(0,0,0,0.5)';roundRect(cx-bw/2,cy+20,bw,5,2.5);ctx.fill();
  ctx.fillStyle=col;roundRect(cx-bw/2,cy+20,bw*f,5,2.5);ctx.fill();
  ctx.restore();
}
/* damage-direction indicator — red arc at the screen edge toward the last hit */
function drawDamageIndicator(){
  if(G.hitDirT<=0) return;
  const a=G.hitDirT/32;
  ctx.save();ctx.translate(W/2,H/2);ctx.rotate(G.hitDir);
  const g=ctx.createRadialGradient(0,0,H*0.32,0,0,H*0.5);
  g.addColorStop(0,'rgba(255,40,60,0)');g.addColorStop(1,`rgba(255,40,60,${a*0.5})`);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,H*0.5,-0.5,0.5);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
  ctx.restore();
}

/* centred, fading "WAVE N" / "BOSS WAVE N" announcement */
function drawWaveBanner(){
  const b=G.waveBanner; if(!b) return;
  const tIn=Math.min(1,(b.max-b.life)/18), tOut=Math.min(1,b.life/30);
  const a=Math.max(0,Math.min(tIn,tOut));
  const cx=W/2, cy=198-(1-tIn)*18, bw=b.boss?640:470, bh=72;
  ctx.save(); ctx.textAlign='center';
  const g=ctx.createLinearGradient(cx-bw/2,0,cx+bw/2,0);
  g.addColorStop(0,'rgba(8,12,20,0)');g.addColorStop(0.5,`rgba(8,12,20,${0.82*a})`);g.addColorStop(1,'rgba(8,12,20,0)');
  ctx.fillStyle=g; ctx.fillRect(cx-bw/2,cy-bh/2,bw,bh);
  ctx.globalAlpha=a*0.9; ctx.strokeStyle=b.col; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx-bw/2,cy-bh/2);ctx.lineTo(cx+bw/2,cy-bh/2);
  ctx.moveTo(cx-bw/2,cy+bh/2);ctx.lineTo(cx+bw/2,cy+bh/2);ctx.stroke();
  ctx.globalAlpha=a;
  ctx.fillStyle=b.col; ctx.shadowBlur=18; ctx.shadowColor=b.col;
  ctx.font=(b.boss?'900 40px ':'800 34px ')+UI.display;
  ctx.fillText(b.text,cx,cy+2); ctx.shadowBlur=0;
  ctx.fillStyle=UI.text; ctx.font='bold 14px Consolas';
  ctx.fillText(b.sub,cx,cy+27);
  ctx.restore();
}
/* persistent boss health bar (bottom-centre) while a Juggernaut is alive */
function drawBossBar(){
  const boss=G.enemies.find(e=>e.boss); if(!boss) return;
  const bw=460, bh=20, x=W/2-bw/2, y=H-126;
  ctx.fillStyle='rgba(8,12,20,0.85)'; roundRect(x-10,y-26,bw+20,bh+34,8); ctx.fill();
  ctx.strokeStyle='rgba(255,90,200,0.5)'; ctx.lineWidth=1.5; roundRect(x-10,y-26,bw+20,bh+34,8); ctx.stroke();
  ctx.fillStyle='#ff6bff'; ctx.font='bold 13px '+UI.display; ctx.textAlign='center';
  ctx.fillText('JUGGERNAUT',W/2,y-10);
  ctx.fillStyle='rgba(0,0,0,0.5)'; roundRect(x,y,bw,bh,bh/2); ctx.fill();
  const f=Math.max(0,boss.hp/boss.maxhp);
  if(f>0.02){ const g=ctx.createLinearGradient(x,0,x+bw,0);
    g.addColorStop(0,'#ff2d6d'); g.addColorStop(1,'#ff8bd0');
    ctx.fillStyle=g; roundRect(x,y,bw*f,bh,bh/2); ctx.fill(); }
}

function drawHUDLegacy(){
  const p=G.player, w=wstats(G.weapon);
  // hurt vignette (screen-space feedback, under the panels)
  if(G.hurt>0){ const a=(G.hurt/14)*0.35;
    const g=ctx.createRadialGradient(W/2,H/2,250,W/2,H/2,760);
    g.addColorStop(0,'rgba(255,0,40,0)');g.addColorStop(1,`rgba(255,0,40,${a})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H); }
  // vitals
  panel(16,16,300,136,'OPERATIVE VITALS');
  bar(28,38,276,18,p.hp/p.maxhp,UI.bad,'HEALTH',G.settings.god?'∞':Math.round(p.hp));
  bar(28,62,276,18,G.reloading>0?G.reloading:G.ammo/G.maxAmmo,UI.ammo,
      G.reloading>0?'RELOADING…':`${w.name} L${w.lvl}`,
      G.settings.god?'∞':(G.reloading>0?'':`${G.ammo}/${G.reserve}`));
  bar(28,86,276,18,G.noise/100,UI.noiseCol,'NOISE',Math.round(G.noise));
  bar(28,110,276,18,G.detect/100,'#ff9b4d','DETECTION',G.detect<15?'HIDDEN':Math.round(G.detect));
  drawMinimap();
  // mission
  panel(W-220,16,204,118,'MISSION');
  ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.textAlign='left';
  ctx.fillText('SCORE  '+G.score,W-205,48);ctx.fillText('KILLS  '+G.kills,W-205,66);
  ctx.fillText('WAVE   '+G.wave,W-205,84);
  ctx.fillStyle=UI.accent;ctx.fillText('SECTOR '+G.sector,W-120,84);ctx.fillStyle=UI.text;
  ctx.fillStyle=UI.ammo;ctx.fillText('COINS  '+G.meta.coins+'¢',W-205,102);
  // SUPPLY bar removed (no longer used)
  // threat gauge
  panel(W/2-110,16,220,148,'');
  threatGauge(W/2,124,60);
  // god-mode badge
  if(G.settings.god){
    roundRect(W/2-78,170,156,26,13);
    ctx.fillStyle='rgba(255,182,72,0.18)';ctx.fill();
    ctx.strokeStyle=UI.warn;ctx.lineWidth=1.5;roundRect(W/2-78,170,156,26,13);ctx.stroke();
    ctx.fillStyle=UI.warn;ctx.font='bold 12px Consolas';ctx.textAlign='center';
    ctx.fillText('⚡ GOD MODE (demo)',W/2,187);
  }
  // hidden-in-fog badge
  if(fogAt(p.x,p.y)){
    const hy=G.settings.god?202:170;
    roundRect(W/2-78,hy,156,26,13);
    ctx.fillStyle='rgba(95,208,255,0.15)';ctx.fill();
    ctx.strokeStyle=UI.accent;ctx.lineWidth=1.5;roundRect(W/2-78,hy,156,26,13);ctx.stroke();
    ctx.fillStyle=UI.accent;ctx.font='bold 12px Consolas';ctx.textAlign='center';
    ctx.fillText('◌ HIDDEN — in fog',W/2,hy+17);
  }

  drawButton(btnRules); drawButton(btnGraphs);
  drawWeaponPills(); drawPowerPills();
  if(G.advisor && G.advisor.weapon!==G.weapon && G.advisor.conf>0.55 && G.meta.weapons[G.advisor.weapon] && G.meta.weapons[G.advisor.weapon].owned){
    ctx.fillStyle='#9cf';ctx.font='bold 11px Consolas';ctx.textAlign='left';
    ctx.fillText('⌖ advisor: switch to '+G.advisor.weapon.toUpperCase(),16,H-88); }

  // MF graphs — now only the 4 inputs (HEALTH, AMMO, NOISE, PRESSURE)
  if(G.showGraphs){
    const gw=300, gh=90, gx=W-gw-16, step=96, y0=140;
    mfGraph(gx,y0+0*step,gw,gh,'HEALTH  (input)',  Fuzzy.health,  G._inputs.health,  [UI.bad,UI.warn,UI.good]);
    mfGraph(gx,y0+1*step,gw,gh,'AMMO  (input)',    Fuzzy.ammo,    G._inputs.ammo,    [UI.bad,UI.ammo,UI.good]);
    mfGraph(gx,y0+2*step,gw,gh,'NOISE  (input)',   Fuzzy.noise,   G._inputs.noise,   [UI.player,UI.warn,UI.bad]);
    mfGraph(gx,y0+3*step,gw,gh,'PRESSURE  (input)',Fuzzy.pressure,G._inputs.pressure,[UI.good,UI.warn,UI.bad]);
    // Removed EXPOSURE and SUPPLY graphs
  }
  // active rules — left, below the minimap
  if(G.showRules&&G.fuzzy.fired){
    const rh=Math.min(5,G.fuzzy.fired.length);
    panel(16,370,300,66+rh*34,'ACTIVE FUZZY RULES (top of '+ (typeof Fuzzy!=='undefined'?Fuzzy.rules.length:81) +')  ·  C: analytics');
    // "why this threat?" explainability line
    ctx.textAlign='left';ctx.font='10px Consolas';ctx.fillStyle=UI.dim;
    if(typeof G.fuzzy.explain === 'function' && typeof wrapText==='function') {
      wrapText(G.fuzzy.explain(), 28, 392, 276, 12);
    } else if(typeof Fuzzy !== 'undefined' && typeof Fuzzy.explain === 'function') {
      wrapText(Fuzzy.explain(G.fuzzy), 28, 392, 276, 12);
    }
    let yy=418;
    for(let i=0;i<rh;i++){ const fr=G.fuzzy.fired[i];
      // New rule structure: antecedentTerms array
      const terms = fr.rule.antecedentTerms || [];
      const ante = terms.map(t => t.slice(0,3)).join(' ∧ ');  // e.g., "Hig ∧ Low ∧ Med ∧ Hig"
      ctx.textAlign='left';ctx.font='10px Consolas';ctx.fillStyle='#9cf';ctx.fillText(`IF ${ante}`,28,yy);
      const outTerm = fr.rule.consequent || '?';
      ctx.fillStyle=outTerm==='High'?UI.bad:outTerm==='Medium'?UI.warn:UI.player;
      ctx.font='11px Consolas';ctx.fillText(`→ ${outTerm}`,28,yy+13);
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(186,yy+5,66,8);
      ctx.fillStyle=UI.accent;ctx.fillRect(186,yy+5,66*fr.strength,8);
      ctx.fillStyle='#7af';ctx.font='10px Consolas';ctx.textAlign='right';ctx.fillText((fr.strength*100|0)+'%',290,yy+13);
      yy+=34; }
  }
  drawDeployables();
  drawBossBar();
  drawComboMeter();
  drawDamageIndicator();
  drawAchToasts();
  drawWaveBanner();
  if(typeof drawObjectiveHUD==='function')drawObjectiveHUD();

  // crosshair — follows the mouse
  ctx.save();ctx.translate(mouse.x,mouse.y);
  ctx.strokeStyle=G.reloading>0?UI.warn:UI.accent;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,10,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-16,0);ctx.lineTo(-6,0);ctx.moveTo(6,0);ctx.lineTo(16,0);
  ctx.moveTo(0,-16);ctx.lineTo(0,-6);ctx.moveTo(0,6);ctx.lineTo(0,16);ctx.stroke();ctx.restore();
}

function cleanBar(x,y,w,value,col){
  ctx.fillStyle='rgba(255,255,255,.08)';roundRect(x,y,w,7,3.5);ctx.fill();
  if(value>0){ctx.fillStyle=col;roundRect(x,y,Math.max(7,w*Math.max(0,Math.min(1,value))),7,3.5);ctx.fill();}
}
function drawCompactMinimap(){
  const x=W-218,y=H-148,w=196,h=116,sx=w/WORLD_W,sy=h/WORLD_H;
  ctx.fillStyle='rgba(5,12,21,.82)';roundRect(x-8,y-26,w+16,h+34,10);ctx.fill();
  ctx.strokeStyle='rgba(95,208,255,.20)';roundRect(x-8,y-26,w+16,h+34,10);ctx.stroke();
  ctx.fillStyle='#7890a6';ctx.font='bold 9px Consolas';ctx.textAlign='left';ctx.fillText('TACTICAL MAP  /  SECTOR '+G.sector,x,y-10);
  ctx.save();roundRect(x,y,w,h,6);ctx.clip();ctx.drawImage(mmCanvas,x,y,w,h);
  ctx.strokeStyle='rgba(95,208,255,.45)';ctx.lineWidth=1;ctx.strokeRect(x+G.cam.x*sx,y+G.cam.y*sy,W*sx,H*sy);
  for(const e of G.enemies){ctx.fillStyle=e.boss?'#ff5ad2':e.elite?e.eliteCol:'#ff5470';ctx.beginPath();ctx.arc(x+e.x*sx,y+e.y*sy,e.boss?3:1.7,0,7);ctx.fill();}
  if(G.extract&&!G.extract.done){ctx.strokeStyle=UI.good;ctx.beginPath();ctx.arc(x+G.extract.x*sx,y+G.extract.y*sy,3,0,7);ctx.stroke();}
  const px=x+G.player.x*sx,py=y+G.player.y*sy;ctx.fillStyle=UI.accent;ctx.shadowBlur=6;ctx.shadowColor=UI.accent;ctx.beginPath();ctx.arc(px,py,3,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=UI.accent;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(G.player.angle)*9,py+Math.sin(G.player.angle)*9);ctx.stroke();ctx.restore();
}
function drawCleanDebug(){
  // Active rules panel (up to 3 rules)
  if(G.showRules && G.fuzzy.fired) {
    const rows = G.fuzzy.fired.slice(0, 3);
    panel(18, 120, 292, 66 + rows.length * 27, 'WHY THE DIRECTOR CHANGED');
    let y = 158;
    for (const fr of rows) {
      const terms = fr.rule.antecedentTerms || [];
      const ante = terms.map(t => t.slice(0,3)).join(' / ');
      ctx.fillStyle='#9bb6ca'; ctx.font='9px Consolas'; ctx.textAlign='left';
      ctx.fillText(ante, 30, y);
      const outTerm = fr.rule.consequent || '?';
      ctx.fillStyle = UI.accent;
      ctx.textAlign='right';
      ctx.fillText(outTerm + '  ' + Math.round(fr.strength * 100) + '%', 296, y);
      y += 27;
    }
  }
  // Membership graphs: show 4 inputs (HEALTH, AMMO, NOISE, PRESSURE)
  if(G.showGraphs){
    const gx = W - 248, gw = 230, gh = 68;
    mfGraph(gx, 116, gw, gh, 'HEALTH', Fuzzy.health, G._inputs.health, [UI.bad, UI.warn, UI.good]);
    mfGraph(gx, 190, gw, gh, 'AMMO',   Fuzzy.ammo,   G._inputs.ammo,   [UI.bad, UI.ammo, UI.good]);
    mfGraph(gx, 264, gw, gh, 'NOISE',  Fuzzy.noise,  G._inputs.noise,  [UI.player, UI.warn, UI.bad]);
    mfGraph(gx, 338, gw, gh, 'PRESSURE', Fuzzy.pressure, G._inputs.pressure, [UI.good, UI.warn, UI.bad]);
    // Removed EXPOSURE graph
  }
}
function drawCleanPowers(){
  let y=G.showGraphs?340:112;for(const k in G.power){if(G.power[k]<=0)continue;const d=POWERUPS[k],x=W-174,w=156;
    ctx.fillStyle='rgba(5,12,21,.82)';roundRect(x,y,w,24,7);ctx.fill();ctx.strokeStyle=d.col;ctx.stroke();
    ctx.fillStyle=d.col;ctx.font='bold 9px Consolas';ctx.textAlign='left';ctx.fillText(d.label,x+9,y+15);
    ctx.textAlign='right';ctx.fillText(Math.ceil(G.power[k]/60)+'s',x+w-9,y+15);y+=30;}
}

/* Default combat HUD: only information needed for moment-to-moment decisions.
   Detailed fuzzy diagnostics remain available with B, V, and C. */
function drawHUD(){
  const p=G.player,w=wstats(G.weapon),th=G.directorThreat==null?G.fuzzy.threat:G.directorThreat;
  if(G.hurt>0){const a=G.hurt/14*.25,g=ctx.createRadialGradient(W/2,H/2,250,W/2,H/2,760);g.addColorStop(0,'rgba(255,0,40,0)');g.addColorStop(1,`rgba(255,0,40,${a})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  // vitals
  ctx.fillStyle='rgba(5,12,21,.82)';roundRect(18,18,300,80,11);ctx.fill();ctx.strokeStyle='rgba(95,208,255,.20)';ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle='#7890a6';ctx.font='bold 9px Consolas';ctx.fillText('OPERATIVE',32,37);
  ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.fillText(Math.round(p.hp)+' HP',32,56);ctx.textAlign='right';ctx.fillText(G.settings.god?'INFINITE':G.ammo+' / '+G.reserve,304,56);
  cleanBar(32,64,126,p.hp/p.maxhp,UI.bad);cleanBar(178,64,126,G.reloading>0?G.reloading:G.ammo/G.maxAmmo,UI.ammo);
  ctx.textAlign='left';ctx.fillStyle='#71899f';ctx.font='9px Consolas';ctx.fillText('NOISE '+Math.round(G.noise),32,87);ctx.fillText('DETECTION '+(G.detect<15?'HIDDEN':Math.round(G.detect)),136,87);
  ctx.textAlign='right';ctx.fillStyle=UI.accent;ctx.fillText(w.name+' L'+w.lvl,304,87);
  // compact threat strip
  ctx.fillStyle='rgba(5,12,21,.84)';roundRect(W/2-180,18,360,64,11);ctx.fill();ctx.strokeStyle='rgba(95,208,255,.22)';ctx.stroke();
  const tc=th>66?UI.bad:th>33?UI.warn:UI.accent,label=th>66?'OVERWHELMING':th>33?'TACTICAL':'PASSIVE';
  ctx.textAlign='left';ctx.fillStyle='#7890a6';ctx.font='bold 9px Consolas';ctx.fillText('DIRECTOR THREAT  /  '+String(G.directorMode).toUpperCase(),W/2-162,37);
  ctx.fillStyle=tc;ctx.font='bold 12px Consolas';ctx.fillText(label,W/2-162,57);ctx.textAlign='right';ctx.font='bold 24px Consolas';ctx.fillText(Math.round(th),W/2+162,57);
  cleanBar(W/2-162,66,324,th/100,tc);
  // run summary
  ctx.fillStyle='rgba(5,12,21,.82)';roundRect(W-304,18,286,80,11);ctx.fill();ctx.strokeStyle='rgba(95,208,255,.20)';ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle='#7890a6';ctx.font='bold 9px Consolas';ctx.fillText('RUN STATUS',W-288,37);
  ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.fillText('SECTOR '+G.sector+'  /  WAVE '+G.wave,W-288,58);ctx.fillText('SCORE '+G.score,W-288,80);
  ctx.textAlign='right';ctx.fillStyle=UI.ammo;ctx.fillText(G.meta.coins+'c',W-34,58);ctx.fillStyle='#9bb1c4';ctx.fillText(G.kills+' KILLS',W-34,80);
  if(G.settings.god||fogAt(p.x,p.y)){ctx.fillStyle=G.settings.god?UI.warn:UI.accent;ctx.font='bold 9px Consolas';ctx.textAlign='left';ctx.fillText(G.settings.god?'GOD MODE':'HIDDEN IN FOG',24,112);}
  if(typeof drawObjectiveHUD==='function')drawObjectiveHUD();
  drawWeaponPills();drawDeployables();drawCompactMinimap();drawCleanPowers();drawCleanDebug();
  drawButton(btnRules);drawButton(btnGraphs);drawBossBar();drawComboMeter();drawDamageIndicator();drawAchToasts();drawWaveBanner();
  if(G.advisor&&G.advisor.weapon!==G.weapon&&G.advisor.conf>.55&&G.meta.weapons[G.advisor.weapon]&&G.meta.weapons[G.advisor.weapon].owned){ctx.fillStyle='#9bb6ca';ctx.font='9px Consolas';ctx.textAlign='left';ctx.fillText('ADVISOR  /  '+G.advisor.weapon.toUpperCase(),18,H-92);}
  ctx.save();ctx.translate(mouse.x,mouse.y);ctx.strokeStyle=G.reloading>0?UI.warn:UI.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,8,0,7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(-5,0);ctx.moveTo(5,0);ctx.lineTo(14,0);ctx.moveTo(0,-14);ctx.lineTo(0,-5);ctx.moveTo(0,5);ctx.lineTo(0,14);ctx.stroke();ctx.restore();
}

/* ----------------------------------------------------------------------------
   LOGIC DASHBOARD — shows the full fuzzy pipeline:
   Fuzzification → Rules → Aggregation → Defuzzification
   Toggle with Tab key (handled in input.js).
   ---------------------------------------------------------------------------- */
function drawLogicDashboard() {
    if (!G.showDashboard) return;
    if (G.state !== 'play' && G.state !== 'paused') return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(2, 6, 12, 0.88)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.accent;
    ctx.font = '800 28px ' + UI.display;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#0af';
    ctx.fillText('FUZZY LOGIC DASHBOARD', W / 2, 46);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8fa9c4';
    ctx.font = '13px Consolas';
    ctx.fillText('Live inference pipeline · 4 inputs → Threat · 81 rules', W / 2, 68);

    // ---- SECTION 1: Inputs + Fuzzification ----
    const x1 = 30, y1 = 90, w1 = 360, h1 = 280;
    panel(x1, y1, w1, h1, '① FUZZIFICATION');
    const inputs = G._inputs || { health: 50, ammo: 50, noise: 0, pressure: 0 };
    const f = G.fuzzy.fuzzified || {};
    const inputNames = ['health', 'ammo', 'noise', 'pressure'];
    const inputLabels = ['Health', 'Ammo', 'Noise', 'Pressure'];
    const termLabels = [
        ['Low', 'Medium', 'High'],
        ['Low', 'Medium', 'High'],
        ['Low', 'Medium', 'High'],
        ['Low', 'Medium', 'High']
    ];
    const colors = [
        ['#ff4d6d', '#ffb648', '#46e08c'],
        ['#ff4d6d', '#ffb648', '#46e08c'],
        ['#46e08c', '#ffb648', '#ff4d6d'],
        ['#46e08c', '#ffb648', '#ff4d6d']
    ];

    let yy = y1 + 34;
    for (let i = 0; i < 4; i++) {
        const key = inputNames[i];
        const val = inputs[key] || 0;
        const terms = f[key] || {};
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9cf';
        ctx.font = 'bold 11px Consolas';
        ctx.fillText(inputLabels[i] + ' = ' + Math.round(val), x1 + 16, yy + 4);
        ctx.textAlign = 'right';
        for (let j = 0; j < 3; j++) {
            const t = termLabels[i][j];
            const mu = terms[t] || 0;
            const col = colors[i][j];
            ctx.fillStyle = col;
            ctx.font = '10px Consolas';
            ctx.fillText(t + ': ' + mu.toFixed(2), x1 + w1 - 8 - (2 - j) * 80, yy + 4);
            // Mini bar
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(x1 + 140 + j * 74, yy - 2, 60, 10);
            ctx.fillStyle = col;
            ctx.fillRect(x1 + 140 + j * 74, yy - 2, 60 * Math.min(1, mu), 10);
        }
        yy += 26;
    }

    // ---- SECTION 2: Active Rules ----
    const x2 = x1 + w1 + 16, y2 = y1, w2 = 440, h2 = 280;
    panel(x2, y2, w2, h2, '② ACTIVE RULES (top 5)');
    const fired = G.fuzzy.fired || [];
    yy = y2 + 34;
    const showRules = fired.slice(0, 5);
    if (showRules.length === 0) {
        ctx.fillStyle = '#5b7a99';
        ctx.font = '13px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('No rules firing — the field is empty.', x2 + w2 / 2, yy + 40);
    } else {
        showRules.forEach((fr, idx) => {
            const terms = fr.rule.antecedentTerms || ['?', '?', '?', '?'];
            const outTerm = fr.rule.consequent || '?';
            const strength = fr.strength || 0;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#9cf';
            ctx.font = '11px Consolas';
            ctx.fillText('IF', x2 + 16, yy + 4);
            ctx.fillStyle = '#e8f4ff';
            const anteStr = terms.map((t, i) => inputLabels[i] + '=' + t).join(' ∧ ');
            ctx.fillText(anteStr, x2 + 48, yy + 4);
            ctx.textAlign = 'right';
            const outCol = outTerm === 'High' ? '#ff4d6d' : outTerm === 'Medium' ? '#ffb648' : '#5fd0ff';
            ctx.fillStyle = outCol;
            ctx.font = 'bold 11px Consolas';
            ctx.fillText('→ ' + outTerm, x2 + w2 - 16, yy + 4);
            // Firing strength bar
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(x2 + 16, yy + 10, w2 - 32, 6);
            ctx.fillStyle = '#5fd0ff';
            ctx.fillRect(x2 + 16, yy + 10, (w2 - 32) * Math.min(1, strength), 6);
            ctx.fillStyle = '#8fa9c4';
            ctx.font = '9px Consolas';
            ctx.textAlign = 'right';
            ctx.fillText((strength * 100).toFixed(1) + '%', x2 + w2 - 16, yy + 20);
            yy += 30;
        });
    }

    // ---- SECTION 3: Aggregation + Output Sets ----
    const x3 = x2 + w2 + 16, y3 = y1, w3 = Math.min(340, W - x3 - 30), h3 = 280;
    if (w3 > 200) {
        panel(x3, y3, w3, h3, '③ AGGREGATION');
        const agg = G.fuzzy.aggregate || { Low: 0, Medium: 0, High: 0 };
        const sets = Fuzzy.threatSets || { Low: () => 0, Medium: () => 0, High: () => 0 };
        const outTerms = ['Low', 'Medium', 'High'];
        const outColors = ['#5fd0ff', '#ffb648', '#ff4d6d'];
        const gx = x3 + 16, gy = y3 + 34, gw = w3 - 32, gh = h3 - 60;

        // Draw the three clipped output sets
        for (let t = 0; t < 3; t++) {
            const term = outTerms[t];
            const strength = agg[term] || 0;
            if (strength < 0.01) continue;
            ctx.strokeStyle = outColors[t];
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            for (let i = 0; i <= 100; i++) {
                const x = gx + (i / 100) * gw;
                const mfVal = sets[term](i);
                const clipped = Math.min(mfVal, strength);
                const y = gy + gh - clipped * gh;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = outColors[t];
            ctx.beginPath();
            ctx.moveTo(gx, gy + gh);
            for (let i = 0; i <= 100; i++) {
                const x = gx + (i / 100) * gw;
                const mfVal = sets[term](i);
                const clipped = Math.min(mfVal, strength);
                const y = gy + gh - clipped * gh;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(gx + gw, gy + gh);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            // Legend
            ctx.fillStyle = outColors[t];
            ctx.fillRect(gx + (t * 60), gy + gh + 6, 10, 8);
            ctx.fillStyle = '#8fa9c4';
            ctx.font = '8px Consolas';
            ctx.textAlign = 'left';
            ctx.fillText(term + ' (' + (strength * 100).toFixed(0) + '%)', gx + 14 + (t * 60), gy + gh + 14);
        }
        ctx.globalAlpha = 1;

        // ---- SECTION 4: Defuzzification (Result) ----
        const th = G.fuzzy.threat || 0;
        const cx = x3 + w3 / 2;
        const cy = y3 + h3 - 36;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7CFF9B';
        ctx.font = 'bold 14px Consolas';
        ctx.fillText('④ DEFUZZIFICATION (centroid)', cx, cy - 4);
        ctx.fillStyle = '#7CFF9B';
        ctx.font = '900 32px ' + UI.display;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#7CFF9B';
        ctx.fillText('THREAT = ' + Math.round(th), cx, cy + 34);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#8fa9c4';
        ctx.font = '11px Consolas';
        const label = th > 66 ? 'OVERWHELMING' : th > 33 ? 'TACTICAL' : 'PASSIVE';
        ctx.fillText(label, cx, cy + 56);
    }

    // ---- Close hint ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5b7a99';
    ctx.font = '11px Consolas';
    ctx.fillText('Press  [Tab]  to close dashboard', W / 2, H - 18);
}
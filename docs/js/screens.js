"use strict";
/* ----------------------------------------------------------------------------
   screens.js — setup screen (sliders + god toggle + armory/deploy), the
   ARMORY shop (buy / upgrade / equip weapons with banked coins),
   pause/death overlays, and click routing.
   ---------------------------------------------------------------------------- */
let activeSlider=null;
const sliders=[
  {key:'pace',      label:'GAME PACE',     min:0.4,max:1.3,x:750,y:298,w:440,
     fmt:v=>v<0.65?'Slow':v<0.95?'Normal':'Fast', desc:'Enemy & spawn speed'},
  {key:'density',   label:'HORDE DENSITY', min:0.5,max:2.0,x:750,y:384,w:440,
     fmt:v=>v<0.9?'Sparse':v<1.4?'Standard':'Packed', desc:'How many spawn per wave'},
  {key:'toughness', label:'SURVIVABILITY', min:0.6,max:2.2,x:750,y:470,w:440,
     fmt:v=>v<1.0?'Fragile':v<1.6?'Sturdy':'Tank', desc:'How much damage you shrug off'},
];
const godBtn    ={x:750,y:512,w:440,h:36};
const armoryBtn ={x:750,y:570,w:205,h:56};
const deployBtn ={x:975,y:570,w:215,h:56};
const dailyChip ={x:80,y:542,w:260,h:24};
const reportChip={x:80,y:584,w:260,h:34};
const REPORT_URL='report/dossier.html';   // game-styled full report page — opens as its own page (overridden in the artifact build)
const perkCards =[0,1,2].map(i=>({x:W/2-336+i*228,y:270,w:212,h:236}));
const reportBackBtn={x:W/2-430,y:650,w:210,h:44};
const reportFullBtn={x:W/2+150,y:650,w:280,h:44};

/* SYSTEM DOSSIER — the in-game report, drawn on the canvas (state 'report').
   A condensed briefing; the OPEN FULL REPORT button pops the complete document.
   Updated for MISO system: 4 inputs → 1 output · 81 rules. */
const REPORT_DOC=[
 {t:'h',s:'WHAT THIS IS'},
 {t:'p',s:"BAN's Protocol is a top-down survival shooter whose entire difficulty is driven by a Mamdani fuzzy inference system. Roughly twice a second the engine reads your live state, fires the fuzzy rules, and re-tunes enemy aggression, supply drops and enemy-type mix on the fly — an AI director that adapts to how you actually play."},
 {t:'sp'},
 {t:'h',s:'DEVELOPMENT PHASES'},
 {t:'li',s:'Core — 4 inputs to 1 output (Threat), 81 Mamdani rules driving enemy aggression.'},
 {t:'li',s:'Phase 1 · Combat depth — spitters, elites, boss patterns, dash, melee, stealth takedowns, combos.'},
 {t:'li',s:'Phase 2 · Roguelite — perks, sector modifiers, deployable mine / turret, barrels, extraction beacon, daily seed.'},
 {t:'li',s:'Phase 3 · Fuzzy depth — added the Skill input + Composition output (now 6 to 3, 729 rules) — this was later simplified to a clean 4-input/1-output MISO system for the final assessment.'},
 {t:'li',s:'Phase 4 · UX / polish — settings menu, pause stats, first-run tutorial, threat-adaptive music, weather, gamepad + touch.'},
 {t:'sp'},
 {t:'h',s:'THE 4 FUZZY INPUTS'},
 {t:'li',s:'Health — how hurt you are (0-100).'},
 {t:'li',s:'Ammo — magazine + reserve fraction.'},
 {t:'li',s:'Noise — sound made by shooting / sprinting; draws the horde.'},
 {t:'li',s:'Pressure — how many enemies are already engaging you.'},
 {t:'sp'},
 {t:'h',s:'THE FUZZY OUTPUT'},
 {t:'li',s:'Threat -> enemy aggression, spawn count and speed. (Supply and Composition are now derived from Threat via simple scaling.)'},
 {t:'sp'},
 {t:'h',s:'WHY 81 RULES'},
 {t:'p',s:'4 inputs x 3 fuzzy sets each = 3^4 = 81 antecedent combinations. Every possible state is covered, so the director never hits an undefined case. The rules are generated from a transparent scoring policy: score = (2-H) + (2-A) + N + P; mapped to Low (≤3), Medium (4-5), High (≥6).'},
 {t:'sp'},
 {t:'h',s:'THE POLICY (rule consequents)'},
 {t:'f',s:'THREAT = (2 - Health) + (2 - Ammo) + Noise + Pressure   (range 0-8)'},
 {t:'d',s:'Score maps to Threat: Low (≤3), Medium (4-5), High (≥6).'},
 {t:'sp'},
 {t:'h',s:'SYSTEM FLOW'},
 {t:'p',s:'live player state  ->  fuzzify (4 membership sets)  ->  evaluate 81 rules (AND = min)  ->  clip consequents  ->  aggregate (max)  ->  defuzzify (centroid)  ->  Threat  ->  drives spawns, drops & enemy mix  ->  loop.'},
 {t:'sp'},
 {t:'h',s:'IN-GAME SECTION CATEGORIES'},
 {t:'p',s:'Fuzzy director · Combat & weapons · Roguelite meta (perks / sectors / deployables) · World (maze, fog, line-of-sight) · Audio · Fuzzy analytics · HUD & gauges.'},
 {t:'sp'},
 {t:'h',s:'CODE FILES'},
 {t:'li',s:'config / balance — canvas setup & central tuning constants.'},
 {t:'li',s:'fuzzy — the Mamdani MISO engine, 81-rule generator, centroid defuzzifier, weapon advisor.'},
 {t:'li',s:'state — the single G game-state object + reset().'},
 {t:'li',s:'world — maze generation, walls, line-of-sight, fog, minimap.'},
 {t:'li',s:'mechanics — shoot / reload / spawn and the main update loop; runs inference.'},
 {t:'li',s:'weapons / roguelite — guns & levelling; perks, sectors, deployables, achievements.'},
 {t:'li',s:'input — keyboard, mouse, gamepad, touch.'},
 {t:'li',s:'render / post / hud — world rendering, bloom, gauges & graphs.'},
 {t:'li',s:'screens — setup, armory, pause, this dossier + click routing.'},
 {t:'li',s:'analytics — the fuzzy analytics overlay (control surface, heatmap, CSV).'},
 {t:'li',s:'audio / main — sound engine; the requestAnimationFrame loop.'},
 {t:'sp'},
 {t:'h',s:'FULL REPORT'},
 {t:'p',s:'Press OPEN FULL REPORT below for the complete document — every section, the worked fuzzification example, the membership graphs, and the entire 81-row rule table.'},
];
/* left-aligned word-wrap that RETURNS the y of the last line (for stacked blocks) */
function wrapReturn(txt,cx,y,maxW,lh){
  const words=txt.split(' '); let line='';
  for(const w of words){ const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,cx,y); line=w; y+=lh; } else line=test; }
  if(line) ctx.fillText(line,cx,y);
  return y;
}

function wrapText(txt,cx,y,maxW,lh){
  const words=txt.split(' '); let line='';
  for(const w of words){ const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line,cx,y); line=w; y+=lh; } else line=test; }
  if(line) ctx.fillText(line,cx,y);
}

/* PERK PICK — shown after each boss (state 'perk'), world dimmed behind */
function drawPerks(){
  drawWorld();
  ctx.fillStyle='rgba(4,8,14,0.78)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle='#7CFF9B';ctx.font='800 40px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#7CFF9B';ctx.fillText('SECTOR CLEARED',W/2,150);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='16px Consolas';ctx.fillText('choose an upgrade  ·  click a card or press 1 / 2 / 3',W/2,188);
  const ch=G.perkChoices||[];
  perkCards.forEach((c,i)=>{ const p=ch[i]; if(!p) return;
    const hov=inRect(mouse,c);
    ctx.fillStyle=hov?'rgba(124,255,155,0.16)':'rgba(14,24,20,0.92)';roundRect(c.x,c.y,c.w,c.h,12);ctx.fill();
    ctx.strokeStyle=hov?'#7CFF9B':'rgba(124,255,155,0.4)';ctx.lineWidth=2;roundRect(c.x,c.y,c.w,c.h,12);ctx.stroke();
    ctx.fillStyle='#7CFF9B';ctx.font='bold 12px Consolas';ctx.textAlign='center';ctx.fillText('[ '+(i+1)+' ]',c.x+c.w/2,c.y+34);
    ctx.fillStyle=UI.text;ctx.font='bold 17px '+UI.display;ctx.fillText(p.name,c.x+c.w/2,c.y+100);
    ctx.fillStyle='#9cf';ctx.font='13px Consolas';wrapText(p.desc,c.x+c.w/2,c.y+140,c.w-28,18);
  });
}
function drawDailyToggle(){
  const b=dailyChip, hov=inRect(mouse,b);
  ctx.fillStyle=G.daily?'rgba(124,255,155,.15)':hov?'rgba(95,208,255,.16)':'rgba(14,29,45,.82)';roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
  ctx.strokeStyle=G.daily?UI.good:hov?UI.accent:'rgba(120,150,180,.22)';ctx.lineWidth=1.2;roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
  ctx.fillStyle=G.daily?UI.good:'#526779';ctx.beginPath();ctx.arc(b.x+14,b.y+b.h/2,4,0,7);ctx.fill();
  ctx.textAlign='left';ctx.fillStyle=G.daily?UI.good:UI.text;ctx.font='bold 10px Consolas';
  ctx.fillText('DAILY CHALLENGE  /  SHARED SEED',b.x+26,b.y+16);
}

function sliderKnobX(s){ return s.x + ((G.settings[s.key]-s.min)/(s.max-s.min))*s.w; }
function drawSlider(s){
  const kx=sliderKnobX(s), ky=s.y;
  ctx.fillStyle='#9cf';ctx.font='bold 14px Consolas';ctx.textAlign='left';ctx.fillText(s.label,s.x,ky-14);
  ctx.fillStyle='#678';ctx.font='11px Consolas';ctx.textAlign='left';ctx.fillText(s.desc,s.x,ky+24);
  ctx.strokeStyle='rgba(120,150,180,0.4)';ctx.lineWidth=6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(s.x,ky);ctx.lineTo(s.x+s.w,ky);ctx.stroke();
  ctx.strokeStyle='#3aa0ff';ctx.beginPath();ctx.moveTo(s.x,ky);ctx.lineTo(kx,ky);ctx.stroke();
  ctx.fillStyle='#dff';ctx.shadowBlur=12;ctx.shadowColor=UI.accent;
  ctx.beginPath();ctx.arc(kx,ky,11,0,7);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#0a2030';ctx.beginPath();ctx.arc(kx,ky,4,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 13px Consolas';ctx.textAlign='right';
  ctx.fillText(s.fmt(G.settings[s.key]),s.x+s.w,ky-14);
}
function dragSlider(p){
  if(!activeSlider)return;
  const s=activeSlider;
  let f=(p.x-s.x)/s.w; f=Math.max(0,Math.min(1,f));
  G.settings[s.key]=s.min+f*(s.max-s.min);
}
function drawGodToggle(){
  const b=godBtn, on=G.settings.god;
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=hov?'rgba(95,208,255,0.12)':'rgba(0,0,0,0.18)';
  roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
  ctx.fillStyle='#9cf';ctx.font='bold 14px Consolas';ctx.textAlign='left';
  ctx.fillText('GOD MODE',b.x+12,b.y+23);
  ctx.fillStyle='#678';ctx.font='11px Consolas';
  ctx.fillText('demo testing · key G',b.x+110,b.y+23);
  const px=b.x+b.w-54, py=b.y+8, pw=42, ph=20;
  ctx.fillStyle=on?'rgba(255,182,72,0.45)':'rgba(60,80,100,0.6)';
  roundRect(px,py,pw,ph,10);ctx.fill();
  ctx.strokeStyle=on?UI.warn:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;
  roundRect(px,py,pw,ph,10);ctx.stroke();
  ctx.fillStyle=on?UI.warn:'#9ab';
  ctx.beginPath();ctx.arc(on?px+pw-10:px+10,py+ph/2,7,0,7);ctx.fill();
}
function coinChip(x,y){
  roundRect(x,y,150,30,15);
  ctx.fillStyle='rgba(255,211,107,0.12)';ctx.fill();
  ctx.strokeStyle=UI.ammo;ctx.lineWidth=1.5;roundRect(x,y,150,30,15);ctx.stroke();
  ctx.fillStyle=UI.ammo;ctx.font='bold 14px Consolas';ctx.textAlign='center';
  ctx.fillText('¢ '+G.meta.coins,x+75,y+20);
}
function bigBtn(b,label,hovFill){
  const hov=mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
  ctx.fillStyle=hov?(hovFill||'rgba(95,208,255,0.4)'):'rgba(60,160,255,0.22)';
  roundRect(b.x,b.y,b.w,b.h,12);ctx.fill();
  ctx.strokeStyle=UI.accent;ctx.lineWidth=2;roundRect(b.x,b.y,b.w,b.h,12);ctx.stroke();
  ctx.fillStyle=UI.text;ctx.font='bold 22px Consolas';ctx.textAlign='center';
  ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+8);
}

/* SYSTEM DOSSIER screen — scrollable canvas briefing (state 'report') */
function drawReport(){
  drawGrid();
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='900 34px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#0af';ctx.fillText('ISP568 · SYSTEM DOSSIER',W/2,58);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='14px Consolas';
  ctx.fillText("BAN's PROTOCOL — 4 inputs -> 1 output · 81-rule Mamdani director",W/2,86);

  const vx=W/2-430, vw=860, vy=104, vh=534, startY=vy+30, x=vx+34, maxW=vw-96, visibleH=vh-44;
  panel(vx,vy,vw,vh,'');
  ctx.save();
  ctx.beginPath();ctx.rect(vx+3,vy+8,vw-6,vh-16);ctx.clip();
  ctx.textAlign='left';
  let y=startY-(G.reportScroll||0);
  for(const b of REPORT_DOC){
    if(b.t==='sp'){ y+=12; continue; }
    if(b.t==='h'){ y+=10; ctx.font='bold 15px Consolas'; ctx.fillStyle=UI.accent;
      y=wrapReturn(b.s,x,y,maxW,20)+8;
      ctx.strokeStyle='rgba(95,170,255,0.22)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+maxW,y-4);ctx.stroke(); y+=12; continue; }
    if(b.t==='p'){ ctx.font='14px Consolas'; ctx.fillStyle=UI.text; y=wrapReturn(b.s,x,y,maxW,21)+21; continue; }
    if(b.t==='li'){ ctx.font='13px Consolas';
      ctx.fillStyle=UI.accent;ctx.fillText('•',x,y); ctx.fillStyle=UI.text;
      y=wrapReturn(b.s,x+16,y,maxW-16,19)+19; continue; }
    if(b.t==='f'){ ctx.font='13px Consolas'; ctx.fillStyle=UI.ammo; y=wrapReturn(b.s,x+6,y,maxW-6,19)+19; continue; }
    if(b.t==='d'){ ctx.font='12px Consolas'; ctx.fillStyle=UI.dim; y=wrapReturn(b.s,x,y,maxW,17)+17; continue; }
  }
  ctx.restore();
  const totalH=y-(startY-(G.reportScroll||0));            // full content height (scroll-invariant)
  G._reportMax=Math.max(0,totalH-visibleH);
  if((G.reportScroll||0)>G._reportMax) G.reportScroll=G._reportMax;
  if(G._reportMax>0){                                     // scrollbar
    const tX=vx+vw-14, tY=vy+30, tH=vh-52, thumbH=Math.max(30,tH*visibleH/totalH);
    ctx.fillStyle='rgba(120,150,180,0.15)';roundRect(tX,tY,6,tH,3);ctx.fill();
    ctx.fillStyle=UI.accent;roundRect(tX,tY+(G.reportScroll/G._reportMax)*(tH-thumbH),6,thumbH,3);ctx.fill();
  }
  menuBtn(reportBackBtn,'← BACK');
  menuBtn(reportFullBtn,'📖 OPEN FULL REPORT','rgba(70,224,140,0.32)');
  ctx.textAlign='center';ctx.fillStyle=UI.dim;ctx.font='12px Consolas';
  ctx.fillText('scroll: mouse wheel · ↑ ↓ / PgUp PgDn      —      Esc: back',W/2,678);
}
/* the full report is a game-styled page (report/dossier.html) — navigate in the SAME tab
   (its "◄ BACK TO GAME" link returns here in-place). */
function openFullReport(){ try{ window.location.href=REPORT_URL; }catch(e){} }

function drawSetupLegacy(){
  drawGrid();
  const t=G.t*0.02;
  drawCharacter(W/2,200,t,{scale:2.4,body:UI.player,accent:'#0a2a4a',walk:t*6,player:true});
  for(let i=0;i<5;i++){const a=t*1.3+i*1.25,rad=150+Math.sin(t+i)*15;
    drawCharacter(W/2+Math.cos(a)*rad,200+Math.sin(a)*rad*0.45,a+Math.PI,
      {scale:1.1,body:`hsl(${i*40},70%,55%)`,accent:'#200',walk:t*8,enemy:true,hue:i*40});}
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='900 54px '+UI.display;
  ctx.shadowBlur=26;ctx.shadowColor='#0af';ctx.fillText("BAN's PROTOCOL",W/2,78);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='16px Consolas';
  ctx.fillText('ADAPTIVE HORDE SURVIVAL · 81-rule Mamdani director · 4 inputs → 1 output',W/2,106);
  coinChip(W-182,20);
  ctx.fillStyle=inRect(mouse,settingsGear)?UI.accent:'#9cf';ctx.font='22px Consolas';ctx.textAlign='center';
  ctx.fillText('⚙',settingsGear.x+15,settingsGear.y+23);
  // persistent records (top-left)
  ctx.textAlign='left';ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.fillText('RECORDS',24,28);
  ctx.fillStyle=UI.accent;ctx.font='bold 13px Consolas';
  ctx.fillText('Best Wave '+G.meta.bestWave+'   ·   Best Score '+G.meta.bestScore,24,46);
  // now-playing (BGM) — only shown when a soundtrack is bundled (hidden in the hosted no-music build)
  if(!window.Sound || !Sound.hasBGM || Sound.hasBGM()){
    const np = (window.Sound && Sound.nowPlaying) ? Sound.nowPlaying() : null;
    ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.fillText('MUSIC',24,72);
    ctx.fillStyle='#c9a0ff';ctx.font='bold 12px Consolas';
    ctx.fillText(np ? '♪ Molchat Doma — '+np+'   (N: next)' : '♪ click anywhere to start the soundtrack',24,90);
  }
  drawDailyToggle();
  if(typeof drawAdvancedSetupWidgets==='function')drawAdvancedSetupWidgets();
  // VIEW REPORT button
  { const b=reportChip, hov=inRect(mouse,b);
    ctx.fillStyle=hov?'rgba(95,208,255,0.25)':'rgba(20,30,42,0.7)';roundRect(b.x,b.y,b.w,b.h,6);ctx.fill();
    ctx.strokeStyle=hov?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,6);ctx.stroke();
    ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.textAlign='left';ctx.fillText('📄 VIEW ISP568 REPORT',b.x+10,b.y+16); }
  panel(W/2-220,288,440,338,'MISSION SETUP — set your difficulty');
  sliders.forEach(drawSlider);
  drawGodToggle();
  bigBtn(armoryBtn,'⚒ ARMORY','rgba(255,211,107,0.35)');
  bigBtn(deployBtn,'▶ DEPLOY');
  ctx.fillStyle='#567';ctx.font='12px Consolas';ctx.textAlign='center';
  ctx.fillText('WASD move · aim/shoot · X alt-fire · Shift dash · F/RMB melee · Q or 1/2/3 weapons · R reload · Esc pause',W/2,652);
}

/* ----------------------------------------------------------------------------
   ARMORY — buy / upgrade / equip weapons with banked coins
   ---------------------------------------------------------------------------- */
/* v7.1 setup screen: one clean preview surface and one aligned configuration card. */
function drawSetup(){
  drawGrid();
  let glow=ctx.createRadialGradient(300,350,20,300,350,430);
  glow.addColorStop(0,'rgba(26,112,170,.16)');glow.addColorStop(1,'rgba(6,7,13,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  glow=ctx.createRadialGradient(1010,330,20,1010,330,360);
  glow.addColorStop(0,'rgba(22,82,145,.10)');glow.addColorStop(1,'rgba(6,7,13,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  ctx.textAlign='left';ctx.fillStyle=UI.accent;ctx.font='900 38px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#0af';ctx.fillText("BAN's PROTOCOL",56,64);ctx.shadowBlur=0;
  ctx.fillStyle='#8fa9c4';ctx.font='12px Consolas';ctx.fillText('ADAPTIVE HORDE SURVIVAL  /  81-RULE INTELLIGENCE DIRECTOR',58,88);
  ctx.strokeStyle='rgba(95,208,255,.20)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(56,104);ctx.lineTo(1224,104);ctx.stroke();
  coinChip(1020,42);
  ctx.fillStyle=inRect(mouse,settingsGear)?UI.accent:'#8fa9c4';ctx.font='24px Consolas';ctx.textAlign='center';ctx.fillText('\u2699',settingsGear.x+15,settingsGear.y+23);

  // operative preview card
  ctx.fillStyle='rgba(8,16,27,.76)';roundRect(50,124,610,526,16);ctx.fill();
  ctx.strokeStyle='rgba(95,208,255,.20)';ctx.lineWidth=1.5;roundRect(50,124,610,526,16);ctx.stroke();
  ctx.textAlign='left';ctx.fillStyle='#6f8da7';ctx.font='bold 10px Consolas';ctx.fillText('ACTIVE OPERATIVE',80,158);
  ctx.fillStyle=UI.text;ctx.font='bold 17px '+UI.display;ctx.fillText('FIELD UNIT 01',80,181);
  const records=[{x:80,label:'BEST WAVE',value:G.meta.bestWave},{x:238,label:'BEST SCORE',value:G.meta.bestScore},{x:396,label:'BANKED',value:G.meta.coins+'c'}];
  for(const c of records){ctx.fillStyle='rgba(14,29,45,.82)';roundRect(c.x,198,142,54,9);ctx.fill();
    ctx.strokeStyle='rgba(120,160,195,.18)';roundRect(c.x,198,142,54,9);ctx.stroke();
    ctx.fillStyle='#6f8da7';ctx.font='9px Consolas';ctx.fillText(c.label,c.x+12,216);
    ctx.fillStyle=UI.text;ctx.font='bold 17px Consolas';ctx.fillText(String(c.value),c.x+12,239);}
  const t=G.t*.02;
  drawCharacter(350,385,t,{scale:3.15,body:UI.player,accent:'#0a2a4a',walk:t*6,player:true});
  for(let i=0;i<3;i++){const a=t*.8+i*2.1,rad=154+Math.sin(t+i)*8;
    drawCharacter(350+Math.cos(a)*rad,385+Math.sin(a)*rad*.38,a+Math.PI,
      {scale:.9,body:`hsl(${195+i*35},65%,52%)`,accent:'#16212d',walk:t*7,enemy:true,hue:195+i*35});}
  ctx.textAlign='center';ctx.fillStyle='rgba(95,208,255,.75)';ctx.font='10px Consolas';ctx.fillText('LIVE LOADOUT PREVIEW',350,495);
  if(!window.Sound||!Sound.hasBGM||Sound.hasBGM()){const np=(window.Sound&&Sound.nowPlaying)?Sound.nowPlaying():null;
    ctx.fillStyle='#788fa4';ctx.font='10px Consolas';ctx.fillText(np?'MUSIC  /  '+np+'  /  N TO SKIP':'CLICK TO ENABLE AUDIO',350,518);}
  drawDailyToggle();
  if(typeof drawAdvancedSetupWidgets==='function')drawAdvancedSetupWidgets();
  {const b=reportChip,hov=inRect(mouse,b);ctx.fillStyle=hov?'rgba(95,208,255,.18)':'rgba(14,29,45,.82)';roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
    ctx.strokeStyle=hov?UI.accent:'rgba(120,150,180,.22)';ctx.lineWidth=1.2;roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
    ctx.fillStyle=UI.text;ctx.font='bold 11px Consolas';ctx.textAlign='center';ctx.fillText('VIEW ISP568 REPORT',b.x+b.w/2,b.y+22);}

  // aligned deployment configuration card
  panel(700,124,530,526,'');
  ctx.textAlign='left';ctx.fillStyle='#6f8da7';ctx.font='bold 10px Consolas';ctx.fillText('DEPLOYMENT CONFIGURATION',730,158);
  ctx.fillStyle=UI.text;ctx.font='bold 20px '+UI.display;ctx.fillText('MISSION SETUP',730,184);
  sliders.forEach(drawSlider);drawGodToggle();
  bigBtn(armoryBtn,'ARMORY','rgba(255,211,107,.28)');bigBtn(deployBtn,'DEPLOY');
  ctx.fillStyle='#587087';ctx.font='10px Consolas';ctx.textAlign='center';
  ctx.fillText('WASD MOVE   /   MOUSE AIM   /   X ALT-FIRE   /   SHIFT DASH   /   ESC PAUSE',W/2,687);
}

const shopCards=['rifle','shotgun','bazooka'].map((key,i)=>({key,x:W/2-575+i*390,y:126,w:370,h:348}));
function cardBtn(c){ return {x:c.x+35,y:c.y+294,w:300,h:42}; }
const upgChips=Object.keys(PLAYER_UPS).map((key,i)=>({key,x:W/2-571+i*288,y:518,w:274,h:58}));
function chipBtn(u){ return {x:u.x+u.w-96,y:u.y+11,w:86,h:36}; }
const shopBackBtn={x:W/2-100,y:612,w:200,h:46};

function drawWeaponIcon(x,y,key){
  ctx.save();ctx.translate(x,y);
  if(key==='rifle'){
    ctx.fillStyle='#39424d';ctx.fillRect(-44,-4,88,8);
    ctx.fillStyle='#222a33';ctx.fillRect(-14,4,9,14);ctx.fillRect(-44,-9,22,7);
  }else if(key==='shotgun'){
    ctx.fillStyle='#39424d';ctx.fillRect(-44,-8,80,7);ctx.fillRect(-44,1,80,7);
    ctx.fillStyle='#5a3b22';ctx.fillRect(-44,-8,24,16);ctx.fillRect(-6,8,9,12);
  }else{
    ctx.fillStyle='#39424d';ctx.fillRect(-50,-10,100,20);
    ctx.fillStyle='#ff7b4d';ctx.fillRect(38,-10,12,20);
    ctx.fillStyle='#222a33';ctx.fillRect(-14,10,10,12);ctx.fillRect(-50,-14,18,8);
  }
  ctx.restore();
}
function drawShop(){
  drawGrid();
  ctx.textAlign='center';ctx.fillStyle=UI.ammo;ctx.font='800 44px '+UI.display;
  ctx.shadowBlur=20;ctx.shadowColor='#fa0';ctx.fillText('ARMORY',W/2,72);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='14px Consolas';
  ctx.fillText('coins persist between runs — earned per kill, banked on death',W/2,100);
  coinChip(W-182,20);

  for(const c of shopCards){
    const w=WEAPONS[c.key], mw=G.meta.weapons[c.key], st=wstats(c.key);
    const equipped=G.meta.equipped===c.key;
    panel(c.x,c.y,c.w,c.h,'');
    if(equipped){ ctx.strokeStyle=UI.accent;ctx.lineWidth=2.5;roundRect(c.x,c.y,c.w,c.h,10);ctx.stroke(); }
    // header
    ctx.fillStyle=mw.owned?UI.text:'#789';ctx.font='bold 22px Consolas';ctx.textAlign='left';
    ctx.fillText(w.name,c.x+24,c.y+38);
    if(equipped){ ctx.fillStyle=UI.accent;ctx.font='bold 11px Consolas';ctx.textAlign='right';
      ctx.fillText('● EQUIPPED',c.x+c.w-24,c.y+38); }
    else if(mw.owned){ ctx.fillStyle='#678';ctx.font='11px Consolas';ctx.textAlign='right';
      ctx.fillText('click card to equip',c.x+c.w-24,c.y+38); }
    drawWeaponIcon(c.x+c.w/2,c.y+76,c.key);
    ctx.fillStyle='#9cf';ctx.font='12px Consolas';ctx.textAlign='center';
    ctx.fillText(w.blurb,c.x+c.w/2,c.y+116);
    // level stars
    ctx.font='15px Consolas';ctx.fillStyle=UI.ammo;
    ctx.fillText('★'.repeat(mw.lvl)+'☆'.repeat(5-mw.lvl)+`   LV ${mw.lvl}/5`,c.x+c.w/2,c.y+142);
    // stats
    ctx.textAlign='left';ctx.font='13px Consolas';
    const sx=c.x+50, sy=c.y+172, lh=22;
    const stats=[
      ['DAMAGE', st.dmg+(w.pellets>1?` ×${w.pellets} pellets`:'')+(mw.lvl<5?`  (next: ${Math.round(w.dmg*(1+0.25*mw.lvl))})`:'')],
      ['MAGAZINE', w.mag+' rounds'],
      ['FIRE RATE', (60/w.cd).toFixed(1)+' /s'],
      ['SPECIAL', w.explosive?`AoE blast ${w.blast}px`:(w.pellets>1?'wide spread':'long range · accurate')],
      ['NOISE', '+'+w.noise+' per shot'],
    ];
    stats.forEach(([k,v],i)=>{
      ctx.fillStyle='#678';ctx.fillText(k,sx,sy+i*lh);
      ctx.fillStyle=UI.text;ctx.fillText(String(v),sx+105,sy+i*lh);
    });
    // action button
    const b=cardBtn(c);
    let label,cost=0,can=true;
    if(!mw.owned){ cost=w.cost; label=`BUY — ${cost}¢`; can=G.meta.coins>=cost; }
    else if(mw.lvl<5){ cost=w.upCost[mw.lvl-1]; label=`UPGRADE — ${cost}¢`; can=G.meta.coins>=cost; }
    else { label='MAX LEVEL'; can=false; }
    const hov=can&&mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
    ctx.fillStyle=can?(hov?'rgba(255,211,107,0.4)':'rgba(255,211,107,0.18)'):'rgba(40,50,60,0.5)';
    roundRect(b.x,b.y,b.w,b.h,10);ctx.fill();
    ctx.strokeStyle=can?UI.ammo:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,10);ctx.stroke();
    ctx.fillStyle=can?UI.ammo:'#667';ctx.font='bold 16px Consolas';ctx.textAlign='center';
    ctx.fillText(label,b.x+b.w/2,b.y+27);
    if(typeof drawModuleChip==='function')drawModuleChip(c);
  }

  // operative upgrades — permanent player stats bought with coins
  panel(W/2-585,488,1170,102,'OPERATIVE UPGRADES — permanent, apply every run');
  for(const u of upgChips){
    const def=PLAYER_UPS[u.key], lvl=G.meta.player[u.key];
    ctx.fillStyle='rgba(0,0,0,0.18)';roundRect(u.x,u.y,u.w,u.h,8);ctx.fill();
    ctx.fillStyle=UI.text;ctx.font='bold 13px Consolas';ctx.textAlign='left';
    ctx.fillText(def.name,u.x+12,u.y+22);
    ctx.fillStyle=UI.ammo;ctx.font='12px Consolas';
    ctx.fillText('★'.repeat(lvl)+'☆'.repeat(5-lvl),u.x+12,u.y+42);
    ctx.fillStyle='#678';ctx.font='10px Consolas';
    ctx.fillText(def.desc,u.x+70,u.y+42);
    const b=chipBtn(u);
    let label,can=false;
    if(lvl<5){ const cost=def.cost[lvl-1]; label=cost+'¢'; can=G.meta.coins>=cost; }
    else label='MAX';
    const hov=can&&mouse.x>=b.x&&mouse.x<=b.x+b.w&&mouse.y>=b.y&&mouse.y<=b.y+b.h;
    ctx.fillStyle=can?(hov?'rgba(124,255,155,0.35)':'rgba(124,255,155,0.15)'):'rgba(40,50,60,0.5)';
    roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();
    ctx.strokeStyle=can?UI.good:'rgba(120,150,180,0.3)';ctx.lineWidth=1.5;
    roundRect(b.x,b.y,b.w,b.h,8);ctx.stroke();
    ctx.fillStyle=can?UI.good:'#667';ctx.font='bold 13px Consolas';ctx.textAlign='center';
    ctx.fillText(label,b.x+b.w/2,b.y+24);
  }
  bigBtn(shopBackBtn,'← BACK');
}
function tryUpgradePlayer(key){
  const def=PLAYER_UPS[key], lvl=G.meta.player[key];
  if(lvl<5 && G.meta.coins>=def.cost[lvl-1]){
    G.meta.coins-=def.cost[lvl-1]; G.meta.player[key]++; saveMeta();
  }
}
function tryBuy(key){
  const mw=G.meta.weapons[key], w=WEAPONS[key];
  if(!mw.owned){
    if(G.meta.coins>=w.cost){ G.meta.coins-=w.cost; mw.owned=true; G.meta.equipped=key; saveMeta(); }
    return;
  }
  if(mw.lvl<5){
    const c=w.upCost[mw.lvl-1];
    if(G.meta.coins>=c){ G.meta.coins-=c; mw.lvl++; saveMeta(); }
  }
}

/* pause / death overlays */
const redeployBtn={x:W/2-120,y:400,w:240,h:54};
function drawDead(){
  drawWorld();
  ctx.fillStyle='rgba(10,0,5,0.72)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=UI.bad;ctx.font='900 60px '+UI.display;
  ctx.shadowBlur=24;ctx.shadowColor='#f00';ctx.fillText('OVERRUN',W/2,240);ctx.shadowBlur=0;
  ctx.fillStyle=UI.text;ctx.font='20px Consolas';
  ctx.fillText(`Score ${G.score}   ·   Kills ${G.kills}   ·   Wave ${G.wave}`,W/2,290);
  ctx.fillStyle=UI.ammo;ctx.font='bold 18px Consolas';
  ctx.fillText(`COINS BANKED  +${G.runCoins}¢   (total ${G.meta.coins}¢)`,W/2,330);
  ctx.fillStyle=UI.accent;ctx.font='bold 16px Consolas';
  ctx.fillText(`BEST   Wave ${G.meta.bestWave}   ·   Score ${G.meta.bestScore}`,W/2,362);
  const sum=typeof buildRunSummary==='function'?buildRunSummary('overrun'):null;
  if(sum){ctx.fillStyle='#9cf';ctx.font='12px Consolas';ctx.fillText(`${sum.mode.toUpperCase()} · Seed ${sum.seed} · ${sum.accuracy}% accuracy · Threat ${sum.avgThreat}/${sum.peakThreat}`,W/2,386);}
  if(G.newRecord){ ctx.fillStyle=UI.good;ctx.font='900 24px '+UI.display;
    ctx.shadowBlur=18;ctx.shadowColor=UI.good;ctx.fillText('★ NEW RECORD ★',W/2,178);ctx.shadowBlur=0; }
  bigBtn(redeployBtn,'▶ REDEPLOY');
  ctx.fillStyle='#567';ctx.font='12px Consolas';ctx.fillText('returns to mission setup — spend your coins in the ARMORY',W/2,480);
}
function menuBtn(b,label,col){
  const hov=inRect(mouse,b);
  ctx.fillStyle=hov?(col||'rgba(95,208,255,0.3)'):'rgba(20,30,42,0.88)';roundRect(b.x,b.y,b.w,b.h,10);ctx.fill();
  ctx.strokeStyle=hov?UI.accent:'rgba(120,150,180,0.4)';ctx.lineWidth=1.5;roundRect(b.x,b.y,b.w,b.h,10);ctx.stroke();
  ctx.fillStyle=UI.text;ctx.font='bold 16px Consolas';ctx.textAlign='center';ctx.fillText(label,b.x+b.w/2,b.y+b.h/2+5);
}
const pauseBtns={ resume:{x:W/2-110,y:352,w:220,h:44}, settings:{x:W/2-110,y:406,w:220,h:44},
  restart:{x:W/2-110,y:460,w:220,h:44}, quit:{x:W/2-110,y:514,w:220,h:44} };
function drawPause(){
  drawWorld();drawHUD();
  ctx.fillStyle='rgba(0,10,20,0.74)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 50px '+UI.display;
  ctx.shadowBlur=18;ctx.shadowColor='#0af';ctx.fillText('PAUSED',W/2,175);ctx.shadowBlur=0;
  ctx.fillStyle=UI.text;ctx.font='16px Consolas';
  ctx.fillText(`Sector ${G.sector}  ·  Wave ${G.wave}  ·  Kills ${G.kills}  ·  Score ${G.score}`,W/2,228);
  ctx.fillStyle=UI.ammo;ctx.font='14px Consolas';
  ctx.fillText(`Coins ${G.meta.coins}¢    ·    Best combo ×${G.comboBest}    ·    Perks ${G.perks.length}`,W/2,256);
  menuBtn(pauseBtns.resume,'▶ RESUME'); menuBtn(pauseBtns.settings,'⚙ SETTINGS');
  menuBtn(pauseBtns.restart,'↻ RESTART RUN'); menuBtn(pauseBtns.quit,'✕ QUIT TO MENU','rgba(255,90,110,0.3)');
}

/* first-run tutorial overlay (dismissed on any input, flag saved to meta) */
function drawTutorial(){
  ctx.fillStyle='rgba(2,6,12,0.82)';ctx.fillRect(0,0,W,H);
  panel(W/2-320,116,640,432,'');
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 34px '+UI.display;
  ctx.shadowBlur=16;ctx.shadowColor='#0af';ctx.fillText("BAN's PROTOCOL",W/2,172);ctx.shadowBlur=0;
  ctx.fillStyle='#9cf';ctx.font='14px Consolas';
  ctx.fillText('survive the fuzzy-controlled horde · hide in fog · read the threat gauge',W/2,200);
  const lines=[['WASD','move'],['Mouse','aim + hold to shoot'],['Shift','dash — dodge with i-frames'],
    ['F / RMB','melee + silent stealth takedown on unaware foes'],['E / T','deploy mine / turret'],
    ['Q / 1 2 3','switch weapons'],['X','weapon-specific alternate fire'],['R','reload'],['Esc','pause + settings']];
  ctx.font='14px Consolas';let y=244;
  for(const kv of lines){ ctx.textAlign='right';ctx.fillStyle=UI.accent;ctx.fillText(kv[0],W/2-16,y);
    ctx.textAlign='left';ctx.fillStyle=UI.text;ctx.fillText(kv[1],W/2+6,y); y+=32; }
  ctx.textAlign='center';ctx.fillStyle=UI.good;ctx.font='bold 16px Consolas';
  ctx.fillText('click or press any key to DEPLOY',W/2,522);
}

/* SETTINGS overlay — volume sliders + toggles, openable from setup & pause */
const setSliders=[{key:'master',label:'MASTER VOLUME',y:150},{key:'music',label:'MUSIC VOLUME',y:198},{key:'sfx',label:'SFX VOLUME',y:246}];
const setToggles=[{key:'shake',label:'SCREEN SHAKE',y:290},{key:'motion',label:'AMBIENT MOTION',y:326},
  {key:'colorblind',label:'COLOR-BLIND SAFE THREAT COLORS',y:362},{key:'reducedFlash',label:'REDUCED FLASHING',y:398},
  {key:'aimAssist',label:'AIM ASSIST',y:434},{key:'view3d',label:'EXPERIMENTAL FIRST-PERSON 3D',y:470}];
const bindActions=['up','down','left','right','shoot','reload','cycle','dash','melee','mine','turret','alt','analytics','pause'];
const setClose={x:W/2-90,y:642,w:180,h:40},setTab={x:W/2-250,y:82,w:500,h:32};
let setDragKey=null;G.settingsPage=G.settingsPage||'general';
function drawSettings(){
  ctx.fillStyle='rgba(2,6,12,0.90)';ctx.fillRect(0,0,W,H);
  const px=W/2-300,pw=600;panel(px,38,pw,660,'');
  ctx.textAlign='center';ctx.fillStyle=UI.accent;ctx.font='800 28px '+UI.display;ctx.fillText('SETTINGS',W/2,74);
  menuBtn(setTab,G.settingsPage==='general'?'GENERAL  >  CONTROLS':'CONTROLS  >  GENERAL');
  const o=G.meta.opts,x0=px+50,w=pw-100;
  if(G.settingsPage==='general'){
    for(const s of setSliders){const y=s.y;ctx.textAlign='left';ctx.fillStyle='#9cf';ctx.font='bold 12px Consolas';ctx.fillText(s.label,x0,y-10);
      ctx.textAlign='right';ctx.fillStyle=UI.text;ctx.fillText(Math.round(o[s.key]*100)+'%',x0+w,y-10);
      ctx.strokeStyle='rgba(120,150,180,.4)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w,y);ctx.stroke();
      ctx.strokeStyle=UI.accent;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w*o[s.key],y);ctx.stroke();ctx.fillStyle='#dff';ctx.beginPath();ctx.arc(x0+w*o[s.key],y,8,0,7);ctx.fill();}
    for(const t of setToggles){const y=t.y,on=o[t.key];ctx.textAlign='left';ctx.fillStyle='#9cf';ctx.font='bold 12px Consolas';ctx.fillText(t.label,x0,y+4);
      const tx=px+pw-102,tw=52;ctx.fillStyle=on?'rgba(95,208,255,.5)':'rgba(60,80,100,.6)';roundRect(tx,y-8,tw,22,11);ctx.fill();
      ctx.strokeStyle=on?UI.accent:'#678';ctx.stroke();ctx.fillStyle=on?UI.accent:'#9ab';ctx.beginPath();ctx.arc(on?tx+41:tx+11,y+3,8,0,7);ctx.fill();}
    ctx.textAlign='left';ctx.fillStyle='#9cf';ctx.font='bold 12px Consolas';ctx.fillText('HUD / TEXT SCALE',x0,548);
    ctx.textAlign='right';ctx.fillStyle=UI.text;ctx.fillText(Math.round((o.textScale||1)*100)+'%',x0+w,548);
    const sf=((o.textScale||1)-0.9)/0.25;ctx.strokeStyle='rgba(120,150,180,.4)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x0,562);ctx.lineTo(x0+w,562);ctx.stroke();
    ctx.strokeStyle=UI.accent;ctx.beginPath();ctx.moveTo(x0,562);ctx.lineTo(x0+w*sf,562);ctx.stroke();ctx.fillStyle='#dff';ctx.beginPath();ctx.arc(x0+w*sf,562,8,0,7);ctx.fill();
    ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.textAlign='center';ctx.fillText('3D changes presentation only; fuzzy logic and combat remain shared.',W/2,604);
  }else{
    ctx.fillStyle=UI.dim;ctx.font='11px Consolas';ctx.fillText(G.bindCapture?'PRESS A KEY FOR '+G.bindCapture.toUpperCase():'click any action, then press a key',W/2,142);
    bindActions.forEach((a,i)=>{const col=i%2,row=(i/2)|0,b={x:px+42+col*264,y:166+row*58,w:248,h:42};
      ctx.fillStyle=G.bindCapture===a?'rgba(255,211,107,.30)':inRect(mouse,b)?'rgba(95,208,255,.25)':'rgba(20,35,50,.75)';roundRect(b.x,b.y,b.w,b.h,7);ctx.fill();
      ctx.strokeStyle=G.bindCapture===a?UI.ammo:UI.accent;ctx.stroke();ctx.textAlign='left';ctx.fillStyle=UI.text;ctx.font='bold 12px Consolas';ctx.fillText(a.toUpperCase(),b.x+12,b.y+25);
      ctx.textAlign='right';ctx.fillStyle=UI.accent;ctx.fillText(displayKey(a),b.x+b.w-12,b.y+25);});
  }
  menuBtn(setClose,'CLOSE');
}
function setSlideVal(p){if(!setDragKey)return;const px=W/2-300,pw=600,x0=px+50,w=pw-100;
  const f=Math.max(0,Math.min(1,(p.x-x0)/w));G.meta.opts[setDragKey]=f;
  if(window.Sound){if(setDragKey==='master')Sound.setMaster(f);else if(setDragKey==='music')Sound.setMusic(f);else Sound.setSfx(f);}}
function handleSettings(p){
  const px=W/2-300,pw=600,x0=px+50,w=pw-100,o=G.meta.opts;
  if(inRect(p,setTab)){G.settingsPage=G.settingsPage==='general'?'controls':'general';G.bindCapture=null;return;}
  if(G.settingsPage==='general'){
    for(const s of setSliders)if(Math.abs(p.y-s.y)<15&&p.x>=x0-12&&p.x<=x0+w+12){setDragKey=s.key;setSlideVal(p);return;}
    for(const t of setToggles)if(Math.abs(p.y-t.y)<16&&p.x>=px+pw-112){o[t.key]=!o[t.key];saveMeta();if(t.key==='view3d'&&typeof set3DEnabled==='function')set3DEnabled(o[t.key]);if(window.Sound)Sound.ui();return;}
    if(Math.abs(p.y-562)<16&&p.x>=x0-12&&p.x<=x0+w+12){o.textScale=0.9+Math.max(0,Math.min(1,(p.x-x0)/w))*0.25;saveMeta();return;}
  }else for(let i=0;i<bindActions.length;i++){const a=bindActions[i],col=i%2,row=(i/2)|0,b={x:px+42+col*264,y:166+row*58,w:248,h:42};if(inRect(p,b)){G.bindCapture=a;return;}}
  if(inRect(p,setClose)){G.showSettings=false;G.bindCapture=null;saveMeta();if(window.Sound)Sound.ui();}
}

/* click routing */
function inRect(p,b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}
const settingsGear={x:1182,y:42,w:30,h:30};
function handleDown(p){
  if(G.tutorial){ G.tutorial=false; G.meta.tutorialSeen=true; saveMeta(); return; }   // dismiss tutorial
  if(G.showSettings){ handleSettings(p); return; }
  if(G.state==='perk'){
    for(let i=0;i<perkCards.length;i++) if(inRect(p,perkCards[i])){ choosePerk(i); return; }
    return;
  }
  if(G.state==='paused'){
    if(inRect(p,pauseBtns.resume)){ G.state='play'; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,pauseBtns.settings)){ G.showSettings=true; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,pauseBtns.restart)){ if(typeof finalizeRun==='function')finalizeRun('restart');if(window.Sound)Sound.ui(); reset(); G.state='play'; return; }
    if(inRect(p,pauseBtns.quit)){ if(typeof finalizeRun==='function')finalizeRun('quit');G.state='setup'; if(window.Sound)Sound.ui(); return; }
    return;
  }
  if(G.state==='setup'){
    if(typeof handleAdvancedSetupClick==='function'&&handleAdvancedSetupClick(p))return;
    if(inRect(p,settingsGear)){ G.showSettings=true; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,reportChip)){ G.state='report'; G.reportScroll=0; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,dailyChip)){ G.daily=!G.daily; if(window.Sound)Sound.ui(); return; }
    for(const s of sliders){ const kx=sliderKnobX(s);
      if(Math.hypot(p.x-kx,p.y-s.y)<22 || (p.x>=s.x&&p.x<=s.x+s.w&&Math.abs(p.y-s.y)<16)){
        activeSlider=s; dragSlider(p); return; } }
    if(inRect(p,godBtn)){ G.settings.god=!G.settings.god; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,armoryBtn)){ G.state='shop'; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,deployBtn)){ if(window.Sound)Sound.ui(); reset(); G.state='play'; }
    return;
  }
  if(G.state==='shop'){
    for(const c of shopCards){
      if(typeof moduleButtonForCard==='function'&&inRect(p,moduleButtonForCard(c))){cycleWeaponModule(c.key);if(window.Sound)Sound.ui();return;}
      if(inRect(p,cardBtn(c))){ tryBuy(c.key); if(window.Sound)Sound.ui(); return; }
      if(inRect(p,c)){ if(G.meta.weapons[c.key].owned){ G.meta.equipped=c.key; saveMeta(); if(window.Sound)Sound.ui(); } return; }
    }
    for(const u of upgChips){ if(inRect(p,chipBtn(u))){ tryUpgradePlayer(u.key); if(window.Sound)Sound.ui(); return; } }
    if(inRect(p,shopBackBtn)){ G.state='setup'; if(window.Sound)Sound.ui(); }
    return;
  }
  if(G.state==='report'){
    if(inRect(p,reportBackBtn)){ G.state='setup'; if(window.Sound)Sound.ui(); return; }
    if(inRect(p,reportFullBtn)){ openFullReport(); if(window.Sound)Sound.ui(); return; }
    return;
  }
  if(G.state==='history'){if(typeof handleHistoryClick==='function')handleHistoryClick(p);return;}
  if(G.state==='dead'){ if(inRect(p,redeployBtn)){ G.state='setup'; if(window.Sound)Sound.ui(); } return; }
  if(G.state==='play'){
    if(inRect(p,btnRules)){ G.showRules=!G.showRules; return; }
    if(inRect(p,btnGraphs)){ G.showGraphs=!G.showGraphs; return; }
    for(const b of weaponPills){ if(inRect(p,b)){ switchWeapon(b.key); return; } }
  }
}
"use strict";
/* ============================================================================
   report_build.js — renders the fuzzy membership-function graphs as inline SVG
   and injects them into _report_src.html, producing the final, self-contained
   Progress_Report_1_UPDATED.html (open it and Print → Save as PDF).

   The graphs are drawn in the lecturer's worked-example style:
     (a) draw the MF graph for each variable,
     (b) fuzzify a concrete state (crisp marker + membership dots),
     (c) CLIP each fired rule's consequent at its firing strength,
     (d) AGGREGATE the clipped sets (OR = max), and
     (e) DEFUZZIFY by centroid (centre of gravity).
   Everything is generated from the SAME triangular/trapezoidal functions the
   game uses in js/fuzzy.js, so the report is the engine.
   Run:  node report_build.js
   ========================================================================== */
const fs = require('fs');

/* ---- membership-function shape helpers (identical to js/fuzzy.js) ---------- */
const tri   = (x,a,b,c)=> Math.max(0, Math.min((x-a)/(b-a||1e-9), (c-x)/(c-b||1e-9)));
const trapL = (x,a,b)=> x<=a?1: x>=b?0: (b-x)/(b-a);
const trapR = (x,a,b)=> x<=a?0: x>=b?1: (x-a)/(b-a);

/* ---- the variables (6 inputs + 3 outputs) --------------------------------- */
const VARS = {
  health:   { Low:x=>trapL(x,15,40),   Medium:x=>tri(x,25,50,75),  High:x=>trapR(x,60,85) },
  ammo:     { Depleted:x=>trapL(x,10,35), Adequate:x=>tri(x,25,55,80), Surplus:x=>trapR(x,65,90) },
  noise:    { Quiet:x=>trapL(x,15,40),  Moderate:x=>tri(x,30,55,80), Loud:x=>trapR(x,65,90) },
  pressure: { Safe:x=>trapL(x,20,45),   Engaged:x=>tri(x,35,60,85),  Swarmed:x=>trapR(x,70,90) },
  exposure: { Hidden:x=>trapL(x,15,40), Suspicious:x=>tri(x,30,55,80), Spotted:x=>trapR(x,65,90) },
  skill:    { Novice:x=>trapL(x,25,50), Average:x=>tri(x,35,55,80),  Expert:x=>trapR(x,65,90) },
  threat:   { Passive:x=>tri(x,0,18,40), Tactical:x=>tri(x,30,50,70), Overwhelming:x=>trapR(x,60,90) },
  supply:   { Scarce:x=>tri(x,0,18,40),  Balanced:x=>tri(x,30,50,70), Generous:x=>trapR(x,60,90) },
  compo:    { Swarm:x=>tri(x,0,18,40),   Mixed:x=>tri(x,30,50,70),    Heavy:x=>trapR(x,60,90) },
};
const PAL = ['#d23b4e','#e0962e','#2f8f5b'];                 // term 1 / 2 / 3
const FILL= ['rgba(210,59,78,.10)','rgba(224,150,46,.10)','rgba(47,143,91,.10)'];

/* ---- core SVG plotter ------------------------------------------------------ */
function mf(terms, opts={}){
  const max=opts.max||100, W=300, H=142, L=32, R=10, T=12, B=24;
  const px0=L, px1=W-R, py0=T, py1=H-B;
  const X=v=>px0+(v/max)*(px1-px0), Y=mu=>py1-mu*(py1-py0);
  const cols=opts.colors||PAL, fills=opts.fills||FILL;
  const names=Object.keys(terms);
  let s='';
  [0,0.5,1].forEach(m=>{ s+=`<line x1="${px0}" y1="${Y(m)}" x2="${px1}" y2="${Y(m)}" stroke="#e6edf5"/>`;
    s+=`<text x="${px0-4}" y="${Y(m)+2.5}" font-size="7" fill="#7a8aa0" text-anchor="end">${m}</text>`; });
  (opts.xticks||[0,max*0.25,max*0.5,max*0.75,max]).forEach(v=>{
    s+=`<line x1="${X(v)}" y1="${py1}" x2="${X(v)}" y2="${py1+3}" stroke="#9fb0c4"/>`;
    s+=`<text x="${X(v)}" y="${py1+11}" font-size="7" fill="#7a8aa0" text-anchor="middle">${Math.round(v)}</text>`; });
  s+=`<line x1="${px0}" y1="${py0}" x2="${px0}" y2="${py1}" stroke="#9fb0c4"/>`;
  s+=`<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="#9fb0c4"/>`;
  names.forEach((nm,i)=>{
    const clip = opts.clip && (nm in opts.clip) ? opts.clip[nm] : null;
    let pts=[]; for(let v=0; v<=max+1e-6; v+=max/160){ let mu=terms[nm](v); if(clip!=null) mu=Math.min(mu,clip); pts.push([X(v),Y(mu)]); }
    const line=pts.map((p,k)=>(k?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    if(opts.fill!==false && (clip==null || clip>0)){
      const area=line+` L ${X(max).toFixed(1)} ${Y(0).toFixed(1)} L ${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`;
      s+=`<path d="${area}" fill="${clip!=null?fills[i%fills.length].replace('.10','.22'):fills[i%fills.length]}" stroke="none"/>`;
    }
    s+=`<path d="${line}" fill="none" stroke="${cols[i%cols.length]}" stroke-width="${clip!=null?2:1.5}"/>`;
    if(clip!=null && clip>0) s+=`<line x1="${px0}" y1="${Y(clip)}" x2="${px1}" y2="${Y(clip)}" stroke="${cols[i%cols.length]}" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.7"/>`;
  });
  if(opts.union){ // shaded union envelope (aggregation)
    let pts=[]; for(let v=0; v<=max+1e-6; v+=max/200){ let mu=0;
      names.forEach(nm=>{ const c=opts.union[nm]; if(c!=null) mu=Math.max(mu,Math.min(terms[nm](v),c)); });
      pts.push([X(v),Y(mu)]); }
    const line=pts.map((p,k)=>(k?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    s+=`<path d="${line} L ${X(max).toFixed(1)} ${Y(0).toFixed(1)} L ${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z" fill="rgba(123,47,191,.16)" stroke="#7b2fbf" stroke-width="1.8"/>`;
  }
  if(opts.crisp!=null){ const cx=X(opts.crisp);
    s+=`<line x1="${cx}" y1="${py0}" x2="${cx}" y2="${py1}" stroke="#1c2733" stroke-width="1" stroke-dasharray="4 3"/>`;
    s+=`<text x="${cx}" y="${py0-3}" font-size="7" fill="#1c2733" text-anchor="middle">x=${opts.crisp}</text>`;
    names.forEach((nm,i)=>{ const mu=terms[nm](opts.crisp); if(mu>0.001){
      s+=`<circle cx="${cx}" cy="${Y(mu)}" r="2.5" fill="${cols[i%cols.length]}" stroke="#fff" stroke-width="0.7"/>`;
      s+=`<text x="${cx+4}" y="${Y(mu)-2}" font-size="7" font-weight="bold" fill="${cols[i%cols.length]}">${mu.toFixed(2)}</text>`; } }); }
  if(opts.spikes){ opts.spikes.forEach(sp=>{ const cx=X(sp.k);
    s+=`<line x1="${cx}" y1="${py1}" x2="${cx}" y2="${Y(sp.h)}" stroke="${sp.col||'#7b2fbf'}" stroke-width="2"/>`;
    s+=`<circle cx="${cx}" cy="${Y(sp.h)}" r="2.6" fill="${sp.col||'#7b2fbf'}"/>`;
    s+=`<text x="${cx}" y="${Y(sp.h)-3}" font-size="6.8" fill="${sp.col||'#7b2fbf'}" text-anchor="middle">${sp.lbl||''}</text>`; }); }
  if(opts.centroid!=null){ const cx=X(opts.centroid);
    s+=`<line x1="${cx}" y1="${py0}" x2="${cx}" y2="${py1}" stroke="#7b2fbf" stroke-width="1.6"/>`;
    s+=`<text x="${cx}" y="${py0+7}" font-size="7.5" font-weight="bold" fill="#7b2fbf" text-anchor="middle">COG ${opts.centroid.toFixed(0)}</text>`; }
  if(opts.xlabel) s+=`<text x="${(px0+px1)/2}" y="${H-2}" font-size="7" fill="#45586b" text-anchor="middle">${opts.xlabel}</text>`;
  return `<svg class="mf" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// centroid sampled every 2 units — identical to the engine in js/fuzzy.js
function centroid(terms,agg){ let n=0,d=0; for(let x=0;x<=100;x+=2){ let mu=0;
  for(const t in terms) mu=Math.max(mu,Math.min(agg[t]||0,terms[t](x))); n+=x*mu; d+=mu; } return d?n/d:0; }

/* legend + titled card wrapper */
function legend(terms,cols=PAL){ return Object.keys(terms).map((n,i)=>
  `<span style="color:${cols[i%cols.length]}">■ ${n}</span>`).join(''); }
function card(title,terms,svg,cols){
  return `<div class="graph"><p class="gtitle">${title}</p><p class="leg">${legend(terms,cols)}</p>${svg}</div>`; }

/* ============================================================================
   1)  §2.2  —  membership-function graph for EVERY variable (5 in + 2 out)
   ========================================================================== */
const INPUT_TITLES={ health:'Player Health  (input 1)', ammo:'Ammo Count  (input 2)',
  noise:'Noise Level  (input 3)', pressure:'Pressure  (input 4)', exposure:'Exposure  (input 5)',
  skill:'Player Skill  (input 6 — NEW)' };
const outCols=['#1f6feb','#e0a82e','#c0263b'], outFill=['rgba(31,111,235,.10)','rgba(224,168,46,.10)','rgba(192,38,59,.10)'];
let fuzzyGraphs='<div class="graphs-wrap">';
for(const v of ['health','ammo','noise','pressure','exposure','skill'])
  fuzzyGraphs+=card(INPUT_TITLES[v], VARS[v], mf(VARS[v],{xlabel:'crisp value 0–100'}));
fuzzyGraphs+=card('Threat / Aggression  (OUTPUT 1)', VARS.threat,
  mf(VARS.threat,{colors:outCols,fills:outFill,xlabel:'Threat 0–100'}), outCols);
fuzzyGraphs+=card('Supply / Director Aid  (OUTPUT 2)', VARS.supply,
  mf(VARS.supply,{xlabel:'Supply 0–100'}));
fuzzyGraphs+=card('Composition  (OUTPUT 3 — NEW: enemy-type mix)', VARS.compo,
  mf(VARS.compo,{colors:outCols,fills:outFill,xlabel:'Composition 0–100'}), outCols);
fuzzyGraphs+='</div>';

/* ============================================================================
   2)  §3.7  —  worked example.  State: H50 A55 N55 P15 E70
   ========================================================================== */
const STATE={health:50,ammo:55,noise:55,pressure:15,exposure:70,skill:55};

// (a) fuzzification panels — one per input, crisp marker + membership dots.
// Skill = 55 sits cleanly on Average (μ=1), so it does not change the worked
// example: an average player sees exactly the difficulty the 5-input build gave.
let fzPanels='<div class="graphs-wrap">';
for(const v of ['health','ammo','noise','pressure','exposure','skill'])
  fzPanels+=card(INPUT_TITLES[v].replace(/\s+\(input 6 — NEW\)| \(input \d\)/,'')+` = ${STATE[v]}`, VARS[v],
    mf(VARS[v],{crisp:STATE[v]}));
fzPanels+='</div>';

// (b) rule-clip panels — THREAT: Tactical@0.40 and Overwhelming@0.176
const tCols=['#1f6feb','#e0a82e','#c0263b'];
const tFill=['rgba(31,111,235,.10)','rgba(224,168,46,.10)','rgba(192,38,59,.10)'];
let clipPanels='<div class="graphs-wrap">';
clipPanels+=card('R1 → Tactical, clipped at 0.40', VARS.threat,
  mf(VARS.threat,{colors:tCols,fills:tFill,clip:{Tactical:0.40},xlabel:'Threat'}), tCols);
clipPanels+=card('R2 → Overwhelming, clipped at 0.176', VARS.threat,
  mf(VARS.threat,{colors:tCols,fills:tFill,clip:{Overwhelming:0.176},xlabel:'Threat'}), tCols);
clipPanels+='</div>';

// (c) aggregation — union of the two clipped THREAT sets
const tAgg={Tactical:0.40,Overwhelming:0.176};
const aggPanel='<div class="graphs-wrap"><div class="graph" style="width:60%">'
  +`<p class="gtitle">Aggregated Threat set — OR = max of the clipped consequents</p>`
  +`<p class="leg"><span style="color:#7b2fbf">■ aggregated (union)</span></p>`
  +mf(VARS.threat,{colors:tCols,fills:tFill,fill:false,union:tAgg,xlabel:'Threat'})+'</div></div>';

// (d) defuzzification — centroid of the aggregated THREAT
const tCog=centroid(VARS.threat,tAgg);
const defuzzPanel='<div class="graphs-wrap"><div class="graph" style="width:60%">'
  +`<p class="gtitle">Centroid (centre of gravity) of the aggregated area → crisp Threat</p>`
  +`<p class="leg"><span style="color:#7b2fbf">■ aggregated set</span><span style="color:#7b2fbf">▏COG line</span></p>`
  +mf(VARS.threat,{colors:tCols,fill:false,union:tAgg,centroid:tCog,xlabel:'Threat'})+'</div></div>';

// (e) SECOND OUTPUT — SUPPLY (same two rules, both → Balanced)
const sAgg={Balanced:0.40};
const sCog=centroid(VARS.supply,sAgg);
let supplyPanels='<div class="graphs-wrap">';
supplyPanels+=card('R1 & R2 → Supply Balanced, clipped at max(0.40, 0.176) = 0.40', VARS.supply,
  mf(VARS.supply,{clip:{Balanced:0.40},xlabel:'Supply'}));
supplyPanels+=card('Aggregate + Centroid → crisp Supply', VARS.supply,
  mf(VARS.supply,{fill:false,union:sAgg,centroid:sCog,xlabel:'Supply'}));
supplyPanels+='</div>';

// (e2) THIRD OUTPUT — COMPOSITION (both rules → Mixed here)
const cAgg={Mixed:0.40};
const cCog=centroid(VARS.compo,cAgg);
let compoPanels='<div class="graphs-wrap">';
compoPanels+=card('R1 & R2 → Composition Mixed, clipped at 0.40', VARS.compo,
  mf(VARS.compo,{colors:outCols,fills:outFill,clip:{Mixed:0.40},xlabel:'Composition'}), outCols);
compoPanels+=card('Aggregate + Centroid → crisp Composition', VARS.compo,
  mf(VARS.compo,{colors:outCols,fill:false,union:cAgg,centroid:cCog,xlabel:'Composition'}), outCols);
compoPanels+='</div>';

// (f) Takagi–Sugeno singleton spikes for the same state
const sugenoPanel='<div class="graphs-wrap"><div class="graph" style="width:60%">'
  +`<p class="gtitle">Sugeno — singleton spikes (height = firing strength)</p>`
  +`<p class="leg"><span style="color:#999">■ Passive k=19 (inactive)</span><span style="color:#e0a82e">■ Tactical k=50</span><span style="color:#c0263b">■ Overwhelming k=86</span></p>`
  +mf({_:()=>0},{fill:false,xticks:[0,25,50,75,100],xlabel:'Threat',spikes:[
    {k:19,h:0.001,col:'#bbb',lbl:'19'},{k:50,h:0.40,col:'#e0a82e',lbl:'0.40@50'},{k:86,h:0.176,col:'#c0263b',lbl:'0.18@86'}]})
  +'</div></div>';

/* ============================================================================
   2b)  §3.9  —  outcome bands bar (Score / Kills / Wave reading aid)
   ========================================================================== */
const outcomePanel='<div class="graphs-wrap"><div class="graph" style="width:72%">'
  +'<p class="gtitle">Run-result bands (reading aid — crisp scoreboard, not a fuzzy variable)</p>'
  +'<svg class="mf" viewBox="0 0 300 96">'
  +(()=>{ let s=''; const rows=[['Wave',0.18,0.5],['Kills',0.31,0.66],['Score',0.34,0.62]];
     const lbl=['Low','Medium','High'], col=['#d23b4e','#e0962e','#2f8f5b'];
     rows.forEach((r,i)=>{ const y=14+i*26, x0=46, x1=292, w=x1-x0;
       s+=`<text x="6" y="${y+10}" font-size="8" fill="#21558c" font-weight="bold">${r[0]}</text>`;
       const segs=[[0,r[1]],[r[1],r[2]],[r[2],1]];
       segs.forEach((sg,k)=>{ s+=`<rect x="${x0+sg[0]*w}" y="${y}" width="${(sg[1]-sg[0])*w}" height="14" fill="${col[k]}" opacity="0.78"/>`;
         s+=`<text x="${x0+(sg[0]+sg[1])/2*w}" y="${y+10}" font-size="7" fill="#fff" text-anchor="middle">${lbl[k]}</text>`; }); });
     return s; })()
  +'</svg></div></div>';

/* ============================================================================
   2c)  Appendix B  —  the COMPLETE 729-rule table (Threat + Supply + Composition)
   ========================================================================== */
const LV={ health:{Low:0,Medium:1,High:2}, ammo:{Depleted:0,Adequate:1,Surplus:2},
  noise:{Quiet:0,Moderate:1,Loud:2}, pressure:{Safe:0,Engaged:1,Swarmed:2},
  exposure:{Hidden:0,Suspicious:1,Spotted:2}, skill:{Novice:0,Average:1,Expert:2} };
const T=['Low','Medium','High'], A=['Depleted','Adequate','Surplus'], N=['Quiet','Moderate','Loud'],
      P=['Safe','Engaged','Swarmed'], E=['Hidden','Suspicious','Spotted'], SK=['Novice','Average','Expert'];
const cls={Passive:'p',Tactical:'t',Overwhelming:'o',Scarce:'o',Balanced:'t',Generous:'p',Swarm:'p',Mixed:'t',Heavy:'o'};
const dist={Passive:0,Tactical:0,Overwhelming:0,Scarce:0,Balanced:0,Generous:0,Swarm:0,Mixed:0,Heavy:0};
let rows='', i=0;
for(const h of T) for(const a of A) for(const n of N) for(const p of P) for(const e of E) for(const sk of SK){
  i++;
  const H=LV.health[h],Ai=LV.ammo[a],Ni=LV.noise[n],Pi=LV.pressure[p],Ei=LV.exposure[e],Si=LV.skill[sk];
  let score=Math.round((0.55*(H+Ai)+0.8*Ni-0.6*Pi+1.7*Ei+0.6*(Si-1))*100)/100;
  const then=score<=2.3?'Passive':score<=4.6?'Tactical':'Overwhelming';
  const w=Math.max(0.6,Math.min(1,0.6+0.4*Math.min(Math.abs(score-2.3),Math.abs(score-4.6))));
  let ss=Math.round(((2-H)+(2-Ai)+0.6*Pi)*100)/100;
  const sup=ss<=1.6?'Scarce':ss<=3.0?'Balanced':'Generous';
  let cc=Math.round((0.5*(H+Ai)+0.7*Ni+0.8*Ei+0.5*Si)*100)/100;
  const cmp=cc<=2.0?'Swarm':cc<=3.8?'Mixed':'Heavy';
  dist[then]++; dist[sup]++; dist[cmp]++;
  rows+=`<tr><td>${i}</td><td>${h}</td><td>${a}</td><td>${n}</td><td>${p}</td><td>${e}</td><td>${sk}</td><td>${score.toFixed(2)}</td>`
       +`<td class="${cls[then]}">${then}</td><td class="${cls[sup]}">${sup}</td><td class="${cls[cmp]}">${cmp}</td><td>${w.toFixed(2)}</td></tr>`;
}

/* ============================================================================
   3)  inject into the HTML
   ========================================================================== */
let html=fs.readFileSync('_report_src.html','utf8');
const inject={
  'FUZZY_GRAPHS':fuzzyGraphs,
  'FUZZIFICATION_PANELS':fzPanels,
  'RULECLIP_PANELS':clipPanels,
  'AGG_PANEL':aggPanel,
  'DEFUZZ_PANEL':defuzzPanel,
  'SUPPLY_PANELS':supplyPanels,
  'COMPO_PANELS':compoPanels,
  'SUGENO_PANEL':sugenoPanel,
  'OUTCOME_PANEL':outcomePanel,
  'RULES_ROWS':rows,
};
for(const key in inject) html=html.replace(`<!--${key}-->`, inject[key]);
fs.writeFileSync('Progress_Report_1_UPDATED.html', html);

console.log('Built Progress_Report_1_UPDATED.html');
console.log('  rules:', i, '| Threat/Supply/Compo centroids =', tCog.toFixed(1), sCog.toFixed(1), cCog.toFixed(1));
console.log('  rule distribution:', JSON.stringify(dist));
console.log('  injected:', Object.keys(inject).join(', '));
const left=(html.match(/<!--[A-Z_]+-->/g)||[]);
console.log('  remaining placeholders:', left.length?left.join(', '):'none');

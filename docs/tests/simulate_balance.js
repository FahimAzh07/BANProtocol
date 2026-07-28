"use strict";
/* Seeded, dependency-free synthetic balance runner. It is intentionally not a
   bot for collision gameplay; it stress-tests the director feedback loop over
   many comparable state trajectories. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','js','fuzzy.js'),'utf8');
const box={console,Math};vm.createContext(box);vm.runInContext(src+'\nthis.F=Fuzzy;',box);const F=box.F;
const modes=['fuzzy','static','linear','chaos'],runs=Number(process.argv[2]||20),steps=360;
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function one(mode,seed){const r=rng(seed);let hp=100,ammo=100,noise=8,pressure=5,exposure=10,skill=45,kills=0,peak=0,sum=0,chaos=35,f={threat:25,supply:50};
  for(let t=0;t<steps&&hp>0;t++){if(t%20===0)f=F.infer({health:hp,ammo,noise,pressure,exposure,skill});let th=f.threat;
    if(mode==='static')th=45;else if(mode==='linear')th=Math.min(92,18+t/11);else if(mode==='chaos'){if(t%30===0)chaos=15+r()*75;th+=.08*(chaos-th);}
    const shooting=r()<0.30+pressure/250;noise=Math.max(0,noise-2)+(shooting?15:0);ammo=Math.max(0,ammo-(shooting?2.4:0));
    pressure=Math.max(0,Math.min(100,pressure+(th/100)*7-2.6+r()*2));exposure=Math.max(0,Math.min(100,exposure+(shooting?8:-3)+r()*3));
    hp=Math.max(0,Math.min(100,hp-pressure*0.0055+(f.supply/100)*0.48));if(shooting&&ammo>0){kills+=pressure*.012;pressure=Math.max(0,pressure-2.2);}
    if(ammo<18&&r()<f.supply/380)ammo=Math.min(100,ammo+28);skill=Math.min(95,45+kills*.08);sum+=th;peak=Math.max(peak,th);
  }return {survived:hp>0,kills,hp,avg:sum/steps,peak};}
for(const mode of modes){const a=[];for(let i=0;i<runs;i++)a.push(one(mode,568000+i));
  const mean=k=>a.reduce((s,x)=>s+x[k],0)/a.length;
  console.log(`${mode.padEnd(7)} runs=${runs} survive=${(a.filter(x=>x.survived).length/runs*100).toFixed(1)}% kills=${mean('kills').toFixed(1)} hp=${mean('hp').toFixed(1)} threat=${mean('avg').toFixed(1)} peak=${mean('peak').toFixed(1)}`);}

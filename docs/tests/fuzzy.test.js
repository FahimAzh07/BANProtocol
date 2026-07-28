"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','js','fuzzy.js'),'utf8');
const box={console,Math};vm.createContext(box);vm.runInContext(src+'\nthis.F=Fuzzy;this.M=MicroFuzzy;',box);
const F=box.F,M=box.M;

assert.strictEqual(F.rules.length,729,'complete six-input rule base');
assert.strictEqual(M.rules.length,27,'complete micro-controller rule base');
for(const variable of ['health','ammo','noise','pressure','exposure','skill']){
  for(let x=0;x<=100;x++){
    const vals=Object.values(F[variable]).map(fn=>fn(x));
    assert(vals.every(v=>Number.isFinite(v)&&v>=0&&v<=1),variable+' membership bounds');
    assert(Math.max(...vals)>0,variable+' must have coverage at '+x);
  }
}
let seed=5682026;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<300;i++){
  const inp={health:rnd()*100,ammo:rnd()*100,noise:rnd()*100,pressure:rnd()*100,exposure:rnd()*100,skill:rnd()*100};
  const r=F.infer(inp);for(const k of ['threat','supply','compo','threatMamdani','threatSugeno'])
    assert(Number.isFinite(r[k])&&r[k]>=0&&r[k]<=100,k+' output bounds');
}
const base={health:70,ammo:70,noise:25,pressure:25,skill:55};
assert(F.infer({...base,exposure:95}).threat>F.infer({...base,exposure:5}).threat,'exposure should raise threat');
assert(F.infer({health:5,ammo:5,noise:30,pressure:80,exposure:40,skill:50}).supply>
       F.infer({health:95,ammo:95,noise:30,pressure:5,exposure:40,skill:50}).supply,'desperation should raise supply');
console.log('PASS: 729 director rules, 27 micro rules, membership coverage, 300 randomized output checks, policy checks');

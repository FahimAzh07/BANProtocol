"use strict";
/* build_artifact.js — inline the whole game (+ the report) into single
   self-contained HTML files for publishing as claude.ai Artifacts.
   Run:  node build_artifact.js  <outDir>
   Produces  <outDir>/artifact_game.html  and  <outDir>/artifact_report.html
   The Artifact host wraps content in its own <!doctype><head><body>, so these
   files contain ONLY a <style> block + body content + inlined <script>s. */
const fs=require('fs'), path=require('path');
const out = process.argv[2] || '.';

/* ---- GAME (music-less, self-contained) ---- */
const ORDER=['config','balance','audio','world','fuzzy','state','weapons','roguelite',
  'advanced','mechanics','input','render','post','hud','screens','analytics','lib/three.min','render3d','main'];
const css = fs.readFileSync('css/style.css','utf8');
let js='';
for(const m of ORDER){
  let src=fs.readFileSync(path.join('js',m+'.js'),'utf8');
  if(m==='audio')  src=src.replace(/const PLAYLIST=\[[\s\S]*?\];/, 'const PLAYLIST=[];  // BGM omitted in the hosted build');
  if(m==='screens')src=src.replace(/const REPORT_URL=[^;]+;/, "const REPORT_URL='__REPORT_URL__';");
  js += `\n/* ===== js/${m}.js ===== */\n`+src+'\n';
}
const gameHtml =
`<style>${css}</style>
<div id="wrap"><canvas id="c"></canvas></div>
<div id="hint">WASD move · Mouse aim · Click/Space shoot · X alternate fire · Shift dash · F/RMB melee · E mine · T turret · Q/1/2/3 weapons · R reload · C analytics · Esc pause &nbsp;— click once to enable audio</div>
<script>${js}<\/script>`;
fs.writeFileSync(path.join(out,'artifact_game.html'), gameHtml);

/* ---- REPORT (strip the <html>/<head>/<body> wrapper, keep <style>+content) ---- */
const rep=fs.readFileSync(path.join('..','report','Progress_Report_1_UPDATED.html'),'utf8');
const style=(rep.match(/<style>[\s\S]*?<\/style>/)||[''])[0];
const body=(rep.match(/<body>([\s\S]*?)<\/body>/)||['',''])[1];
fs.writeFileSync(path.join(out,'artifact_report.html'), style+'\n'+body);

console.log('game bytes  :', gameHtml.length);
console.log('report bytes:', (style.length+body.length));

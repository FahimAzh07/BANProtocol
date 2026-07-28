"use strict";
/* ----------------------------------------------------------------------------
   audio.js — WebAudio engine. Provides:
     • BGM — a shuffled playlist of the Molchat Doma tracks in audio/, played on
       a plain <audio> element (its own volume/mute — routing a local file://
       track through WebAudio taints it to silence), auto-advancing, playing on
       the loading screen and all through the game. Skip with N.
     • SFX — shots (per weapon), hits, kills, explosions, pickups, power-ups,
       damage, reload, UI clicks (all procedurally synthesised, no files)
     • A subtle THREAT DRONE + low-health heartbeat layered under the music
   Toggle everything with the M key. Audio can only start after a user gesture
   (browser policy), so the context boots on the first click / keypress.
   ---------------------------------------------------------------------------- */
const Sound = (() => {
  let ac=null, master=null, sfxBus=null, ready=false, muted=false;
  let amb=null, ambFilter=null;
  let musicVol=0.5;                            // music level (× ducking)
  let hbT=0;                                   // heartbeat countdown
  function opts(){ return (typeof G!=='undefined'&&G.meta&&G.meta.opts)||{master:0.5,music:0.5,sfx:0.6}; }

  // background-music playlist (files in game/audio/) — shuffled each session.
  // `bpm` drives the beat-pulse FALLBACK used when we can't analyse the audio
  // (i.e. opened via file://). Tweak these if a track's pulse feels off-tempo.
  const PLAYLIST=[
    {file:'audio/bgm1.mp3', title:'Волны',     bpm:146},
    {file:'audio/bgm2.mp3', title:'Клетка',    bpm:120},
    {file:'audio/bgm3.mp3', title:'На Дне',    bpm:130},
    {file:'audio/bgm4.mp3', title:'Судно',     bpm:154},
    {file:'audio/bgm5.mp3', title:'Танцевать', bpm:132},
    {file:'audio/bgm6.mp3', title:'Тоска',     bpm:122},
  ];
  let bgmEl=null, bgmStarted=false, order=[], cur=0;
  // beat-reactive lighting: real FFT analyser on http(s), tempo-pulse on file://
  let analyser=null, freqData=null, bassAvg=0, beat=0;

  function init(){
    if(ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    ac = new AC();
    const o=opts(); musicVol=o.music;
    master = ac.createGain(); master.gain.value = muted?0:o.master; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = o.sfx; sfxBus.connect(master);   // SFX volume bus
    // adaptive ambient pad: three detuned saws → lowpass → ambient gain
    amb = ac.createGain(); amb.gain.value = 0.0;
    ambFilter = ac.createBiquadFilter(); ambFilter.type='lowpass';
    ambFilter.frequency.value=240; ambFilter.Q.value=7;
    amb.connect(ambFilter); ambFilter.connect(master);
    [55, 55.4, 82.41].forEach(f=>{
      const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
      const g=ac.createGain(); g.gain.value=0.33; o.connect(g); g.connect(amb); o.start();
    });
    ready=true;
  }
  function resume(){ if(ac && ac.state==='suspended') ac.resume(); }
  function now(){ return ac.currentTime; }

  /* ---- background music: shuffled, auto-advancing playlist ---- */
  function shuffle(n){ const a=[...Array(n).keys()];
    for(let i=n-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function playTrack(i){ if(!bgmEl) return; cur=(i%order.length+order.length)%order.length;
    bgmEl.src=PLAYLIST[order[cur]].file; const p=bgmEl.play(); if(p&&p.catch) p.catch(()=>{}); }
  function startBGM(){
    if(bgmStarted || !ready) return; bgmStarted=true;
    order=shuffle(PLAYLIST.length);
    if(!PLAYLIST.length) return;               // no soundtrack bundled (e.g. hosted Artifact build)
    bgmEl=new Audio(); bgmEl.preload='auto'; bgmEl.muted=muted; bgmEl.volume=musicVol;
    // On a server (http/https) we can route through an analyser for REAL beat
    // detection and still hear it. On file:// that routing silences the track,
    // so we skip it and fall back to a tempo pulse (see tick()).
    if(location.protocol!=='file:'){
      try{
        const src=ac.createMediaElementSource(bgmEl);
        analyser=ac.createAnalyser(); analyser.fftSize=256; analyser.smoothingTimeConstant=0.55;
        freqData=new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser); analyser.connect(ac.destination);   // audible through the graph
      }catch(e){ analyser=null; }
    }
    bgmEl.addEventListener('ended', ()=>playTrack(cur+1));        // next track when one finishes
    bgmEl.addEventListener('error', ()=>setTimeout(()=>playTrack(cur+1),500));
    playTrack(0);
  }

  function noiseBuf(dur){
    const n=Math.floor(ac.sampleRate*dur), b=ac.createBuffer(1,n,ac.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return b;
  }
  // pitched tone with optional sweep and percussive envelope
  function tone(type,f0,f1,dur,peak,dest){
    const o=ac.createOscillator(), g=ac.createGain(); o.type=type;
    const t=now(); o.frequency.setValueAtTime(f0,t);
    if(f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(peak,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(dest||sfxBus); o.start(t); o.stop(t+dur+0.03);
  }
  // filtered noise burst — the body of every gunshot / explosion
  function burst(dur,peak,hp,lp,dest){
    const src=ac.createBufferSource(); src.buffer=noiseBuf(dur);
    const g=ac.createGain(); const t=now();
    g.gain.setValueAtTime(peak,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    let node=src;
    if(hp){ const f=ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; node.connect(f); node=f; }
    if(lp){ const f=ac.createBiquadFilter(); f.type='lowpass';  f.frequency.value=lp; node.connect(f); node=f; }
    node.connect(g); g.connect(dest||sfxBus); src.start(t); src.stop(t+dur+0.03);
  }

  const api={};
  api.shot=(w)=>{ if(!ready)return;
    if(w==='shotgun'){ burst(0.18,0.5,400,4500); tone('square',180,60,0.12,0.22); }
    else if(w==='bazooka'){ tone('sine',150,40,0.35,0.5); burst(0.30,0.35,80,1200); }
    else { burst(0.06,0.4,900,7000); tone('square',330,120,0.05,0.16); }     // rifle
  };
  api.hit=()=>{ if(!ready)return; burst(0.05,0.22,1200,6000); };
  api.kill=()=>{ if(!ready)return; tone('triangle',260,90,0.16,0.28); burst(0.12,0.22,200,2500); };
  api.explosion=()=>{ if(!ready)return; tone('sine',120,30,0.5,0.6); burst(0.45,0.5,55,1500); };
  api.nuke=()=>{ if(!ready)return; tone('sawtooth',95,20,0.9,0.55); burst(0.8,0.5,40,2200); };
  api.pickup=()=>{ if(!ready)return; tone('triangle',520,880,0.12,0.28); };
  api.powerup=()=>{ if(!ready)return; [440,660,880].forEach((f,i)=>setTimeout(()=>tone('square',f,f,0.1,0.2),i*55)); };
  api.hurt=()=>{ if(!ready)return; tone('sawtooth',180,70,0.18,0.32); burst(0.10,0.18,100,900); };
  api.reload=()=>{ if(!ready)return; tone('square',150,150,0.03,0.1); setTimeout(()=>tone('square',210,210,0.03,0.1),90); };
  api.ui=()=>{ if(!ready)return; tone('square',440,580,0.06,0.13); };
  api.dash=()=>{ if(!ready)return; burst(0.16,0.18,300,2600); };                       // whoosh
  api.melee=()=>{ if(!ready)return; burst(0.08,0.20,600,5200); tone('square',300,140,0.06,0.12); };
  api.heartbeat=()=>{ if(!ready)return; tone('sine',62,40,0.18,0.5); };
  api.wave=()=>{ if(!ready)return; tone('square',330,440,0.12,0.2); setTimeout(()=>tone('square',440,660,0.14,0.22),120); };
  api.boss=()=>{ if(!ready)return; tone('sawtooth',110,55,0.7,0.4); tone('square',58,38,0.9,0.32);
    setTimeout(()=>tone('sawtooth',146,73,0.6,0.35),200); };

  /* per-frame: ambient follows Threat; heartbeat when health is critical;
     everything ducks to silence outside the play state. */
  api.tick=(state,threat)=>{
    if(!ready) return;
    const active = state==='play';
    const n = Math.max(0, Math.min(1, (threat||0)/100));
    const t = now();
    // subtle threat drone UNDER the music; duck the BGM a touch during play so SFX cut through
    amb.gain.setTargetAtTime(active ? n*0.05 : 0.0, t, 0.6);
    ambFilter.frequency.setTargetAtTime(active ? 220 + n*1000 : 220, t, 0.6);
    // DYNAMIC MUSIC — fuller/louder as Threat rises during play, ducked on menus
    if(bgmEl && !muted) bgmEl.volume = Math.min(1, musicVol * (active ? 0.80+n*0.20 : 1));
    if(active && typeof G!=='undefined' && G.player && G.player.hp>0 && G.player.hp/G.player.maxhp < 0.28){
      if(--hbT<=0){ api.heartbeat(); hbT=Math.round(42 - n*12); }
    } else hbT=0;

    // BEAT → drives beat-reactive lighting (see render.js)
    if(bgmStarted && !muted){
      if(analyser){                                   // real onset detection from bass energy
        analyser.getByteFrequencyData(freqData);
        let bass=0; for(let i=1;i<8;i++) bass+=freqData[i]; bass/=(7*255);   // 0..1 low band
        bassAvg = bassAvg*0.92 + bass*0.08;
        if(bass > bassAvg*1.30 + 0.02) beat = 1;      // a kick landed
      } else if(bgmEl && bgmEl.currentTime>0){        // file:// — steady tempo pulse
        const bpm=(PLAYLIST[order[cur]] && PLAYLIST[order[cur]].bpm) || 124, bl=60/bpm;
        beat = Math.max(beat, Math.pow(1-(bgmEl.currentTime % bl)/bl, 4));
      }
    }
    beat *= 0.86;                                     // decay toward 0 each frame
  };
  api.beat=()=> beat;

  api.toggleMute=()=>{ muted=!muted;
    if(master) master.gain.setTargetAtTime(muted?0:0.5, now(), 0.05);
    if(bgmEl) bgmEl.muted=muted;                 // also covers the fallback path
    return muted; };
  api.isMuted=()=>muted;
  api.isReady=()=>ready;
  api.setMaster=(v)=>{ if(master) master.gain.value=muted?0:v; };
  api.setSfx=(v)=>{ if(sfxBus) sfxBus.gain.value=v; };
  api.setMusic=(v)=>{ musicVol=v; if(bgmEl) bgmEl.muted=muted; };
  api.nextTrack=()=>{ if(bgmStarted) playTrack(cur+1); };
  api.nowPlaying=()=> (bgmStarted && PLAYLIST[order[cur]]) ? PLAYLIST[order[cur]].title : null;
  api.hasBGM=()=> PLAYLIST.length>0;

  // browsers block audio until a user gesture — boot everything on the first one
  const go=()=>{ init(); resume(); startBGM(); };
  ['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,go));
  return api;
})();
// NOTE: a top-level `const` in a classic script is NOT a property of window, so
// the `if(window.Sound)` guards elsewhere need this explicit export to see it.
window.Sound = Sound;

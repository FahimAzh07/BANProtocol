"use strict";
/* ----------------------------------------------------------------------------
   render3d.js — first-person three.js renderer.
   Retro look: low-res render upscaled with image-rendering:pixelated, flat
   Lambert blocks, no shadows. ALL game logic stays on the 2D plane
   (game y → 3D z); this file only visualises G's state.
   The 2D canvas (#c) sits on top, transparent, and keeps drawing the HUD.
   ---------------------------------------------------------------------------- */
const R3={renderer:null,scene:null,camera:null,worldGroup:null,
  enemies:new Map(),bullets:new Map(),pickups:new Map(),
  guns:{},gunRig:null,muzzleLight:null,flashMesh:null,
  bulletGeo:null,bulletMat:null,rocketMat:null};
const PIXEL_RES=0.25;                       // render at quarter res → chunky pixels

function init3D(){
  R3.renderer=new THREE.WebGLRenderer({antialias:false});
  R3.renderer.setPixelRatio(1);
  R3.renderer.setSize(W*PIXEL_RES,H*PIXEL_RES,false);
  const el=R3.renderer.domElement;
  el.id='c3d';
  el.style.position='absolute';
  el.style.left='50%';el.style.top='50%';el.style.transform='translate(-50%,-50%)';
  el.style.imageRendering='pixelated';
  document.getElementById('wrap').insertBefore(el,cv);
  el.style.display=(G.meta&&G.meta.opts&&G.meta.opts.view3d)?'block':'none';
  syncGlSize();
  window.addEventListener('resize',syncGlSize);

  R3.scene=new THREE.Scene();
  R3.scene.background=new THREE.Color(0x0a1428);
  R3.scene.fog=new THREE.Fog(0x0a1428,300,2200);
  R3.camera=new THREE.PerspectiveCamera(75,W/H,1,5000);
  R3.camera.rotation.order='YXZ';
  R3.scene.add(R3.camera);

  R3.scene.add(new THREE.HemisphereLight(0xbfd8ff,0x202830,0.95));
  const dir=new THREE.DirectionalLight(0xffffff,0.45);
  dir.position.set(0.4,1,0.6);R3.scene.add(dir);

  R3.muzzleLight=new THREE.PointLight(0xffd36b,0,320);
  R3.scene.add(R3.muzzleLight);

  R3.bulletGeo=new THREE.BoxGeometry(9,3,3);
  R3.bulletMat=new THREE.MeshBasicMaterial({color:0xfff3c4});
  R3.rocketMat=new THREE.MeshBasicMaterial({color:0xff9b5d});

  buildGuns();
}
function set3DEnabled(on){
  if(R3.renderer)R3.renderer.domElement.style.display=on?'block':'none';
  if(on&&R3.scene){G.fpAngle=G.player.angle||0;mouse.x=W/2;mouse.y=H/2;build3DWorld();}
  else if(document.pointerLockElement===cv&&document.exitPointerLock)document.exitPointerLock();
}
function syncGlSize(){
  const el=R3.renderer.domElement;
  el.style.width=cv.style.width; el.style.height=cv.style.height;
}

/* ---- static world: floor, instanced wall cubes, fog cylinders ---- */
function build3DWorld(){
  if(!R3.scene) return;
  if(R3.worldGroup) R3.scene.remove(R3.worldGroup);
  for(const[,m]of R3.enemies)R3.scene.remove(m); R3.enemies.clear();
  for(const[,m]of R3.bullets)R3.scene.remove(m); R3.bullets.clear();
  for(const[,m]of R3.pickups)R3.scene.remove(m); R3.pickups.clear();

  const g=new THREE.Group();
  // checkerboard floor (2×2 px canvas texture, nearest-filtered = big retro tiles)
  const fc=document.createElement('canvas');fc.width=fc.height=2;
  const fx=fc.getContext('2d');
  fx.fillStyle='#0c1422';fx.fillRect(0,0,2,2);
  fx.fillStyle='#101b2e';fx.fillRect(0,0,1,1);fx.fillRect(1,1,1,1);
  const ft=new THREE.CanvasTexture(fc);
  ft.magFilter=THREE.NearestFilter;ft.wrapS=ft.wrapT=THREE.RepeatWrapping;
  ft.repeat.set(MW,MH);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W,WORLD_H),
    new THREE.MeshLambertMaterial({map:ft}));
  floor.rotation.x=-Math.PI/2;floor.position.set(WORLD_W/2,0,WORLD_H/2);
  g.add(floor);
  // walls: one InstancedMesh for every solid tile
  let count=0;
  for(let r=0;r<MH;r++)for(let c=0;c<MW;c++) if(solid[r][c])count++;
  const wm=new THREE.InstancedMesh(new THREE.BoxGeometry(TILE,90,TILE),
    new THREE.MeshLambertMaterial({color:0x24364f}),count);
  const m4=new THREE.Matrix4();let i=0;
  for(let r=0;r<MH;r++)for(let c=0;c<MW;c++) if(solid[r][c]){
    m4.setPosition(c*TILE+TILE/2,45,r*TILE+TILE/2);wm.setMatrixAt(i++,m4);}
  wm.instanceMatrix.needsUpdate=true;
  g.add(wm);
  // fog hiding zones: translucent cylinders + cap
  const fogMat=new THREE.MeshBasicMaterial({color:0x9aa6bd,transparent:true,
    opacity:0.38,side:THREE.DoubleSide,depthWrite:false});
  for(const f of fogs){
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(f.r,f.r,86,14,1,true),fogMat);
    cyl.position.set(f.x,43,f.y);g.add(cyl);
    const cap=new THREE.Mesh(new THREE.CircleGeometry(f.r,14),fogMat);
    cap.rotation.x=-Math.PI/2;cap.position.set(f.x,86,f.y);g.add(cap);
  }
  // v7 sector hazards, objective markers, cache and extraction are visible in 3D too
  const marker=(x,z,r,col,src)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,2,20),
    new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.58,depthWrite:false}));
    mesh.position.set(x,1.5,z);mesh.userData.source=src;g.add(mesh);return mesh;};
  for(const h of (G.hazards||[]))marker(h.x,h.y,h.r,h.type==='fire'?0xff6e32:h.type==='spore'?0x82ff50:0x60cfff,h);
  for(const l of (G.landmarks||[])){const m=new THREE.Mesh(new THREE.BoxGeometry(44,30,34),new THREE.MeshLambertMaterial({color:0x8b7652}));
    m.position.set(l.x,15,l.y);m.userData.source=l;g.add(m);}
  if(G.extract&&!G.extract.done)marker(G.extract.x,G.extract.y,G.extract.r,0x7cff9b,G.extract);
  const o=G.objective;if(o&&!o.done){if(o.id==='hold')marker(o.x,o.y,o.r,0x5fd0ff,o);
    else if(o.id==='courier'&&!o.carried){const m=new THREE.Mesh(new THREE.OctahedronGeometry(14),new THREE.MeshBasicMaterial({color:0xffffff}));m.position.set(o.x,18,o.y);m.userData.source=o;g.add(m);}
    else for(const x of o.items){const m=new THREE.Mesh(o.id==='nests'?new THREE.SphereGeometry(x.r,10,7):new THREE.BoxGeometry(26,42,26),
      new THREE.MeshLambertMaterial({color:o.id==='nests'?0x75c936:0x5fd0ff}));m.position.set(x.x,o.id==='nests'?x.r:21,x.y);m.userData.source=x;g.add(m);}}
  R3.scene.add(g);R3.worldGroup=g;
}

/* ---- blocky zombie (Minecraft-style: arms stretched forward) ---- */
function makeZombieMesh(e){
  const grp=new THREE.Group();
  const skin=new THREE.MeshLambertMaterial({color:0x6fae52});
  const shirt=new THREE.MeshLambertMaterial({color:new THREE.Color(e.col)});
  const pants=new THREE.MeshLambertMaterial({color:0x2b3a4a});
  const add=(w,h,d,m,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
    b.position.set(x,y,z);grp.add(b);return b;};
  add(16,16,16,skin,0,56,0);                              // head
  const eyeM=new THREE.MeshBasicMaterial({color:0xff2222});
  const e1=new THREE.Mesh(new THREE.BoxGeometry(2,3,3),eyeM);
  e1.position.set(8.5,58,-4);grp.add(e1);
  const e2=e1.clone();e2.position.z=4;grp.add(e2);
  add(10,26,18,shirt,0,36,0);                             // torso
  grp.userData.armL=add(20,5,5,skin,12,46,-7);            // arms forward (+X = facing)
  grp.userData.armR=add(20,5,5,skin,12,46,7);
  grp.userData.legL=add(7,20,7,pants,0,10,-5);
  grp.userData.legR=add(7,20,7,pants,0,10,5);
  grp.userData.mats=[skin,shirt,pants];
  grp.userData.lastHp=e.hp;grp.userData.hit=0;
  grp.scale.setScalar((e.r/16)*(e.type==='brute'?1.35:e.type==='runner'?0.85:1.05));
  return grp;
}

function syncEntities(){
  if(R3.worldGroup)R3.worldGroup.traverse(m=>{const s=m.userData&&m.userData.source;if(s)m.visible=!s.done&&!s.opened;});
  // zombies
  for(const e of G.enemies){
    let m=R3.enemies.get(e);
    if(!m){m=makeZombieMesh(e);R3.enemies.set(e,m);R3.scene.add(m);}
    const wb=G.power.freeze>0?e.wob:G.t*0.12+e.wob;
    m.position.set(e.x,Math.abs(Math.sin(wb))*2,e.y);
    m.rotation.y=-Math.atan2(e.ty-e.y,e.tx-e.x);
    m.userData.armL.rotation.z=Math.sin(wb)*0.15;
    m.userData.armR.rotation.z=-Math.sin(wb)*0.15;
    m.userData.legL.position.x=Math.sin(wb)*4;
    m.userData.legR.position.x=-Math.sin(wb)*4;
    if(e.hp<m.userData.lastHp){m.userData.hit=6;m.userData.lastHp=e.hp;}
    if(m.userData.hit>0)m.userData.hit--;
    const em=m.userData.hit>0?0x802020:(G.power.freeze>0?0x224a66:0x000000);
    for(const mt of m.userData.mats)mt.emissive.setHex(em);
  }
  for(const[e,m]of R3.enemies)
    if(e.dead||!G.enemies.includes(e)){R3.scene.remove(m);R3.enemies.delete(e);}
  // bullets
  for(const b of G.bullets){
    let m=R3.bullets.get(b);
    if(!m){m=new THREE.Mesh(R3.bulletGeo,b.explosive?R3.rocketMat:R3.bulletMat);
      if(b.explosive)m.scale.setScalar(2.2);
      R3.scene.add(m);R3.bullets.set(b,m);}
    m.position.set(b.x,34,b.y);
    m.rotation.y=-Math.atan2(b.vy,b.vx);
  }
  for(const[b,m]of R3.bullets)
    if(b.life<=0||!G.bullets.includes(b)){R3.scene.remove(m);R3.bullets.delete(b);}
  // pickups
  for(const k of G.pickups){
    let m=R3.pickups.get(k);
    if(!m){
      if(k.type==='power')
        m=new THREE.Mesh(new THREE.OctahedronGeometry(11),
          new THREE.MeshBasicMaterial({color:new THREE.Color(POWERUPS[k.kind].col)}));
      else
        m=new THREE.Mesh(new THREE.BoxGeometry(13,13,13),
          new THREE.MeshBasicMaterial({color:k.type==='hp'?0x46e08c:0xffd36b}));
      R3.scene.add(m);R3.pickups.set(k,m);
    }
    m.position.set(k.x,22+Math.sin(k.bob)*4,k.y);
    m.rotation.y=k.bob;
  }
  for(const[k,m]of R3.pickups)
    if(k.taken||!G.pickups.includes(k)){R3.scene.remove(m);R3.pickups.delete(k);}
}

/* ---- first-person viewmodels ---- */
function buildGun(kind){
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0x3a4654});
  const dark=new THREE.MeshLambertMaterial({color:0x1e252e});
  const add=(w,h,d,x,y,z,m)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m||mat);
    b.position.set(x,y,z);g.add(b);return b;};
  if(kind==='rifle'){ add(0.8,1.0,6,0,0,-3); add(0.5,0.5,3,0,0.15,-6,dark); add(0.8,1.4,1.6,0,-0.9,-0.4,dark); }
  else if(kind==='shotgun'){ add(0.7,0.7,5,-0.45,0,-3,dark); add(0.7,0.7,5,0.45,0,-3,dark); add(1.8,1.2,2,0,-0.4,-0.2); }
  else { add(2.2,2.2,7,0,0,-3); add(2.6,2.6,1.2,0,0,-6.6,new THREE.MeshLambertMaterial({color:0xbb3333})); }
  return g;
}
function buildGuns(){
  R3.gunRig=new THREE.Group();
  for(const k of ['rifle','shotgun','bazooka']){
    const g=buildGun(k);g.visible=false;R3.guns[k]=g;R3.gunRig.add(g);}
  R3.flashMesh=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.6,1.6),
    new THREE.MeshBasicMaterial({color:0xffe9a0}));
  R3.flashMesh.position.set(0,0,-7);R3.flashMesh.visible=false;
  R3.gunRig.add(R3.flashMesh);
  R3.gunRig.position.set(3.4,-2.6,-6);
  R3.camera.add(R3.gunRig);
}

/* ---- per-frame render ---- */
function render3D(){
  if(!R3.renderer) return;
  const p=G.player;
  // threat-tinted atmosphere: calm deep blue → hostile blood red
  const th=(G.directorThreat==null?G.fuzzy.threat:G.directorThreat)/100;
  R3.scene.background.setHex(0x0a1428).lerp(new THREE.Color(0x351016),th);
  R3.scene.fog.color.copy(R3.scene.background);
  // camera = player eyes (+ shake + head bob)
  const shx=(Math.random()-0.5)*G.shake, shz=(Math.random()-0.5)*G.shake;
  R3.camera.position.set(p.x+shx,40+Math.sin(p.walk)*1.2,p.y+shz);
  R3.camera.rotation.y=-p.angle-Math.PI/2;
  R3.camera.rotation.x=G.pitch;
  // viewmodel
  for(const k in R3.guns)R3.guns[k].visible=(k===G.weapon&&G.state!=='dead');
  R3.gunRig.position.z=-6+p.recoil*0.25;
  R3.gunRig.position.y=-2.6+Math.sin(p.walk)*0.12;
  R3.flashMesh.visible=p.muzzle>0;
  R3.muzzleLight.position.set(p.x+Math.cos(p.angle)*30,40,p.y+Math.sin(p.angle)*30);
  R3.muzzleLight.intensity=p.muzzle>0?2.2:0;
  syncEntities();
  R3.renderer.render(R3.scene,R3.camera);
}
/* world point → screen px on the HUD canvas (for floaters) */
const _pv=new THREE.Vector3();
function project3D(x,h,z){
  _pv.set(x,h,z).project(R3.camera);
  return {x:(_pv.x*0.5+0.5)*W, y:(-_pv.y*0.5+0.5)*H, vis:_pv.z>-1&&_pv.z<1};
}
init3D();

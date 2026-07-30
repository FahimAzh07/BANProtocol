"use strict";
/* ----------------------------------------------------------------------------
   input.js — keyboard + mouse + gamepad + touch controls.
   Updated: Tab key toggles Logic Dashboard.
   PC-ready version.
   ---------------------------------------------------------------------------- */
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  // Bind capture (settings controls)
  if (G.bindCapture) {
    G.meta.binds[G.bindCapture] = k;
    G.bindCapture = null;
    saveMeta();
    if (window.Sound) Sound.ui();
    return;
  }

  // Prevent scrolling with arrow keys / space
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

  // ---- SYSTEM DOSSIER (report) ----
  if (G.state === 'report') {
    const jump = 420;
    if (k === 'escape' || k === 'backspace') { G.state = 'setup'; if (window.Sound) Sound.ui(); }
    else if (k === 'arrowdown') G.reportScroll = Math.min(G._reportMax || 0, (G.reportScroll || 0) + 48);
    else if (k === 'arrowup') G.reportScroll = Math.max(0, (G.reportScroll || 0) - 48);
    else if (k === 'pagedown' || k === ' ') G.reportScroll = Math.min(G._reportMax || 0, (G.reportScroll || 0) + jump);
    else if (k === 'pageup') G.reportScroll = Math.max(0, (G.reportScroll || 0) - jump);
    return;
  }

  // ---- RUN HISTORY ----
  if (G.state === 'history') {
    if (k === 'escape' || k === 'backspace') G.state = 'setup';
    return;
  }

  // ---- TUTORIAL ----
  if (G.tutorial) {
    G.tutorial = false;
    G.meta.tutorialSeen = true;
    saveMeta();
    return;
  }

  // ---- SETTINGS ----
  if (G.showSettings) {
    if (k === 'escape') { G.showSettings = false; saveMeta(); }
    return;
  }

  // ---- ANALYTICS OVERLAY (C) ----
  if (actionPressed(k, 'analytics') && G.state === 'play') {
    G.showAnalytics = !G.showAnalytics;
    if (G.showAnalytics) { G._surface = null; computeSurface(); }
    return;
  }
  if (G.showAnalytics) {
    if (k === 'escape') G.showAnalytics = false;
    return;
  }

  // ---- LOGIC DASHBOARD (Tab) ----
  if (k === 'tab' && G.state === 'play') {
    e.preventDefault(); // Stop Tab from jumping to UI elements
    G.showDashboard = !G.showDashboard;
    if (window.Sound) Sound.ui();
    return;
  }
  if (G.showDashboard && k === 'tab') {
    e.preventDefault();
    G.showDashboard = false;
    if (window.Sound) Sound.ui();
    return;
  }

  // ---- GAME ACTIONS ----
  if (actionPressed(k, 'reload')) reload();
  if (actionPressed(k, 'cycle')) cycleWeapon();
  if (k === '1') switchWeapon('rifle');
  if (k === '2') switchWeapon('shotgun');
  if (k === '3') switchWeapon('bazooka');
  if (k === 'b' && G.state === 'play') G.showRules = !G.showRules;
  if (k === 'v' && G.state === 'play') G.showGraphs = !G.showGraphs;
  if (k === 'm') {
    const muted = window.Sound ? Sound.toggleMute() : false;
    if (G.state === 'play') floater(G.player.x, G.player.y - 30, muted ? 'SOUND OFF' : 'SOUND ON', '#9bdcff');
  }
  if (k === 'n' && window.Sound) {
    Sound.nextTrack();
    if (G.state === 'play') {
      const t = Sound.nowPlaying();
      if (t) floater(G.player.x, G.player.y - 30, '♪ ' + t, '#c9a0ff');
    }
  }
  if (actionPressed(k, 'dash') && G.state === 'play') dash();
  if (actionPressed(k, 'melee') && G.state === 'play') melee();
  if (actionPressed(k, 'mine') && G.state === 'play') deployMine();
  if (actionPressed(k, 'turret') && G.state === 'play') deployTurret();
  if (actionPressed(k, 'alt') && G.state === 'play') alternateFire();
  if (G.state === 'perk' && (k === '1' || k === '2' || k === '3')) choosePerk(+k - 1);

  // ---- GOD MODE (G) ----
  if (k === 'g' && (G.state === 'play' || G.state === 'paused')) {
    G.settings.god = !G.settings.god;
    floater(G.player.x, G.player.y - 30, G.settings.god ? 'GOD MODE ON' : 'GOD MODE OFF', '#ffd36b');
  }

  // ---- PAUSE (Esc) ----
  if (actionPressed(k, 'pause') && G.state === 'play') {
    G.state = 'paused';
    if (typeof saveRun === 'function') saveRun();
  } else if (actionPressed(k, 'pause') && G.state === 'paused') {
    G.state = 'play';
  } else if (k === 'escape' && G.state === 'shop') {
    G.state = 'setup';
  }
});

addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function cpos(e) {
  const r = cv.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (cv.width / r.width),
    y: (e.clientY - r.top) * (cv.height / r.height)
  };
}

cv.addEventListener('mousemove', e => {
  let p = cpos(e);
  if (G.meta.opts.view3d && document.pointerLockElement === cv) {
    G.fpAngle += e.movementX * 0.0025;
    G.pitch = Math.max(-0.75, Math.min(0.75, G.pitch - e.movementY * 0.002));
    p = { x: W / 2, y: H / 2 };
  }
  mouse.x = p.x;
  mouse.y = p.y;
  dragSlider(p);
  if (setDragKey) setSlideVal(p);
});

cv.addEventListener('mousedown', e => {
  const p = cpos(e);
  mouse.x = p.x;
  mouse.y = p.y;
  if (G.showAnalytics) { handleAnalytics(p); return; }
  if (e.button === 2) { if (G.state === 'play') melee(); return; }
  if (G.meta.opts.view3d && G.state === 'play' && document.pointerLockElement !== cv && cv.requestPointerLock) cv.requestPointerLock();
  mouse.down = true;
  handleDown(p);
});

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  if (G.state === 'report') {
    e.preventDefault();
    G.reportScroll = Math.max(0, Math.min(G._reportMax || 0, (G.reportScroll || 0) + e.deltaY));
  }
}, { passive: false });

addEventListener('mouseup', () => {
  mouse.down = false;
  activeSlider = null;
  if (setDragKey) { setDragKey = null; saveMeta(); }
});

/* ---------------- GAMEPAD ---------------- */
function gamepadState() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gps) {
    if (!gp || !gp.connected) continue;
    const dz = v => Math.abs(v) < 0.18 ? 0 : v;
    const B = i => gp.buttons[i] && gp.buttons[i].pressed;
    return {
      active: true,
      mx: dz(gp.axes[0] || 0),
      my: dz(gp.axes[1] || 0),
      ax: dz(gp.axes[2] || 0),
      ay: dz(gp.axes[3] || 0),
      shoot: B(7) || B(0),
      dash: B(1) || B(6),
      melee: B(2)
    };
  }
  return { active: false };
}

/* ---------------- TOUCH (virtual dual-stick: left = move, right = aim/fire) --- */
let touchMove = null,
  touchAim = null;

function touchXY(t) {
  const r = cv.getBoundingClientRect();
  return {
    x: (t.clientX - r.left) * (cv.width / r.width),
    y: (t.clientY - r.top) * (cv.height / r.height)
  };
}

cv.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = touchXY(t);
    if (G.state !== 'play') {
      mouse.x = p.x;
      mouse.y = p.y;
      handleDown(p);
      continue;
    }
    if (p.x < W / 2 && !touchMove) {
      touchMove = { id: t.identifier, sx: p.x, sy: p.y, x: p.x, y: p.y };
    } else if (!touchAim) {
      touchAim = { id: t.identifier };
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.down = true;
    }
  }
}, { passive: false });

cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = touchXY(t);
    if (touchMove && t.identifier === touchMove.id) {
      touchMove.x = p.x;
      touchMove.y = p.y;
    }
    if (touchAim && t.identifier === touchAim.id) {
      mouse.x = p.x;
      mouse.y = p.y;
    }
  }
}, { passive: false });

cv.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (touchMove && t.identifier === touchMove.id) touchMove = null;
    if (touchAim && t.identifier === touchAim.id) {
      touchAim = null;
      mouse.down = false;
    }
  }
});
"use strict";
/* ----------------------------------------------------------------------------
   post.js — cheap full-screen BLOOM. Downsample the rendered frame into a
   small buffer, then add it back over the canvas with 'lighter' compositing
   and a blur. Bright pixels (muzzle flash, bullets, glowing eyes, explosions,
   neon HUD accents) bleed light; dark pixels add ~nothing — a modern, glowy
   look for a few tenths of a millisecond per frame.
   ---------------------------------------------------------------------------- */
const _bloom = document.createElement('canvas');
_bloom.width = 320; _bloom.height = 180;
const _bctx = _bloom.getContext('2d');

function applyBloom(strength){
  if(!_bctx) return;
  _bctx.clearRect(0,0,320,180);
  _bctx.filter = 'blur(2px)';
  _bctx.drawImage(cv, 0, 0, 320, 180);     // downsample current frame
  _bctx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength==null ? 0.5 : strength;
  ctx.filter = 'blur(7px)';                 // soft upscaled glow
  ctx.drawImage(_bloom, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();
}

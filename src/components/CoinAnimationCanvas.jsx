import React, { useRef, useEffect } from 'react';

// "Scram" — particle disintegration boomerang loop
// "blurr" — pulsing blur/focus cycle
export default function CoinAnimationCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const COLOR = 'yellowgreen';
    const FONT_SIZE = 66;
    const FONT = `900 ${FONT_SIZE}px Inter, "Arial Black", Arial, sans-serif`;

    // ── Measure text so we can centre both words together ──
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    const scramW = ctx.measureText('Scram').width;
    const blurrW = ctx.measureText('blurr').width;
    const GAP    = 10; // pixel gap between the two words
    const totalW = scramW + GAP + blurrW;
    const leftX  = (W - totalW) / 2;    // x where "Scram" starts
    const blurrX = leftX + scramW + GAP; // x where "blurr" starts
    const midY   = H / 2;

    // ── Build "Scram" particle system via offscreen pixel sampling ──
    const off    = document.createElement('canvas');
    off.width    = W;
    off.height   = H;
    const offCtx = off.getContext('2d');
    offCtx.font         = FONT;
    offCtx.textBaseline = 'middle';
    offCtx.textAlign    = 'left';
    offCtx.fillStyle    = COLOR;
    offCtx.fillText('Scram', leftX, midY);

    const pixels    = offCtx.getImageData(0, 0, W, H).data;
    const particles = [];
    const STEP      = 3; // sample every 3rd pixel — balances detail vs count

    const scramCX = leftX + scramW / 2; // centroid of "Scram" for scatter direction

    for (let py = 0; py < H; py += STEP) {
      for (let px = 0; px < W; px += STEP) {
        const i = (py * W + px) * 4;
        if (pixels[i + 3] > 120) {
          // Radiate outward from the word's centre, with a random spread angle
          const angle = Math.atan2(py - midY, px - scramCX) + (Math.random() - 0.5) * 1.4;
          const dist  = 35 + Math.random() * 160;
          particles.push({
            hx: px,  hy: py,                          // home (text) position
            sx: px + Math.cos(angle) * dist,          // scatter position
            sy: py + Math.sin(angle) * dist,
            r:  STEP * (0.45 + Math.random() * 0.85), // base radius
          });
        }
      }
    }

    // ── Animation state ──
    let animId;
    let solidTextTs = -1;  // timestamp when the current solid-text phase started
    let t           = 0;   // 0 = reconstituted, 1 = scattered
    let dir         = 1;   // 1 = scattering, -1 = reconstituting
    let pauseUntil  = 0;   // timestamp (ms) until which movement is paused
    const SPEED    = 0.0045; // slowed 50% from original 0.009
    const PAUSE_MS = 500;    // 0.5 s pause at the fully-scattered end
    const INTRO_MS = 500;    // solid text hold before crossfade begins
    const FADE_MS  = 800;    // crossfade from solid text → particles

    function easeInOut(v) {
      return v < 0.5 ? 2 * v * v : -1 + (4 - 2 * v) * v;
    }
    function lerp(a, b, v) { return a + (b - a) * v; }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    function draw(ts) {
      ctx.clearRect(0, 0, W, H);

      // Initialise on the very first frame
      if (solidTextTs < 0) {
        solidTextTs = ts;
        pauseUntil  = ts + FADE_MS + INTRO_MS + FADE_MS;
      }

      const elapsed = ts - solidTextTs;

      // Solid text: fades IN over FADE_MS, holds for INTRO_MS, fades OUT over FADE_MS
      const fadeIn  = clamp(elapsed / FADE_MS, 0, 1);
      const fadeOut = clamp(1 - (elapsed - FADE_MS - INTRO_MS) / FADE_MS, 0, 1);
      const introTextAlpha = Math.min(fadeIn, fadeOut);
      // Particle layer is the inverse of the solid text
      const particleAlpha  = 1 - introTextAlpha;

      // Advance boomerang (skip if inside a pause window)
      if (ts >= pauseUntil) {
        t += SPEED * dir;
        if (t >= 1) {
          t = 1; dir = -1;
          pauseUntil = ts + PAUSE_MS;          // short pause at scattered end
        } else if (t <= 0) {
          t = 0; dir = 1;
          solidTextTs = ts;                              // restart the solid-text phase
          pauseUntil  = ts + FADE_MS + INTRO_MS + FADE_MS; // fade-in + hold + fade-out
        }
      }

      const et    = easeInOut(t);
      const alpha = lerp(1, 0.5, et) * particleAlpha; // particles fade in as solid text fades out
      const rMult = lerp(1, 0.45, et);

      // ── Scram solid intro text (fades out over FADE_MS after INTRO_MS) ──
      if (introTextAlpha > 0) {
        ctx.save();
        ctx.globalAlpha  = introTextAlpha;
        ctx.font         = FONT;
        ctx.fillStyle    = COLOR;
        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'left';
        ctx.fillText('Scram', leftX, midY);
        ctx.restore();
      }

      // ── Scram: draw all particles in one batched fill ──
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = COLOR;
      ctx.beginPath();
      for (const p of particles) {
        const x = lerp(p.hx, p.sx, et);
        const y = lerp(p.hy, p.sy, et);
        const r = p.r * rMult;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // ── blurr: sine-wave blur between 0 px (sharp) and 9 px (blurry) ──
      const blurT  = (Math.sin(ts * 0.0018) + 1) / 2; // 0->1, ~3.5 s period
      const blurPx = (blurT * 9).toFixed(2);
      ctx.save();
      ctx.filter       = `blur(${blurPx}px)`;
      ctx.font         = FONT;
      ctx.fillStyle    = COLOR;
      ctx.textBaseline = 'middle';
      ctx.textAlign    = 'left';
      ctx.fillText('blurr', blurrX, midY);
      ctx.restore(); // resets filter

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={660}
      height={120}
      style={{
        display: 'block',
        backgroundColor: 'transparent',
        margin: '0 auto',
      }}
    />
  );
}

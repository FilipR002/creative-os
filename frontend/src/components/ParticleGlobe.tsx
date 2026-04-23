/**
 * ParticleGlobe.tsx
 * Drop-in animated particle globe for Creative OS landing page.
 * Full-page fixed canvas with:
 *  - 4 orbital rings + sphere + atmosphere
 *  - Perspective projection (true 3D depth/zoom)
 *  - Mouse attraction (particles pull toward cursor)
 *  - Click burst (60 particles explode from click point)
 *  - Cursor trail (fading green dots)
 *  - Fast spin + state machine (sphere expands/contracts)
 *
 * Usage:
 *   import { ParticleGlobe } from './ParticleGlobe';
 *   // Place at the top of your page, outside any scroll container:
 *   <ParticleGlobe />
 */

'use client';

import React, { useEffect, useRef } from 'react';

export function ParticleGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    const el  = canvas as HTMLCanvasElement;   // non-null alias for closures
    const ctx = el.getContext('2d')!;

    // ── Palette ──────────────────────────────────────────────
    const COLORS = ['#00C97A','#34DFA0','#009F62','#6BFFC0','#00E88A','#A8FFD8','#00B870','#4DFFB0'];

    // ── Counts ───────────────────────────────────────────────
    const SPHERE_N = 1000;
    const RING_NS  = [560, 440, 360, 280]; // 4 rings
    const ATMOS_N  = 220;
    const N = SPHERE_N + RING_NS.reduce((a, b) => a + b, 0) + ATMOS_N;

    // Ring config: [radiusMultiplier, tiltRadians, orbitSpeedPerFrame]
    const RING_CFG: [number, number, number][] = [
      [1.55,  0.25,  0.022],
      [1.90,  1.15,  0.016],
      [2.28, -0.55,  0.013],
      [2.72,  0.65,  0.009],
    ];

    // ── Physics ───────────────────────────────────────────────
    const SPRING_K  = 0.030;
    const FRICTION  = 0.78;
    const ATTRACT_R = 180;
    const ATTRACT_F = 10.0;
    const TILT      = 0.41;
    const cosTilt   = Math.cos(TILT);
    const sinTilt   = Math.sin(TILT);
    const FOCAL     = 900; // perspective focal length — lower = more zoom

    // ── Buffer: 12 floats per particle ───────────────────────
    // [0-2] position xyz, [3-5] velocity xyz
    // [6-8] rest/target xyz, [9] angular offset
    // [10] base size, [11] colour index
    const buf     = new Float32Array(N * 12);
    const groupOf = new Uint8Array(N); // 0=sphere,1-4=rings,5=atmos

    let W = 0, H = 0, dpr = 1, baseR = 120;

    function setSize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      el.width  = W * dpr;
      el.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseR = Math.min(W, H) * 0.36; // controls sphere size on screen
    }

    // Pre-computed fill cache (avoids string allocation in hot loop)
    const ALPHA = [0.15, 0.25, 0.38, 0.52, 0.66, 0.78, 0.90, 1.00];
    const fillCache: string[][] = [];
    for (const hex of COLORS) {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      fillCache.push(ALPHA.map(a => `rgba(${r},${g},${b},${a.toFixed(2)})`));
    }

    // Fibonacci sphere distribution
    const PHI = Math.PI * (3 - Math.sqrt(5));
    function fibSphere(i: number, total: number, radius: number): [number,number,number] {
      const y  = 1 - (i / (total - 1)) * 2;
      const r  = Math.sqrt(Math.max(0, 1 - y * y));
      const th = PHI * i;
      return [Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius];
    }

    // ── Init ──────────────────────────────────────────────────
    function initParticles() {
      let idx = 0;

      // Sphere
      for (let i = 0; i < SPHERE_N; i++, idx++) {
        const b = idx * 12;
        const [rx, ry, rz] = fibSphere(i, SPHERE_N, baseR);
        buf[b]   = (Math.random() - .5) * W * .8;
        buf[b+1] = (Math.random() - .5) * H * .8;
        buf[b+2] = (Math.random() - .5) * 600;
        buf[b+3] = buf[b+4] = buf[b+5] = 0;
        buf[b+6] = rx; buf[b+7] = ry; buf[b+8] = rz;
        buf[b+9] = 0;
        buf[b+10] = 0.9 + Math.random() * 1.4;
        buf[b+11] = i % COLORS.length;
        groupOf[idx] = 0;
      }

      // 4 Rings
      for (let ri = 0; ri < 4; ri++) {
        const ringN = RING_NS[ri];
        const [rMult, tilt] = RING_CFG[ri];
        const ringR = baseR * rMult;
        const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
        for (let i = 0; i < ringN; i++, idx++) {
          const b  = idx * 12;
          const ao = (i / ringN) * Math.PI * 2;
          const rx = Math.cos(ao) * ringR;
          const ry = -Math.sin(ao) * ringR * sinT;
          const rz = Math.sin(ao) * ringR * cosT;
          buf[b]   = (Math.random() - .5) * W * .8;
          buf[b+1] = (Math.random() - .5) * H * .8;
          buf[b+2] = (Math.random() - .5) * 600;
          buf[b+3] = buf[b+4] = buf[b+5] = 0;
          buf[b+6] = rx; buf[b+7] = ry; buf[b+8] = rz;
          buf[b+9] = ao;
          buf[b+10] = 0.5 + Math.random() * 0.9;
          buf[b+11] = (ri * 2 + i) % COLORS.length;
          groupOf[idx] = ri + 1;
        }
      }

      // Atmosphere
      for (let i = 0; i < ATMOS_N; i++, idx++) {
        const b = idx * 12;
        const atmosR = baseR * (1.1 + Math.random() * 0.6);
        const [rx, ry, rz] = fibSphere(i, ATMOS_N, atmosR);
        buf[b]   = (Math.random() - .5) * W * .8;
        buf[b+1] = (Math.random() - .5) * H * .8;
        buf[b+2] = (Math.random() - .5) * 600;
        buf[b+3] = buf[b+4] = buf[b+5] = 0;
        buf[b+6] = rx; buf[b+7] = ry; buf[b+8] = rz;
        buf[b+9] = 0;
        buf[b+10] = 0.4 + Math.random() * 0.6;
        buf[b+11] = i % COLORS.length;
        groupOf[idx] = 5;
      }
    }

    // ── Perspective projection ────────────────────────────────
    // Returns [screenX_offset, screenY_offset, worldZ, perspectiveDepthMultiplier]
    let globeAngle = 0;
    function project(rx: number, ry: number, rz: number, scale: number): [number,number,number,number] {
      // Y-axis rotation (globe spin)
      const cosG = Math.cos(globeAngle), sinG = Math.sin(globeAngle);
      const x1 =  rx * cosG + rz * sinG;
      const y1 =  ry;
      const z1 = -rx * sinG + rz * cosG;
      // X-axis tilt (axial tilt like a planet)
      const y2 = y1 * cosTilt - z1 * sinTilt;
      const z2 = y1 * sinTilt + z1 * cosTilt;
      // Perspective divide — THIS creates the zoom/depth effect
      // Particles closer to camera appear larger; farther ones smaller
      const depth = FOCAL / (FOCAL + z2 * 0.6);
      return [x1 * scale * depth, y2 * scale * depth, z2, depth];
    }

    // ── Trail & burst state ───────────────────────────────────
    const trail: { x: number; y: number; age: number }[] = [];
    const TRAIL_LEN = 28;
    const bursts: Array<{
      particles: { x: number; y: number; vx: number; vy: number; r: number }[];
      age: number;
      life: number;
    }> = [];

    let breathT    = 0;
    let ringAngles = [0, 0, 0, 0];
    let state      = 0;
    let stateT     = 0;
    const STATE_DUR = [140, 100, 90]; // frames per state (fast cycling)
    const mouse = { x: W / 2, y: H / 2, active: false };

    // ── Main loop ─────────────────────────────────────────────
    let rafId = 0;
    let lastTime = 0;
    const FPS_CAP = 1000 / 50;

    function loop(ts: number) {
      rafId = requestAnimationFrame(loop);
      const dt = ts - lastTime;
      if (dt < FPS_CAP) return;
      lastTime = ts;

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;

      // Draw cursor trail
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].age++;
        const t = 1 - trail[i].age / TRAIL_LEN;
        if (t <= 0) { trail.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, t * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,201,122,${(t * 0.5).toFixed(2)})`;
        ctx.fill();
      }

      // Draw click bursts
      for (let b = bursts.length - 1; b >= 0; b--) {
        const burst = bursts[b];
        burst.age++;
        const t = 1 - burst.age / burst.life;
        if (t <= 0) { bursts.splice(b, 1); continue; }
        for (const p of burst.particles) {
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.92; p.vy *= 0.92;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.3, p.r * t), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,201,122,${(t * 0.8).toFixed(2)})`;
          ctx.fill();
        }
      }

      // Animate
      breathT += 0.014;
      const breathScale = 1.0 + Math.sin(breathT) * 0.08;
      globeAngle += 0.006; // spin speed
      for (let ri = 0; ri < 4; ri++) ringAngles[ri] += RING_CFG[ri][2];

      stateT++;
      if (stateT > STATE_DUR[state]) { stateT = 0; state = (state + 1) % 3; }
      const stateBlend = stateT / STATE_DUR[state];
      const ease = (t: number) => t < .5 ? 2*t*t : -1+(4-2*t)*t;

      // Update + draw each particle
      for (let idx = 0; idx < N; idx++) {
        const b = idx * 12;
        const g = groupOf[idx];
        let trx = buf[b+6], try_ = buf[b+7], trz = buf[b+8];

        // Compute target position based on group
        if (g >= 1 && g <= 4) {
          // Ring particle — orbit independently
          const ri = g - 1;
          const [rMult, tilt] = RING_CFG[ri];
          const ao = buf[b+9] + ringAngles[ri];
          let ringR = baseR * rMult;
          if (state === 1) ringR *= 1.0 + ease(stateBlend) * 0.5;
          else if (state === 2) ringR *= 1.5 - ease(stateBlend) * 0.5;
          const cosT = Math.cos(tilt), sinT2 = Math.sin(tilt);
          trx =  Math.cos(ao) * ringR;
          try_ = -Math.sin(ao) * ringR * sinT2;
          trz  =  Math.sin(ao) * ringR * cosT;
        } else if (g === 0) {
          // Sphere — contracts/expands with state
          const sf = state === 1 ? 1.0 - ease(stateBlend) * .5
                   : state === 2 ? 0.5 + ease(stateBlend) * .5
                   : 1.0;
          trx *= sf; try_ *= sf; trz *= sf;
        }

        // Spring toward target
        buf[b+3] += (trx  - buf[b+0]) * SPRING_K;
        buf[b+4] += (try_ - buf[b+1]) * SPRING_K;
        buf[b+5] += (trz  - buf[b+2]) * SPRING_K;

        // Mouse attraction — pull particles toward cursor
        if (mouse.active) {
          const [px, py] = project(buf[b], buf[b+1], buf[b+2], breathScale);
          const sx = cx + px, sy = cy + py;
          const mdx = mouse.x - sx, mdy = mouse.y - sy;
          const md2 = mdx*mdx + mdy*mdy;
          if (md2 < ATTRACT_R * ATTRACT_R && md2 > 4) {
            const md = Math.sqrt(md2);
            const f  = (ATTRACT_R - md) / ATTRACT_R * ATTRACT_F;
            buf[b+3] += (mdx / md) * f * 0.4;
            buf[b+4] += (mdy / md) * f * 0.4;
          }
        }

        // Friction + integrate
        buf[b+3] *= FRICTION; buf[b+4] *= FRICTION; buf[b+5] *= FRICTION;
        buf[b]   += buf[b+3]; buf[b+1] += buf[b+4]; buf[b+2] += buf[b+5];

        // Project to screen with perspective
        const [sx2d, sy2d, sz2d, depthMul] = project(buf[b], buf[b+1], buf[b+2], breathScale);
        const screenX = cx + sx2d;
        const screenY = cy + sy2d;

        // Depth-based alpha and size
        const depthRange = baseR * 3.5;
        const depthN = Math.max(0, Math.min(1, (sz2d + depthRange) / (depthRange * 2)));
        let sz = buf[b+10] * (0.4 + depthN * 1.1) * depthMul;
        if (g === 5) sz *= 0.6; // atmosphere is smaller
        const ai = Math.min(7, Math.floor(depthN * 7 + (g === 5 ? 0 : 1)));
        const ci = Math.floor(buf[b+11]) % COLORS.length;

        ctx.fillStyle = fillCache[ci][ai];
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(0.3, sz), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Click burst ───────────────────────────────────────────
    function triggerBurst(mx: number, my: number) {
      const particles = Array.from({ length: 60 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8;
        return { x: mx, y: my, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, r: 1 + Math.random()*2.5 };
      });
      bursts.push({ particles, age: 0, life: 55 });
    }

    // ── Event listeners ───────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > TRAIL_LEN) trail.shift();
    };
    const onMouseLeave = () => { mouse.active = false; };
    const onClick = (e: MouseEvent) => triggerBurst(e.clientX, e.clientY);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('click', onClick);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        cancelAnimationFrame(rafId);
        setSize();
        rafId = requestAnimationFrame(loop);
      }, 120);
    };
    window.addEventListener('resize', onResize);

    // ── Start ─────────────────────────────────────────────────
    setSize();
    initParticles();
    loop(0);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none', // remove this line if you want click events on canvas itself
      }}
      aria-hidden="true"
    />
  );
}

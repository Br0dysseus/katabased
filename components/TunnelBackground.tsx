'use client';

import { useEffect, useRef } from 'react';

// Module-level texture cache — computed once per session, reused on remount
const TW = 1024, TH = 1024;
let _texR: Uint8Array | null = null;
let _texG: Uint8Array | null = null;
let _texB: Uint8Array | null = null;

// Particle system — dust + copper flakes
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; opacity: number;
  life: number; maxLife: number;
  isCopper: boolean;  // copper flake vs dust mote
  angle: number;      // rotation for flake shape
  spin: number;       // angular velocity
}

export default function TunnelBackground({ dimOpacity = 0.72 }: { dimOpacity?: number }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Tunnel renderer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 2;
    const TW1 = TW - 1, TH1 = TH - 1;

    // Invalidate cache on palette change
    const CACHE_VERSION = 3; // back to original cool dark
    const cacheKey = `_tunnelCacheV${CACHE_VERSION}`;
    if (!(window as any)[cacheKey]) { _texR = null; _texG = null; _texB = null; (window as any)[cacheKey] = true; }

    const texR = _texR ?? new Uint8Array(TW * TH);
    const texG = _texG ?? new Uint8Array(TW * TH);
    const texB = _texB ?? new Uint8Array(TW * TH);
    const needsBuild = !_texR;

    function h(n: number) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
    function vnoise(x: number, y: number) {
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return h(ix + iy * 137) * (1 - ux) * (1 - uy) + h(ix + 1 + iy * 137) * ux * (1 - uy)
           + h(ix + (iy + 1) * 137) * (1 - ux) * uy + h(ix + 1 + (iy + 1) * 137) * ux * uy;
    }

    function ridged(x: number, y: number, oct: number) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) {
        const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
        v += Math.pow(n, 4) * a;
        a *= 0.5; f *= 2.07;
      }
      return v;
    }
    function fbm(x: number, y: number, oct: number) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f) * a; a *= 0.5; f *= 2.03; }
      return v;
    }

    // Rock texture — ridged multifractal with moisture streaks
    if (needsBuild) {
      for (let y = 0; y < TH; y++) {
        for (let x = 0; x < TW; x++) {
          const u = x / TW * 7.0;
          const v = y / TH * 7.0;

          const rock1 = ridged(u,               v,               7);
          const rock2 = ridged(u * 1.7 + 17,   v * 1.7 + 23,   6);
          const rock3 = ridged(u * 3.1 + 41,   v * 3.1 + 29,   5);
          const rock4 = ridged(u * 5.8 + 73,   v * 5.8 + 61,   4);
          const rock5 = ridged(u * 11.3 + 137, v * 11.3 + 97,  3);

          const facet1 = rock1 > 0.52 ? Math.pow((rock1 - 0.52) / 0.48, 0.45) : 0;
          const facet2 = rock2 > 0.58 ? Math.pow((rock2 - 0.58) / 0.42, 0.50) : 0;

          // Mineral veins — bright thin seams
          const mineralRaw = ridged(u * 8.2 + 83, v * 8.2 + 61, 3);
          const mineral = mineralRaw > 0.90 ? (mineralRaw - 0.90) * 10.0 : 0;

          // Crevice shadows
          const crevice = rock1 < 0.18 ? Math.pow(1 - rock1 / 0.18, 2.5) : 0;

          // Moisture streaks — vertical drip channels darker than surrounding rock
          const streakU = x / TW * 18.0;
          const streakV = y / TH * 3.0;
          const streakNoise = fbm(streakU + 7.3, streakV + 2.1, 3);
          const streak = streakNoise > 0.62 ? Math.pow((streakNoise - 0.62) / 0.38, 1.8) * 0.35 : 0;

          const raw = facet1 * 0.40 + facet2 * 0.20 + rock3 * 0.16 + rock4 * 0.10 + rock5 * 0.06 + mineral * 0.04;
          const lum = Math.min(1, Math.max(0, raw - crevice * 0.28 - streak * 0.22));

          // Original cool dark palette — deep stone with celadon mineral hint
          const warmth   = Math.max(0, lum - 0.65) * 0.45;
          const celadonV = mineral * 0.6;
          const r = Math.min(255, (lum * 128 + warmth * 35 + mineral * 45) | 0);
          const g = Math.min(255, (lum * 138 + warmth * 18 + mineral * 42 + celadonV * 20) | 0);
          const b = Math.min(255, (lum * 175 + mineral * 90 + celadonV * 35 + streak * 8) | 0);

          const i = y * TW + x;
          texR[i] = r; texG[i] = g; texB[i] = b;
        }
      }
      _texR = texR; _texG = texG; _texB = texB;
    }

    let angleLUT: Float32Array, distLUT: Float32Array, RW = 0, RH = 0;

    function buildLUT() {
      RW = Math.ceil(window.innerWidth / SCALE);
      RH = Math.ceil(window.innerHeight / SCALE);
      canvas!.width  = RW;
      canvas!.height = RH;
      const N = RW * RH;
      angleLUT = new Float32Array(N);
      distLUT  = new Float32Array(N);

      // Vanishing point slightly above center — more dramatic perspective
      const cx = RW * 0.502, cy = RH * 0.440;
      const TAU = Math.PI * 2;

      for (let py = 0; py < RH; py++) {
        for (let px = 0; px < RW; px++) {
          const dx = px - cx, dy = py - cy;
          const ang = Math.atan2(dy, dx);
          const rawDist = Math.sqrt(dx * dx + dy * dy);

          // More organic cave — heavier warping for stalactites
          const w = 1
            + 0.18 * Math.sin(ang * 1.7  + 0.31)   // primary cave shape
            + 0.12 * Math.sin(ang * 2.9  + 1.27)   // secondary lobes
            + 0.09 * Math.sin(ang * 4.3  + 2.14)   // stalactite bumps
            + 0.06 * Math.sin(ang * 6.7  + 0.88)
            + 0.04 * Math.sin(ang * 9.1  + 1.53)   // fine edge roughness
            + 0.025 * Math.sin(ang * 13.3 + 2.79)
            + 0.015 * Math.sin(ang * 19.7 + 0.44); // micro-roughness

          const i = py * RW + px;
          angleLUT[i] = ((ang / TAU) + 1) % 1;
          distLUT[i]  = rawDist / w;
        }
      }
    }

    function renderTunnel(scrollDepth: number, timeOffset: number, angularDrift: number) {
      const imgData = ctx!.createImageData(RW, RH);
      const d = imgData.data;
      const N = RW * RH;
      const refR = Math.min(RW, RH) * 0.46;
      const TAU = Math.PI * 2;

      const descentFraction = Math.pow(Math.min(scrollDepth * 0.4, 1), 0.6);

      // Three lights: main upper-left, secondary lower-right fill, deep celadon glow
      const mainLight  = 3.9;
      const fillLight  = mainLight + Math.PI;
      const deepLight  = 4.7; // celadon accent from depth

      for (let i = 0, p = 0; i < N; i++, p += 4) {
        const dist  = distLUT[i];
        const angle = angleLUT[i];

        const perspD = refR / (dist < 0.8 ? 0.8 : dist);
        const tv = ((perspD * 0.18 + scrollDepth + timeOffset) % 1 + 1) % 1;
        const tx = ((angle + angularDrift) * TW) & TW1;
        const ty = (tv * TH) & TH1;
        const ti = ty * TW + tx;

        const nd = dist / refR;

        // Three-light model for realistic cave illumination
        const mainFactor = 0.50 + 0.50 * Math.cos(angle * TAU - mainLight);
        const fillFactor = 0.88 + 0.12 * Math.cos(angle * TAU - fillLight);
        const deepFactor = 0.92 + 0.08 * Math.cos(angle * TAU - deepLight);
        const lightFactor = mainFactor * 0.72 + fillFactor * 0.18 + deepFactor * 0.10;

        // Sharper wall mask — tighter inner tunnel, harder edge
        const wallMask = nd < 0.02 ? 0
          : nd < 0.14 ? Math.pow((nd - 0.02) / 0.12, 0.38)
          : Math.pow(Math.max(0, 1 - (nd - 0.14) / 0.86), 1.8);

        // Atmospheric fog — deepens toward center (increases depth illusion)
        const fogDensity = Math.max(0, 1 - Math.pow(nd * 2.2, 1.6)) * 0.14;

        // Ambient occlusion — extra darkness in tight corners near center
        const ao = nd < 0.35 ? Math.pow(nd / 0.35, 0.7) : 1.0;

        const depthDim = 1.0 - descentFraction * 0.22;
        const brt = Math.min(1, wallMask * lightFactor * ao * depthDim * 1.25 + fogDensity * 0.3);

        // Original cool descent + celadon depth hint
        const coolShift   = descentFraction * 0.09;
        const celadonTint = fogDensity * 0.15;

        const r = Math.min(255, (texR[ti] * brt * (1 - coolShift * 0.6)) | 0);
        const g = Math.min(255, (texG[ti] * brt * (1 + celadonTint * 0.3)) | 0);
        const b = Math.min(255, (texB[ti] * brt + coolShift * 18 + celadonTint * 12) | 0);

        d[p] = r; d[p+1] = g; d[p+2] = b; d[p+3] = 255;
      }
      ctx!.putImageData(imgData, 0, 0);
    }

    let rafId: number;

    function frame(ts: number) {
      rafId = requestAnimationFrame(frame);
      if (document.hidden) return;
      const sy = window.scrollY;
      const scrollDepth = sy * 0.0005;
      const timeOffset  = ts * 0.000068; // slightly slower — more weight
      const angularDrift = 0.12 * Math.sin(ts * 0.000085) + 0.04;
      renderTunnel(scrollDepth, timeOffset, angularDrift);
    }

    buildLUT();
    rafId = requestAnimationFrame(frame);

    const onResize = () => { buildLUT(); };
    window.addEventListener('resize', onResize, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); };
  }, []);

  // ── Dust particle layer ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = dustCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;

    // Tunnel vanishing point
    const vpX = () => W * 0.502;
    const vpY = () => H * 0.440;

    const particles: Particle[] = [];
    const MAX_PARTICLES = 55;

    function spawnParticle(): Particle {
      const angle    = Math.random() * Math.PI * 2;
      const spawnR   = Math.random() * Math.min(W, H) * 0.08;
      const isCopper = Math.random() < 0.28; // ~28% copper flakes
      const speed    = isCopper
        ? 0.05 + Math.random() * 0.14   // flakes drift slower, float more
        : 0.08 + Math.random() * 0.22;
      const life = isCopper
        ? 260 + Math.random() * 380     // flakes linger longer
        : 180 + Math.random() * 280;
      return {
        x: vpX() + Math.cos(angle) * spawnR,
        y: vpY() + Math.sin(angle) * spawnR,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (isCopper ? 0.02 : 0.04),
        size: isCopper
          ? 0.8 + Math.random() * 1.8   // flakes slightly larger
          : 0.4 + Math.random() * 1.1,
        opacity: 0,
        life: 0,
        maxLife: life,
        isCopper,
        angle: Math.random() * Math.PI * 2,
        spin:  (Math.random() - 0.5) * 0.04,
      };
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = spawnParticle();
      p.life = Math.random() * p.maxLife; // stagger initial positions
      particles.push(p);
    }

    let rafId: number;

    function frame() {
      rafId = requestAnimationFrame(frame);
      ctx!.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Accelerate as particles move away from center (perspective pull)
        const dx = p.x - vpX(), dy = p.y - vpY();
        const distFromVP = Math.sqrt(dx * dx + dy * dy);
        const accel = 1 + distFromVP / (Math.min(W, H) * 0.6);
        p.vx *= accel > 1.002 ? Math.min(1.008, accel * 0.998) : 1.0;
        p.vy *= accel > 1.002 ? Math.min(1.008, accel * 0.998) : 1.0;

        // Fade in, hold, fade out
        const t = p.life / p.maxLife;
        const fadeIn  = Math.min(1, t * 6);
        const fadeOut = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
        p.opacity = fadeIn * fadeOut * 0.35;

        if (p.life >= p.maxLife || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
          particles[i] = spawnParticle();
          continue;
        }

        p.angle += p.spin;

        if (p.isCopper) {
          // Copper flake — spinning diamond with warm glow
          const s = p.size;
          ctx!.save();
          ctx!.translate(p.x, p.y);
          ctx!.rotate(p.angle);
          // Outer glow
          ctx!.beginPath();
          ctx!.arc(0, 0, s * 2.2, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(200,96,42,${p.opacity * 0.18})`;
          ctx!.fill();
          // Diamond shape
          ctx!.beginPath();
          ctx!.moveTo(0, -s * 1.4);
          ctx!.lineTo(s * 0.85, 0);
          ctx!.lineTo(0, s * 1.4);
          ctx!.lineTo(-s * 0.85, 0);
          ctx!.closePath();
          ctx!.fillStyle = `rgba(220,110,48,${p.opacity * 1.2})`;
          ctx!.fill();
          // Bright highlight facet
          ctx!.beginPath();
          ctx!.moveTo(0, -s * 1.4);
          ctx!.lineTo(s * 0.85, 0);
          ctx!.lineTo(0, -s * 0.1);
          ctx!.closePath();
          ctx!.fillStyle = `rgba(255,180,100,${p.opacity * 0.65})`;
          ctx!.fill();
          ctx!.restore();
        } else {
          // Dust mote — warm ash colour
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(210,185,155,${p.opacity * 0.85})`;
          ctx!.fill();
        }
      }
    }

    rafId = requestAnimationFrame(frame);

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); };
  }, []);

  const grainSeed = Math.floor(Math.random() * 1000);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {/* Rock texture tunnel */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto' }} />
      {/* Dust particles */}
      <canvas ref={dustCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* Film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.032, mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='5' stitchTiles='stitch' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      {/* Primary dim overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,5,12,${dimOpacity})` }} />
      {/* Celadon depth glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 22% 28% at 50% 44%, rgba(0,229,160,0.055) 0%, transparent 70%)' }} />
      {/* Aegean ambient */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 44% at 51% 47%, rgba(77,166,232,0.06) 0%, transparent 65%)' }} />
      {/* Copper ember hint — subtle, doesn't overpower */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 18% 22% at 50% 44%, rgba(200,96,42,0.04) 0%, transparent 70%)' }} />
      {/* Rim vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 88% 80% at 50% 53%, transparent 25%, rgba(4,5,12,0.88) 100%)' }} />
      {/* Text legibility zone */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 36% at 50% 45%, rgba(4,5,12,0.78) 0%, rgba(4,5,12,0.38) 55%, transparent 100%)' }} />
      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16vh', background: 'linear-gradient(180deg,rgba(4,5,12,0.72) 0%,transparent 100%)' }} />
      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '20vh', background: 'linear-gradient(0deg,rgba(4,5,12,0.60) 0%,transparent 100%)' }} />
    </div>
  );
}

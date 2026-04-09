'use client';

import { useEffect, useRef } from 'react';

export default function TunnelBackground({ dimOpacity = 0.72 }: { dimOpacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 2;
    const TW = 1024, TH = 1024;
    const TW1 = TW - 1, TH1 = TH - 1;

    const texR = new Uint8Array(TW * TH);
    const texG = new Uint8Array(TW * TH);
    const texB = new Uint8Array(TW * TH);

    function h(n: number) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
    function vnoise(x: number, y: number) {
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return h(ix + iy * 137) * (1 - ux) * (1 - uy) + h(ix + 1 + iy * 137) * ux * (1 - uy)
           + h(ix + (iy + 1) * 137) * (1 - ux) * uy + h(ix + 1 + (iy + 1) * 137) * ux * uy;
    }

    // Ridged multifractal — pow(4) for ultra-sharp rock faces
    function ridged(x: number, y: number, oct: number) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) {
        const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
        v += Math.pow(n, 4) * a; // pow4 = knife-edge ridges, deep dark crevices
        a *= 0.5; f *= 2.07;
      }
      return v;
    }
    function fbm(x: number, y: number, oct: number) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f) * a; a *= 0.5; f *= 2.03; }
      return v;
    }

    // Hard rock face texture
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const u = x / TW * 7.0;
        const v = y / TH * 7.0;

        // 5 scales of ridged multifractal — each adds a different size of rock face
        const rock1 = ridged(u,              v,              7); // large primary faces
        const rock2 = ridged(u * 1.7 + 17,  v * 1.7 + 23,  6); // medium faces
        const rock3 = ridged(u * 3.1 + 41,  v * 3.1 + 29,  5); // small faces
        const rock4 = ridged(u * 5.8 + 73,  v * 5.8 + 61,  4); // fine surface detail
        const rock5 = ridged(u * 11.3 + 137, v * 11.3 + 97, 3); // micro texture

        // Angular facets from primary faces — step threshold for hard edges
        const facet1 = rock1 > 0.52 ? Math.pow((rock1 - 0.52) / 0.48, 0.45) : 0;
        const facet2 = rock2 > 0.58 ? Math.pow((rock2 - 0.58) / 0.42, 0.50) : 0;

        // Mineral seams — bright sharp lines
        const mineralRaw = ridged(u * 8.2 + 83, v * 8.2 + 61, 3);
        const mineral = mineralRaw > 0.90 ? (mineralRaw - 0.90) * 10.0 : 0;

        // Deep crevice shadows — rock1 low values = dark gaps
        const crevice = rock1 < 0.18 ? Math.pow(1 - rock1 / 0.18, 2.5) : 0;

        // Composite — primary faces dominant, each smaller scale adds detail
        const raw = facet1 * 0.42 + facet2 * 0.22 + rock3 * 0.16 + rock4 * 0.10 + rock5 * 0.06 + mineral * 0.04;
        const lum = Math.min(1, Math.max(0, raw - crevice * 0.25));

        // Charcoal-slate: very dark base, Aegean tint in mids, warm only on bright ridges
        const warmth = Math.max(0, lum - 0.6) * 0.55;
        const r = Math.min(255, (lum * 148 + warmth * 45 + mineral * 60) | 0);
        const g = Math.min(255, (lum * 155 + warmth * 25 + mineral * 52) | 0);
        const b = Math.min(255, (lum * 192 + mineral * 110) | 0);

        const i = y * TW + x;
        texR[i] = r; texG[i] = g; texB[i] = b;
      }
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

      const cx = RW * 0.505, cy = RH * 0.452;
      const TAU = Math.PI * 2;

      for (let py = 0; py < RH; py++) {
        for (let px = 0; px < RW; px++) {
          const dx = px - cx, dy = py - cy;
          const ang = Math.atan2(dy, dx);
          const rawDist = Math.sqrt(dx * dx + dy * dy);

          // Organic cave shape — more warp on vertical axis for stalactite feel
          const w = 1
            + 0.14 * Math.sin(ang * 1.7  + 0.31)
            + 0.10 * Math.sin(ang * 2.9  + 1.27)
            + 0.08 * Math.sin(ang * 4.3  + 2.14)
            + 0.05 * Math.sin(ang * 6.7  + 0.88)
            + 0.03 * Math.sin(ang * 9.1  + 1.53)
            + 0.02 * Math.sin(ang * 13.3 + 2.79);

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

      // Two light sources: main from upper-left, faint fill from center depth
      const mainLight = 3.9;
      const fillLight = mainLight + Math.PI;

      for (let i = 0, p = 0; i < N; i++, p += 4) {
        const dist  = distLUT[i];
        const angle = angleLUT[i];

        const perspD = refR / (dist < 0.8 ? 0.8 : dist);
        const tv = ((perspD * 0.18 + scrollDepth + timeOffset) % 1 + 1) % 1;
        const tx = ((angle + angularDrift) * TW) & TW1;
        const ty = (tv * TH) & TH1;
        const ti = ty * TW + tx;

        const nd = dist / refR;

        // Hard directional light — strong main, weak fill
        // 50/50 split creates deep shadows on opposing side
        const mainFactor  = 0.50 + 0.50 * Math.cos(angle * TAU - mainLight);
        const fillFactor  = 0.88 + 0.12 * Math.cos(angle * TAU - fillLight);
        const lightFactor = mainFactor * 0.80 + fillFactor * 0.20;

        // Wall mask — sharp inner edge, gradual outer fade
        const wallMask = nd < 0.03 ? 0
          : nd < 0.18 ? Math.pow((nd - 0.03) / 0.15, 0.45)
          : Math.pow(Math.max(0, 1 - (nd - 0.18) / 0.82), 1.6);

        // Very faint depth glow — just hints at depth, not smoky
        const depthGlow = Math.max(0, 1 - Math.pow(nd * 2.4, 2)) * 0.10;

        const depthDim = 1.0 - descentFraction * 0.18;
        const brt = Math.min(1, wallMask * lightFactor * depthDim * 1.20 + depthGlow);

        // Slight blue deepening as you descend
        const coolShift = descentFraction * 0.07;
        const r = Math.min(255, (texR[ti] * brt * (1 - coolShift * 0.5)) | 0);
        const g = Math.min(255, (texG[ti] * brt) | 0);
        const b = Math.min(255, (texB[ti] * brt + coolShift * 15) | 0);

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
      // Faster base speed — churning descent
      const timeOffset = ts * 0.000075;
      const angularDrift = 0.10 * Math.sin(ts * 0.000095) + 0.04;
      renderTunnel(scrollDepth, timeOffset, angularDrift);
    }

    buildLUT();
    rafId = requestAnimationFrame(frame);

    const onResize = () => { buildLUT(); };
    window.addEventListener('resize', onResize, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); };
  }, []);

  const grainSeed = Math.floor(Math.random() * 1000);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto' }} />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.028,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.80' numOctaves='5' stitchTiles='stitch' seed='${grainSeed}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        mixBlendMode: 'overlay',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,5,12,${dimOpacity})` }} />
      {/* Faint Aegean depth glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 30% 36% at 51% 47%, rgba(107,159,212,0.10) 0%, transparent 60%)' }} />
      {/* Vignette — rim darkness */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 82% at 50% 53%, transparent 30%, rgba(4,5,12,0.82) 100%)' }} />
      {/* Center dark — text legibility zone */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 42% 38% at 51% 46%, rgba(4,5,12,0.82) 0%, rgba(4,5,12,0.45) 50%, transparent 100%)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '14vh', background: 'linear-gradient(180deg,rgba(4,5,12,0.65) 0%,transparent 100%)' }} />
    </div>
  );
}

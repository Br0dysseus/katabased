'use client';

import { useEffect, useRef } from 'react';

export default function TunnelBackground({ dimOpacity = 0.72 }: { dimOpacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 4;
    const TW = 512, TH = 512;
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
    function fbm(x: number, y: number, oct: number) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f) * a; a *= 0.5; f *= 2.03; }
      return v;
    }

    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const u = x / TW * 5, v = y / TH * 8;
        const base = fbm(u, v, 6);
        const strata = Math.sin(v * Math.PI * 10 + fbm(u * 1.5, v * 0.5, 3) * 3.5) * 0.5 + 0.5;
        const fineStrata = Math.sin(v * Math.PI * 30 + fbm(u * 3, v, 2) * 2) * 0.5 + 0.5;
        const rough = vnoise(u * 14, v * 14) * 0.5 + vnoise(u * 28, v * 28) * 0.25;
        const vein = Math.max(0, fbm(u * 4 + 87, v * 3 + 53, 5) - 0.62) * 2.8;
        const quartz = Math.max(0, fbm(u * 6 + 200, v * 5 + 180, 4) - 0.68) * 3.5;
        const lum = 0.08 + base * 0.38 + strata * 0.14 + fineStrata * 0.04 + rough * 0.06;
        const r = Math.min(255, (lum * 195 + vein * 100 + quartz * 120) | 0);
        const g = Math.min(255, (lum * 175 + vein * 35  + quartz * 130) | 0);
        const b = Math.min(255, (lum * 230              + quartz * 180) | 0);
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
      const cx = RW * 0.5, cy = RH * 0.46;
      const TAU = Math.PI * 2;
      for (let py = 0; py < RH; py++) {
        for (let px = 0; px < RW; px++) {
          const dx = px - cx, dy = py - cy;
          const ang = Math.atan2(dy, dx);
          const w = 1
            + 0.22 * Math.sin(ang * 2.1 + 0.6)
            + 0.10 * Math.sin(ang * 4.7 + 1.8)
            + 0.05 * Math.sin(ang * 9.3 + 0.3);
          const i = py * RW + px;
          angleLUT[i] = ((ang / TAU) + 1) % 1;
          distLUT[i]  = Math.sqrt(dx * dx + dy * dy) / w;
        }
      }
    }

    function renderTunnel(scrollDepth: number, drift: number) {
      const imgData = ctx!.createImageData(RW, RH);
      const d = imgData.data;
      const N = RW * RH;
      const refR = Math.min(RW, RH) * 0.46;
      for (let i = 0, p = 0; i < N; i++, p += 4) {
        const dist  = distLUT[i];
        const angle = angleLUT[i];
        const perspD = refR / (dist < 0.8 ? 0.8 : dist);
        const tv = ((perspD * 0.13 + scrollDepth + drift) % 1 + 1) % 1;
        const tx = (angle * TW) & TW1;
        const ty = (tv    * TH) & TH1;
        const ti = ty * TW + tx;
        const nd  = dist / refR;
        const brt = nd < 0.015 ? 0 : Math.min(1, Math.pow(nd, 0.55)) * 0.92;
        d[p]   = (texR[ti] * brt) | 0;
        d[p+1] = (texG[ti] * brt) | 0;
        d[p+2] = (texB[ti] * brt) | 0;
        d[p+3] = 255;
      }
      ctx!.putImageData(imgData, 0, 0);
    }

    let lastScrollY = -1, lastTs = 0, rafId: number;

    function frame(ts: number) {
      rafId = requestAnimationFrame(frame);
      if (document.hidden) return;
      const sy = window.scrollY;
      if (sy !== lastScrollY || ts - lastTs > 140) {
        renderTunnel(sy * 0.00030, ts * 0.000028);
        lastScrollY = sy;
        lastTs = ts;
      }
    }

    buildLUT();
    rafId = requestAnimationFrame(frame);

    const onResize = () => { buildLUT(); lastTs = 0; };
    window.addEventListener('resize', onResize, { passive: true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto' }} />
      {/* film grain */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.028, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      {/* global dim */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,5,12,${dimOpacity})` }} />
      {/* center dark */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 58% at 50% 48%,rgba(4,5,12,0.88) 0%,rgba(4,5,12,0.55) 60%,transparent 100%)' }} />
      {/* vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 90% at 50% 48%,transparent 50%,rgba(4,5,12,0.8) 100%)' }} />
      {/* top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '14vh', background: 'linear-gradient(180deg,rgba(4,5,12,0.6) 0%,transparent 100%)' }} />
    </div>
  );
}

'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
const S = 0.0085, OX = -190, OY = -300;
const vp = (x: number, y: number, z = 0) =>
  new THREE.Vector3((x + OX) * S, -(y + OY) * S, z);
const R = (sw: number) => sw * S / 2;

// ── Doric fluting ─────────────────────────────────────────────────────────────
function flute(geom: THREE.TubeGeometry, numFlutes: number, depthFrac: number) {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const nrm = geom.attributes.normal   as THREE.BufferAttribute;
  const uv  = geom.attributes.uv       as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = uv.getY(i) * Math.PI * 2 * numFlutes;
    const t = (1 - Math.cos(a)) / 2;
    const d = depthFrac * t;
    pos.setXYZ(i, pos.getX(i) - nrm.getX(i) * d,
                  pos.getY(i) - nrm.getY(i) * d,
                  pos.getZ(i) - nrm.getZ(i) * d);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

// ── Vertex degradation ────────────────────────────────────────────────────────
function degrade(geom: THREE.TubeGeometry, intensity: number, rng: () => number) {
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const nrm = geom.attributes.normal   as THREE.BufferAttribute;
  const uv  = geom.attributes.uv       as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const edgeFactor = Math.pow(Math.max(0, 1 - Math.min(u, 1 - u) * 5), 2.2);
    const d = (rng() - 0.5) * 0.007 * intensity
            + (rng() > 0.38 ? -1 : 1) * rng() * 0.032 * intensity * edgeFactor;
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * d,
                  pos.getY(i) + nrm.getY(i) * d,
                  pos.getZ(i) + nrm.getZ(i) * d);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

// ── Palette (linear space) ────────────────────────────────────────────────────
const PAL = {
  cream:     [0.80,  0.760, 0.680],
  verdigris: [0.040, 0.420, 0.280],
  ochre:     [0.680, 0.320, 0.050],
  grime:     [0.035, 0.025, 0.015],
} as const;

// Per-vertex pre-computed patina data (positions + noise values baked at build)
interface VertexPatinaData {
  nx: number;        // normalised x in letterform bounds
  ny: number;        // normalised y
  n1: number;        // noise random 1
  n2: number;        // noise random 2
  n3: number;        // noise random 3 (ochre variation)
  n4: number;        // noise random 4 (grime)
}

interface StrokePatinaInfo {
  colorAttr:  THREE.BufferAttribute;
  strokeDeg:  number;
  vdata:      VertexPatinaData[];
}

// Per-vertex crumble animation data — baked once, animated every frame
interface StrokeCrumbleInfo {
  posAttr:    THREE.BufferAttribute;
  nrmAttr:    THREE.BufferAttribute;
  origPos:    Float32Array;
  noiseFreq:  Float32Array;
  noisePhase: Float32Array;
  deg:        number;
  radius:     number;          // tube radius (for chunk collapse amplitude)
  radSeg:     number;          // radial segments (ring stride)
  chunkRings: number;          // rings per chunk
  chunkCount: number;
  chunkPhase: Float32Array;
  chunkSpeed: Float32Array;
}

// ── Patina computation ────────────────────────────────────────────────────────
// scrollLift: 0 = bottom patina only, 1 = floods entire logo
// shiftX: 0 = patina concentrated on k (left), 1 = concentrated on B (right), 0.5 = balanced
function computePatina(info: StrokePatinaInfo[], scrollLift: number, shiftX = 0.5) {
  for (const { colorAttr, strokeDeg, vdata } of info) {
    const cols = colorAttr.array as Float32Array;
    const [bR, bG, bB] = PAL.cream;
    const [vR, vG, vB] = PAL.verdigris;
    const [oR, oG, oB] = PAL.ochre;
    const [gR, gG, gB] = PAL.grime;

    for (let i = 0; i < vdata.length; i++) {
      const { nx, ny, n1, n2, n3, n4 } = vdata[i];
      // Narrow traveling band → reads as color sweep, not all-over tint
      const bandDist = Math.abs(nx - shiftX);
      const sweep    = Math.max(0, 1.0 - bandDist * 1.3);
      const leftness = 0.55 + sweep * 0.75;
      const effectiveLowness = Math.max(0, (1 - ny) - scrollLift * 1.0 + leftness * 0.3 * scrollLift);
      const pBase = leftness * 0.62 + effectiveLowness * 0.52 + n1 * strokeDeg + 0.15;
      const pStr  = Math.max(0, Math.min(1, pBase * (0.75 + strokeDeg * 0.5) * (1 + scrollLift * 1.8) + n2 * strokeDeg * 0.5));

      const vFrac = pStr * (0.55 + n3 * 0.16);
      const oFrac = Math.max(0, pStr * (0.23 + n3 * 0.15) - n4 * 0.08);
      const gFrac = effectiveLowness * strokeDeg * (0.10 + n4 * 0.15);
      const bFrac = Math.max(0, 1 - vFrac - oFrac - gFrac);

      cols[i * 3 + 0] = Math.min(1, bR * bFrac + vR * vFrac + oR * oFrac + gR * gFrac);
      cols[i * 3 + 1] = Math.min(1, bG * bFrac + vG * vFrac + oG * oFrac + gG * gFrac);
      cols[i * 3 + 2] = Math.min(1, bB * bFrac + vB * vFrac + oB * oFrac + gB * gFrac);
    }
    colorAttr.needsUpdate = true;
  }
}

// ── Marble map (veins + scratches) ────────────────────────────────────────────
function makeMarbleMap(size = 1024) {
  const rng = mkRng(77);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#C8C2B8'; ctx.fillRect(0, 0, size, size);
  for (let vn = 0; vn < 14; vn++) {
    const x0 = rng() * size * 1.4 - size * 0.2, y0 = rng() * size * 1.4 - size * 0.2;
    const ang = rng() * Math.PI + 0.1, w = 0.2 + rng() * 1.8, op = 0.04 + rng() * 0.10, wav = 0.10 + rng() * 0.9;
    ctx.save(); ctx.strokeStyle = `rgba(50,42,32,${op})`; ctx.lineWidth = w;
    ctx.beginPath(); let cx = x0, cy = y0; ctx.moveTo(cx, cy);
    for (let i = 0; i < 38; i++) {
      const a2 = ang + Math.sin(i * 0.38) * wav;
      cx += Math.cos(a2) * size * 0.058 + (rng() - 0.5) * 4;
      cy += Math.sin(a2) * size * 0.058 + (rng() - 0.5) * 4;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke(); ctx.restore();
  }
  for (let i = 0; i < 50; i++) {
    const x0 = rng() * size, y0 = rng() * size, len = size * (0.008 + rng() * 0.05);
    const ang = rng() * Math.PI * 2;
    ctx.save();
    ctx.strokeStyle = rng() > 0.45 ? `rgba(185,180,170,${0.3 + rng() * 0.4})` : `rgba(42,35,24,${0.12 + rng() * 0.22})`;
    ctx.lineWidth = 0.3 + rng() * 1.0;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
    ctx.stroke(); ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1);
  return tex;
}

// ── Roughness map ─────────────────────────────────────────────────────────────
function makeRoughMap(size = 512) {
  const rng = mkRng(133);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3A3A3A'; ctx.fillRect(0, 0, size, size);
  for (let p = 0; p < 22; p++) {
    const px = rng() * size * 0.8, py = size * 0.15 + rng() * size * 0.85;
    const rad = size * (0.04 + rng() * 0.12), v2 = Math.floor(110 + rng() * 120), op = 0.45 + rng() * 0.5;
    const grd = ctx.createRadialGradient(px, py, 0, px, py, rad);
    grd.addColorStop(0, `rgba(${v2},${v2},${v2},${op})`);
    grd.addColorStop(1, `rgba(${v2},${v2},${v2},0)`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1);
  return tex;
}

// ── Stroke definitions ────────────────────────────────────────────────────────
// Classical Greek β + k with Ionic capital & base: single-vertex kiss, no waist loop,
// leaning spine-top fuses with upper bowl into continuous column.
const STROKE_DEFS = [
  // β — vertical spine (x=173)
  { curve: () => new THREE.LineCurve3(vp(173,180), vp(173,461)),                                           sw:16, tSeg:2,  fl:16, deg:0.42 },
  // β — Ionic base (apophyge, scotia, plinth)
  { curve: () => new THREE.LineCurve3(vp(161,461), vp(185,461)),                                           sw:5,  tSeg:2,  fl:12, deg:0.62 },
  { curve: () => new THREE.LineCurve3(vp(155,466), vp(191,466)),                                           sw:6,  tSeg:2,  fl:14, deg:0.72 },
  { curve: () => new THREE.LineCurve3(vp(149,472), vp(197,472)),                                           sw:6,  tSeg:2,  fl:14, deg:0.82 },
  // β — upper bowl: leaning spine-top continuing into dome
  { curve: () => new THREE.CubicBezierCurve3(vp(173,180),vp(173,100),vp(277,157),vp(276,197)),             sw:16, tSeg:28, fl:16, deg:0.42 },
  { curve: () => new THREE.CubicBezierCurve3(vp(276,197),vp(275,236),vp(220,260),vp(173,256)),             sw:16, tSeg:28, fl:16, deg:0.46 },
  // β — lower lobe (no inner waist loop)
  { curve: () => new THREE.CubicBezierCurve3(vp(173,264),vp(220,260),vp(275,284),vp(276,323)),             sw:16, tSeg:28, fl:16, deg:0.56 },
  { curve: () => new THREE.CubicBezierCurve3(vp(276,323),vp(277,363),vp(237,390),vp(173,396)),             sw:16, tSeg:28, fl:16, deg:0.72 },
  // k — Ionic capital (necking, echinus, abacus)
  { curve: () => new THREE.LineCurve3(vp(68,248), vp(92,248)),                                             sw:5,  tSeg:2,  fl:12, deg:0.32 },
  { curve: () => new THREE.LineCurve3(vp(62,243), vp(98,243)),                                             sw:6,  tSeg:2,  fl:14, deg:0.28 },
  { curve: () => new THREE.LineCurve3(vp(58,238), vp(102,238)),                                            sw:4,  tSeg:2,  fl:12, deg:0.22 },
  // k — stem matched to β weight
  { curve: () => new THREE.LineCurve3(vp(80,252), vp(80,408)),                                             sw:16, tSeg:4,  fl:16, deg:0.52 },
  // k — Ionic base
  { curve: () => new THREE.LineCurve3(vp(68,413), vp(92,413)),                                             sw:5,  tSeg:2,  fl:12, deg:0.52 },
  { curve: () => new THREE.LineCurve3(vp(62,418), vp(98,418)),                                             sw:6,  tSeg:2,  fl:14, deg:0.66 },
  { curve: () => new THREE.LineCurve3(vp(56,424), vp(104,424)),                                            sw:6,  tSeg:2,  fl:14, deg:0.76 },
  // k — bow upper/lower: asymmetric bulge toward β, single-vertex kiss at (80,330)
  { curve: () => new THREE.CubicBezierCurve3(vp(173,264),vp(117,264),vp(80,314),vp(80,330)),               sw:16, tSeg:28, fl:16, deg:0.46 },
  { curve: () => new THREE.CubicBezierCurve3(vp(80,330),vp(80,346),vp(117,396),vp(173,396)),               sw:16, tSeg:28, fl:16, deg:0.60 },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  size?:    'nav' | 'large';
  scrollY?: number;
}

export default function KataLogoMarble({ size = 'large', scrollY = 0 }: Props) {
  const isNav     = size === 'nav';
  const w         = isNav ? 92  : 600;
  const h         = isNav ? 54  : 380;

  const mountRef       = useRef<HTMLDivElement>(null);
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const patinaInfoRef  = useRef<StrokePatinaInfo[]>([]);
  const crumbleInfoRef = useRef<StrokeCrumbleInfo[]>([]);
  const rafRef         = useRef<number>(0);

  // ── Build Three.js scene once on mount ──────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Renderer — full DPR (no cap) so it stays sharp at any browser zoom level
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace    = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Update DPR on window resize (catches browser zoom on most platforms)
    const onResize = () => renderer.setPixelRatio(window.devicePixelRatio);

    window.addEventListener('resize', onResize, { passive: true });

    // Scene — face-on camera, centered on letterform bounds
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 200);
    // Letterform x-center ≈ -0.034; y-center = 0. Camera dead-on, no tilt.
    camera.position.set(0, 0, isNav ? 4.2 : 7.8);
    // Design x-bounds: -0.825 (k stem) to 0.731 (B lobe peak) → center ≈ -0.047
    camera.lookAt(-0.047, 0, 0);

    // Clock for smooth manual rotation (replaces OrbitControls — no damping glitch)
    const clock = new THREE.Clock();

    // Lights — no shadow casting. Nav gets brighter envelope so it reads solid at small size.
    scene.add(new THREE.AmbientLight(0x2A2418, isNav ? 3.4 : 1.4));
    const key = new THREE.DirectionalLight(0xFFF2E0, isNav ? 7.2 : 4.5);
    key.position.set(-5, 6, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xC8DCFF, isNav ? 2.4 : 1.2);
    fill.position.set(6, -2, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xA0C0E8, isNav ? 3.2 : 2.4);
    rim.position.set(2, 5, -8); scene.add(rim);
    const rake = new THREE.DirectionalLight(0xB8904A, isNav ? 2.4 : 1.6);
    rake.position.set(-5, -4, 2); scene.add(rake);

    // Textures
    const marbleMap = makeMarbleMap(isNav ? 512 : 1024);
    const roughMap  = makeRoughMap(isNav ? 256 : 512);
    const matRng    = mkRng(42);

    function mkMat(deg: number) {
      const ww = 0.97 + matRng() * 0.06;
      return new THREE.MeshPhysicalMaterial({
        color:               new THREE.Color(ww, ww, ww),
        vertexColors:        true,
        map:                 marbleMap,
        roughnessMap:        roughMap,
        roughness:           0.18 + deg * 0.32,   // cleaner base
        metalness:           0.0,
        clearcoat:           0.98 - deg * 0.55,   // near-perfect polish on fresh stone
        clearcoatRoughness:  0.04 + deg * 0.44,
        ior:                 1.56,                 // denser marble refraction
        reflectivity:        0.62,
      });
    }

    // Build geometry + bake patina + crumble data
    const group = new THREE.Group();
    const patinaInfo:  StrokePatinaInfo[]  = [];
    const crumbleInfo: StrokeCrumbleInfo[] = [];
    // k bow peak x=56 → world x≈-1.139; B lobe peak x=276 → world x≈0.731
    const xMin = -1.25, xMax = 0.80, yMin = -1.45, yMax = 1.45;

    STROKE_DEFS.forEach((def, idx) => {
      const r  = R(def.sw);
      const rs = Math.max(40, def.fl * 4);
      let g    = new THREE.TubeGeometry(def.curve(), def.tSeg, r, rs, false);
      if (!isNav) {
        g = flute(g, def.fl, r * 0.20);           // shallower flutes → crisper column edges
        g = degrade(g, def.deg * 0.55, mkRng(idx * 1337 + 99));  // less roughness → cleaner stone
      }

      const pos = g.attributes.position as THREE.BufferAttribute;
      const nrm = g.attributes.normal   as THREE.BufferAttribute;
      const cnt = pos.count;

      // Patina noise values
      const rng2 = mkRng(idx * 2718 + 55);
      const vdata: VertexPatinaData[] = [];
      for (let i = 0; i < cnt; i++) {
        vdata.push({
          nx: Math.max(0, Math.min(1, (pos.getX(i) - xMin) / (xMax - xMin))),
          ny: Math.max(0, Math.min(1, (pos.getY(i) - yMin) / (yMax - yMin))),
          n1: (rng2() - 0.5) * 0.7,
          n2: (rng2() - 0.5) * 0.5,
          n3: rng2(),
          n4: rng2(),
        });
      }

      // Initial vertex colors
      const cols = new Float32Array(cnt * 3);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const colorAttr = g.attributes.color as THREE.BufferAttribute;
      patinaInfo.push({ colorAttr, strokeDeg: def.deg, vdata });

      // Crumble data — skip for nav (static read); big logo only.
      if (def.deg > 0.35 && !isNav) {
        const origPos    = new Float32Array(pos.array);
        const noiseFreq  = new Float32Array(cnt);
        const noisePhase = new Float32Array(cnt);
        const rng3 = mkRng(idx * 9973 + 17);
        for (let i = 0; i < cnt; i++) {
          noiseFreq[i]  = 0.4 + rng3() * 1.2;
          noisePhase[i] = rng3() * Math.PI * 2;
        }
        const ringCount  = def.tSeg + 1;
        const CHUNK_RINGS = 10;
        const chunkCount = Math.max(1, Math.ceil(ringCount / CHUNK_RINGS));
        const chunkPhase = new Float32Array(chunkCount);
        const chunkSpeed = new Float32Array(chunkCount);
        for (let c = 0; c < chunkCount; c++) {
          chunkPhase[c] = rng3() * Math.PI * 2;
          chunkSpeed[c] = 0.0055 + rng3() * 0.0085;  // 1 chunk missing ~every 20–30s
        }
        crumbleInfo.push({
          posAttr: pos, nrmAttr: nrm, origPos, noiseFreq, noisePhase, deg: def.deg,
          radius: r, radSeg: rs, chunkRings: CHUNK_RINGS, chunkCount, chunkPhase, chunkSpeed,
        });
      }

      const mesh = new THREE.Mesh(g, mkMat(def.deg));
      group.add(mesh);
    });

    patinaInfoRef.current  = patinaInfo;
    crumbleInfoRef.current = crumbleInfo;
    computePatina(patinaInfo, 0.20, 0.0);

    scene.add(group);

    // ── Debris (falling stone chunks) — skip on tiny nav logo ──────────
    const debris: Array<THREE.Mesh & { userData: { vx: number; vy: number; vz: number; rotVx: number; rotVy: number; spawn: number; r0: number; g0: number; b0: number } }> = [];
    const DEBRIS_MAX     = isNav ? 0 : 9;    // was 28 — sparse, cinematic
    const DEBRIS_LIFE    = 11;               // they dissolve before hitting floor
    const SPAWN_INTERVAL = 3.2;              // was 1.6 — very rare spawn
    const GRAVITY        = 0.12;             // very gentle — suspended feel
    // Tunnel absorb target — background navy (matches rgba(4,5,12))
    const TUNNEL_R = 0.016, TUNNEL_G = 0.020, TUNNEL_B = 0.047;
    let lastSpawn = 0;
    function spawnDebris(ts: number) {
      if (debris.length >= DEBRIS_MAX || group.children.length === 0) return;
      const mesh = group.children[Math.floor(Math.random() * group.children.length)] as THREE.Mesh;
      const mp = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const idx = Math.floor(Math.random() * mp.count);
      const size = 0.010 + Math.random() * 0.020;
      const geo = new THREE.BoxGeometry(size, size, size);
      const shade = 0.40 + Math.random() * 0.30;
      const r0 = shade, g0 = shade * 0.88, b0 = shade * 0.75;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(r0, g0, b0),
        transparent: true, opacity: 0.95,
      });
      const p = new THREE.Mesh(geo, mat) as unknown as typeof debris[number];
      p.position.set(mp.getX(idx), mp.getY(idx), mp.getZ(idx));
      p.userData = {
        vx:    (Math.random() - 0.5) * 0.05,
        vy:    -0.002 + Math.random() * 0.010,
        vz:    (Math.random() - 0.5) * 0.03,
        rotVx: (Math.random() - 0.5) * 0.8,
        rotVy: (Math.random() - 0.5) * 0.8,
        spawn: ts,
        r0, g0, b0,
      };
      scene.add(p);
      debris.push(p);
    }
    function updateDebris(dt: number, ts: number) {
      for (let i = debris.length - 1; i >= 0; i--) {
        const p = debris[i];
        const age = ts - p.userData.spawn;
        if (age > DEBRIS_LIFE) {
          scene.remove(p);
          p.geometry.dispose();
          (p.material as THREE.Material).dispose();
          debris.splice(i, 1);
          continue;
        }
        // Gentle fall + radial pull toward tunnel vanishing point (0,0,0).
        // The pull grows as the chunk fades — visually "absorbed" by the tunnel.
        const lifeFrac = age / DEBRIS_LIFE;
        const pullStrength = 0.35 * lifeFrac;          // 0 → 0.35 over life
        p.userData.vx += (-p.position.x * pullStrength - p.userData.vx * 0.25) * dt;
        p.userData.vy += (-GRAVITY - p.position.y * pullStrength * 0.4) * dt;
        p.userData.vz += (-p.position.z * pullStrength - p.userData.vz * 0.25) * dt;
        p.position.x += p.userData.vx * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += p.userData.vz * dt;
        p.rotation.x += p.userData.rotVx * dt;
        p.rotation.y += p.userData.rotVy * dt;

        // Fade + tint into tunnel navy — starts at 15% life, full dissolve by end.
        // Chunks never reach floor; they dissolve into the tunnel pattern mid-air.
        const mat = p.material as THREE.MeshBasicMaterial;
        if (lifeFrac < 0.15) {
          mat.opacity = 0.95;
        } else {
          const t = (lifeFrac - 0.15) / 0.85;            // 0 → 1 over fade window
          const tintT = Math.min(1, t * 1.4);            // tint completes before opacity
          const { r0, g0, b0 } = p.userData;
          mat.color.setRGB(
            r0 + (TUNNEL_R - r0) * tintT,
            g0 + (TUNNEL_G - g0) * tintT,
            b0 + (TUNNEL_B - b0) * tintT,
          );
          mat.opacity = 0.95 * Math.pow(1 - t, 1.4);     // ease-out fade
        }
      }
      if (DEBRIS_MAX > 0 && ts - lastSpawn > SPAWN_INTERVAL) {
        spawnDebris(ts);
        lastSpawn = ts;
      }
    }

    // Nav logo: one-shot render, no animation loop (crisper + lighter)
    if (isNav) {
      renderer.render(scene, camera);
      return () => {
        window.removeEventListener('resize', onResize);
        try {
          if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
          renderer.dispose();
        } catch { /* ignore */ }
        marbleMap.dispose();
        roughMap.dispose();
      };
    }

    // Animate — patina sweep + chunk disappearance + debris
    let frame = 0;
    let lastT = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      frame++;
      const t = clock.getElapsedTime();
      const dt = Math.min(t - lastT, 0.1);
      lastT = t;

      // Patina: big-swing pLift + faster traveling band
      const pLift  = 0.45 + 0.35 * Math.sin(t * 0.24) + 0.18 * Math.sin(t * 0.51 + 1.3);
      const shiftX = 0.5 - 0.5 * Math.cos(t * 0.55);
      computePatina(patinaInfoRef.current, pLift, shiftX);

      // Crumble — shimmer + chunk collapse/refill (1–2 per 6s across logo)
      if (frame % 2 === 0) {
        for (const info of crumbleInfoRef.current) {
          const { posAttr, nrmAttr, origPos, noiseFreq, noisePhase, deg,
                  radius, radSeg, chunkRings, chunkCount, chunkPhase, chunkSpeed } = info;
          const amp = deg * 0.022;
          const ringStride = radSeg + 1;
          const collapseMax = radius * 0.95;
          for (let i = 0; i < posAttr.count; i++) {
            const ringIdx = Math.floor(i / ringStride);
            const cIdx = Math.min(chunkCount - 1, Math.floor(ringIdx / chunkRings));
            const w = Math.sin(t * chunkSpeed[cIdx] + chunkPhase[cIdx]);
            let missing = 0;
            if (w > 0.92) {
              const u = (w - 0.92) / 0.08;
              missing = u * u * (3 - 2 * u);
            }
            const shimmer = Math.sin(t * noiseFreq[i] + noisePhase[i]) * amp;
            const d = shimmer - collapseMax * missing;
            posAttr.setXYZ(
              i,
              origPos[i * 3]     + nrmAttr.getX(i) * d,
              origPos[i * 3 + 1] + nrmAttr.getY(i) * d,
              origPos[i * 3 + 2] + nrmAttr.getZ(i) * d,
            );
          }
          posAttr.needsUpdate = true;
        }
      }

      updateDebris(dt, t);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      try {
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        renderer.dispose();
      } catch { /* ignore double-dispose on fast unmount */ }
      marbleMap.dispose();
      roughMap.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: w, height: h, flexShrink: 0, background: 'transparent',
               position: 'relative', zIndex: isNav ? 20 : 10 }}
    />
  );
}

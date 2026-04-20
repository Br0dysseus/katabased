'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { Float, Environment } from '@react-three/drei';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as THREE from 'three';

// ── Extruded letter from an SVG path file ─────────────────────────────────────
function ExtrudedLetter({
  url,
  color,
  emissive,
  position,
  scale = 1,
}: {
  url: string;
  color: number;
  emissive: number;
  position: [number, number, number];
  scale?: number;
}) {
  const svg  = useLoader(SVGLoader, url);
  const mesh = useRef<THREE.Mesh>(null!);

  const geometry = useMemo(() => {
    const shapes: THREE.Shape[] = [];
    for (const path of svg.paths) {
      for (const s of SVGLoader.createShapes(path)) {
        shapes.push(s);
      }
    }

    const tmpGeo = new THREE.ShapeGeometry(shapes);
    tmpGeo.computeBoundingBox();
    const bb  = tmpGeo.boundingBox!;
    const cx  = (bb.max.x + bb.min.x) / 2;
    const cy  = (bb.max.y + bb.min.y) / 2;
    tmpGeo.dispose();

    const centred = shapes.map(sh => {
      const s2 = new THREE.Shape(sh.getPoints().map(p => new THREE.Vector2(p.x - cx, p.y - cy)));
      s2.holes = sh.holes.map(h =>
        new THREE.Path(h.getPoints().map(p => new THREE.Vector2(p.x - cx, p.y - cy)))
      );
      return s2;
    });

    return new THREE.ExtrudeGeometry(centred, {
      depth:         18,
      bevelEnabled:  true,
      bevelSize:     3.5,
      bevelThickness:2.5,
      bevelSegments: 5,
      curveSegments: 20,
    });
  }, [svg]);

  return (
    <mesh ref={mesh} geometry={geometry} position={position} scale={scale}>
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.12}
        metalness={0.95}
        roughness={0.10}
        envMapIntensity={2.5}
      />
    </mesh>
  );
}

function BackingPlate({ isNav }: { isNav: boolean }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    const r = isNav ? 0.72 : 1.1;
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / sides;
      const x = r * Math.cos(a) * 1.1;
      const y = r * Math.sin(a);
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 4, bevelEnabled: false,
    });
  }, [isNav]);

  return (
    <mesh geometry={geo} position={[0, 0, -22]} receiveShadow>
      <meshStandardMaterial
        color={0x0d0805}
        metalness={0.3}
        roughness={0.8}
        envMapIntensity={0.4}
      />
    </mesh>
  );
}

function Scene({ size }: { size: 'nav' | 'large' }) {
  const groupRef = useRef<THREE.Group>(null!);
  const isNav    = size === 'nav';
  const sc       = isNav ? 0.0018 : 0.0038;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(t * 0.40) * 0.50;
    groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.07;
  });

  const kHalfW = 492 * sc / 2;
  const bHalfW = 374 * sc / 2;
  const gap    = isNav ? 0.04 : 0.09;
  const kx     = -(kHalfW + gap);
  const bx     =  (bHalfW + gap);

  return (
    <group ref={groupRef}>
      <BackingPlate isNav={isNav} />
      <Suspense fallback={null}>
        <Float speed={1.2} floatIntensity={isNav ? 0.15 : 0.28} rotationIntensity={0}>
          <ExtrudedLetter
            url="/fonts/kappa.svg"
            color={0xc85820}
            emissive={0x7a2a08}
            position={[kx, 0, 0]}
            scale={sc}
          />
          <ExtrudedLetter
            url="/fonts/beta.svg"
            color={0xc8a030}
            emissive={0x6a4a08}
            position={[bx, 0, 0]}
            scale={sc}
          />
        </Float>
      </Suspense>
    </group>
  );
}

interface KataLogo3DProps {
  size?: 'nav' | 'large';
}

export default function KataLogo3D({ size = 'nav' }: KataLogo3DProps) {
  const isNav = size === 'nav';
  const w     = isNav ? 72 : 220;
  const h     = isNav ? 42 : 130;

  return (
    <div style={{ width: w, height: h, flexShrink: 0 }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, isNav ? 3.2 : 3.0], fov: 42, near: 0.01, far: 100 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <Environment preset="warehouse" />
        <pointLight position={[4, 5, 4]}   intensity={2.2} color="#FFB060" />
        <pointLight position={[-4, -2, 3]} intensity={0.5} color="#4060A0" />
        <pointLight position={[0, 3, -4]}  intensity={0.8} color="#C84010" />
        <ambientLight intensity={0.10} />

        <Suspense fallback={null}>
          <Scene size={size} />
        </Suspense>
      </Canvas>
    </div>
  );
}

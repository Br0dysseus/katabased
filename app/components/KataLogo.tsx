'use client';

import React from 'react';

const SIZES = {
  nav:   { fontSize: 22, width: 38, height: 28, perspective: 120, depth: 6 },
  large: { fontSize: 34, width: 58, height: 44, perspective: 200, depth: 9 },
} as const;

// kappa extrusion: dark back -> bright copper front (8 layers)
const KAPPA_LAYERS = [
  { z: 0,  color: '#200400' },
  { z: 1,  color: '#2A0600' },
  { z: 2,  color: '#3D0A00' },
  { z: 3,  color: '#5A1800' },
  { z: 4,  color: '#7A2A08' },
  { z: 5,  color: '#9E4418' },
  { z: 6,  color: '#B85220' },
  { z: 7,  color: '#C8602A' }, // front face
];

// beta extrusion: subtle depth, warm parchment (4 layers)
const BETA_LAYERS = [
  { z: 0,  color: '#6B5A3A' },
  { z: 1,  color: '#8A7A58' },
  { z: 2,  color: '#B8A880' },
  { z: 3,  color: '#D8C4A0' }, // front face
];

function charBlock(
  char: string,
  layers: { z: number; color: string }[],
  opts: {
    fontSize: number;
    depthScale: number;
    left: number;
    isFrontKappa?: boolean;
  }
): React.ReactNode[] {
  return layers.map((layer, i) => {
    const isFront = i === layers.length - 1;
    const style: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: opts.left,
      fontFamily: "'kataGlyph Stele', Georgia, serif",
      fontWeight: 400,
      fontStyle: 'normal',
      fontSize: opts.fontSize,
      lineHeight: 1,
      color: layer.color,
      transform: `translateZ(${layer.z * opts.depthScale}px)`,
      userSelect: 'none',
      pointerEvents: 'none',
    };

    if (isFront && opts.isFrontKappa) {
      return (
        <span
          key={`${char}-${i}`}
          style={{
            ...style,
            filter: 'url(#chalk-filter)',
            animation: 'copperBreath 4s ease-in-out infinite',
          }}
        >
          {char}
        </span>
      );
    }

    return (
      <span key={`${char}-${i}`} style={style}>
        {char}
      </span>
    );
  });
}

export default function KataLogo({ size = 'nav' }: { size?: 'nav' | 'large' }) {
  const s = SIZES[size];
  const depthScale = s.depth / 7; // normalize to layer count

  return (
    <div
      style={{
        position: 'relative',
        width: s.width,
        height: s.height,
        perspective: s.perspective,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          animation: 'logoRock 6s ease-in-out infinite',
        }}
      >
        {charBlock('κ', KAPPA_LAYERS, {
          fontSize: s.fontSize,
          depthScale,
          left: 0,
          isFrontKappa: true,
        })}
        {charBlock('β', BETA_LAYERS, {
          fontSize: s.fontSize,
          depthScale,
          left: Math.round(s.fontSize * 0.52),
        })}
      </div>
    </div>
  );
}

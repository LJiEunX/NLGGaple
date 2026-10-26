import React, { useId } from 'react';
import type { Tile } from '../types.ts';

interface DominoTileProps {
  tile: Tile;
  orientation?: 'vertical' | 'horizontal';
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  hidden?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Coordinate mappings for 0-6 pips inside a 60x60 square
const PIP_COORDINATES: Record<number, [number, number][]> = {
  0: [],
  1: [[30, 30]],
  2: [
    [44, 16],
    [16, 44],
  ],
  3: [
    [44, 16],
    [30, 30],
    [16, 44],
  ],
  4: [
    [16, 16],
    [44, 16],
    [16, 44],
    [44, 44],
  ],
  5: [
    [16, 16],
    [44, 16],
    [30, 30],
    [16, 44],
    [44, 44],
  ],
  6: [
    [16, 16],
    [16, 30],
    [16, 44],
    [44, 16],
    [44, 30],
    [44, 44],
  ],
};

function DominoHalfSvg({ count, uniqueId }: { count: number; uniqueId: string }) {
  const points = PIP_COORDINATES[count] || [];
  const isOne = count === 1;

  return (
    <svg
      viewBox="0 0 60 60"
      className="w-full h-full block select-none pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Realistic 3D Enamel Pip Radial Gradient */}
        <radialGradient id={`pip-grad-${uniqueId}`} cx="35%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="35%" stopColor="#dc2626" />
          <stop offset="75%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>

        {/* Recessed Pip Drop Shadow */}
        <filter id={`pip-shadow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.75" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      {points.map(([cx, cy], i) => (
        <g key={`${cx}-${cy}-${i}`} filter={`url(#pip-shadow-${uniqueId})`}>
          {/* Main Enamelled Pip */}
          <circle
            cx={cx}
            cy={cy}
            r={isOne ? 7.5 : 5.8}
            fill={`url(#pip-grad-${uniqueId})`}
            stroke="#6b1111"
            strokeWidth="0.8"
          />
          {/* Specular Highlight for 3D Lacquer Effect */}
          <circle
            cx={cx - (isOne ? 2.2 : 1.8)}
            cy={cy - (isOne ? 2.2 : 1.8)}
            r={isOne ? 2.2 : 1.6}
            fill="#ffffff"
            opacity="0.65"
          />
        </g>
      ))}
    </svg>
  );
}

/**
 * Traditional Indonesian Domino Card Back:
 * - Rich deep crimson/maroon base field
 * - Crisp ivory/white card border
 * - Intricate diamond crosshatch (pola wajik) lattice
 * - Symmetrical 8-point compass star rosette medallion in center
 * - No text, authentic to Indonesian domino / gaple cards
 */
function DominoBackSvg({
  isVertical,
  uniqueId,
}: {
  isVertical: boolean;
  uniqueId: string;
}) {
  const w = isVertical ? 60 : 120;
  const h = isVertical ? 120 : 60;
  const cx = w / 2;
  const cy = h / 2;

  // Inset dimensions for outer ivory frame
  const margin = 3.5;
  const innerX = margin;
  const innerY = margin;
  const innerW = w - margin * 2;
  const innerH = h - margin * 2;

  // Fine inner dashed border
  const subMargin = 6.5;
  const subInnerX = subMargin;
  const subInnerY = subMargin;
  const subInnerW = w - subMargin * 2;
  const subInnerH = h - subMargin * 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full block select-none pointer-events-none"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Authentic Indonesian Deep Crimson / Maroon Radial Gradient */}
        <radialGradient id={`indo-grad-${uniqueId}`} cx="50%" cy="50%" r="68%">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="35%" stopColor="#991b1b" />
          <stop offset="75%" stopColor="#6b0e0e" />
          <stop offset="100%" stopColor="#450707" />
        </radialGradient>

        {/* Diamond Lattice Pattern (Pola Wajik / Crosshatch Tradisional) */}
        <pattern
          id={`wajik-pat-${uniqueId}`}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          {/* Diagonal intersecting grid lines (45 deg) */}
          <path
            d="M0 10 L10 0 M0 0 L10 10"
            stroke="#ffffff"
            strokeWidth="0.65"
            strokeOpacity="0.24"
          />
          {/* Center micro diamond pip */}
          <polygon
            points="5,3.8 6.2,5 5,6.2 3.8,5"
            fill="#fef08a"
            opacity="0.45"
          />
        </pattern>
      </defs>

      {/* Cardstock Base: White/Ivory Card Border with Rounded Corners */}
      <rect
        x="0.5"
        y="0.5"
        width={w - 1}
        height={h - 1}
        rx="6"
        ry="6"
        fill="#fbf9f4"
        stroke="#d5cdbf"
        strokeWidth="1"
      />

      {/* Main Crimson / Maroon Field */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        rx="3.5"
        ry="3.5"
        fill={`url(#indo-grad-${uniqueId})`}
        stroke="#750f0f"
        strokeWidth="0.75"
      />

      {/* Traditional Diamond Lattice Overlay */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        rx="3.5"
        ry="3.5"
        fill={`url(#wajik-pat-${uniqueId})`}
      />

      {/* Inner White Fine Frame Line */}
      <rect
        x={subInnerX}
        y={subInnerY}
        width={subInnerW}
        height={subInnerH}
        rx="2.5"
        ry="2.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.75"
        strokeOpacity="0.55"
      />

      {/* Dotted Beaded Framing */}
      <rect
        x={subInnerX + 2}
        y={subInnerY + 2}
        width={subInnerW - 4}
        height={subInnerH - 4}
        rx="2"
        ry="2"
        fill="none"
        stroke="#fef08a"
        strokeWidth="0.5"
        strokeOpacity="0.35"
        strokeDasharray="1.5 1.5"
      />

      {/* Traditional Indonesian Rosette Centerpiece (Without any text) */}
      <g transform={`translate(${cx}, ${cy})`}>
        {/* Outer Circular Medallion */}
        <circle
          r="13.5"
          fill="#450707"
          stroke="#ffffff"
          strokeWidth="0.8"
          strokeOpacity="0.65"
        />
        <circle
          r="11.5"
          fill="none"
          stroke="#fef08a"
          strokeWidth="0.5"
          strokeOpacity="0.5"
          strokeDasharray="1.2 1.2"
        />

        {/* 8-Point Compass Star Petals (Bintang Delapan Penjuru Khas Kartu Domino) */}
        {/* Primary 4 points */}
        <polygon
          points="0,-10 2.2,-2.2 10,0 2.2,2.2 0,10 -2.2,2.2 -10,0 -2.2,-2.2"
          fill="#fef08a"
          opacity="0.9"
        />
        {/* Secondary 4 points */}
        <polygon
          points="0,-7.2 1.8,-1.8 7.2,0 1.8,1.8 0,7.2 -1.8,1.8 -7.2,0 -1.8,-1.8"
          transform="rotate(45)"
          fill="#ffffff"
          opacity="0.7"
        />

        {/* Center Pearl Stud */}
        <circle r="3" fill="#881337" stroke="#ffffff" strokeWidth="0.6" />
        <circle r="1.4" fill="#fef08a" />
      </g>
    </svg>
  );
}

export const DominoTile: React.FC<DominoTileProps> = ({
  tile = [0, 0],
  orientation = 'vertical',
  isPlayable = false,
  isSelected = false,
  onClick,
  size = 'md',
  hidden = false,
  style,
  className,
}) => {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const topPip = tile?.[0] ?? 0;
  const bottomPip = tile?.[1] ?? 0;
  const isVertical = orientation === 'vertical';

  // Strict 1:2 Aspect Ratio Dimensions with Responsive Breakpoints
  const sizeClasses = {
    sm: isVertical
      ? 'w-6 h-12 sm:w-7 sm:h-14 md:w-9 md:h-[72px]'
      : 'w-12 h-6 sm:w-14 sm:h-7 md:w-[72px] md:h-9',
    md: isVertical
      ? 'w-10 h-20 sm:w-12 sm:h-24 md:w-14 md:h-28'
      : 'w-20 h-10 sm:w-24 sm:h-12 md:w-28 md:h-14',
    lg: isVertical
      ? 'w-14 h-28 sm:w-16 sm:h-32 md:w-20 md:h-40'
      : 'w-28 h-14 sm:w-32 sm:h-16 md:w-40 md:h-20',
  }[size];

  // Face-down card back (Traditional Indonesian Domino Card Back - Maroon Diamond Lattice)
  if (hidden) {
    const isClickable = Boolean(onClick || isPlayable);
    const Container = isClickable ? 'button' : 'div';

    return (
      <Container
        type={isClickable ? 'button' : undefined}
        onClick={onClick}
        disabled={isClickable ? !onClick && !isPlayable : undefined}
        style={style}
        className={`
          ${style?.width && style?.height ? '' : sizeClasses}
          ${className || ''}
          relative rounded-lg md:rounded-xl shrink-0
          shadow-[0_4px_10px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)]
          overflow-hidden
          select-none
          p-0
          transition-all duration-200 ease-out
          ${
            isClickable
              ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.45)] active:scale-95'
              : 'cursor-default'
          }
        `}
      >
        <DominoBackSvg isVertical={isVertical} uniqueId={safeId} />
      </Container>
    );
  }

  return (
    <button
      type="button"
      onClick={isPlayable || onClick ? onClick : undefined}
      disabled={!isPlayable && !onClick}
      style={style}
      className={`
        ${style?.width && style?.height ? '' : sizeClasses}
        ${className || ''}
        relative shrink-0
        rounded-lg md:rounded-xl
        bg-gradient-to-b from-[#ffffff] via-[#faf8f5] to-[#ece7db]
        border border-[#d2cbbe]
        shadow-[0_4px_10px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(0,0,0,0.12)]
        flex ${isVertical ? 'flex-col' : 'flex-row'} items-center justify-between
        p-1
        transition-all duration-200 ease-out
        ${
          isPlayable
            ? 'cursor-pointer hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(16,185,129,0.45)] ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950'
            : isSelected
            ? 'ring-4 ring-amber-400 -translate-y-2.5 shadow-[0_14px_28px_rgba(251,191,36,0.45)]'
            : 'cursor-default'
        }
      `}
    >
      {/* Top / Left Half (Exact 1:1 Square) */}
      <div className="flex-1 w-full h-full aspect-square flex items-center justify-center overflow-hidden p-0.5">
        <DominoHalfSvg count={topPip} uniqueId={`${safeId}-t`} />
      </div>

      {/* Engraved Center Groove with Brass Spinner Pin */}
      <div
        className={`relative shrink-0 ${
          isVertical ? 'w-[90%] h-[2px]' : 'h-[90%] w-[2px]'
        } bg-stone-300 shadow-[inset_0_1px_1px_rgba(0,0,0,0.35)] flex items-center justify-center rounded-full`}
      >
        <div className="absolute w-2 h-2 rounded-full bg-gradient-to-tr from-amber-700 via-amber-300 to-amber-700 shadow-[0_1px_2px_rgba(0,0,0,0.45)] border border-amber-800/80" />
      </div>

      {/* Bottom / Right Half (Exact 1:1 Square) */}
      <div className="flex-1 w-full h-full aspect-square flex items-center justify-center overflow-hidden p-0.5">
        <DominoHalfSvg count={bottomPip} uniqueId={`${safeId}-b`} />
      </div>
    </button>
  );
};

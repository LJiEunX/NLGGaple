import React from 'react';
import { DominoTile } from './DominoTile.tsx';
import { Layers, Sparkles } from 'lucide-react';

interface CangkulDeckProps {
  count: number;
  isActionable?: boolean;
  onDraw?: () => void;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export const CangkulDeck: React.FC<CangkulDeckProps> = ({
  count,
  isActionable = false,
  onDraw,
  size = 'sm',
  label = 'Cangkul',
  className = '',
}) => {
  const isClickable = isActionable && count > 0 && Boolean(onDraw);

  if (count === 0) {
    return (
      <div
        className={`flex flex-col items-center gap-1 select-none opacity-60 ${className}`}
        title="Tumpukan Cangkul Meja Sudah Habis"
      >
        <div
          className={`
            ${size === 'sm' ? 'w-8 h-16 md:w-9 md:h-[72px]' : 'w-12 h-24 sm:w-14 sm:h-28'}
            rounded-lg md:rounded-xl border-2 border-dashed border-amber-600/40
            bg-slate-950/40 flex flex-col items-center justify-center p-1
          `}
        >
          <Layers size={size === 'sm' ? 14 : 18} className="text-amber-500/50 mb-0.5" />
          <span className="text-[8px] md:text-[9px] font-bold text-amber-500/60 uppercase text-center leading-tight">
            Habis
          </span>
        </div>
        <span className="text-[9px] font-semibold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
          0 Kartu
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={isClickable ? onDraw : undefined}
      className={`
        relative flex flex-col items-center gap-1 select-none transition-transform duration-200
        ${isClickable ? 'cursor-pointer hover:scale-105 active:scale-95 group' : 'cursor-default'}
        ${className}
      `}
      title={
        isClickable
          ? '🎯 Giliran Anda! Klik tumpukan kartu untuk mencangkul'
          : `Tumpukan Cangkul: ${count} kartu tersisa`
      }
    >
      {/* 3D Physical Card Stack Visualization */}
      <div className="relative">
        {/* Layer 3: Bottom Shadow Card (visible if count >= 6) */}
        {count >= 6 && (
          <div
            className={`
              absolute inset-0 rounded-lg md:rounded-xl
              bg-[#3b0808] border border-amber-950/80 shadow-md
              translate-x-1 translate-y-1 rotate-[3deg] opacity-75 pointer-events-none
            `}
          />
        )}

        {/* Layer 2: Middle Card (visible if count >= 2) */}
        {count >= 2 && (
          <div
            className={`
              absolute inset-0 rounded-lg md:rounded-xl
              bg-[#5c0d0d] border border-amber-900/60 shadow-md
              -translate-x-0.5 translate-y-0.5 rotate-[-1.5deg] opacity-90 pointer-events-none
            `}
          />
        )}

        {/* Layer 1: Top Physical Domino Tile (Authentic Indonesian Maroon Back) */}
        <div
          className={`
            relative transition-all duration-200
            ${
              isClickable
                ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                : 'shadow-[0_4px_10px_rgba(0,0,0,0.5)]'
            }
          `}
        >
          <DominoTile
            tile={[0, 0]}
            hidden
            orientation="vertical"
            size={size}
          />
        </div>
      </div>

      {/* Clean Card Count Badge */}
      <div
        className={`
          flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md transition-colors backdrop-blur-xs
          ${
            isClickable
              ? 'bg-amber-400 text-slate-950 border border-amber-300 font-extrabold'
              : 'bg-emerald-950/80 text-amber-300 border border-emerald-800/60'
          }
        `}
      >
        <span>{label}:</span>
        <span>{count}</span>
      </div>
    </div>
  );
};

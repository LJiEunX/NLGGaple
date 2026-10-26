import React from 'react';
import type { ClientPlayerView } from '../types.ts';
import { User, Bot, Clock } from 'lucide-react';
import { DominoTile } from './DominoTile.tsx';

interface PlayerSeatProps {
  player: ClientPlayerView;
  isCurrentTurn: boolean;
  position: 'top' | 'left' | 'right';
  showCards?: boolean;
  chatMessage?: string | null;
  targetScore?: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  position,
  showCards = false,
  chatMessage = null,
  targetScore,
}) => {
  if (!player) return null;

  const playerName = player.name || 'Pemain';
  const isBot = playerName.startsWith('Bot');

  return (
    <div
      className={`
        relative flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-xl transition-all duration-300
        ${
          isCurrentTurn
            ? 'bg-amber-500/20 border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] scale-105'
            : 'bg-slate-900/60 border border-slate-800'
        }
      `}
    >
      {/* Floating Chat Bubble */}
      {chatMessage && (
        <div className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl shadow-lg border border-amber-300 whitespace-nowrap animate-bounce z-30">
          {chatMessage}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-400" />
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Avatar */}
        <div
          className={`relative w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs ${
            isCurrentTurn
              ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 ring-2 ring-amber-400'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {isBot ? <Bot size={15} /> : <User size={15} />}
          {isCurrentTurn && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500" />
            </span>
          )}
        </div>

        {/* Name & Score */}
        <div className="text-left leading-tight">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[11px] sm:text-xs text-slate-200 truncate max-w-[58px] sm:max-w-[85px]">
              {playerName}
            </span>
            {isCurrentTurn && (
              <span className="text-[9px] sm:text-[10px] text-amber-400 font-bold uppercase tracking-wider hidden sm:inline">
                Giliran
              </span>
            )}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">
            Skor: <span className="text-amber-300 font-bold">{player.score}</span>
            {targetScore ? <span className="text-slate-500">/{targetScore}</span> : ''}
          </div>
        </div>
      </div>

      {/* Card count visualization (stacked face-down mini tiles) */}
      <div className="flex items-center gap-0.5 mt-0.5">
        {showCards && player.hand ? (
          <div className="flex gap-1 flex-wrap justify-center">
            {player.hand.map((t, idx) => (
              <DominoTile key={idx} tile={t} size="sm" />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800 text-[10px] text-slate-300">
            <span>Kartu:</span>
            <span className="font-bold text-emerald-400">{player.handCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};

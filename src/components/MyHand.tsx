import React, { useState } from 'react';
import type { Tile, ValidMove } from '../types.ts';
import { areTilesEqual } from '../deck.ts';
import { DominoTile } from './DominoTile.tsx';
import { FastForward, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

interface MyHandProps {
  hand: Tile[];
  validMoves: ValidMove[];
  isMyTurn: boolean;
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile) => void;
  onPass: () => void;
  timerSeconds: number;
  score?: number;
  targetScore?: number;
}

export const MyHand: React.FC<MyHandProps> = ({
  hand,
  validMoves,
  isMyTurn,
  selectedTile,
  onSelectTile,
  onPass,
  timerSeconds,
  score = 0,
  targetScore = 100,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const canPass = isMyTurn && validMoves.length === 0;
  const totalPips = hand.reduce((acc, t) => acc + t[0] + t[1], 0);

  const handleTileClick = (tile: Tile, isPlayable: boolean) => {
    if (!isMyTurn) {
      setFeedback('⏳ Bukan giliran Anda! Mohon tunggu giliran lawan.');
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    if (!isPlayable) {
      setFeedback(`❌ Kartu [${tile[0]}|${tile[1]}] tidak cocok dengan angka di ujung meja!`);
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    onSelectTile(tile);
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Hand Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-2xl px-2 text-[11px] sm:text-xs md:text-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-slate-400">Total Skor:</span>
            <span className="font-extrabold text-amber-300 bg-slate-900 px-2 sm:px-2.5 py-0.5 rounded border border-amber-500/40 shadow-xs">
              {score} <span className="text-slate-500 font-normal">/ {targetScore}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-slate-400">Pips:</span>
            <span className="font-bold text-amber-400 bg-slate-900 px-1.5 sm:px-2 py-0.5 rounded border border-slate-800">
              {totalPips}
            </span>
            <span className="text-slate-500 text-[10px] sm:text-xs">({hand.length} kartu)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMyTurn ? (
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full animate-pulse font-semibold text-[11px] sm:text-xs">
              <Sparkles size={13} className="text-amber-400" />
              <span>Giliran Anda! <b className="text-amber-300">{timerSeconds}s</b></span>
            </div>
          ) : (
            <div className="text-slate-400 text-[10px] sm:text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              Menunggu lawan...
            </div>
          )}

          {/* Pass Button */}
          <button
            type="button"
            disabled={!canPass}
            onClick={onPass}
            className={`
              flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition-all
              ${
                canPass
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg ring-2 ring-rose-400 cursor-pointer animate-bounce'
                  : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }
            `}
          >
            <FastForward size={13} />
            <span>LEWAT</span>
          </button>
        </div>
      </div>

      {/* Floating feedback message when user clicks unplayable card or when not their turn */}
      {feedback && (
        <div className="flex items-center gap-1.5 text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1 rounded-full shadow-lg animate-fade-in">
          <AlertCircle size={14} className="shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tiles Rack (Horizontally scrollable if wide, centered if fits) */}
      <div className="w-full max-w-3xl overflow-x-auto py-1 px-1">
        <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 p-2 sm:p-3 bg-slate-900/80 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-md min-h-[90px] sm:min-h-[110px] w-fit mx-auto">
          {hand.map((tile, idx) => {
            const isPlayable =
              isMyTurn && validMoves.some(m => areTilesEqual(m.tile, tile));
            const isSelected = selectedTile ? areTilesEqual(selectedTile, tile) : false;

            return (
              <div key={`${idx}-${tile[0]}-${tile[1]}`} className="transition-all shrink-0">
                <DominoTile
                  tile={tile}
                  orientation="vertical"
                  size="md"
                  isPlayable={isPlayable}
                  isSelected={isSelected}
                  onClick={() => handleTileClick(tile, isPlayable)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {isMyTurn && validMoves.length > 0 && !selectedTile && (
        <p className="text-xs text-emerald-400 font-medium animate-fade-in flex items-center gap-1">
          <Sparkles size={13} />
          Pilih salah satu kartu bersinar hijau di atas untuk dipasang
        </p>
      )}

      {isMyTurn && validMoves.length === 0 && (
        <p className="text-xs text-rose-400 font-semibold animate-fade-in flex items-center gap-1">
          <ShieldAlert size={14} />
          Tidak ada kartu yang cocok dengan ujung meja! Klik tombol LEWAT (PASS).
        </p>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { Tile } from '../types.ts';
import { DominoTile } from './DominoTile.tsx';
import { GoldenLaurelWreath } from './GoldenLaurelWreath.tsx';
import { playPointTallyTick, playVictoryFanfare, playTileClack } from '../utils/audio.ts';
import confetti from 'canvas-confetti';
import { Trophy, AlertOctagon, RotateCcw, ArrowRight, LogOut, Sparkles } from 'lucide-react';

export interface ShowdownPlayer {
  id: string;
  name: string;
  hand: Tile[];
  totalPips: number;
  isWinner: boolean;
  isMe: boolean;
  score?: number; // accumulated penalty score
  penaltyAdded?: number;
}

interface EndgameShowdownProps {
  players: ShowdownPlayer[];
  winnerName: string;
  winReason: 'gaple' | 'buntu';
  onNextRound?: () => void;
  onRestart?: () => void;
  onExit?: () => void;
  isGameOver?: boolean;
  roundNumber?: number;
  targetScore?: number;
  soundEnabled?: boolean;
}

export const EndgameShowdown: React.FC<EndgameShowdownProps> = ({
  players,
  winnerName,
  winReason,
  onNextRound,
  onRestart,
  onExit,
  isGameOver = false,
  roundNumber,
  targetScore,
  soundEnabled = true,
}) => {
  // Animation step: 'reveal' (cards flip) -> 'tally' (points count up) -> 'winner' (laurel & celebration)
  const [step, setStep] = useState<'reveal' | 'tally' | 'winner'>('reveal');
  const [displayedPoints, setDisplayedPoints] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    players.forEach(p => {
      init[p.id] = 0;
    });
    return init;
  });

  const me = players.find(p => p.isMe);
  const opponents = players.filter(p => !p.isMe);
  const winner = players.find(p => p.isWinner);

  // Phase 1: Card Reveal Sound
  useEffect(() => {
    if (soundEnabled) playTileClack();

    // After 800ms, start point tallying
    const tallyTimer = setTimeout(() => {
      setStep('tally');
    }, 800);

    return () => clearTimeout(tallyTimer);
  }, [soundEnabled]);

  // Phase 2: Points Tallying Animation (Counter ticks from 0 up to target)
  useEffect(() => {
    if (step !== 'tally') return;

    const maxPoints = Math.max(...players.map(p => p.totalPips), 1);
    const duration = 1400; // ms
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      setDisplayedPoints(() => {
        const next: Record<string, number> = {};
        players.forEach(p => {
          next[p.id] = Math.round(p.totalPips * progress);
        });
        return next;
      });

      if (soundEnabled && Math.random() > 0.4) {
        playPointTallyTick();
      }

      if (progress >= 1) {
        clearInterval(interval);
        setStep('winner');
      }
    }, 50);

    return () => clearInterval(interval);
  }, [step, players, soundEnabled]);

  // Phase 3: Winner Crowning & Confetti Fanfare
  useEffect(() => {
    if (step !== 'winner') return;

    if (soundEnabled) {
      playVictoryFanfare();
    }

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
    });
  }, [step, soundEnabled]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none overflow-hidden">
      {/* Top Banner: Round Result & Win Reason */}
      <div className="w-full flex flex-col items-center text-center mt-2 z-20">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-lg backdrop-blur-xs transition-all duration-500 ${
            step === 'winner'
              ? isGameOver
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 scale-105 shadow-[0_0_25px_rgba(251,191,36,0.7)]'
                : 'bg-amber-500/20 border-amber-400/80 text-amber-300 scale-105'
              : 'bg-slate-900/80 border-slate-700 text-slate-200'
          }`}
        >
          {isGameOver ? (
            <Trophy size={18} className="text-amber-300" />
          ) : winReason === 'gaple' ? (
            <Trophy size={18} className="text-amber-400" />
          ) : (
            <AlertOctagon size={18} className="text-amber-400" />
          )}
          <span className="font-black text-xs md:text-sm tracking-wide">
            {isGameOver
              ? `🏆 JUARA PERTANDINGAN! (MENCAPAI TARGET ${targetScore ?? 100} POIN)`
              : winReason === 'gaple'
              ? '🎉 GAPLE! (KARTU HABIS)'
              : '🔒 BUNTU / DEADLOCK!'}
          </span>
          {roundNumber && (
            <span className="text-[11px] text-amber-400/70 border-l border-amber-500/30 pl-2">
              Ronde {roundNumber}
            </span>
          )}
        </div>

        {step === 'winner' && (
          <p className="text-xs md:text-sm text-emerald-300 font-bold mt-1.5 animate-fade-in flex items-center justify-center gap-1.5 flex-wrap">
            <Sparkles size={14} className="text-amber-400" />
            <span>
              {isGameOver
                ? winner?.isMe
                  ? `Selamat! Anda berhasil mencapai target ${targetScore ?? 100} poin dan menjuarai seluruh pertandingan!`
                  : `${winnerName} berhasil mencapai target ${targetScore ?? 100} poin dan menjuarai seluruh pertandingan!`
                : winner?.isMe
                ? `Selamat! Anda memenangkan Ronde ${roundNumber ?? 1}!`
                : `${winnerName} memenangkan Ronde ${roundNumber ?? 1}!`}
            </span>
            {!isGameOver && targetScore && (
              <span className="text-slate-400 text-xs font-normal">
                (Pertandingan berlanjut hingga target {targetScore} poin)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Middle Arena: Theatrical Showdown Table Layout (Foto Kiri Reference) */}
      <div className="relative w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between items-center py-4 my-auto">
        {/* Top Arena: Opponent(s) Cards & Points */}
        <div className="w-full flex flex-wrap justify-center items-center gap-3 sm:gap-6">
          {opponents.map(opp => (
            <div key={opp.id} className="flex flex-col items-center gap-2 animate-fade-in">
              {/* Opponent Seat Tag */}
              <div className="flex flex-col items-center gap-1 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-2xl text-xs text-slate-300 shadow">
                <span className="font-bold">{opp.name}</span>
                {opp.score !== undefined && (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-slate-400">
                      Total Skor: <b className="text-amber-300 font-extrabold">{opp.score}</b>
                      {targetScore ? <span className="text-slate-500">/{targetScore}</span> : ''}
                    </span>
                    {targetScore && (
                      <div className="w-16 bg-slate-800 h-1 rounded-full overflow-hidden border border-slate-700/50">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((opp.score / targetScore) * 100))}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Opponent Revealed Domino Cards */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-emerald-950/40 rounded-2xl border border-emerald-800/40 shadow-inner min-h-[58px] sm:min-h-[72px] overflow-x-auto max-w-[280px] sm:max-w-none">
                {opp.hand.length === 0 ? (
                  <span className="text-xs text-emerald-400 font-bold px-3 py-2">
                    ✓ Kartu Habis
                  </span>
                ) : (
                  opp.hand.map((tile, i) => (
                    <div
                      key={i}
                      className="transition-transform duration-300 hover:scale-110"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <DominoTile tile={tile} orientation="vertical" size="sm" />
                    </div>
                  ))
                )}
              </div>

              {/* Circular Points Badge with Golden Laurel if Winner */}
              <div className="mt-1">
                {step === 'winner' && opp.isWinner ? (
                  <GoldenLaurelWreath>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 text-slate-950 font-black flex flex-col items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.9)] border-2 border-yellow-100">
                      <span className="text-base leading-none font-black">
                        {displayedPoints[opp.id] ?? opp.totalPips}
                      </span>
                      <span className="text-[8px] uppercase tracking-wider font-extrabold mt-0.5">
                        Points
                      </span>
                    </div>
                  </GoldenLaurelWreath>
                ) : (
                  <div className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 py-1 rounded-full font-black text-xs shadow-md border border-amber-300">
                    <span>{displayedPoints[opp.id] ?? opp.totalPips}</span>
                    <span className="text-[10px] font-bold uppercase opacity-80">Points</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Center Divider: Subtle Felt Table Emblem */}
        <div className="opacity-20 my-2 pointer-events-none">
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>

        {/* Bottom Arena: "You" (Player) Cards & Points */}
        {me && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            {/* Circular Points Badge with Golden Laurel if Winner */}
            <div className="mb-1">
              {step === 'winner' && me.isWinner ? (
                <GoldenLaurelWreath>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 text-slate-950 font-black flex flex-col items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.9)] border-2 border-yellow-100">
                    <span className="text-base leading-none font-black">
                      {displayedPoints[me.id] ?? me.totalPips}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider font-extrabold mt-0.5">
                      Points
                    </span>
                  </div>
                </GoldenLaurelWreath>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 py-1 rounded-full font-black text-xs shadow-md border border-amber-300">
                  <span>{displayedPoints[me.id] ?? me.totalPips}</span>
                  <span className="text-[10px] font-bold uppercase opacity-80">Points</span>
                </div>
              )}
            </div>

            {/* My Revealed Domino Cards */}
            <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-emerald-950/40 rounded-2xl border border-emerald-800/40 shadow-inner min-h-[58px] sm:min-h-[72px] overflow-x-auto max-w-[280px] sm:max-w-none">
              {me.hand.length === 0 ? (
                <span className="text-xs text-emerald-400 font-bold px-3 py-2">
                  ✓ Kartu Habis
                </span>
              ) : (
                me.hand.map((tile, i) => (
                  <div
                    key={i}
                    className="transition-transform duration-300 hover:scale-110"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <DominoTile tile={tile} orientation="vertical" size="sm" />
                  </div>
                ))
              )}
            </div>

            {/* "You" Tag */}
            <div className="flex flex-col items-center gap-1 bg-slate-900/90 border border-slate-800 px-4 py-1.5 rounded-2xl text-xs text-slate-300 shadow">
              <span className="font-extrabold text-amber-300">Anda ({me.name})</span>
              {me.score !== undefined && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-slate-400">
                    Total Skor Anda: <b className="text-amber-300 font-extrabold">{me.score}</b>
                    {targetScore ? <span className="text-slate-500">/{targetScore}</span> : ''}
                  </span>
                  {targetScore && (
                    <div className="w-28 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/50">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((me.score / targetScore) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Buttons (Fades in when step === 'winner') */}
      <div
        className={`w-full max-w-md mx-auto flex flex-col gap-2 transition-all duration-700 ${
          step === 'winner'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          {isGameOver || !onNextRound ? (
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold py-3 px-5 rounded-2xl shadow-xl transition-all cursor-pointer text-sm"
            >
              <RotateCcw size={16} />
              <span>Mulai Pertandingan Baru</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNextRound}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3 px-5 rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.5)] ring-2 ring-amber-300 transition-all cursor-pointer text-sm"
            >
              <span>Lanjut ke Ronde {(roundNumber ?? 1) + 1}</span>
              <ArrowRight size={16} />
            </button>
          )}

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center justify-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-2xl border border-slate-700 transition cursor-pointer text-xs"
              title="Keluar ke Menu Utama"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

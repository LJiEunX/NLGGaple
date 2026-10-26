import React, { useState } from 'react';
import type { RoomPlayer, GameType } from '../server/roomManager.ts';
import {
  Users,
  Copy,
  Check,
  Bot,
  User,
  Crown,
  Play,
  LogOut,
  Share2,
  Clock,
  Flame,
  Trophy,
} from 'lucide-react';

interface WaitingRoomProps {
  roomCode: string;
  players: RoomPlayer[];
  maxPlayers: number;
  gameType?: GameType;
  targetScore?: number;
  isHost: boolean;
  onStartGame: () => void;
  onAddBot: () => void;
  onLeaveRoom: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  roomCode = '',
  players = [],
  maxPlayers = 4,
  gameType = 'classic',
  targetScore = 100,
  isHost = false,
  onStartGame,
  onAddBot,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const canStart = isHost && players.length >= 2;
  const canAddBot = isHost && players.length < maxPlayers;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Create an array of size `maxPlayers` filled with actual player or null (empty slot)
  const slots: (RoomPlayer | null)[] = Array.from(
    { length: maxPlayers },
    (_, i) => players[i] || null
  );

  return (
    <div className="w-full max-w-xl mx-auto my-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col items-center animate-fade-in">
      {/* Top Tag */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-4">
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Users size={14} />
          <span>Ruang Tunggu ({players.length}/{maxPlayers} Pemain)</span>
        </div>
        {gameType === 'nlgg' ? (
          <div className="flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold">
            <Flame size={13} className="text-amber-400" />
            <span>Mode: Ala NLGG (56 Kartu)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
            <span>🁆 Mode: Gaple Klasik (28 Kartu)</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold">
          <Trophy size={13} className="text-amber-400" />
          <span>Target: {targetScore} Poin</span>
        </div>
      </div>

      {/* Room Code Display */}
      <div className="text-center mb-6 w-full">
        <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold block mb-1">
          KODE RUANGAN
        </span>
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-black tracking-widest text-amber-300 bg-slate-950 px-4 sm:px-5 py-1.5 sm:py-2 rounded-2xl border border-slate-800 shadow-inner">
            {roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-2.5 sm:p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition cursor-pointer"
            title="Salin Kode"
          >
            {copiedCode ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          </button>
        </div>

        {/* Share Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-3.5 py-1.5 rounded-full transition cursor-pointer"
        >
          <Share2 size={13} />
          <span>{copiedLink ? 'Tautan Berhasil Disalin!' : 'Salin Tautan Undangan Teman'}</span>
        </button>
      </div>

      {/* Players Slot Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6">
        {slots.map((player, idx) => {
          if (player) {
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    player.isHost
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : player.isBot
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {player.isBot ? <Bot size={20} /> : <User size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs md:text-sm text-slate-200 truncate">
                      {player.name}
                    </span>
                    {player.isHost && (
                      <Crown size={13} className="text-amber-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {player.isHost ? 'Host Meja' : player.isBot ? 'AI Bot' : 'Pemain'}
                  </span>
                </div>
              </div>
            );
          }

          // Empty Slot
          return (
            <div
              key={`empty-${idx}`}
              className="flex items-center gap-3 p-3 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 text-slate-600"
            >
              <div className="w-10 h-10 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs font-medium">
                {idx + 1}
              </div>
              <div className="text-xs">
                <span>Menunggu Teman...</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-2.5">
        {isHost ? (
          <div className="flex items-center gap-2">
            {canAddBot && (
              <button
                type="button"
                onClick={onAddBot}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700"
              >
                <Bot size={15} />
                <span>Isi Slot dengan Bot</span>
              </button>
            )}

            <button
              type="button"
              disabled={!canStart}
              onClick={onStartGame}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition shadow-lg cursor-pointer ${
                canStart
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40 animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play size={16} />
              <span>Mulai Pertandingan</span>
            </button>
          </div>
        ) : (
          <div className="w-full py-2.5 px-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Clock size={14} className="animate-spin text-amber-400" />
            <span>Menunggu Host memulai permainan...</span>
          </div>
        )}

        {/* Leave Room Button */}
        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
        >
          <LogOut size={14} />
          <span>Tinggalkan Ruangan</span>
        </button>
      </div>
    </div>
  );
};

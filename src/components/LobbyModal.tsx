import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, LogIn, Bot, Copy, Check, Sparkles, Flame } from 'lucide-react';
import type { GameType } from '../server/roomManager.ts';

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (hostName: string, maxPlayers: number, gameType: GameType) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onPlayOffline: () => void;
  initialRoomCode?: string;
  defaultGameType?: GameType;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  onJoinRoom,
  onPlayOffline,
  initialRoomCode = '',
  defaultGameType = 'classic',
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'offline'>(
    initialRoomCode ? 'join' : 'create'
  );
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('gaple_player_name') || 'Pemain 1';
  });
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [gameType, setGameType] = useState<GameType>(defaultGameType);

  useEffect(() => {
    if (defaultGameType) {
      setGameType(defaultGameType);
    }
  }, [defaultGameType]);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  const savePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('gaple_player_name', name);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-2xl shadow-lg mb-2">
            🁆
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">
            LOBBY GAPLE MULTIPLAYER
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Main bareng teman secara online atau latihan vs bot
          </p>
        </div>

        {/* Player Name Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Nama Panggilan Anda:
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => savePlayerName(e.target.value)}
            placeholder="Contoh: Budi Jagoan"
            maxLength={18}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle size={15} />
            <span>Buat Room</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'join'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn size={15} />
            <span>Gabung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('offline')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer ${
              activeTab === 'offline'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot size={15} />
            <span>Vs Bot</span>
          </button>
        </div>

        {/* Tab 1: Create Room */}
        {activeTab === 'create' && (
          <div className="space-y-4 animate-fade-in">
            {/* Game Mode Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Pilih Mode Permainan:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGameType('classic')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer text-center ${
                    gameType === 'classic'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="text-base">🁆</span>
                  <span>Gaple Klasik</span>
                  <span className="text-[10px] font-normal text-slate-400">28 Kartu Standar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameType('nlgg')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer text-center ${
                    gameType === 'nlgg'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Flame size={16} className="text-amber-400" />
                  <span>Ala NLGG</span>
                  <span className="text-[10px] font-normal text-slate-400">56 Kartu • Blind Pick/Trade</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Kapasitas Meja:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaxPlayers(4)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    maxPlayers === 4
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <Users size={14} />
                  <span>4 Pemain (Standar)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMaxPlayers(2)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    maxPlayers === 2
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <Users size={14} />
                  <span>2 Pemain (Duel)</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCreateRoom(playerName, maxPlayers, gameType)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg ring-2 ring-emerald-400/40 cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle size={16} />
              <span>Buat Meja & Dapatkan Kode</span>
            </button>
          </div>
        )}

        {/* Tab 2: Join Room */}
        {activeTab === 'join' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Masukkan Kode Room (6 Karakter):
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="CONTOH: GAP123"
                maxLength={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold tracking-widest text-center text-amber-300 placeholder:text-slate-600 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>

            <button
              type="button"
              disabled={roomCode.trim().length < 4}
              onClick={() => onJoinRoom(roomCode, playerName)}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3 rounded-xl text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn size={16} />
              <span>Gabung ke Meja Teman</span>
            </button>
          </div>
        )}

        {/* Tab 3: Play Offline */}
        {activeTab === 'offline' && (
          <div className="space-y-4 animate-fade-in text-center">
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              Main solo langsung di browser tanpa koneksi internet melawan 3 AI bot cerdas (Siti, Joko, Rian).
            </p>
            <button
              type="button"
              onClick={onPlayOffline}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-sm transition shadow cursor-pointer flex items-center justify-center gap-2"
            >
              <Bot size={16} />
              <span>Mulai Main vs Bot</span>
            </button>
          </div>
        )}

        {/* Cancel / Close button if already in game */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300 py-1.5 transition text-center"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

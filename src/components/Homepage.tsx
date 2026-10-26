import React, { useState, useEffect } from 'react';
import type { GameType } from '../server/roomManager.ts';
import {
  Users,
  PlusCircle,
  LogIn,
  Bot,
  Zap,
  ShieldCheck,
  MessageSquare,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  Share2,
  Check,
  HelpCircle,
  Radio,
  Gamepad2,
  Flame,
  Award,
  Trophy,
} from 'lucide-react';
import { DominoTile } from './DominoTile.tsx';

interface HomepageProps {
  onPlayOffline: (playerName: string, maxPlayers?: number, targetScore?: number) => void;
  onPlayNLGG: (playerName: string, maxPlayers?: number, targetScore?: number) => void;
  onCreateOnlineRoom: (
    playerName: string,
    maxPlayers: number,
    gameType?: GameType,
    targetScore?: number
  ) => void;
  onJoinOnlineRoom: (roomCode: string, playerName: string) => void;
  onOpenRules: () => void;
  initialRoomCode?: string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

const AVATARS = [
  { id: 'cool', emoji: '😎', label: 'Bos Gaple' },
  { id: 'cowboy', emoji: '🤠', label: 'Koboi Domino' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja Balak' },
  { id: 'coffee', emoji: '☕', label: 'Santai' },
  { id: 'fire', emoji: '🔥', label: 'Juara' },
];

export const Homepage: React.FC<HomepageProps> = ({
  onPlayOffline,
  onPlayNLGG,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenRules,
  initialRoomCode = '',
  soundEnabled = true,
  onToggleSound,
}) => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('gaple_player_name') || 'Pemain 1';
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem('gaple_player_avatar') || '😎';
  });
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [createMaxPlayers, setCreateMaxPlayers] = useState<number>(4);
  const [createGameType, setCreateGameType] = useState<GameType>('classic');
  const [createTargetScore, setCreateTargetScore] = useState<number>(100);
  const [isCreateCustomScore, setIsCreateCustomScore] = useState(false);
  const [createCustomScoreInput, setCreateCustomScoreInput] = useState('100');

  const [soloMaxPlayers, setSoloMaxPlayers] = useState<number>(4);
  const [soloGameType, setSoloGameType] = useState<GameType>('classic');
  const [soloTargetScore, setSoloTargetScore] = useState<number>(100);
  const [isSoloCustomScore, setIsSoloCustomScore] = useState(false);
  const [soloCustomScoreInput, setSoloCustomScoreInput] = useState('100');

  const [copiedLink, setCopiedLink] = useState(false);

  const handleScoreInput = (
    valStr: string,
    setScore: (n: number) => void,
    setInputStr: (s: string) => void
  ) => {
    const clean = valStr.replace(/\D/g, '');
    if (!clean) {
      setInputStr('');
      setScore(100);
      return;
    }
    const num = parseInt(clean, 10);
    const clamped = Math.min(999, num);
    setInputStr(String(clamped));
    setScore(clamped);
  };

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode.toUpperCase());
    }
  }, [initialRoomCode]);

  const handleNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('gaple_player_name', name);
  };

  const handleAvatarSelect = (emoji: string) => {
    setSelectedAvatar(emoji);
    localStorage.setItem('gaple_player_avatar', emoji);
  };

  const handleShareWebsite = () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({
        title: 'Gaple Online - Domino Tradisional Indonesia',
        text: 'Ayo main Gaple bareng aku langsung di browser! Tanpa download.',
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <nav className="relative z-10 max-w-6xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between border-b border-slate-800/60 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-lg sm:text-xl font-black text-amber-300 shadow-lg shadow-emerald-900/30 shrink-0">
            🁆
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-black text-sm sm:text-base md:text-lg tracking-wider text-white truncate">
                GAPLE ONLINE
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <Radio size={9} className="animate-pulse" />
                <span className="hidden sm:inline">Live Server</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block truncate">
              Platform Domino Tradisional Indonesia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer"
              title={soundEnabled ? 'Matikan Suara (Mute)' : 'Nyalakan Suara (Unmute)'}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-rose-400" />}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition cursor-pointer"
            title="Cara Bermain"
          >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">Cara Bermain</span>
          </button>

          <button
            type="button"
            onClick={handleShareWebsite}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
          >
            <Share2 size={13} />
            <span className="text-xs">{copiedLink ? 'Tersalin!' : 'Bagikan'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-3 sm:px-4 py-6 sm:py-8 flex flex-col gap-10 sm:gap-12 overflow-x-hidden">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-4">
          <div className="flex-1 text-center lg:text-left space-y-4">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xs">
              <Sparkles size={14} className="text-amber-400" />
              <span>Sensasi Main Gaple Tongkrongan Modern</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Main Gaple Bareng Teman,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                Langsung di Browser!
              </span>
            </h1>

            {/* Quick Player Profile Selector */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl max-w-md mx-auto lg:mx-0 shadow-xl backdrop-blur-md">
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Profil Pemain Anda:
              </label>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl p-2 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
                  {selectedAvatar}
                </span>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Masukkan nama Anda..."
                  maxLength={18}
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Pilih Avatar:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {AVATARS.map(av => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleAvatarSelect(av.emoji)}
                      className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                        selectedAvatar === av.emoji
                          ? 'bg-emerald-600 text-white scale-110 shadow-md ring-2 ring-emerald-400'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                      }`}
                      title={av.label}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Floating Dominos Visual Showcase */}
          <div className="flex-1 flex justify-center items-center relative py-4 lg:py-0 overflow-hidden">
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 flex items-center justify-center scale-90 sm:scale-100">
              {/* Outer decorative ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-emerald-600/30 animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-4 rounded-full border border-slate-800/80" />

              {/* Center Balak [6|6] */}
              <div className="absolute z-20 hover:scale-110 transition-transform duration-300 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                <DominoTile tile={[6, 6]} size="lg" orientation="vertical" />
              </div>

              {/* Surrounding Domino Tiles */}
              <div className="absolute top-2 left-6 -rotate-12 z-10 hover:scale-105 transition-transform duration-200">
                <DominoTile tile={[5, 5]} size="md" orientation="horizontal" />
              </div>

              <div className="absolute bottom-4 right-4 rotate-12 z-10 hover:scale-105 transition-transform duration-200">
                <DominoTile tile={[3, 4]} size="md" orientation="vertical" />
              </div>

              <div className="absolute top-8 right-6 rotate-45 z-0 opacity-85">
                <DominoTile tile={[0, 0]} size="sm" orientation="vertical" />
              </div>

              <div className="absolute bottom-6 left-8 -rotate-45 z-0 opacity-85">
                <DominoTile tile={[2, 5]} size="sm" orientation="horizontal" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Game Mode Cards Grid */}
        <div>
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Pilih Mode Permainan
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Main solo latihan atau adu taktik bersama teman Anda
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Mode 1: Offline vs AI */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-6 rounded-3xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bot size={24} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-black text-white">Latihan Solo vs AI</h3>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                    Instan
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Tantang AI bot cerdas dengan prioritas langkah alami. Bebas atur jumlah pemain dan target skor untuk asah taktik.
                </p>

                {/* Game mode choice */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Mode Permainan:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSoloGameType('classic')}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        soloGameType === 'classic'
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <span>🁆 Klasik</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoloGameType('nlgg')}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        soloGameType === 'nlgg'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <Flame size={12} className="text-amber-400" />
                      <span>Ala NLGG</span>
                    </button>
                  </div>
                </div>

                {/* Capacity choice */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Kapasitas Meja:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[2, 3, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSoloMaxPlayers(num)}
                        className={`py-1.5 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          soloMaxPlayers === num
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <Users size={12} />
                        <span>{num} Pemain</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Score choice */}
                <div className="mb-6">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Target Skor Kemenangan:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[50, 100, 150].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSoloTargetScore(val);
                          setIsSoloCustomScore(false);
                        }}
                        className={`py-1 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          !isSoloCustomScore && soloTargetScore === val
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <span>{val}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsSoloCustomScore(true)}
                      className={`py-1 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        isSoloCustomScore
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <span>Bebas</span>
                    </button>
                  </div>

                  {isSoloCustomScore && (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={soloCustomScoreInput}
                        onChange={e =>
                          handleScoreInput(
                            e.target.value,
                            setSoloTargetScore,
                            setSoloCustomScoreInput
                          )
                        }
                        placeholder="Ketik skor"
                        className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-400"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  soloGameType === 'nlgg'
                    ? onPlayNLGG(playerName, soloMaxPlayers, soloTargetScore)
                    : onPlayOffline(playerName, soloMaxPlayers, soloTargetScore)
                }
                className="w-full bg-slate-800 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2 group-hover:bg-indigo-600"
              >
                <Gamepad2 size={16} />
                <span>Mulai Main vs Bot</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Mode 2: Create Online Room (Host) */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 hover:border-emerald-400 p-6 rounded-3xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                Populer
              </div>

              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <PlusCircle size={24} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-black text-white">Buat Meja Privat</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Bikin ruangan meja privat dengan kode 6 karakter. Dapatkan tautan undangan instan untuk dibagikan ke teman Anda.
                </p>

                {/* Game mode choice */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Mode Permainan:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateGameType('classic')}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        createGameType === 'classic'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <span>🁆 Klasik</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateGameType('nlgg')}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        createGameType === 'nlgg'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <Flame size={12} className="text-amber-400" />
                      <span>Ala NLGG</span>
                    </button>
                  </div>
                </div>

                {/* Capacity choice (2 - 4 players) */}
                <div className="mb-3">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Kapasitas Meja:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[2, 3, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCreateMaxPlayers(num)}
                        className={`py-1.5 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          createMaxPlayers === num
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <Users size={12} />
                        <span>{num} Pemain</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Score choice (50, 100, 150, Bebas) */}
                <div className="mb-6">
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Target Skor Kemenangan:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[50, 100, 150].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setCreateTargetScore(val);
                          setIsCreateCustomScore(false);
                        }}
                        className={`py-1 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                          !isCreateCustomScore && createTargetScore === val
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        <span>{val}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCreateCustomScore(true)}
                      className={`py-1 px-1 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                        isCreateCustomScore
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <span>Bebas</span>
                    </button>
                  </div>

                  {isCreateCustomScore && (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={createCustomScoreInput}
                        onChange={e =>
                          handleScoreInput(
                            e.target.value,
                            setCreateTargetScore,
                            setCreateCustomScoreInput
                          )
                        }
                        placeholder="Ketik skor"
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-bold focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCreateOnlineRoom(
                    playerName,
                    createMaxPlayers,
                    createGameType,
                    createTargetScore
                  )
                }
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm transition shadow-lg ring-2 ring-emerald-400/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle size={16} />
                <span>Bikin Meja & Dapatkan Kode</span>
                <ArrowRight size={15} />
              </button>
            </div>

            {/* Mode 3: Quick Join with Room Code */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-6 rounded-3xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LogIn size={24} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-black text-white">Gabung Meja Teman</h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                    Kode Meja
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Punya kode ruangan dari teman Anda? Masukkan kode 6 karakter di bawah untuk langsung bergabung ke meja permainan.
                </p>

                {/* Direct Code Input on Homepage */}
                <div className="mb-6">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="KODE: GAP889"
                    maxLength={6}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center font-mono font-bold tracking-widest text-amber-300 text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={joinCode.trim().length < 4}
                onClick={() => onJoinOnlineRoom(joinCode, playerName)}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3 px-4 rounded-2xl text-xs sm:text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn size={16} />
                <span>Masuk ke Meja</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Why Play Here? (Feature Highlights) */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-lg sm:text-2xl font-black text-white">
              Kenapa Main di Gaple Online?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Dirancang dengan standar kenyamanan bermain domino terbaik untuk Anda
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950/70 border border-slate-800/60 rounded-2xl flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Zap size={18} />
              </div>
              <h4 className="font-bold text-sm text-slate-200">Zero-Install Web</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Langsung main di browser HP & laptop tanpa perlu unduh aplikasi dari Play Store / App Store.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800/60 rounded-2xl flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck size={18} />
              </div>
              <h4 className="font-bold text-sm text-slate-200">Adil & Anti-Cheat</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Logika server-authoritative memastikan lawan tidak dapat mengintip kartu kartu Anda.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800/60 rounded-2xl flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <MessageSquare size={18} />
              </div>
              <h4 className="font-bold text-sm text-slate-200">Chat Tongkrongan</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Preset pesan cepat khas gaple (*"Gas jalan!"*, *"Buntu nih!"*, *"Awas balak!"*) melayang di meja.
              </p>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800/60 rounded-2xl flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <Volume2 size={18} />
              </div>
              <h4 className="font-bold text-sm text-slate-200">Audio Kartu Realistis</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sensasi suara benturan kartu domino kayu otentik sintetis via Web Audio API.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Rules Summary */}
        <div className="border border-slate-800/80 bg-slate-900/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-lg font-black text-white">
              Belum pernah main Gaple sebelumnya?
            </h3>
            <p className="text-xs text-slate-400 max-w-lg">
              Pelajari aturan dasar pembagian kartu balak, penyambungan rantai domino, hingga penentuan pemenang Gaple & Buntu.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRules}
            className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm py-2.5 px-5 rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-2"
          >
            <HelpCircle size={16} />
            <span>Baca Panduan Aturan Lengkap</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Gaple Online. Dibuat untuk pecinta domino Indonesia.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenRules}
              className="hover:text-slate-300 transition"
            >
              Aturan Permainan
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={handleShareWebsite}
              className="hover:text-slate-300 transition"
            >
              Undang Teman
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

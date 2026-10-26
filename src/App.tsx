import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  createGame,
  playMove as localPlayMove,
  passTurn as localPassTurn,
  startNextRound as localStartNextRound,
} from './engine.ts';
import { getAvailableMoves, getTilePlayableEnds } from './board.ts';
import type { GameState, Tile, EndSide, ClientPlayerView, ClientGameState } from './types.ts';
import type { ClientNLGGState } from './nlgg/types.ts';
import type { RoomPlayer, ChatMessage, GameType } from './server/roomManager.ts';
import { GameBoard } from './components/GameBoard.tsx';
import { PlayerSeat } from './components/PlayerSeat.tsx';
import { MyHand } from './components/MyHand.tsx';
import { RoundResultModal } from './components/RoundResultModal.tsx';
import { LobbyModal } from './components/LobbyModal.tsx';
import { WaitingRoom } from './components/WaitingRoom.tsx';
import { QuickChat } from './components/QuickChat.tsx';
import { ExitConfirmModal } from './components/ExitConfirmModal.tsx';
import { Homepage } from './components/Homepage.tsx';
import { RulesModal } from './components/RulesModal.tsx';
import { NLGGGameView } from './components/NLGGGameView.tsx';
import { playTileClack, playPassSound } from './utils/audio.ts';
import { socket } from './services/socket.ts';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  HelpCircle,
  X,
  Swords,
  Users,
  Copy,
  Check,
  Globe,
  Radio,
  LogOut,
} from 'lucide-react';

export function App() {
  const [, startTransition] = useTransition();

  // Current View: 'home' | 'game' | 'nlgg'
  const [currentView, setCurrentView] = useState<'home' | 'game' | 'nlgg'>('home');
  const [nlggPlayerName, setNlggPlayerName] = useState(() => {
    return localStorage.getItem('gaple_player_name') || 'Anda (P1)';
  });

  // Mode: 'offline' (vs Bots) | 'online' (Socket.io Room)
  const [gameMode, setGameMode] = useState<'offline' | 'online'>('offline');
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [initialInviteRoom, setInitialInviteRoom] = useState<string>('');

  // Online Room State
  const [onlineRoom, setOnlineRoom] = useState<{
    code: string;
    hostSocketId: string;
    players: RoomPlayer[];
    maxPlayers: number;
    gameType: GameType;
    targetScore?: number;
    status: 'waiting' | 'playing';
  } | null>(null);

  const [selectedTargetScore, setSelectedTargetScore] = useState<number>(100);
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState<number>(4);

  const [onlineGameState, setOnlineGameState] = useState<ClientGameState | null>(null);
  const [onlineNLGGState, setOnlineNLGGState] = useState<ClientNLGGState | null>(null);
  const [activeChatBubbles, setActiveChatBubbles] = useState<Record<string, string>>({});
  const [copiedHeaderCode, setCopiedHeaderCode] = useState(false);

  // Local Offline State (vs 3 bots)
  const localPlayerNames = ['Anda (P1)', 'Bot Siti', 'Bot Joko', 'Bot Rian'];
  const [localGame, setLocalGame] = useState<GameState>(() => {
    const g = createGame(localPlayerNames);
    return { ...g, status: 'waiting' };
  });

  // Sound & UI Settings
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('gaple_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('gaple_sound_enabled', String(next));
      return next;
    });
  }, []);

  // Shared Interaction State
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [selectableEnds, setSelectableEnds] = useState<EndSide[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(15);

  // Determine current active player and views based on mode
  const isOnline = gameMode === 'online' && onlineRoom !== null;
  const isWaitingRoom = isOnline && onlineRoom?.status === 'waiting';

  // Find My Player ID
  const myPlayerId = isOnline
    ? onlineRoom?.players.find(p => p.socketId === socket.id)?.id || 'p-1'
    : 'p-1';

  // Active game reference
  const currentBoard = isOnline ? onlineGameState?.board : localGame.board;
  const currentStatus = isOnline ? onlineGameState?.status : localGame.status;
  const currentRoundNumber = isOnline ? (onlineGameState?.roundNumber ?? 1) : localGame.roundNumber;
  const currentRoundResult = isOnline ? onlineGameState?.roundResult : localGame.roundResult;

  const currentPlayerId = isOnline
    ? onlineGameState?.currentPlayerId
    : localGame.players[localGame.currentPlayerIndex]?.id;

  const isMyTurn = currentPlayerId === myPlayerId && currentStatus === 'in_progress';

  // My Hand
  const myHand: Tile[] = isOnline
    ? onlineGameState?.players.find(p => p.id === myPlayerId)?.hand || []
    : localGame.players.find(p => p.id === myPlayerId)?.hand || [];

  const myValidMoves = isMyTurn && currentBoard ? getAvailableMoves(myHand, currentBoard) : [];

  // Execute Move (Offline or Online)
  const handleExecuteMove = useCallback(
    (tile: Tile, end: EndSide) => {
      if (soundEnabled) playTileClack();
      setSelectedTile(null);
      setSelectableEnds([]);

      if (isOnline && onlineRoom) {
        socket.emit('play_move', {
          roomCode: onlineRoom.code,
          tile,
          targetEnd: end,
        });
      } else {
        setLocalGame(prev => {
          const active = prev.players[prev.currentPlayerIndex];
          if (!active || active.id !== 'p-1' || prev.status !== 'in_progress') {
            return prev;
          }
          try {
            return localPlayMove(prev, 'p-1', tile, end);
          } catch (err) {
            console.warn('Invalid player move ignored:', err);
            return prev;
          }
        });
      }
    },
    [soundEnabled, isOnline, onlineRoom]
  );

  // Pass Turn (Offline or Online)
  const handlePass = useCallback(() => {
    if (!isMyTurn) return;
    if (soundEnabled) playPassSound();

    if (isOnline && onlineRoom) {
      socket.emit('pass_turn', { roomCode: onlineRoom.code });
    } else {
      setLocalGame(prev => {
        const active = prev.players[prev.currentPlayerIndex];
        if (!active || active.id !== 'p-1' || prev.status !== 'in_progress') {
          return prev;
        }
        try {
          return localPassTurn(prev, 'p-1');
        } catch (err) {
          console.warn('Invalid player pass ignored:', err);
          return prev;
        }
      });
    }
  }, [isMyTurn, soundEnabled, isOnline, onlineRoom]);

  // Tile Selection Handler
  const handleSelectTile = useCallback(
    (tile: Tile) => {
      if (!isMyTurn || !currentBoard) return;

      const validEnds = getTilePlayableEnds(tile, currentBoard);
      if (validEnds.length === 0) return;

      // On empty board or if only 1 end is playable, play immediately!
      if (validEnds.length === 1 || currentBoard.chain.length === 0) {
        handleExecuteMove(tile, validEnds[0] || 'left');
      } else {
        // If clicking the already selected tile, default to playing it to the first valid end
        if (selectedTile && areTilesEqual(selectedTile, tile)) {
          handleExecuteMove(tile, validEnds[0]);
        } else {
          setSelectedTile(tile);
          setSelectableEnds(validEnds);
        }
      }
    },
    [isMyTurn, currentBoard, selectedTile, handleExecuteMove]
  );

  // Check URL query parameters for invite link: ?room=ABC123
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setInitialInviteRoom(roomParam.toUpperCase());
        setShowLobbyModal(true);
      }
    }
  }, []);

  // Socket.io Event Listeners
  useEffect(() => {
    function onRoomUpdate(room: any) {
      if (room?.players && !room.players.some((p: any) => p.socketId === socket.id)) {
        return;
      }
      setOnlineRoom(room);
      if (room.gameType === 'nlgg') {
        setCurrentView('nlgg');
      } else if (room.status === 'playing') {
        setCurrentView('game');
      }
    }

    function onGameUpdate(clientState: ClientGameState) {
      setOnlineGameState(clientState);
    }

    function onNLGGGameUpdate(clientState: ClientNLGGState) {
      setOnlineNLGGState(clientState);
    }

    function onChatReceived(msg: ChatMessage) {
      if (soundEnabled && (currentView === 'game' || currentView === 'nlgg')) playPassSound();
      setActiveChatBubbles(prev => ({ ...prev, [msg.senderId]: msg.text }));

      // Remove bubble after 4 seconds
      setTimeout(() => {
        setActiveChatBubbles(prev => {
          const next = { ...prev };
          delete next[msg.senderId];
          return next;
        });
      }, 4000);
    }

    socket.on('room_update', onRoomUpdate);
    socket.on('game_update', onGameUpdate);
    socket.on('nlgg_game_update', onNLGGGameUpdate);
    socket.on('chat_received', onChatReceived);

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.off('game_update', onGameUpdate);
      socket.off('nlgg_game_update', onNLGGGameUpdate);
      socket.off('chat_received', onChatReceived);
    };
  }, [soundEnabled, currentView]);

  // Turn Countdown Timer
  useEffect(() => {
    if (currentView !== 'game') return; // Do not run timer on homepage!
    if (!isMyTurn || currentStatus !== 'in_progress') return;

    if (timerSeconds <= 0) {
      // Time's up: Auto-play first valid move or auto-pass
      if (myValidMoves.length > 0) {
        const move = myValidMoves[0];
        handleExecuteMove(move.tile, move.targetEnds[0]);
      } else {
        handlePass();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimerSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentView, isMyTurn, currentStatus, timerSeconds, myValidMoves, handleExecuteMove, handlePass]);

  // Reset selection on turn change
  useEffect(() => {
    setTimerSeconds(15);
    setSelectedTile(null);
    setSelectableEnds([]);
  }, [currentPlayerId, currentStatus]);

  // Offline AI Bot Turn Simulation
  useEffect(() => {
    if (currentView !== 'game') return; // Do not run bot simulation on homepage!
    if (isOnline) return; // In online mode, server handles bot turns!
    if (localGame.status !== 'in_progress') return;

    const currentLocalPlayer = localGame.players[localGame.currentPlayerIndex];
    if (currentLocalPlayer && currentLocalPlayer.id !== 'p-1') {
      const timer = setTimeout(() => {
        const moves = getAvailableMoves(currentLocalPlayer.hand, localGame.board);

        startTransition(() => {
          if (moves.length > 0) {
            const chosenMove = moves.reduce((prev, current) => {
              const prevSum = prev.tile[0] + prev.tile[1];
              const currSum = current.tile[0] + current.tile[1];
              return currSum > prevSum ? current : prev;
            }, moves[0]);

            const targetEnd = chosenMove.targetEnds[0];
            if (soundEnabled) playTileClack();
            setLocalGame(prev => {
              const active = prev.players[prev.currentPlayerIndex];
              if (!active || active.id !== currentLocalPlayer.id || prev.status !== 'in_progress') {
                return prev;
              }
              try {
                return localPlayMove(prev, currentLocalPlayer.id, chosenMove.tile, targetEnd);
              } catch (err) {
                console.warn('Bot move error ignored:', err);
                return prev;
              }
            });
          } else {
            if (soundEnabled) playPassSound();
            setLocalGame(prev => {
              const active = prev.players[prev.currentPlayerIndex];
              if (!active || active.id !== currentLocalPlayer.id || prev.status !== 'in_progress') {
                return prev;
              }
              try {
                return localPassTurn(prev, currentLocalPlayer.id);
              } catch (err) {
                console.warn('Bot pass error ignored:', err);
                return prev;
              }
            });
          }
        });
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [isOnline, localGame, soundEnabled]);

  // Next Round Handler
  const handleNextRound = () => {
    if (isOnline && onlineRoom) {
      socket.emit('next_round', { roomCode: onlineRoom.code });
    } else {
      setLocalGame(prev => localStartNextRound(prev));
    }
  };

  // Restart Offline Match
  const handleRestartOffline = () => {
    const customName = nlggPlayerName?.trim() || 'Anda (P1)';
    const botNames = ['Bot Siti', 'Bot Joko', 'Bot Rian'];
    const total = Math.min(4, Math.max(2, selectedMaxPlayers));
    const names = [customName];
    for (let i = 1; i < total; i++) {
      names.push(botNames[i - 1] || `Bot ${i}`);
    }
    setLocalGame(createGame(names, { maxPenaltyPoints: selectedTargetScore }));
  };

  // Online Room Actions
  const handleStartOfflineGame = (
    playerName: string,
    maxPlayers: number = 4,
    targetScore: number = 100
  ) => {
    setSelectedTargetScore(targetScore);
    setSelectedMaxPlayers(maxPlayers);
    const customName = playerName?.trim() || 'Anda (P1)';
    const botNames = ['Bot Siti', 'Bot Joko', 'Bot Rian'];
    const total = Math.min(4, Math.max(2, maxPlayers));
    const names = [customName];
    for (let i = 1; i < total; i++) {
      names.push(botNames[i - 1] || `Bot ${i}`);
    }
    setLocalGame(createGame(names, { maxPenaltyPoints: targetScore }));
    setGameMode('offline');
    setCurrentView('game');
  };

  const handleStartNLGG = (
    playerName: string,
    maxPlayers: number = 4,
    targetScore: number = 100
  ) => {
    setSelectedTargetScore(targetScore);
    setSelectedMaxPlayers(maxPlayers);
    const customName = playerName?.trim() || 'Anda (P1)';
    setNlggPlayerName(customName);
    setGameMode('offline');
    setCurrentView('nlgg');
  };

  const handleCreateRoom = (
    hostName: string,
    maxPlayers: number = 4,
    gameType: GameType = 'classic',
    targetScore: number = 100
  ) => {
    setSelectedTargetScore(targetScore);
    setSelectedMaxPlayers(maxPlayers);
    socket.emit('create_room', { hostName, maxPlayers, gameType, targetScore }, (res: any) => {
      if (res.success) {
        setGameMode('online');
        setCurrentView(gameType === 'nlgg' ? 'nlgg' : 'game');
        setShowLobbyModal(false);
      } else {
        alert(res.error || 'Gagal membuat room.');
      }
    });
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    socket.emit('join_room', { roomCode, playerName }, (res: any) => {
      if (res.success) {
        setGameMode('online');
        const rType = res.room?.gameType || 'classic';
        setCurrentView(rType === 'nlgg' ? 'nlgg' : 'game');
        setShowLobbyModal(false);
      } else {
        alert(res.error || 'Gagal bergabung ke room.');
      }
    });
  };

  const handleAddBot = () => {
    if (onlineRoom) {
      socket.emit('add_bot', { roomCode: onlineRoom.code });
    }
  };

  const handleStartOnlineGame = () => {
    if (onlineRoom) {
      socket.emit('start_game', { roomCode: onlineRoom.code });
    }
  };

  const handleLeaveOnlineRoom = () => {
    if (onlineRoom) {
      socket.emit('leave_room', { roomCode: onlineRoom.code });
    }
    setOnlineRoom(null);
    setOnlineGameState(null);
    setOnlineNLGGState(null);
    setGameMode('offline');
    setLocalGame(prev => ({ ...prev, status: 'waiting' }));
    setCurrentView('home');
  };

  const handleConfirmExit = () => {
    setShowExitConfirmModal(false);
    if (isOnline) {
      handleLeaveOnlineRoom();
    } else {
      setLocalGame(prev => ({ ...prev, status: 'waiting' }));
    }
    setCurrentView('home');
  };

  const handleSendQuickChat = (text: string) => {
    if (isOnline && onlineRoom) {
      socket.emit('send_chat', { roomCode: onlineRoom.code, text });
    } else {
      // Local demo bubble for Player 1
      setActiveChatBubbles(prev => ({ ...prev, 'p-1': text }));
      setTimeout(() => {
        setActiveChatBubbles(prev => {
          const next = { ...prev };
          delete next['p-1'];
          return next;
        });
      }, 4000);
    }
  };

  const handleCopyHeaderCode = () => {
    if (onlineRoom) {
      navigator.clipboard.writeText(onlineRoom.code);
      setCopiedHeaderCode(true);
      setTimeout(() => setCopiedHeaderCode(false), 2000);
    }
  };

  // Map opponent seats based on active player list
  const activePlayers: ClientPlayerView[] = isOnline
    ? onlineGameState?.players || []
    : localGame.players.map(p => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        hand: localGame.status === 'round_ended' || localGame.status === 'game_over' ? p.hand : undefined,
        score: p.score,
      }));

  // Filter out my player to place opponents around the table
  const myPlayer = activePlayers.find(p => p.id === myPlayerId);
  const myScore = myPlayer?.score || 0;
  const currentTargetScore = isOnline ? onlineGameState?.targetScore || 100 : localGame.maxPenaltyPoints;
  const opponents = activePlayers.filter(p => p.id !== myPlayerId);
  const topOpponent = opponents.length === 1 ? opponents[0] : (opponents.length >= 2 ? opponents[1] : null);
  const leftOpponent = opponents.length > 1 ? opponents[0] : null;
  const rightOpponent = opponents.length >= 3 ? opponents[2] : null;

  // Render Homepage if not in a game
  if (currentView === 'home') {
    return (
      <>
        <Homepage
          onPlayOffline={handleStartOfflineGame}
          onPlayNLGG={handleStartNLGG}
          onCreateOnlineRoom={handleCreateRoom}
          onJoinOnlineRoom={handleJoinRoom}
          onOpenRules={() => setShowRulesModal(true)}
          initialRoomCode={initialInviteRoom}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
        />

        {/* Rules Guide Modal */}
        <RulesModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
        />
      </>
    );
  }

  // Render Special Mode "Ala NLGG" if active
  if (currentView === 'nlgg') {
    if (isOnline && onlineRoom && onlineRoom.status === 'waiting') {
      return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between p-2 sm:p-4 md:p-6 max-w-6xl mx-auto select-none">
          <header className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md">
            <div
              onClick={() => setShowExitConfirmModal(true)}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
              title="Kembali ke Beranda"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 shadow shrink-0">
                🔥
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide text-white">
                    ALA NLGG MULTIPLAYER
                  </h1>
                  <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold">
                    <Radio size={9} className="animate-pulse" /> ONLINE
                  </span>
                </div>
                <p className="text-[10px] text-amber-400 font-medium">
                  Room: <b>{onlineRoom.code}</b>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowExitConfirmModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </header>

          <WaitingRoom
            roomCode={onlineRoom.code}
            players={onlineRoom.players}
            maxPlayers={onlineRoom.maxPlayers}
            gameType={onlineRoom.gameType}
            targetScore={onlineRoom.targetScore}
            isHost={onlineRoom.hostSocketId === socket.id}
            onStartGame={handleStartOnlineGame}
            onAddBot={handleAddBot}
            onLeaveRoom={handleLeaveOnlineRoom}
          />

          <ExitConfirmModal
            isOpen={showExitConfirmModal}
            onClose={() => setShowExitConfirmModal(false)}
            onConfirmExit={handleConfirmExit}
            isOnline={true}
            roomCode={onlineRoom.code}
          />
        </div>
      );
    }

    return (
      <NLGGGameView
        playerName={nlggPlayerName}
        onExit={handleConfirmExit}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        isOnline={isOnline}
        roomCode={onlineRoom?.code}
        onlineState={onlineNLGGState}
        myOnlinePlayerId={myPlayerId}
        isHost={onlineRoom?.hostSocketId === socket.id}
        targetScore={isOnline ? onlineRoom?.targetScore || 100 : selectedTargetScore}
        maxPlayers={isOnline ? onlineRoom?.maxPlayers || 4 : selectedMaxPlayers}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between p-2 sm:p-4 md:p-6 max-w-6xl mx-auto select-none">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-2.5 sm:px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md">
        <div
          onClick={() => setShowExitConfirmModal(true)}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          title="Kembali ke Beranda"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-amber-300 shadow group-hover:scale-105 transition-transform shrink-0">
            🁆
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide text-white group-hover:text-emerald-300 transition-colors">
                NLGGAPLE
              </h1>
              {isOnline ? (
                <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold">
                  <Radio size={9} className="animate-pulse" /> ONLINE
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-400 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold">
                  VS BOT
                </span>
              )}
            </div>

            {isOnline && onlineRoom ? (
              <button
                type="button"
                onClick={handleCopyHeaderCode}
                className="text-[10px] sm:text-[11px] text-amber-300 font-mono flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Room: <b>{onlineRoom.code}</b></span>
                {copiedHeaderCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
            ) : (
              <p className="text-[10px] text-emerald-400 font-medium">
                Ronde {currentRoundNumber} • Target: {currentTargetScore} Poin
              </p>
            )}
          </div>
        </div>

        {/* Top Control Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Chat Button */}
          <QuickChat onSendMessage={handleSendQuickChat} />

          {/* Mode Switcher / Multiplayer Lobby Button */}
          <button
            type="button"
            onClick={() => setShowLobbyModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
            title="Pilih Meja Multiplayer"
          >
            <Users size={14} />
            <span className="hidden sm:inline">
              {isOnline ? 'Ganti Meja' : 'Main Bareng Teman'}
            </span>
          </button>

          {/* Exit Match Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirmModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
            title="Keluar dari Pertandingan"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Keluar</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title={soundEnabled ? 'Matikan Suara (Mute)' : 'Nyalakan Suara (Unmute)'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-rose-400" />}
          </button>

          {/* Rules Guide Modal */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Panduan Aturan Main"
          >
            <HelpCircle size={16} />
          </button>

          {/* Restart Local Game (Offline only) */}
          {!isOnline && (
            <button
              type="button"
              onClick={handleRestartOffline}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700/60 transition cursor-pointer"
              title="Reset Game Offline"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area: Waiting Room or Game Table */}
      {isWaitingRoom && onlineRoom ? (
        <WaitingRoom
          roomCode={onlineRoom.code}
          players={onlineRoom.players}
          maxPlayers={onlineRoom.maxPlayers}
          gameType={onlineRoom.gameType}
          targetScore={onlineRoom.targetScore}
          isHost={onlineRoom.hostSocketId === socket.id}
          onStartGame={handleStartOnlineGame}
          onAddBot={handleAddBot}
          onLeaveRoom={handleLeaveOnlineRoom}
        />
      ) : (
        <>
          {/* Main Table Layout */}
          <main className="flex-1 flex flex-col justify-between py-1 sm:py-3 gap-1.5 sm:gap-3 min-h-0">
            {/* Mobile Opponents Row: displayed side-by-side above board on small screens */}
            <div className="flex md:hidden items-center justify-around gap-1.5 px-0.5">
              {leftOpponent && (
                <PlayerSeat
                  player={leftOpponent}
                  isCurrentTurn={currentPlayerId === leftOpponent.id}
                  position="left"
                  showCards={currentStatus === 'round_ended'}
                  chatMessage={activeChatBubbles[leftOpponent.id]}
                  targetScore={currentTargetScore}
                />
              )}
              {topOpponent && (
                <PlayerSeat
                  player={topOpponent}
                  isCurrentTurn={currentPlayerId === topOpponent.id}
                  position="top"
                  showCards={currentStatus === 'round_ended'}
                  chatMessage={activeChatBubbles[topOpponent.id]}
                  targetScore={currentTargetScore}
                />
              )}
              {rightOpponent && (
                <PlayerSeat
                  player={rightOpponent}
                  isCurrentTurn={currentPlayerId === rightOpponent.id}
                  position="right"
                  showCards={currentStatus === 'round_ended'}
                  chatMessage={activeChatBubbles[rightOpponent.id]}
                  targetScore={currentTargetScore}
                />
              )}
            </div>

            {/* Desktop Top Opponent: Centered above board */}
            <div className="hidden md:flex justify-center relative">
              {topOpponent && (
                <PlayerSeat
                  player={topOpponent}
                  isCurrentTurn={currentPlayerId === topOpponent.id}
                  position="top"
                  showCards={currentStatus === 'round_ended'}
                  chatMessage={activeChatBubbles[topOpponent.id]}
                  targetScore={currentTargetScore}
                />
              )}
            </div>

            {/* Middle Row: Left Opponent + Center Board + Right Opponent */}
            <div className="flex-1 flex flex-col md:grid md:grid-cols-[140px_1fr_140px] gap-2 md:gap-3 items-center min-h-0">
              {/* Left Opponent (Desktop) */}
              <div className="hidden md:flex justify-start">
                {leftOpponent ? (
                  <PlayerSeat
                    player={leftOpponent}
                    isCurrentTurn={currentPlayerId === leftOpponent.id}
                    position="left"
                    showCards={currentStatus === 'round_ended'}
                    chatMessage={activeChatBubbles[leftOpponent.id]}
                    targetScore={currentTargetScore}
                  />
                ) : (
                  <div />
                )}
              </div>

              {/* Center Felt Board */}
              {currentBoard && (
                <GameBoard
                  board={currentBoard}
                  selectableEnds={selectableEnds}
                  onSelectEnd={end => {
                    if (selectedTile) handleExecuteMove(selectedTile, end);
                  }}
                  drawPoolCount={
                    (isOnline ? (onlineGameState?.boneyardCount ?? 0) : localGame.boneyard.length) > 0
                      ? isOnline ? (onlineGameState?.boneyardCount ?? 0) : localGame.boneyard.length
                      : undefined
                  }
                />
              )}

              {/* Right Opponent (Desktop) */}
              <div className="hidden md:flex justify-end">
                {rightOpponent ? (
                  <PlayerSeat
                    player={rightOpponent}
                    isCurrentTurn={currentPlayerId === rightOpponent.id}
                    position="right"
                    showCards={currentStatus === 'round_ended'}
                    chatMessage={activeChatBubbles[rightOpponent.id]}
                    targetScore={currentTargetScore}
                  />
                ) : (
                  <div />
                )}
              </div>
            </div>
          </main>

          {/* Bottom Area: User Hand */}
          <footer className="w-full relative">
            {/* My Chat Bubble */}
            {activeChatBubbles[myPlayerId] && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1 rounded-xl shadow-lg border border-amber-300 animate-bounce z-30">
                {activeChatBubbles[myPlayerId]}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-400" />
              </div>
            )}

            <MyHand
              hand={myHand}
              validMoves={myValidMoves}
              isMyTurn={isMyTurn}
              selectedTile={selectedTile}
              onSelectTile={handleSelectTile}
              onPass={handlePass}
              timerSeconds={timerSeconds}
              score={myScore}
              targetScore={currentTargetScore}
            />
          </footer>
        </>
      )}

      {/* Round Result Modal */}
      {(currentStatus === 'round_ended' || currentStatus === 'game_over') && (
        <RoundResultModal
          game={
            isOnline && onlineGameState
              ? {
                  id: onlineGameState.id,
                  players: onlineGameState.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    hand: p.hand || [],
                    score: p.score,
                  })),
                  currentPlayerIndex: 0,
                  board: onlineGameState.board,
                  boneyard: [],
                  status: onlineGameState.status,
                  consecutivePasses: 0,
                  turnTimeoutSeconds: 15,
                  maxPenaltyPoints: onlineGameState.targetScore || 100,
                  roundNumber: onlineGameState.roundNumber || 1,
                  roundResult: onlineGameState.roundResult,
                }
              : localGame
          }
          myPlayerId={myPlayerId}
          onNextRound={handleNextRound}
          onRestartGame={isOnline ? handleLeaveOnlineRoom : handleRestartOffline}
          onExitMatch={() => setShowExitConfirmModal(true)}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Exit Confirmation Modal */}
      <ExitConfirmModal
        isOpen={showExitConfirmModal}
        onClose={() => setShowExitConfirmModal(false)}
        onConfirmExit={handleConfirmExit}
        isOnline={isOnline}
        roomCode={onlineRoom?.code}
      />

      {/* Lobby / Multiplayer Modal */}
      <LobbyModal
        isOpen={showLobbyModal}
        initialRoomCode={initialInviteRoom}
        onClose={() => setShowLobbyModal(false)}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onPlayOffline={() => {
          setGameMode('offline');
          setShowLobbyModal(false);
        }}
      />

      {/* Rules Guide Modal */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}

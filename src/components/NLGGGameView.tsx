import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import type { EndSide, Tile } from '../types.ts';
import type {
  NLGGCard,
  NLGGState,
  DrawTurnResult,
  ClientNLGGState,
  ClientNLGGPlayer,
  ClientNLGGCard,
} from '../nlgg/types.ts';
import {
  createNLGGGame,
  blindPickCard,
  autoBlindPickAll,
  proposeTrade,
  respondTrade,
  skipTrade,
  executeRevealPhase,
  playMove as nlggPlayMove,
  drawTurn as nlggDrawTurn,
  passWhenPoolEmpty,
} from '../nlgg/engine.ts';
import { getAvailableMoves, getTilePlayableEnds, createEmptyBoard } from '../board.ts';
import { DominoTile } from './DominoTile.tsx';
import { GameBoard } from './GameBoard.tsx';
import { EndgameShowdown, type ShowdownPlayer } from './EndgameShowdown.tsx';
import { ExitConfirmModal } from './ExitConfirmModal.tsx';
import { RulesModal } from './RulesModal.tsx';
import { playTileClack, playPassSound } from '../utils/audio.ts';
import { socket } from '../services/socket.ts';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  ArrowRightLeft,
  Eye,
  LogOut,
  HelpCircle,
  Trophy,
  AlertOctagon,
  RotateCcw,
  Bot,
  User,
  Check,
  X,
  Layers,
  Flame,
  ArrowRight,
  ShieldAlert,
  Radio,
  Copy,
} from 'lucide-react';

export interface NLGGGameViewProps {
  playerName: string;
  onExit: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isOnline?: boolean;
  roomCode?: string;
  onlineState?: ClientNLGGState | null;
  myOnlinePlayerId?: string;
  isHost?: boolean;
  targetScore?: number;
  maxPlayers?: number;
}

export const NLGGGameView: React.FC<NLGGGameViewProps> = ({
  playerName,
  onExit,
  soundEnabled,
  onToggleSound,
  isOnline = false,
  roomCode = '',
  onlineState = null,
  myOnlinePlayerId = 'p-1',
  isHost = false,
  targetScore: initialTargetScore = 100,
  maxPlayers = 4,
}) => {
  const [, startTransition] = useTransition();

  const totalPlayers = Math.min(4, Math.max(2, maxPlayers));

  const createInitialConfigs = useCallback(() => {
    const configs = [{ id: 'p-1', name: playerName || 'Anda (P1)', isBot: false }];
    const botNames = ['Bot Siti', 'Bot Joko', 'Bot Rian'];
    for (let i = 1; i < totalPlayers; i++) {
      configs.push({ id: `p-${i + 1}`, name: botNames[i - 1] || `Bot ${i}`, isBot: true });
    }
    return configs;
  }, [playerName, totalPlayers]);

  // Local Offline State (vs bots)
  const [localGame, setLocalGame] = useState<NLGGState>(() =>
    createNLGGGame(createInitialConfigs())
  );

  // Multi-Round Match State (Target Score Tournament)
  const [matchScores, setMatchScores] = useState<Record<string, number>>({});
  const [roundNumber, setRoundNumber] = useState(1);
  const [targetScore, setTargetScore] = useState(initialTargetScore);
  const [scoredRound, setScoredRound] = useState<number | null>(null);

  useEffect(() => {
    if (initialTargetScore) {
      setTargetScore(initialTargetScore);
    }
  }, [initialTargetScore]);

  // Interaction State
  const [selectedTile, setSelectedTile] = useState<{ id: string; tile?: [number, number] } | null>(null);
  const [selectableEnds, setSelectableEnds] = useState<EndSide[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [tradeSelectedMyCard, setTradeSelectedMyCard] = useState<string | null>(null);
  const [tradeTargetPlayerId, setTradeTargetPlayerId] = useState<string | null>(null);
  const [tradeTargetCardId, setTradeTargetCardId] = useState<string | null>(null);
  const [drawNotification, setDrawNotification] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Unified Effective State
  const myPlayerId = isOnline ? myOnlinePlayerId : 'p-1';
  const phase = isOnline ? (onlineState?.phase ?? 'blind_pick') : localGame.phase;
  const board = isOnline ? (onlineState?.board ?? createEmptyBoard()) : localGame.board;
  const winnerId = isOnline ? onlineState?.winnerId : localGame.winnerId;
  const winReason = isOnline ? onlineState?.winReason : localGame.winReason;
  const pipScores = isOnline ? onlineState?.pipScores : localGame.pipScores;
  const activeTradeOffer = isOnline ? onlineState?.activeTradeOffer : localGame.activeTradeOffer;
  const scatteredCardsCount = isOnline ? (onlineState?.scatteredCardsCount ?? 0) : localGame.tableScatteredCards.length;
  const drawPoolCount = isOnline ? (onlineState?.drawPoolCount ?? 0) : localGame.drawPool.length;
  const currentPlayerId = isOnline
    ? onlineState?.currentPlayerId
    : localGame.players[localGame.currentPlayerIndex]?.id;

  const players: {
    id: string;
    name: string;
    isBot: boolean;
    hand: { id: string; tile?: [number, number]; revealed?: boolean }[];
    tradeQuota?: number;
    hasActedTrade?: boolean;
  }[] = isOnline
    ? (onlineState?.players ?? [])
    : localGame.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        hand: p.hand,
        tradeQuota: p.tradeQuota,
        hasActedTrade: p.hasActedTrade,
      }));

  const myPlayer = players.find(p => p.id === myPlayerId);
  const opponents = players.filter(p => p.id !== myPlayerId);
  const topOpponent = opponents.length === 1 ? opponents[0] : (opponents.length >= 2 ? opponents[1] : null);
  const leftOpponent = opponents.length > 1 ? opponents[0] : null;
  const rightOpponent = opponents.length >= 3 ? opponents[2] : null;
  const activePlayer = players.find(p => p.id === currentPlayerId);
  const isMyTurn = phase === 'playing' && currentPlayerId === myPlayerId;

  // Set default trade target if not set
  useEffect(() => {
    if (!tradeTargetPlayerId && opponents.length > 0) {
      setTradeTargetPlayerId(opponents[0].id);
      setTradeTargetCardId(opponents[0].hand[0]?.id || null);
    }
  }, [tradeTargetPlayerId, opponents]);

  // Valid moves for current active user
  const myHandTiles: [number, number][] =
    myPlayer?.hand
      .map(c => c.tile)
      .filter((t): t is [number, number] => t !== undefined) || [];

  const myValidMoves =
    isMyTurn && myPlayer && board
      ? getAvailableMoves(myHandTiles, board)
      : [];

  // Compute remaining pips of each player in this round
  const roundPips = useMemo(() => {
    if (phase !== 'game_over') return {};
    const res: Record<string, number> = {};
    players.forEach(p => {
      const handTiles = p.hand.map(c => c.tile).filter((t): t is Tile => Boolean(t));
      res[p.id] = pipScores?.[p.id] ?? handTiles.reduce((acc, t) => acc + t[0] + t[1], 0);
    });
    return res;
  }, [phase, players, pipScores]);

  // Points awarded to winner: sum of all opponents' remaining pips
  const roundPointsWon = useMemo(() => {
    if (phase !== 'game_over' || !winnerId) return 0;
    return Object.entries(roundPips).reduce(
      (sum, [pid, pips]) => (pid !== winnerId ? sum + pips : sum),
      0
    );
  }, [phase, winnerId, roundPips]);

  // Record points once per round
  useEffect(() => {
    if (phase === 'game_over' && winnerId && scoredRound !== roundNumber) {
      setScoredRound(roundNumber);
      const points = roundPointsWon > 0 ? roundPointsWon : 10;
      setMatchScores(prev => ({
        ...prev,
        [winnerId]: (prev[winnerId] || 0) + points,
      }));
    }
  }, [phase, winnerId, scoredRound, roundNumber, roundPointsWon]);

  // Match Victory check: player reaches or exceeds targetScore
  const isMatchOver = useMemo(() => {
    if (phase !== 'game_over') return false;
    return Object.values(matchScores).some(s => s >= targetScore);
  }, [phase, matchScores, targetScore]);

  // Sound helpers
  const triggerClack = useCallback(() => {
    if (soundEnabled) playTileClack();
  }, [soundEnabled]);

  const triggerSwoosh = useCallback(() => {
    if (soundEnabled) playPassSound();
  }, [soundEnabled]);

  // Confetti on win
  useEffect(() => {
    if (phase === 'game_over' && winnerId === myPlayerId) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [phase, winnerId, myPlayerId]);

  // --- OFFLINE ONLY: BOT AUTOMATION ---

  // Phase 1: Offline Bots Blind Pick
  useEffect(() => {
    if (isOnline) return;
    if (localGame.phase !== 'blind_pick') return;

    const botNeedingCards = localGame.players.find(
      p => p.isBot && p.hand.length < 7 && localGame.tableScatteredCards.length > 0
    );

    if (botNeedingCards) {
      const timer = setTimeout(() => {
        const randomCard =
          localGame.tableScatteredCards[
            Math.floor(Math.random() * localGame.tableScatteredCards.length)
          ];
        if (randomCard) {
          setLocalGame(prev => blindPickCard(prev, botNeedingCards.id, randomCard.id));
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOnline, localGame.phase, localGame.players, localGame.tableScatteredCards]);

  // Phase 2: Offline Bots Blind Trade
  useEffect(() => {
    if (isOnline) return;
    if (localGame.phase !== 'blind_trade') return;

    if (localGame.activeTradeOffer) {
      if (localGame.activeTradeOffer.toPlayerId !== myPlayerId) {
        const timer = setTimeout(() => {
          const willAccept = Math.random() > 0.3;
          setLocalGame(prev =>
            respondTrade(prev, prev.activeTradeOffer!.toPlayerId, willAccept)
          );
        }, 800);
        return () => clearTimeout(timer);
      }
      return;
    }

    const botToAct = localGame.players.find(p => p.isBot && !p.hasActedTrade);
    if (botToAct && myPlayer?.hasActedTrade) {
      const timer = setTimeout(() => {
        const shouldTrade = Math.random() > 0.5;
        if (shouldTrade) {
          const opponentsList = localGame.players.filter(p => p.id !== botToAct.id);
          const targetOpponent =
            opponentsList[Math.floor(Math.random() * opponentsList.length)];

          setLocalGame(prev =>
            proposeTrade(
              prev,
              botToAct.id,
              targetOpponent.id
            )
          );
        } else {
          setLocalGame(prev => skipTrade(prev, botToAct.id));
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [
    isOnline,
    localGame.phase,
    localGame.activeTradeOffer,
    localGame.players,
    myPlayer?.hasActedTrade,
    myPlayerId,
  ]);

  // Phase 4: Offline Bot Play Move / Cangkul
  useEffect(() => {
    if (isOnline) return;
    if (localGame.phase !== 'playing') return;

    const currentLocalPlayer = localGame.players[localGame.currentPlayerIndex];
    if (currentLocalPlayer && currentLocalPlayer.isBot) {
      const timer = setTimeout(() => {
        const moves = getAvailableMoves(
          currentLocalPlayer.hand.map(c => c.tile),
          localGame.board
        );

        startTransition(() => {
          if (moves.length > 0) {
            const chosenMove = moves.reduce((prev, curr) => {
              const pSum = prev.tile[0] + prev.tile[1];
              const cSum = curr.tile[0] + curr.tile[1];
              return cSum > pSum ? curr : prev;
            }, moves[0]);

            const matchingCard = currentLocalPlayer.hand.find(
              c =>
                (c.tile[0] === chosenMove.tile[0] &&
                  c.tile[1] === chosenMove.tile[1]) ||
                (c.tile[0] === chosenMove.tile[1] &&
                  c.tile[1] === chosenMove.tile[0])
            )!;

            triggerClack();
            setLocalGame(prev =>
              nlggPlayMove(
                prev,
                currentLocalPlayer.id,
                matchingCard.id,
                chosenMove.targetEnds[0]
              )
            );
          } else {
            if (localGame.drawPool.length > 0) {
              const { state: updated, result } = nlggDrawTurn(
                localGame,
                currentLocalPlayer.id
              );
              triggerSwoosh();
              setLocalGame(updated);

              if (result.isPlayable) {
                triggerClack();
                setDrawNotification(
                  `${currentLocalPlayer.name} mencangkul [${result.card.tile[0]}|${result.card.tile[1]}] & langsung memasangnya!`
                );
              } else {
                setDrawNotification(
                  `${currentLocalPlayer.name} mencangkul kartu tidak cocok -> Masuk tangan & Pass.`
                );
              }
              setTimeout(() => setDrawNotification(null), 3000);
            } else {
              triggerSwoosh();
              setLocalGame(prev => passWhenPoolEmpty(prev, currentLocalPlayer.id));
            }
          }
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, localGame, triggerClack, triggerSwoosh]);

  // --- USER ACTIONS ---

  // Pick face-down card
  const handlePickCard = (cardId: string) => {
    if (phase !== 'blind_pick') return;
    if (myPlayer && myPlayer.hand.length >= 7) return;

    triggerClack();
    if (isOnline && roomCode) {
      socket.emit('nlgg_pick_card', { roomCode, cardId });
    } else {
      setLocalGame(prev => blindPickCard(prev, myPlayerId, cardId));
    }
  };

  // Quick auto pick all
  const handleAutoPick = () => {
    if (phase !== 'blind_pick') return;
    triggerClack();
    if (isOnline && roomCode) {
      const currentCount = myPlayer?.hand.length || 0;
      for (let i = currentCount; i < 7; i++) {
        socket.emit('nlgg_pick_card', { roomCode, cardId: `auto-${i}` });
      }
    } else {
      setLocalGame(prev => autoBlindPickAll(prev));
    }
  };

  // Propose trade (Entire Hand Swap)
  const handleProposeTrade = () => {
    if (!tradeTargetPlayerId) return;

    if (isOnline && roomCode) {
      socket.emit('nlgg_propose_trade', {
        roomCode,
        toPlayerId: tradeTargetPlayerId,
      });
    } else {
      setLocalGame(prev =>
        proposeTrade(
          prev,
          myPlayerId,
          tradeTargetPlayerId
        )
      );
    }
  };

  // Respond to incoming trade
  const handleRespondTrade = (accept: boolean) => {
    if (isOnline && roomCode) {
      socket.emit('nlgg_respond_trade', { roomCode, accept });
    } else {
      setLocalGame(prev => respondTrade(prev, myPlayerId, accept));
    }
  };

  // Skip trade
  const handleSkipTrade = () => {
    if (isOnline && roomCode) {
      socket.emit('nlgg_skip_trade', { roomCode });
    } else {
      setLocalGame(prev => skipTrade(prev, myPlayerId));
    }
  };

  // Human play card
  const handleSelectCardToPlay = (card: { id: string; tile?: [number, number] }) => {
    if (!isMyTurn) {
      setDrawNotification('⏳ Bukan giliran Anda! Mohon tunggu giliran lawan.');
      setTimeout(() => setDrawNotification(null), 2500);
      return;
    }

    if (!card.tile) return;
    const playableEnds = getTilePlayableEnds(card.tile, board);
    if (playableEnds.length === 0) {
      setDrawNotification(
        `❌ Kartu [${card.tile[0]}|${card.tile[1]}] tidak cocok dengan ujung meja (${board.leftEnd ?? '-'} atau ${board.rightEnd ?? '-'})!`
      );
      setTimeout(() => setDrawNotification(null), 3000);
      return;
    }

    // On empty board or if only 1 end is valid, play immediately!
    if (playableEnds.length === 1 || board.chain.length === 0) {
      triggerClack();
      setSelectedTile(null);
      setSelectableEnds([]);
      const targetEnd = playableEnds[0] || 'left';
      if (isOnline && roomCode) {
        socket.emit('nlgg_play_move', {
          roomCode,
          cardId: card.id,
          targetEnd,
        });
      } else {
        setLocalGame(prev => nlggPlayMove(prev, myPlayerId, card.id, targetEnd));
      }
    } else {
      // If re-clicking already selected tile, default to playing it to the first valid end
      if (selectedTile?.id === card.id) {
        triggerClack();
        setSelectedTile(null);
        setSelectableEnds([]);
        const targetEnd = playableEnds[0];
        if (isOnline && roomCode) {
          socket.emit('nlgg_play_move', {
            roomCode,
            cardId: card.id,
            targetEnd,
          });
        } else {
          setLocalGame(prev => nlggPlayMove(prev, myPlayerId, card.id, targetEnd));
        }
      } else {
        setSelectedTile(card);
        setSelectableEnds(playableEnds);
      }
    }
  };

  const handleExecutePlacedMove = (end: EndSide) => {
    if (!selectedTile) return;
    triggerClack();
    const cardId = selectedTile.id;
    setSelectedTile(null);
    setSelectableEnds([]);

    if (isOnline && roomCode) {
      socket.emit('nlgg_play_move', {
        roomCode,
        cardId,
        targetEnd: end,
      });
    } else {
      setLocalGame(prev => nlggPlayMove(prev, myPlayerId, cardId, end));
    }
  };

  // Human mandatory draw
  const handleHumanDrawTurn = () => {
    if (!isMyTurn || myValidMoves.length > 0) return;

    if (isOnline && roomCode) {
      if (drawPoolCount > 0) {
        triggerSwoosh();
        socket.emit(
          'nlgg_draw_turn',
          { roomCode },
          (res: { success: boolean; result?: DrawTurnResult; error?: string }) => {
            if (res?.success && res.result) {
              const r = res.result;
              if (r.isPlayable) {
                triggerClack();
                setDrawNotification(
                  `🎯 Anda mencangkul [${r.card.tile[0]}|${r.card.tile[1]}] dan langsung otomatis dipasang ke meja!`
                );
              } else {
                setDrawNotification(
                  `❌ Anda mencangkul [${r.card.tile[0]}|${r.card.tile[1]}], tidak cocok -> Masuk ke tangan & Pass.`
                );
              }
              setTimeout(() => setDrawNotification(null), 4000);
            }
          }
        );
      } else {
        triggerSwoosh();
        socket.emit('nlgg_pass_pool_empty', { roomCode });
      }
    } else {
      if (localGame.drawPool.length > 0) {
        const { state: updated, result } = nlggDrawTurn(localGame, myPlayerId);
        triggerSwoosh();
        setLocalGame(updated);

        if (result.isPlayable) {
          triggerClack();
          setDrawNotification(
            `🎯 Anda mencangkul [${result.card.tile[0]}|${result.card.tile[1]}] dan langsung otomatis dipasang ke meja!`
          );
        } else {
          setDrawNotification(
            `❌ Anda mencangkul [${result.card.tile[0]}|${result.card.tile[1]}], tidak cocok -> Masuk ke tangan & Pass (Lewat).`
          );
        }
        setTimeout(() => setDrawNotification(null), 4000);
      } else {
        triggerSwoosh();
        setLocalGame(prev => passWhenPoolEmpty(prev, myPlayerId));
      }
    }
  };

  // Next Round in ongoing match
  const handleNextRound = () => {
    if (isOnline && roomCode) {
      socket.emit('nlgg_next_round', { roomCode });
    } else {
      setRoundNumber(prev => prev + 1);
      setLocalGame(createNLGGGame(createInitialConfigs()));
    }
    setSelectedTile(null);
    setSelectableEnds([]);
    setTradeSelectedMyCard(null);
    setTradeTargetCardId(null);
  };

  // Restart match from scratch
  const handleRestart = () => {
    setMatchScores({});
    setRoundNumber(1);
    setScoredRound(null);
    if (isOnline && roomCode) {
      socket.emit('nlgg_restart_game', { roomCode });
    } else {
      setLocalGame(createNLGGGame(createInitialConfigs()));
    }
    setSelectedTile(null);
    setSelectableEnds([]);
    setTradeSelectedMyCard(null);
    setTradeTargetCardId(null);
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between p-2 sm:p-4 md:p-6 max-w-6xl mx-auto select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl backdrop-blur-md">
        <div
          onClick={() => setShowExitConfirm(true)}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          title="Kembali ke Beranda"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 shadow group-hover:scale-105 transition-transform shrink-0">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-extrabold text-xs sm:text-sm md:text-base tracking-wide text-white group-hover:text-amber-300 transition-colors">
                MODE ALA NLGG
              </h1>
              {isOnline ? (
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold">
                  <Radio size={9} className="animate-pulse" /> MABAR ONLINE
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-400 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold">
                  SOLO VS BOT
                </span>
              )}
            </div>

            {isOnline && roomCode ? (
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[10px] sm:text-[11px] text-amber-300 font-mono flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Room: <b>{roomCode}</b></span>
                {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              </button>
            ) : (
              <p className="text-[10px] text-amber-400 font-medium">
                Ronde {roundNumber} • Target: {targetScore} Poin
              </p>
            )}
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Target Score Indicator Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 border border-amber-500/30 rounded-xl text-xs shadow-inner">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-slate-400">Target:</span>
            <span className="text-amber-300 font-extrabold">{targetScore} Poin</span>
          </div>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Aturan Main Ala NLGG"
          >
            <HelpCircle size={16} />
          </button>

          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold border border-rose-500/30 transition cursor-pointer"
            title="Keluar dari Pertandingan"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Floating Notification Banner */}
      {drawNotification && (
        <div className="my-2 p-3 bg-amber-500/90 text-slate-950 font-bold text-xs md:text-sm rounded-2xl shadow-xl text-center animate-bounce-once">
          {drawNotification}
        </div>
      )}

      {/* ============================================================== */}
      {/* FASE 1: BLIND PICK (Ambil 7 Kartu Tertutup dari Sebaran Meja) */}
      {/* ============================================================== */}
      {phase === 'blind_pick' && (
        <main className="flex-1 flex flex-col justify-between py-2 sm:py-4 items-center gap-3 sm:gap-4 min-h-0">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold">
              <Sparkles size={14} />
              <span>Fase 1: Pengambilan Kartu Tertutup</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white">
              Pilih 7 Kartu Tertutup di Meja
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Kartu diambil dalam kondisi tertutup sampai semua pemain siap.
            </p>
          </div>

          {/* Player Progress Bar */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shadow-md">
            <span className="text-xs font-semibold text-slate-300">
              Kartu Anda: <b className="text-amber-400">{myPlayer?.hand.length || 0}/7</b>
            </span>
            <div className="w-24 sm:w-32 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-amber-400 h-full transition-all duration-300"
                style={{ width: `${((myPlayer?.hand.length || 0) / 7) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleAutoPick}
              className="text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1 rounded-xl transition cursor-pointer"
            >
              Ambil Cepat
            </button>
          </div>

          {/* Opponents pick indicators */}
          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
            {opponents.map(opp => (
              <div
                key={opp.id}
                className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-800 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs text-slate-400"
              >
                {opp.isBot ? <Bot size={13} /> : <User size={13} />}
                <span>{opp.name}:</span>
                <b className="text-amber-400">{opp.hand.length}/7</b>
              </div>
            ))}
          </div>

          {/* Scattered Cards Grid on Table */}
          <div className="w-full max-w-4xl flex-1 min-h-[260px] max-h-[380px] p-3 sm:p-5 bg-gradient-to-b from-[#064e3b] via-[#043d2f] to-[#022c22] rounded-3xl border-4 border-[#381e11] shadow-2xl flex items-center justify-center overflow-hidden">
            <div className="flex flex-wrap gap-2 justify-center max-h-[320px] overflow-y-auto p-2">
              {Array.from({ length: scatteredCardsCount }, (_, idx) => {
                const cardId = isOnline
                  ? `card-scattered-${idx}`
                  : localGame.tableScatteredCards[idx]?.id || `card-${idx}`;

                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => handlePickCard(cardId)}
                    disabled={(myPlayer?.hand.length || 0) >= 7}
                    className="transition-transform hover:scale-110 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    title={`Ambil Kartu #${idx + 1}`}
                  >
                    <DominoTile tile={[0, 0]} size="sm" hidden />
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ============================================================== */}
      {/* FASE 2: BLIND TRADE (Barter Seluruh Kartu Tertutup 1x)        */}
      {/* ============================================================== */}
      {phase === 'blind_trade' && (
        <main className="flex-1 flex flex-col justify-center items-center py-2 sm:py-4 px-1 min-h-0">
          {/* Active Trade Incoming Prompt (if someone offers trade to Human) */}
          {activeTradeOffer && activeTradeOffer.toPlayerId === myPlayerId && (
            <div className="w-full max-w-md bg-amber-500/20 border-2 border-amber-400 rounded-3xl p-5 shadow-2xl text-center animate-bounce-once mb-4">
              <h3 className="font-bold text-sm text-amber-300 mb-2">
                Tawaran Barter Masuk!
              </h3>
              <p className="text-xs text-slate-200 mb-4">
                Pemain <b className="text-amber-300">{players.find(p => p.id === activeTradeOffer.fromPlayerId)?.name || 'Lawan'}</b> mengajak menukar <b>seluruh 7 kartu tertutup</b> miliknya dengan kartu Anda. Terima?
              </p>
              <div className="grid grid-cols-2 gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => handleRespondTrade(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check size={16} /> Terima Barter
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondTrade(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X size={16} /> Tolak
                </button>
              </div>
            </div>
          )}

          {/* Trade Control Card */}
          {myPlayer?.tradeQuota === 1 && !myPlayer?.hasActedTrade && !activeTradeOffer && (
            <div className="w-full max-w-md bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-indigo-500/30 p-4 sm:p-5 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col gap-3.5 text-center">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-3 py-0.5 rounded-full text-[11px] font-bold">
                  <ArrowRightLeft size={13} />
                  <span>Fase 2 • Barter Buta</span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-white">
                  Tukar Kartu Rahasia?
                </h2>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Anda boleh menukar seluruh 7 kartu tertutup dengan 1 lawan sebelum kartu dibuka, atau lewati jika yakin.
                </p>
              </div>

              {/* 7 Mystery Cards Back Showcase */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-1.5">
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {myPlayer.hand.map((c, i) => (
                    <div key={c.id || i} className="scale-90 hover:scale-95 transition-transform shrink-0">
                      <DominoTile tile={[0, 0]} size="sm" hidden />
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-amber-400/90 font-bold tracking-wider uppercase">
                  7 Kartu Tertutup Anda
                </span>
              </div>

              {/* Choose Target Opponent */}
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2 text-left sm:text-center">
                  Pilih Lawan untuk Ditukar:
                </span>
                <div className="flex gap-2 justify-center">
                  {opponents.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTradeTargetPlayerId(p.id)}
                      className={`flex-1 py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        tradeTargetPlayerId === p.id
                          ? 'border-indigo-500 bg-indigo-500/25 text-indigo-300 shadow-md ring-2 ring-indigo-400/50 scale-102'
                          : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                        {p.isBot ? <Bot size={14} /> : <User size={14} />}
                      </div>
                      <span className="truncate max-w-[65px]">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={!tradeTargetPlayerId}
                  onClick={handleProposeTrade}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 px-2 rounded-xl text-xs transition shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft size={14} />
                  <span className="truncate">Tukar Kartu</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipTrade}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-2 rounded-xl text-xs transition border border-slate-700 cursor-pointer"
                >
                  Lewati (Skip)
                </button>
              </div>
            </div>
          )}

          {myPlayer?.hasActedTrade && !activeTradeOffer && (
            <div className="text-center p-5 bg-slate-900/90 border border-slate-800 rounded-3xl max-w-sm shadow-xl">
              <span className="text-xs text-slate-300 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Menunggu pemain lain menyelesaikan barter...
              </span>
            </div>
          )}
        </main>
      )}

      {/* ============================================================== */}
      {/* FASE 4: CORE GAMEPLAY & CANGKUL WAJIB                           */}
      {/* ============================================================== */}
      {phase === 'playing' && (
        <>
          <main className="flex-1 flex flex-col justify-between py-1 sm:py-2 gap-1.5 sm:gap-2.5 min-h-0">
            {/* Mobile Opponents Row: displayed side-by-side above board on small screens */}
            <div className="flex md:hidden items-center justify-around gap-1.5 px-0.5">
              {leftOpponent && (
                <div
                  className={`p-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${
                    currentPlayerId === leftOpponent.id
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs shrink-0">
                    {leftOpponent.isBot ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-[11px] text-slate-200 block truncate max-w-[58px]">
                      {leftOpponent.name}
                    </span>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-emerald-400 font-bold border border-slate-800/80">
                        {leftOpponent.hand.length} krt
                      </span>
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-amber-300 font-extrabold border border-slate-800/80">
                        {matchScores[leftOpponent.id] || 0} pt
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {topOpponent && (
                <div
                  className={`p-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${
                    currentPlayerId === topOpponent.id
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs shrink-0">
                    {topOpponent.isBot ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-[11px] text-slate-200 block truncate max-w-[58px]">
                      {topOpponent.name}
                    </span>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-emerald-400 font-bold border border-slate-800/80">
                        {topOpponent.hand.length} krt
                      </span>
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-amber-300 font-extrabold border border-slate-800/80">
                        {matchScores[topOpponent.id] || 0} pt
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {rightOpponent && (
                <div
                  className={`p-1.5 rounded-xl flex items-center gap-1.5 border transition-all ${
                    currentPlayerId === rightOpponent.id
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs shrink-0">
                    {rightOpponent.isBot ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-[11px] text-slate-200 block truncate max-w-[58px]">
                      {rightOpponent.name}
                    </span>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-emerald-400 font-bold border border-slate-800/80">
                        {rightOpponent.hand.length} krt
                      </span>
                      <span className="bg-slate-950/80 px-1 py-0.2 rounded text-amber-300 font-extrabold border border-slate-800/80">
                        {matchScores[rightOpponent.id] || 0} pt
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Top Opponent */}
            {topOpponent && (
              <div className="hidden md:flex justify-center">
                <div
                  className={`p-2 rounded-xl flex items-center gap-2 border transition-all ${
                    currentPlayerId === topOpponent.id
                      ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                    {topOpponent.isBot ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className="text-left text-xs">
                    <span className="font-bold text-slate-200">{topOpponent.name}</span>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span>Kartu: <b className="text-emerald-400">{topOpponent.hand.length}</b></span>
                      <span>•</span>
                      <span>Skor: <b className="text-amber-300 font-extrabold">{matchScores[topOpponent.id] || 0}</b></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Middle Row: Left Opponent + Center Board + Right Opponent */}
            <div className="flex-1 flex flex-col md:grid md:grid-cols-[140px_1fr_140px] gap-2 md:gap-3 items-center min-h-0">
              {/* Left Opponent (Desktop) */}
              <div className="hidden md:flex justify-start">
                {leftOpponent ? (
                  <div
                    className={`p-2 rounded-xl flex items-center gap-2 border transition-all ${
                      currentPlayerId === leftOpponent.id
                        ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                      {leftOpponent.isBot ? <Bot size={16} /> : <User size={16} />}
                    </div>
                    <div className="text-left text-xs">
                      <span className="font-bold text-slate-200">{leftOpponent.name}</span>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Kartu: <b className="text-emerald-400">{leftOpponent.hand.length}</b></span>
                        <span>•</span>
                        <span>Skor: <b className="text-amber-300 font-extrabold">{matchScores[leftOpponent.id] || 0}</b></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {/* Center GameBoard with Physical Cangkul Stack on Table */}
              <GameBoard
                board={board}
                selectableEnds={selectableEnds}
                onSelectEnd={handleExecutePlacedMove}
                drawPoolCount={drawPoolCount}
                canDraw={isMyTurn && myValidMoves.length === 0 && drawPoolCount > 0}
                onDraw={handleHumanDrawTurn}
              />

              {/* Right Opponent (Desktop) */}
              <div className="hidden md:flex justify-end">
                {rightOpponent ? (
                  <div
                    className={`p-2 rounded-xl flex items-center gap-2 border transition-all ${
                      currentPlayerId === rightOpponent.id
                        ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs">
                      {rightOpponent.isBot ? <Bot size={16} /> : <User size={16} />}
                    </div>
                    <div className="text-left text-xs">
                      <span className="font-bold text-slate-200">{rightOpponent.name}</span>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Kartu: <b className="text-emerald-400">{rightOpponent.hand.length}</b></span>
                        <span>•</span>
                        <span>Skor: <b className="text-amber-300 font-extrabold">{matchScores[rightOpponent.id] || 0}</b></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </main>

          {/* Bottom Area: User Hand & Cangkul Button */}
          <footer className="w-full flex flex-col items-center gap-2 pt-1 pb-1">
            <div className="flex items-center justify-between w-full max-w-2xl px-2 text-xs">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 shadow-sm">
                  <span className="text-slate-400 text-[11px]">Kartu:</span>
                  <span className="font-extrabold text-emerald-400 text-xs">
                    {myPlayer?.hand.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-amber-500/30 shadow-sm">
                  <span className="text-slate-400 text-[11px]">Skor:</span>
                  <span className="font-black text-amber-300 text-xs">
                    {matchScores[myPlayerId] || 0}
                    <span className="text-slate-500 font-normal text-[10px]">/{targetScore}</span>
                  </span>
                </div>
              </div>

              {/* Turn / Action Indicator */}
              <div className="flex items-center gap-2">
                {isMyTurn && myValidMoves.length === 0 ? (
                  drawPoolCount > 0 ? (
                    <button
                      type="button"
                      onClick={handleHumanDrawTurn}
                      className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer ring-2 ring-amber-300/60 animate-pulse"
                      title="Klik untuk mencangkul 1 kartu dari meja"
                    >
                      <Sparkles size={14} className="animate-spin" />
                      <span>Cangkul ({drawPoolCount})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleHumanDrawTurn}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-700 shadow-md transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers size={14} />
                      <span>Lewat (Pass)</span>
                    </button>
                  )
                ) : isMyTurn ? (
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/40 animate-pulse text-xs">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Giliran Anda!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-ping" />
                    <span>Menunggu lawan...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Revealed Domino Tiles Rack */}
            <div className="w-full max-w-3xl overflow-x-auto py-1 px-1">
              <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 p-2 sm:p-2.5 bg-gradient-to-b from-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md min-h-[88px] sm:min-h-[105px] w-fit mx-auto">
                {myPlayer?.hand.map(card => {
                  const tile = card.tile || [0, 0];
                  const isPlayable =
                    isMyTurn &&
                    card.tile !== undefined &&
                    myValidMoves.some(
                      m => getTilePlayableEnds(card.tile!, board).length > 0
                    );
                  const isSelected = selectedTile?.id === card.id;

                  return (
                    <div key={card.id} className="shrink-0 transition-transform">
                      <DominoTile
                        tile={tile}
                        orientation="vertical"
                        size="md"
                        isPlayable={isPlayable}
                        isSelected={isSelected}
                        hidden={card.tile === undefined}
                        onClick={() => handleSelectCardToPlay(card)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {isMyTurn && myValidMoves.length === 0 && (
              <p className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                <ShieldAlert size={14} />
                Tidak ada kartu cocok! Anda wajib menekan tombol <b>Wajib Cangkul</b> di atas.
              </p>
            )}
          </footer>
        </>
      )}

      {/* ============================================================== */}
      {/* FASE 5: THEATRICAL ENDGAME SHOWDOWN ANIMATION                  */}
      {/* ============================================================== */}
      {phase === 'game_over' && (
        <EndgameShowdown
          players={players.map(p => {
            const isThisPlayerWinner = p.id === winnerId;
            const handTiles = p.hand.map(c => c.tile).filter((t): t is Tile => Boolean(t));
            const totalPips =
              pipScores?.[p.id] ?? handTiles.reduce((acc, t) => acc + t[0] + t[1], 0);

            return {
              id: p.id,
              name: p.name,
              hand: handTiles,
              totalPips,
              score: matchScores[p.id] || 0,
              penaltyAdded: isThisPlayerWinner ? roundPointsWon : 0,
              isWinner: isThisPlayerWinner,
              isMe: p.id === myPlayerId,
            };
          })}
          winnerName={players.find(p => p.id === winnerId)?.name || 'Pemenang'}
          winReason={winReason === 'normal' ? 'gaple' : 'buntu'}
          onRestart={handleRestart}
          onNextRound={handleNextRound}
          onExit={onExit}
          isGameOver={isMatchOver}
          roundNumber={roundNumber}
          targetScore={targetScore}
          soundEnabled={soundEnabled}
        />
      )}

      {/* Exit Modal */}
      <ExitConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit();
        }}
        isOnline={isOnline}
        roomCode={roomCode}
      />

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
};

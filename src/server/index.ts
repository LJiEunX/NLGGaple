import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { RoomManager, type Room, type GameType } from './roomManager.ts';
import { toClientView } from '../engine.ts';
import { getAvailableMoves } from '../board.ts';
import {
  playMove as enginePlayMove,
  passTurn as enginePassTurn,
} from '../engine.ts';
import {
  toClientNLGGView,
  blindPickCard as engineNLGGBlindPick,
  respondTrade as engineNLGGRespondTrade,
  skipTrade as engineNLGGSkipTrade,
  playMove as engineNLGGPlayMove,
  drawTurn as engineNLGGDrawTurn,
  passWhenPoolEmpty as engineNLGGPassPoolEmpty,
} from '../nlgg/engine.ts';
import type { Tile, EndSide } from '../types.ts';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 1e5, // 100 KB max payload protection
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

// Anti-spam in-memory rate limit maps
const lastChatTimes = new Map<string, number>();
const lastCreateTimes = new Map<string, number>();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

function safeCallback<T>(callback: unknown, payload: T): void {
  if (typeof callback === 'function') {
    callback(payload);
  }
}

function getRoomSummary(room: Room) {
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    players: room.players,
    maxPlayers: room.maxPlayers,
    gameType: room.gameType,
    targetScore: room.targetScore,
    status: room.status,
  };
}

function leaveCurrentSocketRoom(socket: Socket) {
  const { room, roomCode } = roomManager.leaveRoom(socket.id);
  if (roomCode) {
    socket.leave(roomCode);
  }
  if (room) {
    broadcastRoomState(room);
  }
}

/**
 * Broadcasts safe, client-authoritative state to each player in the room.
 */
function broadcastRoomState(room: Room) {
  // Broadcast generic room metadata to the whole room socket room
  io.to(room.code).emit('room_update', getRoomSummary(room));

  // Classic Gaple Mode
  if (room.game) {
    for (const player of room.players) {
      if (player.socketId) {
        const clientView = toClientView(room.game, player.id);
        io.to(player.socketId).emit('game_update', clientView);
      }
    }

    // Check if the current turn belongs to an AI Bot
    scheduleBotTurnIfNeeded(room);
  }

  // Ala NLGG Mode
  if (room.nlggGame) {
    for (const player of room.players) {
      if (player.socketId) {
        const clientView = toClientNLGGView(room.nlggGame, player.id);
        io.to(player.socketId).emit('nlgg_game_update', clientView);
      }
    }

    // Check if AI Bot action is needed for NLGG
    scheduleBotNLGGActionIfNeeded(room);
  }
}

/**
 * If the current turn in the room belongs to a Bot, execute it after a natural delay (Classic Mode).
 */
function scheduleBotTurnIfNeeded(room: Room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (!room.game || room.game.status !== 'in_progress') return;

  const scheduledGameId = room.game.id;
  const currentActivePlayer = room.game.players[room.game.currentPlayerIndex];
  const matchingRoomPlayer = room.players.find(p => p.id === currentActivePlayer?.id);

  if (matchingRoomPlayer && matchingRoomPlayer.isBot) {
    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      if (!room.game || room.game.status !== 'in_progress' || room.game.id !== scheduledGameId) return;

      const activePlayer = room.game.players[room.game.currentPlayerIndex];
      const activeRoomPlayer = room.players.find(p => p.id === activePlayer?.id);
      if (!activePlayer || !activeRoomPlayer || !activeRoomPlayer.isBot) return;

      try {
        const moves = getAvailableMoves(activePlayer.hand, room.game.board);

        if (moves.length > 0) {
          // AI Strategy: pick highest pip sum
          const chosen = moves.reduce((prev, curr) => {
            const prevSum = prev.tile[0] + prev.tile[1];
            const currSum = curr.tile[0] + curr.tile[1];
            return currSum > prevSum ? curr : prev;
          }, moves[0]);

          room.game = enginePlayMove(
            room.game,
            activePlayer.id,
            chosen.tile,
            chosen.targetEnds[0]
          );
        } else {
          room.game = enginePassTurn(room.game, activePlayer.id);
        }

        broadcastRoomState(room);
      } catch {
        // Stale or invalid timer transition ignored
      }
    }, 1000);
  }
}

/**
 * Executes AI Bot actions in Ala NLGG Mode (Pick, Trade, Turn).
 */
function scheduleBotNLGGActionIfNeeded(room: Room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (!room.nlggGame || room.nlggGame.phase === 'game_over') return;

  // Phase 1: Blind Pick (Bots pick random cards until 7 cards each)
  if (room.nlggGame.phase === 'blind_pick') {
    const botNeedingCards = room.nlggGame.players.find(
      p => p.isBot && p.hand.length < 7 && room.nlggGame!.tableScatteredCards.length > 0
    );

    if (botNeedingCards) {
      room.turnTimer = setTimeout(() => {
        room.turnTimer = null;
        if (!room.nlggGame || room.nlggGame.phase !== 'blind_pick') return;
        try {
          const available = room.nlggGame.tableScatteredCards;
          if (available.length > 0) {
            const randomCard = available[Math.floor(Math.random() * available.length)];
            room.nlggGame = engineNLGGBlindPick(
              room.nlggGame,
              botNeedingCards.id,
              randomCard.id
            );
            broadcastRoomState(room);
          }
        } catch {
          // Stale or invalid timer transition ignored
        }
      }, 350);
      return;
    }
  }

  // Phase 2: Blind Trade
  if (room.nlggGame.phase === 'blind_trade') {
    // 1. If someone offered a trade to a Bot -> Bot responds
    if (room.nlggGame.activeTradeOffer && room.nlggGame.activeTradeOffer.status === 'pending') {
      const offer = room.nlggGame.activeTradeOffer;
      const targetBot = room.players.find(p => p.id === offer.toPlayerId && p.isBot);
      if (targetBot) {
        room.turnTimer = setTimeout(() => {
          room.turnTimer = null;
          if (
            !room.nlggGame ||
            room.nlggGame.phase !== 'blind_trade' ||
            !room.nlggGame.activeTradeOffer ||
            room.nlggGame.activeTradeOffer.status !== 'pending'
          ) {
            return;
          }
          try {
            // Bot accepts trade 70% of the time
            const accept = Math.random() < 0.7;
            room.nlggGame = engineNLGGRespondTrade(room.nlggGame, targetBot.id, accept);
            broadcastRoomState(room);
          } catch {
            // Stale or invalid timer transition ignored
          }
        }, 800);
        return;
      }
    }

    // 2. If a Bot hasn't acted its trade quota yet -> Bot skips trade after brief delay
    const botToAct = room.nlggGame.players.find(p => p.isBot && !p.hasActedTrade);
    if (botToAct && !room.nlggGame.activeTradeOffer) {
      room.turnTimer = setTimeout(() => {
        room.turnTimer = null;
        if (!room.nlggGame || room.nlggGame.phase !== 'blind_trade' || room.nlggGame.activeTradeOffer) {
          return;
        }
        try {
          room.nlggGame = engineNLGGSkipTrade(room.nlggGame, botToAct.id);
          broadcastRoomState(room);
        } catch {
          // Stale or invalid timer transition ignored
        }
      }, 700);
      return;
    }
  }

  // Phase 4: Playing Turn (Cangkul Wajib)
  if (room.nlggGame.phase === 'playing') {
    const currentActivePlayer = room.nlggGame.players[room.nlggGame.currentPlayerIndex];
    if (currentActivePlayer && currentActivePlayer.isBot) {
      room.turnTimer = setTimeout(() => {
        room.turnTimer = null;
        if (!room.nlggGame || room.nlggGame.phase !== 'playing') return;
        const current = room.nlggGame.players[room.nlggGame.currentPlayerIndex];
        if (!current || !current.isBot) return;

        try {
          const moves = getAvailableMoves(
            current.hand.map(c => c.tile),
            room.nlggGame.board
          );

          if (moves.length > 0) {
            // AI Strategy: Play tile with highest pip sum
            const chosen = moves.reduce((prev, curr) => {
              const prevSum = prev.tile[0] + prev.tile[1];
              const currSum = curr.tile[0] + curr.tile[1];
              return currSum > prevSum ? curr : prev;
            }, moves[0]);

            const card = current.hand.find(
              c => c.tile[0] === chosen.tile[0] && c.tile[1] === chosen.tile[1]
            );
            if (card) {
              room.nlggGame = engineNLGGPlayMove(
                room.nlggGame,
                current.id,
                card.id,
                chosen.targetEnds[0]
              );
              broadcastRoomState(room);
            }
          } else {
            // No moves in hand -> Cangkul wajib or Pass
            if (room.nlggGame.drawPool.length > 0) {
              const { state } = engineNLGGDrawTurn(room.nlggGame, current.id);
              room.nlggGame = state;
              broadcastRoomState(room);
            } else {
              room.nlggGame = engineNLGGPassPoolEmpty(room.nlggGame, current.id);
              broadcastRoomState(room);
            }
          }
        } catch {
          // Stale or invalid timer transition ignored
        }
      }, 900);
    }
  }
}

io.on('connection', (socket: Socket) => {
  // CREATE ROOM
  socket.on(
    'create_room',
    (
      data: { hostName: string; maxPlayers?: number; gameType?: GameType; targetScore?: number },
      callback?: (res: { success: boolean; room?: any; error?: string }) => void
    ) => {
      try {
        const now = Date.now();
        const lastCreate = lastCreateTimes.get(socket.id) || 0;
        if (now - lastCreate < 2000) {
          safeCallback(callback, {
            success: false,
            error: 'Mohon tunggu 2 detik sebelum membuat room baru.',
          });
          return;
        }
        lastCreateTimes.set(socket.id, now);

        leaveCurrentSocketRoom(socket);
        const room = roomManager.createRoom(socket.id, data?.hostName, {
          maxPlayers: data?.maxPlayers,
          gameType: data?.gameType,
          targetScore: data?.targetScore,
        });
        socket.join(room.code);
        broadcastRoomState(room);
        safeCallback(callback, { success: true, room: getRoomSummary(room) });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // JOIN ROOM
  socket.on(
    'join_room',
    (
      data: { roomCode: string; playerName: string },
      callback?: (res: { success: boolean; room?: any; error?: string }) => void
    ) => {
      try {
        leaveCurrentSocketRoom(socket);
        const room = roomManager.joinRoom(
          data?.roomCode,
          socket.id,
          data?.playerName
        );
        socket.join(room.code);
        broadcastRoomState(room);
        safeCallback(callback, { success: true, room: getRoomSummary(room) });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // ADD BOT
  socket.on(
    'add_bot',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.addBot(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // START GAME
  socket.on(
    'start_game',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.startGame(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // --- CLASSIC MODE ACTIONS ---

  // PLAY MOVE (CLASSIC)
  socket.on(
    'play_move',
    (
      data: { roomCode: string; tile: Tile; targetEnd: EndSide },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.playMove(
          data?.roomCode,
          socket.id,
          data?.tile,
          data?.targetEnd
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // PASS TURN (CLASSIC)
  socket.on(
    'pass_turn',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.passTurn(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NEXT ROUND (CLASSIC)
  socket.on(
    'next_round',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nextRound(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // --- ALA NLGG MODE ACTIONS ---

  // NLGG: PICK CARD
  socket.on(
    'nlgg_pick_card',
    (
      data: { roomCode: string; cardId: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggPickCard(
          data?.roomCode,
          socket.id,
          data?.cardId
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: PROPOSE TRADE (FULL HAND SWAP)
  socket.on(
    'nlgg_propose_trade',
    (
      data: {
        roomCode: string;
        toPlayerId: string;
        fromCardId?: string;
        toCardId?: string;
      },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggProposeTrade(
          data?.roomCode,
          socket.id,
          data?.toPlayerId,
          data?.fromCardId,
          data?.toCardId
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: RESPOND TRADE
  socket.on(
    'nlgg_respond_trade',
    (
      data: { roomCode: string; accept: boolean },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggRespondTrade(
          data?.roomCode,
          socket.id,
          data?.accept
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: SKIP TRADE
  socket.on(
    'nlgg_skip_trade',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggSkipTrade(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: PLAY MOVE
  socket.on(
    'nlgg_play_move',
    (
      data: { roomCode: string; cardId: string; targetEnd: EndSide },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggPlayMove(
          data?.roomCode,
          socket.id,
          data?.cardId,
          data?.targetEnd
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: DRAW TURN (CANGKUL WAJIB)
  socket.on(
    'nlgg_draw_turn',
    (
      data: { roomCode: string; preferredEnd?: EndSide },
      callback?: (res: { success: boolean; result?: any; error?: string }) => void
    ) => {
      try {
        const { room, result } = roomManager.nlggDrawTurn(
          data?.roomCode,
          socket.id,
          data?.preferredEnd
        );
        broadcastRoomState(room);
        safeCallback(callback, { success: true, result });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: PASS WHEN POOL EMPTY
  socket.on(
    'nlgg_pass_pool_empty',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggPassPoolEmpty(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: RESTART GAME
  socket.on(
    'nlgg_restart_game',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggRestartGame(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // NLGG: NEXT ROUND
  socket.on(
    'nlgg_next_round',
    (
      data: { roomCode: string },
      callback?: (res: { success: boolean; error?: string }) => void
    ) => {
      try {
        const room = roomManager.nlggNextRound(data?.roomCode, socket.id);
        broadcastRoomState(room);
        safeCallback(callback, { success: true });
      } catch (err: any) {
        safeCallback(callback, { success: false, error: err?.message ?? 'Unknown error' });
      }
    }
  );

  // CHAT MESSAGE
  socket.on(
    'send_chat',
    (data: { roomCode: string; text: string }) => {
      try {
        const now = Date.now();
        const lastChat = lastChatTimes.get(socket.id) || 0;
        // Rate limit: 500ms cooldown per message per socket
        if (now - lastChat < 500) {
          return;
        }
        lastChatTimes.set(socket.id, now);

        const { room, message } = roomManager.addChatMessage(
          data?.roomCode,
          socket.id,
          data?.text
        );
        io.to(room.code).emit('chat_received', message);
      } catch {
        // Silently ignore rejected spam messages
      }
    }
  );

  // LEAVE ROOM
  socket.on('leave_room', () => {
    leaveCurrentSocketRoom(socket);
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    lastChatTimes.delete(socket.id);
    lastCreateTimes.delete(socket.id);
    leaveCurrentSocketRoom(socket);
  });
});

// Serve compiled frontend in production if dist/ exists
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Gaple WebSocket Server running on port ${PORT}`);
});

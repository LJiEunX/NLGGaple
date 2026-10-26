import type { Socket } from 'socket.io';
import type { GameState, Tile, EndSide, ClientGameState } from '../types.ts';
import type { NLGGState, DrawTurnResult } from '../nlgg/types.ts';
import {
  createGame,
  playMove as enginePlayMove,
  passTurn as enginePassTurn,
  startNextRound as engineStartNextRound,
  toClientView,
} from '../engine.ts';
import {
  createNLGGGame,
  blindPickCard as engineNLGGBlindPick,
  proposeTrade as engineNLGGProposeTrade,
  respondTrade as engineNLGGRespondTrade,
  skipTrade as engineNLGGSkipTrade,
  playMove as engineNLGGPlayMove,
  drawTurn as engineNLGGDrawTurn,
  passWhenPoolEmpty as engineNLGGPassPoolEmpty,
} from '../nlgg/engine.ts';
import { getAvailableMoves } from '../board.ts';

export type GameType = 'classic' | 'nlgg';

export interface RoomPlayer {
  id: string; // Internal player id (e.g. 'p-1', 'p-2')
  socketId: string; // Socket ID (empty string if bot)
  name: string;
  isHost: boolean;
  isBot: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Room {
  code: string;
  hostSocketId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  gameType: GameType;
  targetScore: number;
  game: GameState | null;
  nlggGame: NLGGState | null;
  chatMessages: ChatMessage[];
  status: 'waiting' | 'playing';
  turnTimer: NodeJS.Timeout | null;
  lastActivity: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private readonly MAX_ACTIVE_ROOMS = 500;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic garbage collector for stale/abandoned rooms (every 5 minutes)
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleRooms();
    }, 5 * 60 * 1000);
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Cleans text from HTML tags, non-printable characters, and limits length
   */
  public sanitizeString(str: unknown, maxLen = 32, fallback = 'Pemain'): string {
    if (typeof str !== 'string') return fallback;
    const clean = str
      .replace(/<[^>]*>?/gm, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
    return clean.slice(0, maxLen) || fallback;
  }

  /**
   * Generates a 6-character room code (e.g. "GAP789")
   */
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Creates a new multiplayer room with strict input validation.
   */
  createRoom(
    hostSocketId: string,
    hostName: string,
    options: { maxPlayers?: number; gameType?: GameType; targetScore?: number } = {}
  ): Room {
    // Check global capacity
    if (this.rooms.size >= this.MAX_ACTIVE_ROOMS) {
      this.cleanupStaleRooms();
      if (this.rooms.size >= this.MAX_ACTIVE_ROOMS) {
        throw new Error('Server sedang mencapai kapasitas maksimal. Silakan coba lagi beberapa saat.');
      }
    }

    // Leave previous room if any
    this.leaveRoom(hostSocketId);

    const code = this.generateRoomCode();
    const rawMax = Number(options?.maxPlayers);
    const maxPlayers = Number.isFinite(rawMax) ? Math.min(4, Math.max(2, rawMax)) : 4;
    const gameType = options?.gameType === 'nlgg' ? 'nlgg' : 'classic';
    const rawScore = Number(options?.targetScore);
    const targetScore = Number.isFinite(rawScore) ? Math.min(999, Math.max(1, rawScore)) : 100;

    const sanitizedHostName = this.sanitizeString(hostName, 32, 'Pemain 1');
    const hostPlayer: RoomPlayer = {
      id: 'p-1',
      socketId: hostSocketId,
      name: sanitizedHostName,
      isHost: true,
      isBot: false,
    };

    const room: Room = {
      code,
      hostSocketId,
      players: [hostPlayer],
      maxPlayers,
      gameType,
      targetScore,
      game: null,
      nlggGame: null,
      chatMessages: [],
      status: 'waiting',
      turnTimer: null,
      lastActivity: Date.now(),
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(hostSocketId, code);
    return room;
  }

  /**
   * Joins an existing room.
   */
  joinRoom(roomCode: string, socketId: string, playerName: string): Room {
    const upperCode = roomCode.toUpperCase().trim();
    const room = this.rooms.get(upperCode);
    if (!room) {
      throw new Error(`Room dengan kode ${upperCode} tidak ditemukan.`);
    }

    if (room.status === 'playing') {
      throw new Error('Pertandingan di room ini sudah dimulai.');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error(`Room sudah penuh (${room.maxPlayers} pemain).`);
    }

    // Leave any other room
    this.leaveRoom(socketId);

    const sanitizedPlayerName = this.sanitizeString(
      playerName,
      32,
      `Pemain ${room.players.length + 1}`
    );
    const newPlayerId = `p-${room.players.length + 1}`;
    const newPlayer: RoomPlayer = {
      id: newPlayerId,
      socketId,
      name: sanitizedPlayerName,
      isHost: false,
      isBot: false,
    };

    room.players.push(newPlayer);
    room.lastActivity = Date.now();
    this.socketToRoom.set(socketId, upperCode);
    return room;
  }

  /**
   * Adds an AI Bot to fill an empty slot in the waiting room.
   */
  addBot(roomCode: string, requestingSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room tidak ditemukan.');
    if (room.hostSocketId !== requestingSocketId) {
      throw new Error('Hanya Host yang bisa menambahkan Bot.');
    }
    if (room.status !== 'waiting') {
      throw new Error('Pertandingan di room ini sudah dimulai.');
    }
    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room sudah penuh.');
    }

    const botNames = ['Bot Siti', 'Bot Joko', 'Bot Rian', 'Bot Budi', 'Bot Dewi'];
    const usedNames = new Set(room.players.map(p => p.name));
    const availableName = botNames.find(n => !usedNames.has(n)) || `Bot ${room.players.length + 1}`;

    const botPlayer: RoomPlayer = {
      id: `p-${room.players.length + 1}`,
      socketId: '',
      name: availableName,
      isHost: false,
      isBot: true,
    };

    room.players.push(botPlayer);
    return room;
  }

  /**
   * Removes a player from a room upon disconnect or intentional leave.
   */
  leaveRoom(socketId: string): { room: Room | null; wasDeleted: boolean; roomCode: string | null } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { room: null, wasDeleted: false, roomCode: null };

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return { room: null, wasDeleted: false, roomCode };

    const departingPlayer = room.players.find(p => p.socketId === socketId);

    // If game is actively playing, convert departing player to Bot to avoid turn deadlocks
    if (room.status === 'playing' && departingPlayer) {
      departingPlayer.socketId = '';
      departingPlayer.isHost = false;
      departingPlayer.isBot = true;
      if (!departingPlayer.name.endsWith(' (Bot)')) {
        departingPlayer.name = `${departingPlayer.name} (Bot)`;
      }
      if (room.nlggGame) {
        room.nlggGame = {
          ...room.nlggGame,
          players: room.nlggGame.players.map(p =>
            p.id === departingPlayer.id
              ? { ...p, isBot: true, name: departingPlayer.name }
              : p
          ),
        };
      }
    } else {
      // Remove player
      room.players = room.players.filter(p => p.socketId !== socketId);

      // Re-index player IDs while in waiting room to prevent ID collisions and Classic engine desync
      if (room.status === 'waiting') {
        room.players.forEach((p, idx) => {
          p.id = `p-${idx + 1}`;
        });
      }
    }

    // If room is empty or only bots remain, delete it
    const remainingHumans = room.players.filter(p => !p.isBot);
    if (remainingHumans.length === 0) {
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
      }
      this.rooms.delete(roomCode);
      return { room: null, wasDeleted: true, roomCode };
    }

    // If host left, transfer host to next human player
    if (room.hostSocketId === socketId) {
      const nextHost = remainingHumans[0];
      nextHost.isHost = true;
      room.hostSocketId = nextHost.socketId;
    }

    return { room, wasDeleted: false, roomCode };
  }

  /**
   * Starts game within a room.
   */
  startGame(roomCode: string, requestingSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room tidak ditemukan.');
    if (room.hostSocketId !== requestingSocketId) {
      throw new Error('Hanya Host yang dapat memulai permainan.');
    }
    if (room.status !== 'waiting') {
      throw new Error('Pertandingan di room ini sudah dimulai.');
    }
    if (room.players.length < 2) {
      throw new Error('Dibutuhkan minimal 2 pemain untuk memulai.');
    }

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    // Ensure player IDs match positional indices p-1..p-N
    room.players.forEach((p, idx) => {
      p.id = `p-${idx + 1}`;
    });

    if (room.gameType === 'nlgg') {
      const playerConfigs = room.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
      }));
      room.nlggGame = createNLGGGame(playerConfigs);
      room.status = 'playing';
    } else {
      const playerNames = room.players.map(p => p.name);
      room.game = createGame(playerNames, { maxPenaltyPoints: room.targetScore });
      room.status = 'playing';
    }

    return room;
  }

  /**
   * NLGG: Blind Pick Card
   */
  nlggPickCard(roomCode: string, playerSocketId: string, cardId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGBlindPick(room.nlggGame, player.id, cardId);
    return room;
  }

  /**
   * NLGG: Propose Trade (Entire Hand Swap)
   */
  nlggProposeTrade(
    roomCode: string,
    playerSocketId: string,
    toPlayerId: string,
    fromCardId?: string,
    toCardId?: string
  ): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGProposeTrade(
      room.nlggGame,
      player.id,
      toPlayerId,
      fromCardId,
      toCardId
    );
    return room;
  }

  /**
   * NLGG: Respond to Trade Offer
   */
  nlggRespondTrade(
    roomCode: string,
    playerSocketId: string,
    accept: boolean
  ): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGRespondTrade(room.nlggGame, player.id, accept);
    return room;
  }

  /**
   * NLGG: Skip Trade
   */
  nlggSkipTrade(roomCode: string, playerSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGSkipTrade(room.nlggGame, player.id);
    return room;
  }

  /**
   * NLGG: Play Move
   */
  nlggPlayMove(
    roomCode: string,
    playerSocketId: string,
    cardId: string,
    targetEnd: EndSide
  ): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGPlayMove(room.nlggGame, player.id, cardId, targetEnd);
    return room;
  }

  /**
   * NLGG: Draw Turn (Cangkul Wajib)
   */
  nlggDrawTurn(
    roomCode: string,
    playerSocketId: string,
    preferredEnd?: EndSide
  ): { room: Room; result: DrawTurnResult } {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    const { state, result } = engineNLGGDrawTurn(
      room.nlggGame,
      player.id,
      preferredEnd
    );
    room.nlggGame = state;
    return { room, result };
  }

  /**
   * NLGG: Pass When Pool Empty
   */
  nlggPassPoolEmpty(roomCode: string, playerSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.nlggGame = engineNLGGPassPoolEmpty(room.nlggGame, player.id);
    return room;
  }

  /**
   * NLGG: Restart Game
   */
  nlggRestartGame(roomCode: string, requestingSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || room.gameType !== 'nlgg' || !room.nlggGame) {
      throw new Error('Game Ala NLGG belum berjalan.');
    }
    if (room.hostSocketId !== requestingSocketId) {
      throw new Error('Hanya Host yang dapat mengulang permainan.');
    }
    if (room.nlggGame.phase !== 'game_over') {
      throw new Error('Tidak dapat mengulang permainan sebelum permainan selesai.');
    }
    if (room.players.length < 2) {
      throw new Error('Dibutuhkan minimal 2 pemain untuk memulai.');
    }

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    const playerConfigs = room.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
    }));
    room.nlggGame = createNLGGGame(playerConfigs);
    room.status = 'playing';
    return room;
  }

  /**
   * Plays a move for a player.
   */
  playMove(
    roomCode: string,
    playerSocketId: string,
    tile: Tile,
    targetEnd: EndSide
  ): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) throw new Error('Game belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.game = enginePlayMove(room.game, player.id, tile, targetEnd);
    return room;
  }

  /**
   * Passes turn for a player.
   */
  passTurn(roomCode: string, playerSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) throw new Error('Game belum berjalan.');

    const player = room.players.find(p => p.socketId === playerSocketId);
    if (!player) throw new Error('Pemain tidak terdaftar di room ini.');

    room.game = enginePassTurn(room.game, player.id);
    return room;
  }

  /**
   * Proceeds to the next round (Classic).
   */
  nextRound(roomCode: string, requestingSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.game) throw new Error('Game belum berjalan.');
    if (room.hostSocketId !== requestingSocketId) {
      throw new Error('Hanya Host yang dapat melanjutkan ke ronde berikutnya.');
    }

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    room.game = engineStartNextRound(room.game);
    return room;
  }

  /**
   * NLGG: Proceeds to the next round.
   */
  nlggNextRound(roomCode: string, requestingSocketId: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room || !room.nlggGame) throw new Error('Game Ala NLGG belum berjalan.');
    if (room.hostSocketId !== requestingSocketId) {
      throw new Error('Hanya Host yang dapat melanjutkan ke ronde berikutnya.');
    }
    if (room.nlggGame.phase !== 'game_over') {
      throw new Error('Tidak dapat memulai ronde baru sebelum permainan selesai.');
    }

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    const playerConfigs = room.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
    }));
    room.nlggGame = createNLGGGame(playerConfigs);
    room.status = 'playing';
    return room;
  }

  /**
   * Broadcasts a quick chat message.
   */
  addChatMessage(
    roomCode: string,
    senderSocketId: string,
    text: string
  ): { room: Room; message: ChatMessage } {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room tidak ditemukan.');

    const player = room.players.find(p => p.socketId === senderSocketId);
    if (!player) {
      throw new Error('Pemain tidak terdaftar di room ini.');
    }
    const senderName = player.name;
    const senderId = player.id;

    const cleanText = this.sanitizeString(text, 100, '');
    if (!cleanText) {
      throw new Error('Pesan chat tidak boleh kosong.');
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderName,
      senderId,
      text: cleanText,
      timestamp: Date.now(),
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 50) {
      room.chatMessages.shift();
    }
    room.lastActivity = Date.now();

    return { room, message };
  }

  /**
   * Scans and removes inactive rooms to reclaim memory and prevent DoS.
   */
  cleanupStaleRooms(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, room] of this.rooms.entries()) {
      // Waiting room inactive > 15 mins OR playing room inactive > 45 mins OR 0 human players
      const isWaitingStale = room.status === 'waiting' && now - room.lastActivity > 15 * 60 * 1000;
      const isPlayingStale = room.status === 'playing' && now - room.lastActivity > 45 * 60 * 1000;
      const noHumans = room.players.filter(p => !p.isBot).length === 0;

      if (isWaitingStale || isPlayingStale || noHumans) {
        if (room.turnTimer) {
          clearTimeout(room.turnTimer);
          room.turnTimer = null;
        }
        for (const p of room.players) {
          if (p.socketId) this.socketToRoom.delete(p.socketId);
        }
        this.rooms.delete(code);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Finds room by room code.
   */
  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase().trim());
  }

  /**
   * Finds room code by socket ID.
   */
  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }
}

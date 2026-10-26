import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RoomManager } from '../src/server/roomManager.ts';
import { respondTrade, skipTrade, toClientNLGGView } from '../src/nlgg/engine.ts';
import { toClientView } from '../src/engine.ts';

describe('Security & Integrity Regression Tests', () => {
  test('Fix 1 & 7: leaveRoom returns roomCode and re-indexes waiting players to prevent ID collision', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-1', 'Alice');
    rm.joinRoom(room.code, 'socket-2', 'Bob');

    // Alice leaves while waiting
    const leaveResult = rm.leaveRoom('socket-1');
    assert.strictEqual(leaveResult.roomCode, room.code);
    assert.strictEqual(leaveResult.wasDeleted, false);

    // Remaining player (Bob) should be re-indexed to p-1
    assert.strictEqual(room.players.length, 1);
    assert.strictEqual(room.players[0].id, 'p-1');
    assert.strictEqual(room.players[0].isHost, true);

    // Charlie joins -> receives p-2 (no collision!)
    rm.joinRoom(room.code, 'socket-3', 'Charlie');
    assert.strictEqual(room.players.length, 2);
    assert.strictEqual(room.players[0].id, 'p-1');
    assert.strictEqual(room.players[1].id, 'p-2');
  });

  test('Fix 3: Classic and NLGG mode seat synchronization after player leaves lobby', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-1', 'Host', { maxPlayers: 3, gameType: 'classic' });
    rm.joinRoom(room.code, 'socket-2', 'Bob');
    rm.joinRoom(room.code, 'socket-3', 'Charlie');

    // Host leaves lobby
    rm.leaveRoom('socket-1');

    // Bob starts game -> players re-indexed to p-1 and p-2, matching Classic engine IDs
    const started = rm.startGame(room.code, 'socket-2');
    assert.strictEqual(started.players[0].id, 'p-1');
    assert.strictEqual(started.players[1].id, 'p-2');
    assert.strictEqual(started.game!.players[0].id, 'p-1');
    assert.strictEqual(started.game!.players[1].id, 'p-2');

    // Anti-cheat projection: Bob sees own hand, Charlie's hand is masked (undefined)
    const bobView = toClientView(started.game!, 'p-1');
    assert.ok(bobView.players.find(p => p.id === 'p-1')!.hand!.length > 0);
    assert.strictEqual(bobView.players.find(p => p.id === 'p-2')!.hand, undefined);
  });

  test('Fix 4: NLGG trade cannot be skipped while pending, and respondTrade rejects playing phase', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-1', 'Host', { maxPlayers: 2, gameType: 'nlgg' });
    rm.joinRoom(room.code, 'socket-2', 'Guest');
    rm.startGame(room.code, 'socket-1');

    // Pick 7 cards each to enter blind_trade
    for (let i = 0; i < 7; i++) {
      rm.nlggPickCard(room.code, 'socket-1', room.nlggGame!.tableScatteredCards[0].id);
      rm.nlggPickCard(room.code, 'socket-2', room.nlggGame!.tableScatteredCards[0].id);
    }
    assert.strictEqual(room.nlggGame!.phase, 'blind_trade');

    // Propose trade
    rm.nlggProposeTrade(room.code, 'socket-1', 'p-2');

    // Cannot skip trade while offer is pending
    assert.throws(
      () => rm.nlggSkipTrade(room.code, 'socket-1'),
      /Cannot skip trade while a trade offer is pending/
    );

    // Reject trade to conclude trade offer
    rm.nlggRespondTrade(room.code, 'socket-2', false);

    // Both skip trade to enter playing phase
    rm.nlggSkipTrade(room.code, 'socket-1');
    rm.nlggSkipTrade(room.code, 'socket-2');
    assert.strictEqual(room.nlggGame!.phase, 'playing');

    // Attempting respondTrade during playing phase is rejected
    assert.throws(
      () => respondTrade(room.nlggGame!, 'p-2', true),
      /Cannot respond to trade in phase: playing/
    );
  });

  test('Fix 5: Mid-game player departure converts seat to Bot to prevent deadlocks', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-1', 'Alice', { maxPlayers: 2, gameType: 'classic' });
    rm.joinRoom(room.code, 'socket-2', 'Bob');
    rm.startGame(room.code, 'socket-1');
    assert.strictEqual(room.status, 'playing');

    // Bob disconnects mid-game
    const result = rm.leaveRoom('socket-2');
    assert.strictEqual(result.wasDeleted, false);

    // Seat is retained as Bot
    const bobSeat = room.players.find(p => p.id === 'p-2');
    assert.ok(bobSeat);
    assert.strictEqual(bobSeat.isBot, true);
    assert.strictEqual(bobSeat.socketId, '');
    assert.ok(bobSeat.name.includes('(Bot)'));
  });

  test('Fix 6: Guard active games against unauthorized restart, start_game, and addBot mid-match', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-1', 'Host', { maxPlayers: 3, gameType: 'nlgg' });
    rm.joinRoom(room.code, 'socket-2', 'Guest');
    rm.startGame(room.code, 'socket-1');
    assert.strictEqual(room.status, 'playing');

    // Mid-game startGame is blocked
    assert.throws(
      () => rm.startGame(room.code, 'socket-1'),
      /Pertandingan di room ini sudah dimulai/
    );

    // Mid-game addBot is blocked
    assert.throws(
      () => rm.addBot(room.code, 'socket-1'),
      /Pertandingan di room ini sudah dimulai/
    );

    // Mid-game nlggRestartGame is blocked
    assert.throws(
      () => rm.nlggRestartGame(room.code, 'socket-1'),
      /Tidak dapat mengulang permainan sebelum permainan selesai/
    );
  });

  test('Hardening: Player names truncated to 32 characters and options sanitized', () => {
    const rm = new RoomManager();
    const superLongName = 'A'.repeat(100);
    const room = rm.createRoom('socket-1', superLongName, {
      maxPlayers: 999, // exceeds 4
      targetScore: -50, // invalid negative
    });

    assert.strictEqual(room.players[0].name.length, 32);
    assert.strictEqual(room.maxPlayers, 4);
    assert.strictEqual(room.targetScore, 1);

    const updated = rm.joinRoom(room.code, 'socket-2', 'B'.repeat(80));
    assert.strictEqual(updated.players[1].name.length, 32);
  });
});

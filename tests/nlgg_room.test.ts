import { test, describe } from 'node:test';
import assert from 'node:assert';
import { RoomManager } from '../src/server/roomManager.ts';
import { toClientNLGGView } from '../src/nlgg/engine.ts';

describe('Ala NLGG Multiplayer Room Flow', () => {
  test('creates room with gameType nlgg and allows friends to join', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-host', 'Andi (Host)', {
      maxPlayers: 4,
      gameType: 'nlgg',
    });

    assert.strictEqual(room.gameType, 'nlgg');
    assert.strictEqual(room.players.length, 1);
    assert.strictEqual(room.players[0].name, 'Andi (Host)');
    assert.strictEqual(room.status, 'waiting');

    // Friend joins
    const updated = rm.joinRoom(room.code, 'socket-friend', 'Budi (Teman)');
    assert.strictEqual(updated.players.length, 2);
    assert.strictEqual(updated.players[1].name, 'Budi (Teman)');

    // Add 2 bots to fill 4 players
    rm.addBot(room.code, 'socket-host');
    rm.addBot(room.code, 'socket-host');
    assert.strictEqual(room.players.length, 4);

    // Host starts NLGG game
    const started = rm.startGame(room.code, 'socket-host');
    assert.strictEqual(started.status, 'playing');
    assert.ok(started.nlggGame);
    assert.strictEqual(started.nlggGame.phase, 'blind_pick');
    assert.strictEqual(started.nlggGame.tableScatteredCards.length, 56);
    assert.strictEqual(started.nlggGame.players.length, 4);
  });

  test('players can blind pick cards and trade in multiplayer room', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-p1', 'Player 1', {
      maxPlayers: 2,
      gameType: 'nlgg',
    });
    rm.joinRoom(room.code, 'socket-p2', 'Player 2');
    rm.startGame(room.code, 'socket-p1');

    // Both players pick 7 cards
    for (let i = 0; i < 7; i++) {
      const cardForP1 = room.nlggGame!.tableScatteredCards[0].id;
      rm.nlggPickCard(room.code, 'socket-p1', cardForP1);

      const cardForP2 = room.nlggGame!.tableScatteredCards[0].id;
      rm.nlggPickCard(room.code, 'socket-p2', cardForP2);
    }

    assert.strictEqual(room.nlggGame!.phase, 'blind_trade');
    assert.strictEqual(room.nlggGame!.players[0].hand.length, 7);
    assert.strictEqual(room.nlggGame!.players[1].hand.length, 7);

    // Anti-cheat view ensures Player 1 cannot see tile values
    const clientViewP1 = toClientNLGGView(room.nlggGame!, 'p-1');
    assert.strictEqual(clientViewP1.phase, 'blind_trade');
    assert.strictEqual(clientViewP1.players[0].hand[0].tile, undefined);
    assert.strictEqual(clientViewP1.players[1].hand[0].tile, undefined);

    // Player 1 proposes full-hand trade to Player 2
    rm.nlggProposeTrade(room.code, 'socket-p1', 'p-2');

    assert.ok(room.nlggGame!.activeTradeOffer);
    assert.strictEqual(room.nlggGame!.activeTradeOffer.fromPlayerId, 'p-1');
    assert.strictEqual(room.nlggGame!.activeTradeOffer.toPlayerId, 'p-2');

    // Player 2 accepts trade
    rm.nlggRespondTrade(room.code, 'socket-p2', true);

    // Player 2 uses skipTrade to finish trade phase
    rm.nlggSkipTrade(room.code, 'socket-p2');

    // All acted -> transitions automatically to reveal & playing!
    assert.strictEqual(room.nlggGame!.phase, 'playing');
    assert.strictEqual(room.nlggGame!.drawPool.length, 56 - 14);

    // Now in playing phase, Player 1 CAN see their own tiles, but NOT Player 2 tiles
    const clientViewPlayingP1 = toClientNLGGView(room.nlggGame!, 'p-1');
    assert.ok(clientViewPlayingP1.players[0].hand[0].tile !== undefined);
    assert.strictEqual(clientViewPlayingP1.players[1].hand[0].tile, undefined);
  });

  test('security: prevents predictable card IDs, unauthorized next_round reset, and trade hijacking', () => {
    const rm = new RoomManager();
    const room = rm.createRoom('socket-host', 'Host', {
      maxPlayers: 3,
      gameType: 'nlgg',
    });
    rm.joinRoom(room.code, 'socket-p2', 'Player 2');
    rm.joinRoom(room.code, 'socket-p3', 'Player 3');
    rm.startGame(room.code, 'socket-host');

    // 1. Ensure card IDs are opaque and do not contain pip values like 'card-A-6-6'
    const hasPredictableId = room.nlggGame!.tableScatteredCards.some(c =>
      /^card-[AB]-\d-\d$/.test(c.id)
    );
    assert.strictEqual(hasPredictableId, false, 'Card IDs must be opaque UUIDs');

    // 2. Ensure non-host or mid-game nlggNextRound is rejected
    assert.throws(
      () => rm.nlggNextRound(room.code, 'socket-p2'),
      /Hanya Host/
    );
    assert.throws(
      () => rm.nlggNextRound(room.code, 'socket-host'),
      /sebelum permainan selesai/
    );

    // 3. Pick 7 cards each and test trade overwrite protection
    for (let i = 0; i < 7; i++) {
      rm.nlggPickCard(room.code, 'socket-host', room.nlggGame!.tableScatteredCards[0].id);
      rm.nlggPickCard(room.code, 'socket-p2', room.nlggGame!.tableScatteredCards[0].id);
      rm.nlggPickCard(room.code, 'socket-p3', room.nlggGame!.tableScatteredCards[0].id);
    }

    assert.strictEqual(room.nlggGame!.phase, 'blind_trade');
    rm.nlggProposeTrade(room.code, 'socket-host', 'p-2');

    // Player 3 cannot overwrite pending trade offer
    assert.throws(
      () => rm.nlggProposeTrade(room.code, 'socket-p3', 'p-1'),
      /Another trade offer is currently pending/
    );
  });
});

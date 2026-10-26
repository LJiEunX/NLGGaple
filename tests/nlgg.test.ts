import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  generateDoubleDeck,
  createNLGGGame,
  blindPickCard,
  autoBlindPickAll,
  proposeTrade,
  respondTrade,
  skipTrade,
  executeRevealPhase,
  playMove,
  drawTurn,
  passWhenPoolEmpty,
  resolveNLGGDeadlock,
  toClientNLGGView,
} from '../src/nlgg/engine.ts';
import type { NLGGState } from '../src/nlgg/types.ts';

describe('Ala NLGG Deck & Setup', () => {
  test('generates exactly 56 unique cards across 2 decks', () => {
    const deck = generateDoubleDeck();
    assert.strictEqual(deck.length, 56);

    const deckA = deck.filter(c => c.deck === 'A');
    const deckB = deck.filter(c => c.deck === 'B');
    assert.strictEqual(deckA.length, 28);
    assert.strictEqual(deckB.length, 28);

    // Ensure all 56 card IDs are unique
    const idSet = new Set(deck.map(c => c.id));
    assert.strictEqual(idSet.size, 56);
  });

  test('createNLGGGame starts in blind_pick with 56 scattered cards', () => {
    const game = createNLGGGame([
      { name: 'Pemain 1' },
      { name: 'Pemain 2' },
      { name: 'Pemain 3' },
      { name: 'Pemain 4' },
    ]);

    assert.strictEqual(game.phase, 'blind_pick');
    assert.strictEqual(game.players.length, 4);
    assert.strictEqual(game.tableScatteredCards.length, 56);
    for (const p of game.players) {
      assert.strictEqual(p.hand.length, 0);
      assert.strictEqual(p.revealed, false);
      assert.strictEqual(p.tradeQuota, 1);
    }
  });
});

describe('Ala NLGG Blind Pick & Trade Phases', () => {
  test('blindPickCard adds face-down card to player hand', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    const firstCard = game.tableScatteredCards[0];

    game = blindPickCard(game, 'p-1', firstCard.id);
    assert.strictEqual(game.players[0].hand.length, 1);
    assert.strictEqual(game.players[0].hand[0].id, firstCard.id);
    assert.strictEqual(game.tableScatteredCards.length, 55);
  });

  test('autoBlindPickAll fills all players with 7 cards and transitions to blind_trade', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }, { name: 'P3' }, { name: 'P4' }]);
    game = autoBlindPickAll(game);

    assert.strictEqual(game.phase, 'blind_trade');
    for (const p of game.players) {
      assert.strictEqual(p.hand.length, 7);
      assert.strictEqual(p.revealed, false);
    }
    // 56 - (4 * 7) = 28 remaining on table
    assert.strictEqual(game.tableScatteredCards.length, 28);
  });

  test('proposing and accepting a trade swaps the entire 7 face-down cards', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    game = autoBlindPickAll(game);

    const p1HandBefore = game.players[0].hand.map(c => c.id);
    const p2HandBefore = game.players[1].hand.map(c => c.id);

    // P1 proposes trade to P2
    game = proposeTrade(game, 'p-1', 'p-2');
    assert.ok(game.activeTradeOffer);
    assert.strictEqual(game.activeTradeOffer.tradeType, 'full_hand');

    // P2 accepts
    game = respondTrade(game, 'p-2', true);

    // Verify full hand swap
    const p1HandAfter = game.players[0].hand.map(c => c.id);
    const p2HandAfter = game.players[1].hand.map(c => c.id);
    assert.deepStrictEqual(p1HandAfter, p2HandBefore);
    assert.deepStrictEqual(p2HandAfter, p1HandBefore);

    // P1 quota is now 0 and marked acted
    assert.strictEqual(game.players[0].tradeQuota, 0);
    assert.strictEqual(game.players[0].hasActedTrade, true);
  });

  test('rejecting a trade burns initiator quota without swapping cards', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    game = autoBlindPickAll(game);

    const p1HandBefore = game.players[0].hand.map(c => c.id);
    const p2HandBefore = game.players[1].hand.map(c => c.id);

    game = proposeTrade(game, 'p-1', 'p-2');
    game = respondTrade(game, 'p-2', false); // Reject!

    // No swap
    assert.deepStrictEqual(game.players[0].hand.map(c => c.id), p1HandBefore);
    assert.deepStrictEqual(game.players[1].hand.map(c => c.id), p2HandBefore);

    // Quota burned
    assert.strictEqual(game.players[0].tradeQuota, 0);
    assert.strictEqual(game.players[0].hasActedTrade, true);
  });

  test('when all players resolve trade, game transitions to reveal and playing phase', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    game = autoBlindPickAll(game);

    game = skipTrade(game, 'p-1');
    game = skipTrade(game, 'p-2');

    assert.strictEqual(game.phase, 'playing');
    assert.strictEqual(game.players[0].revealed, true);
    assert.strictEqual(game.players[1].revealed, true);
    // Draw pool has 56 - 14 = 42 cards
    assert.strictEqual(game.drawPool.length, 42);
    assert.strictEqual(game.tableScatteredCards.length, 0);
  });
});

describe('Ala NLGG Turn & Draw Mechanics (Cangkul Wajib)', () => {
  test('drawTurn auto-plays matching card immediately', () => {
    // Construct scenario: Board has ends 3 and 5.
    // Active player P1 has no matching cards ([0,0], [1,1]).
    // Next card in drawPool is [5, 6] (matches right end 5).
    const state: NLGGState = {
      id: 'test-draw-play',
      players: [
        {
          id: 'p-1',
          name: 'P1',
          hand: [
            { id: 'c-1', tile: [0, 0], deck: 'A' },
            { id: 'c-2', tile: [1, 1], deck: 'A' },
          ],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
        {
          id: 'p-2',
          name: 'P2',
          hand: [{ id: 'c-3', tile: [2, 2], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
      ],
      tableScatteredCards: [],
      drawPool: [{ id: 'c-match', tile: [5, 6], deck: 'B' }],
      board: {
        leftEnd: 3,
        rightEnd: 5,
        chain: [{ tile: [3, 5], facing: [3, 5], isBalak: false }],
      },
      phase: 'playing',
      activeTradeOffer: null,
      currentTradePlayerIndex: 0,
      currentPlayerIndex: 0,
      consecutivePasses: 0,
      winnerId: null,
      winReason: null,
    };

    const { state: updated, result } = drawTurn(state, 'p-1');

    assert.strictEqual(result.isPlayable, true);
    assert.strictEqual(result.actionTaken, 'played');
    assert.strictEqual(result.playedEnd, 'right');
    // Board right end is now 6
    assert.strictEqual(updated.board.rightEnd, 6);
    // Card was NOT kept in hand (P1 hand still 2 cards)
    assert.strictEqual(updated.players[0].hand.length, 2);
    // Draw pool is now 0
    assert.strictEqual(updated.drawPool.length, 0);
    // Turn advanced to P2
    assert.strictEqual(updated.currentPlayerIndex, 1);
  });

  test('drawTurn adds unmatching card to hand and passes turn to next player', () => {
    // Board ends: 3 and 5.
    // Draw card is [2, 4] (does not match 3 or 5).
    const state: NLGGState = {
      id: 'test-draw-pass',
      players: [
        {
          id: 'p-1',
          name: 'P1',
          hand: [{ id: 'c-1', tile: [0, 0], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
        {
          id: 'p-2',
          name: 'P2',
          hand: [{ id: 'c-3', tile: [2, 2], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
      ],
      tableScatteredCards: [],
      drawPool: [{ id: 'c-unmatch', tile: [2, 4], deck: 'B' }],
      board: {
        leftEnd: 3,
        rightEnd: 5,
        chain: [{ tile: [3, 5], facing: [3, 5], isBalak: false }],
      },
      phase: 'playing',
      activeTradeOffer: null,
      currentTradePlayerIndex: 0,
      currentPlayerIndex: 0,
      consecutivePasses: 0,
      winnerId: null,
      winReason: null,
    };

    const { state: updated, result } = drawTurn(state, 'p-1');

    assert.strictEqual(result.isPlayable, false);
    assert.strictEqual(result.actionTaken, 'added_to_hand_and_passed');
    // Card was added to P1 hand (now 2 cards)
    assert.strictEqual(updated.players[0].hand.length, 2);
    assert.strictEqual(updated.players[0].hand.some(c => c.id === 'c-unmatch'), true);
    // Consecutive passes incremented
    assert.strictEqual(updated.consecutivePasses, 1);
    // Turn advanced to P2
    assert.strictEqual(updated.currentPlayerIndex, 1);
  });
});

describe('Ala NLGG Endgame Conditions', () => {
  test('normal win triggers when hand reaches 0', () => {
    let state: NLGGState = {
      id: 'test-win',
      players: [
        {
          id: 'p-1',
          name: 'P1',
          hand: [{ id: 'c-last', tile: [5, 6], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
        {
          id: 'p-2',
          name: 'P2',
          hand: [{ id: 'c-other', tile: [1, 2], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
      ],
      tableScatteredCards: [],
      drawPool: [],
      board: {
        leftEnd: 1,
        rightEnd: 5,
        chain: [{ tile: [1, 5], facing: [1, 5], isBalak: false }],
      },
      phase: 'playing',
      activeTradeOffer: null,
      currentTradePlayerIndex: 0,
      currentPlayerIndex: 0,
      consecutivePasses: 0,
      winnerId: null,
      winReason: null,
    };

    state = playMove(state, 'p-1', 'c-last', 'right');

    assert.strictEqual(state.phase, 'game_over');
    assert.strictEqual(state.winnerId, 'p-1');
    assert.strictEqual(state.winReason, 'normal');
  });

  test('buntu deadlock triggers when draw pool is empty and all pass, lowest pips wins', () => {
    // Board ends: 0 and 0.
    // Pool is empty (0).
    // P1 has [2, 2] = 4 pips.
    // P2 has [5, 6] = 11 pips.
    let state: NLGGState = {
      id: 'test-buntu',
      players: [
        {
          id: 'p-1',
          name: 'P1',
          hand: [{ id: 'c-1', tile: [2, 2], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
        {
          id: 'p-2',
          name: 'P2',
          hand: [{ id: 'c-2', tile: [5, 6], deck: 'A' }],
          revealed: true,
          tradeQuota: 0,
          hasActedTrade: true,
          isBot: false,
        },
      ],
      tableScatteredCards: [],
      drawPool: [],
      board: {
        leftEnd: 0,
        rightEnd: 0,
        chain: [{ tile: [0, 0], facing: [0, 0], isBalak: true }],
      },
      phase: 'playing',
      activeTradeOffer: null,
      currentTradePlayerIndex: 0,
      currentPlayerIndex: 0,
      consecutivePasses: 0,
      winnerId: null,
      winReason: null,
    };

    // P1 passes
    state = passWhenPoolEmpty(state, 'p-1');
    assert.strictEqual(state.phase, 'playing');
    assert.strictEqual(state.consecutivePasses, 1);

    // P2 passes -> Buntu!
    state = passWhenPoolEmpty(state, 'p-2');
    assert.strictEqual(state.phase, 'game_over');
    assert.strictEqual(state.winReason, 'buntu');
    assert.strictEqual(state.winnerId, 'p-1'); // P1 wins with 4 pips vs 11 pips
    assert.strictEqual(state.pipScores?.['p-1'], 4);
    assert.strictEqual(state.pipScores?.['p-2'], 11);
  });
});

describe('Ala NLGG Anti-Cheat Client Projection', () => {
  test('masks unrevealed cards in blind_pick and blind_trade', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    game = autoBlindPickAll(game);

    const clientView = toClientNLGGView(game, 'p-1');

    // Neither P1 nor P2 should have revealed tile values during blind_trade
    for (const p of clientView.players) {
      for (const c of p.hand) {
        assert.strictEqual(c.tile, undefined);
      }
    }
  });

  test('in playing phase, player sees their own tiles but opponent tiles are masked', () => {
    let game = createNLGGGame([{ name: 'P1' }, { name: 'P2' }]);
    game = autoBlindPickAll(game);
    game = skipTrade(game, 'p-1');
    game = skipTrade(game, 'p-2'); // Now phase is 'playing'

    const clientView = toClientNLGGView(game, 'p-1');

    // P1 sees their own tiles
    const p1 = clientView.players.find(p => p.id === 'p-1')!;
    for (const c of p1.hand) {
      assert.ok(c.tile !== undefined);
      assert.strictEqual(Array.isArray(c.tile), true);
    }

    // P1 cannot see P2 tiles!
    const p2 = clientView.players.find(p => p.id === 'p-2')!;
    for (const c of p2.hand) {
      assert.strictEqual(c.tile, undefined);
    }
  });
});

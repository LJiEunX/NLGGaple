import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  generateDeck,
  areTilesEqual,
  dealCards,
  calculateHandPips,
} from '../src/deck.ts';
import {
  createEmptyBoard,
  getTilePlayableEnds,
  placeTileOnBoard,
  getAvailableMoves,
} from '../src/board.ts';
import {
  createGame,
  playMove,
  passTurn,
  toClientView,
} from '../src/engine.ts';
import type { Tile, GameState } from '../src/types.ts';

describe('Gaple Deck Logic', () => {
  test('generates exactly 28 unique tiles', () => {
    const deck = generateDeck();
    assert.strictEqual(deck.length, 28);

    // Verify all pairs are unique
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        assert.strictEqual(
          areTilesEqual(deck[i], deck[j]),
          false,
          `Duplicate tile found: ${deck[i]} and ${deck[j]}`
        );
      }
    }
  });

  test('dealCards gives 7 tiles to 4 players and leaves 0 in boneyard', () => {
    const deck = generateDeck();
    const { hands, boneyard } = dealCards(deck, 4);

    assert.strictEqual(hands.length, 4);
    for (const hand of hands) {
      assert.strictEqual(hand.length, 7);
    }
    assert.strictEqual(boneyard.length, 0);
  });

  test('dealCards gives 7 tiles to 2 players and leaves 14 in boneyard', () => {
    const deck = generateDeck();
    const { hands, boneyard } = dealCards(deck, 2);

    assert.strictEqual(hands.length, 2);
    assert.strictEqual(hands[0].length, 7);
    assert.strictEqual(hands[1].length, 7);
    assert.strictEqual(boneyard.length, 14);
  });
});

describe('Gaple Board Mechanics', () => {
  test('empty board accepts any tile on either end', () => {
    const board = createEmptyBoard();
    const playable = getTilePlayableEnds([3, 5], board);
    assert.deepStrictEqual(playable, ['left', 'right']);

    const updated = placeTileOnBoard(board, [3, 5], 'right');
    assert.strictEqual(updated.leftEnd, 3);
    assert.strictEqual(updated.rightEnd, 5);
    assert.strictEqual(updated.chain.length, 1);
  });

  test('placing matching tile on left end updates left end', () => {
    let board = createEmptyBoard();
    board = placeTileOnBoard(board, [3, 5], 'right'); // ends: 3 ... 5

    // Tile [3, 1] matches leftEnd (3), new leftEnd becomes 1
    const ends = getTilePlayableEnds([3, 1], board);
    assert.strictEqual(ends.includes('left'), true);

    board = placeTileOnBoard(board, [3, 1], 'left');
    assert.strictEqual(board.leftEnd, 1);
    assert.strictEqual(board.rightEnd, 5);
    assert.strictEqual(board.chain.length, 2);
  });

  test('placing unmatching tile throws error', () => {
    let board = createEmptyBoard();
    board = placeTileOnBoard(board, [3, 5], 'right'); // ends: 3 ... 5

    assert.throws(() => {
      placeTileOnBoard(board, [2, 4], 'left');
    });
  });
});

describe('Gaple Game Engine Flow', () => {
  test('creates game and sets up players', () => {
    const game = createGame(['Andi', 'Budi', 'Caca', 'Doni']);
    assert.strictEqual(game.players.length, 4);
    assert.strictEqual(game.status, 'in_progress');
    assert.strictEqual(game.currentPlayerIndex >= 0 && game.currentPlayerIndex < 4, true);
  });

  test('anti-cheat projection hides other players hands', () => {
    const game = createGame(['Andi', 'Budi']);
    const clientView = toClientView(game, 'p-1');

    // p-1 should see their own hand
    const p1 = clientView.players.find(p => p.id === 'p-1');
    assert.ok(p1?.hand);
    assert.strictEqual(p1.hand.length, 7);

    // p-2 hand must be hidden (undefined)
    const p2 = clientView.players.find(p => p.id === 'p-2');
    assert.strictEqual(p2?.hand, undefined);
    assert.strictEqual(p2?.handCount, 7);
  });

  test('prevents passing turn if player has valid moves', () => {
    const game: GameState = {
      id: 'test-game',
      players: [
        { id: 'p-1', name: 'Andi', hand: [[3, 5], [6, 6]], score: 0 },
        { id: 'p-2', name: 'Budi', hand: [[2, 4]], score: 0 },
      ],
      currentPlayerIndex: 0,
      board: { leftEnd: 3, rightEnd: 5, chain: [] },
      boneyard: [],
      status: 'in_progress',
      consecutivePasses: 0,
      turnTimeoutSeconds: 15,
      maxPenaltyPoints: 100,
      roundNumber: 1,
    };

    // p-1 has [3, 5] which can play, passing should throw
    assert.throws(() => {
      passTurn(game, 'p-1');
    }, /cannot pass/);
  });

  test('triggers Gaple victory when a player exhausts their hand', () => {
    let game: GameState = {
      id: 'test-gaple',
      players: [
        { id: 'p-1', name: 'Andi', hand: [[5, 6]], score: 0 },
        { id: 'p-2', name: 'Budi', hand: [[1, 2], [3, 4]], score: 0 }, // remaining pips: (1+2) + (3+4) = 10
      ],
      currentPlayerIndex: 0,
      board: { leftEnd: 1, rightEnd: 5, chain: [] },
      boneyard: [],
      status: 'in_progress',
      consecutivePasses: 0,
      turnTimeoutSeconds: 15,
      maxPenaltyPoints: 100,
      roundNumber: 1,
    };

    // p-1 plays [5, 6] on right end (5)
    game = playMove(game, 'p-1', [5, 6], 'right');

    assert.strictEqual(game.status, 'round_ended');
    assert.strictEqual(game.roundResult?.winnerId, 'p-1');
    assert.strictEqual(game.roundResult?.reason, 'gaple');
    // Winner Andi should get 10 points (sum of opponents' remaining pips)
    const andi = game.players.find(p => p.id === 'p-1');
    assert.strictEqual(andi?.score, 10);
  });

  test('triggers Buntu (Dead-End) when all players pass, winner is lowest pips', () => {
    let game: GameState = {
      id: 'test-buntu',
      players: [
        // Board ends are 0 and 0. Neither player can move.
        // p-1 has [1, 1] = 2 pips
        // p-2 has [4, 5] = 9 pips
        { id: 'p-1', name: 'Andi', hand: [[1, 1]], score: 0 },
        { id: 'p-2', name: 'Budi', hand: [[4, 5]], score: 0 },
      ],
      currentPlayerIndex: 0,
      board: {
        leftEnd: 0,
        rightEnd: 0,
        chain: [{ tile: [0, 0], facing: [0, 0], isBalak: true }],
      },
      boneyard: [],
      status: 'in_progress',
      consecutivePasses: 0,
      turnTimeoutSeconds: 15,
      maxPenaltyPoints: 100,
      roundNumber: 1,
    };

    // p-1 passes
    game = passTurn(game, 'p-1');
    assert.strictEqual(game.status, 'in_progress');
    assert.strictEqual(game.consecutivePasses, 1);
    assert.strictEqual(game.currentPlayerIndex, 1);

    // p-2 passes -> Buntu!
    game = passTurn(game, 'p-2');
    assert.strictEqual(game.status, 'round_ended');
    assert.strictEqual(game.roundResult?.reason, 'buntu');
    assert.strictEqual(game.roundResult?.winnerId, 'p-1'); // p-1 has fewer pips (2 vs 9)
    assert.strictEqual(game.roundResult?.penalties['p-2'], 9);
    // Winner Andi should receive Budi's 9 pips
    const andi = game.players.find(p => p.id === 'p-1');
    assert.strictEqual(andi?.score, 9);
  });
});

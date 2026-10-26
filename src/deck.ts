import type { Tile, Player } from './types.ts';

/**
 * Generates the standard 28-card Domino deck.
 * Pairs range from [0, 0] up to [6, 6].
 */
export function generateDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  return deck;
}

/**
 * Generates a cryptographically secure random integer in [0, max).
 */
function secureRandomInt(max: number): number {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Standard Fisher-Yates shuffle algorithm using CSPRNG.
 */
export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Checks if two tiles are identical, regardless of order:
 * e.g. [2, 5] equals [5, 2].
 */
export function areTilesEqual(a: Tile, b: Tile): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

/**
 * Checks if a tile is a double / balak (e.g. [6, 6]).
 */
export function isBalak(tile: Tile): boolean {
  return tile[0] === tile[1];
}

/**
 * Calculates total pips (dots) of a single tile.
 */
export function getTilePipSum(tile: Tile): number {
  return tile[0] + tile[1];
}

/**
 * Calculates sum of pips for a player's remaining hand.
 */
export function calculateHandPips(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + getTilePipSum(tile), 0);
}

/**
 * Deals 7 tiles to each player (up to 4 players).
 * Remaining cards become the boneyard (for 2-3 players).
 */
export function dealCards(
  deck: Tile[],
  playerCount: number
): { hands: Tile[][]; boneyard: Tile[] } {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Gaple requires 2 to 4 players.');
  }

  const hands: Tile[][] = Array.from({ length: playerCount }, () => []);
  const tilesPerPlayer = 7;
  let deckIndex = 0;

  for (let round = 0; round < tilesPerPlayer; round++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck[deckIndex++]);
    }
  }

  const boneyard = deck.slice(deckIndex);
  return { hands, boneyard };
}

/**
 * Determines the player who goes first in Round 1:
 * Rule: Player with the highest balak starts ([6,6] > [5,5] > ... > [0,0]).
 * If nobody has a balak, player with the highest total pip card starts.
 */
export function findStartingPlayerIndex(players: Player[]): number {
  // Check for highest balak from [6,6] down to [0,0]
  for (let pip = 6; pip >= 0; pip--) {
    const targetBalak: Tile = [pip, pip];
    for (let i = 0; i < players.length; i++) {
      if (players[i].hand.some(t => areTilesEqual(t, targetBalak))) {
        return i;
      }
    }
  }

  // Fallback: Player holding the tile with highest sum (e.g. [5, 6])
  let maxPip = -1;
  let startingIndex = 0;

  for (let i = 0; i < players.length; i++) {
    for (const tile of players[i].hand) {
      const sum = getTilePipSum(tile);
      if (sum > maxPip) {
        maxPip = sum;
        startingIndex = i;
      }
    }
  }

  return startingIndex;
}

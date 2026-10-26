import type { Tile, BoardState, PlacedTile, EndSide, ValidMove } from './types.ts';
import { areTilesEqual, isBalak } from './deck.ts';

export function createEmptyBoard(): BoardState {
  return {
    leftEnd: null,
    rightEnd: null,
    chain: [],
  };
}

/**
 * Checks which ends of the board a tile can connect to.
 */
export function getTilePlayableEnds(tile: Tile, board: BoardState): EndSide[] {
  // If the board is empty, any tile can be placed
  if (board.chain.length === 0 || board.leftEnd === null || board.rightEnd === null) {
    return ['left', 'right'];
  }

  const validEnds: EndSide[] = [];
  const [a, b] = tile;

  if (a === board.leftEnd || b === board.leftEnd) {
    validEnds.push('left');
  }

  // Avoid duplicate 'right' if left and right ends are the same number
  if (a === board.rightEnd || b === board.rightEnd) {
    if (!validEnds.includes('right')) {
      validEnds.push('right');
    }
  }

  return validEnds;
}

/**
 * Returns all valid moves available in a player's hand.
 */
export function getAvailableMoves(hand: Tile[], board: BoardState): ValidMove[] {
  const moves: ValidMove[] = [];

  for (const tile of hand) {
    const targetEnds = getTilePlayableEnds(tile, board);
    if (targetEnds.length > 0) {
      moves.push({ tile, targetEnds });
    }
  }

  return moves;
}

/**
 * Places a tile onto the board at the specified end side.
 * Returns the updated board state.
 */
export function placeTileOnBoard(
  board: BoardState,
  tile: Tile,
  targetEnd: EndSide
): BoardState {
  const newChain = [...board.chain];
  const tileIsBalak = isBalak(tile);

  // First tile on an empty board
  if (newChain.length === 0 || board.leftEnd === null || board.rightEnd === null) {
    const placed: PlacedTile = {
      tile,
      facing: [tile[0], tile[1]],
      isBalak: tileIsBalak,
      isAnchor: true,
    };
    return {
      leftEnd: tile[0],
      rightEnd: tile[1],
      chain: [placed],
    };
  }

  if (targetEnd === 'left') {
    const matchPip = board.leftEnd;
    let newOuterPip: number;

    if (tile[0] === matchPip) {
      newOuterPip = tile[1];
    } else if (tile[1] === matchPip) {
      newOuterPip = tile[0];
    } else {
      throw new Error(`Tile [${tile}] cannot connect to left end ${board.leftEnd}`);
    }

    const placed: PlacedTile = {
      tile,
      facing: [newOuterPip, matchPip],
      isBalak: tileIsBalak,
    };

    newChain.unshift(placed);
    return {
      leftEnd: newOuterPip,
      rightEnd: board.rightEnd,
      chain: newChain,
    };
  } else {
    // targetEnd === 'right'
    const matchPip = board.rightEnd;
    let newOuterPip: number;

    if (tile[0] === matchPip) {
      newOuterPip = tile[1];
    } else if (tile[1] === matchPip) {
      newOuterPip = tile[0];
    } else {
      throw new Error(`Tile [${tile}] cannot connect to right end ${board.rightEnd}`);
    }

    const placed: PlacedTile = {
      tile,
      facing: [matchPip, newOuterPip],
      isBalak: tileIsBalak,
    };

    newChain.push(placed);
    return {
      leftEnd: board.leftEnd,
      rightEnd: newOuterPip,
      chain: newChain,
    };
  }
}

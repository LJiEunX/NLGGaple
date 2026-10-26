import type {
  GameState,
  Player,
  Tile,
  EndSide,
  RoundResult,
  ClientGameState,
  ClientPlayerView,
} from './types.ts';
import {
  generateDeck,
  shuffleDeck,
  dealCards,
  areTilesEqual,
  calculateHandPips,
  findStartingPlayerIndex,
} from './deck.ts';
import {
  createEmptyBoard,
  getAvailableMoves,
  getTilePlayableEnds,
  placeTileOnBoard,
} from './board.ts';

export interface GameOptions {
  turnTimeoutSeconds?: number;
  maxPenaltyPoints?: number;
}

/**
 * Initializes a new Gaple Game.
 */
export function createGame(
  playerNames: string[],
  options: GameOptions = {}
): GameState {
  if (playerNames.length < 2 || playerNames.length > 4) {
    throw new Error('Gaple requires 2 to 4 players.');
  }

  const deck = shuffleDeck(generateDeck());
  const { hands, boneyard } = dealCards(deck, playerNames.length);

  const players: Player[] = playerNames.map((name, i) => ({
    id: `p-${i + 1}`,
    name,
    hand: hands[i],
    score: 0,
  }));

  const startingPlayerIndex = findStartingPlayerIndex(players);

  return {
    id: `game-${Date.now()}`,
    players,
    currentPlayerIndex: startingPlayerIndex,
    board: createEmptyBoard(),
    boneyard,
    status: 'in_progress',
    consecutivePasses: 0,
    turnTimeoutSeconds: options.turnTimeoutSeconds ?? 15,
    maxPenaltyPoints: options.maxPenaltyPoints ?? 100,
    roundNumber: 1,
  };
}

/**
 * Plays a move for the active player.
 */
export function playMove(
  state: GameState,
  playerId: string,
  tile: Tile,
  targetEnd: EndSide
): GameState {
  if (state.status !== 'in_progress') {
    throw new Error(`Cannot play move, game is in state: ${state.status}`);
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not player ${playerId}'s turn (current: ${currentPlayer.name})`);
  }

  const tileIndex = currentPlayer.hand.findIndex(t => areTilesEqual(t, tile));
  if (tileIndex === -1) {
    throw new Error(`Player ${currentPlayer.name} does not have tile [${tile}] in hand`);
  }

  const playableEnds = getTilePlayableEnds(tile, state.board);
  if (!playableEnds.includes(targetEnd)) {
    throw new Error(`Tile [${tile}] cannot be placed on target end '${targetEnd}'`);
  }

  // Deduct tile from player's hand
  const newHand = [...currentPlayer.hand];
  newHand.splice(tileIndex, 1);

  // Update board
  const newBoard = placeTileOnBoard(state.board, tile, targetEnd);

  // Clone players array
  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  // Check Gaple (Out) condition: Hand is empty!
  if (newHand.length === 0) {
    return resolveRound(state, updatedPlayers, newBoard, 'gaple', playerId);
  }

  // Advance turn to next player
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    players: updatedPlayers,
    board: newBoard,
    currentPlayerIndex: nextPlayerIndex,
    consecutivePasses: 0,
  };
}

/**
 * Passes turn for the active player (only valid if no moves available).
 */
export function passTurn(state: GameState, playerId: string): GameState {
  if (state.status !== 'in_progress') {
    throw new Error(`Cannot pass turn, game status is: ${state.status}`);
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not player ${playerId}'s turn`);
  }

  // Validate that player truly has NO valid moves (anti-cheat)
  const validMoves = getAvailableMoves(currentPlayer.hand, state.board);
  if (validMoves.length > 0) {
    throw new Error(
      `Player ${currentPlayer.name} has valid moves available and cannot pass!`
    );
  }

  const newPassCount = state.consecutivePasses + 1;

  // Check Buntu / Dead-End condition: all players passed consecutively
  if (newPassCount >= state.players.length) {
    return resolveBuntu(state);
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    consecutivePasses: newPassCount,
  };
}

/**
 * Resolves round when a player runs out of cards (Gaple!).
 */
function resolveRound(
  state: GameState,
  updatedPlayers: Player[],
  board: any,
  reason: 'gaple',
  winnerId: string
): GameState {
  const penalties: Record<string, number> = {};
  const handSnapshots: Record<string, Tile[]> = {};
  let totalOpponentPips = 0;

  for (const p of updatedPlayers) {
    handSnapshots[p.id] = [...p.hand];
    if (p.id !== winnerId) {
      const pips = calculateHandPips(p.hand);
      penalties[p.id] = pips;
      totalOpponentPips += pips;
    }
  }

  // Winner is awarded points equal to the sum of all opponents' remaining pips
  const pointsWon = totalOpponentPips > 0 ? totalOpponentPips : 10;
  penalties[winnerId] = pointsWon;

  const playersWithUpdatedScore = updatedPlayers.map(p => {
    if (p.id === winnerId) {
      return {
        ...p,
        score: p.score + pointsWon,
      };
    }
    return p;
  });

  const isGameOver = playersWithUpdatedScore.some(
    p => p.score >= state.maxPenaltyPoints
  );

  const roundResult: RoundResult = {
    winnerId,
    reason,
    penalties,
    handSnapshots,
  };

  return {
    ...state,
    players: playersWithUpdatedScore,
    board,
    status: isGameOver ? 'game_over' : 'round_ended',
    roundResult,
  };
}

/**
 * Resolves round when game is locked / buntu (no player can move).
 * Winner is player with lowest sum of pips.
 */
function resolveBuntu(state: GameState): GameState {
  const handSnapshots: Record<string, Tile[]> = {};
  let minPips = Infinity;
  let winnerId: string | null = null;

  // Calculate pips for each player
  for (const p of state.players) {
    handSnapshots[p.id] = [...p.hand];
    const pips = calculateHandPips(p.hand);
    if (pips < minPips) {
      minPips = pips;
      winnerId = p.id;
    }
  }

  const penalties: Record<string, number> = {};
  let totalOpponentPips = 0;

  for (const p of state.players) {
    if (p.id !== winnerId) {
      const pips = calculateHandPips(p.hand);
      penalties[p.id] = pips;
      totalOpponentPips += pips;
    }
  }

  const pointsWon = totalOpponentPips > 0 ? totalOpponentPips : 5;
  if (winnerId) {
    penalties[winnerId] = pointsWon;
  }

  const updatedPlayers = state.players.map(p => {
    if (p.id === winnerId) {
      return {
        ...p,
        score: p.score + pointsWon,
      };
    }
    return p;
  });

  const isGameOver = updatedPlayers.some(p => p.score >= state.maxPenaltyPoints);

  const roundResult: RoundResult = {
    winnerId,
    reason: 'buntu',
    penalties,
    handSnapshots,
  };

  return {
    ...state,
    players: updatedPlayers,
    status: isGameOver ? 'game_over' : 'round_ended',
    roundResult,
  };
}

/**
 * Starts the next round of an ongoing game match.
 */
export function startNextRound(state: GameState): GameState {
  if (state.status !== 'round_ended') {
    throw new Error('Cannot start next round unless previous round has ended.');
  }

  const deck = shuffleDeck(generateDeck());
  const { hands, boneyard } = dealCards(deck, state.players.length);

  // Starting player is the winner of previous round, or fallback to player 0
  let nextStartingIndex = 0;
  if (state.roundResult?.winnerId) {
    const winnerIdx = state.players.findIndex(
      p => p.id === state.roundResult!.winnerId
    );
    if (winnerIdx !== -1) nextStartingIndex = winnerIdx;
  }

  const refreshedPlayers: Player[] = state.players.map((p, i) => ({
    ...p,
    hand: hands[i],
  }));

  return {
    ...state,
    players: refreshedPlayers,
    board: createEmptyBoard(),
    boneyard,
    currentPlayerIndex: nextStartingIndex,
    consecutivePasses: 0,
    status: 'in_progress',
    roundNumber: state.roundNumber + 1,
    roundResult: undefined,
  };
}

/**
 * Anti-Cheat View Projection:
 * Converts full server state into a safe client view for a specific player.
 * Hides all other players' hand contents and the boneyard deck!
 */
export function toClientView(
  state: GameState,
  viewingPlayerId: string
): ClientGameState {
  const viewingPlayer = state.players.find(p => p.id === viewingPlayerId);
  const isMyTurn =
    state.players[state.currentPlayerIndex]?.id === viewingPlayerId;

  const clientPlayers: ClientPlayerView[] = state.players.map(p => {
    const isMe = p.id === viewingPlayerId;
    return {
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      // Only reveal hand if it's the viewing player, or if round has ended and hands are exposed
      hand: isMe || state.status === 'round_ended' || state.status === 'game_over'
        ? p.hand
        : undefined,
      score: p.score,
    };
  });

  return {
    id: state.id,
    players: clientPlayers,
    currentPlayerId: state.players[state.currentPlayerIndex].id,
    board: state.board,
    boneyardCount: state.boneyard.length,
    status: state.status,
    turnTimeoutSeconds: state.turnTimeoutSeconds,
    targetScore: state.maxPenaltyPoints,
    roundNumber: state.roundNumber,
    myValidMoves:
      isMyTurn && viewingPlayer
        ? getAvailableMoves(viewingPlayer.hand, state.board)
        : undefined,
    roundResult: state.roundResult,
  };
}

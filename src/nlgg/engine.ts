import type { EndSide, BoardState } from '../types.ts';
import type {
  NLGGCard,
  NLGGPlayer,
  NLGGState,
  TradeOffer,
  DrawTurnResult,
  ClientNLGGState,
  ClientNLGGPlayer,
  ClientNLGGCard,
} from './types.ts';
import {
  createEmptyBoard,
  getAvailableMoves,
  getTilePlayableEnds,
  placeTileOnBoard,
} from '../board.ts';
import { areTilesEqual, isBalak, getTilePipSum } from '../deck.ts';

/**
 * Generates 2 full Domino decks (56 cards total).
 * Deck A: 28 cards, Deck B: 28 cards.
 */
export function generateDoubleDeck(): NLGGCard[] {
  const cards: NLGGCard[] = [];
  const decks: ('A' | 'B')[] = ['A', 'B'];

  for (const d of decks) {
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        const opaqueId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `card-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;
        cards.push({
          id: opaqueId,
          tile: [i, j],
          deck: d,
        });
      }
    }
  }

  return cards;
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
 * Fisher-Yates shuffle for 56 cards using CSPRNG.
 */
export function shuffleCards(cards: NLGGCard[]): NLGGCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Initializes a new "Ala NLGG" game.
 */
export function createNLGGGame(
  playerConfigs: { id?: string; name: string; isBot?: boolean }[]
): NLGGState {
  if (playerConfigs.length < 1 || playerConfigs.length > 4) {
    throw new Error('Ala NLGG requires 1 to 4 players.');
  }

  const shuffledDeck = shuffleCards(generateDoubleDeck());

  const players: NLGGPlayer[] = playerConfigs.map((cfg, idx) => ({
    id: cfg.id || `p-${idx + 1}`,
    name: cfg.name.trim() || `Pemain ${idx + 1}`,
    hand: [],
    revealed: false,
    tradeQuota: 1,
    hasActedTrade: false,
    isBot: cfg.isBot ?? false,
  }));

  return {
    id: `nlgg-${Date.now()}`,
    players,
    tableScatteredCards: shuffledDeck,
    drawPool: [],
    board: createEmptyBoard(),
    phase: 'blind_pick',
    activeTradeOffer: null,
    currentTradePlayerIndex: 0,
    currentPlayerIndex: 0,
    consecutivePasses: 0,
    winnerId: null,
    winReason: null,
  };
}

/**
 * Phase 1: Blind Pick
 * Player picks 1 card from the scattered cards on the table.
 */
export function blindPickCard(
  state: NLGGState,
  playerId: string,
  cardId?: string
): NLGGState {
  if (state.phase !== 'blind_pick') {
    throw new Error(`Cannot pick card in phase: ${state.phase}`);
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('Player not found');
  if (player.hand.length >= 7) {
    throw new Error(`Player ${player.name} already has 7 cards.`);
  }

  if (state.tableScatteredCards.length === 0) {
    throw new Error('No scattered cards left on table');
  }

  let cardIndex = cardId ? state.tableScatteredCards.findIndex(c => c.id === cardId) : 0;
  if (cardIndex === -1) {
    cardIndex = 0;
  }

  const card = state.tableScatteredCards[cardIndex];
  const newScattered = [...state.tableScatteredCards];
  newScattered.splice(cardIndex, 1);

  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
  );

  // Check if all players have picked 7 cards
  const allPicked = updatedPlayers.every(p => p.hand.length === 7);

  return {
    ...state,
    tableScatteredCards: newScattered,
    players: updatedPlayers,
    phase: allPicked ? 'blind_trade' : 'blind_pick',
  };
}

/**
 * Automatically picks 7 cards for any player (useful for bots or quick setup).
 */
export function autoBlindPickAll(state: NLGGState): NLGGState {
  let current = { ...state };
  for (const p of state.players) {
    while (current.tableScatteredCards.length > 0) {
      const livePlayer = current.players.find(x => x.id === p.id);
      if (!livePlayer || livePlayer.hand.length >= 7) break;
      const card = current.tableScatteredCards[0];
      current = blindPickCard(current, p.id, card.id);
    }
  }
  return current;
}

/**
 * Phase 2: Blind Trade
 * Initiator proposes a blind trade of their ENTIRE hand of face-down cards
 * with another player's ENTIRE hand of face-down cards.
 */
export function proposeTrade(
  state: NLGGState,
  fromPlayerId: string,
  toPlayerId: string,
  fromCardId?: string,
  toCardId?: string
): NLGGState {
  if (state.phase !== 'blind_trade') {
    throw new Error(`Cannot trade in phase: ${state.phase}`);
  }

  if (state.activeTradeOffer && state.activeTradeOffer.status === 'pending') {
    throw new Error('Another trade offer is currently pending response.');
  }

  if (fromPlayerId === toPlayerId) {
    throw new Error('Cannot trade with yourself.');
  }

  const fromPlayer = state.players.find(p => p.id === fromPlayerId);
  const toPlayer = state.players.find(p => p.id === toPlayerId);
  if (!fromPlayer || !toPlayer) throw new Error('Players not found.');

  if (fromPlayer.tradeQuota <= 0 || fromPlayer.hasActedTrade) {
    throw new Error(`Player ${fromPlayer.name} has no trade quota left.`);
  }

  const offer: TradeOffer = {
    id: `trade-${Date.now()}`,
    fromPlayerId,
    toPlayerId,
    fromCardId,
    toCardId,
    tradeType: 'full_hand',
    status: 'pending',
  };

  return {
    ...state,
    activeTradeOffer: offer,
  };
}

/**
 * Responding to a trade offer (Accept or Reject).
 * If accepted, swaps the ENTIRE hand of face-down cards between both players.
 */
export function respondTrade(
  state: NLGGState,
  respondingPlayerId: string,
  accept: boolean
): NLGGState {
  if (state.phase !== 'blind_trade') {
    throw new Error(`Cannot respond to trade in phase: ${state.phase}`);
  }

  const offer = state.activeTradeOffer;
  if (!offer || offer.status !== 'pending') {
    throw new Error('No pending trade offer.');
  }

  if (offer.toPlayerId !== respondingPlayerId) {
    throw new Error('Only the target player can respond to the trade offer.');
  }

  const fromPlayer = state.players.find(p => p.id === offer.fromPlayerId)!;
  const toPlayer = state.players.find(p => p.id === offer.toPlayerId)!;

  let newFromHand = [...fromPlayer.hand];
  let newToHand = [...toPlayer.hand];

  if (accept) {
    // Tukar seluruh kartu di tangan (Full-Hand Swap)!
    newFromHand = [...toPlayer.hand];
    newToHand = [...fromPlayer.hand];
  }

  // Deduct initiator quota and mark acted
  const updatedPlayers = state.players.map(p => {
    if (p.id === fromPlayer.id) {
      return {
        ...p,
        hand: newFromHand,
        tradeQuota: 0,
        hasActedTrade: true,
      };
    }
    if (p.id === toPlayer.id) {
      return {
        ...p,
        hand: newToHand,
      };
    }
    return p;
  });

  const allTradesResolved = updatedPlayers.every(p => p.hasActedTrade);

  let nextState: NLGGState = {
    ...state,
    players: updatedPlayers,
    activeTradeOffer: null,
  };

  if (allTradesResolved) {
    nextState = executeRevealPhase(nextState);
  }

  return nextState;
}

/**
 * Player chooses not to use their trade opportunity.
 */
export function skipTrade(state: NLGGState, playerId: string): NLGGState {
  if (state.phase !== 'blind_trade') {
    throw new Error('Not in blind trade phase.');
  }

  if (state.activeTradeOffer && state.activeTradeOffer.status === 'pending') {
    throw new Error('Cannot skip trade while a trade offer is pending.');
  }

  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, hasActedTrade: true, tradeQuota: 0 } : p
  );

  const allTradesResolved = updatedPlayers.every(p => p.hasActedTrade);

  let nextState: NLGGState = {
    ...state,
    players: updatedPlayers,
  };

  if (allTradesResolved) {
    nextState = executeRevealPhase(nextState);
  }

  return nextState;
}

/**
 * Phase 3: Reveal Phase
 * Reveals all 7 cards for each player, assigns remaining cards to drawPool,
 * and determines the starting player (highest balak).
 */
export function executeRevealPhase(state: NLGGState): NLGGState {
  const updatedPlayers = state.players.map(p => ({
    ...p,
    revealed: true,
  }));

  // Sisa kartu yang tidak terambil di meja dijadikan tumpukan cangkul
  const drawPool = [...state.tableScatteredCards];

  // Determine starting player: Highest balak from [6,6] down to [0,0]
  let startingIndex = 0;
  let foundBalak = false;

  for (let pip = 6; pip >= 0; pip--) {
    const targetBalak: [number, number] = [pip, pip];
    for (let i = 0; i < updatedPlayers.length; i++) {
      if (updatedPlayers[i].hand.some(c => areTilesEqual(c.tile, targetBalak))) {
        startingIndex = i;
        foundBalak = true;
        break;
      }
    }
    if (foundBalak) break;
  }

  if (!foundBalak) {
    // Fallback: Player with highest single tile sum
    let maxPip = -1;
    for (let i = 0; i < updatedPlayers.length; i++) {
      for (const card of updatedPlayers[i].hand) {
        const sum = getTilePipSum(card.tile);
        if (sum > maxPip) {
          maxPip = sum;
          startingIndex = i;
        }
      }
    }
  }

  return {
    ...state,
    activeTradeOffer: null,
    tableScatteredCards: [],
    drawPool,
    players: updatedPlayers,
    currentPlayerIndex: startingIndex,
    consecutivePasses: 0,
    phase: 'playing',
  };
}

/**
 * Plays a regular matching tile from hand onto the board.
 */
export function playMove(
  state: NLGGState,
  playerId: string,
  cardId: string,
  targetEnd: EndSide
): NLGGState {
  if (state.phase !== 'playing') {
    throw new Error(`Cannot play move in phase: ${state.phase}`);
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not player ${playerId}'s turn (current: ${currentPlayer.name})`);
  }

  const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} not in player's hand`);
  }

  const card = currentPlayer.hand[cardIndex];
  const playableEnds = getTilePlayableEnds(card.tile, state.board);
  if (!playableEnds.includes(targetEnd)) {
    throw new Error(
      `Tile [${card.tile}] cannot be placed on end '${targetEnd}'`
    );
  }

  const newHand = [...currentPlayer.hand];
  newHand.splice(cardIndex, 1);

  const newBoard = placeTileOnBoard(state.board, card.tile, targetEnd);

  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  // Check Win Condition: Player has 0 cards left!
  if (newHand.length === 0) {
    return {
      ...state,
      players: updatedPlayers,
      board: newBoard,
      phase: 'game_over',
      winnerId: playerId,
      winReason: 'normal',
    };
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    players: updatedPlayers,
    board: newBoard,
    currentPlayerIndex: nextIndex,
    consecutivePasses: 0,
  };
}

/**
 * Phase 4: Turn & Draw Mechanic (Cangkul Wajib)
 * Triggered when active player has NO matching cards in hand.
 *
 * Rule:
 * a. Wajib mencangkul tepat 1 kartu dari drawPool jika masih ada.
 * b. Pengecekan:
 *    - Jika cocok: WAJIB LANGSUNG DIMAINKAN, giliran selesai.
 *    - Jika tidak cocok: Kartu masuk tangan, player Pass, giliran berpindah.
 * c. Jika drawPool habis (0): Player langsung Pass biasa.
 */
export function drawTurn(
  state: NLGGState,
  playerId: string,
  preferredEnd?: EndSide
): { state: NLGGState; result: DrawTurnResult } {
  if (state.phase !== 'playing') {
    throw new Error(`Cannot draw in phase: ${state.phase}`);
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not player ${playerId}'s turn`);
  }

  // Validate player truly has no valid moves in hand
  const validHandMoves = getAvailableMoves(
    currentPlayer.hand.map(c => c.tile),
    state.board
  );
  if (validHandMoves.length > 0) {
    throw new Error(
      `Player ${currentPlayer.name} has valid moves in hand and cannot draw!`
    );
  }

  if (state.drawPool.length === 0) {
    throw new Error('Draw pool is empty. Use passWhenPoolEmpty instead.');
  }

  // Draw exactly 1 card
  const newDrawPool = [...state.drawPool];
  const drawnCard = newDrawPool.shift()!;

  // Check if drawn card matches board
  const playableEnds = getTilePlayableEnds(drawnCard.tile, state.board);
  const isPlayable = playableEnds.length > 0;

  if (isPlayable) {
    // WAJIB LANGSUNG DIMAINKAN!
    const targetEnd: EndSide =
      preferredEnd && playableEnds.includes(preferredEnd)
        ? preferredEnd
        : playableEnds[0];

    const newBoard = placeTileOnBoard(state.board, drawnCard.tile, targetEnd);
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

    const nextState: NLGGState = {
      ...state,
      board: newBoard,
      drawPool: newDrawPool,
      currentPlayerIndex: nextIndex,
      consecutivePasses: 0,
    };

    return {
      state: nextState,
      result: {
        card: drawnCard,
        isPlayable: true,
        playedEnd: targetEnd,
        actionTaken: 'played',
      },
    };
  } else {
    // TIDAK COCOK: Masuk ke tangan, player Pass/Skip, giliran berpindah
    const newHand = [...currentPlayer.hand, drawnCard];
    const updatedPlayers = state.players.map(p =>
      p.id === playerId ? { ...p, hand: newHand } : p
    );

    const newPasses = state.consecutivePasses + 1;
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

    let nextState: NLGGState = {
      ...state,
      players: updatedPlayers,
      drawPool: newDrawPool,
      currentPlayerIndex: nextIndex,
      consecutivePasses: newPasses,
    };

    // If draw pool is now 0 and all players passed -> Buntu
    if (newDrawPool.length === 0 && newPasses >= state.players.length) {
      nextState = resolveNLGGDeadlock(nextState);
    }

    return {
      state: nextState,
      result: {
        card: drawnCard,
        isPlayable: false,
        actionTaken: 'added_to_hand_and_passed',
      },
    };
  }
}

/**
 * Regular pass when drawPool is empty (0 cards).
 */
export function passWhenPoolEmpty(
  state: NLGGState,
  playerId: string
): NLGGState {
  if (state.phase !== 'playing') {
    throw new Error('Not in playing phase');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error(`Not player ${playerId}'s turn`);
  }

  if (state.drawPool.length > 0) {
    throw new Error('Draw pool is not empty. You must drawTurn instead!');
  }

  const validHandMoves = getAvailableMoves(
    currentPlayer.hand.map(c => c.tile),
    state.board
  );
  if (validHandMoves.length > 0) {
    throw new Error('Cannot pass when you have playable cards!');
  }

  const newPasses = state.consecutivePasses + 1;

  // Check Buntu condition: all players passed and pool is empty
  if (newPasses >= state.players.length) {
    return resolveNLGGDeadlock({ ...state, consecutivePasses: newPasses });
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    consecutivePasses: newPasses,
  };
}

/**
 * Resolves Buntu (Deadlock) condition:
 * All remaining cards are evaluated. Player with lowest total pip sum wins!
 */
export function resolveNLGGDeadlock(state: NLGGState): NLGGState {
  const pipScores: Record<string, number> = {};
  let minPips = Infinity;
  let winnerId: string | null = null;

  for (const player of state.players) {
    const totalPips = player.hand.reduce(
      (sum, card) => sum + getTilePipSum(card.tile),
      0
    );
    pipScores[player.id] = totalPips;

    if (totalPips < minPips) {
      minPips = totalPips;
      winnerId = player.id;
    }
  }

  return {
    ...state,
    phase: 'game_over',
    winnerId,
    winReason: 'buntu',
    pipScores,
  };
}

/**
 * Server-Authoritative Anti-Cheat View for NLGG Mode.
 * Strictly masks unrevealed and opponent cards.
 */
export function toClientNLGGView(
  state: NLGGState,
  viewingPlayerId: string
): ClientNLGGState {
  const clientPlayers: ClientNLGGPlayer[] = state.players.map(p => {
    const isMe = p.id === viewingPlayerId;
    const isGameOver = state.phase === 'game_over';

    const clientHand: ClientNLGGCard[] = p.hand.map(card => {
      // Reveal tile value ONLY if:
      // 1. Game is over (show all), OR
      // 2. It's the viewing player AND cards have been revealed in Phase 3
      const shouldReveal = isGameOver || (isMe && p.revealed);

      return {
        id: card.id,
        tile: shouldReveal ? card.tile : undefined,
        revealed: p.revealed,
      };
    });

    return {
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      hand: clientHand,
      tradeQuota: p.tradeQuota,
      hasActedTrade: p.hasActedTrade,
      isBot: p.isBot,
    };
  });

  return {
    id: state.id,
    players: clientPlayers,
    scatteredCardsCount: state.tableScatteredCards.length,
    drawPoolCount: state.drawPool.length,
    board: state.board,
    phase: state.phase,
    activeTradeOffer: state.activeTradeOffer,
    currentPlayerId:
      state.phase === 'playing'
        ? state.players[state.currentPlayerIndex]?.id || null
        : null,
    winnerId: state.winnerId,
    winReason: state.winReason,
    pipScores: state.pipScores,
  };
}

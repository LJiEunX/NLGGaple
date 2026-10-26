import type { EndSide, BoardState } from '../types.ts';

export interface NLGGCard {
  id: string; // Unique ID to distinguish duplicate dominoes from Deck A & Deck B
  tile: [number, number];
  deck: 'A' | 'B';
}

export interface NLGGPlayer {
  id: string;
  name: string;
  hand: NLGGCard[];
  revealed: boolean;
  tradeQuota: number; // Max 1 per player
  hasActedTrade: boolean;
  isBot: boolean;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  fromCardId?: string;
  toCardId?: string;
  tradeType?: 'full_hand';
  status: 'pending' | 'accepted' | 'rejected';
}

export type NLGGPhase =
  | 'blind_pick'
  | 'blind_trade'
  | 'reveal'
  | 'playing'
  | 'game_over';

export interface DrawTurnResult {
  card: NLGGCard;
  isPlayable: boolean;
  playedEnd?: EndSide;
  actionTaken: 'played' | 'added_to_hand_and_passed';
}

export interface NLGGState {
  id: string;
  players: NLGGPlayer[];
  tableScatteredCards: NLGGCard[]; // 56 face-down cards initially
  drawPool: NLGGCard[]; // Remaining cards after blind pick
  board: BoardState;
  phase: NLGGPhase;
  activeTradeOffer: TradeOffer | null;
  currentTradePlayerIndex: number;
  currentPlayerIndex: number;
  consecutivePasses: number;
  winnerId: string | null;
  winReason: 'normal' | 'buntu' | null;
  pipScores?: Record<string, number>;
}

/**
 * Client projection for anti-cheat and hidden information:
 * In 'blind_pick' and 'blind_trade', nobody knows card values!
 * In 'reveal' & 'playing', players only see their own card values.
 */
export interface ClientNLGGCard {
  id: string;
  tile?: [number, number]; // Undefined if face-down or opponent's card
  revealed: boolean;
}

export interface ClientNLGGPlayer {
  id: string;
  name: string;
  cardCount: number;
  hand: ClientNLGGCard[];
  tradeQuota: number;
  hasActedTrade: boolean;
  isBot: boolean;
}

export interface ClientNLGGState {
  id: string;
  players: ClientNLGGPlayer[];
  scatteredCardsCount: number;
  drawPoolCount: number;
  board: BoardState;
  phase: NLGGPhase;
  activeTradeOffer: TradeOffer | null;
  currentPlayerId: string | null;
  winnerId: string | null;
  winReason: 'normal' | 'buntu' | null;
  pipScores?: Record<string, number>;
}

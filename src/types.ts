/**
 * Domino Tile represented as a 2-tuple of numbers [pip1, pip2], e.g. [3, 5].
 * Balak / Double tiles have pip1 === pip2, e.g. [6, 6].
 */
export type Tile = [number, number];

export type EndSide = 'left' | 'right';

export interface PlacedTile {
  tile: Tile;
  // Normalized orientation on the board chain: [outerPip, innerPip] or vice versa
  facing: [number, number];
  isBalak: boolean;
  isAnchor?: boolean;
}

export interface BoardState {
  leftEnd: number | null;
  rightEnd: number | null;
  chain: PlacedTile[];
}

export interface Player {
  id: string;
  name: string;
  hand: Tile[];
  score: number; // Penalty points accumulated
}

export interface ValidMove {
  tile: Tile;
  targetEnds: EndSide[];
}

export interface MoveAction {
  playerId: string;
  tile: Tile;
  targetEnd: EndSide;
}

export type GameStatus = 'waiting' | 'in_progress' | 'round_ended' | 'game_over';

export interface RoundResult {
  winnerId: string | null;
  reason: 'gaple' | 'buntu';
  penalties: Record<string, number>; // playerId -> penalty added this round
  handSnapshots: Record<string, Tile[]>; // Revealed hands at the end of the round
}

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  board: BoardState;
  boneyard: Tile[]; // Sisa kartu untuk cangkul (2-3 pemain)
  status: GameStatus;
  consecutivePasses: number;
  turnTimeoutSeconds: number;
  maxPenaltyPoints: number; // Limit points before game over (e.g. 100)
  roundNumber: number;
  roundResult?: RoundResult;
}

/**
 * Masked GameState sent to a specific client.
 * Strictly hides other players' hands and boneyard tiles (Server-Authoritative Anti-Cheat).
 */
export interface ClientPlayerView {
  id: string;
  name: string;
  handCount: number;
  hand?: Tile[]; // Only present for the viewing player
  score: number;
}

export interface ClientGameState {
  id: string;
  players: ClientPlayerView[];
  currentPlayerId: string;
  board: BoardState;
  boneyardCount: number;
  status: GameStatus;
  turnTimeoutSeconds: number;
  targetScore?: number;
  roundNumber?: number;
  myValidMoves?: ValidMove[];
  roundResult?: RoundResult;
}

import React from 'react';
import type { GameState } from '../types.ts';
import { EndgameShowdown, type ShowdownPlayer } from './EndgameShowdown.tsx';

interface RoundResultModalProps {
  game: GameState;
  myPlayerId: string;
  onNextRound: () => void;
  onRestartGame: () => void;
  onExitMatch?: () => void;
  soundEnabled?: boolean;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  game,
  myPlayerId,
  onNextRound,
  onRestartGame,
  onExitMatch,
  soundEnabled = true,
}) => {
  const result = game.roundResult;
  if (!result) return null;

  const winner = game.players.find(p => p.id === result.winnerId);
  const isGameOver = game.status === 'game_over';

  const showdownPlayers: ShowdownPlayer[] = game.players.map(p => {
    const isWinner = p.id === result.winnerId;
    const hand = result.handSnapshots?.[p.id] ?? p.hand ?? [];
    const totalPips = hand.reduce((acc, t) => acc + t[0] + t[1], 0);

    return {
      id: p.id,
      name: p.name,
      hand,
      totalPips,
      isWinner,
      isMe: p.id === myPlayerId,
      score: p.score,
      penaltyAdded: isWinner ? (result.penalties?.[p.id] ?? 0) : 0,
    };
  });

  return (
    <EndgameShowdown
      players={showdownPlayers}
      winnerName={winner?.name || 'Pemenang'}
      winReason={result.reason}
      onNextRound={onNextRound}
      onRestart={onRestartGame}
      onExit={onExitMatch}
      isGameOver={isGameOver}
      roundNumber={game.roundNumber}
      targetScore={game.maxPenaltyPoints ?? 100}
      soundEnabled={soundEnabled}
    />
  );
};

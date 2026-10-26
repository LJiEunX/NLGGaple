import { createGame, playMove, passTurn } from './engine.ts';
import { getAvailableMoves } from './board.ts';
import type { GameState, PlacedTile } from './types.ts';

function formatBoard(chain: PlacedTile[]): string {
  if (chain.length === 0) return '(Meja kosong)';
  return chain
    .map(p => `[${p.facing[0]}|${p.facing[1]}]`)
    .join(' - ');
}

function runSimulatedMatch() {
  console.log('🎲 === SIMULASI PERMAINAN GAPLE 4 PEMAIN === 🎲\n');

  const playerNames = ['Budi', 'Siti', 'Joko', 'Rian'];
  let game: GameState = createGame(playerNames);

  console.log(`Pemain: ${playerNames.join(', ')}`);
  console.log(`Giliran pertama: ${game.players[game.currentPlayerIndex].name} (memegang balak tertinggi)\n`);

  let turnCount = 1;
  const maxTurns = 50;

  while (game.status === 'in_progress' && turnCount <= maxTurns) {
    const currentPlayer = game.players[game.currentPlayerIndex];
    const availableMoves = getAvailableMoves(currentPlayer.hand, game.board);

    console.log(`--- [Turn ${turnCount}] Giliran: ${currentPlayer.name} ---`);
    console.log(`Ujung meja: [Left: ${game.board.leftEnd ?? '-'} | Right: ${game.board.rightEnd ?? '-'}]`);
    console.log(`Meja: ${formatBoard(game.board.chain)}`);
    console.log(
      `Kartu ${currentPlayer.name} (${currentPlayer.hand.length}): ` +
      currentPlayer.hand.map(t => `[${t[0]}|${t[1]}]`).join(' ')
    );

    if (availableMoves.length > 0) {
      // Pick first valid move
      const chosen = availableMoves[0];
      const targetEnd = chosen.targetEnds[0];

      console.log(
        `👉 ${currentPlayer.name} memasang kartu [${chosen.tile[0]}|${chosen.tile[1]}] di sisi ${targetEnd.toUpperCase()}`
      );
      game = playMove(game, currentPlayer.id, chosen.tile, targetEnd);
    } else {
      console.log(`⏭️  ${currentPlayer.name} TIDAK MEMILIKI KARTU COCOK -> PASS (Lewat)!`);
      game = passTurn(game, currentPlayer.id);
    }

    console.log('');
    turnCount++;
  }

  console.log('🏁 === HASIL RONDE === 🏁');
  if (game.roundResult) {
    const winner = game.players.find(p => p.id === game.roundResult?.winnerId);
    console.log(`Status Selesai : ${game.roundResult.reason.toUpperCase()}!`);
    console.log(`Pemenang       : ${winner?.name ?? 'Tidak ada'} 🏆`);
    console.log('\nPenalti ronde ini:');
    for (const player of game.players) {
      const penalty = game.roundResult.penalties[player.id] ?? 0;
      const sisaKartu = game.roundResult.handSnapshots[player.id]
        .map(t => `[${t[0]}|${t[1]}]`)
        .join(' ') || '(Habis - GAPLE!)';
      console.log(` - ${player.name.padEnd(6)}: +${penalty} poin penalti (Sisa: ${sisaKartu}) | Total Skor: ${player.score}`);
    }
  }

  console.log('\nMeja Akhir:');
  console.log(formatBoard(game.board.chain));
}

runSimulatedMatch();

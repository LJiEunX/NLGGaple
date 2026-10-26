import {
  createNLGGGame,
  autoBlindPickAll,
  proposeTrade,
  respondTrade,
  skipTrade,
  playMove,
  drawTurn,
  passWhenPoolEmpty,
} from './engine.ts';
import { getAvailableMoves } from '../board.ts';
import type { NLGGState } from './types.ts';

function printBoard(state: NLGGState) {
  if (state.board.chain.length === 0) return '(Meja kosong)';
  return state.board.chain
    .map(p => `[${p.facing[0]}|${p.facing[1]}]`)
    .join(' - ');
}

function runNLGGSimulatedMatch() {
  console.log('🎲 ========================================== 🎲');
  console.log('   🔥 SIMULASI MODE KHUSUS: ALA NLGG 🔥');
  console.log('   (Double Deck 56 Kartu, Blind Pick & Trade)');
  console.log('🎲 ========================================== 🎲\n');

  // 1. SETUP
  let game = createNLGGGame([
    { name: 'Andi' },
    { name: 'Budi' },
    { name: 'Caca' },
    { name: 'Doni' },
  ]);

  console.log(`[Fase Setup] 56 kartu tertutup disebar di meja.`);
  console.log(`Jumlah pemain: 4 orang.`);
  console.log(`Sisa kartu di meja: ${game.tableScatteredCards.length} kartu.\n`);

  // 2. BLIND PICK PHASE
  console.log(`[Fase 1: Blind Pick] Setiap pemain mengambil 7 kartu tertutup...`);
  game = autoBlindPickAll(game);
  console.log(`Semua pemain telah memegang 7 kartu tertutup (face-down).`);
  console.log(`Sisa kartu di meja untuk tumpukan cangkul: ${game.tableScatteredCards.length} kartu.`);
  console.log(`Fase saat ini: ${game.phase.toUpperCase()}\n`);

  // 3. BLIND TRADE PHASE
  console.log(`[Fase 2: Blind Trade] Negosiasi barter kartu tertutup (Maks 1x per pemain)...`);
  // Andi ajak tukar Budi
  const andiCard = game.players[0].hand[0].id;
  const budiCard = game.players[1].hand[0].id;
  console.log(`👉 Andi mengajak tukar 1 kartu tertutup dengan Budi.`);
  game = proposeTrade(game, 'p-1', 'p-2', andiCard, budiCard);

  // Budi menerima
  console.log(`🤝 Budi MENERIMA ajakan tukar! 1 kartu saling bertukar posisi.`);
  game = respondTrade(game, 'p-2', true);

  // Budi, Caca & Doni skip trade
  console.log(`⏭️  Budi melepas hak inisiatif barter.`);
  game = skipTrade(game, 'p-2');
  console.log(`⏭️  Caca melepas hak inisiatif barter.`);
  game = skipTrade(game, 'p-3');
  console.log(`⏭️  Doni melepas hak inisiatif barter.`);
  game = skipTrade(game, 'p-4');

  // 4. REVEAL PHASE
  console.log(`\n[Fase 3: Reveal Phase] Seluruh pemain membuka 7 kartu di tangannya!`);
  console.log(`Tumpukan cangkul (draw pool) ditetapkan: ${game.drawPool.length} kartu.`);
  console.log(
    `Pemain pertama yang memulai: ${game.players[game.currentPlayerIndex].name} (memegang balak tertinggi)\n`
  );

  for (const p of game.players) {
    const handStr = p.hand.map(c => `[${c.tile[0]}|${c.tile[1]}]`).join(' ');
    console.log(` - ${p.name.padEnd(5)}: ${handStr}`);
  }

  console.log('\n[Fase 4: Core Gameplay & Cangkul Wajib]');

  let turnCount = 1;
  const maxTurns = 60;

  while (game.phase === 'playing' && turnCount <= maxTurns) {
    const activePlayer = game.players[game.currentPlayerIndex];
    const validMoves = getAvailableMoves(
      activePlayer.hand.map(c => c.tile),
      game.board
    );

    console.log(
      `\n--- [Turn ${turnCount}] Giliran: ${activePlayer.name} (Sisa kartu: ${activePlayer.hand.length}) ---`
    );
    console.log(
      `Meja: [${game.board.leftEnd ?? '-'} | ${game.board.rightEnd ?? '-'}] -> ${printBoard(game)}`
    );
    console.log(`Draw Pool tersisa: ${game.drawPool.length} kartu.`);

    if (validMoves.length > 0) {
      // Pemain punya kartu cocok di tangan -> Pasang!
      const chosen = validMoves[0];
      const matchingCard = activePlayer.hand.find(
        c =>
          (c.tile[0] === chosen.tile[0] && c.tile[1] === chosen.tile[1]) ||
          (c.tile[0] === chosen.tile[1] && c.tile[1] === chosen.tile[0])
      )!;
      const targetEnd = chosen.targetEnds[0];

      console.log(
        `✅ ${activePlayer.name} memasang kartu [${matchingCard.tile[0]}|${matchingCard.tile[1]}] ke sisi ${targetEnd.toUpperCase()}`
      );
      game = playMove(game, activePlayer.id, matchingCard.id, targetEnd);
    } else {
      // Tidak punya kartu cocok di tangan
      if (game.drawPool.length > 0) {
        console.log(
          `⚠️ ${activePlayer.name} TIDAK PUNYA KARTU COCOK -> Wajib mencangkul 1 kartu!`
        );
        const { state: updatedState, result } = drawTurn(game, activePlayer.id);
        game = updatedState;

        if (result.isPlayable) {
          console.log(
            `🎯 Kartu cangkulan [${result.card.tile[0]}|${result.card.tile[1]}] COCOK! -> Wajib langsung dipasang ke sisi ${result.playedEnd?.toUpperCase()}`
          );
        } else {
          console.log(
            `❌ Kartu cangkulan [${result.card.tile[0]}|${result.card.tile[1]}] TIDAK COCOK -> Masuk ke tangan & Pass (Lewat)!`
          );
        }
      } else {
        console.log(
          `🛑 Tumpukan cangkul habis (0) dan tidak ada kartu cocok -> Pass!`
        );
        game = passWhenPoolEmpty(game, activePlayer.id);
      }
    }

    turnCount++;
  }

  console.log('\n🏁 ========================================== 🏁');
  console.log('             HASIL PERTANDINGAN');
  console.log('🏁 ========================================== 🏁');
  const winner = game.players.find(p => p.id === game.winnerId);
  console.log(`Kondisi Selesai : ${game.winReason?.toUpperCase()}`);
  console.log(`Pemenang       : ${winner?.name ?? 'Tidak ada'} 🏆\n`);

  console.log('Rekap Kartu & Poin Akhir:');
  for (const p of game.players) {
    const pips = p.hand.reduce((sum, c) => sum + c.tile[0] + c.tile[1], 0);
    const handStr =
      p.hand.map(c => `[${c.tile[0]}|${c.tile[1]}]`).join(' ') ||
      '(Habis - Menang!)';
    console.log(
      ` - ${p.name.padEnd(5)}: ${p.hand.length} kartu (Total Pips: ${pips}) -> ${handStr}`
    );
  }

  console.log('\nMeja Akhir:');
  console.log(printBoard(game));
}

runNLGGSimulatedMatch();

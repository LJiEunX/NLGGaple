import React from 'react';
import { X, Swords } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-4 text-amber-400">
          <Swords size={22} />
          <h3 className="font-bold text-lg text-white">
            Aturan Main Gaple Indonesia
          </h3>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="font-semibold text-emerald-400 block mb-1">
              1. Set Kartu & Pembagian:
            </span>
            Total 28 kartu domino (0-0 hingga 6-6). 4 pemain masing-masing mendapatkan 7 kartu.
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="font-semibold text-emerald-400 block mb-1">
              2. Giliran Awal & Pemasangan:
            </span>
            Pemain dengan kartu balak tertinggi ([6|6] &gt; [5|5] ...) memulai pertandingan. Pemain berikutnya harus menyambung angka yang cocok di ujung kiri atau kanan meja.
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="font-semibold text-emerald-400 block mb-1">
              3. Lewat (Pass):
            </span>
            Jika Anda tidak memiliki kartu yang cocok dengan ujung meja, Anda wajib menekan tombol <b>LEWAT (PASS)</b>. Anda tidak diizinkan lewat jika memiliki kartu yang cocok.
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="font-semibold text-emerald-400 block mb-1">
              4. Kemenangan & Skor Penalti (Mode Klasik):
            </span>
            <ul className="list-disc list-inside mt-1 space-y-1 text-slate-400">
              <li>
                <b className="text-amber-300">GAPLE:</b> Pemain yang kartunya habis pertama kali dinyatakan menang ronde (+0 poin penalti).
              </li>
              <li>
                <b className="text-rose-300">BUNTU / DEAD-END:</b> Jika semua pemain tidak bisa memasang kartu, pemenang ditentukan oleh pemain dengan total titik (pips) tersisa paling sedikit di tangan.
              </li>
              <li>
                Pemain yang kalah mendapat poin penalti sejumlah total titik kartu di tangannya.
              </li>
            </ul>
          </div>

          <div className="bg-amber-950/20 p-3.5 rounded-2xl border border-amber-500/30">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 mb-1.5 text-sm">
              🔥 Aturan Khusus: Mode "Ala NLGG"
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
              <li>
                <b>Deck 56 Kartu:</b> Menggunakan 2 set domino standar (Deck A & B).
              </li>
              <li>
                <b>Fase 1 (Blind Pick):</b> Pemain mengambil sendiri 7 kartu acak dari sebaran 56 kartu meja dalam kondisi tertutup (face-down).
              </li>
              <li>
                <b>Fase 2 (Blind Trade - Barter Seluruh Kartu):</b> Setiap pemain memiliki kuota 1x untuk menukar <b>seluruh 7 kartu tertutupnya</b> dengan 7 kartu milik pemain lain. Lawan berhak <i>Terima (Accept)</i> atau <i>Tolak (Reject)</i>.
              </li>
              <li>
                <b>Fase 3 (Reveal):</b> Seluruh pemain membuka 7 kartu di tangannya serentak. Sisa kartu meja menjadi tumpukan cangkul (draw pool).
              </li>
              <li>
                <b>Fase 4 (Cangkul Wajib Instan):</b> Jika tidak ada kartu cocok di tangan, pemain <b>wajib mencangkul 1 kartu</b>:
                <ul className="list-circle list-inside ml-4 mt-1 text-slate-400">
                  <li>Jika cocok: <b>Wajib langsung dimainkan</b> ke meja saat itu juga!</li>
                  <li>Jika tidak cocok: Kartu masuk ke tangan, pemain dinyatakan Pass/Lewat.</li>
                </ul>
              </li>
              <li>
                <b>Kondisi Buntu (Deadlock):</b> Jika tumpukan cangkul sudah 0 kartu dan semua pemain Pass berturut-turut, pemenang adalah pemain dengan total titik kartu terkecil.
              </li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
        >
          Mengerti & Tutup Panduan
        </button>
      </div>
    </div>
  );
};

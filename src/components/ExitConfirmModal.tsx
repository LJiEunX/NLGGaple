import React from 'react';
import { AlertTriangle, LogOut, X } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  isOnline: boolean;
  roomCode?: string;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  isOnline,
  roomCode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative text-center z-10">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X size={18} />
        </button>

        {/* Warning Icon */}
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg">
          <AlertTriangle size={28} />
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-black text-white mb-2">
          Keluar dari Pertandingan?
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          {isOnline
            ? `Anda akan meninggalkan Room ${roomCode ? `(${roomCode})` : ''} dan keluar ke menu utama. Pertandingan akan terus berlanjut tanpa Anda.`
            : 'Pertandingan yang sedang berjalan akan dihentikan dan Anda akan kembali ke menu Lobby.'}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirmExit}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            <span>Ya, Keluar Pertandingan</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
          >
            Batal (Lanjut Main)
          </button>
        </div>
      </div>
    </div>
  );
};

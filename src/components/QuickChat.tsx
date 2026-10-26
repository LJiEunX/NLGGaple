import React, { useState } from 'react';
import { MessageSquare, Smile, X } from 'lucide-react';

interface QuickChatProps {
  onSendMessage: (text: string) => void;
}

const PRESET_MESSAGES = [
  'Gas jalan! ⚡',
  'Buntu nih! 🔒',
  'Awas balak! ⚠️',
  'Santai dulu bos 😎',
  'Buset kartu dewa 🔥',
  'Kopi dulu biar tenang ☕',
  'Ampun sepuh! 😭',
  'GGWP! 🏆',
];

export const QuickChat: React.FC<QuickChatProps> = ({ onSendMessage }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (msg: string) => {
    onSendMessage(msg);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
        title="Kirim Chat Cepat"
      >
        <MessageSquare size={17} />
        <span className="text-xs font-semibold hidden sm:inline">Chat</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl p-2.5 shadow-2xl z-50 animate-fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-slate-300">
            <span>Pesan Cepat Gaple</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {PRESET_MESSAGES.map((msg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(msg)}
                className="text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-emerald-600/30 hover:text-emerald-300 transition cursor-pointer"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

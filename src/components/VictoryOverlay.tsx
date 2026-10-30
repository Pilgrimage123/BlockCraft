import React from 'react';
import { Sparkles, Star, Trophy } from 'lucide-react';

interface VictoryOverlayProps {
  visible: boolean;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none p-4">
      <div className="flex flex-col items-center rounded-3xl border-4 border-yellow-300 bg-slate-900/95 px-10 py-8 text-center text-white shadow-2xl animate-bounce">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-yellow-400 text-slate-950 shadow-lg mb-4">
          <Trophy className="h-11 w-11 stroke-[2.5]" />
        </div>

        <div className="flex items-center gap-2 text-yellow-300 text-sm font-extrabold tracking-wide mb-1">
          <Sparkles className="h-4 w-4" />
          <span>ZLATÁ TRUHLA OTEVŘENA!</span>
          <Sparkles className="h-4 w-4" />
        </div>

        <h2 className="font-['Outfit'] text-3xl md:text-4xl font-extrabold text-white mb-3">
          Skvělá práce, šampione!
        </h2>

        <div className="flex items-center gap-2 rounded-2xl bg-yellow-400/20 border-2 border-yellow-400 px-6 py-2.5 mb-3">
          <Star className="h-7 w-7 fill-yellow-400 text-yellow-400" />
          <span className="font-['Outfit'] text-3xl font-extrabold text-yellow-300 tabular-nums">
            +50 hvězdiček
          </span>
        </div>

        <p className="text-xs font-medium text-slate-300">
          Návrat na náměstíčko do Hlavního Hubu...
        </p>
      </div>
    </div>
  );
};

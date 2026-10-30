import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Flag,
  Home,
  Palette,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SceneId } from '../types/game';

interface HUDProps {
  activeScene: SceneId;
  stars: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  isMuted: boolean;
  isWardrobeOpen: boolean;
  onToggleMute: () => void;
  onOpenWardrobe: () => void;
  onReturnToHub: () => void;
  onStartObby: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  activeScene,
  stars,
  checkpointIndex,
  totalCheckpoints,
  isMuted,
  isWardrobeOpen,
  onToggleMute,
  onOpenWardrobe,
  onReturnToHub,
  onStartObby,
}) => {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Klávesová zkratka H pro sbalení/rozbalení spodního doku ovládání
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !isWardrobeOpen) {
        setControlsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWardrobeOpen]);

  return (
    <>
      {/* HORNÍ LIŠTA V ROZÍCH OBRAZOVKY (střed obrazovky zůstává 100% volný) */}
      <div className="fixed top-4 left-4 right-4 z-20 flex items-start justify-between gap-4 pointer-events-none">
        {/* Levý horní roh: Název aktuální lokace a postup checkpointy */}
        <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/90 px-4 py-2.5 text-white shadow-xl pointer-events-auto">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-slate-950 font-bold ${
              activeScene === 'hub' ? 'bg-sky-400' : 'bg-orange-500 text-white'
            }`}
          >
            {activeScene === 'hub' ? (
              <Compass className="h-6 w-6" />
            ) : (
              <Flag className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">
              Aktuální svět
            </div>
            <div className="font-['Outfit'] text-base md:text-lg font-extrabold leading-tight flex items-center gap-2">
              <span>
                {activeScene === 'hub'
                  ? 'Slunné náměstí (Hub)'
                  : 'Obby Parkour nad lávou'}
              </span>
              {activeScene === 'obby' && (
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  · Checkpoint {checkpointIndex}/{totalCheckpoints}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pravý horní roh: Počítadlo hvězdiček + akční tlačítka */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Počítadlo hvězdiček */}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-yellow-400/80 bg-slate-900/90 px-4 py-2.5 text-white shadow-xl">
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-yellow-200/80 leading-none">
                Hvězdičky
              </span>
              <span className="font-['Outfit'] text-xl font-extrabold text-yellow-300 tabular-nums leading-tight">
                {stars}
              </span>
            </div>
          </div>

          {/* V Hubu tlačítka pro rychlé otevření Šatny nebo přechod do Obby; v Obby tlačítko „Zpět do Hubu" */}
          {activeScene === 'hub' ? (
            <>
              <button
                type="button"
                onClick={onOpenWardrobe}
                className="flex items-center gap-2 rounded-2xl border-2 border-purple-400/80 bg-purple-600 px-4 py-3 text-sm font-extrabold text-white shadow-xl hover:bg-purple-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Palette className="h-5 w-5" />
                <span className="hidden sm:inline">Šatna</span>
              </button>
              <button
                type="button"
                onClick={onStartObby}
                className="flex items-center gap-2 rounded-2xl border-2 border-sky-300 bg-sky-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-xl hover:bg-sky-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-5 w-5" />
                <span className="hidden sm:inline">Do Obby Parkouru</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onReturnToHub}
              className="flex items-center gap-2 rounded-2xl border-2 border-sky-300 bg-sky-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-xl hover:bg-sky-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="h-5 w-5" />
              <span>Zpět do Hubu</span>
            </button>
          )}
        </div>
      </div>

      {/* SPODNÍ SBALITELNÝ DOK S NÁPOVĚDOU OVLÁDÁNÍ A ZVUKEM */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
        style={{ maxWidth: 'min(920px, 94vw)' }}
      >
        <button
          type="button"
          onClick={() => setControlsCollapsed((prev) => !prev)}
          className="mb-1.5 flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-700 bg-slate-900/90 px-3.5 py-1 text-xs font-bold text-slate-300 hover:text-white transition-colors pointer-events-auto cursor-pointer whitespace-nowrap"
        >
          {controlsCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Zobrazit nápovědu ovládání (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Skrýt ovládání (H)</span>
            </>
          )}
        </button>

        {!controlsCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5 rounded-2xl border-2 border-slate-700 bg-slate-900/92 px-5 py-3 text-white shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
              <kbd className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1 font-mono text-xs font-bold text-sky-300">
                WASD / Šipky
              </kbd>
              <span className="text-slate-200">Pohyb postavy</span>
            </div>

            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              ·
            </span>

            <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
              <kbd className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1 font-mono text-xs font-bold text-yellow-300">
                Mezerník
              </kbd>
              <span className="text-slate-200">Skok</span>
            </div>

            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              ·
            </span>

            <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
              <kbd className="rounded-lg bg-slate-800 border border-slate-600 px-2.5 py-1 font-mono text-xs font-bold text-purple-300">
                Tažení myší
              </kbd>
              <span className="text-slate-200">Otáčení kamery</span>
            </div>

            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              ·
            </span>

            <button
              type="button"
              onClick={onToggleMute}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              aria-label={isMuted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="h-4 w-4 text-rose-400" />
                  <span>Zvuk vypnut</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                  <span>Zvuk zapnut</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

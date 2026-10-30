import React, { useState } from 'react';
import { Check, Lock, Palette, RotateCcw, Star, X } from 'lucide-react';
import { AvatarColors, BodyPart, ColorOption } from '../types/game';
import {
  BODY_PARTS,
  COLOR_CATALOG,
  DEFAULT_AVATAR_COLORS,
} from '../store/gameStore';

interface WardrobeModalProps {
  isOpen: boolean;
  stars: number;
  unlockedColors: string[];
  avatarColors: AvatarColors;
  onSelectColor: (part: BodyPart, colorOption: ColorOption) => void;
  onApplyAllColor: (colorHex: string) => void;
  onResetDefault: () => void;
  onClose: () => void;
}

export const WardrobeModal: React.FC<WardrobeModalProps> = ({
  isOpen,
  stars,
  unlockedColors,
  avatarColors,
  onSelectColor,
  onResetDefault,
  onClose,
}) => {
  const [selectedPart, setSelectedPart] = useState<BodyPart>('torso');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const activePartInfo =
    BODY_PARTS.find((p) => p.key === selectedPart) || BODY_PARTS[0];

  const handleColorClick = (option: ColorOption) => {
    const isUnlocked =
      option.price === 0 || unlockedColors.includes(option.id);
    if (!isUnlocked && stars < option.price) {
      setFeedbackMsg(
        `Potřebuješ ještě ${option.price - stars} ★! Vydej se portálem do Obby Parkouru pro +50 ★.`,
      );
      return;
    }
    setFeedbackMsg(null);
    onSelectColor(selectedPart, option);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-end p-4 md:p-8 pointer-events-none">
      {/* Pravý panel šatny - ponechává levou a střední část obrazovky volnou pro 3D náhled postavy */}
      <div
        className="w-full max-w-lg rounded-3xl border-2 border-slate-700 bg-slate-900/95 text-white shadow-2xl p-6 pointer-events-auto"
        role="dialog"
        aria-label="Šatna a obchod barev"
      >
        {/* Hlavička šatny */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight font-['Outfit']">
                Šatna &amp; Obchod barev
              </h2>
              <p className="text-xs text-slate-300">
                Uprav si každou část těla zvlášť v reálném čase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 border border-slate-700">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="font-['Outfit'] text-lg font-extrabold text-yellow-300 tabular-nums">
                {stars}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
              aria-label="Zavřít šatnu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 1. Výběr části těla (6 samostatných částí + interaktivní 2D silueta postavy) */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          {/* Interaktivní klikací 2D schéma postavy */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center rounded-2xl bg-slate-800/90 p-3.5 border border-slate-700/80">
            <span className="text-xs font-semibold text-slate-300 mb-2">
              Klikni na část těla
            </span>
            <div className="relative flex flex-col items-center select-none py-1">
              {/* Hlava */}
              <button
                type="button"
                onClick={() => setSelectedPart('head')}
                style={{ backgroundColor: avatarColors.head }}
                className={`h-10 w-10 rounded-xl border-2 transition-transform cursor-pointer ${
                  selectedPart === 'head'
                    ? 'border-white scale-110 ring-2 ring-purple-400'
                    : 'border-slate-900/60 hover:scale-105'
                }`}
                title="Hlava"
              />
              {/* Ruce a Trup */}
              <div className="flex items-start gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPart('leftArm')}
                  style={{ backgroundColor: avatarColors.leftArm }}
                  className={`h-12 w-5 rounded-lg border-2 transition-transform cursor-pointer ${
                    selectedPart === 'leftArm'
                      ? 'border-white scale-110 ring-2 ring-purple-400'
                      : 'border-slate-900/60 hover:scale-105'
                  }`}
                  title="Levá ruka"
                />
                <button
                  type="button"
                  onClick={() => setSelectedPart('torso')}
                  style={{ backgroundColor: avatarColors.torso }}
                  className={`h-12 w-12 rounded-lg border-2 transition-transform cursor-pointer ${
                    selectedPart === 'torso'
                      ? 'border-white scale-105 ring-2 ring-purple-400'
                      : 'border-slate-900/60 hover:scale-105'
                  }`}
                  title="Trup"
                />
                <button
                  type="button"
                  onClick={() => setSelectedPart('rightArm')}
                  style={{ backgroundColor: avatarColors.rightArm }}
                  className={`h-12 w-5 rounded-lg border-2 transition-transform cursor-pointer ${
                    selectedPart === 'rightArm'
                      ? 'border-white scale-110 ring-2 ring-purple-400'
                      : 'border-slate-900/60 hover:scale-105'
                  }`}
                  title="Pravá ruka"
                />
              </div>
              {/* Nohy */}
              <div className="flex items-start gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedPart('leftLeg')}
                  style={{ backgroundColor: avatarColors.leftLeg }}
                  className={`h-12 w-5 rounded-lg border-2 transition-transform cursor-pointer ${
                    selectedPart === 'leftLeg'
                      ? 'border-white scale-110 ring-2 ring-purple-400'
                      : 'border-slate-900/60 hover:scale-105'
                  }`}
                  title="Levá noha"
                />
                <button
                  type="button"
                  onClick={() => setSelectedPart('rightLeg')}
                  style={{ backgroundColor: avatarColors.rightLeg }}
                  className={`h-12 w-5 rounded-lg border-2 transition-transform cursor-pointer ${
                    selectedPart === 'rightLeg'
                      ? 'border-white scale-110 ring-2 ring-purple-400'
                      : 'border-slate-900/60 hover:scale-105'
                  }`}
                  title="Pravá noha"
                />
              </div>
            </div>
          </div>

          {/* 6 tlačítek pro výběr části těla */}
          <div className="sm:col-span-7 grid grid-cols-2 gap-2">
            {BODY_PARTS.map((part) => {
              const isSelected = selectedPart === part.key;
              return (
                <button
                  key={part.key}
                  type="button"
                  onClick={() => {
                    setSelectedPart(part.key);
                    setFeedbackMsg(null);
                  }}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-white/60 shrink-0"
                    style={{ backgroundColor: avatarColors[part.key] }}
                  />
                  <span className="truncate">{part.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Paleta barev (3 základní zdarma + 6 prémiových za hvězdičky) */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-slate-200">
              Vyber barvu pro:{' '}
              <span className="text-yellow-300">{activePartInfo.label}</span>
            </span>
            <span className="text-xs text-slate-400">
              3 zdarma · 6 prémiových
            </span>
          </div>

          {feedbackMsg && (
            <div className="mb-3 rounded-xl bg-amber-500/20 border border-amber-400/50 px-3.5 py-2 text-xs font-semibold text-amber-200">
              {feedbackMsg}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {COLOR_CATALOG.map((option) => {
              const isUnlocked =
                option.price === 0 || unlockedColors.includes(option.id);
              const isEquipped =
                avatarColors[selectedPart].toLowerCase() ===
                option.hex.toLowerCase();
              const canAfford = stars >= option.price;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleColorClick(option)}
                  className={`group relative flex flex-col justify-between rounded-2xl p-3 border-2 transition-all cursor-pointer text-left ${
                    isEquipped
                      ? 'border-yellow-400 bg-slate-800 shadow-lg'
                      : isUnlocked
                        ? 'border-slate-700 bg-slate-800/80 hover:border-slate-500'
                        : canAfford
                          ? 'border-purple-500/60 bg-slate-800/60 hover:border-purple-400'
                          : 'border-slate-800 bg-slate-900/70 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span
                      className="h-8 w-8 rounded-xl border-2 border-white/40 shadow-inner"
                      style={{ backgroundColor: option.hex }}
                    />
                    {isEquipped ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                        <Check className="h-4 w-4 stroke-[3]" />
                      </span>
                    ) : !isUnlocked ? (
                      <span className="flex items-center gap-1 text-xs font-extrabold text-yellow-300 tabular-nums">
                        <Lock className="h-3.5 w-3.5" />
                        {option.price} ★
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-400">
                        Odemčeno
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold text-white truncate w-full">
                    {option.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Spodní akční lišta šatny */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setFeedbackMsg(null);
              onResetDefault();
            }}
            disabled={
              JSON.stringify(avatarColors) ===
              JSON.stringify(DEFAULT_AVATAR_COLORS)
            }
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            Výchozí barvy
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap shadow-md"
          >
            Hotovo, jdeme hrát!
          </button>
        </div>
      </div>
    </div>
  );
};

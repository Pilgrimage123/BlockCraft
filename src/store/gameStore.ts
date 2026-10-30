import { AvatarColors, BodyPartInfo, ColorOption, PersistedGameState } from '../types/game';

const STORAGE_KEY = 'blocky_world_save_v1';

export const BODY_PARTS: BodyPartInfo[] = [
  { key: 'head', label: 'Hlava', shortLabel: 'Hlava' },
  { key: 'torso', label: 'Trup (Tričko)', shortLabel: 'Trup' },
  { key: 'leftArm', label: 'Levá ruka', shortLabel: 'L. ruka' },
  { key: 'rightArm', label: 'Pravá ruka', shortLabel: 'P. ruka' },
  { key: 'leftLeg', label: 'Levá noha', shortLabel: 'L. noha' },
  { key: 'rightLeg', label: 'Pravá noha', shortLabel: 'P. noha' },
];

export const COLOR_CATALOG: ColorOption[] = [
  // 3 základní barvy zdarma
  { id: 'sunny_yellow', name: 'Sluneční žlutá', hex: '#FACC15', price: 0 },
  { id: 'sky_blue', name: 'Blankytná modrá', hex: '#2563EB', price: 0 },
  { id: 'meadow_green', name: 'Trávově zelená', hex: '#16A34A', price: 0 },
  // 6 prémiových barev za hvězdičky
  { id: 'crimson_red', name: 'Ohnivá červená', hex: '#EF4444', price: 25 },
  { id: 'royal_purple', name: 'Královská fialová', hex: '#9333EA', price: 25 },
  { id: 'candy_pink', name: 'Cukrová růžová', hex: '#EC4899', price: 25 },
  { id: 'lagoon_cyan', name: 'Tyrkysová laguna', hex: '#06B6D4', price: 50 },
  { id: 'lava_orange', name: 'Sopečná oranžová', hex: '#F97316', price: 50 },
  { id: 'star_gold', name: 'Zlatá hvězda', hex: '#EAB308', price: 50 },
];

export const DEFAULT_AVATAR_COLORS: AvatarColors = {
  head: '#FACC15',
  torso: '#2563EB',
  leftArm: '#FACC15',
  rightArm: '#FACC15',
  leftLeg: '#16A34A',
  rightLeg: '#16A34A',
};

export const DEFAULT_GAME_STATE: PersistedGameState = {
  stars: 0,
  unlockedColors: ['sunny_yellow', 'sky_blue', 'meadow_green'],
  avatarColors: { ...DEFAULT_AVATAR_COLORS },
};

export function loadGameState(): PersistedGameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_STATE, avatarColors: { ...DEFAULT_AVATAR_COLORS } };
    const parsed = JSON.parse(raw) as Partial<PersistedGameState>;

    const stars = typeof parsed.stars === 'number' && parsed.stars >= 0 ? parsed.stars : 0;
    const unlockedSet = new Set<string>([
      ...DEFAULT_GAME_STATE.unlockedColors,
      ...(Array.isArray(parsed.unlockedColors) ? parsed.unlockedColors : []),
    ]);

    const avatarColors: AvatarColors = {
      head: parsed.avatarColors?.head || DEFAULT_AVATAR_COLORS.head,
      torso: parsed.avatarColors?.torso || DEFAULT_AVATAR_COLORS.torso,
      leftArm: parsed.avatarColors?.leftArm || DEFAULT_AVATAR_COLORS.leftArm,
      rightArm: parsed.avatarColors?.rightArm || DEFAULT_AVATAR_COLORS.rightArm,
      leftLeg: parsed.avatarColors?.leftLeg || DEFAULT_AVATAR_COLORS.leftLeg,
      rightLeg: parsed.avatarColors?.rightLeg || DEFAULT_AVATAR_COLORS.rightLeg,
    };

    return {
      stars,
      unlockedColors: Array.from(unlockedSet),
      avatarColors,
    };
  } catch {
    return { ...DEFAULT_GAME_STATE, avatarColors: { ...DEFAULT_AVATAR_COLORS } };
  }
}

export function saveGameState(state: PersistedGameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

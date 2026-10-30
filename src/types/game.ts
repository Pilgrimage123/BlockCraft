export type BodyPart =
  | 'head'
  | 'torso'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg';

export type SceneId = 'hub' | 'obby';

export type AvatarColors = Record<BodyPart, string>;

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  price: number; // 0 = zdarma
}

export interface PersistedGameState {
  stars: number;
  unlockedColors: string[];
  avatarColors: AvatarColors;
}

export interface BodyPartInfo {
  key: BodyPart;
  label: string;
  shortLabel: string;
}

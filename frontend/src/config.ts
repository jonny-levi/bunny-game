export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

import { actionColors, needColors, palette } from './ui/tokens';

export const WS_URL = `ws://${window.location.host}/ws`;

export const COLORS = {
  bg: 0x0f0f23,
  panel: palette.plumDeep,
  panelLight: palette.plum,
  accent: palette.brandPink,
  accentLight: palette.brandPinkLight,
  text: palette.white,
  textDark: palette.ink,
  hunger: needColors.hunger,
  happiness: needColors.happiness,
  cleanliness: needColors.cleanliness,
  energy: needColors.energy,
  health: needColors.health,
  btnFeed: actionColors.feed,
  btnClean: actionColors.clean,
  btnPlay: actionColors.play,
  btnSleep: actionColors.sleep,
  btnMedicine: actionColors.medicine,
  btnBreed: actionColors.breed,
};

export const BUNNY_COLORS: Record<string, number> = {
  white: 0xfff5ee,
  brown: 0xd4956b,
  grey: 0xb0b0b0,
  pink: 0xffb6c1,
  black: 0x555555,
  spotted: 0xf0e0d0,
};

export const DECAY_RATES = {
  hunger: 8 / 3600,
  happiness: 5 / 3600,
  cleanliness: 4 / 3600,
  energy: 6 / 3600,
};

export const LIFE_STAGES = ['egg', 'baby', 'teen', 'adult', 'elder'] as const;
export type LifeStage = typeof LIFE_STAGES[number];

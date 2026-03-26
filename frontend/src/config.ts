export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const WS_URL = `ws://${window.location.host}/ws`;

export const COLORS = {
  bg: 0x1a0a2e,
  panel: 0x2d1b4e,
  panelLight: 0x3d2b5e,
  accent: 0xf7a072,
  accentLight: 0xffc9a8,
  text: 0xfff4e0,
  textDark: 0x2d1b4e,
  hunger: 0xff6b6b,
  happiness: 0xffd93d,
  cleanliness: 0x6bcbff,
  energy: 0xb06bff,
  health: 0x51cf66,
  btnFeed: 0xff8a65,
  btnClean: 0x4fc3f7,
  btnPlay: 0xffd54f,
  btnSleep: 0xce93d8,
  btnMedicine: 0x81c784,
  btnBreed: 0xf48fb1,
};

export const BUNNY_COLORS: Record<string, number> = {
  white: 0xffffff,
  brown: 0xbb8844,
  grey: 0x999999,
  pink: 0xffaacc,
  black: 0x444444,
  spotted: 0xeeddcc,
};

export const DECAY_RATES = {
  hunger: 8 / 3600,      // per second
  happiness: 5 / 3600,
  cleanliness: 4 / 3600,
  energy: 6 / 3600,
};

export const LIFE_STAGES = ['egg', 'baby', 'teen', 'adult', 'elder'] as const;
export type LifeStage = typeof LIFE_STAGES[number];

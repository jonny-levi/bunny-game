export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const WS_URL = `ws://${window.location.host}/ws`;

export const COLORS = {
  bg: 0x0f0f23,
  panel: 0x1e1e3f,
  panelLight: 0x2e2e5f,
  accent: 0xff6b9d,
  accentLight: 0xffa3c4,
  text: 0xffffff,
  textDark: 0x1e1e3f,
  hunger: 0xff6b6b,
  happiness: 0xffd93d,
  cleanliness: 0x6bcbff,
  energy: 0xb06bff,
  health: 0x51cf66,
  btnFeed: 0xff7eb3,
  btnClean: 0x7ec8e3,
  btnPlay: 0xffd166,
  btnSleep: 0xc39bd3,
  btnMedicine: 0x82e0aa,
  btnBreed: 0xf1948a,
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

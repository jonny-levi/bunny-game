export const palette = {
  brandPink: 0xff6b9d,
  brandPinkLight: 0xffa3c4,
  cream: 0xfff6e9,
  plum: 0x3e1e4f,
  plumDeep: 0x2a2440,
  sage: 0xa8d5ba,
  butter: 0xffd89c,
  sky: 0xb8d8e8,
  ink: 0x2a2440,
  white: 0xffffff,
  danger: 0xff6b6b,
  success: 0x51cf66,
  energy: 0xb06bff,
} as const;

export const cssPalette = {
  brandPink: '#FF6B9D',
  brandPinkLight: '#FFA3C4',
  cream: '#FFF6E9',
  plum: '#3E1E4F',
  plumDeep: '#2A2440',
  sage: '#A8D5BA',
  butter: '#FFD89C',
  sky: '#B8D8E8',
  ink: '#2A2440',
  white: '#FFFFFF',
  danger: '#FF6B6B',
  success: '#51CF66',
  energy: '#B06BFF',
} as const;

export const radii = { xs: 4, sm: 8, md: 12, lg: 16 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const durations = { quick: 120, normal: 180, cozy: 350, slow: 450 } as const;
export const easings = {
  standard: 'Cubic.easeOut',
  cozy: 'Sine.easeInOut',
  bounce: 'Back.easeOut',
} as const;

export const typography = {
  families: {
    display: 'Fredoka, Nunito, Arial, sans-serif',
    body: 'Nunito, Arial, sans-serif',
  },
  display: { lg: '28px', md: '24px', sm: '20px' },
  body: { md: '16px', sm: '14px' },
  caption: '12px',
} as const;

export const needColors = {
  hunger: palette.danger,
  happiness: palette.butter,
  cleanliness: palette.sky,
  energy: palette.energy,
  health: palette.success,
} as const;

export const actionColors = {
  feed: palette.brandPinkLight,
  clean: palette.sky,
  play: palette.butter,
  sleep: 0xc39bd3,
  medicine: palette.sage,
  breed: 0xf1948a,
} as const;

// Stat decay rates per MINUTE (stats are 0-100)
export const DECAY_RATES = {
  hunger: 8 / 60,       // -8 per hour
  happiness: 5 / 60,    // -5 per hour
  cleanliness: 4 / 60,  // -4 per hour
  energy: 6 / 60,       // -6 per hour
} as const;

// Life stage durations in milliseconds
export const LIFE_STAGE_DURATION_MS = {
  egg: 1 * 60 * 60 * 1000,     // 1 hour
  baby: 24 * 60 * 60 * 1000,   // 24 hours
  teen: 48 * 60 * 60 * 1000,   // 48 hours
  adult: 14 * 24 * 60 * 60 * 1000, // 14 days
  elder: Infinity,               // until death
} as const;

// Life stage order
export const LIFE_STAGE_ORDER = ['egg', 'baby', 'teen', 'adult', 'elder'] as const;

// Death thresholds
export const DEATH = {
  starvationHours: 12,   // hunger=0 for 12h → death
  neglectHours: 6,       // health<10 for 6h → death
  healthCriticalThreshold: 10,
} as const;

// Action stat effects
export const ACTION_EFFECTS: Record<string, Partial<Record<string, number>>> = {
  feed:     { hunger: 30, happiness: 5 },
  clean:    { cleanliness: 35, happiness: 5 },
  play:     { happiness: 25, energy: -15 },
  sleep:    { energy: 40, happiness: 5 },
  medicine: { health: 25, happiness: -10 },
} as const;

// Breeding requirements
export const BREEDING = {
  minHappiness: 60,
  minHealth: 50,
  maxBunniesPerFamily: 8,
} as const;

// Server tick interval
export const TICK_INTERVAL_MS = 30_000; // 30 seconds

// Egg initial stats (not decaying)
export const EGG_STATS = {
  hunger: 100,
  happiness: 100,
  cleanliness: 100,
  energy: 100,
  health: 100,
} as const;

// Action emojis for activity log
export const ACTION_EMOJI: Record<string, string> = {
  feed: '🍳',
  clean: '🛁',
  play: '🎾',
  sleep: '💤',
  medicine: '💊',
  breed: '💕',
} as const;

// Bunny colors available
export const BUNNY_COLORS = ['white', 'brown', 'grey', 'spotted', 'black', 'pink'] as const;
export const BUNNY_PATTERNS = ['none', 'spots', 'stripes'] as const;

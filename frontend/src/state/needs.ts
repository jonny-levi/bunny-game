export type NeedKey = 'hunger' | 'energy' | 'hygiene' | 'affection' | 'health';

export type Needs = Record<NeedKey, number>;

export type LegacyNeedKey = 'cleanliness' | 'happiness';

export interface NeedsState {
  needs: Needs;
  lastTick: number;
}

export type DecayRates = Partial<Record<NeedKey, number>>;

export interface NeedsBalanceConfig {
  /** Need decay per hour. */
  decayPerHour: DecayRates;
  /** Maximum offline/resume catch-up to apply in one pass. */
  maxCatchUpMs: number;
  /** How often active tabs should persist/apply decay. */
  tickMs: number;
  /** Health starts drifting down when any core need is below this value. */
  healthStressThreshold: number;
  /** Health recovers slowly when all core needs are above this value. */
  healthRecoveryThreshold: number;
  /** Health loss per hour while stressed. */
  healthStressDecayPerHour: number;
  /** Health recovery per hour while stable. */
  healthRecoveryPerHour: number;
}

export const NEED_KEYS: NeedKey[] = ['hunger', 'energy', 'hygiene', 'affection', 'health'];

export const DEFAULT_NEEDS: Needs = {
  hunger: 90,
  energy: 70,
  hygiene: 80,
  affection: 90,
  health: 90,
};

export const NEEDS_BALANCE: NeedsBalanceConfig = {
  decayPerHour: {
    hunger: 8,
    energy: 6,
    hygiene: 4,
    affection: 5,
  },
  maxCatchUpMs: 6 * 60 * 60 * 1000,
  tickMs: 30_000,
  healthStressThreshold: 25,
  healthRecoveryThreshold: 65,
  healthStressDecayPerHour: 10,
  healthRecoveryPerHour: 3,
};

const STORAGE_KEY = 'bunny-family-needs-v1';

function clampNeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function normalizeNeeds(value: Partial<Needs> & Partial<Record<LegacyNeedKey, number>> = {}): Needs {
  return {
    hunger: clampNeed(value.hunger ?? DEFAULT_NEEDS.hunger),
    energy: clampNeed(value.energy ?? DEFAULT_NEEDS.energy),
    hygiene: clampNeed(value.hygiene ?? value.cleanliness ?? DEFAULT_NEEDS.hygiene),
    affection: clampNeed(value.affection ?? value.happiness ?? DEFAULT_NEEDS.affection),
    health: clampNeed(value.health ?? DEFAULT_NEEDS.health),
  };
}

export function applyDecay(
  needs: Needs,
  elapsedMs: number,
  config: NeedsBalanceConfig = NEEDS_BALANCE,
): Needs {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return normalizeNeeds(needs);

  const cappedElapsed = Math.min(elapsedMs, config.maxCatchUpMs);
  const elapsedHours = cappedElapsed / 3_600_000;
  const next = normalizeNeeds(needs);

  for (const key of NEED_KEYS) {
    if (key === 'health') continue;
    const rate = config.decayPerHour[key] ?? 0;
    next[key] = clampNeed(next[key] - rate * elapsedHours);
  }

  const coreNeeds: NeedKey[] = ['hunger', 'energy', 'hygiene', 'affection'];
  const lowestCoreNeed = Math.min(...coreNeeds.map((key) => next[key]));
  if (lowestCoreNeed < config.healthStressThreshold) {
    const stressMultiplier = Math.max(1, (config.healthStressThreshold - lowestCoreNeed) / config.healthStressThreshold);
    next.health = clampNeed(next.health - config.healthStressDecayPerHour * stressMultiplier * elapsedHours);
  } else if (lowestCoreNeed >= config.healthRecoveryThreshold) {
    next.health = clampNeed(next.health + config.healthRecoveryPerHour * elapsedHours);
  }

  return next;
}

function sanitizeState(raw: unknown): NeedsState | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<NeedsState>;
  const lastTick = typeof candidate.lastTick === 'number' && Number.isFinite(candidate.lastTick)
    ? candidate.lastTick
    : Date.now();
  return {
    needs: normalizeNeeds(candidate.needs ?? {}),
    lastTick,
  };
}

export function readNeedsState(now = Date.now()): NeedsState {
  if (typeof localStorage === 'undefined') return { needs: { ...DEFAULT_NEEDS }, lastTick: now };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return sanitizeState(parsed) ?? { needs: { ...DEFAULT_NEEDS }, lastTick: now };
  } catch {
    return { needs: { ...DEFAULT_NEEDS }, lastTick: now };
  }
}

export function writeNeedsState(state: NeedsState) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      needs: normalizeNeeds(state.needs),
      lastTick: state.lastTick,
    }));
  } catch {
    // Storage may be unavailable in private/quota-limited sessions. The active
    // runtime still keeps the current state in memory.
  }
}

export function catchUpNeeds(state: NeedsState, now = Date.now(), config: NeedsBalanceConfig = NEEDS_BALANCE): NeedsState {
  return {
    needs: applyDecay(state.needs, now - state.lastTick, config),
    lastTick: now,
  };
}

export function legacyStatsFromNeeds(needs: Needs) {
  const normalized = normalizeNeeds(needs);
  return {
    hunger: normalized.hunger,
    energy: normalized.energy,
    cleanliness: normalized.hygiene,
    happiness: normalized.affection,
    health: normalized.health,
  };
}

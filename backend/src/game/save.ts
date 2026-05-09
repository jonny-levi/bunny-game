import type { CareAction, PlayerSave, SaveEgg, SaveIdentity, SaveNeeds, SaveRole } from '../shared/saveTypes';

export const IDENTITY_COUNT = 100;
export const HATCH_TAPS = 8;

export const DEFAULT_NEEDS: SaveNeeds = {
  hunger: 90,
  energy: 70,
  hygiene: 80,
  affection: 90,
  health: 90,
};

export const NEEDS_BALANCE = {
  decayPerHour: {
    hunger: 8,
    energy: 6,
    hygiene: 4,
    affection: 5,
  },
  maxCatchUpMs: 6 * 60 * 60 * 1000,
  healthStressThreshold: 25,
  healthRecoveryThreshold: 65,
  healthStressDecayPerHour: 10,
  healthRecoveryPerHour: 3,
};

const ACTION_DELTAS: Record<CareAction, Partial<SaveNeeds>> = {
  feed: { hunger: 25 },
  sleep: { energy: 30 },
  bathe: { hygiene: 30 },
  play: { affection: 20, energy: -8 },
  vet: { health: 20 },
};

function clampNeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function normalizeNeeds(value: Partial<SaveNeeds> = {}): SaveNeeds {
  return {
    hunger: clampNeed(value.hunger ?? DEFAULT_NEEDS.hunger),
    energy: clampNeed(value.energy ?? DEFAULT_NEEDS.energy),
    hygiene: clampNeed(value.hygiene ?? DEFAULT_NEEDS.hygiene),
    affection: clampNeed(value.affection ?? DEFAULT_NEEDS.affection),
    health: clampNeed(value.health ?? DEFAULT_NEEDS.health),
  };
}

export function applyDecay(needs: SaveNeeds, elapsedMs: number): SaveNeeds {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return normalizeNeeds(needs);
  const elapsedHours = Math.min(elapsedMs, NEEDS_BALANCE.maxCatchUpMs) / 3_600_000;
  const next = normalizeNeeds(needs);

  next.hunger = clampNeed(next.hunger - NEEDS_BALANCE.decayPerHour.hunger * elapsedHours);
  next.energy = clampNeed(next.energy - NEEDS_BALANCE.decayPerHour.energy * elapsedHours);
  next.hygiene = clampNeed(next.hygiene - NEEDS_BALANCE.decayPerHour.hygiene * elapsedHours);
  next.affection = clampNeed(next.affection - NEEDS_BALANCE.decayPerHour.affection * elapsedHours);

  const lowest = Math.min(next.hunger, next.energy, next.hygiene, next.affection);
  if (lowest < NEEDS_BALANCE.healthStressThreshold) {
    const stressMultiplier = Math.max(1, (NEEDS_BALANCE.healthStressThreshold - lowest) / NEEDS_BALANCE.healthStressThreshold);
    next.health = clampNeed(next.health - NEEDS_BALANCE.healthStressDecayPerHour * stressMultiplier * elapsedHours);
  } else if (lowest >= NEEDS_BALANCE.healthRecoveryThreshold) {
    next.health = clampNeed(next.health + NEEDS_BALANCE.healthRecoveryPerHour * elapsedHours);
  }
  return next;
}

export function applyAction(needs: SaveNeeds, action: CareAction): SaveNeeds {
  const next = normalizeNeeds(needs);
  const delta = ACTION_DELTAS[action];
  for (const [key, amount] of Object.entries(delta) as [keyof SaveNeeds, number][]) {
    next[key] = clampNeed(next[key] + amount);
  }
  return next;
}

function clampIdentityIndex(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 1 && value <= IDENTITY_COUNT ? value : null;
}

export function sanitizeIdentity(value: unknown, role: SaveRole): SaveIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SaveIdentity>;
  const identityIndex = clampIdentityIndex(candidate.identityIndex);
  if (candidate.role !== role || identityIndex == null) return null;
  return { role, identityIndex };
}

export function sanitizeEgg(value: unknown): SaveEgg {
  if (!value || typeof value !== 'object') return { taps: 0, hatched: false, seed: 0 };
  const candidate = value as Partial<SaveEgg>;
  return {
    taps: typeof candidate.taps === 'number' ? Math.max(0, Math.min(HATCH_TAPS, Math.trunc(candidate.taps))) : 0,
    hatched: candidate.hatched === true,
    seed: typeof candidate.seed === 'number' && Number.isFinite(candidate.seed) ? candidate.seed >>> 0 : 0,
  };
}

function pickIdentityIndex(seed: number): number {
  const v = (seed * 2654435761) >>> 0;
  return (v % IDENTITY_COUNT) + 1;
}

export function deriveBabyIdentity(father: SaveIdentity | null, mother: SaveIdentity | null, seed: number): SaveIdentity {
  const derivedSeed = seed
    ^ (father?.identityIndex ?? 0) * 0x9e3779b1
    ^ (mother?.identityIndex ?? 0) * 0x85ebca6b;
  return { role: 'baby', identityIndex: pickIdentityIndex(derivedSeed >>> 0) };
}

export function defaultSave(userId: string, now = new Date()): PlayerSave {
  return {
    version: 1,
    userId,
    father: null,
    mother: null,
    baby: null,
    egg: { taps: 0, hatched: false, seed: 0 },
    needs: { ...DEFAULT_NEEDS },
    lastTick: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

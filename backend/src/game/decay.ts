import type { Bunny, LifeStage, DeathCause } from '../shared/types';
import { DECAY_RATES, LIFE_STAGE_DURATION_MS, LIFE_STAGE_ORDER, DEATH } from '../shared/constants';

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function calculateHealth(b: Bunny): number {
  return clamp(b.hunger * 0.4 + b.happiness * 0.2 + b.cleanliness * 0.2 + b.energy * 0.2);
}

function nextStage(stage: LifeStage): LifeStage | null {
  const idx = LIFE_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= LIFE_STAGE_ORDER.length - 1) return null;
  return LIFE_STAGE_ORDER[idx + 1];
}

export interface DecayResult {
  died: boolean;
  deathCause?: DeathCause;
  stageChanged: boolean;
  newStage?: LifeStage;
}

/**
 * Apply time-based decay to a bunny, mutating it in place.
 * Works for both catch-up (large elapsed) and live ticks (30s).
 */
export function applyDecay(bunny: Bunny, now: Date = new Date()): DecayResult {
  if (!bunny.isAlive) return { died: false, stageChanged: false };

  const result: DecayResult = { died: false, stageChanged: false };
  const lastUpdated = new Date(bunny.lastUpdated);
  const elapsedMs = now.getTime() - lastUpdated.getTime();
  if (elapsedMs <= 0) return result;

  const elapsedMin = elapsedMs / 60_000;

  // Eggs don't decay - they just hatch
  if (bunny.stage === 'egg') {
    // Check stage transition
    const stageElapsed = now.getTime() - new Date(bunny.stageStartedAt).getTime();
    const duration = LIFE_STAGE_DURATION_MS[bunny.stage];
    if (stageElapsed >= duration) {
      const next = nextStage(bunny.stage);
      if (next) {
        bunny.stage = next;
        bunny.stageStartedAt = now.toISOString();
        result.stageChanged = true;
        result.newStage = next;
      }
    }
    bunny.lastUpdated = now.toISOString();
    return result;
  }

  // Apply stat decay
  bunny.hunger = clamp(bunny.hunger - elapsedMin * DECAY_RATES.hunger);
  bunny.happiness = clamp(bunny.happiness - elapsedMin * DECAY_RATES.happiness);
  bunny.cleanliness = clamp(bunny.cleanliness - elapsedMin * DECAY_RATES.cleanliness);
  bunny.energy = clamp(bunny.energy - elapsedMin * DECAY_RATES.energy);
  bunny.health = calculateHealth(bunny);

  // Track hunger zero
  if (bunny.hunger === 0) {
    if (!bunny.hungerZeroSince) bunny.hungerZeroSince = lastUpdated.toISOString();
  } else {
    bunny.hungerZeroSince = null;
  }

  // Track health critical
  if (bunny.health < DEATH.healthCriticalThreshold) {
    if (!bunny.healthCriticalSince) bunny.healthCriticalSince = lastUpdated.toISOString();
  } else {
    bunny.healthCriticalSince = null;
  }

  // Death checks
  if (bunny.hungerZeroSince) {
    const zeroHours = (now.getTime() - new Date(bunny.hungerZeroSince).getTime()) / 3_600_000;
    if (zeroHours >= DEATH.starvationHours) {
      bunny.isAlive = false;
      bunny.diedAt = now.toISOString();
      bunny.deathCause = 'starvation';
      result.died = true;
      result.deathCause = 'starvation';
    }
  }

  if (!result.died && bunny.healthCriticalSince) {
    const criticalHours = (now.getTime() - new Date(bunny.healthCriticalSince).getTime()) / 3_600_000;
    if (criticalHours >= DEATH.neglectHours) {
      bunny.isAlive = false;
      bunny.diedAt = now.toISOString();
      bunny.deathCause = 'neglect';
      result.died = true;
      result.deathCause = 'neglect';
    }
  }

  // Life stage transition
  if (!result.died) {
    const stageElapsed = now.getTime() - new Date(bunny.stageStartedAt).getTime();
    const duration = LIFE_STAGE_DURATION_MS[bunny.stage];
    if (duration !== Infinity && stageElapsed >= duration) {
      const next = nextStage(bunny.stage);
      if (next) {
        bunny.stage = next;
        bunny.stageStartedAt = now.toISOString();
        result.stageChanged = true;
        result.newStage = next;
      }
    }
  }

  bunny.lastUpdated = now.toISOString();
  return result;
}

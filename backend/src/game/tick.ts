import type { Bunny } from '../shared/types';
import { TICK_INTERVAL_MS } from '../shared/constants';
import { applyDecay } from './decay';
import * as db from '../db/queries';

type BroadcastFn = (familyId: string, message: object) => void;

const activeIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Start ticking a family's bunnies (when ≥1 player connects).
 */
export function startFamilyTick(familyId: string, broadcast: BroadcastFn) {
  if (activeIntervals.has(familyId)) return;

  const interval = setInterval(async () => {
    try {
      const bunnies = await db.getAliveBunnies(familyId);
      const now = new Date();
      const events: object[] = [];

      for (const bunny of bunnies) {
        const result = applyDecay(bunny, now);
        await db.updateBunny(bunny);

        if (result.died) {
          events.push({ type: 'death', bunnyId: bunny.id, bunnyName: bunny.name, cause: result.deathCause });
        }
        if (result.stageChanged) {
          events.push({ type: 'stage_change', bunnyId: bunny.id, bunnyName: bunny.name, newStage: result.newStage });
        }
      }

      // Send tick update
      broadcast(familyId, { type: 'tick', bunnies, timestamp: now.getTime() });

      // Send events
      for (const event of events) {
        broadcast(familyId, event);
      }
    } catch (err) {
      console.error(`Tick error for family ${familyId}:`, err);
    }
  }, TICK_INTERVAL_MS);

  activeIntervals.set(familyId, interval);
  console.log(`⏱️  Started tick for family ${familyId}`);
}

/**
 * Stop ticking a family (when all players disconnect).
 */
export function stopFamilyTick(familyId: string) {
  const interval = activeIntervals.get(familyId);
  if (interval) {
    clearInterval(interval);
    activeIntervals.delete(familyId);
    console.log(`⏹️  Stopped tick for family ${familyId}`);
  }
}

/**
 * Stop all ticks (graceful shutdown).
 */
export function stopAllTicks() {
  for (const [familyId, interval] of activeIntervals) {
    clearInterval(interval);
    console.log(`⏹️  Stopped tick for family ${familyId}`);
  }
  activeIntervals.clear();
}

/**
 * Catch-up decay for all alive bunnies in a family (called on connect).
 */
export async function catchUpFamily(familyId: string, broadcast: BroadcastFn): Promise<Bunny[]> {
  const bunnies = await db.getAliveBunnies(familyId);
  const now = new Date();

  for (const bunny of bunnies) {
    const result = applyDecay(bunny, now);
    await db.updateBunny(bunny);

    if (result.died) {
      broadcast(familyId, { type: 'death', bunnyId: bunny.id, bunnyName: bunny.name, cause: result.deathCause });
    }
    if (result.stageChanged) {
      broadcast(familyId, { type: 'stage_change', bunnyId: bunny.id, bunnyName: bunny.name, newStage: result.newStage });
    }
  }

  return bunnies;
}

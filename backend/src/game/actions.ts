import type { Bunny, ActionType } from '../shared/types';
import { ACTION_EFFECTS, ACTION_EMOJI, BREEDING, BUNNY_COLORS, BUNNY_PATTERNS } from '../shared/constants';
import { generateBunnyName } from './names';
import * as db from '../db/queries';

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export interface ActionResult {
  success: boolean;
  message: string;
  bunny: Bunny;
  newBunny?: Bunny; // for breeding
}

export async function performAction(
  action: ActionType,
  bunny: Bunny,
  playerName: string,
  playerId: string,
  targetBunny?: Bunny // second parent for breeding
): Promise<ActionResult> {

  if (!bunny.isAlive) {
    return { success: false, message: `${bunny.name} is no longer with us 😢`, bunny };
  }

  if (bunny.stage === 'egg' && action !== 'breed') {
    return { success: false, message: `${bunny.name} is still an egg! 🥚`, bunny };
  }

  // Breeding
  if (action === 'breed') {
    return performBreeding(bunny, targetBunny, playerName, playerId);
  }

  // Apply stat effects
  const effects = ACTION_EFFECTS[action];
  if (effects) {
    for (const [stat, delta] of Object.entries(effects)) {
      (bunny as any)[stat] = clamp((bunny as any)[stat] + (delta as number));
    }
  }

  // Recalculate health
  bunny.health = clamp(bunny.hunger * 0.4 + bunny.happiness * 0.2 + bunny.cleanliness * 0.2 + bunny.energy * 0.2);
  bunny.lastUpdated = new Date().toISOString();

  // Clear critical trackers if stats improved
  if (bunny.hunger > 0) bunny.hungerZeroSince = null;
  if (bunny.health >= 10) bunny.healthCriticalSince = null;

  await db.updateBunny(bunny);

  const emoji = ACTION_EMOJI[action] || '✨';
  const verb = actionVerb(action);
  const message = `${playerName} ${verb} ${bunny.name} ${emoji}`;

  await db.addActivity(bunny.familyId, playerId, bunny.id, action, message);

  return { success: true, message, bunny };
}

async function performBreeding(
  parentA: Bunny,
  parentB: Bunny | undefined,
  playerName: string,
  playerId: string,
): Promise<ActionResult> {
  if (!parentB) {
    return { success: false, message: 'Need two bunnies to breed! 💕', bunny: parentA };
  }
  if (parentA.id === parentB.id) {
    return { success: false, message: 'A bunny can\'t breed with itself! 🙈', bunny: parentA };
  }
  if (parentA.stage !== 'adult' || parentB.stage !== 'adult') {
    return { success: false, message: 'Both bunnies must be adults to breed! 🐰', bunny: parentA };
  }
  if (!parentA.isAlive || !parentB.isAlive) {
    return { success: false, message: 'Both bunnies must be alive! 😢', bunny: parentA };
  }
  if (parentA.happiness < BREEDING.minHappiness || parentB.happiness < BREEDING.minHappiness) {
    return { success: false, message: 'Bunnies need to be happier to breed! 😊', bunny: parentA };
  }
  if (parentA.health < BREEDING.minHealth || parentB.health < BREEDING.minHealth) {
    return { success: false, message: 'Bunnies need to be healthier to breed! ❤️', bunny: parentA };
  }

  // Check family bunny count
  const siblings = await db.getAliveBunnies(parentA.familyId);
  if (siblings.length >= BREEDING.maxBunniesPerFamily) {
    return { success: false, message: `Too many bunnies! Max ${BREEDING.maxBunniesPerFamily} 🐰`, bunny: parentA };
  }

  // Inherit color from random parent, maybe mutate pattern
  const colors = BUNNY_COLORS;
  const color = Math.random() < 0.8
    ? (Math.random() < 0.5 ? parentA.color : parentB.color)
    : colors[Math.floor(Math.random() * colors.length)];
  const pattern = Math.random() < 0.7
    ? (Math.random() < 0.5 ? parentA.pattern : parentB.pattern)
    : BUNNY_PATTERNS[Math.floor(Math.random() * BUNNY_PATTERNS.length)];

  const newBunny = await db.insertBunny({
    familyId: parentA.familyId,
    name: generateBunnyName(),
    color, pattern,
    stage: 'egg',
    parentAId: parentA.id,
    parentBId: parentB.id,
  });

  const message = `${playerName} helped ${parentA.name} & ${parentB.name} breed! A new egg appeared! 🥚💕`;
  await db.addActivity(parentA.familyId, playerId, newBunny.id, 'breed', message);

  return { success: true, message, bunny: parentA, newBunny };
}

function actionVerb(action: ActionType): string {
  switch (action) {
    case 'feed': return 'fed';
    case 'clean': return 'cleaned';
    case 'play': return 'played with';
    case 'sleep': return 'put to sleep';
    case 'medicine': return 'gave medicine to';
    default: return 'interacted with';
  }
}

export type CareAction = 'feed' | 'clean' | 'play' | 'sleep' | 'medicine' | 'breed';

export interface CareActionConfig {
  label: string;
  shortLabel: string;
  action: CareAction;
  cooldownMs: number;
  mood: 'eating' | 'sleeping' | 'playing' | 'happy';
}

export const CARE_ACTIONS: CareActionConfig[] = [
  { label: '🍳 Feed', shortLabel: 'Feed', action: 'feed', cooldownMs: 1_500, mood: 'eating' },
  { label: '🛁 Bathe', shortLabel: 'Bathe', action: 'clean', cooldownMs: 1_500, mood: 'happy' },
  { label: '🎾 Play', shortLabel: 'Play', action: 'play', cooldownMs: 1_500, mood: 'playing' },
  { label: '💤 Sleep', shortLabel: 'Sleep', action: 'sleep', cooldownMs: 2_500, mood: 'sleeping' },
  { label: '💊 Vet', shortLabel: 'Vet', action: 'medicine', cooldownMs: 10_000, mood: 'happy' },
  { label: '💕 Breed', shortLabel: 'Breed', action: 'breed', cooldownMs: 10_000, mood: 'happy' },
];

export const ACTION_COOLDOWNS = CARE_ACTIONS.reduce((acc, item) => {
  acc[item.action] = item.cooldownMs;
  return acc;
}, {} as Record<CareAction, number>);

export const ACTION_LABELS = CARE_ACTIONS.reduce((acc, item) => {
  acc[item.action] = item.shortLabel;
  return acc;
}, {} as Record<CareAction, string>);

export function isCareAction(action: string): action is CareAction {
  return CARE_ACTIONS.some(item => item.action === action);
}

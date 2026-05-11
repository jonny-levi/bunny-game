import Phaser from 'phaser';
import { getVolume, isMuted } from './sound';

export const SAMPLE_KEYS = [
  'feed', 'clean', 'play', 'sleep', 'medicine', 'breed', 'hatch', 'success-chime', 'fail-tone', 'click',
] as const;
export type SampleKey = typeof SAMPLE_KEYS[number];

export function preloadSamples(scene: Phaser.Scene) {
  SAMPLE_KEYS.forEach(key => scene.load.audio(`sample-${key}`, [`/assets/audio/${key}.ogg`]));
}

export function playSample(scene: Phaser.Scene, key: SampleKey): boolean {
  if (isMuted() || !scene.sound || !scene.cache.audio.exists(`sample-${key}`)) return false;
  try {
    scene.sound.play(`sample-${key}`, { volume: getVolume() });
    return true;
  } catch {
    return false;
  }
}

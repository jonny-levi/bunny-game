import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export type Orientation = 'portrait' | 'landscape';

export interface LayoutContext {
  width: number;
  height: number;
  orientation: Orientation;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  playTop: number;
  playBottom: number;
  dockY: number;
  dockIconSize: number;
  hudX: number;
  hudY: number;
  hudMaxHeight: number;
  roomScaleX: number;
  roomScaleY: number;
}


export function getLayout(scene: Phaser.Scene): LayoutContext {
  const width = scene.scale.width || GAME_WIDTH;
  const height = scene.scale.height || GAME_HEIGHT;
  const orientation: Orientation = height > width ? 'portrait' : 'landscape';
  const style = typeof window !== 'undefined' ? getComputedStyle(document.body) : null;
  const safeTop = style ? Number.parseFloat(style.paddingTop) || 0 : 0;
  const safeRight = style ? Number.parseFloat(style.paddingRight) || 0 : 0;
  const safeBottom = style ? Number.parseFloat(style.paddingBottom) || 0 : 0;
  const safeLeft = style ? Number.parseFloat(style.paddingLeft) || 0 : 0;
  const dockIconSize = orientation === 'portrait' ? 56 : 50;
  const dockY = height - safeBottom - (orientation === 'portrait' ? 42 : 34);
  const playTop = safeTop;
  const playBottom = Math.max(playTop + 260, dockY - (orientation === 'portrait' ? 78 : 58));
  return {
    width,
    height,
    orientation,
    safeTop,
    safeRight,
    safeBottom,
    safeLeft,
    playTop,
    playBottom,
    dockY,
    dockIconSize,
    hudX: width - safeRight - 12,
    hudY: safeTop + 12,
    hudMaxHeight: Math.max(180, playBottom - playTop - 8),
    roomScaleX: width / GAME_WIDTH,
    roomScaleY: playBottom / 480,
  };
}

export function onLayout(scene: Phaser.Scene, callback: (layout: LayoutContext) => void) {
  const apply = () => callback(getLayout(scene));
  apply();
  scene.scale.on('resize', apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', apply));
}

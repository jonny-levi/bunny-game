import Phaser from 'phaser';

export const ICONS = {
  feed: 'feed.svg',
  clean: 'clean.svg',
  play: 'play.svg',
  sleep: 'sleep.svg',
  medicine: 'medicine.svg',
  breed: 'breed.svg',
  mute: 'mute.svg',
  unmute: 'unmute.svg',
  settings: 'settings.svg',
  arrowLeft: 'arrow-left.svg',
  arrowRight: 'arrow-right.svg',
  seasonSun: 'season-sun.svg',
  minigames: 'minigames.svg',
} as const;

export type IconName = keyof typeof ICONS;
export const iconKey = (name: IconName) => `ui-icon-${name}`;

export function preloadIcons(scene: Phaser.Scene) {
  (Object.keys(ICONS) as IconName[]).forEach((name) => {
    if (!scene.textures.exists(iconKey(name))) {
      scene.load.svg(iconKey(name), `/assets/icons/${ICONS[name]}`, { width: 48, height: 48 });
    }
  });
}

export function addIcon(scene: Phaser.Scene, name: IconName, x: number, y: number, size = 24) {
  return scene.add.image(x, y, iconKey(name)).setDisplaySize(size, size);
}

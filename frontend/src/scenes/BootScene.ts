import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { currentIdentityAssets } from '../state/identityRegistry';
import { preloadIcons } from '../ui/Icon';
import { preloadSamples } from '../utils/sampleAudio';

const HERO_KEY = 'login-hero';
const HERO_PATH = '/assets/branding/login-hero.svg';
const HINTS = [
  'Warming up the nest…',
  'Brushing the bunnies…',
  'Sweeping the floors…',
  'Tuning the music…',
  'Almost there!',
];

const ROOM_TEXTURES = {
  'room-living': '/assets/rooms/living-room.svg',
  'room-kitchen': '/assets/rooms/kitchen.svg',
  'room-bathroom': '/assets/rooms/bathroom.svg',
  'room-garden': '/assets/rooms/garden.svg',
  'room-bedroom': '/assets/rooms/bedroom.svg',
  'room-vet': '/assets/rooms/vet.svg',
  'room-nest': '/assets/rooms/nest.svg',
} as const;

export class BootScene extends Phaser.Scene {
  private barFill?: Phaser.GameObjects.Rectangle;
  private statusText?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'BootScene' }); }

  preload() {
    this.createLoadingSurface();
    this.load.svg(HERO_KEY, HERO_PATH, { width: 640, height: 360 });
    preloadIcons(this);
    preloadSamples(this);
    Object.entries(ROOM_TEXTURES).forEach(([key, path]) => {
      this.load.svg(key, path, { width: GAME_WIDTH, height: 480 });
    });
    currentIdentityAssets().forEach(({ key, path, kind }) => {
      this.load.svg(key, path, {
        width: kind === 'adult' ? 160 : 120,
        height: kind === 'adult' ? 160 : 120,
      });
    });
    this.load.on('progress', (pct: number) => this.updateProgress(pct));
    this.load.on('fileprogress', (_file: Phaser.Loader.File, pct: number) => {
      const hint = HINTS[Math.min(HINTS.length - 1, Math.floor(pct * HINTS.length))];
      this.statusText?.setText(hint);
    });
  }

  create() {
    this.updateProgress(1);
    this.statusText?.setText('Ready! ✨');
    this.time.delayedCall(250, () => this.scene.start('LoginScene'));
  }

  private createLoadingSurface() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffe6c8);
    this.add.rectangle(cx, 110, GAME_WIDTH, 220, 0xffbed0, 0.38);
    const cloudA = this.add.ellipse(112, 92, 82, 24, 0xffffff, 0.45);
    const cloudB = this.add.ellipse(530, 108, 110, 28, 0xffffff, 0.38);
    this.tweens.add({ targets: cloudA, x: 142, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: cloudB, x: 488, duration: 6200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(cx, cy - 122, 'Bunny Family', {
      fontFamily: 'Fredoka, Nunito, Arial, sans-serif',
      fontSize: '56px',
      color: '#f15f9b',
      shadow: { offsetX: 0, offsetY: 5, color: '#7b315f', blur: 10, fill: true },
    }).setOrigin(0.5);
    this.add.text(cx, cy - 78, 'raise your bunny family together', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '14px',
      color: '#5f315c',
    }).setOrigin(0.5);

    this.add.rectangle(cx, cy + 6, 318, 18, 0xffffff, 0.54).setStrokeStyle(2, 0xf15f9b, 0.55);
    this.barFill = this.add.rectangle(cx - 155, cy + 6, 0, 12, 0xf15f9b).setOrigin(0, 0.5);
    this.statusText = this.add.text(cx, cy + 36, HINTS[0], {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '13px',
      color: '#5f315c',
    }).setOrigin(0.5);
  }

  private updateProgress(pct: number) {
    const clamped = Phaser.Math.Clamp(pct, 0, 1);
    if (this.barFill) this.barFill.width = 310 * clamped;
    const hint = HINTS[Math.min(HINTS.length - 1, Math.floor(clamped * HINTS.length))];
    this.statusText?.setText(`${hint} ${Math.floor(clamped * 100)}%`);
  }
}

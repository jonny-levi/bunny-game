import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { currentIdentityAssets } from '../state/identityRegistry';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // Preload only the persisted selected identities plus index-1 fallbacks.
    // The full 400-SVG library lives in /assets and is lazy-loaded by scenes
    // when a new identity/state becomes visible.
    currentIdentityAssets().forEach(({ key, path, kind }) => {
      this.load.svg(key, path, {
        width: kind === 'adult' ? 160 : 120,
        height: kind === 'adult' ? 160 : 120,
      });
    });
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x1a1a3e);

    this.add.text(cx, cy - 80, '🐰 Bunny Family 🐰', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ff6b9d',
      stroke: '#1a1a3e',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Modern loading bar
    this.add.rectangle(cx, cy, 300, 16, 0x333355).setStrokeStyle(2, 0xff6b9d, 0.5);
    const barFill = this.add.rectangle(cx - 148, cy, 0, 12, 0xff6b9d).setOrigin(0, 0.5);

    const statusText = this.add.text(cx, cy + 25, 'Loading...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5);

    let progress = 0;
    this.time.addEvent({
      delay: 25,
      repeat: 30,
      callback: () => {
        progress += 1 / 30;
        barFill.width = 296 * Math.min(progress, 1);
        statusText.setText(`Loading... ${Math.floor(progress * 100)}%`);
        if (progress >= 1) {
          statusText.setText('Ready! ✨');
          this.time.delayedCall(250, () => {
            this.scene.start('LoginScene');
          });
        }
      },
    });
  }
}

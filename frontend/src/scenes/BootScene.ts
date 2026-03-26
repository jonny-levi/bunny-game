import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.text(cx, cy - 80, '🐰 Bunny Family 🐰', {
      fontFamily: '"Press Start 2P"',
      fontSize: '18px',
      color: '#f7a072',
      stroke: '#2d1b4e',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const barFill = this.add.rectangle(cx - 148, cy, 0, 16, COLORS.accent).setOrigin(0, 0.5);
    this.add.rectangle(cx, cy, 300, 20, 0x222222).setStrokeStyle(2, COLORS.accent);

    const statusText = this.add.text(cx, cy + 30, 'Loading...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#fff4e0',
    }).setOrigin(0.5);

    let progress = 0;
    this.time.addEvent({
      delay: 30,
      repeat: 30,
      callback: () => {
        progress += 1 / 30;
        barFill.width = 296 * Math.min(progress, 1);
        statusText.setText(`Loading... ${Math.floor(progress * 100)}%`);
        if (progress >= 1) {
          statusText.setText('Ready!');
          this.time.delayedCall(300, () => {
            this.scene.start('LoginScene');
          });
        }
      },
    });
  }
}

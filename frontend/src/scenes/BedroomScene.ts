import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class BedroomScene extends RoomScene {
  constructor() { super({ key: 'BedroomScene' }); }
  getRoomName() { return '🌙 Bedroom'; }

  drawRoom() {
    // Wall - deep purple/blue night sky
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0x1a1a3e);

    // Stars
    for (let i = 0; i < 30; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, 280),
        Phaser.Math.Between(1, 3), 0xffd54f, Phaser.Math.FloatBetween(0.2, 0.8)
      );
      this.tweens.add({ targets: star, alpha: 0.15, duration: Phaser.Math.Between(800, 2500), yoyo: true, repeat: -1 });
    }

    // Moon with glow
    this.add.circle(660, 70, 40, 0xfff9c4, 0.15); // glow
    this.add.circle(660, 70, 32, 0xfff9c4);
    this.add.circle(650, 63, 27, 0x1a1a3e); // crescent

    // Floor - dark carpet
    this.add.rectangle(GAME_WIDTH / 2, H - 40, GAME_WIDTH, 80, 0x37474f);
    this.add.rectangle(GAME_WIDTH / 2, H - 50, 280, 50, 0x4a148c, 0.2); // purple rug

    // Bed - colorful and cozy
    this.add.rectangle(GAME_WIDTH / 2, H - 120, 270, 22, 0x8d6e63); // frame
    this.add.rectangle(GAME_WIDTH / 2, H - 155, 270, 50, 0xf8bbd0); // mattress
    this.add.rectangle(GAME_WIDTH / 2, H - 155, 264, 44, 0xf48fb1); // sheet
    // Pillows
    this.add.ellipse(GAME_WIDTH / 2 - 90, H - 170, 55, 28, 0xffffff);
    this.add.ellipse(GAME_WIDTH / 2 + 90, H - 170, 55, 28, 0xfce4ec);
    // Blanket with pattern
    this.add.rectangle(GAME_WIDTH / 2, H - 135, 260, 22, 0xce93d8, 0.85);
    // Stars on blanket
    for (let x = -100; x <= 100; x += 40) {
      this.add.text(GAME_WIDTH / 2 + x, H - 138, '⭐', { fontSize: '8px' }).setOrigin(0.5).setAlpha(0.4);
    }

    // Nightstand
    this.add.rectangle(140, H - 145, 45, 55, 0x8d6e63);
    // Lamp on nightstand
    this.add.rectangle(140, H - 180, 5, 22, 0xe0e0e0);
    this.add.ellipse(140, H - 196, 28, 16, 0xffd54f, 0.7);
    // Warm glow
    this.add.circle(140, H - 190, 25, 0xffd54f, 0.08);

    // Bookshelf
    this.add.rectangle(680, 180, 70, 110, 0x6d4c41).setStrokeStyle(1, 0x5d4037);
    const bookColors = [0xff7043, 0x42a5f5, 0x66bb6a, 0xffd54f, 0xce93d8];
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(660 + i * 12, 160, 10, 35, bookColors[i]);
    }
    for (let i = 0; i < 4; i++) {
      this.add.rectangle(665 + i * 14, 200, 12, 30, bookColors[4 - i]);
    }

    // Dim overlay
    this.add.rectangle(GAME_WIDTH / 2, H / 2, GAME_WIDTH, H, 0x000033, 0.2);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playSleeping();
      this.time.delayedCall(5000, () => b.startIdleBounce());
    });
  }
}

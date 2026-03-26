import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class KitchenScene extends RoomScene {
  constructor() { super({ key: 'KitchenScene' }); }
  getRoomName() { return '🍳 Kitchen'; }

  drawRoom() {
    // Wall - warm cream
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0xfff3e0);
    // Tile backsplash
    for (let x = 0; x < GAME_WIDTH; x += 30) {
      for (let y = 100; y < 200; y += 30) {
        this.add.rectangle(x + 15, y + 15, 28, 28, (x + y) % 60 === 0 ? 0xffe0b2 : 0xfff8e1, 0.6).setStrokeStyle(1, 0xffcc80, 0.3);
      }
    }

    // Floor tiles - checkered
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      this.add.rectangle(x + 20, H - 40, 40, 80, x % 80 === 0 ? 0xf5deb3 : 0xfaebd7);
    }

    // Counter
    this.add.rectangle(GAME_WIDTH / 2, H - 140, GAME_WIDTH - 80, 25, 0x8d6e53).setStrokeStyle(1, 0x6d4c41);
    this.add.rectangle(GAME_WIDTH / 2, H - 120, GAME_WIDTH - 80, 30, 0xa1887f);

    // Stove with colorful pots
    this.add.rectangle(180, H - 170, 110, 45, 0x616161).setStrokeStyle(2, 0x424242);
    this.add.circle(155, H - 170, 14, 0x424242);
    this.add.circle(205, H - 170, 14, 0x424242);
    // Pot
    this.add.rectangle(180, H - 200, 45, 22, 0xff7043).setStrokeStyle(1, 0xe64a19);
    // Steam
    for (let i = 0; i < 3; i++) {
      const steam = this.add.text(170 + i * 10, H - 225, '~', { fontSize: '12px', color: '#ffffff88' });
      this.tweens.add({ targets: steam, y: steam.y - 15, alpha: 0, duration: 1500, repeat: -1, delay: i * 300 });
    }

    // Colorful fridge
    this.add.rectangle(660, H - 200, 80, 150, 0x90caf9).setStrokeStyle(2, 0x64b5f6);
    this.add.rectangle(658, H - 200, 4, 10, 0x42a5f5);
    // Fridge magnets
    this.add.text(640, H - 250, '🍕', { fontSize: '12px' });
    this.add.text(665, H - 240, '❤️', { fontSize: '10px' });

    // Food bowl with carrot
    this.add.ellipse(400, H - 155, 55, 22, 0xff8a65).setStrokeStyle(2, 0xff7043);
    this.add.text(400, H - 160, '🥕🥬', { fontSize: '14px' }).setOrigin(0.5);

    // Cute window
    this.add.rectangle(GAME_WIDTH / 2, 70, 110, 80, 0x87ceeb).setStrokeStyle(5, 0xa1887f);
    this.add.text(GAME_WIDTH / 2, 60, '🌤️', { fontSize: '24px' }).setOrigin(0.5);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playEating();
      this.time.delayedCall(3000, () => b.startIdleBounce());
    });
  }
}

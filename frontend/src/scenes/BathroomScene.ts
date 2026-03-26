import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class BathroomScene extends RoomScene {
  constructor() { super({ key: 'BathroomScene' }); }
  getRoomName() { return '🛁 Bathroom'; }

  drawRoom() {
    // Wall - soft aqua
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0xe0f7fa);
    // Tiles
    for (let y = 0; y < H - 80; y += 35) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 1, 0xb2ebf2, 0.5);
    }

    // Floor - blue tiles
    this.add.rectangle(GAME_WIDTH / 2, H - 40, GAME_WIDTH, 80, 0xb3e5fc);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      this.add.rectangle(x, H - 80, 1, 80, 0x81d4fa, 0.3);
    }

    // Big bathtub
    this.add.ellipse(GAME_WIDTH / 2, H - 160, 220, 75, 0xffffff).setStrokeStyle(3, 0xb0bec5);
    // Bubbly water
    this.add.ellipse(GAME_WIDTH / 2, H - 155, 200, 55, 0x81d4fa, 0.5);
    // Rainbow bubbles
    const bubbleColors = [0xff80ab, 0x80d8ff, 0xb9f6ca, 0xfff59d, 0xce93d8];
    for (let i = 0; i < 12; i++) {
      const bx = GAME_WIDTH / 2 + Phaser.Math.Between(-80, 80);
      const by = H - 180 + Phaser.Math.Between(-15, 15);
      const bc = this.add.circle(bx, by, Phaser.Math.Between(4, 12), Phaser.Utils.Array.GetRandom(bubbleColors), 0.5);
      this.tweens.add({ targets: bc, y: bc.y - 10, alpha: 0.2, duration: 2000, yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500) });
    }

    // Faucet
    this.add.rectangle(GAME_WIDTH / 2, H - 210, 10, 35, 0xbdbdbd);
    this.add.circle(GAME_WIDTH / 2, H - 230, 9, 0xe0e0e0);

    // Mirror with glow
    this.add.ellipse(600, 110, 65, 85, 0xe8f5e9).setStrokeStyle(4, 0xffd54f);
    this.add.ellipse(600, 110, 55, 75, 0xf1f8e9, 0.3);

    // Towel rack
    this.add.rectangle(130, 170, 50, 5, 0xa1887f);
    this.add.rectangle(130, 200, 42, 55, 0xff8a80);

    // Rubber duck
    this.add.text(GAME_WIDTH / 2 + 60, H - 185, '🦆', { fontSize: '20px' });

    // Sparkle effects
    for (let i = 0; i < 4; i++) {
      const sp = this.add.text(Phaser.Math.Between(100, 700), Phaser.Math.Between(50, 250), '💧', { fontSize: '10px' }).setAlpha(0.3);
      this.tweens.add({ targets: sp, alpha: 0.1, duration: 1500, yoyo: true, repeat: -1, delay: i * 400 });
    }
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class GardenScene extends RoomScene {
  constructor() { super({ key: 'GardenScene' }); }
  getRoomName() { return '🌿 Garden'; }

  drawRoom() {
    // Sky gradient
    this.add.rectangle(GAME_WIDTH / 2, 100, GAME_WIDTH, 200, 0x87ceeb);
    this.add.rectangle(GAME_WIDTH / 2, 30, GAME_WIDTH, 60, 0xb3e5fc, 0.6);

    // Fluffy clouds
    for (const cx of [140, 420, 650]) {
      const cy = Phaser.Math.Between(40, 100);
      this.add.ellipse(cx, cy, 90, 30, 0xffffff, 0.85);
      this.add.ellipse(cx + 25, cy - 8, 60, 25, 0xffffff, 0.85);
      this.add.ellipse(cx - 20, cy - 5, 50, 22, 0xffffff, 0.8);
    }

    // Sun with rays
    this.add.circle(720, 55, 38, 0xffd54f);
    this.add.circle(720, 55, 32, 0xffee58);
    for (let a = 0; a < 360; a += 45) {
      const rad = a * Math.PI / 180;
      const rx = 720 + Math.cos(rad) * 50;
      const ry = 55 + Math.sin(rad) * 50;
      this.add.circle(rx, ry, 4, 0xffd54f, 0.4);
    }

    // Lush grass with gradient
    this.add.rectangle(GAME_WIDTH / 2, H - 80, GAME_WIDTH, 200, 0x66bb6a);
    this.add.rectangle(GAME_WIDTH / 2, H - 160, GAME_WIDTH, 40, 0x81c784, 0.6);
    // Grass blades
    for (let i = 0; i < 40; i++) {
      const gx = Phaser.Math.Between(0, GAME_WIDTH);
      const gy = Phaser.Math.Between(H - 170, H);
      this.add.rectangle(gx, gy, 3, 14, 0x4caf50, 0.4);
    }

    // Cute fence
    for (let x = 0; x < GAME_WIDTH; x += 45) {
      this.add.rectangle(x, H - 190, 10, 45, 0xffcc80).setStrokeStyle(1, 0xffb74d);
      // Fence top decoration
      this.add.circle(x, H - 215, 6, 0xffcc80).setStrokeStyle(1, 0xffb74d);
    }
    this.add.rectangle(GAME_WIDTH / 2, H - 200, GAME_WIDTH, 6, 0xffcc80);
    this.add.rectangle(GAME_WIDTH / 2, H - 178, GAME_WIDTH, 6, 0xffcc80);

    // Colorful flowers
    const flowerColors = [0xff6b6b, 0xffd93d, 0xce93d8, 0xff8a65, 0x81c784, 0x4fc3f7, 0xf48fb1];
    for (let i = 0; i < 18; i++) {
      const fx = Phaser.Math.Between(40, GAME_WIDTH - 40);
      const fy = Phaser.Math.Between(H - 140, H - 20);
      this.add.rectangle(fx, fy + 10, 2, 18, 0x388e3c);
      const fc = Phaser.Utils.Array.GetRandom(flowerColors);
      // Flower petals
      for (let p = 0; p < 5; p++) {
        const pa = (p * 72) * Math.PI / 180;
        this.add.circle(fx + Math.cos(pa) * 4, fy + Math.sin(pa) * 4, 4, fc, 0.9);
      }
      this.add.circle(fx, fy, 3, 0xffee58);
    }

    // Tree
    this.add.rectangle(90, H - 250, 22, 120, 0x8d6e63);
    this.add.circle(90, H - 330, 50, 0x4caf50);
    this.add.circle(65, H - 310, 35, 0x66bb6a);
    this.add.circle(115, H - 310, 35, 0x66bb6a);
    // Apples
    this.add.circle(75, H - 320, 5, 0xff5252);
    this.add.circle(108, H - 340, 5, 0xff5252);

    // Butterfly
    const bf = this.add.text(300, 120, '🦋', { fontSize: '18px' });
    this.tweens.add({ targets: bf, x: 500, y: 80, duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Ball
    this.add.circle(500, H - 90, 18, 0xff5252).setStrokeStyle(2, 0xd32f2f);
    this.add.arc(500, H - 90, 18, 200, 340, false, 0xff8a80);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playPlaying();
      this.time.delayedCall(3000, () => b.startIdleBounce());
    });
  }
}

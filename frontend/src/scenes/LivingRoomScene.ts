import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480; // play area height

export class LivingRoomScene extends RoomScene {
  constructor() { super({ key: 'LivingRoomScene' }); }
  getRoomName() { return '🏠 Living Room'; }

  drawRoom() {
    // Gradient wall - warm peach/coral
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0xffe8d6);
    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0xffd1b3, 0.5);

    // Floor - warm wood with highlights
    this.add.rectangle(GAME_WIDTH / 2, H - 40, GAME_WIDTH, 80, 0xdeb887);
    this.add.rectangle(GAME_WIDTH / 2, H - 80, GAME_WIDTH, 4, 0xc4956a);
    // Floor shine
    for (let x = 50; x < GAME_WIDTH; x += 120) {
      this.add.rectangle(x, H - 40, 80, 2, 0xf0d4a8, 0.3);
    }

    // Big window with curtains
    this.add.rectangle(200, 130, 140, 120, 0x87ceeb).setStrokeStyle(6, 0xc4956a);
    this.add.rectangle(200, 130, 2, 120, 0xc4956a);
    this.add.rectangle(200, 130, 140, 2, 0xc4956a);
    // Sunshine through window
    this.add.rectangle(200, 130, 130, 110, 0xffd700, 0.08);
    // Curtains
    this.add.rectangle(125, 130, 16, 130, 0xff8fa0, 0.8);
    this.add.rectangle(275, 130, 16, 130, 0xff8fa0, 0.8);

    // Cozy couch - modern rounded
    this.add.rectangle(550, H - 130, 200, 65, 0xe07b6a).setStrokeStyle(2, 0xc45a4a);
    this.add.rectangle(550, H - 168, 200, 14, 0xd06a5a);
    // Colorful cushions
    this.add.ellipse(510, H - 135, 50, 38, 0xffd166, 0.9);
    this.add.ellipse(590, H - 135, 50, 38, 0x7ec8e3, 0.9);

    // Colorful rug
    this.add.ellipse(GAME_WIDTH / 2, H - 50, 300, 50, 0xff6b9d, 0.25);
    this.add.ellipse(GAME_WIDTH / 2, H - 50, 240, 38, 0xffd166, 0.2);
    this.add.ellipse(GAME_WIDTH / 2, H - 50, 180, 26, 0x7ec8e3, 0.2);

    // Cute lamp
    this.add.rectangle(700, 100, 6, 90, 0xdddddd);
    this.add.triangle(700, 48, 678, 78, 722, 78, 700, 38, 0xffd700, 0.85);
    // Lamp glow
    this.add.circle(700, 80, 30, 0xffd700, 0.06);

    // Picture frames with colorful art
    this.add.rectangle(400, 110, 55, 42, 0x87ceeb).setStrokeStyle(4, 0xddaa66);
    this.add.text(400, 110, '🐰', { fontSize: '20px' }).setOrigin(0.5);
    this.add.rectangle(480, 100, 40, 35, 0xffb6c1).setStrokeStyle(3, 0xddaa66);
    this.add.text(480, 100, '🌸', { fontSize: '16px' }).setOrigin(0.5);

    // Floating hearts/sparkles
    for (let i = 0; i < 5; i++) {
      const sp = this.add.text(
        Phaser.Math.Between(50, GAME_WIDTH - 50),
        Phaser.Math.Between(20, 200),
        '✨', { fontSize: `${Phaser.Math.Between(8, 14)}px` }
      ).setAlpha(0.3);
      this.tweens.add({ targets: sp, alpha: 0.1, y: sp.y - 10, duration: 2000, yoyo: true, repeat: -1 });
    }
  }
}

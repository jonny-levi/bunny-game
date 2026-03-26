import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class NestScene extends RoomScene {
  constructor() { super({ key: 'NestScene' }); }
  getRoomName() { return '💕 Cozy Nest'; }

  drawRoom() {
    // Wall - warm pink
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0xfce4ec);
    // Gradient overlay
    this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0xf8bbd0, 0.3);

    // Floor - warm wood
    this.add.rectangle(GAME_WIDTH / 2, H - 40, GAME_WIDTH, 80, 0xdeb887);

    // Floating hearts
    for (let i = 0; i < 12; i++) {
      const h = this.add.text(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(20, 260),
        Phaser.Math.Between(0, 1) ? '💕' : '💗',
        { fontSize: `${Phaser.Math.Between(10, 22)}px` }
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.35));
      this.tweens.add({ targets: h, y: h.y - 15, alpha: h.alpha * 0.5, duration: 3000, yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
    }

    // Big cozy nest
    this.add.ellipse(GAME_WIDTH / 2, H - 130, 240, 85, 0xd7b377).setStrokeStyle(3, 0xc49a5a);
    this.add.ellipse(GAME_WIDTH / 2, H - 140, 220, 65, 0xe8cc8a);
    // Straw texture
    for (let i = 0; i < 20; i++) {
      const sx = GAME_WIDTH / 2 + Phaser.Math.Between(-100, 100);
      const sy = H - 130 + Phaser.Math.Between(-28, 28);
      this.add.rectangle(sx, sy, Phaser.Math.Between(12, 22), 2, 0xccaa66, 0.5).setAngle(Phaser.Math.Between(-35, 35));
    }

    // Feathers in nest
    for (let i = 0; i < 5; i++) {
      this.add.text(
        GAME_WIDTH / 2 + Phaser.Math.Between(-80, 80),
        H - 135 + Phaser.Math.Between(-15, 15),
        '🪶', { fontSize: '10px' }
      ).setAlpha(0.4);
    }

    // Candles with glow
    for (const cx of [130, 670]) {
      this.add.rectangle(cx, H - 170, 12, 35, 0xfff3e0);
      this.add.circle(cx, H - 192, 6, 0xffab40);
      this.add.circle(cx, H - 192, 4, 0xffd54f);
      this.add.circle(cx, H - 192, 18, 0xffab40, 0.06); // glow
    }

    // Warm overlay
    this.add.rectangle(GAME_WIDTH / 2, H / 2, GAME_WIDTH, H, 0xff6600, 0.04);

    // Sparkles
    for (let i = 0; i < 6; i++) {
      const sp = this.add.text(Phaser.Math.Between(80, GAME_WIDTH - 80), Phaser.Math.Between(40, 250), '✨', { fontSize: '12px' }).setAlpha(0.25);
      this.tweens.add({ targets: sp, alpha: 0.08, duration: 1800, yoyo: true, repeat: -1, delay: i * 300 });
    }
  }
}

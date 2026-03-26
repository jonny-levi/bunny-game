import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class NestScene extends RoomScene {
  constructor() { super({ key: 'NestScene' }); }
  getRoomName() { return '💕 Cozy Nest'; }

  drawRoom() {
    // Floor (warm wood)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xc9956b);
    // Wall (warm pink)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0xffe4e1);

    // Hearts on wall
    for (let i = 0; i < 8; i++) {
      this.add.text(
        Phaser.Math.Between(50, GAME_WIDTH - 50),
        Phaser.Math.Between(30, 250),
        '💕', { fontSize: `${Phaser.Math.Between(10, 20)}px` }
      ).setAlpha(0.3);
    }

    // Nest (big straw circle)
    this.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT - 200, 220, 80, 0xddbb77).setStrokeStyle(3, 0xbb9944);
    this.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT - 210, 200, 60, 0xeeccaa);
    // Straw texture
    for (let i = 0; i < 15; i++) {
      const sx = GAME_WIDTH / 2 + Phaser.Math.Between(-90, 90);
      const sy = GAME_HEIGHT - 200 + Phaser.Math.Between(-25, 25);
      this.add.rectangle(sx, sy, Phaser.Math.Between(10, 20), 2, 0xccaa66, 0.5).setAngle(Phaser.Math.Between(-30, 30));
    }

    // Candles
    this.add.rectangle(150, GAME_HEIGHT - 250, 10, 30, 0xffeedd);
    this.add.circle(150, GAME_HEIGHT - 268, 5, 0xffaa00);
    this.add.circle(150, GAME_HEIGHT - 268, 3, 0xffdd44);

    this.add.rectangle(650, GAME_HEIGHT - 250, 10, 30, 0xffeedd);
    this.add.circle(650, GAME_HEIGHT - 268, 5, 0xffaa00);
    this.add.circle(650, GAME_HEIGHT - 268, 3, 0xffdd44);

    // Warm overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff6600, 0.05);
  }
}

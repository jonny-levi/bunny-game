import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class BathroomScene extends RoomScene {
  constructor() { super({ key: 'BathroomScene' }); }
  getRoomName() { return '🛁 Bathroom'; }

  drawRoom() {
    // Floor (blue tiles)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xa8d8ea);
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0xd4f0ff);

    // Tile lines
    for (let y = 0; y < 360; y += 40) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 1, 0xbbddee, 0.4);
    }

    // Bathtub
    this.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT - 230, 200, 70, 0xffffff).setStrokeStyle(3, 0xbbbbbb);
    // Water
    this.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT - 225, 180, 50, 0x87ceeb, 0.6);
    // Bubbles
    for (let i = 0; i < 8; i++) {
      const bx = GAME_WIDTH / 2 + Phaser.Math.Between(-70, 70);
      const by = GAME_HEIGHT - 250 + Phaser.Math.Between(-10, 10);
      this.add.circle(bx, by, Phaser.Math.Between(4, 10), 0xffffff, 0.6);
    }

    // Faucet
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 280, 8, 30, 0xcccccc);
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT - 295, 8, 0xdddddd);

    // Mirror
    this.add.ellipse(600, 130, 60, 80, 0xeeffff).setStrokeStyle(3, 0xddcc88);

    // Towel
    this.add.rectangle(150, 200, 40, 60, 0xff9999);
    this.add.rectangle(150, 168, 50, 4, 0x8b6c4a);

    // Rubber duck
    this.add.text(GAME_WIDTH / 2 + 50, GAME_HEIGHT - 255, '🦆', { fontSize: '18px' });
  }
}

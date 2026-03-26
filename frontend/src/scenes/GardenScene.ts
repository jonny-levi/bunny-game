import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class GardenScene extends RoomScene {
  constructor() { super({ key: 'GardenScene' }); }
  getRoomName() { return '🎾 Garden'; }

  drawRoom() {
    // Sky
    this.add.rectangle(GAME_WIDTH / 2, 150, GAME_WIDTH, 300, 0x87ceeb);
    // Clouds
    this.add.ellipse(150, 80, 80, 30, 0xffffff, 0.8);
    this.add.ellipse(180, 75, 60, 25, 0xffffff, 0.8);
    this.add.ellipse(550, 100, 100, 35, 0xffffff, 0.7);

    // Sun
    this.add.circle(700, 60, 35, 0xffd700);
    this.add.circle(700, 60, 30, 0xffee44);

    // Grass
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 100, GAME_WIDTH, 260, 0x7ec850);
    // Grass texture
    for (let i = 0; i < 30; i++) {
      const gx = Phaser.Math.Between(0, GAME_WIDTH);
      const gy = Phaser.Math.Between(GAME_HEIGHT - 200, GAME_HEIGHT);
      this.add.rectangle(gx, gy, 3, 12, 0x5ba03a, 0.4);
    }

    // Fence
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      this.add.rectangle(x, GAME_HEIGHT - 230, 8, 40, 0xc9956b).setStrokeStyle(1, 0x8b6c4a);
    }
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 245, GAME_WIDTH, 6, 0xc9956b);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 220, GAME_WIDTH, 6, 0xc9956b);

    // Flowers
    const flowerColors = [0xff6b6b, 0xffd93d, 0xce93d8, 0xff8a65, 0x81c784];
    for (let i = 0; i < 12; i++) {
      const fx = Phaser.Math.Between(50, GAME_WIDTH - 50);
      const fy = Phaser.Math.Between(GAME_HEIGHT - 170, GAME_HEIGHT - 50);
      this.add.rectangle(fx, fy + 8, 2, 16, 0x3a7a20);
      this.add.circle(fx, fy, 6, Phaser.Utils.Array.GetRandom(flowerColors));
      this.add.circle(fx, fy, 2, 0xffffff);
    }

    // Tree
    this.add.rectangle(100, GAME_HEIGHT - 300, 20, 100, 0x8b6c4a);
    this.add.circle(100, GAME_HEIGHT - 370, 45, 0x4a8a30);
    this.add.circle(80, GAME_HEIGHT - 350, 30, 0x5ba03a);
    this.add.circle(120, GAME_HEIGHT - 350, 30, 0x5ba03a);

    // Ball
    this.add.circle(500, GAME_HEIGHT - 110, 15, 0xff4444).setStrokeStyle(1, 0xcc0000);
    this.add.arc(500, GAME_HEIGHT - 110, 15, 0, 180, false, 0xff6666);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playPlaying();
      this.time.delayedCall(3000, () => b.startIdleBounce());
    });
  }
}

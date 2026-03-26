import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class BedroomScene extends RoomScene {
  constructor() { super({ key: 'BedroomScene' }); }
  getRoomName() { return '💤 Bedroom'; }

  drawRoom() {
    // Floor
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xc9b89b);
    // Wall (darker for sleep)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0x2d2b4e);

    // Stars on wall
    for (let i = 0; i < 20; i++) {
      this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, 300),
        2, 0xffd700, 0.4
      );
    }

    // Moon
    this.add.circle(650, 80, 30, 0xffeebb);
    this.add.circle(640, 75, 25, 0x2d2b4e); // crescent cutout

    // Bed
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 210, 250, 20, 0x8b6c4a); // frame
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 240, 250, 40, 0xffcccc); // mattress
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 240, 246, 36, 0xeeb8b8); // sheet
    // Pillow
    this.add.ellipse(GAME_WIDTH / 2 - 80, GAME_HEIGHT - 250, 50, 25, 0xffffff);
    this.add.ellipse(GAME_WIDTH / 2 + 80, GAME_HEIGHT - 250, 50, 25, 0xffffff);
    // Blanket
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 225, 240, 20, 0xce93d8, 0.8);

    // Nightstand
    this.add.rectangle(160, GAME_HEIGHT - 230, 40, 50, 0x8b6c4a);
    // Lamp on nightstand
    this.add.rectangle(160, GAME_HEIGHT - 265, 5, 20, 0xdddddd);
    this.add.ellipse(160, GAME_HEIGHT - 280, 25, 15, 0xffd700, 0.6);

    // Dim overlay for sleepiness
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000033, 0.25);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playSleeping();
      this.time.delayedCall(5000, () => b.startIdleBounce());
    });
  }
}

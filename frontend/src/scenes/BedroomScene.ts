import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class BedroomScene extends RoomScene {
  constructor() { super({ key: 'BedroomScene' }); }
  getRoomName() { return '🌙 Bedroom'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-bedroom').setDisplaySize(GAME_WIDTH, H);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playSleeping();
      this.time.delayedCall(5000, () => b.startIdleBounce());
    });
  }
}

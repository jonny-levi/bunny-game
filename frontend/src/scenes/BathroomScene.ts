import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';

const H = 480;

export class BathroomScene extends RoomScene {
  constructor() { super({ key: 'BathroomScene' }); }
  getRoomName() { return '🛁 Bathroom'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-bathroom').setDisplaySize(GAME_WIDTH, H);
  }


  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playBathing();
      if (!prefersReducedMotion()) this.playRoomActionFlair('clean', b);
      this.time.delayedCall(prefersReducedMotion() ? 300 : 2200, () => b.startIdleBounce());
    });
  }
}

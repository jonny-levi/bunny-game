import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';

const H = 480;

export class KitchenScene extends RoomScene {
  constructor() { super({ key: 'KitchenScene' }); }
  getRoomName() { return '🍳 Kitchen'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-kitchen').setDisplaySize(GAME_WIDTH, H);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playEating();
      if (!prefersReducedMotion()) this.playRoomActionFlair('feed', b);
      this.time.delayedCall(prefersReducedMotion() ? 300 : 3000, () => b.startIdleBounce());
    });
  }
}

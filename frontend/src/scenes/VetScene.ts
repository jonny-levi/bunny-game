import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';

const H = 480;

export class VetScene extends RoomScene {
  constructor() { super({ key: 'VetScene' }); }
  getRoomName() { return '💊 Vet Office'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-vet').setDisplaySize(GAME_WIDTH, H);
  }


  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playMedicine();
      if (!prefersReducedMotion()) this.playRoomActionFlair('medicine', b);
      this.time.delayedCall(prefersReducedMotion() ? 300 : 2200, () => b.startIdleBounce());
    });
  }
}

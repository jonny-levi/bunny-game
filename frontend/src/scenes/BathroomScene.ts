import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';


export class BathroomScene extends RoomScene {
  constructor() { super({ key: 'BathroomScene' }); }
  getRoomName() { return '🛁 Bathroom'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-bathroom').setDisplaySize(layout.width, H);
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

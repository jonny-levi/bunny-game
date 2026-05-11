import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';


export class KitchenScene extends RoomScene {
  constructor() { super({ key: 'KitchenScene' }); }
  getRoomName() { return '🍳 Kitchen'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-kitchen').setDisplaySize(layout.width, H);
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

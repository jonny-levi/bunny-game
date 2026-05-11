import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';


export class BedroomScene extends RoomScene {
  constructor() { super({ key: 'BedroomScene' }); }
  getRoomName() { return '🌙 Bedroom'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-bedroom').setDisplaySize(layout.width, H);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playSleeping();
      this.time.delayedCall(prefersReducedMotion() ? 300 : 5000, () => b.startIdleBounce());
    });
  }
}

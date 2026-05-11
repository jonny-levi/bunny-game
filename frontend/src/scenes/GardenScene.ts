import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';


export class GardenScene extends RoomScene {
  constructor() { super({ key: 'GardenScene' }); }
  getRoomName() { return '🌿 Garden'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-garden').setDisplaySize(layout.width, H);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playPlaying();
      if (!prefersReducedMotion()) this.playRoomActionFlair('play', b);
      this.time.delayedCall(prefersReducedMotion() ? 300 : 3000, () => b.startIdleBounce());
    });
  }
}

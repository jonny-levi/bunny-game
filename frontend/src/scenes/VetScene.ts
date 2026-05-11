import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { prefersReducedMotion } from '../utils/accessibility';


export class VetScene extends RoomScene {
  constructor() { super({ key: 'VetScene' }); }
  getRoomName() { return '💊 Vet Office'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-vet').setDisplaySize(layout.width, H);
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

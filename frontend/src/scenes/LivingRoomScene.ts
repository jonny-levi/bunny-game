import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';
import { motionDuration, prefersReducedMotion } from '../utils/accessibility';


export class LivingRoomScene extends RoomScene {
  private enterWithCurtainWipe = false;

  constructor() { super({ key: 'LivingRoomScene' }); }

  init(data: { curtainWipe?: boolean } = {}) {
    this.enterWithCurtainWipe = data.curtainWipe === true;
  }
  getRoomName() { return '🏠 Living Room'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-living').setDisplaySize(layout.width, H);
    if (this.enterWithCurtainWipe && !prefersReducedMotion()) this.playCurtainOpen();
  }

  private playCurtainOpen() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    const curtain = this.add.rectangle(layout.width / 2, H / 2, layout.width, H, 0xff7eaa, 1).setDepth(100);
    const glint = this.add.rectangle(12, H / 2, 22, H, 0xffb3cc, 0.75).setDepth(101);
    this.tweens.add({
      targets: [curtain, glint],
      x: layout.width + layout.width / 2,
      duration: motionDuration(420),
      ease: 'Sine.easeInOut',
      onComplete: () => curtain.destroy(),
    });
  }

}

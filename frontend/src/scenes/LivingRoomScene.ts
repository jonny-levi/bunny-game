import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';
import { motionDuration, prefersReducedMotion } from '../utils/accessibility';

const H = 480; // play area height

export class LivingRoomScene extends RoomScene {
  private enterWithCurtainWipe = false;

  constructor() { super({ key: 'LivingRoomScene' }); }

  init(data: { curtainWipe?: boolean } = {}) {
    this.enterWithCurtainWipe = data.curtainWipe === true;
  }
  getRoomName() { return '🏠 Living Room'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-living').setDisplaySize(GAME_WIDTH, H);
    if (this.enterWithCurtainWipe && !prefersReducedMotion()) this.playCurtainOpen();
  }

  private playCurtainOpen() {
    const curtain = this.add.rectangle(GAME_WIDTH / 2, H / 2, GAME_WIDTH, H, 0xff7eaa, 1).setDepth(100);
    const glint = this.add.rectangle(12, H / 2, 22, H, 0xffb3cc, 0.75).setDepth(101);
    this.tweens.add({
      targets: [curtain, glint],
      x: GAME_WIDTH + GAME_WIDTH / 2,
      duration: motionDuration(420),
      ease: 'Sine.easeInOut',
      onComplete: () => curtain.destroy(),
    });
  }

}

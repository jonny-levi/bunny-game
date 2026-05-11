import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class GardenScene extends RoomScene {
  constructor() { super({ key: 'GardenScene' }); }
  getRoomName() { return '🌿 Garden'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-garden').setDisplaySize(GAME_WIDTH, H);
  }

  create() {
    super.create();
    this.bunnyObjects.forEach(b => {
      b.playPlaying();
      this.playRoomActionFlair('play', b);
      this.time.delayedCall(3000, () => b.startIdleBounce());
    });
  }
}

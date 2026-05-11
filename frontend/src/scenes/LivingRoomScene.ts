import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480; // play area height

export class LivingRoomScene extends RoomScene {
  constructor() { super({ key: 'LivingRoomScene' }); }
  getRoomName() { return '🏠 Living Room'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-living').setDisplaySize(GAME_WIDTH, H);
  }

}

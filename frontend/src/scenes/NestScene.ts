import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class NestScene extends RoomScene {
  constructor() { super({ key: 'NestScene' }); }
  getRoomName() { return '💕 Cozy Nest'; }

  drawRoom() {
    this.add.image(GAME_WIDTH / 2, H / 2, 'room-nest').setDisplaySize(GAME_WIDTH, H);
  }

}

import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { RoomScene } from './RoomScene';


export class NestScene extends RoomScene {
  constructor() { super({ key: 'NestScene' }); }
  getRoomName() { return '💕 Cozy Nest'; }

  drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.image(layout.width / 2, H / 2, 'room-nest').setDisplaySize(layout.width, H);
  }

}

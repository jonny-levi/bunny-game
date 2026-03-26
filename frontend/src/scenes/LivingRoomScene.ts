import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { RoomScene } from './RoomScene';

export class LivingRoomScene extends RoomScene {
  constructor() { super({ key: 'LivingRoomScene' }); }
  getRoomName() { return '🏠 Living Room'; }

  drawRoom() {
    // Floor
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xc9956b);
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0xfff0d4);
    // Baseboard
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 180, GAME_WIDTH, 8, 0x8b6c4a);

    // Window
    this.add.rectangle(200, 150, 120, 100, 0x87ceeb).setStrokeStyle(6, 0x8b6c4a);
    this.add.rectangle(200, 150, 2, 100, 0x8b6c4a);
    this.add.rectangle(200, 150, 120, 2, 0x8b6c4a);
    // Curtains
    this.add.rectangle(135, 150, 12, 110, 0xff8888, 0.7);
    this.add.rectangle(265, 150, 12, 110, 0xff8888, 0.7);

    // Couch
    this.add.rectangle(550, GAME_HEIGHT - 220, 180, 60, 0xd47b6a).setStrokeStyle(2, 0x8b4545);
    this.add.rectangle(550, GAME_HEIGHT - 255, 180, 12, 0xc06b5a).setStrokeStyle(1, 0x8b4545);
    // Cushions
    this.add.ellipse(510, GAME_HEIGHT - 220, 50, 40, 0xe08b7a);
    this.add.ellipse(590, GAME_HEIGHT - 220, 50, 40, 0xe08b7a);

    // Rug
    this.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT - 130, 280, 60, 0xcc7766, 0.5);

    // Lamp
    this.add.rectangle(700, 120, 6, 100, 0xdddddd);
    this.add.triangle(700, 60, 680, 90, 720, 90, 700, 50, 0xffd700);

    // Picture frame
    this.add.rectangle(400, 130, 60, 45, 0x87ceeb).setStrokeStyle(4, 0x8b6c4a);
    this.add.text(400, 130, '🐰', { fontSize: '18px' }).setOrigin(0.5);
  }
}

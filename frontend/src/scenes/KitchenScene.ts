import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class KitchenScene extends RoomScene {
  constructor() { super({ key: 'KitchenScene' }); }
  getRoomName() { return '🍳 Kitchen'; }

  drawRoom() {
    // Floor (tiles)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xddc9a3);
    for (let x = 0; x < GAME_WIDTH; x += 50) {
      this.add.rectangle(x, GAME_HEIGHT - 180, 1, 200, 0xccb993, 0.3);
    }
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0xffe4c9);

    // Counter
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 220, GAME_WIDTH - 100, 30, 0x8b6c4a).setStrokeStyle(1, 0x5a3a1a);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 200, GAME_WIDTH - 100, 40, 0xc9956b);

    // Stove
    this.add.rectangle(200, GAME_HEIGHT - 260, 100, 50, 0x555555).setStrokeStyle(2, 0x333333);
    this.add.circle(180, GAME_HEIGHT - 260, 12, 0x333333);
    this.add.circle(220, GAME_HEIGHT - 260, 12, 0x333333);
    // Pot
    this.add.rectangle(200, GAME_HEIGHT - 290, 40, 20, 0x888888).setStrokeStyle(1, 0x555555);

    // Fridge
    this.add.rectangle(650, GAME_HEIGHT - 290, 70, 140, 0xdddddd).setStrokeStyle(2, 0xbbbbbb);
    this.add.rectangle(648, GAME_HEIGHT - 290, 3, 8, 0x999999);

    // Food bowl
    this.add.ellipse(400, GAME_HEIGHT - 240, 50, 20, 0xff8866).setStrokeStyle(1, 0xcc5533);
    this.add.text(400, GAME_HEIGHT - 240, '🥕', { fontSize: '14px' }).setOrigin(0.5);

    // Window
    this.add.rectangle(GAME_WIDTH / 2, 120, 100, 80, 0x87ceeb).setStrokeStyle(4, 0x8b6c4a);
  }

  create() {
    super.create();
    // Animate selected bunny eating
    const bunny = this.bunnyObjects.find(b => b.bunnyId === (this.registry.get('selectedAction') === 'feed' ? b.bunnyId : ''));
    this.bunnyObjects.forEach(b => {
      b.playEating();
      this.time.delayedCall(3000, () => b.startIdleBounce());
    });
  }
}

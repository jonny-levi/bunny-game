import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { RoomScene } from './RoomScene';

export class VetScene extends RoomScene {
  constructor() { super({ key: 'VetScene' }); }
  getRoomName() { return '💊 Vet Office'; }

  drawRoom() {
    // Floor
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 200, 0xdddddd);
    // Wall
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, GAME_WIDTH, 360, 0xeeffee);

    // Exam table
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 230, 180, 15, 0xbbbbbb).setStrokeStyle(2, 0x888888);
    this.add.rectangle(GAME_WIDTH / 2 - 70, GAME_HEIGHT - 195, 8, 50, 0x888888);
    this.add.rectangle(GAME_WIDTH / 2 + 70, GAME_HEIGHT - 195, 8, 50, 0x888888);

    // Medical cross
    this.add.rectangle(150, 120, 20, 50, 0xff4444);
    this.add.rectangle(150, 120, 50, 20, 0xff4444);

    // Cabinet
    this.add.rectangle(600, 150, 100, 120, 0xeeeeee).setStrokeStyle(2, 0xcccccc);
    this.add.rectangle(580, 150, 1, 120, 0xcccccc);
    this.add.circle(570, 140, 3, 0x888888);
    this.add.circle(610, 140, 3, 0x888888);

    // Medicine bottles
    this.add.rectangle(580, 110, 15, 25, 0x4fc3f7).setStrokeStyle(1, 0x2196f3);
    this.add.rectangle(610, 115, 12, 20, 0x81c784).setStrokeStyle(1, 0x4caf50);

    // Stethoscope (simple)
    this.add.text(650, 250, '🩺', { fontSize: '24px' });

    // Certificate on wall
    this.add.rectangle(350, 120, 70, 50, 0xfffff0).setStrokeStyle(2, 0xddcc88);
    this.add.text(350, 120, 'Dr. Hop', {
      fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#333',
    }).setOrigin(0.5);
  }
}

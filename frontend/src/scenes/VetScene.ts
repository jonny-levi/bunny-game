import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { RoomScene } from './RoomScene';

const H = 480;

export class VetScene extends RoomScene {
  constructor() { super({ key: 'VetScene' }); }
  getRoomName() { return '💊 Vet Office'; }

  drawRoom() {
    // Wall - clean mint green
    this.add.rectangle(GAME_WIDTH / 2, H / 2 - 40, GAME_WIDTH, H - 80, 0xe8f5e9);

    // Floor - clean white tiles
    this.add.rectangle(GAME_WIDTH / 2, H - 40, GAME_WIDTH, 80, 0xf5f5f5);
    for (let x = 0; x < GAME_WIDTH; x += 50) {
      this.add.rectangle(x, H - 80, 1, 80, 0xe0e0e0, 0.4);
    }

    // Exam table
    this.add.rectangle(GAME_WIDTH / 2, H - 145, 200, 16, 0xb0bec5).setStrokeStyle(2, 0x90a4ae);
    this.add.rectangle(GAME_WIDTH / 2 - 80, H - 110, 8, 50, 0x90a4ae);
    this.add.rectangle(GAME_WIDTH / 2 + 80, H - 110, 8, 50, 0x90a4ae);

    // Medical cross
    this.add.circle(130, 110, 30, 0xef5350, 0.15);
    this.add.rectangle(130, 110, 18, 45, 0xef5350);
    this.add.rectangle(130, 110, 45, 18, 0xef5350);

    // Medicine cabinet
    this.add.rectangle(600, 130, 110, 130, 0xffffff).setStrokeStyle(2, 0xbdbdbd);
    this.add.rectangle(598, 130, 1, 130, 0xe0e0e0);
    this.add.circle(590, 120, 3, 0x90a4ae);
    this.add.circle(610, 120, 3, 0x90a4ae);
    // Colorful medicine bottles
    this.add.rectangle(575, 85, 16, 28, 0x42a5f5).setStrokeStyle(1, 0x1e88e5);
    this.add.rectangle(600, 90, 14, 22, 0x66bb6a).setStrokeStyle(1, 0x43a047);
    this.add.rectangle(625, 88, 12, 24, 0xef5350).setStrokeStyle(1, 0xe53935);
    this.add.rectangle(585, 150, 18, 20, 0xffd54f).setStrokeStyle(1, 0xffb300);
    this.add.rectangle(615, 148, 15, 22, 0xce93d8).setStrokeStyle(1, 0xab47bc);

    // Stethoscope
    this.add.text(660, 230, '🩺', { fontSize: '28px' });

    // Certificate
    this.add.rectangle(350, 100, 75, 55, 0xfffff0).setStrokeStyle(3, 0xffd54f);
    this.add.text(350, 95, 'Dr. Hop', { fontFamily: 'Nunito, Arial, sans-serif', fontSize: '9px', color: '#333', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(350, 108, '🏆', { fontSize: '12px' }).setOrigin(0.5);

    // Heart monitor (decorative)
    this.add.rectangle(250, 120, 60, 40, 0x263238).setStrokeStyle(1, 0x37474f);
    const line = this.add.text(250, 120, '♡', { fontSize: '14px', color: '#4caf50' }).setOrigin(0.5);
    this.tweens.add({ targets: line, scaleX: 1.3, scaleY: 1.3, duration: 500, yoyo: true, repeat: -1 });
  }
}

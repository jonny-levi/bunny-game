import Phaser from 'phaser';
import { playClick } from '../utils/sound';

export class ActionButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: number, onClick: () => void, width = 100, height = 44) {
    super(scene, x, y);

    this.bg = scene.add.rectangle(0, 0, width, height, color, 0.92)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setInteractive({ useHandCursor: true });
    this.add(this.bg);

    this.label = scene.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#00000044',
      strokeThickness: 1,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.label);

    this.bg.on('pointerover', () => {
      this.bg.setFillStyle(color, 1);
      this.setScale(1.08);
    });
    this.bg.on('pointerout', () => {
      this.bg.setFillStyle(color, 0.92);
      this.setScale(1);
    });
    this.bg.on('pointerdown', () => {
      playClick();
      this.setScale(0.94);
      onClick();
    });
    this.bg.on('pointerup', () => {
      this.setScale(1.08);
    });

    scene.add.existing(this);
  }
}

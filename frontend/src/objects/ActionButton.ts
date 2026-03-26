import Phaser from 'phaser';
import { playClick } from '../utils/sound';

export class ActionButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: number, onClick: () => void) {
    super(scene, x, y);

    this.bg = scene.add.rectangle(0, 0, 90, 30, color, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true });

    // Rounded look via multiple rects (simple approach)
    this.add(this.bg);

    this.label = scene.add.text(0, 0, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#fff4e0',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.label);

    this.bg.on('pointerover', () => {
      this.bg.setFillStyle(color, 1);
      this.setScale(1.05);
    });
    this.bg.on('pointerout', () => {
      this.bg.setFillStyle(color, 0.9);
      this.setScale(1);
    });
    this.bg.on('pointerdown', () => {
      playClick();
      this.setScale(0.95);
      onClick();
    });
    this.bg.on('pointerup', () => {
      this.setScale(1.05);
    });

    scene.add.existing(this);
  }
}

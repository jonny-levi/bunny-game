import Phaser from 'phaser';
import { playClick } from '../utils/sound';

export class ActionButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private cooldownText: Phaser.GameObjects.Text;
  private disabled = false;
  private baseColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: number, onClick: () => void, width = 100, height = 44) {
    super(scene, x, y);

    this.baseColor = color;
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

    this.cooldownText = scene.add.text(0, height / 2 - 10, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#00000088',
      strokeThickness: 2,
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.add(this.cooldownText);

    this.bg.on('pointerover', () => {
      if (this.disabled) return;
      this.bg.setFillStyle(this.baseColor, 1);
      this.setScale(1.08);
    });
    this.bg.on('pointerout', () => {
      if (this.disabled) return;
      this.bg.setFillStyle(this.baseColor, 0.92);
      this.setScale(1);
    });
    this.bg.on('pointerdown', () => {
      if (this.disabled) return;
      playClick();
      this.setScale(0.94);
      onClick();
    });
    this.bg.on('pointerup', () => {
      if (!this.disabled) this.setScale(1.08);
    });

    scene.add.existing(this);
  }

  setCooldown(remainingMs: number) {
    if (remainingMs > 0) {
      this.disabled = true;
      this.bg.disableInteractive();
      this.bg.setFillStyle(0x555566, 0.72);
      this.setScale(1);
      this.setAlpha(0.72);
      this.cooldownText.setText(`${Math.ceil(remainingMs / 1000)}s`);
      this.cooldownText.setVisible(true);
      return;
    }

    this.disabled = false;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.setFillStyle(this.baseColor, 0.92);
    this.setAlpha(1);
    this.cooldownText.setVisible(false);
  }
}

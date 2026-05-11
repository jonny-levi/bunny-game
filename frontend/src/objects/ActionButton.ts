import Phaser from 'phaser';
import { playClick } from '../utils/sound';
import { addIcon, type IconName } from '../ui/Icon';
import { cssPalette, palette, typography } from '../ui/tokens';
import { motionDuration } from '../utils/accessibility';

export class ActionButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private icon: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private cooldownText: Phaser.GameObjects.Text;
  private cooldownArc: Phaser.GameObjects.Graphics;
  private disabled = false;
  private baseColor: number;
  private lastRemaining = 0;
  private maxCooldown = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: number, iconName: IconName, onClick: () => void) {
    super(scene, x, y);

    this.baseColor = color;
    this.bg = scene.add.rectangle(0, 0, 58, 58, color, 0.96)
      .setStrokeStyle(3, palette.plumDeep, 0.72)
      .setInteractive({ useHandCursor: true });
    this.add(this.bg);

    this.icon = addIcon(scene, iconName, 0, -5, 28);
    this.add(this.icon);

    this.label = scene.add.text(0, 40, text, {
      fontFamily: typography.families.body,
      fontSize: '11px',
      color: '#201832',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.label);

    this.cooldownArc = scene.add.graphics();
    this.add(this.cooldownArc);

    this.cooldownText = scene.add.text(0, -5, '', {
      fontFamily: typography.families.display,
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#00000088',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.add(this.cooldownText);

    this.bg.on('pointerover', () => {
      if (this.disabled) return;
      this.bg.setFillStyle(this.baseColor, 1);
      this.scene.tweens.add({ targets: this, scale: 1.06, duration: motionDuration(110), ease: 'Back.easeOut' });
    });
    this.bg.on('pointerout', () => {
      if (this.disabled) return;
      this.bg.setFillStyle(this.baseColor, 0.96);
      this.scene.tweens.add({ targets: this, scale: 1, duration: motionDuration(110), ease: 'Sine.easeOut' });
    });
    this.bg.on('pointerdown', () => {
      if (this.disabled) return;
      playClick();
      this.scene.tweens.add({ targets: this, scale: 0.94, duration: motionDuration(70), yoyo: true, ease: 'Sine.easeOut' });
      onClick();
    });

    scene.add.existing(this);
  }

  setCooldown(remainingMs: number, totalMs = this.maxCooldown) {
    this.maxCooldown = Math.max(totalMs, remainingMs, 1);
    this.lastRemaining = remainingMs;
    this.cooldownArc.clear();

    if (remainingMs > 0) {
      this.disabled = true;
      this.bg.disableInteractive();
      this.bg.setFillStyle(0x6f637a, 0.78);
      this.setScale(1);
      this.setAlpha(0.82);
      this.cooldownText.setText(`${Math.ceil(remainingMs / 1000)}s`);
      this.cooldownText.setVisible(true);
      this.cooldownArc.lineStyle(4, palette.brandPink, 0.95);
      this.cooldownArc.beginPath();
      this.cooldownArc.arc(0, 0, 33, -Math.PI / 2, -Math.PI / 2 + (remainingMs / this.maxCooldown) * Math.PI * 2, false);
      this.cooldownArc.strokePath();
      return;
    }

    this.disabled = false;
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.setFillStyle(this.baseColor, 0.96);
    this.setAlpha(1);
    this.cooldownText.setVisible(false);
  }

  getCooldown() { return this.lastRemaining; }
}

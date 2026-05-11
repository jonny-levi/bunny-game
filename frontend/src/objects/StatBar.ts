import Phaser from 'phaser';
import { addIcon, type IconName } from '../ui/Icon';
import { cssPalette, palette, radii, typography } from '../ui/tokens';
import { motionDuration } from '../utils/accessibility';

export class StatBar extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private segments: Phaser.GameObjects.Rectangle[] = [];
  private alertDot: Phaser.GameObjects.Text;
  private value = 100;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    labelText: string,
    private readonly color: number,
    private readonly barWidth = 112,
    icon?: IconName,
  ) {
    super(scene, x, y);

    if (icon) {
      const iconImage = addIcon(scene, icon, 8, 0, 15).setAlpha(0.92);
      this.add(iconImage);
    }

    this.label = scene.add.text(22, -9, labelText, {
      fontFamily: typography.families.body,
      fontSize: '10px',
      color: '#201832',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add(this.label);

    const segmentWidth = (barWidth - 16) / 5;
    for (let i = 0; i < 5; i += 1) {
      const shadow = scene.add.rectangle(22 + i * (segmentWidth + 4), 7, segmentWidth, 9, palette.white, 0.42)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, palette.plumDeep, 0.08);
      this.add(shadow);

      const segment = scene.add.rectangle(22 + i * (segmentWidth + 4), 7, segmentWidth, 9, color, 0.95)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, palette.white, 0.5);
      segment.setData('radius', radii.xs);
      this.segments.push(segment);
      this.add(segment);
    }

    this.alertDot = scene.add.text(barWidth + 30, 1, '!', {
      fontFamily: typography.families.display,
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: cssPalette.danger,
      padding: { x: 4, y: 1 },
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.add(this.alertDot);

    scene.add.existing(this);
  }

  setValue(v: number) {
    this.value = Phaser.Math.Clamp(v, 0, 100);
    const filledSegments = Math.ceil(this.value / 20);
    this.segments.forEach((segment, index) => {
      const active = index < filledSegments && this.value > 0;
      segment.setFillStyle(this.value < 30 ? palette.danger : this.color, active ? 0.96 : 0.16);
      segment.setStrokeStyle(1, active ? palette.white : palette.plumDeep, active ? 0.55 : 0.15);
    });

    const danger = this.value < 30;
    this.alertDot.setVisible(danger);
    if (danger && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: [...this.segments, this.alertDot],
        alpha: { from: 0.55, to: 1 },
        duration: motionDuration(420),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!danger && this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = undefined;
      this.segments.forEach(segment => segment.setAlpha(1));
      this.alertDot.setAlpha(1);
    }
  }

  getValue() { return this.value; }
}

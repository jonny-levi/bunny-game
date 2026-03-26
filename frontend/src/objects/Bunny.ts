import Phaser from 'phaser';
import { BUNNY_COLORS, type LifeStage } from '../config';

export class Bunny extends Phaser.GameObjects.Container {
  private bodyShape: Phaser.GameObjects.Ellipse;
  private leftEar: Phaser.GameObjects.Ellipse;
  private rightEar: Phaser.GameObjects.Ellipse;
  private leftEye: Phaser.GameObjects.Ellipse;
  private rightEye: Phaser.GameObjects.Ellipse;
  private mouth: Phaser.GameObjects.Arc;
  private nameLabel: Phaser.GameObjects.Text;
  private bounceTimer: Phaser.Time.TimerEvent | null = null;
  private animState: string = 'idle';
  private zzz: Phaser.GameObjects.Text | null = null;

  public bunnyId: string;
  public bunnyName: string;
  public stage: LifeStage;
  public color: string;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, name: string, color: string, stage: LifeStage) {
    super(scene, x, y);
    this.bunnyId = id;
    this.bunnyName = name;
    this.stage = stage;
    this.color = color;

    const scale = this.getStageScale();
    const tint = BUNNY_COLORS[color] || 0xffffff;

    // Body
    this.bodyShape = scene.add.ellipse(0, 0, 60 * scale, 70 * scale, tint);
    this.bodyShape.setStrokeStyle(2, 0x000000, 0.3);
    this.add(this.bodyShape);

    // Ears
    this.leftEar = scene.add.ellipse(-14 * scale, -42 * scale, 16 * scale, 36 * scale, tint);
    this.leftEar.setStrokeStyle(1.5, 0x000000, 0.3);
    this.rightEar = scene.add.ellipse(14 * scale, -42 * scale, 16 * scale, 36 * scale, tint);
    this.rightEar.setStrokeStyle(1.5, 0x000000, 0.3);
    this.add(this.leftEar);
    this.add(this.rightEar);

    // Inner ear (pink)
    const innerLeft = scene.add.ellipse(-14 * scale, -40 * scale, 8 * scale, 24 * scale, 0xffbbcc);
    const innerRight = scene.add.ellipse(14 * scale, -40 * scale, 8 * scale, 24 * scale, 0xffbbcc);
    this.add(innerLeft);
    this.add(innerRight);

    // Eyes
    this.leftEye = scene.add.ellipse(-10 * scale, -8 * scale, 8 * scale, 10 * scale, 0x222222);
    this.rightEye = scene.add.ellipse(10 * scale, -8 * scale, 8 * scale, 10 * scale, 0x222222);
    this.add(this.leftEye);
    this.add(this.rightEye);

    // Eye shine
    const shineL = scene.add.ellipse(-7 * scale, -11 * scale, 3 * scale, 3 * scale, 0xffffff);
    const shineR = scene.add.ellipse(13 * scale, -11 * scale, 3 * scale, 3 * scale, 0xffffff);
    this.add(shineL);
    this.add(shineR);

    // Mouth
    this.mouth = scene.add.arc(0, 4 * scale, 5 * scale, 0, 180, false, 0x222222);
    this.add(this.mouth);

    // Cheeks (blush)
    const cheekL = scene.add.ellipse(-18 * scale, 0, 10 * scale, 6 * scale, 0xff9999, 0.4);
    const cheekR = scene.add.ellipse(18 * scale, 0, 10 * scale, 6 * scale, 0xff9999, 0.4);
    this.add(cheekL);
    this.add(cheekR);

    // Tail
    const tail = scene.add.circle(0, 30 * scale, 8 * scale, tint);
    tail.setStrokeStyle(1, 0x000000, 0.2);
    this.add(tail);

    // Elder grey tint
    if (stage === 'elder') {
      this.bodyShape.setAlpha(0.7);
      this.leftEar.setAlpha(0.7);
      this.rightEar.setAlpha(0.7);
    }

    // Name label
    this.nameLabel = scene.add.text(0, 48 * scale, name, {
      fontFamily: '"Press Start 2P"',
      fontSize: `${Math.max(8, 10 * scale)}px`,
      color: '#fff4e0',
      stroke: '#2d1b4e',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Egg override
    if (stage === 'egg') {
      this.leftEar.setVisible(false);
      this.rightEar.setVisible(false);
      this.leftEye.setVisible(false);
      this.rightEye.setVisible(false);
      this.mouth.setVisible(false);
      // Hide inner ears, shine, cheeks
      this.list.forEach((child, i) => {
        if (i >= 3 && i <= 10) (child as Phaser.GameObjects.Shape).setVisible(false);
      });
    }

    (scene.add as any).existing(this);
    this.startIdleBounce();
  }

  private getStageScale(): number {
    switch (this.stage) {
      case 'egg': return 0.5;
      case 'baby': return 0.7;
      case 'teen': return 0.85;
      case 'adult': return 1;
      case 'elder': return 1;
      default: return 1;
    }
  }

  startIdleBounce() {
    this.animState = 'idle';
    this.stopAnim();
    this.bounceTimer = this.scene.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          y: this.y - 6,
          duration: 300,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  playEating() {
    this.stopAnim();
    this.animState = 'eating';
    this.bounceTimer = this.scene.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.05,
          scaleY: 0.95,
          duration: 100,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  playSleeping() {
    this.stopAnim();
    this.animState = 'sleeping';
    this.leftEye.setScale(1, 0.2);
    this.rightEye.setScale(1, 0.2);
    this.zzz = this.scene.add.text(30, -50, '💤', { fontSize: '20px' });
    this.add(this.zzz);
    this.scene.tweens.add({
      targets: this.zzz,
      y: -80,
      alpha: 0,
      duration: 2000,
      repeat: -1,
      onRepeat: () => { if (this.zzz) { this.zzz.y = -50; this.zzz.alpha = 1; } },
    });
  }

  playPlaying() {
    this.stopAnim();
    this.animState = 'playing';
    this.bounceTimer = this.scene.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          y: this.y - 20,
          angle: Phaser.Math.Between(-10, 10),
          duration: 200,
          yoyo: true,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  playSad() {
    this.stopAnim();
    this.animState = 'sad';
    this.mouth.setAngle(180);
    // Droopy ears
    this.scene.tweens.add({ targets: this.leftEar, angle: -15, duration: 500 });
    this.scene.tweens.add({ targets: this.rightEar, angle: 15, duration: 500 });
  }

  playSick() {
    this.stopAnim();
    this.animState = 'sick';
    this.bodyShape.setFillStyle(0xaaddaa); // greenish
    this.scene.tweens.add({
      targets: this,
      angle: { from: -3, to: 3 },
      duration: 200,
      repeat: -1,
      yoyo: true,
    });
  }

  stopAnim() {
    if (this.bounceTimer) { this.bounceTimer.destroy(); this.bounceTimer = null; }
    if (this.zzz) { this.zzz.destroy(); this.zzz = null; }
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.leftEar);
    this.scene.tweens.killTweensOf(this.rightEar);
    this.leftEye.setScale(1, 1);
    this.rightEye.setScale(1, 1);
    this.mouth.setAngle(0);
    this.leftEar.setAngle(0);
    this.rightEar.setAngle(0);
    this.setAngle(0);
    this.setScale(1);
    const tint = BUNNY_COLORS[this.color] || 0xffffff;
    this.bodyShape.setFillStyle(tint);
  }

  setInteractable(onClick: () => void) {
    this.bodyShape.setInteractive({ useHandCursor: true });
    this.bodyShape.on('pointerdown', onClick);
  }

  destroy(fromScene?: boolean) {
    this.stopAnim();
    super.destroy(fromScene);
  }
}

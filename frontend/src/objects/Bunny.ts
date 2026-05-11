import Phaser from 'phaser';
import { BUNNY_COLORS, type LifeStage } from '../config';
import { cssPalette, palette, typography } from '../ui/tokens';
import { assetFor, bunnyAssetRef, type BunnyAssetRef, type CharacterIdentity, type CharacterState } from '../state/identityRegistry';

export class Bunny extends Phaser.GameObjects.Container {
  private bodyShape: Phaser.GameObjects.Ellipse;
  private head: Phaser.GameObjects.Ellipse;
  private leftEar: Phaser.GameObjects.Ellipse;
  private rightEar: Phaser.GameObjects.Ellipse;
  private leftEye: Phaser.GameObjects.Ellipse;
  private rightEye: Phaser.GameObjects.Ellipse;
  private mouth: Phaser.GameObjects.Arc;
  private nameLabel: Phaser.GameObjects.Text;
  private nameChip: Phaser.GameObjects.Graphics;
  private groundShadow: Phaser.GameObjects.Ellipse;
  private selectionRing: Phaser.GameObjects.Ellipse;
  private accessory: Phaser.GameObjects.Graphics | null = null;
  private primitiveBody: Phaser.GameObjects.GameObject[] = [];
  private shadowBaseY = 0;
  private bounceTimer: Phaser.Time.TimerEvent | null = null;
  private animState: string = 'idle';
  private zzz: Phaser.GameObjects.Text | null = null;
  private leftLeg: Phaser.GameObjects.Ellipse;
  private rightLeg: Phaser.GameObjects.Ellipse;
  private leftArm: Phaser.GameObjects.Ellipse;
  private rightArm: Phaser.GameObjects.Ellipse;
  private tail: Phaser.GameObjects.Ellipse;
  private belly: Phaser.GameObjects.Ellipse;
  private spriteAsset: Phaser.GameObjects.Image | null = null;
  private identity: CharacterIdentity | null = null;

  public bunnyId: string;
  public bunnyName: string;
  public stage: LifeStage;
  public color: string;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, name: string, color: string, stage: LifeStage, identity: CharacterIdentity | null = null) {
    super(scene, x, y);
    this.bunnyId = id;
    this.bunnyName = name;
    this.stage = stage;
    this.color = color;
    this.identity = identity;

    const s = this.getStageScale();
    const tint = BUNNY_COLORS[color] || 0xfff5ee;
    const darkerTint = Phaser.Display.Color.ValueToColor(tint).darken(15).color;
    const bellyTint = Phaser.Display.Color.ValueToColor(tint).lighten(10).color;

    // Grounding and selection polish. These stay visible even after SVG body assets load.
    this.shadowBaseY = 55 * s;
    this.groundShadow = scene.add.ellipse(0, this.shadowBaseY, 54 * s, 13 * s, 0x000000, 0.18);
    this.groundShadow.setDepth(-3);
    this.add(this.groundShadow);

    this.selectionRing = scene.add.ellipse(0, this.shadowBaseY - 2, 66 * s, 18 * s, palette.brandPink, 0);
    this.selectionRing.setStrokeStyle(2, palette.brandPink, 0.72);
    this.selectionRing.setDepth(-2);
    this.selectionRing.setVisible(false);
    this.add(this.selectionRing);

    // Tail (behind body)
    this.tail = scene.add.ellipse(-22 * s, 20 * s, 16 * s, 14 * s, tint);
    this.tail.setStrokeStyle(1, darkerTint, 0.5);
    this.add(this.tail);

    // Legs
    this.leftLeg = scene.add.ellipse(-14 * s, 42 * s, 18 * s, 22 * s, tint);
    this.leftLeg.setStrokeStyle(1, darkerTint, 0.4);
    this.rightLeg = scene.add.ellipse(14 * s, 42 * s, 18 * s, 22 * s, tint);
    this.rightLeg.setStrokeStyle(1, darkerTint, 0.4);
    this.add(this.leftLeg);
    this.add(this.rightLeg);

    // Feet pads (pink)
    const leftPad = scene.add.ellipse(-14 * s, 48 * s, 10 * s, 8 * s, 0xffb6c1, 0.6);
    const rightPad = scene.add.ellipse(14 * s, 48 * s, 10 * s, 8 * s, 0xffb6c1, 0.6);
    this.add(leftPad);
    this.add(rightPad);

    // Body
    this.bodyShape = scene.add.ellipse(0, 12 * s, 48 * s, 52 * s, tint);
    this.bodyShape.setStrokeStyle(1.5, darkerTint, 0.3);
    this.add(this.bodyShape);

    // Belly patch
    this.belly = scene.add.ellipse(0, 18 * s, 30 * s, 32 * s, bellyTint, 0.7);
    this.add(this.belly);

    // Arms
    this.leftArm = scene.add.ellipse(-24 * s, 8 * s, 14 * s, 24 * s, tint);
    this.leftArm.setStrokeStyle(1, darkerTint, 0.3);
    this.leftArm.setAngle(-15);
    this.rightArm = scene.add.ellipse(24 * s, 8 * s, 14 * s, 24 * s, tint);
    this.rightArm.setStrokeStyle(1, darkerTint, 0.3);
    this.rightArm.setAngle(15);
    this.add(this.leftArm);
    this.add(this.rightArm);

    // Head
    this.head = scene.add.ellipse(0, -25 * s, 42 * s, 38 * s, tint);
    this.head.setStrokeStyle(1.5, darkerTint, 0.3);
    this.add(this.head);

    // Ears
    this.leftEar = scene.add.ellipse(-12 * s, -55 * s, 14 * s, 32 * s, tint);
    this.leftEar.setStrokeStyle(1.5, darkerTint, 0.3);
    this.leftEar.setAngle(-10);
    this.rightEar = scene.add.ellipse(12 * s, -55 * s, 14 * s, 32 * s, tint);
    this.rightEar.setStrokeStyle(1.5, darkerTint, 0.3);
    this.rightEar.setAngle(10);
    this.add(this.leftEar);
    this.add(this.rightEar);

    // Inner ears (pink)
    const innerLeft = scene.add.ellipse(-12 * s, -53 * s, 7 * s, 22 * s, 0xffb6c1, 0.7);
    innerLeft.setAngle(-10);
    const innerRight = scene.add.ellipse(12 * s, -53 * s, 7 * s, 22 * s, 0xffb6c1, 0.7);
    innerRight.setAngle(10);
    this.add(innerLeft);
    this.add(innerRight);

    // Eyes
    this.leftEye = scene.add.ellipse(-9 * s, -28 * s, 8 * s, 10 * s, 0x333333);
    this.rightEye = scene.add.ellipse(9 * s, -28 * s, 8 * s, 10 * s, 0x333333);
    this.add(this.leftEye);
    this.add(this.rightEye);

    // Eye shine
    const shineL = scene.add.ellipse(-6 * s, -31 * s, 3 * s, 3 * s, 0xffffff);
    const shineR = scene.add.ellipse(12 * s, -31 * s, 3 * s, 3 * s, 0xffffff);
    this.add(shineL);
    this.add(shineR);

    // Nose
    const nose = scene.add.triangle(0, -20 * s, -3 * s, 0, 3 * s, 0, 0, 3 * s, 0xffb6c1);
    this.add(nose);

    // Mouth
    this.mouth = scene.add.arc(0, -16 * s, 4 * s, 0, 180, false, 0x333333);
    this.add(this.mouth);

    // Cheeks (blush)
    const cheekL = scene.add.ellipse(-17 * s, -22 * s, 10 * s, 6 * s, 0xff9999, 0.35);
    const cheekR = scene.add.ellipse(17 * s, -22 * s, 10 * s, 6 * s, 0xff9999, 0.35);
    this.add(cheekL);
    this.add(cheekR);

    // Whiskers
    const whiskerColor = 0xcccccc;
    for (const dir of [-1, 1]) {
      for (const dy of [-2, 2]) {
        const w = scene.add.rectangle(dir * 22 * s, (-22 + dy) * s, 14 * s, 1, whiskerColor, 0.4);
        w.setAngle(dy * dir * 5);
        this.add(w);
      }
    }

    // Elder grey overlay
    if (stage === 'elder') {
      this.setAlpha(0.8);
    }

    // Name label
    this.nameChip = scene.add.graphics();
    this.drawNameChip(62 * s);
    this.add(this.nameChip);

    this.nameLabel = scene.add.text(0, 62 * s, name, {
      fontFamily: typography.families.body,
      fontSize: `${Math.max(10, 12 * s)}px`,
      color: cssPalette.plumDeep,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.nameLabel);

    // Egg override - hide everything except body
    if (stage === 'egg') {
      this.list.forEach((child, i) => {
        if (child !== this.bodyShape && child !== this.groundShadow && child !== this.selectionRing && child !== this.nameChip && child !== this.nameLabel) {
          (child as Phaser.GameObjects.Shape).setVisible(false);
        }
      });
      // Make body egg-shaped
      this.bodyShape.setSize(35, 45);
      this.bodyShape.setFillStyle(0xfff8dc);
      this.bodyShape.setStrokeStyle(2, 0xeedd88);
      this.nameLabel.setY(35);
    }

    this.capturePrimitiveBody();
    (scene.add as any).existing(this);
    this.startIdleBounce();
  }

  private getStageScale(): number {
    switch (this.stage) {
      case 'egg': return 0.5;
      case 'baby': return 0.6;
      case 'teen': return 0.8;
      case 'adult': return 1;
      case 'elder': return 0.95;
      default: return 1;
    }
  }

  private getRole(): CharacterIdentity['role'] {
    if (this.identity) return this.identity.role;
    return this.stage === 'adult' || this.stage === 'elder' ? 'father' : 'baby';
  }

  private getIdentityIndex(): number {
    if (this.identity) return this.identity.identityIndex;
    const digits = this.bunnyId.match(/\d+/)?.[0];
    const seed = digits ? Number(digits) : [...this.bunnyId].reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return ((seed - 1) % 100) + 1;
  }

  private getAssetRef(state: CharacterState = 'normal'): BunnyAssetRef | null {
    if (this.stage === 'egg') return null;
    if (this.identity) return assetFor(this.identity, state);
    if (this.stage === 'adult' || this.stage === 'elder') return bunnyAssetRef('adult', this.getIdentityIndex());
    return assetFor({ role: 'baby', identityIndex: this.getIdentityIndex() }, state);
  }

  private getIdleAssetRef(): BunnyAssetRef | null {
    return this.getAssetRef('normal');
  }

  private getAssetDisplaySize(ref: BunnyAssetRef, scale: number): number {
    return ref.kind === 'adult' ? 128 * scale : 96 * scale;
  }

  private showSpriteAsset(ref: BunnyAssetRef | null, yOffset = -2) {
    if (!ref || this.stage === 'egg') return false;

    const draw = () => {
      if (!this.scene.textures.exists(ref.key) || this.stage === 'egg') return;
      if (this.spriteAsset) {
        this.scene.tweens.killTweensOf(this.spriteAsset);
        this.spriteAsset.destroy();
        this.spriteAsset = null;
      }

      this.removePrimitiveBody();
      const s = this.getStageScale();
      this.spriteAsset = this.scene.add.image(0, yOffset * s, ref.key);
      const size = this.getAssetDisplaySize(ref, s);
      this.spriteAsset.setDisplaySize(size, size);
      this.spriteAsset.setDepth(2);
      this.add(this.spriteAsset);
      this.addIdentityAccessory(s);
    };

    if (this.scene.textures.exists(ref.key)) {
      draw();
      return true;
    }

    this.scene.load.svg(ref.key, ref.path, {
      width: ref.kind === 'adult' ? 160 : 120,
      height: ref.kind === 'adult' ? 160 : 120,
    });
    this.scene.load.once(`filecomplete-svg-${ref.key}`, draw);
    if (!this.scene.load.isLoading()) this.scene.load.start();
    return true;
  }

  startIdleBounce() {
    this.animState = 'idle';
    this.stopAnim();
    const idleAsset = this.getIdleAssetRef();
    if (idleAsset) this.showSpriteAsset(idleAsset);
    this.bounceTimer = this.scene.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          y: this.y - 8,
          duration: 400,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  playEating() {
    this.stopAnim();
    this.animState = 'eating';
    this.showSpriteAsset(this.getAssetRef(this.getRole() === 'baby' ? 'eating' : 'normal'));
    this.bounceTimer = this.scene.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.06,
          scaleY: 0.94,
          duration: 150,
          yoyo: true,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  playSleeping() {
    this.stopAnim();
    this.animState = 'sleeping';

    if (this.showSpriteAsset(this.getAssetRef(this.getRole() === 'baby' ? 'sleeping' : 'normal'))) {
      const spriteAsset = this.spriteAsset;
      if (spriteAsset) {
        this.scene.tweens.add({
          targets: spriteAsset,
          scaleX: spriteAsset.scaleX * 1.03,
          scaleY: spriteAsset.scaleY * 1.03,
          duration: 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      this.leftEye.setScale(1, 0.15);
      this.rightEye.setScale(1, 0.15);
    }

    this.zzz = this.scene.add.text(30, -60, '💤', { fontSize: '22px' });
    this.add(this.zzz);
    this.scene.tweens.add({
      targets: this.zzz,
      y: -100,
      alpha: 0,
      duration: 2000,
      repeat: -1,
      onRepeat: () => { if (this.zzz) { this.zzz.y = -60; this.zzz.alpha = 1; } },
    });
  }

  playPlaying() {
    this.stopAnim();
    this.animState = 'playing';
    this.showSpriteAsset(this.getAssetRef(this.getRole() === 'baby' ? 'playing' : 'normal'));
    this.bounceTimer = this.scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.scene.tweens.add({
          targets: this,
          y: this.y - 25,
          angle: Phaser.Math.Between(-12, 12),
          duration: 250,
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
    this.scene.tweens.add({ targets: this.leftEar, angle: -25, duration: 500 });
    this.scene.tweens.add({ targets: this.rightEar, angle: 25, duration: 500 });
  }

  playSick() {
    this.stopAnim();
    this.animState = 'sick';
    this.bodyShape.setFillStyle(0xaaddaa);
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
    if (this.spriteAsset) {
      this.scene.tweens.killTweensOf(this.spriteAsset);
      this.spriteAsset.destroy();
      this.spriteAsset = null;
    }
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.leftEar);
    this.scene.tweens.killTweensOf(this.rightEar);
    if (this.stage === 'egg') this.setDrawnBodyVisible(true);
    this.leftEye.setScale(1, 1);
    this.rightEye.setScale(1, 1);
    this.mouth.setAngle(0);
    this.leftEar.setAngle(-10);
    this.rightEar.setAngle(10);
    this.setAngle(0);
    this.setScale(1);
    this.updateGroundShadow();
    const tint = BUNNY_COLORS[this.color] || 0xfff5ee;
    this.bodyShape.setFillStyle(tint);
  }

  private setDrawnBodyVisible(visible: boolean) {
    this.primitiveBody.forEach(child => {
      (child as Phaser.GameObjects.GameObject & { setVisible?: (value: boolean) => void }).setVisible?.(visible);
    });
  }

  private capturePrimitiveBody() {
    const keep = new Set<Phaser.GameObjects.GameObject>([
      this.groundShadow,
      this.selectionRing,
      this.nameChip,
      this.nameLabel,
    ]);
    this.primitiveBody = this.list.filter((child): child is Phaser.GameObjects.GameObject => {
      return child instanceof Phaser.GameObjects.GameObject && !keep.has(child);
    });
  }

  private removePrimitiveBody() {
    if (this.stage === 'egg' || this.primitiveBody.length === 0) return;
    this.primitiveBody.forEach(child => child.destroy());
    this.primitiveBody = [];
  }

  private drawNameChip(y: number) {
    this.nameChip.clear();
    const width = Math.max(54, this.bunnyName.length * 7 + 22);
    this.nameChip.fillStyle(palette.cream, 0.9);
    this.nameChip.fillRoundedRect(-width / 2, y - 11, width, 22, 11);
    this.nameChip.lineStyle(1, palette.white, 0.75);
    this.nameChip.strokeRoundedRect(-width / 2 + 1, y - 10, width - 2, 20, 10);
  }

  private addIdentityAccessory(scale: number) {
    if (this.accessory) { this.accessory.destroy(); this.accessory = null; }
    const role = this.getRole();
    this.accessory = this.scene.add.graphics();
    this.accessory.setDepth(3);
    if (role === 'mother') {
      this.accessory.fillStyle(0xc9a7ff, 0.95);
      this.accessory.fillRoundedRect(-25 * scale, 12 * scale, 50 * scale, 10 * scale, 5 * scale);
      this.accessory.fillTriangle(-18 * scale, 20 * scale, -5 * scale, 20 * scale, -12 * scale, 35 * scale);
    } else if (role === 'father') {
      this.accessory.fillStyle(palette.sage, 0.96);
      this.accessory.fillTriangle(-5 * scale, 8 * scale, -26 * scale, -2 * scale, -26 * scale, 18 * scale);
      this.accessory.fillTriangle(5 * scale, 8 * scale, 26 * scale, -2 * scale, 26 * scale, 18 * scale);
      this.accessory.fillStyle(palette.plumDeep, 0.75);
      this.accessory.fillCircle(0, 8 * scale, 4 * scale);
    } else {
      this.accessory.fillStyle(palette.butter, 0.98);
      this.accessory.fillCircle(-12 * scale, -34 * scale, 8 * scale);
      this.accessory.fillCircle(12 * scale, -34 * scale, 8 * scale);
      this.accessory.fillStyle(palette.brandPink, 0.92);
      this.accessory.fillCircle(0, -34 * scale, 4 * scale);
    }
    this.add(this.accessory);
  }

  private updateGroundShadow() {
    const jump = Math.max(0, this.shadowBaseY - this.y);
    const scale = Phaser.Math.Clamp(1 - jump / 260, 0.72, 1.08);
    this.groundShadow.setScale(scale, Phaser.Math.Clamp(scale * 0.92, 0.65, 1));
  }

  setSelected(selected: boolean) {
    this.selectionRing.setVisible(selected);
    this.scene.tweens.killTweensOf(this.selectionRing);
    if (selected) {
      this.selectionRing.setAlpha(0.95);
      this.scene.tweens.add({
        targets: this.selectionRing,
        scaleX: 1.12,
        scaleY: 1.18,
        alpha: 0.42,
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.selectionRing.setAlpha(0);
      this.selectionRing.setScale(1);
    }
  }

  setInteractable(onClick: () => void) {
    this.bodyShape.setInteractive({ useHandCursor: true });
    this.head.setInteractive({ useHandCursor: true });
    this.bodyShape.on('pointerdown', onClick);
    this.head.on('pointerdown', onClick);
  }

  /**
   * Enable mouse/pointer drag movement. `onMove` fires after each drag step
   * so the scene can re-clamp position and notify selection state.
   */
  setDraggable(onSelect: () => void, onMove?: (x: number, y: number) => void) {
    const s = this.getStageScale();
    // Container-level hit area covers head + body so the whole bunny is grabbable.
    const hitW = 80 * s;
    const hitH = 130 * s;
    this.setSize(hitW, hitH);
    this.setInteractive(new Phaser.Geom.Rectangle(-hitW / 2, -65 * s, hitW, hitH), Phaser.Geom.Rectangle.Contains);
    (this.scene.input as Phaser.Input.InputPlugin).setDraggable(this);

    this.on('pointerdown', () => onSelect());
    this.on('dragstart', () => {
      onSelect();
      this.stopAnim();
      this.setScale(1.05);
    });
    this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.x = dragX;
      this.y = dragY;
      this.updateGroundShadow();
      onMove?.(dragX, dragY);
    });
    this.on('dragend', () => {
      this.setScale(1);
    this.updateGroundShadow();
      this.startIdleBounce();
    });
  }

  moveBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
    this.updateGroundShadow();
  }

  destroy(fromScene?: boolean) {
    this.stopAnim();
    super.destroy(fromScene);
  }
}

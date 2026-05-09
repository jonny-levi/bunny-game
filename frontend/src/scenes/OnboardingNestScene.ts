import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  ensureParents,
  recordTap,
  getCrackStage,
  shouldHatch,
  performHatch,
  getIdentities,
  HATCH_TAPS,
  assetFor,
  bunnyAssetRef,
  type BunnyAssetRef,
  type CharacterIdentity,
} from '../state/identityRegistry';
import { playCrack, playEggTap, playHatch } from '../utils/sound';

const PLAY_AREA_HEIGHT = 480;

export class OnboardingNestScene extends Phaser.Scene {
  private eggContainer!: Phaser.GameObjects.Container;
  private eggBody!: Phaser.GameObjects.Ellipse;
  private cracks: Phaser.GameObjects.Graphics[] = [];
  private tapHint!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private hatching = false;

  constructor() { super({ key: 'OnboardingNestScene' }); }

  create() {
    const { father, mother } = ensureParents();
    this.drawNestBackdrop();
    this.drawParents(father, mother);
    this.drawEgg();
    this.drawIntroText();
    this.drawProgress();

    // Restore visible crack progress from any prior session that quit mid-hatch.
    this.refreshCracks(getIdentities().egg.taps);
    this.cameras.main.fadeIn(350);
  }

  private drawNestBackdrop() {
    const cx = GAME_WIDTH / 2;
    const H = PLAY_AREA_HEIGHT;
    // Soft pink walls + warm wood floor; matches NestScene's vibe so the
    // hand-off into normal rooms feels continuous.
    this.add.rectangle(cx, H / 2 - 40, GAME_WIDTH, H - 80, 0xfce4ec);
    this.add.rectangle(cx, 40, GAME_WIDTH, 80, 0xf8bbd0, 0.3);
    this.add.rectangle(cx, H - 40, GAME_WIDTH, 80, 0xdeb887);

    // Ambient floating hearts
    for (let i = 0; i < 10; i++) {
      const h = this.add.text(
        Phaser.Math.Between(40, GAME_WIDTH - 40),
        Phaser.Math.Between(20, 220),
        Phaser.Math.Between(0, 1) ? '💕' : '💗',
        { fontSize: `${Phaser.Math.Between(10, 20)}px` },
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.3));
      this.tweens.add({
        targets: h, y: h.y - 14, alpha: h.alpha * 0.5,
        duration: 3000, yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Big cozy nest
    this.add.ellipse(cx, H - 130, 260, 90, 0xd7b377).setStrokeStyle(3, 0xc49a5a);
    this.add.ellipse(cx, H - 140, 240, 70, 0xe8cc8a);
    for (let i = 0; i < 22; i++) {
      const sx = cx + Phaser.Math.Between(-110, 110);
      const sy = H - 130 + Phaser.Math.Between(-30, 30);
      this.add.rectangle(sx, sy, Phaser.Math.Between(12, 22), 2, 0xccaa66, 0.55).setAngle(Phaser.Math.Between(-35, 35));
    }
  }

  private drawParents(father: CharacterIdentity, mother: CharacterIdentity) {
    const baseY = 240;

    const motherRef = assetFor(mother) ?? bunnyAssetRef('adult', 1);
    const fatherRef = assetFor(father) ?? bunnyAssetRef('adult', 1);

    this.addAssetImage(motherRef, 180, baseY, 120, 0);
    this.addAssetImage(fatherRef, GAME_WIDTH - 180, baseY, 130, 600);

    this.add.text(180, baseY + 80, 'Mother', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px',
      color: '#ffffff', stroke: '#333333', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    this.add.text(GAME_WIDTH - 180, baseY + 80, 'Father', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px',
      color: '#ffffff', stroke: '#333333', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  private addAssetImage(ref: BunnyAssetRef, x: number, y: number, size: number, bounceDelay: number) {
    const create = () => {
      if (!this.textures.exists(ref.key)) return;
      const image = this.add.image(x, y, ref.key).setDisplaySize(size, size).setDepth(2);
      this.gentleBounce(image, bounceDelay);
    };

    if (this.textures.exists(ref.key)) {
      create();
      return;
    }

    this.load.svg(ref.key, ref.path, {
      width: ref.kind === 'adult' ? 160 : 120,
      height: ref.kind === 'adult' ? 160 : 120,
    });
    this.load.once(`filecomplete-svg-${ref.key}`, create);
    if (!this.load.isLoading()) this.load.start();
  }

  private gentleBounce(target: Phaser.GameObjects.Image, delay: number) {
    this.tweens.add({
      targets: target,
      y: target.y - 6,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay,
    });
  }

  private drawEgg() {
    const cx = GAME_WIDTH / 2;
    const cy = PLAY_AREA_HEIGHT - 165;
    this.eggContainer = this.add.container(cx, cy);
    this.eggContainer.setDepth(4);

    // Egg shadow
    this.add.ellipse(cx, cy + 50, 70, 14, 0x000000, 0.18).setDepth(3);

    // Egg body — slightly oval, warm cream with speckles
    this.eggBody = this.add.ellipse(0, 0, 70, 90, 0xfff8dc).setStrokeStyle(2, 0xeedd88);
    this.eggContainer.add(this.eggBody);

    // Speckles for character
    for (let i = 0; i < 8; i++) {
      const speckle = this.add.circle(
        Phaser.Math.Between(-22, 22),
        Phaser.Math.Between(-30, 30),
        Phaser.Math.Between(2, 4),
        0xd4a76a,
        0.45,
      );
      this.eggContainer.add(speckle);
    }

    // Make the egg interactive — tap target spans the whole body
    this.eggBody.setInteractive({ useHandCursor: true });
    this.eggBody.on('pointerdown', () => this.handleTap());

    // Idle wobble so the egg looks alive even before first tap
    this.tweens.add({
      targets: this.eggContainer,
      y: cy - 4,
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawIntroText() {
    this.add.text(GAME_WIDTH / 2, 32, '💕 A new bunny family 💕', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#ff6b9d',
      stroke: '#ffffff',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    this.tapHint = this.add.text(GAME_WIDTH / 2, 70, 'Tap the egg to help your baby hatch!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  private drawProgress() {
    const w = 240;
    const x = GAME_WIDTH / 2;
    const y = PLAY_AREA_HEIGHT - 30;
    this.progressBar = this.add.rectangle(x, y, w, 10, 0x000000, 0.35)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setDepth(5);
    this.progressFill = this.add.rectangle(x - w / 2 + 1, y, 0, 6, 0xff6b9d).setOrigin(0, 0.5).setDepth(5);
    this.refreshProgress(getIdentities().egg.taps);
  }

  private refreshProgress(taps: number) {
    const pct = Math.min(1, taps / HATCH_TAPS);
    const innerWidth = (this.progressBar.width - 2) * pct;
    this.progressFill.width = innerWidth;
  }

  private handleTap() {
    if (this.hatching) return;
    const beforeStage = getCrackStage();
    const egg = recordTap();
    const stage = getCrackStage(egg.taps);

    playEggTap();

    // Tap feedback: shake + small squash
    this.tweens.killTweensOf(this.eggContainer);
    this.tweens.add({
      targets: this.eggContainer,
      angle: { from: -6, to: 6 },
      duration: 60,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.eggContainer.setAngle(0);
        // resume the idle wobble unless we're hatching
        if (!this.hatching) {
          this.tweens.add({
            targets: this.eggContainer,
            y: this.eggContainer.y - 2,
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      },
    });
    this.tweens.add({
      targets: this.eggContainer,
      scaleX: 1.08, scaleY: 0.94,
      duration: 80, yoyo: true,
    });

    if (stage > beforeStage) {
      playCrack();
      this.refreshCracks(egg.taps, true);
      this.emitCrackParticles();
    }
    this.refreshProgress(egg.taps);
    this.tapHint.setText(`Taps: ${egg.taps} / ${HATCH_TAPS}`);

    if (shouldHatch()) {
      this.startHatch();
    }
  }

  private refreshCracks(taps: number, animate = false) {
    const cracksWanted = getCrackStage(taps);
    while (this.cracks.length < cracksWanted) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x553311, 0.85);
      const startX = Phaser.Math.Between(-22, 22);
      const startY = Phaser.Math.Between(-30, 30);
      let x = startX;
      let y = startY;
      g.beginPath();
      g.moveTo(x, y);
      const segs = 4;
      for (let i = 0; i < segs; i++) {
        x += Phaser.Math.Between(-10, 10);
        y += Phaser.Math.Between(-10, 10);
        g.lineTo(x, y);
      }
      g.strokePath();
      g.setDepth(5);
      this.eggContainer.add(g);
      this.cracks.push(g);
      if (animate) {
        g.alpha = 0;
        this.tweens.add({ targets: g, alpha: 1, duration: 200 });
      }
    }
  }


  private emitCrackParticles() {
    const cx = this.eggContainer.x;
    const cy = this.eggContainer.y;
    for (let i = 0; i < 6; i++) {
      const chip = this.add.circle(cx, cy, Phaser.Math.Between(2, 4), 0xfff1b8, 0.9).setDepth(6);
      this.tweens.add({
        targets: chip,
        x: cx + Phaser.Math.Between(-44, 44),
        y: cy + Phaser.Math.Between(-46, 18),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(360, 620),
        ease: 'Cubic.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  private startHatch() {
    this.hatching = true;
    this.tapHint.setText('💖 The egg is hatching! 💖');
    playHatch();
    const baby = performHatch();

    this.tweens.killTweensOf(this.eggContainer);
    this.tweens.add({
      targets: this.eggContainer,
      angle: { from: -10, to: 10 },
      scaleX: { from: 1, to: 1.12 },
      scaleY: { from: 1, to: 0.9 },
      duration: 80,
      yoyo: true,
      repeat: 8,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.eggContainer.setAngle(0);
        this.eggContainer.setScale(1);
        this.revealBaby(baby);
      },
    });
  }

  private revealBaby(baby: CharacterIdentity) {
    const cx = this.eggContainer.x;
    const cy = this.eggContainer.y;

    // Flash + shrink the eggshell
    const flash = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setDepth(10);
    this.cameras.main.flash(220, 255, 245, 210);
    this.cameras.main.shake(160, 0.004);
    this.tweens.add({
      targets: flash, alpha: 0.85, duration: 200, yoyo: true,
      onComplete: () => flash.destroy(),
    });
    this.tweens.add({
      targets: this.eggContainer, scaleX: 0, scaleY: 0, alpha: 0, duration: 400,
      onComplete: () => this.eggContainer.destroy(),
    });

    const babyRef = assetFor(baby, 'happy') ?? bunnyAssetRef('baby', 1, 'happy');
    const showBaby = () => {
      if (!this.textures.exists(babyRef.key)) return;
      const babyImg = this.add.image(cx, cy, babyRef.key).setDisplaySize(0, 0).setDepth(6);
      this.tweens.add({
        targets: babyImg, displayWidth: 110, displayHeight: 110,
        duration: 500, ease: 'Back.easeOut', delay: 250,
        onComplete: () => {
          this.tweens.add({
            targets: babyImg, y: babyImg.y - 6, duration: 800, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
          });
        },
      });
    };
    if (this.textures.exists(babyRef.key)) {
      showBaby();
    } else {
      this.load.svg(babyRef.key, babyRef.path, { width: 120, height: 120 });
      this.load.once(`filecomplete-svg-${babyRef.key}`, showBaby);
      if (!this.load.isLoading()) this.load.start();
    }

    // Sparkle burst
    for (let i = 0; i < 12; i++) {
      const sp = this.add.text(cx, cy, '✨', { fontSize: '18px' }).setDepth(6).setOrigin(0.5);
      const angle = (i / 12) * Math.PI * 2;
      this.tweens.add({
        targets: sp,
        x: cx + Math.cos(angle) * 90,
        y: cy + Math.sin(angle) * 90,
        alpha: 0,
        duration: 900,
        delay: 300,
        onComplete: () => sp.destroy(),
      });
    }

    this.time.delayedCall(2200, () => this.handoffToRooms());
  }

  private handoffToRooms() {
    this.tapHint.setText('Welcome home, little bunny!');
    this.cameras.main.fadeOut(450, 255, 220, 235);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('LivingRoomScene');
      this.scene.launch('HUDScene');
    });
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  ensureParents,
  recordTap,
  getCrackStage,
  shouldHatch,
  performHatch,
  getIdentities,
  isHatched,
  HATCH_TAPS,
  assetFor,
  bunnyAssetRef,
  type BunnyAssetRef,
  type CharacterIdentity,
} from '../state/identityRegistry';
import { playCrack, playEggTap, playHatch } from '../utils/sound';
import { playSample } from '../utils/sampleAudio';

const PLAY_AREA_HEIGHT = 480;

export class OnboardingNestScene extends Phaser.Scene {
  private eggContainer!: Phaser.GameObjects.Container;
  private eggBody!: Phaser.GameObjects.Ellipse;
  private cracks: Phaser.GameObjects.Graphics[] = [];
  private tapHint!: Phaser.GameObjects.Text;
  private heartMeterShell!: Phaser.GameObjects.Container;
  private heartMeterFill!: Phaser.GameObjects.Rectangle;
  private heartMeterMask!: Phaser.GameObjects.Graphics;
  private midHatchHintShown = false;
  private hatching = false;
  private resumeBanner?: Phaser.GameObjects.Container;

  constructor() { super({ key: 'OnboardingNestScene' }); }

  create() {
    // Issue #42: if a returning player lands here after hatch is already
    // complete, the onboarding egg is non-interactive and there are no room
    // controls — they get stranded. Redirect into the playable rooms instead.
    if (isHatched()) {
      this.scene.start('LivingRoomScene');
      this.scene.launch('HUDScene');
      return;
    }

    const { father, mother } = ensureParents();
    this.drawNestBackdrop();
    this.drawParents(father, mother);
    this.drawEgg();
    this.drawIntroText();
    this.drawProgress();

    if (getIdentities().egg.taps > 0) this.showResumeCoachMark();

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

    this.addAssetImage(motherRef, 178, baseY + 2, 120, 0, -8);
    this.addAssetImage(fatherRef, GAME_WIDTH - 178, baseY + 2, 130, 720, 8);

    this.add.text(180, baseY + 80, 'Mother', {
      fontFamily: 'Nunito, Arial, sans-serif', fontSize: '14px',
      color: '#ffffff', stroke: '#333333', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
    this.add.text(GAME_WIDTH - 180, baseY + 80, 'Father', {
      fontFamily: 'Nunito, Arial, sans-serif', fontSize: '14px',
      color: '#ffffff', stroke: '#333333', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);
  }

  private addAssetImage(ref: BunnyAssetRef, x: number, y: number, size: number, bounceDelay: number, tilt = 0): Phaser.GameObjects.Image | null {
    const create = () => {
      if (!this.textures.exists(ref.key)) return null;
      const image = this.add.image(x, y, ref.key).setDisplaySize(size, size).setDepth(2).setAngle(tilt);
      this.gentleBounce(image, bounceDelay);
      return image;
    };

    if (this.textures.exists(ref.key)) {
      return create();
    }

    this.load.svg(ref.key, ref.path, {
      width: ref.kind === 'adult' ? 160 : 120,
      height: ref.kind === 'adult' ? 160 : 120,
    });
    this.load.once(`filecomplete-svg-${ref.key}`, create);
    if (!this.load.isLoading()) this.load.start();
    return null;
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
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '20px',
      color: '#ff6b9d',
      stroke: '#ffffff',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    this.tapHint = this.add.text(GAME_WIDTH / 2, 70, 'Tap the egg to help your baby hatch!', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  private drawProgress() {
    const x = GAME_WIDTH / 2 + 72;
    const y = PLAY_AREA_HEIGHT - 245;
    const h = 98;

    this.heartMeterShell = this.add.container(x, y).setDepth(6);
    const shadow = this.add.ellipse(0, h / 2 + 10, 58, 10, 0x8d4a63, 0.18);
    const stem = this.add.rectangle(0, h / 2, 20, h, 0xffffff, 0.75).setStrokeStyle(2, 0xff8fb3, 0.9);
    const cap = this.add.text(0, -9, '💗', { fontSize: '28px' }).setOrigin(0.5);
    const base = this.add.text(0, h + 3, '♡', { fontSize: '24px', color: '#ff6b9d' }).setOrigin(0.5);
    this.heartMeterFill = this.add.rectangle(0, h, 16, 0, 0xff6b9d, 0.86).setOrigin(0.5, 1);

    this.heartMeterMask = this.make.graphics({ x, y });
    this.heartMeterMask.fillStyle(0xffffff);
    this.heartMeterMask.fillRoundedRect(-8, 0, 16, h, 8);
    this.heartMeterFill.setMask(this.heartMeterMask.createGeometryMask());
    this.heartMeterMask.visible = false;

    this.heartMeterShell.add([shadow, stem, this.heartMeterFill, cap, base]);
    this.refreshProgress(getIdentities().egg.taps);
  }

  private refreshProgress(taps: number, beat = false) {
    const pct = Math.min(1, taps / HATCH_TAPS);
    this.tweens.add({
      targets: this.heartMeterFill,
      displayHeight: 98 * pct,
      duration: beat ? 180 : 0,
      ease: 'Back.easeOut',
    });
    if (beat) {
      this.tweens.add({ targets: this.heartMeterShell, scale: 1.08, duration: 90, yoyo: true });
    }
  }

  private emitHeartToMeter() {
    const heart = this.add.text(this.eggContainer.x, this.eggContainer.y - 24, '💖', { fontSize: '18px' })
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({
      targets: heart,
      x: this.heartMeterShell.x + Phaser.Math.Between(-4, 4),
      y: this.heartMeterShell.y + Phaser.Math.Between(4, 20),
      alpha: 0.1,
      scale: 0.55,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => heart.destroy(),
    });
  }

  private pulseEggGlow(taps: number) {
    const pct = Math.min(1, taps / HATCH_TAPS);
    const glow = this.add.ellipse(this.eggContainer.x, this.eggContainer.y + 34, 70, 22, 0xfff0dc, 0.42 + pct * 0.25)
      .setDepth(3);
    this.tweens.add({
      targets: glow,
      scaleX: 1.25 + pct * 1.2,
      scaleY: 1 + pct * 0.7,
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => glow.destroy(),
    });
  }

  private showMidHatchHint() {
    if (this.midHatchHintShown) return;
    this.midHatchHintShown = true;
    const startX = this.eggContainer.x;
    const hint = this.add.text(startX, this.eggContainer.y - 78, 'The egg is moving!', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '18px',
      color: '#8a2d52',
      backgroundColor: '#fff5f8',
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
    }).setOrigin(0.5).setDepth(8).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 1, y: hint.y - 8, duration: 220, yoyo: true, hold: 900, onComplete: () => hint.destroy() });
    this.tweens.add({ targets: this.eggContainer, x: startX + 3, duration: 40, yoyo: true, repeat: 5, onComplete: () => this.eggContainer.setX(startX) });
  }

  private showResumeCoachMark() {
    const taps = getIdentities().egg.taps;
    const remaining = Math.max(0, HATCH_TAPS - taps);
    const banner = this.add.container(GAME_WIDTH / 2, 112).setDepth(12);
    const bg = this.add.graphics();
    bg.fillStyle(0xfff6e9, 0.96);
    bg.fillRoundedRect(-188, -32, 376, 64, 18);
    bg.lineStyle(2, 0xff6b9d, 0.22);
    bg.strokeRoundedRect(-186, -30, 372, 60, 16);
    const text = this.add.text(0, -4, `You're mid-hatch — ${remaining} taps to go!`, {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '16px',
      color: '#3e1e4f',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hint = this.add.text(0, 18, 'Tap the egg when you are ready.', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '12px',
      color: '#8a2d52',
    }).setOrigin(0.5);
    banner.add([bg, text, hint]);
    banner.setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: 104, duration: 220 });
    this.resumeBanner = banner;
    this.time.delayedCall(4200, () => {
      if (!this.resumeBanner) return;
      const target = this.resumeBanner;
      this.resumeBanner = undefined;
      this.tweens.add({ targets: target, alpha: 0, duration: 350, onComplete: () => target.destroy() });
    });
  }

  private handleTap() {
    if (this.hatching) return;
    if (this.resumeBanner) { this.resumeBanner.destroy(); this.resumeBanner = undefined; }
    const beforeStage = getCrackStage();
    const egg = recordTap();
    const stage = getCrackStage(egg.taps);

    playEggTap();
    this.emitHeartToMeter();
    this.pulseEggGlow(egg.taps);
    if (egg.taps % 2 === 0) this.cameras.main.flash(40, 255, 240, 220);

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
    this.refreshProgress(egg.taps, true);
    if (egg.taps >= HATCH_TAPS * 0.5) this.showMidHatchHint();
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

  private async startHatch() {
    this.hatching = true;
    this.tapHint.setText('💖 The egg is hatching! 💖');
    if (!playSample(this, 'hatch')) playHatch();
    let baby: CharacterIdentity;
    try {
      const { saveClient } = await import('../network/SaveClient');
      const serverSave = await saveClient.hatch(getIdentities());
      baby = performHatch(serverSave?.baby ?? null);
    } catch (err) {
      console.warn('Server hatch failed, using local fallback', err);
      baby = performHatch();
    }

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

    this.playRadialWipe(cx, cy);
    this.cameras.main.flash(220, 255, 245, 210);
    this.cameras.main.shake(160, 0.004);
    this.tweens.add({
      targets: this.eggContainer, scaleX: 0, scaleY: 0, alpha: 0, duration: 400,
      onComplete: () => this.eggContainer.destroy(),
    });

    const babyRef = assetFor(baby, 'happy') ?? bunnyAssetRef('baby', 1, 'happy');
    const showBaby = () => {
      if (!this.textures.exists(babyRef.key)) return;
      const babyImg = this.add.image(cx, cy, babyRef.key).setDisplaySize(0, 0).setDepth(7);
      this.tweens.add({
        targets: babyImg, displayWidth: 112, displayHeight: 112,
        duration: 500, ease: 'Back.easeOut', delay: 250,
        onComplete: () => this.tweens.add({ targets: babyImg, y: babyImg.y - 6, duration: 800, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' }),
      });
      this.tweenParentsIntoFamilyPose();
      this.showBabyNameChip(baby, cy + 78);
      // TODO(birth-cert): save a renderer snapshot for an in-game birth certificate.
    };
    if (this.textures.exists(babyRef.key)) {
      showBaby();
    } else {
      this.load.svg(babyRef.key, babyRef.path, { width: 120, height: 120 });
      this.load.once(`filecomplete-svg-${babyRef.key}`, showBaby);
      if (!this.load.isLoading()) this.load.start();
    }

    // Sparkle burst
    for (let i = 0; i < 14; i++) {
      const sp = this.add.text(cx, cy, i % 2 ? '✨' : '💞', { fontSize: '18px' }).setDepth(8).setOrigin(0.5);
      const angle = (i / 14) * Math.PI * 2;
      this.tweens.add({
        targets: sp,
        x: cx + Math.cos(angle) * 95,
        y: cy + Math.sin(angle) * 95,
        alpha: 0,
        duration: 900,
        delay: 300,
        onComplete: () => sp.destroy(),
      });
    }

    this.time.delayedCall(2400, () => this.handoffToRooms());
  }

  private playRadialWipe(x: number, y: number) {
    const wipe = this.add.circle(x, y, 8, 0xfff2f7, 0.82).setDepth(9);
    this.tweens.add({
      targets: wipe,
      radius: GAME_WIDTH,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => wipe.destroy(),
    });
  }

  private tweenParentsIntoFamilyPose() {
    const movers = this.children.list.filter((child) =>
      child instanceof Phaser.GameObjects.Image && child.depth === 2,
    ) as Phaser.GameObjects.Image[];
    for (const image of movers) {
      const targetX = image.x < GAME_WIDTH / 2 ? GAME_WIDTH / 2 - 78 : GAME_WIDTH / 2 + 78;
      this.tweens.add({ targets: image, x: targetX, y: 246, angle: image.x < GAME_WIDTH / 2 ? -4 : 4, duration: 620, ease: 'Sine.easeInOut' });
    }
  }

  private showBabyNameChip(baby: CharacterIdentity, y: number) {
    const label = this.add.text(GAME_WIDTH / 2, y, `Welcome, Baby #${baby.identityIndex}`, {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#ff6b9d',
      padding: { left: 14, right: 14, top: 7, bottom: 7 },
    }).setOrigin(0.5).setDepth(9).setAlpha(0);
    this.tweens.add({ targets: label, alpha: 1, y: y - 6, duration: 300, delay: 650 });
  }

  private handoffToRooms() {
    this.tapHint.setText('Welcome home, little bunny!');
    const curtain = this.add.rectangle(-GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff7eaa, 1).setDepth(20);
    const glint = this.add.rectangle(-GAME_WIDTH + 12, GAME_HEIGHT / 2, 22, GAME_HEIGHT, 0xffb3cc, 0.75).setDepth(21);
    this.tweens.add({
      targets: [curtain, glint],
      x: GAME_WIDTH / 2,
      duration: 380,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.start('LivingRoomScene', { curtainWipe: true });
        this.scene.launch('HUDScene');
      },
    });
  }
}

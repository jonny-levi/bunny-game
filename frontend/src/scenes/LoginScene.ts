import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { wsClient } from '../network/WebSocketClient';
import { playClick, startBGMusic } from '../utils/sound';
import { bunnyAssetKey, getIdentities, isHatched } from '../state/identityRegistry';

const PLAYER_KEY_PREFIX = 'bunny-family:last-played:';
const BRAND_PINK = '#f15f9b';
const BRAND_PLUM = '#5f315c';
const CARD_FILL = 0xfffbf1;
const HERO_KEY = 'login-hero';

export class LoginScene extends Phaser.Scene {
  constructor() { super({ key: 'LoginScene' }); }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.addWarmBackdrop();
    this.addHero(cx, cy - 118, 0.7);
    this.addLogoLockup(cx, cy - 82);

    this.add.text(cx, cy + 16, "Who's playing?", {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '18px',
      color: BRAND_PLUM,
      fontStyle: '700',
    }).setOrigin(0.5);

    this.createPlayerCard(cx - 122, cy + 92, 'Jonny', 0x42a5f5, bunnyAssetKey('adult', getIdentities().father?.identityIndex ?? 1));
    this.createPlayerCard(cx + 122, cy + 92, 'Elina', 0xce93d8, bunnyAssetKey('adult', getIdentities().mother?.identityIndex ?? 2));
    this.createAddPlayerCard(cx, cy + 218);
  }

  private addWarmBackdrop() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffe6c8);
    this.add.rectangle(GAME_WIDTH / 2, 115, GAME_WIDTH, 230, 0xffbed0, 0.42);
    this.add.circle(120, 80, 90, 0xfff0a6, 0.2);
    for (let i = 0; i < 10; i += 1) {
      const x = Phaser.Math.Between(24, GAME_WIDTH - 24);
      const y = Phaser.Math.Between(440, GAME_HEIGHT - 16);
      const sparkle = this.add.text(x, y, '✦', { fontSize: `${Phaser.Math.Between(8, 14)}px`, color: '#ffffff' }).setAlpha(0.3);
      this.tweens.add({ targets: sparkle, y: y - 8, alpha: 0.1, duration: 1800 + i * 120, yoyo: true, repeat: -1 });
    }
  }

  private addHero(x: number, y: number, scale: number) {
    const hero = this.add.image(x, y, HERO_KEY).setDisplaySize(440 * scale, 248 * scale).setAlpha(0.98);
    this.tweens.add({ targets: hero, y: y - 5, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private addLogoLockup(x: number, y: number) {
    this.add.text(x, y, 'Bunny Family', {
      fontFamily: 'Fredoka, Nunito, Arial, sans-serif',
      fontSize: '56px',
      color: BRAND_PINK,
      shadow: { offsetX: 0, offsetY: 5, color: '#7b315f', blur: 10, fill: true },
    }).setOrigin(0.5);
    this.add.text(x, y + 44, 'raise your bunny family together', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '14px',
      color: BRAND_PLUM,
    }).setOrigin(0.5);
  }

  private createPlayerCard(x: number, y: number, name: string, accent: number, fallbackTexture: string) {
    const group = this.add.container(x, y);
    const shadow = this.add.rectangle(0, 8, 220, 120, 0x7b315f, 0.14).setOrigin(0.5).setScale(1, 0.98);
    const card = this.add.rectangle(0, 0, 220, 120, CARD_FILL, 0.96)
      .setStrokeStyle(3, accent, 0.34)
      .setInteractive(new Phaser.Geom.Rectangle(-110, -60, 220, 120), Phaser.Geom.Rectangle.Contains)
      .setData('role', 'button');
    const avatarRing = this.add.circle(-58, -6, 35, accent, 0.16).setStrokeStyle(2, accent, 0.4);
    const avatar = this.textures.exists(fallbackTexture)
      ? this.add.image(-58, -8, fallbackTexture).setDisplaySize(58, 58)
      : this.add.text(-58, -8, name === 'Jonny' ? '💙' : '💜', { fontSize: '34px' }).setOrigin(0.5);

    const title = this.add.text(-6, -24, name, {
      fontFamily: 'Fredoka, Nunito, Arial, sans-serif',
      fontSize: '28px',
      color: BRAND_PLUM,
    }).setOrigin(0, 0.5);
    const sub = this.add.text(-6, 7, this.lastPlayedLabel(name), {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '13px',
      color: '#8a557d',
    }).setOrigin(0, 0.5);
    const cta = this.add.text(-6, 32, 'tap to continue', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '12px',
      color: '#a86c91',
      fontStyle: '700',
    }).setOrigin(0, 0.5);

    group.add([shadow, card, avatarRing, avatar, title, sub, cta]);
    card.on('pointerover', () => group.setScale(1.035));
    card.on('pointerout', () => group.setScale(1));
    card.on('pointerdown', () => this.selectPlayer(group, name));
  }

  private createAddPlayerCard(x: number, y: number) {
    const group = this.add.container(x, y);
    const card = this.add.rectangle(0, 0, 220, 70, 0xffffff, 0.42)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setInteractive(new Phaser.Geom.Rectangle(-110, -35, 220, 70), Phaser.Geom.Rectangle.Contains);
    const plus = this.add.text(-72, 0, '+', { fontFamily: 'Fredoka, Nunito, Arial, sans-serif', fontSize: '38px', color: BRAND_PLUM }).setOrigin(0.5);
    const copy = this.add.text(-42, 0, 'Add player\ncoming soon', { fontFamily: 'Nunito, Arial, sans-serif', fontSize: '14px', color: BRAND_PLUM }).setOrigin(0, 0.5);
    group.add([card, plus, copy]);
    card.on('pointerdown', () => this.toast('Add player is coming soon ✨'));
  }

  private lastPlayedLabel(name: string): string {
    const raw = localStorage.getItem(`${PLAYER_KEY_PREFIX}${name}`);
    const last = raw ? Number(raw) : 0;
    if (!last || !Number.isFinite(last)) return 'new player';
    const hours = Math.max(1, Math.floor((Date.now() - last) / 36e5));
    if (hours < 24) return `last played ${hours}h ago`;
    return `last played ${Math.floor(hours / 24)}d ago`;
  }

  private selectPlayer(group: Phaser.GameObjects.Container, name: string) {
    playClick();
    startBGMusic();
    localStorage.setItem(`${PLAYER_KEY_PREFIX}${name}`, String(Date.now()));
    this.registry.set('playerName', name);
    this.tweens.add({
      targets: group,
      scale: 0.96,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: async () => {
        await wsClient.connect(name);
        if (isHatched()) {
          this.scene.start('LivingRoomScene');
          this.scene.launch('HUDScene');
        } else {
          this.scene.start('OnboardingNestScene');
        }
      },
    });
  }

  private toast(message: string) {
    const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 36, message, {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#5f315ccc',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: toast, y: toast.y - 10, alpha: 0, delay: 900, duration: 450, onComplete: () => toast.destroy() });
  }
}

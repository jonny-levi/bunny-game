import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { wsClient } from '../network/WebSocketClient';
import { playClick, startBGMusic } from '../utils/sound';

export class LoginScene extends Phaser.Scene {
  constructor() { super({ key: 'LoginScene' }); }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background gradient feel
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x1a0a2e);

    // Stars
    for (let i = 0; i < 50; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.8));
      this.tweens.add({
        targets: star,
        alpha: 0.2,
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
      });
    }

    // Logo bunny (simple shape)
    const logoBunny = this.add.ellipse(cx, cy - 120, 50, 60, 0xffaacc);
    this.add.ellipse(cx - 12, cy - 155, 12, 28, 0xffaacc); // left ear
    this.add.ellipse(cx + 12, cy - 155, 12, 28, 0xffaacc); // right ear
    this.add.ellipse(cx - 12, cy - 153, 6, 18, 0xffbbdd); // inner ear
    this.add.ellipse(cx + 12, cy - 153, 6, 18, 0xffbbdd);
    this.add.ellipse(cx - 8, cy - 126, 5, 6, 0x222222); // eyes
    this.add.ellipse(cx + 8, cy - 126, 5, 6, 0x222222);
    this.add.circle(cx, cy - 116, 3, 0x222222); // nose

    // Bounce
    this.tweens.add({ targets: logoBunny, y: cy - 126, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(cx, cy - 50, '🐰 Bunny Family 🐰', {
      fontFamily: '"Press Start 2P"',
      fontSize: '16px',
      color: '#f7a072',
      stroke: '#2d1b4e',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, cy, "Who's playing?", {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#fff4e0',
    }).setOrigin(0.5);

    // Player buttons
    this.createPlayerButton(cx - 80, cy + 50, '💙 Jonny', 0x4fc3f7, 'Jonny');
    this.createPlayerButton(cx + 80, cy + 50, '💜 Elina', 0xce93d8, 'Elina');

    this.add.text(cx, cy + 120, 'Take care of your bunnies together!', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.5);
  }

  private createPlayerButton(x: number, y: number, text: string, color: number, name: string) {
    const btn = this.add.rectangle(x, y, 140, 40, color, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.4)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#fff4e0',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setScale(1.08));
    btn.on('pointerout', () => btn.setScale(1));
    btn.on('pointerdown', () => {
      playClick();
      startBGMusic();
      this.registry.set('playerName', name);
      wsClient.connect(name);
      this.scene.start('LivingRoomScene');
      this.scene.launch('HUDScene');
    });
  }
}

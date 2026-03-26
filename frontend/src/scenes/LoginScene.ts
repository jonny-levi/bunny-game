import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { wsClient } from '../network/WebSocketClient';
import { playClick, startBGMusic } from '../utils/sound';

export class LoginScene extends Phaser.Scene {
  constructor() { super({ key: 'LoginScene' }); }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background gradient
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x1a1a3e);
    // Subtle gradient overlay
    this.add.rectangle(cx, cy - 100, GAME_WIDTH, GAME_HEIGHT / 2, 0x2a1a5e, 0.4);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.7));
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(800, 2500),
        yoyo: true,
        repeat: -1,
      });
    }

    // Cute bunny logo - full body
    const by = cy - 130;
    // Body
    this.add.ellipse(cx, by + 15, 45, 50, 0xffb6c1);
    // Belly
    this.add.ellipse(cx, by + 22, 28, 30, 0xfff0f5, 0.7);
    // Head
    this.add.ellipse(cx, by - 18, 38, 34, 0xffb6c1);
    // Ears
    this.add.ellipse(cx - 12, by - 48, 12, 28, 0xffb6c1);
    this.add.ellipse(cx + 12, by - 48, 12, 28, 0xffb6c1);
    this.add.ellipse(cx - 12, by - 46, 6, 18, 0xff8fa0);
    this.add.ellipse(cx + 12, by - 46, 6, 18, 0xff8fa0);
    // Eyes
    this.add.ellipse(cx - 8, by - 22, 6, 8, 0x333333);
    this.add.ellipse(cx + 8, by - 22, 6, 8, 0x333333);
    this.add.ellipse(cx - 6, by - 24, 2, 2, 0xffffff);
    this.add.ellipse(cx + 10, by - 24, 2, 2, 0xffffff);
    // Nose
    this.add.triangle(cx, by - 14, cx - 3, by - 14, cx + 3, by - 14, cx, by - 11, 0xff8fa0);
    // Cheeks
    this.add.ellipse(cx - 16, by - 15, 8, 5, 0xff8fa0, 0.35);
    this.add.ellipse(cx + 16, by - 15, 8, 5, 0xff8fa0, 0.35);
    // Arms
    this.add.ellipse(cx - 22, by + 8, 12, 20, 0xffb6c1);
    this.add.ellipse(cx + 22, by + 8, 12, 20, 0xffb6c1);
    // Legs
    this.add.ellipse(cx - 12, by + 38, 14, 16, 0xffb6c1);
    this.add.ellipse(cx + 12, by + 38, 14, 16, 0xffb6c1);
    // Tail
    this.add.circle(cx - 18, by + 25, 7, 0xfff0f5);

    // Bounce animation on the whole logo area
    const logoGroup = this.add.rectangle(cx, by, 1, 1, 0x000000, 0);
    this.tweens.add({ targets: logoGroup, y: by - 8, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Title
    this.add.text(cx, cy - 40, '🐰 Bunny Family 🐰', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ff6b9d',
      stroke: '#1a1a3e',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 5, "Who's playing?", {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Modern player buttons
    this.createPlayerButton(cx - 100, cy + 60, '💙 Jonny', 0x42a5f5, 'Jonny');
    this.createPlayerButton(cx + 100, cy + 60, '💜 Elina', 0xce93d8, 'Elina');

    this.add.text(cx, cy + 120, 'Take care of your bunnies together!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.5);

    // Decorative sparkles at bottom
    for (let i = 0; i < 8; i++) {
      const sp = this.add.text(Phaser.Math.Between(50, GAME_WIDTH - 50), Phaser.Math.Between(GAME_HEIGHT - 100, GAME_HEIGHT - 20), '✨', { fontSize: '10px' }).setAlpha(0.2);
      this.tweens.add({ targets: sp, alpha: 0.05, duration: 2000, yoyo: true, repeat: -1, delay: i * 250 });
    }
  }

  private createPlayerButton(x: number, y: number, text: string, color: number, name: string) {
    const btn = this.add.rectangle(x, y, 160, 48, color, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#00000033',
      strokeThickness: 1,
      fontStyle: 'bold',
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

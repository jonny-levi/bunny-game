import Phaser from 'phaser';
import { getLayout } from '../ui/layout';
import { cssPalette, palette, typography } from '../ui/tokens';
import { announce, motionDuration } from '../utils/accessibility';

const MINIGAMES = [
  { name: 'Carrot Catch', emoji: '🥕', desc: 'Catch falling carrots with your bunny basket.', color: 0xff8b4d },
  { name: 'Bunny Jump', emoji: '🐰', desc: 'Hop over tiny logs and flower pots.', color: 0xffb3d9 },
  { name: 'Garden Run', emoji: '🌸', desc: 'Run through flowers and collect shiny clovers.', color: 0x7bc67e },
  { name: 'Baby Bunny Memory', emoji: '🎴', desc: 'Match cute bunny family cards.', color: 0xa8d0ff },
  { name: 'Feed the Bunny', emoji: '🍎', desc: 'Pick the right snack before time runs out.', color: 0xffd166 },
  { name: 'Find the Carrot', emoji: '🔍', desc: 'Search the rich garden scene for hidden carrots.', color: 0xd4b8ff },
] as const;

export class MinigamesScene extends Phaser.Scene {
  constructor() { super({ key: 'MinigamesScene' }); }

  create() {
    if (!this.scene.isActive('HUDScene')) this.scene.launch('HUDScene');
    this.drawRoom();
    this.cameras.main.fadeIn(motionDuration(300));
    announce('Entered Bunny Minigames');
  }

  private drawRoom() {
    const layout = getLayout(this);
    const H = layout.playBottom;
    this.add.rectangle(layout.width / 2, H / 2, layout.width, H, 0xd4f5e9);
    this.add.rectangle(layout.width / 2, H * 0.32, layout.width, H * 0.64, 0xa8d0ff, 0.45);
    this.add.ellipse(120, 86, 150, 44, palette.white, 0.65);
    this.add.ellipse(600, 116, 190, 54, palette.white, 0.52);
    this.add.circle(layout.width - 88, 76, 42, 0xffee58, 0.9);
    this.add.rectangle(layout.width / 2, H - 52, layout.width, 120, 0x7bc67e, 0.95);

    this.drawDecorations(layout.width, H);

    this.add.text(layout.width / 2, layout.safeTop + 34, '🎮 Bunny Minigames', {
      fontFamily: typography.families.display,
      fontSize: '34px',
      color: cssPalette.plumDeep,
      stroke: '#ffffff',
      strokeThickness: 5,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    this.add.text(layout.width / 2, layout.safeTop + 72, 'Extra cute activities — the main bunny game stays the same', {
      fontFamily: typography.families.body,
      fontSize: '15px',
      color: cssPalette.plumDeep,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);

    const cols = layout.width < 700 ? 2 : 3;
    const cardW = Math.min(220, (layout.width - 70) / cols);
    const cardH = 96;
    const startX = layout.width / 2 - ((cols - 1) * (cardW + 16)) / 2;
    const startY = Math.max(136, layout.safeTop + 118);

    MINIGAMES.forEach((game, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cardW + 16);
      const y = startY + row * (cardH + 18);
      this.createMinigameCard(x, y, cardW, cardH, game, index === 0);
    });
  }

  private createMinigameCard(x: number, y: number, w: number, h: number, game: typeof MINIGAMES[number], playable: boolean) {
    const card = this.add.container(x, y).setDepth(5);
    const shadow = this.add.rectangle(4, 7, w, h, 0x5f315c, 0.16).setOrigin(0.5).setAngle(-1);
    const bg = this.add.rectangle(0, 0, w, h, 0xffffff, 0.92).setOrigin(0.5).setStrokeStyle(4, game.color, 0.65);
    const tint = this.add.rectangle(0, 0, w - 12, h - 12, game.color, 0.13).setOrigin(0.5);
    const emoji = this.add.text(-w / 2 + 34, -20, game.emoji, { fontSize: '34px' }).setOrigin(0.5);
    const title = this.add.text(-w / 2 + 66, -32, game.name, {
      fontFamily: typography.families.display,
      fontSize: '17px',
      color: cssPalette.plumDeep,
      fontStyle: 'bold',
    });
    const desc = this.add.text(-w / 2 + 66, -8, game.desc, {
      fontFamily: typography.families.body,
      fontSize: '11px',
      color: cssPalette.plum,
      wordWrap: { width: w - 82 },
    });
    const badge = this.add.text(w / 2 - 12, h / 2 - 18, playable ? 'PLAY' : 'SOON', {
      fontFamily: typography.families.body,
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: playable ? '#7bc67e' : '#ff8fa0',
      padding: { x: 7, y: 3 },
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    card.add([shadow, bg, tint, emoji, title, desc, badge]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.035, duration: 120 }));
    bg.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 120 }));
    bg.on('pointerdown', () => this.showMiniToast(playable ? 'Carrot Catch prototype is ready for the next gameplay pass 🥕' : `${game.name} is coming soon ✨`));
  }

  private showMiniToast(message: string) {
    const layout = getLayout(this);
    const toast = this.add.container(layout.width / 2, layout.playBottom - 82).setDepth(30);
    const bg = this.add.rectangle(0, 0, Math.min(520, layout.width - 60), 38, palette.plumDeep, 0.88).setOrigin(0.5);
    const text = this.add.text(0, 0, message, { fontFamily: typography.families.body, fontSize: '14px', color: cssPalette.white, fontStyle: 'bold' }).setOrigin(0.5);
    toast.add([bg, text]);
    toast.setAlpha(0);
    this.tweens.add({ targets: toast, alpha: 1, y: toast.y - 8, duration: 160, yoyo: true, hold: 1600, onComplete: () => toast.destroy() });
    announce(message);
  }

  private drawDecorations(width: number, H: number) {
    const sign = this.add.container(90, H - 126).setDepth(2);
    sign.add(this.add.rectangle(0, 28, 14, 82, 0x8b7866));
    sign.add(this.add.rectangle(0, 0, 140, 52, 0xffd166).setStrokeStyle(4, 0xb88654));
    sign.add(this.add.text(0, 0, 'PLAY YARD', { fontFamily: typography.families.display, fontSize: '17px', color: cssPalette.plumDeep, fontStyle: 'bold' }).setOrigin(0.5));
    for (let i = 0; i < 9; i++) {
      const x = 180 + i * 70;
      this.add.text(x % width, H - 38 - (i % 3) * 18, i % 2 ? '🥕' : '🌼', { fontSize: `${30 + (i % 3) * 6}px` }).setDepth(2);
    }
    this.add.text(width - 120, H - 118, '🏁', { fontSize: '64px' }).setDepth(2);
    this.add.text(width - 225, H - 126, '🎈', { fontSize: '58px' }).setDepth(2);
  }
}

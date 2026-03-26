import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { StatBar } from '../objects/StatBar';
import { ActionButton } from '../objects/ActionButton';
import { gameBunnies, selectedBunnyId, activityLog, setSelectedBunny } from './RoomScene';
import { wsClient, type BunnyState } from '../network/WebSocketClient';
import { toggleMute, isMuted } from '../utils/sound';

export class HUDScene extends Phaser.Scene {
  private statBars: { hunger: StatBar; happiness: StatBar; cleanliness: StatBar; energy: StatBar; health: StatBar } | null = null;
  private bunnyNameText!: Phaser.GameObjects.Text;
  private bunnyStageText!: Phaser.GameObjects.Text;
  private activityTexts: Phaser.GameObjects.Text[] = [];
  private muteBtn!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'HUDScene' }); }

  create() {
    // Semi-transparent panel on the right
    const panelX = GAME_WIDTH - 100;
    this.add.rectangle(panelX, GAME_HEIGHT / 2, 200, GAME_HEIGHT, COLORS.panel, 0.85);

    // Bunny info
    this.bunnyNameText = this.add.text(panelX, 20, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '8px',
      color: '#f7a072',
    }).setOrigin(0.5);

    this.bunnyStageText = this.add.text(panelX, 35, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#fff4e0',
    }).setOrigin(0.5);

    // Stat bars
    const barX = panelX - 90;
    this.statBars = {
      hunger: new StatBar(this, barX, 60, '🍳 HGR', COLORS.hunger, 100),
      happiness: new StatBar(this, barX, 78, '😊 HAP', COLORS.happiness, 100),
      cleanliness: new StatBar(this, barX, 96, '🛁 CLN', COLORS.cleanliness, 100),
      energy: new StatBar(this, barX, 114, '⚡ NRG', COLORS.energy, 100),
      health: new StatBar(this, barX, 132, '❤️ HP', COLORS.health, 100),
    };

    // Action buttons
    const btnX = panelX;
    const actions = [
      { text: '🍳 Feed', color: COLORS.btnFeed, action: 'feed' },
      { text: '🛁 Clean', color: COLORS.btnClean, action: 'clean' },
      { text: '🎾 Play', color: COLORS.btnPlay, action: 'play' },
      { text: '💤 Sleep', color: COLORS.btnSleep, action: 'sleep' },
      { text: '💊 Med', color: COLORS.btnMedicine, action: 'medicine' },
      { text: '💕 Breed', color: COLORS.btnBreed, action: 'breed' },
    ];

    actions.forEach((a, i) => {
      new ActionButton(this, btnX, 170 + i * 38, a.text, a.color, () => {
        this.doRoomAction(a.action);
      });
    });

    // Activity log area
    this.add.text(panelX, 420, 'Activity', {
      fontFamily: '"Press Start 2P"',
      fontSize: '7px',
      color: '#f7a072',
    }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
      const t = this.add.text(panelX - 90, 438 + i * 14, '', {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: '#fff4e0',
        wordWrap: { width: 180 },
      });
      this.activityTexts.push(t);
    }

    // Mute button
    this.muteBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 20, isMuted() ? '🔇' : '🔊', {
      fontSize: '16px',
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      const m = toggleMute();
      this.muteBtn.setText(m ? '🔇' : '🔊');
    });

    // Navigation arrows
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    const leftArrow = this.add.text(15, GAME_HEIGHT / 2, '◀', {
      fontSize: '24px', color: '#fff4e0', stroke: '#2d1b4e', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);
    const rightArrow = this.add.text(GAME_WIDTH - 210, GAME_HEIGHT / 2, '▶', {
      fontSize: '24px', color: '#fff4e0', stroke: '#2d1b4e', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

    leftArrow.on('pointerdown', () => this.navigateRoom(-1, rooms));
    rightArrow.on('pointerdown', () => this.navigateRoom(1, rooms));

    // Bunny selection listener
    this.events.on('bunnySelected', (id: string) => {
      setSelectedBunny(id);
    });

    // Update loop
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.updateHUD(),
    });
  }

  private updateHUD() {
    const bunny = gameBunnies.find(b => b.id === selectedBunnyId) || gameBunnies.find(b => b.isAlive);
    if (bunny && this.statBars) {
      this.bunnyNameText.setText(bunny.name);
      this.bunnyStageText.setText(`[${bunny.stage}]`);
      this.statBars.hunger.setValue(bunny.hunger);
      this.statBars.happiness.setValue(bunny.happiness);
      this.statBars.cleanliness.setValue(bunny.cleanliness);
      this.statBars.energy.setValue(bunny.energy);
      this.statBars.health.setValue(bunny.health);
    } else {
      this.bunnyNameText.setText('No bunny');
      this.bunnyStageText.setText('');
    }

    // Activity log
    for (let i = 0; i < this.activityTexts.length; i++) {
      this.activityTexts[i].setText(activityLog[i] || '');
    }
  }

  private doRoomAction(action: string) {
    // Find the active room scene and call doAction on it
    const activeScenes = this.scene.manager.getScenes(true);
    for (const scene of activeScenes) {
      if (scene !== this && 'doAction' in scene) {
        (scene as any).doAction(action);
        return;
      }
    }
  }

  private navigateRoom(dir: number, rooms: string[]) {
    const activeScenes = this.scene.manager.getScenes(true);
    let currentKey = '';
    for (const scene of activeScenes) {
      if (scene !== this && rooms.includes(scene.scene.key)) {
        currentKey = scene.scene.key;
        break;
      }
    }
    const idx = rooms.indexOf(currentKey);
    if (idx < 0) return;
    const next = rooms[(idx + dir + rooms.length) % rooms.length];
    const currentScene = this.scene.get(currentKey);
    if (currentScene) {
      currentScene.cameras.main.fadeOut(300);
      currentScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop(currentKey);
        this.scene.start(next);
      });
    }
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { StatBar } from '../objects/StatBar';
import { ActionButton } from '../objects/ActionButton';
import { gameBunnies, selectedBunnyId, activityLog, setSelectedBunny } from './RoomScene';
import { wsClient, type BunnyState } from '../network/WebSocketClient';
import { toggleMute, isMuted } from '../utils/sound';
import { ACTION_COOLDOWNS, CARE_ACTIONS, type CareAction } from '../game/actions';

const TOOLBAR_HEIGHT = 120;
const PANEL_Y = GAME_HEIGHT - TOOLBAR_HEIGHT;

export class HUDScene extends Phaser.Scene {
  private statBars: { hunger: StatBar; happiness: StatBar; cleanliness: StatBar; energy: StatBar; health: StatBar } | null = null;
  private bunnyNameText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private actionButtons = new Map<CareAction, ActionButton>();
  private cooldownUntil = new Map<CareAction, number>();

  constructor() { super({ key: 'HUDScene' }); }

  create() {
    // Semi-transparent bottom toolbar panel
    const panelBg = this.add.rectangle(GAME_WIDTH / 2, PANEL_Y + TOOLBAR_HEIGHT / 2, GAME_WIDTH, TOOLBAR_HEIGHT, 0x1a1a2e, 0.92);
    panelBg.setDepth(0);

    // Top border gradient line
    this.add.rectangle(GAME_WIDTH / 2, PANEL_Y, GAME_WIDTH, 2, 0xff6b9d, 0.7);

    // Left section: bunny info + stats
    this.bunnyNameText = this.add.text(12, PANEL_Y + 8, 'Select a bunny', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#ff6b9d',
      fontStyle: 'bold',
    });

    const barX = 8;
    const barY = PANEL_Y + 28;
    this.statBars = {
      hunger: new StatBar(this, barX, barY, '🍳 HGR', COLORS.hunger, 90),
      happiness: new StatBar(this, barX, barY + 16, '😊 HAP', COLORS.happiness, 90),
      cleanliness: new StatBar(this, barX + 155, barY, '🛁 CLN', COLORS.cleanliness, 90),
      energy: new StatBar(this, barX + 155, barY + 16, '⚡ NRG', COLORS.energy, 90),
      health: new StatBar(this, barX + 310, barY, '❤️ HP', COLORS.health, 90),
    };

    // Action buttons row with visible client-side cooldowns.
    const actionColors: Record<CareAction, number> = {
      feed: COLORS.btnFeed,
      clean: COLORS.btnClean,
      play: COLORS.btnPlay,
      sleep: COLORS.btnSleep,
      medicine: COLORS.btnMedicine,
      breed: COLORS.btnBreed,
    };
    const btnY = PANEL_Y + 88;
    const btnSpacing = GAME_WIDTH / (CARE_ACTIONS.length + 1);
    CARE_ACTIONS.forEach((a, i) => {
      const btn = new ActionButton(this, btnSpacing * (i + 1), btnY, a.label, actionColors[a.action], () => {
        this.doRoomAction(a.action);
      }, 110, 36);
      this.actionButtons.set(a.action, btn);
    });

    // Navigation arrows (above toolbar, on left/right edges)
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    const arrowY = (PANEL_Y) / 2;

    const leftArrow = this.add.text(18, arrowY, '◀', {
      fontSize: '32px', color: '#ffffff', stroke: '#333', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.7);

    const rightArrow = this.add.text(GAME_WIDTH - 18, arrowY, '▶', {
      fontSize: '32px', color: '#ffffff', stroke: '#333', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.7);

    leftArrow.on('pointerover', () => leftArrow.setAlpha(1));
    leftArrow.on('pointerout', () => leftArrow.setAlpha(0.7));
    rightArrow.on('pointerover', () => rightArrow.setAlpha(1));
    rightArrow.on('pointerout', () => rightArrow.setAlpha(0.7));
    leftArrow.on('pointerdown', () => this.navigateRoom(-1, rooms));
    rightArrow.on('pointerdown', () => this.navigateRoom(1, rooms));

    // Mute button
    this.muteBtn = this.add.text(GAME_WIDTH - 30, PANEL_Y + 8, isMuted() ? '🔇' : '🔊', {
      fontSize: '18px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      const m = toggleMute();
      this.muteBtn.setText(m ? '🔇' : '🔊');
    });

    // Room name label at top
    this.roomLabel = this.add.text(GAME_WIDTH / 2, 12, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Update loop
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.updateHUD();
        this.updateCooldowns();
      },
    });
  }

  private updateHUD() {
    const bunny = gameBunnies.find(b => b.id === selectedBunnyId) || gameBunnies.find(b => b.isAlive);
    if (bunny && this.statBars) {
      this.bunnyNameText.setText(`🐰 ${bunny.name} [${bunny.stage}]`);
      this.statBars.hunger.setValue(bunny.hunger);
      this.statBars.happiness.setValue(bunny.happiness);
      this.statBars.cleanliness.setValue(bunny.cleanliness);
      this.statBars.energy.setValue(bunny.energy);
      this.statBars.health.setValue(bunny.health);
    } else {
      this.bunnyNameText.setText('No bunny selected');
    }

    // Update room label
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    const roomNames: Record<string, string> = {
      LivingRoomScene: '🏠 Living Room',
      KitchenScene: '🍳 Kitchen',
      BathroomScene: '🛁 Bathroom',
      GardenScene: '🌿 Garden',
      BedroomScene: '🌙 Bedroom',
      VetScene: '💊 Vet Office',
      NestScene: '💕 Cozy Nest',
    };
    const activeScenes = this.scene.manager.getScenes(true);
    for (const scene of activeScenes) {
      if (scene !== this && rooms.includes(scene.scene.key)) {
        this.roomLabel.setText(roomNames[scene.scene.key] || '');
        break;
      }
    }
  }

  private doRoomAction(action: CareAction) {
    const now = Date.now();
    const remaining = (this.cooldownUntil.get(action) ?? 0) - now;
    if (remaining > 0) return;
    this.cooldownUntil.set(action, now + ACTION_COOLDOWNS[action]);
    this.updateCooldowns();
    const activeScenes = this.scene.manager.getScenes(true);
    for (const scene of activeScenes) {
      if (scene !== this && 'doAction' in scene) {
        (scene as any).doAction(action);
        return;
      }
    }
  }

  private updateCooldowns() {
    const now = Date.now();
    this.actionButtons.forEach((button, action) => {
      button.setCooldown(Math.max(0, (this.cooldownUntil.get(action) ?? 0) - now));
    });
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
      currentScene.cameras.main.fadeOut(250);
      currentScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop(currentKey);
        this.scene.start(next);
      });
    }
  }
}

export { TOOLBAR_HEIGHT };

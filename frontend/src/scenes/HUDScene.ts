import Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '../config';
import { StatBar } from '../objects/StatBar';
import { ActionButton } from '../objects/ActionButton';
import { gameBunnies, selectedBunnyId } from './RoomScene';
import { toggleMute, isMuted } from '../utils/sound';
import { ACTION_COOLDOWNS, CARE_ACTIONS, type CareAction } from '../game/actions';
import { addIcon } from '../ui/Icon';

const HUD_PREF_KEY = 'bunny:hud-expanded';
const SIDE_PANEL_WIDTH = 184;
const SIDE_PANEL_MARGIN = 12;
const COMPACT_PANEL_WIDTH = 58;
const MOBILE_BREAKPOINT = 700;
const PLAY_AREA_HEIGHT = 480;

export class HUDScene extends Phaser.Scene {
  private statBars: { hunger: StatBar; happiness: StatBar; cleanliness: StatBar; energy: StatBar; health: StatBar } | null = null;
  private bunnyNameText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Image;
  private roomLabel!: Phaser.GameObjects.Text;
  private actionButtons = new Map<CareAction, ActionButton>();
  private cooldownUntil = new Map<CareAction, number>();
  private panel!: Phaser.GameObjects.Container;
  private panelBg!: Phaser.GameObjects.Rectangle;
  private toggleBtn!: Phaser.GameObjects.Text;
  private compactSummary!: Phaser.GameObjects.Text;
  private expandedContent!: Phaser.GameObjects.Container;
  private hudExpanded = true;
  private isMobile = false;

  constructor() { super({ key: 'HUDScene' }); }

  create() {
    this.isMobile = this.scale.width < MOBILE_BREAKPOINT;
    this.hudExpanded = this.loadHudPreference();

    this.createSidePanel();
    this.createNavigation();
    this.createRoomLabel();

    this.scale.on('resize', () => this.layoutPanel());

    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.updateHUD();
        this.updateCooldowns();
      },
    });
  }

  private loadHudPreference(): boolean {
    const saved = window.localStorage.getItem(HUD_PREF_KEY);
    if (saved === 'expanded') return true;
    if (saved === 'collapsed') return false;
    return this.scale.width >= MOBILE_BREAKPOINT;
  }

  private saveHudPreference() {
    window.localStorage.setItem(HUD_PREF_KEY, this.hudExpanded ? 'expanded' : 'collapsed');
  }

  private createSidePanel() {
    this.panel = this.add.container(0, 0).setDepth(50);
    this.panelBg = this.add.rectangle(0, 0, SIDE_PANEL_WIDTH, PLAY_AREA_HEIGHT - 24, 0x1a1a2e, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.accent, 0.55);
    this.panel.add(this.panelBg);

    this.toggleBtn = this.add.text(0, 0, '', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#ff6b9d',
      padding: { x: 8, y: 5 },
      fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.toggleBtn.on('pointerdown', () => {
      this.hudExpanded = !this.hudExpanded;
      this.saveHudPreference();
      this.layoutPanel();
    });
    this.panel.add(this.toggleBtn);

    this.compactSummary = this.add.text(0, 0, '🐰\n--', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 7,
    }).setOrigin(0.5, 0);
    this.panel.add(this.compactSummary);

    this.expandedContent = this.add.container(0, 0);
    this.panel.add(this.expandedContent);

    this.bunnyNameText = this.add.text(12, 14, 'Select a bunny', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '13px',
      color: '#ff6b9d',
      fontStyle: 'bold',
      wordWrap: { width: SIDE_PANEL_WIDTH - 34 },
    });
    this.expandedContent.add(this.bunnyNameText);

    const barX = 12;
    const barY = 52;
    this.statBars = {
      hunger: new StatBar(this, barX, barY, '🍳 Hunger', COLORS.hunger, 92),
      happiness: new StatBar(this, barX, barY + 24, '😊 Happy', COLORS.happiness, 92),
      cleanliness: new StatBar(this, barX, barY + 48, '🛁 Clean', COLORS.cleanliness, 92),
      energy: new StatBar(this, barX, barY + 72, '⚡ Energy', COLORS.energy, 92),
      health: new StatBar(this, barX, barY + 96, '❤️ Health', COLORS.health, 92),
    };
    Object.values(this.statBars).forEach(bar => this.expandedContent.add(bar));

    const actionColors: Record<CareAction, number> = {
      feed: COLORS.btnFeed,
      clean: COLORS.btnClean,
      play: COLORS.btnPlay,
      sleep: COLORS.btnSleep,
      medicine: COLORS.btnMedicine,
      breed: COLORS.btnBreed,
    };
    CARE_ACTIONS.forEach((a, i) => {
      const x = i % 2 === 0 ? 55 : 134;
      const y = 210 + Math.floor(i / 2) * 42;
      const btn = new ActionButton(this, x, y, a.label, actionColors[a.action], () => {
        this.doRoomAction(a.action);
      }, 70, 32);
      this.actionButtons.set(a.action, btn);
      this.expandedContent.add(btn);
    });

    const initialMuteIcon = addIcon(this, isMuted() ? 'mute' : 'unmute', SIDE_PANEL_WIDTH - 22, PLAY_AREA_HEIGHT - 62, 22)
      .setInteractive({ useHandCursor: true });
    this.muteBtn = initialMuteIcon;
    this.muteBtn.on('pointerdown', () => {
      const muted = toggleMute();
      this.muteBtn.setTexture(muted ? 'ui-icon-mute' : 'ui-icon-unmute');
    });
    this.expandedContent.add(this.muteBtn);

    this.layoutPanel();
  }

  private layoutPanel() {
    this.isMobile = this.scale.width < MOBILE_BREAKPOINT;
    const width = this.hudExpanded ? SIDE_PANEL_WIDTH : COMPACT_PANEL_WIDTH;
    const height = this.hudExpanded ? PLAY_AREA_HEIGHT - 24 : 116;
    const x = GAME_WIDTH - width - SIDE_PANEL_MARGIN;
    const y = this.isMobile && !this.hudExpanded ? SIDE_PANEL_MARGIN + 38 : SIDE_PANEL_MARGIN;

    this.panel.setPosition(x, y);
    this.panelBg.setSize(width, height);
    this.panelBg.setAlpha(this.hudExpanded ? 0.9 : 0.82);
    this.toggleBtn.setPosition(width - 8, 8);
    this.toggleBtn.setText(this.hudExpanded ? '›' : '‹');
    this.compactSummary.setPosition(width / 2, 38);
    this.compactSummary.setVisible(!this.hudExpanded);
    this.expandedContent.setVisible(this.hudExpanded);
  }

  private createNavigation() {
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    const arrowY = PLAY_AREA_HEIGHT / 2;

    const leftArrow = this.add.text(18, arrowY, '◀', {
      fontSize: '32px', color: '#ffffff', stroke: '#333', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.7).setDepth(40);

    const rightArrow = this.add.text(GAME_WIDTH - 18, arrowY, '▶', {
      fontSize: '32px', color: '#ffffff', stroke: '#333', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.7).setDepth(40);

    leftArrow.on('pointerover', () => leftArrow.setAlpha(1));
    leftArrow.on('pointerout', () => leftArrow.setAlpha(0.7));
    rightArrow.on('pointerover', () => rightArrow.setAlpha(1));
    rightArrow.on('pointerout', () => rightArrow.setAlpha(0.7));
    leftArrow.on('pointerdown', () => this.navigateRoom(-1, rooms));
    rightArrow.on('pointerdown', () => this.navigateRoom(1, rooms));
  }

  private createRoomLabel() {
    this.roomLabel = this.add.text(GAME_WIDTH / 2, 12, '', {
      fontFamily: 'Nunito, Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40);
  }

  private updateHUD() {
    const bunny = gameBunnies.find(b => b.id === selectedBunnyId) || gameBunnies.find(b => b.isAlive);
    if (bunny && this.statBars) {
      this.bunnyNameText.setText(`🐰 ${bunny.name}\n${bunny.stage}`);
      this.statBars.hunger.setValue(bunny.hunger);
      this.statBars.happiness.setValue(bunny.happiness);
      this.statBars.cleanliness.setValue(bunny.cleanliness);
      this.statBars.energy.setValue(bunny.energy);
      this.statBars.health.setValue(bunny.health);
      const lowest = Math.min(bunny.hunger, bunny.happiness, bunny.cleanliness, bunny.energy, bunny.health);
      this.compactSummary.setText(`🐰\n${Math.round(lowest)}%\nneeds`);
    } else {
      this.bunnyNameText.setText('No bunny selected');
      this.compactSummary.setText('🐰\n--');
    }

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

export const TOOLBAR_HEIGHT = 0;

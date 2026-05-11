import Phaser from 'phaser';
import { GAME_WIDTH, COLORS } from '../config';
import { StatBar } from '../objects/StatBar';
import { ActionButton } from '../objects/ActionButton';
import { gameBunnies, selectedBunnyId } from './RoomScene';
import { cycleVolume, getVolume, getVolumeLabel } from '../utils/sound';
import { ACTION_COOLDOWNS, CARE_ACTIONS, type CareAction } from '../game/actions';
import { addIcon, type IconName } from '../ui/Icon';
import { cssPalette, palette, typography } from '../ui/tokens';
import { announce, motionDuration } from '../utils/accessibility';
import { getLayout } from '../ui/layout';

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
  private volumeText!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private actionButtons = new Map<CareAction, ActionButton>();
  private cooldownUntil = new Map<CareAction, number>();
  private panel!: Phaser.GameObjects.Container;
  private panelBg!: Phaser.GameObjects.Graphics;
  private needDots = new Map<string, Phaser.GameObjects.Text>();
  private toggleBtn!: Phaser.GameObjects.Text;
  private compactSummary!: Phaser.GameObjects.Text;
  private expandedContent!: Phaser.GameObjects.Container;
  private hudExpanded = true;
  private isMobile = false;
  private keyboardMode = false;
  private helpPanel?: Phaser.GameObjects.Container;
  private focusOutline?: Phaser.GameObjects.Rectangle;
  private focusedButton = 0;
  private dock!: Phaser.GameObjects.Container;
  private dockBg!: Phaser.GameObjects.Graphics;
  private dockItems: Array<{ hit: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; dot: Phaser.GameObjects.Text; index: number }> = [];

  constructor() { super({ key: 'HUDScene' }); }

  create() {
    this.isMobile = this.scale.width < MOBILE_BREAKPOINT;
    this.hudExpanded = this.loadHudPreference();

    this.createSidePanel();
    this.createNavigation();
    this.createRoomLabel();
    this.installKeyboardShortcuts();

    this.scale.on('resize', () => { this.layoutPanel(); this.layoutDock(); this.layoutRoomLabel(); });

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
    this.panelBg = this.add.graphics();
    this.panel.add(this.panelBg);

    this.toggleBtn = this.add.text(0, 0, '', {
      fontFamily: typography.families.display,
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
      fontFamily: typography.families.body,
      fontSize: '12px',
      color: cssPalette.plumDeep,
      align: 'center',
      lineSpacing: 7,
    }).setOrigin(0.5, 0);
    this.panel.add(this.compactSummary);

    this.expandedContent = this.add.container(0, 0);
    this.panel.add(this.expandedContent);

    this.bunnyNameText = this.add.text(12, 14, 'Select a bunny', {
      fontFamily: typography.families.display,
      fontSize: '15px',
      color: cssPalette.plumDeep,
      fontStyle: 'bold',
      wordWrap: { width: SIDE_PANEL_WIDTH - 44 },
    });
    this.expandedContent.add(this.bunnyNameText);

    const barX = 12;
    const barY = 52;
    this.statBars = {
      hunger: new StatBar(this, barX, barY, 'Hunger', COLORS.hunger, 102, 'feed'),
      happiness: new StatBar(this, barX, barY + 30, 'Happy', COLORS.happiness, 102, 'play'),
      cleanliness: new StatBar(this, barX, barY + 60, 'Clean', COLORS.cleanliness, 102, 'clean'),
      energy: new StatBar(this, barX, barY + 90, 'Energy', COLORS.energy, 102, 'sleep'),
      health: new StatBar(this, barX, barY + 120, 'Health', COLORS.health, 102, 'medicine'),
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
      const x = 38 + (i % 3) * 55;
      const y = 230 + Math.floor(i / 3) * 83;
      const btn = new ActionButton(this, x, y, a.shortLabel, actionColors[a.action], a.action as IconName, () => {
        this.doRoomAction(a.action);
      });
      this.actionButtons.set(a.action, btn);
      this.expandedContent.add(btn);
    });

    const initialMuteIcon = addIcon(this, getVolume() === 0 ? 'mute' : 'unmute', SIDE_PANEL_WIDTH - 50, PLAY_AREA_HEIGHT - 54, 24)
      .setInteractive({ useHandCursor: true });
    this.muteBtn = initialMuteIcon;
    this.volumeText = this.add.text(SIDE_PANEL_WIDTH - 28, PLAY_AREA_HEIGHT - 54, getVolumeLabel(), {
      fontFamily: typography.families.body,
      fontSize: '10px',
      color: cssPalette.plumDeep,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    const cycleAudio = () => {
      const level = cycleVolume();
      this.muteBtn.setTexture(level === 0 ? 'ui-icon-mute' : 'ui-icon-unmute');
      this.volumeText.setText(getVolumeLabel());
    };
    this.muteBtn.on('pointerdown', cycleAudio);
    this.volumeText.on('pointerdown', cycleAudio);
    this.expandedContent.add([this.muteBtn, this.volumeText]);

    this.layoutPanel();
  }

  private layoutPanel() {
    this.isMobile = this.scale.width < MOBILE_BREAKPOINT;
    const layout = getLayout(this);
    const width = this.hudExpanded ? SIDE_PANEL_WIDTH : COMPACT_PANEL_WIDTH;
    const height = this.hudExpanded ? Math.min(PLAY_AREA_HEIGHT - 24, layout.hudMaxHeight) : 116;
    const x = layout.hudX - width;
    const y = this.isMobile && !this.hudExpanded ? layout.hudY + 38 : layout.hudY;

    this.panel.setPosition(x, y);
    this.drawPanelBg(width, height);
    this.toggleBtn.setPosition(width - 8, 8);
    this.toggleBtn.setText(this.hudExpanded ? '›' : '‹');
    this.compactSummary.setPosition(width / 2, 38);
    this.compactSummary.setVisible(!this.hudExpanded);
    this.expandedContent.setVisible(this.hudExpanded);
  }


  private drawPanelBg(width: number, height: number) {
    this.panelBg.clear();
    this.panelBg.fillStyle(palette.plumDeep, 0.18);
    this.panelBg.fillRoundedRect(4, 6, width, height, 16);
    this.panelBg.fillStyle(palette.cream, this.hudExpanded ? 0.94 : 0.86);
    this.panelBg.fillRoundedRect(0, 0, width, height, 16);
    this.panelBg.lineStyle(1, palette.white, 0.68);
    this.panelBg.strokeRoundedRect(1, 1, width - 2, height - 2, 15);
    this.panelBg.lineStyle(2, palette.brandPink, 0.18);
    this.panelBg.strokeRoundedRect(5, 5, width - 10, height - 10, 12);
  }

  private createNavigation() {
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    this.dock = this.add.container(0, 0).setDepth(45);
    this.dockBg = this.add.graphics();
    this.dock.add(this.dockBg);

    const icons: Array<{ room: string; icon: IconName; label: string; need?: string }> = [
      { room: 'LivingRoomScene', icon: 'play', label: 'Home', need: 'happiness' },
      { room: 'KitchenScene', icon: 'feed', label: 'Food', need: 'hunger' },
      { room: 'BathroomScene', icon: 'clean', label: 'Bath', need: 'cleanliness' },
      { room: 'GardenScene', icon: 'breed', label: 'Yard' },
      { room: 'BedroomScene', icon: 'sleep', label: 'Sleep', need: 'energy' },
      { room: 'VetScene', icon: 'medicine', label: 'Vet', need: 'health' },
      { room: 'NestScene', icon: 'seasonSun', label: 'Nest' },
    ];

    icons.forEach((item, index) => {
      const x = -165 + index * 55;
      const hit = this.add.rectangle(x, -1, 48, 48, palette.white, 0.01)
        .setInteractive({ useHandCursor: true });
      const icon = addIcon(this, item.icon, x, -7, 24);
      const text = this.add.text(x, 17, item.label, {
        fontFamily: typography.families.body,
        fontSize: '9px',
        color: cssPalette.plumDeep,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const dot = this.add.text(x + 14, -22, '!', {
        fontFamily: typography.families.display,
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: cssPalette.danger,
        padding: { x: 3, y: 0 },
        fontStyle: 'bold',
      }).setOrigin(0.5).setVisible(false);
      if (item.need) this.needDots.set(item.need, dot);
      hit.on('pointerover', () => icon.setScale(1.14));
      hit.on('pointerout', () => icon.setScale(1));
      hit.on('pointerdown', () => this.startRoom(item.room, rooms));
      this.dock.add([hit, icon, text, dot]);
      this.dockItems.push({ hit, icon, text, dot, index });
    });
    this.layoutDock();
  }

  private layoutDock() {
    if (!this.dock || !this.dockBg) return;
    const layout = getLayout(this);
    const spacing = layout.orientation === 'portrait' ? Math.min(60, (layout.width - layout.safeLeft - layout.safeRight - 32) / 7) : 55;
    const width = spacing * 7 + 10;
    this.dock.setPosition(layout.width / 2, layout.dockY);
    this.dockBg.clear();
    this.dockBg.fillStyle(palette.plumDeep, 0.16);
    this.dockBg.fillRoundedRect(-width / 2, -27, width, 62, 20);
    this.dockBg.fillStyle(palette.cream, 0.92);
    this.dockBg.fillRoundedRect(-width / 2, -32, width, 62, 20);
    this.dockBg.lineStyle(1, palette.white, 0.7);
    this.dockBg.strokeRoundedRect(-width / 2 + 1, -31, width - 2, 60, 19);
    this.dockItems.forEach(({ hit, icon, text, dot, index }) => {
      const x = -spacing * 3 + index * spacing;
      hit.setPosition(x, -2).setSize(layout.dockIconSize, layout.dockIconSize);
      hit.input!.hitArea = new Phaser.Geom.Rectangle(-layout.dockIconSize / 2, -layout.dockIconSize / 2, layout.dockIconSize, layout.dockIconSize);
      icon.setPosition(x, -8).setDisplaySize(26, 26);
      text.setPosition(x, 18);
      dot.setPosition(x + 15, -25);
    });
  }

  private createRoomLabel() {
    this.roomLabel = this.add.text(GAME_WIDTH / 2, 12, '', {
      fontFamily: typography.families.display,
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(40);
    this.layoutRoomLabel();
  }

  private layoutRoomLabel() {
    if (!this.roomLabel) return;
    const layout = getLayout(this);
    this.roomLabel.setPosition(layout.width / 2, layout.safeTop + 12);
  }

  private updateHUD() {
    const bunny = gameBunnies.find(b => b.id === selectedBunnyId) || gameBunnies.find(b => b.isAlive);
    if (bunny && this.statBars) {
      this.bunnyNameText.setText(`${bunny.name}\n${bunny.stage}`);
      this.statBars.hunger.setValue(bunny.hunger);
      this.statBars.happiness.setValue(bunny.happiness);
      this.statBars.cleanliness.setValue(bunny.cleanliness);
      this.statBars.energy.setValue(bunny.energy);
      this.statBars.health.setValue(bunny.health);
      const lowest = Math.min(bunny.hunger, bunny.happiness, bunny.cleanliness, bunny.energy, bunny.health);
      this.compactSummary.setText(`🐰\n${Math.round(lowest)}%\nneeds`);
      this.updateNeedDots(bunny);
    } else {
      this.bunnyNameText.setText('No bunny selected');
      this.compactSummary.setText('🐰\n--');
      this.updateNeedDots(null);
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
      button.setCooldown(Math.max(0, (this.cooldownUntil.get(action) ?? 0) - now), ACTION_COOLDOWNS[action]);
    });
  }


  private updateNeedDots(bunny: any | null) {
    const values: Record<string, number> = bunny ? {
      hunger: bunny.hunger,
      happiness: bunny.happiness,
      cleanliness: bunny.cleanliness,
      energy: bunny.energy,
      health: bunny.health,
    } : {};
    this.needDots.forEach((dot, need) => dot.setVisible((values[need] ?? 100) < 30));
  }

  private startRoom(next: string, rooms: string[]) {
    const activeScenes = this.scene.manager.getScenes(true);
    let currentKey = '';
    for (const scene of activeScenes) {
      if (scene !== this && rooms.includes(scene.scene.key)) {
        currentKey = scene.scene.key;
        break;
      }
    }
    if (currentKey === next) return;
    announce(`Entered ${this.roomAnnouncement(next)}`);
    const currentScene = currentKey ? this.scene.get(currentKey) : null;
    if (currentScene) {
      currentScene.cameras.main.fadeOut(motionDuration(200));
      currentScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop(currentKey);
        this.scene.start(next);
      });
      return;
    }
    this.scene.start(next);
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
      currentScene.cameras.main.fadeOut(motionDuration(200));
      currentScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop(currentKey);
        this.scene.start(next);
      });
    }
  }

  private installKeyboardShortcuts() {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.keyboardMode = true;
      this.focusedButton = (this.focusedButton + 1) % CARE_ACTIONS.length;
      this.drawFocusOutline();
      const activeRoom = this.getActiveRoomScene();
      if (activeRoom && 'selectNextBunny' in activeRoom) (activeRoom as any).selectNextBunny();
    });
    kb.on('keydown', (event: KeyboardEvent) => {
      if (event.key === '[') this.cycleActiveRoom(-1);
      if (event.key === ']') this.cycleActiveRoom(1);
      if (event.key === '?') this.toggleHelpPanel();
    });
    CARE_ACTIONS.forEach((action, index) => {
      kb.on(`keydown-${index + 1}`, () => {
        this.keyboardMode = true;
        this.focusedButton = index;
        this.drawFocusOutline();
        this.doRoomAction(action.action);
      });
    });
  }

  private getActiveRoomScene(): Phaser.Scene | null {
    const rooms = ['LivingRoomScene', 'KitchenScene', 'BathroomScene', 'GardenScene', 'BedroomScene', 'VetScene', 'NestScene'];
    return this.scene.manager.getScenes(true).find(scene => scene !== this && rooms.includes(scene.scene.key)) ?? null;
  }

  private cycleActiveRoom(dir: number) {
    const active = this.getActiveRoomScene();
    if (active && 'cycleRoom' in active) (active as any).cycleRoom(dir);
  }

  private roomAnnouncement(sceneKey: string): string {
    const names: Record<string, string> = {
      LivingRoomScene: 'Living Room', KitchenScene: 'Kitchen', BathroomScene: 'Bathroom',
      GardenScene: 'Garden', BedroomScene: 'Bedroom', VetScene: 'Vet Office', NestScene: 'Cozy Nest',
    };
    return names[sceneKey] || sceneKey;
  }

  private drawFocusOutline() {
    this.focusOutline?.destroy();
    if (!this.keyboardMode || !this.hudExpanded) return;
    const action = CARE_ACTIONS[this.focusedButton]?.action;
    const button = action ? this.actionButtons.get(action) : null;
    if (!button) return;
    this.focusOutline = this.add.rectangle(this.panel.x + this.expandedContent.x + button.x, this.panel.y + this.expandedContent.y + button.y, 68, 68)
      .setStrokeStyle(4, palette.plumDeep, 0.95)
      .setDepth(95);
    announce(`Focused ${CARE_ACTIONS[this.focusedButton].label}. Press ${this.focusedButton + 1} to use.`);
  }

  private toggleHelpPanel() {
    if (this.helpPanel) {
      this.helpPanel.destroy();
      this.helpPanel = undefined;
      announce('Keyboard shortcuts closed');
      return;
    }
    const panel = this.add.container(GAME_WIDTH / 2, 250).setDepth(100);
    const bg = this.add.rectangle(0, 0, 430, 250, palette.cream, 0.97)
      .setStrokeStyle(3, palette.plumDeep, 0.9);
    const copy = [
      'Keyboard shortcuts',
      'Tab: select next bunny',
      '[ / ]: previous / next room',
      '1 Feed  2 Clean  3 Play',
      '4 Sleep  5 Vet  6 Breed',
      'Arrow keys or WASD: move selected bunny',
      '?: close this help panel',
    ].join('\n');
    const text = this.add.text(0, 0, copy, {
      fontFamily: typography.families.body,
      fontSize: '18px',
      color: cssPalette.plumDeep,
      align: 'center',
      lineSpacing: 8,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    panel.add([bg, text]);
    this.helpPanel = panel;
    announce('Keyboard shortcuts opened. Tab selects bunnies, brackets change rooms, one through six trigger actions.');
  }
}

export const TOOLBAR_HEIGHT = 0;

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Bunny } from '../objects/Bunny';
import { wsClient, type BunnyState } from '../network/WebSocketClient';
import { getDayNightTint, getSeason } from '../utils/time';
import { randomBunnyName } from '../utils/names';
import type { LifeStage } from '../config';

// Shared state (simple global for demo — would use proper store in production)
export let gameBunnies: BunnyState[] = [];
export let selectedBunnyId: string | null = null;
export let activityLog: string[] = [];

export function setSelectedBunny(id: string | null) { selectedBunnyId = id; }
export function addActivity(msg: string) {
  activityLog.unshift(msg);
  if (activityLog.length > 20) activityLog.pop();
}

// Create demo bunnies for offline play
export function ensureDemoBunnies() {
  if (gameBunnies.length === 0) {
    gameBunnies = [
      { id: 'b1', name: 'Mochi', color: 'white', pattern: null, stage: 'adult', hunger: 75, happiness: 80, cleanliness: 60, energy: 70, health: 85, isAlive: true, parentAId: null, parentBId: null },
      { id: 'b2', name: 'Boba', color: 'brown', pattern: null, stage: 'baby', hunger: 90, happiness: 95, cleanliness: 80, energy: 50, health: 90, isAlive: true, parentAId: null, parentBId: null },
      { id: 'b3', name: 'Pudding', color: 'pink', pattern: null, stage: 'teen', hunger: 60, happiness: 70, cleanliness: 90, energy: 80, health: 75, isAlive: true, parentAId: null, parentBId: null },
    ];
  }
}

// Listen for server updates
wsClient.onState((state) => { gameBunnies = state.bunnies; });
wsClient.onEvent((event) => {
  if (event.message) addActivity(event.message);
  if (event.type === 'state' && event.bunnies) gameBunnies = event.bunnies;
});

export abstract class RoomScene extends Phaser.Scene {
  protected bunnyObjects: Bunny[] = [];
  protected dayNightOverlay!: Phaser.GameObjects.Rectangle;
  protected seasonText!: Phaser.GameObjects.Text;
  protected roomLabel!: Phaser.GameObjects.Text;

  abstract getRoomName(): string;
  abstract drawRoom(): void;

  create() {
    ensureDemoBunnies();
    this.drawRoom();

    // Day/night overlay
    const tint = getDayNightTint();
    this.dayNightOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, tint.color, tint.alpha);
    this.dayNightOverlay.setDepth(5);

    // Season indicator
    const season = getSeason();
    const seasonEmojis: Record<string, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '🌧️' };
    this.seasonText = this.add.text(GAME_WIDTH - 10, 10, seasonEmojis[season] || '', {
      fontSize: '20px',
    }).setOrigin(1, 0).setDepth(6);

    // Room label
    this.roomLabel = this.add.text(GAME_WIDTH / 2, 20, this.getRoomName(), {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#fff4e0',
      stroke: '#2d1b4e',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    this.spawnBunnies();

    // Update day/night every 60s
    this.time.addEvent({
      delay: 60000,
      loop: true,
      callback: () => {
        const t = getDayNightTint();
        this.dayNightOverlay.setFillStyle(t.color, t.alpha);
      },
    });

    // Fade in
    this.cameras.main.fadeIn(400);
  }

  protected spawnBunnies() {
    this.bunnyObjects.forEach(b => b.destroy());
    this.bunnyObjects = [];

    const alive = gameBunnies.filter(b => b.isAlive);
    const spacing = GAME_WIDTH / (alive.length + 1);

    alive.forEach((b, i) => {
      const bunny = new Bunny(this, spacing * (i + 1), GAME_HEIGHT / 2 + 40, b.id, b.name, b.color, b.stage as LifeStage);
      bunny.setDepth(3);
      bunny.setInteractable(() => {
        setSelectedBunny(b.id);
        // Notify HUD
        this.events.emit('bunnySelected', b.id);
        this.scene.get('HUDScene')?.events.emit('bunnySelected', b.id);
      });
      this.bunnyObjects.push(bunny);
    });
  }

  // Optimistic stat update
  protected applyAction(action: string, bunnyId: string) {
    const b = gameBunnies.find(x => x.id === bunnyId);
    if (!b) return;

    const playerName = this.registry.get('playerName') || 'Someone';
    const emojis: Record<string, string> = { feed: '🍳', clean: '🛁', play: '🎾', sleep: '💤', medicine: '💊', breed: '💕' };

    switch (action) {
      case 'feed': b.hunger = Math.min(100, b.hunger + 25); break;
      case 'clean': b.cleanliness = Math.min(100, b.cleanliness + 30); break;
      case 'play': b.happiness = Math.min(100, b.happiness + 20); break;
      case 'sleep': b.energy = Math.min(100, b.energy + 30); break;
      case 'medicine': b.health = Math.min(100, b.health + 20); break;
    }

    addActivity(`${playerName} ${action === 'feed' ? 'fed' : action === 'clean' ? 'cleaned' : action === 'play' ? 'played with' : action === 'sleep' ? 'put to sleep' : action === 'medicine' ? 'gave medicine to' : 'bred'} ${b.name} ${emojis[action] || ''}`);

    wsClient.sendAction(action, bunnyId);
  }

  // Call from HUD
  doAction(action: string) {
    if (!selectedBunnyId && gameBunnies.length > 0) {
      selectedBunnyId = gameBunnies[0].id;
    }
    if (!selectedBunnyId) return;

    this.applyAction(action, selectedBunnyId);

    // Switch room based on action
    const roomMap: Record<string, string> = {
      feed: 'KitchenScene',
      clean: 'BathroomScene',
      play: 'GardenScene',
      sleep: 'BedroomScene',
      medicine: 'VetScene',
      breed: 'NestScene',
    };

    const targetRoom = roomMap[action];
    if (targetRoom && targetRoom !== this.scene.key) {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(targetRoom);
      });
    } else {
      // Animate the selected bunny
      const bunnyObj = this.bunnyObjects.find(b => b.bunnyId === selectedBunnyId);
      if (bunnyObj) {
        switch (action) {
          case 'feed': bunnyObj.playEating(); this.time.delayedCall(2000, () => bunnyObj.startIdleBounce()); break;
          case 'sleep': bunnyObj.playSleeping(); this.time.delayedCall(3000, () => bunnyObj.startIdleBounce()); break;
          case 'play': bunnyObj.playPlaying(); this.time.delayedCall(2000, () => bunnyObj.startIdleBounce()); break;
          case 'clean': bunnyObj.playEating(); this.time.delayedCall(1500, () => bunnyObj.startIdleBounce()); break;
        }
      }
    }
  }
}

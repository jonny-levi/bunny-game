import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { Bunny } from '../objects/Bunny';
import { wsClient, type BunnyState } from '../network/WebSocketClient';
import { saveClient, type CareAction as SaveCareAction } from '../network/SaveClient';
import { getDayNightTint, getSeason } from '../utils/time';
import { getIdentities, type CharacterIdentity } from '../state/identityRegistry';
import { applyDecay, catchUpNeeds, legacyStatsFromNeeds, NEEDS_BALANCE, normalizeNeeds, readNeedsState, writeNeedsState, type NeedsState } from '../state/needs';
import type { LifeStage } from '../config';
import { isCareAction, type CareAction } from '../game/actions';
import { playBreed, playClean, playFeed, playMedicine, playPlay, playSleep } from '../utils/sound';

const PLAY_AREA_HEIGHT = 480; // Game area above toolbar
const MOVE_BOUNDS = { minX: 60, maxX: GAME_WIDTH - 60, minY: 120, maxY: PLAY_AREA_HEIGHT - 60 };
const ARROW_STEP = 14;

// Shared state
export let gameBunnies: BunnyState[] = [];
export let selectedBunnyId: string | null = null;
export let activityLog: string[] = [];

let localNeedsState: NeedsState = catchUpNeeds(readNeedsState());
writeNeedsState(localNeedsState);

function isServerBackedBunny(bunny: BunnyState): boolean {
  return bunny.id !== 'father' && bunny.id !== 'mother' && bunny.id !== 'baby';
}

function syncBabyNeedsToLocalState() {
  const baby = gameBunnies.find(b => (b.id === 'baby' || b.stage === 'baby') && !isServerBackedBunny(b));
  if (!baby) return;
  localNeedsState.needs = normalizeNeeds({
    hunger: baby.hunger,
    energy: baby.energy,
    cleanliness: baby.cleanliness,
    happiness: baby.happiness,
    health: baby.health,
  });
  localNeedsState.lastTick = Date.now();
  writeNeedsState(localNeedsState);
}

function applyLocalNeedsToBaby() {
  const baby = gameBunnies.find(b => (b.id === 'baby' || b.stage === 'baby') && !isServerBackedBunny(b));
  if (!baby) return;
  Object.assign(baby, legacyStatsFromNeeds(localNeedsState.needs));
}

export function setSelectedBunny(id: string | null) { selectedBunnyId = id; }
export function addActivity(msg: string) {
  activityLog.unshift(msg);
  if (activityLog.length > 20) activityLog.pop();
}

export function ensureDemoBunnies() {
  if (gameBunnies.length === 0) {
    gameBunnies = [
      { id: 'father', name: 'Mochi', color: 'white', pattern: null, stage: 'adult', hunger: 75, happiness: 80, cleanliness: 60, energy: 70, health: 85, isAlive: true, parentAId: null, parentBId: null },
      { id: 'mother', name: 'Luna', color: 'brown', pattern: null, stage: 'adult', hunger: 82, happiness: 88, cleanliness: 76, energy: 64, health: 90, isAlive: true, parentAId: null, parentBId: null },
      { id: 'baby', name: 'Boba', color: 'pink', pattern: null, stage: 'baby', ...legacyStatsFromNeeds(localNeedsState.needs), isAlive: true, parentAId: 'father', parentBId: 'mother' },
    ];
  }
}

wsClient.onState((state) => { gameBunnies = state.bunnies; syncBabyNeedsToLocalState(); });
wsClient.onEvent((event) => {
  if (event.message) addActivity(event.message);
  if (event.type === 'state' && event.bunnies) { gameBunnies = event.bunnies; syncBabyNeedsToLocalState(); }
});

export abstract class RoomScene extends Phaser.Scene {
  protected bunnyObjects: Bunny[] = [];
  protected dayNightOverlay!: Phaser.GameObjects.Rectangle;
  protected cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasdKeys?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

  abstract getRoomName(): string;
  abstract drawRoom(): void;

  create() {
    // Issue #42: every room must guarantee the HUD is up so a returning player
    // never lands on a background-only scene without navigation/actions.
    if (!this.scene.isActive('HUDScene')) {
      this.scene.launch('HUDScene');
    }

    ensureDemoBunnies();
    this.drawRoom();

    // Day/night overlay (only over play area)
    const tint = getDayNightTint();
    this.dayNightOverlay = this.add.rectangle(GAME_WIDTH / 2, PLAY_AREA_HEIGHT / 2, GAME_WIDTH, PLAY_AREA_HEIGHT, tint.color, tint.alpha);
    this.dayNightOverlay.setDepth(5);

    // Season indicator
    const season = getSeason();
    const seasonEmojis: Record<string, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
    this.add.text(GAME_WIDTH - 40, 8, seasonEmojis[season] || '', {
      fontSize: '20px',
    }).setDepth(6);

    applyLocalNeedsToBaby();
    this.spawnBunnies();

    this.time.addEvent({
      delay: NEEDS_BALANCE.tickMs,
      loop: true,
      callback: () => {
        localNeedsState = {
          needs: applyDecay(localNeedsState.needs, NEEDS_BALANCE.tickMs),
          lastTick: Date.now(),
        };
        writeNeedsState(localNeedsState);
        applyLocalNeedsToBaby();
      },
    });

    this.time.addEvent({
      delay: 60000,
      loop: true,
      callback: () => {
        const t = getDayNightTint();
        this.dayNightOverlay.setFillStyle(t.color, t.alpha);
      },
    });

    this.installKeyboardControls();
    this.cameras.main.fadeIn(350);
  }

  protected installKeyboardControls() {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cursors = kb.createCursorKeys();
    this.wasdKeys = kb.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  }

  update() {
    const target = this.bunnyObjects.find(b => b.bunnyId === selectedBunnyId) || this.bunnyObjects[0];
    if (!target) return;
    let dx = 0;
    let dy = 0;
    const c = this.cursors;
    const w = this.wasdKeys;
    if (c?.left?.isDown || w?.A?.isDown) dx -= ARROW_STEP;
    if (c?.right?.isDown || w?.D?.isDown) dx += ARROW_STEP;
    if (c?.up?.isDown || w?.W?.isDown) dy -= ARROW_STEP;
    if (c?.down?.isDown || w?.S?.isDown) dy += ARROW_STEP;
    if (dx === 0 && dy === 0) return;
    target.moveBy(dx, dy);
    target.x = Phaser.Math.Clamp(target.x, MOVE_BOUNDS.minX, MOVE_BOUNDS.maxX);
    target.y = Phaser.Math.Clamp(target.y, MOVE_BOUNDS.minY, MOVE_BOUNDS.maxY);
  }

  protected spawnBunnies() {
    this.bunnyObjects.forEach(b => b.destroy());
    this.bunnyObjects = [];

    const alive = gameBunnies.filter(b => b.isAlive);
    const groundY = PLAY_AREA_HEIGHT - 80;
    const spacing = (GAME_WIDTH - 100) / (alive.length + 1);

    const identities = getIdentities();
    const identityById: Record<string, CharacterIdentity | null> = {
      father: identities.father,
      mother: identities.mother,
      baby: identities.baby,
      b1: identities.father,
      b2: identities.baby,
    };

    alive.forEach((b, i) => {
      const bx = 50 + spacing * (i + 1);
      const bunny = new Bunny(this, bx, groundY, b.id, b.name, b.color, b.stage as LifeStage, identityById[b.id] ?? null);
      bunny.setDepth(3);
      const select = () => {
        setSelectedBunny(b.id);
        this.scene.get('HUDScene')?.events.emit('bunnySelected', b.id);
      };
      bunny.setDraggable(select, (x, y) => {
        bunny.x = Phaser.Math.Clamp(x, MOVE_BOUNDS.minX, MOVE_BOUNDS.maxX);
        bunny.y = Phaser.Math.Clamp(y, MOVE_BOUNDS.minY, MOVE_BOUNDS.maxY);
      });
      this.bunnyObjects.push(bunny);
    });

    // Auto-select first bunny so arrow keys work immediately.
    if (!selectedBunnyId && alive.length > 0) {
      setSelectedBunny(alive[0].id);
    }
  }

  protected async applyAction(action: CareAction, bunnyId: string) {
    const b = gameBunnies.find(x => x.id === bunnyId);
    if (!b) return;

    const playerName = this.registry.get('playerName') || 'Someone';
    const emojis: Record<CareAction, string> = { feed: '🍳', clean: '🛁', play: '🎾', sleep: '💤', medicine: '💊', breed: '💕' };

    switch (action) {
      case 'feed': playFeed(); break;
      case 'clean': playClean(); break;
      case 'play': playPlay(); break;
      case 'sleep': playSleep(); break;
      case 'medicine': playMedicine(); break;
      case 'breed': playBreed(); break;
    }

    const serverActionMap: Partial<Record<CareAction, SaveCareAction>> = { feed: 'feed', clean: 'bathe', play: 'play', sleep: 'sleep', medicine: 'vet' };
    const serverAction = serverActionMap[action];
    const serverSave = serverAction
      ? await saveClient.applyAction(serverAction).catch((err: unknown) => { console.warn('Server action failed, using local fallback', err); return null; })
      : null;

    if (serverSave) {
      b.hunger = serverSave.needs.hunger;
      b.cleanliness = serverSave.needs.hygiene;
      b.happiness = serverSave.needs.affection;
      b.energy = serverSave.needs.energy;
      b.health = serverSave.needs.health;
    } else {
      switch (action) {
        case 'feed': b.hunger = Math.min(100, b.hunger + 25); break;
        case 'clean': b.cleanliness = Math.min(100, b.cleanliness + 30); break;
        case 'play': b.happiness = Math.min(100, b.happiness + 20); b.energy = Math.max(0, b.energy - 8); break;
        case 'sleep': b.energy = Math.min(100, b.energy + 30); break;
        case 'medicine': b.health = Math.min(100, b.health + 20); break;
      }
    }

    if ((b.id === 'baby' || b.stage === 'baby') && !isServerBackedBunny(b)) {
      localNeedsState.needs = normalizeNeeds({
        hunger: b.hunger,
        energy: b.energy,
        cleanliness: b.cleanliness,
        happiness: b.happiness,
        health: b.health,
      });
      localNeedsState.lastTick = Date.now();
      writeNeedsState(localNeedsState);
    }

    const verbs: Record<CareAction, string> = {
      feed: 'fed',
      clean: 'bathed',
      play: 'played with',
      sleep: 'put to sleep',
      medicine: 'took to the vet',
      breed: 'bred',
    };
    addActivity(`${playerName} ${verbs[action]} ${b.name} ${emojis[action] || ''}`);
    wsClient.sendAction(action, bunnyId);
  }

  doAction(action: string) {
    if (!isCareAction(action)) return;
    if (!selectedBunnyId && gameBunnies.length > 0) {
      selectedBunnyId = gameBunnies[0].id;
    }
    if (!selectedBunnyId) return;

    this.applyAction(action, selectedBunnyId);

    const roomMap: Record<CareAction, string> = {
      feed: 'KitchenScene',
      clean: 'BathroomScene',
      play: 'GardenScene',
      sleep: 'BedroomScene',
      medicine: 'VetScene',
      breed: 'NestScene',
    };

    const targetRoom = roomMap[action];
    if (targetRoom && targetRoom !== this.scene.key) {
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(targetRoom);
      });
    } else {
      const bunnyObj = this.bunnyObjects.find(b => b.bunnyId === selectedBunnyId);
      if (bunnyObj) {
        switch (action) {
          case 'feed': bunnyObj.playEating(); this.time.delayedCall(2000, () => bunnyObj.startIdleBounce()); break;
          case 'sleep': bunnyObj.playSleeping(); this.time.delayedCall(3000, () => bunnyObj.startIdleBounce()); break;
          case 'play': bunnyObj.playPlaying(); this.time.delayedCall(2000, () => bunnyObj.startIdleBounce()); break;
          case 'clean': bunnyObj.playPlaying(); this.time.delayedCall(1500, () => bunnyObj.startIdleBounce()); break;
          case 'medicine': bunnyObj.playPlaying(); this.time.delayedCall(1500, () => bunnyObj.startIdleBounce()); break;
        }
      }
    }
  }
}

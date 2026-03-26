export type LifeStage = 'egg' | 'baby' | 'teen' | 'adult' | 'elder';
export type DeathCause = 'starvation' | 'neglect' | 'old_age';
export type BunnyColor = 'white' | 'brown' | 'grey' | 'spotted' | 'black' | 'pink';
export type BunnyPattern = 'none' | 'spots' | 'stripes';
export type ActionType = 'feed' | 'clean' | 'play' | 'sleep' | 'medicine' | 'breed';

export interface BunnyStats {
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
  health: number;
}

export interface Bunny {
  id: string;
  familyId: string;
  name: string;
  color: BunnyColor;
  pattern: BunnyPattern;
  stage: LifeStage;
  stageStartedAt: string; // ISO timestamp
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
  health: number;
  lastUpdated: string;
  hungerZeroSince: string | null;
  healthCriticalSince: string | null;
  parentAId: string | null;
  parentBId: string | null;
  isAlive: boolean;
  diedAt: string | null;
  deathCause: DeathCause | null;
  createdAt: string;
}

export interface Player {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  players: Player[];
  bunnies: Bunny[];
  createdAt: string;
}

export interface ActivityLogEntry {
  id: number;
  familyId: string;
  playerId: string;
  bunnyId: string;
  action: ActionType;
  message: string;
  createdAt: string;
}

// WebSocket messages: Client → Server
export type ClientMessage =
  | { type: 'action'; action: ActionType; bunnyId: string; playerId: string; targetBunnyId?: string }
  | { type: 'ping' };

// WebSocket messages: Server → Client
export type ServerMessage =
  | { type: 'state'; family: Family; timestamp: number }
  | { type: 'event'; entry: ActivityLogEntry }
  | { type: 'death'; bunnyId: string; bunnyName: string; cause: DeathCause }
  | { type: 'birth'; bunny: Bunny }
  | { type: 'stage_change'; bunnyId: string; bunnyName: string; newStage: LifeStage }
  | { type: 'tick'; bunnies: Bunny[]; timestamp: number }
  | { type: 'error'; message: string }
  | { type: 'pong' };

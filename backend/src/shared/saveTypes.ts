export type SaveRole = 'father' | 'mother' | 'baby';

export interface SaveIdentity {
  role: SaveRole;
  identityIndex: number;
}

export interface SaveEgg {
  taps: number;
  hatched: boolean;
  seed: number;
}

export interface SaveNeeds {
  hunger: number;
  energy: number;
  hygiene: number;
  affection: number;
  health: number;
}

export interface PlayerSave {
  version: 1;
  userId: string;
  father: SaveIdentity | null;
  mother: SaveIdentity | null;
  baby: SaveIdentity | null;
  egg: SaveEgg;
  needs: SaveNeeds;
  lastTick: string;
  updatedAt: string;
}

export type CareAction = 'feed' | 'sleep' | 'bathe' | 'play' | 'vet';

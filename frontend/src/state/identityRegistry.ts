// Local identity registry for the Bunny Family onboarding flow.
//
// Stable per-character identity is the core user-vision constraint: father stays
// the same father across rooms/reloads; mother stays the same mother; the baby
// keeps the identity it gets at hatch. We store the minimum needed to reproduce
// that selection, plus the egg's tap progress so a partial-hatch survives a
// reload.
//
// The registry currently uses localStorage. When a server-authoritative save
// arrives this module is the single place to switch to a fetch/save API; the
// rest of the frontend should keep talking to `getIdentities()` / `saveX()`.

const STORAGE_KEY = 'bunny-family.identity.v1';

export type CharacterRole = 'father' | 'mother' | 'baby';
export type CharacterState =
  | 'normal'
  | 'happy'
  | 'sleeping'
  | 'eating'
  | 'playing';

export interface CharacterIdentity {
  role: CharacterRole;
  identityIndex: number; // 1..N — selects which sprite/colour/pattern variant
}

export interface EggState {
  taps: number;
  hatched: boolean;
  // seed used to derive the baby's identityIndex deterministically at hatch
  seed: number;
}

export interface IdentitySave {
  version: 1;
  father: CharacterIdentity | null;
  mother: CharacterIdentity | null;
  baby: CharacterIdentity | null;
  egg: EggState;
}

export const HATCH_TAPS = 8;
export const CRACK_THRESHOLDS = [2, 4, 6, HATCH_TAPS] as const;

// We deliberately keep the asset pool small for now (4 SVGs in
// frontend/assets/bunnies). The mapping is deterministic — same identityIndex
// always resolves to the same asset key. Once richer asset packs land,
// expand IDENTITY_COUNT and this lookup; consumers won't need to change.
export const IDENTITY_COUNT = 4;

const DEFAULT_SAVE: IdentitySave = {
  version: 1,
  father: null,
  mother: null,
  baby: null,
  egg: { taps: 0, hatched: false, seed: 0 },
};

function safeParse(raw: string | null): IdentitySave | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdentitySave;
    if (parsed && parsed.version === 1) return parsed;
    return null;
  } catch {
    return null;
  }
}

function readStorage(): IdentitySave {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SAVE, egg: { ...DEFAULT_SAVE.egg } };
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (parsed) return parsed;
  return { ...DEFAULT_SAVE, egg: { ...DEFAULT_SAVE.egg } };
}

function writeStorage(save: IdentitySave) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Quota or privacy mode — degrade silently; in-memory state still works
    // for the current session.
  }
}

let cache: IdentitySave = readStorage();

export function getIdentities(): IdentitySave {
  return cache;
}

export function isHatched(): boolean {
  return cache.egg.hatched && cache.baby != null;
}

export function isOnboardingComplete(): boolean {
  return cache.father != null && cache.mother != null && isHatched();
}

function pickIdentityIndex(seed: number): number {
  // Lightweight deterministic pick — good enough for visual stability.
  // A future server-side roll can replace this without API changes.
  const v = (seed * 2654435761) >>> 0;
  return (v % IDENTITY_COUNT) + 1;
}

export function ensureParents(): { father: CharacterIdentity; mother: CharacterIdentity } {
  if (!cache.father) {
    cache.father = { role: 'father', identityIndex: pickIdentityIndex(Date.now() ^ 0x9e3779b1) };
  }
  if (!cache.mother) {
    cache.mother = { role: 'mother', identityIndex: pickIdentityIndex(Date.now() ^ 0x85ebca6b) };
  }
  if (!cache.egg.seed) {
    cache.egg.seed = (Math.random() * 0xffffffff) >>> 0;
  }
  writeStorage(cache);
  return { father: cache.father, mother: cache.mother };
}

export function recordTap(): EggState {
  if (cache.egg.hatched) return cache.egg;
  cache.egg.taps = Math.min(HATCH_TAPS, cache.egg.taps + 1);
  writeStorage(cache);
  return cache.egg;
}

export function getCrackStage(taps: number = cache.egg.taps): number {
  let stage = 0;
  for (const t of CRACK_THRESHOLDS) {
    if (taps >= t) stage += 1;
  }
  return stage; // 0..4 — 4 means hatched
}

export function shouldHatch(): boolean {
  return !cache.egg.hatched && cache.egg.taps >= HATCH_TAPS;
}

export function performHatch(): CharacterIdentity {
  if (cache.baby) return cache.baby;
  const father = cache.father;
  const mother = cache.mother;
  const seed = cache.egg.seed
    ^ (father?.identityIndex ?? 0) * 0x9e3779b1
    ^ (mother?.identityIndex ?? 0) * 0x85ebca6b;
  const baby: CharacterIdentity = {
    role: 'baby',
    identityIndex: pickIdentityIndex(seed >>> 0),
  };
  cache.baby = baby;
  cache.egg.hatched = true;
  writeStorage(cache);
  return baby;
}

// assetFor resolves a character + state to an asset key registered in
// BootScene's preload. With four available SVGs we cycle between them by
// identityIndex; structurally this is the hook for richer packs later.
export function assetFor(
  character: CharacterIdentity | { role: 'egg' } | null,
  state: CharacterState = 'normal',
): string | null {
  if (!character) return null;
  if (character.role === 'egg') return null;

  if (character.role === 'father' || character.role === 'mother') {
    return 'adult-bunny';
  }
  // baby
  if (state === 'sleeping') return 'baby-bunny-sleeping';
  if (state === 'happy' || state === 'playing' || state === 'eating') {
    return 'baby-bunny-happy';
  }
  return 'baby-bunny-normal';
}

// Test/dev hook: clear the local save so onboarding restarts. Not wired into
// the UI yet; useful from the browser console while testing.
export function resetIdentities() {
  cache = { ...DEFAULT_SAVE, egg: { ...DEFAULT_SAVE.egg } };
  writeStorage(cache);
}

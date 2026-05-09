// Local identity registry for the Bunny Family onboarding flow.
//
// The server save is authoritative when available; localStorage remains as an
// offline/demo fallback so the game still works while the backend is down.

const STORAGE_KEY = '***';

export type CharacterRole = 'father' | 'mother' | 'baby';
export type CharacterState =
  | 'normal'
  | 'happy'
  | 'sleeping'
  | 'eating'
  | 'playing';

export type AssetKind = 'adult' | 'baby';
export type BabyAssetState = 'normal' | 'happy' | 'sleeping';

export interface CharacterIdentity {
  role: CharacterRole;
  identityIndex: number; // 1..100 — selects which sprite variant
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

export interface BunnyAssetRef {
  key: string;
  path: string;
  kind: AssetKind;
  index: number;
  state?: BabyAssetState;
}

export const HATCH_TAPS = 8;
export const CRACK_THRESHOLDS = [2, 4, 6, HATCH_TAPS] as const;
export const IDENTITY_COUNT = 100;

const DEFAULT_SAVE: IdentitySave = {
  version: 1,
  father: null,
  mother: null,
  baby: null,
  egg: { taps: 0, hatched: false, seed: 0 },
};

function cloneDefaultSave(): IdentitySave {
  return {
    ...DEFAULT_SAVE,
    egg: { ...DEFAULT_SAVE.egg },
  };
}

function cloneSave(save: IdentitySave): IdentitySave {
  return {
    version: 1,
    father: save.father ? { ...save.father } : null,
    mother: save.mother ? { ...save.mother } : null,
    baby: save.baby ? { ...save.baby } : null,
    egg: { ...save.egg },
  };
}

function clampIdentityIndex(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > IDENTITY_COUNT) return null;
  return value;
}

function sanitizeIdentity(value: unknown, role: CharacterRole): CharacterIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CharacterIdentity>;
  if (candidate.role !== role) return null;
  const identityIndex = clampIdentityIndex(candidate.identityIndex);
  if (identityIndex == null) return null;
  return { role, identityIndex };
}

function sanitizeEgg(value: unknown): EggState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SAVE.egg };
  const candidate = value as Partial<EggState>;
  const taps = typeof candidate.taps === 'number'
    ? Math.max(0, Math.min(HATCH_TAPS, Math.trunc(candidate.taps)))
    : 0;
  const seed = typeof candidate.seed === 'number' && Number.isFinite(candidate.seed)
    ? candidate.seed >>> 0
    : 0;
  return { taps, seed, hatched: candidate.hatched === true };
}

function safeParse(raw: string | null): IdentitySave | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IdentitySave>;
    if (!parsed || parsed.version !== 1) return null;
    const father = sanitizeIdentity(parsed.father, 'father');
    const mother = sanitizeIdentity(parsed.mother, 'mother');
    const baby = sanitizeIdentity(parsed.baby, 'baby');
    const egg = sanitizeEgg(parsed.egg);
    return { version: 1, father, mother, baby, egg };
  } catch {
    return null;
  }
}

function readStorage(): IdentitySave {
  if (typeof localStorage === 'undefined') return cloneDefaultSave();
  return safeParse(localStorage.getItem(STORAGE_KEY)) ?? cloneDefaultSave();
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

export function hydrateIdentities(save: IdentitySave | null | undefined) {
  if (!save) return;
  cache = cloneSave(save);
  writeStorage(cache);
}

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

export function performHatch(serverBaby?: CharacterIdentity | null): CharacterIdentity {
  if (cache.baby) return cache.baby;
  const father = cache.father;
  const mother = cache.mother;
  const seed = cache.egg.seed
    ^ (father?.identityIndex ?? 0) * 0x9e3779b1
    ^ (mother?.identityIndex ?? 0) * 0x85ebca6b;
  const baby: CharacterIdentity = serverBaby ?? {
    role: 'baby',
    identityIndex: pickIdentityIndex(seed >>> 0),
  };
  cache.baby = baby;
  cache.egg.hatched = true;
  cache.egg.taps = HATCH_TAPS;
  writeStorage(cache);
  return baby;
}

function babyAssetStateFor(state: CharacterState): BabyAssetState {
  if (state === 'sleeping') return 'sleeping';
  if (state === 'happy' || state === 'playing' || state === 'eating') return 'happy';
  return 'normal';
}

function validIndex(index: number): number {
  return clampIdentityIndex(index) ?? 1;
}

export function bunnyAssetKey(kind: AssetKind, index: number, state?: BabyAssetState): string {
  const safeIndex = validIndex(index);
  if (kind === 'adult') return `bunny-adult-${safeIndex}`;
  return `bunny-baby-${state ?? 'normal'}-${safeIndex}`;
}

export function bunnyAssetPath(kind: AssetKind, index: number, state?: BabyAssetState): string {
  const safeIndex = validIndex(index);
  if (kind === 'adult') return `/assets/bunnies/adult/${safeIndex}.svg`;
  return `/assets/bunnies/baby/${state ?? 'normal'}/${safeIndex}.svg`;
}

export function bunnyAssetRef(kind: AssetKind, index: number, state?: BabyAssetState): BunnyAssetRef {
  const safeIndex = validIndex(index);
  const safeState = kind === 'baby' ? (state ?? 'normal') : undefined;
  return {
    key: bunnyAssetKey(kind, safeIndex, safeState),
    path: bunnyAssetPath(kind, safeIndex, safeState),
    kind,
    index: safeIndex,
    state: safeState,
  };
}

// assetFor resolves a character + state to a validated, deterministic asset ref.
// It constructs paths only from a constrained kind/index/state tuple; no caller
// supplied path can reach the loader.
export function assetFor(
  character: CharacterIdentity | { role: 'egg' } | null,
  state: CharacterState = 'normal',
): BunnyAssetRef | null {
  if (!character || character.role === 'egg') return null;

  if (character.role === 'father' || character.role === 'mother') {
    return bunnyAssetRef('adult', character.identityIndex);
  }

  return bunnyAssetRef('baby', character.identityIndex, babyAssetStateFor(state));
}

export function fallbackAssets(): BunnyAssetRef[] {
  return [
    bunnyAssetRef('adult', 1),
    bunnyAssetRef('baby', 1, 'normal'),
    bunnyAssetRef('baby', 1, 'happy'),
    bunnyAssetRef('baby', 1, 'sleeping'),
  ];
}

export function currentIdentityAssets(): BunnyAssetRef[] {
  const refs: BunnyAssetRef[] = [...fallbackAssets()];
  for (const identity of [cache.father, cache.mother, cache.baby]) {
    if (!identity) continue;
    if (identity.role === 'baby') {
      refs.push(
        bunnyAssetRef('baby', identity.identityIndex, 'normal'),
        bunnyAssetRef('baby', identity.identityIndex, 'happy'),
        bunnyAssetRef('baby', identity.identityIndex, 'sleeping'),
      );
    } else {
      refs.push(bunnyAssetRef('adult', identity.identityIndex));
    }
  }
  const unique = new Map<string, BunnyAssetRef>();
  refs.forEach((ref) => unique.set(ref.key, ref));
  return [...unique.values()];
}

// Test/dev hook: clear the local save so onboarding restarts. Not wired into
// the UI yet; useful from the browser console while testing.
export function resetIdentities() {
  cache = cloneDefaultSave();
  writeStorage(cache);
}

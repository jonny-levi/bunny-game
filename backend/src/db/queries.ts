import { pool } from './pool';
import type { Bunny, Player, Family, ActivityLogEntry } from '../shared/types';
import type { PlayerSave, SaveIdentity, SaveNeeds } from '../shared/saveTypes';
import { defaultSave, normalizeNeeds } from '../game/save';

// Row mappers
function mapBunny(row: any): Bunny {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    color: row.color,
    pattern: row.pattern,
    stage: row.stage,
    stageStartedAt: row.stage_started_at?.toISOString(),
    hunger: row.hunger,
    happiness: row.happiness,
    cleanliness: row.cleanliness,
    energy: row.energy,
    health: row.health,
    lastUpdated: row.last_updated?.toISOString(),
    hungerZeroSince: row.hunger_zero_since?.toISOString() ?? null,
    healthCriticalSince: row.health_critical_since?.toISOString() ?? null,
    parentAId: row.parent_a_id,
    parentBId: row.parent_b_id,
    isAlive: row.is_alive,
    diedAt: row.died_at?.toISOString() ?? null,
    deathCause: row.death_cause,
    createdAt: row.created_at?.toISOString(),
  };
}

function mapPlayer(row: any): Player {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    createdAt: row.created_at?.toISOString(),
  };
}

// Family
export async function getOrCreateFamily(name: string): Promise<string> {
  const existing = await pool.query('SELECT id FROM families LIMIT 1');
  if (existing.rows.length > 0) return existing.rows[0].id;
  const res = await pool.query('INSERT INTO families (name) VALUES ($1) RETURNING id', [name]);
  return res.rows[0].id;
}

export async function getFamily(familyId: string): Promise<Family | null> {
  const fam = await pool.query('SELECT * FROM families WHERE id = $1', [familyId]);
  if (fam.rows.length === 0) return null;

  const [playersRes, bunniesRes] = await Promise.all([
    pool.query('SELECT * FROM players WHERE family_id = $1 ORDER BY created_at', [familyId]),
    pool.query('SELECT * FROM bunnies WHERE family_id = $1 ORDER BY created_at', [familyId]),
  ]);

  return {
    id: fam.rows[0].id,
    name: fam.rows[0].name,
    players: playersRes.rows.map(mapPlayer),
    bunnies: bunniesRes.rows.map(mapBunny),
    createdAt: fam.rows[0].created_at?.toISOString(),
  };
}

// Players
export async function getPlayerById(playerId: string): Promise<Player | null> {
  const res = await pool.query('SELECT * FROM players WHERE id = $1', [playerId]);
  return res.rows.length > 0 ? mapPlayer(res.rows[0]) : null;
}

export async function getOrCreatePlayer(familyId: string, name: string): Promise<Player> {
  const existing = await pool.query('SELECT * FROM players WHERE name = $1', [name]);
  if (existing.rows.length > 0) return mapPlayer(existing.rows[0]);
  const res = await pool.query(
    'INSERT INTO players (family_id, name) VALUES ($1, $2) RETURNING *',
    [familyId, name]
  );
  return mapPlayer(res.rows[0]);
}

// Bunnies
export async function getAliveBunnies(familyId: string): Promise<Bunny[]> {
  const res = await pool.query(
    'SELECT * FROM bunnies WHERE family_id = $1 AND is_alive = TRUE ORDER BY created_at',
    [familyId]
  );
  return res.rows.map(mapBunny);
}

export async function getAllBunnies(familyId: string): Promise<Bunny[]> {
  const res = await pool.query(
    'SELECT * FROM bunnies WHERE family_id = $1 ORDER BY created_at',
    [familyId]
  );
  return res.rows.map(mapBunny);
}

export async function insertBunny(b: Partial<Bunny> & { familyId: string; name: string; color: string; pattern: string }): Promise<Bunny> {
  const res = await pool.query(
    `INSERT INTO bunnies (family_id, name, color, pattern, stage, hunger, happiness, cleanliness, energy, health, parent_a_id, parent_b_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      b.familyId, b.name, b.color, b.pattern, b.stage || 'egg',
      b.hunger ?? 100, b.happiness ?? 100, b.cleanliness ?? 100, b.energy ?? 100, b.health ?? 100,
      b.parentAId ?? null, b.parentBId ?? null,
    ]
  );
  return mapBunny(res.rows[0]);
}

export async function updateBunny(bunny: Bunny): Promise<void> {
  await pool.query(
    `UPDATE bunnies SET
      hunger=$2, happiness=$3, cleanliness=$4, energy=$5, health=$6,
      stage=$7, stage_started_at=$8, last_updated=$9,
      hunger_zero_since=$10, health_critical_since=$11,
      is_alive=$12, died_at=$13, death_cause=$14
     WHERE id=$1`,
    [
      bunny.id, bunny.hunger, bunny.happiness, bunny.cleanliness, bunny.energy, bunny.health,
      bunny.stage, bunny.stageStartedAt, bunny.lastUpdated,
      bunny.hungerZeroSince, bunny.healthCriticalSince,
      bunny.isAlive, bunny.diedAt, bunny.deathCause,
    ]
  );
}

// Activity log
export async function addActivity(
  familyId: string, playerId: string, bunnyId: string, action: string, message: string
): Promise<ActivityLogEntry> {
  const res = await pool.query(
    'INSERT INTO activity_log (family_id, player_id, bunny_id, action, message) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [familyId, playerId, bunnyId, action, message]
  );
  const r = res.rows[0];
  return {
    id: r.id, familyId: r.family_id, playerId: r.player_id, bunnyId: r.bunny_id,
    action: r.action, message: r.message, createdAt: r.created_at?.toISOString(),
  };
}

export async function getRecentActivity(familyId: string, limit = 50): Promise<ActivityLogEntry[]> {
  const res = await pool.query(
    'SELECT * FROM activity_log WHERE family_id = $1 ORDER BY created_at DESC LIMIT $2',
    [familyId, limit]
  );
  return res.rows.map((r: any) => ({
    id: r.id, familyId: r.family_id, playerId: r.player_id, bunnyId: r.bunny_id,
    action: r.action, message: r.message, createdAt: r.created_at?.toISOString(),
  }));
}


function identity(role: 'father' | 'mother' | 'baby', index: unknown): SaveIdentity | null {
  const n = Number(index);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? { role, identityIndex: n } : null;
}

function mapPlayerSave(row: any, playerId: string): PlayerSave {
  if (!row) return defaultSave(playerId);
  return {
    version: 1,
    userId: playerId,
    father: identity('father', row.father_identity),
    mother: identity('mother', row.mother_identity),
    baby: identity('baby', row.baby_identity),
    egg: {
      taps: Number(row.egg_taps ?? 0),
      hatched: row.egg_hatched === true,
      seed: Number(row.egg_seed ?? 0),
    },
    needs: normalizeNeeds({
      hunger: Number(row.hunger),
      energy: Number(row.energy),
      hygiene: Number(row.hygiene),
      affection: Number(row.affection),
      health: Number(row.health),
    }),
    lastTick: row.last_tick?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function getOrCreatePlayerSave(playerId: string): Promise<PlayerSave> {
  await pool.query(
    `INSERT INTO player_saves (player_id)
     VALUES ($1)
     ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
  const res = await pool.query('SELECT * FROM player_saves WHERE player_id = $1', [playerId]);
  return mapPlayerSave(res.rows[0], playerId);
}

export async function updatePlayerSave(playerId: string, patch: {
  father?: SaveIdentity | null;
  mother?: SaveIdentity | null;
  baby?: SaveIdentity | null;
  egg?: { taps: number; hatched: boolean; seed: number };
  needs?: SaveNeeds;
  lastTick?: Date;
}): Promise<PlayerSave> {
  await getOrCreatePlayerSave(playerId);
  const res = await pool.query(
    `UPDATE player_saves SET
      father_identity = COALESCE($2, father_identity),
      mother_identity = COALESCE($3, mother_identity),
      baby_identity = COALESCE($4, baby_identity),
      egg_taps = COALESCE($5, egg_taps),
      egg_hatched = COALESCE($6, egg_hatched),
      egg_seed = COALESCE($7, egg_seed),
      hunger = COALESCE($8, hunger),
      energy = COALESCE($9, energy),
      hygiene = COALESCE($10, hygiene),
      affection = COALESCE($11, affection),
      health = COALESCE($12, health),
      last_tick = COALESCE($13, last_tick),
      updated_at = NOW()
     WHERE player_id = $1
     RETURNING *`,
    [
      playerId,
      patch.father?.identityIndex ?? null,
      patch.mother?.identityIndex ?? null,
      patch.baby?.identityIndex ?? null,
      patch.egg?.taps ?? null,
      patch.egg?.hatched ?? null,
      patch.egg?.seed ?? null,
      patch.needs?.hunger ?? null,
      patch.needs?.energy ?? null,
      patch.needs?.hygiene ?? null,
      patch.needs?.affection ?? null,
      patch.needs?.health ?? null,
      patch.lastTick ?? null,
    ],
  );
  return mapPlayerSave(res.rows[0], playerId);
}

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bunnies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'white',
  pattern VARCHAR(20) NOT NULL DEFAULT 'none',
  stage VARCHAR(10) NOT NULL DEFAULT 'egg',
  stage_started_at TIMESTAMPTZ DEFAULT NOW(),
  hunger SMALLINT NOT NULL DEFAULT 100,
  happiness SMALLINT NOT NULL DEFAULT 100,
  cleanliness SMALLINT NOT NULL DEFAULT 100,
  energy SMALLINT NOT NULL DEFAULT 100,
  health SMALLINT NOT NULL DEFAULT 100,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  hunger_zero_since TIMESTAMPTZ,
  health_critical_since TIMESTAMPTZ,
  parent_a_id UUID REFERENCES bunnies(id) ON DELETE SET NULL,
  parent_b_id UUID REFERENCES bunnies(id) ON DELETE SET NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  died_at TIMESTAMPTZ,
  death_cause VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  bunny_id UUID REFERENCES bunnies(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bunnies_family_alive ON bunnies(family_id) WHERE is_alive = TRUE;
CREATE INDEX IF NOT EXISTS idx_activity_family_time ON activity_log(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_family ON players(family_id);

CREATE TABLE IF NOT EXISTS player_saves (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  father_identity SMALLINT CHECK (father_identity BETWEEN 1 AND 100),
  mother_identity SMALLINT CHECK (mother_identity BETWEEN 1 AND 100),
  baby_identity SMALLINT CHECK (baby_identity BETWEEN 1 AND 100),
  egg_taps SMALLINT NOT NULL DEFAULT 0 CHECK (egg_taps BETWEEN 0 AND 8),
  egg_hatched BOOLEAN NOT NULL DEFAULT FALSE,
  egg_seed BIGINT NOT NULL DEFAULT 0,
  hunger NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (hunger BETWEEN 0 AND 100),
  energy NUMERIC(5,2) NOT NULL DEFAULT 70 CHECK (energy BETWEEN 0 AND 100),
  hygiene NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (hygiene BETWEEN 0 AND 100),
  affection NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (affection BETWEEN 0 AND 100),
  health NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (health BETWEEN 0 AND 100),
  last_tick TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_saves_updated ON player_saves(updated_at DESC);

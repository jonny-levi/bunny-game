CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bunnies (
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

CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  bunny_id UUID REFERENCES bunnies(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bunnies_family_alive ON bunnies(family_id) WHERE is_alive = TRUE;
CREATE INDEX idx_activity_family_time ON activity_log(family_id, created_at DESC);
CREATE INDEX idx_players_family ON players(family_id);

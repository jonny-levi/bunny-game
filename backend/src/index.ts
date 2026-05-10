import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import path from 'path';
import { config } from './config';
import { pool } from './db/pool';
import * as db from './db/queries';
import { connectRedis, disconnectRedis } from './cache/redis';
import { handleConnection } from './ws/handler';
import { stopAllTicks } from './game/tick';
import { generateBunnyName } from './game/names';
import { catchUpFamily } from './game/tick';
import { broadcastToFamily } from './ws/rooms';
import { applyAction as applySaveAction, applyDecay as applySaveDecay, deriveBabyIdentity, sanitizeEgg, sanitizeIdentity } from './game/save';
import type { CareAction } from './shared/saveTypes';

const app = express();
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health check
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// Login: POST /login { name: "Jonny" }
app.post('/login', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim();
    const familyId = await db.getOrCreateFamily(config.familyName);
    const player = await db.getOrCreatePlayer(familyId, trimmedName);

    // Ensure family has at least 1 bunny (egg)
    const bunnies = await db.getAllBunnies(familyId);
    if (bunnies.length === 0) {
      await db.insertBunny({
        familyId,
        name: generateBunnyName(),
        color: 'white',
        pattern: 'none',
        stage: 'egg',
      });
    }

    // Catch up decay
    await catchUpFamily(familyId, broadcastToFamily);
    const family = await db.getFamily(familyId);

    res.json({ player, family });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requirePlayer(req: express.Request, res: express.Response) {
  const userId = req.header('x-player-id') || req.query.userId;
  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'x-player-id header is required' });
    return null;
  }

  if (!isUuid(userId)) {
    res.status(404).json({ error: 'Player not found' });
    return null;
  }

  const player = await db.getPlayerById(userId);
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return null;
  }
  return player;
}

async function getCaughtUpSave(playerId: string) {
  const save = await db.getOrCreatePlayerSave(playerId);
  const now = new Date();
  const lastTick = new Date(save.lastTick).getTime();
  const needs = applySaveDecay(save.needs, now.getTime() - lastTick);
  return db.updatePlayerSave(playerId, { needs, lastTick: now });
}

app.get('/api/save', async (req, res) => {
  try {
    const player = await requirePlayer(req, res);
    if (!player) return;
    res.json(await getCaughtUpSave(player.id));
  } catch (err: any) {
    console.error('Save fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/save/needs', async (req, res) => {
  try {
    const player = await requirePlayer(req, res);
    if (!player) return;
    const action = req.body?.action as CareAction | undefined;
    if (action && !['feed', 'sleep', 'bathe', 'play', 'vet'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action' });
    }
    const caughtUp = await getCaughtUpSave(player.id);
    const now = new Date();
    const needs = action ? applySaveAction(caughtUp.needs, action) : caughtUp.needs;
    const save = await db.updatePlayerSave(player.id, { needs, lastTick: now });
    res.json(save);
  } catch (err: any) {
    console.error('Save needs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/save/hatch', async (req, res) => {
  try {
    const player = await requirePlayer(req, res);
    if (!player) return;
    const save = await getCaughtUpSave(player.id);
    if (save.egg.hatched || save.baby) {
      return res.status(409).json({ error: 'Egg already hatched', save });
    }

    const father = sanitizeIdentity(req.body?.father, 'father') ?? save.father;
    const mother = sanitizeIdentity(req.body?.mother, 'mother') ?? save.mother;
    const requestedEgg = sanitizeEgg(req.body?.egg ?? save.egg);
    const egg = {
      ...requestedEgg,
      taps: Math.max(save.egg.taps, requestedEgg.taps),
      seed: requestedEgg.seed || save.egg.seed,
      hatched: false,
    };

    if (!father || !mother || egg.taps < 8) {
      return res.status(400).json({ error: 'Father, mother, and 8 egg taps are required' });
    }

    egg.hatched = true;
    egg.taps = 8;
    const baby = deriveBabyIdentity(father, mother, egg.seed);
    const updated = await db.updatePlayerSave(player.id, { father, mother, baby, egg, lastTick: new Date() });
    res.json(updated);
  } catch (err: any) {
    console.error('Save hatch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get family state
app.get('/family/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await catchUpFamily(id, broadcastToFamily);
    const family = await db.getFamily(id);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.json(family);
  } catch (err: any) {
    console.error('Family fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recent activity
app.get('/family/:id/activity', async (req, res) => {
  try {
    const entries = await db.getRecentActivity(req.params.id, 50);
    res.json(entries);
  } catch (err: any) {
    console.error('Activity fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA fallback for the bundled frontend. Keep API/WS routes above this.
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let familyId = url.searchParams.get('familyId') || '';
  let playerId = url.searchParams.get('playerId') || '';
  const playerName = url.searchParams.get('playerName') || 'Anonymous';

  // If no familyId/playerId, try to create/find them (graceful fallback)
  if (!familyId || !playerId) {
    try {
      familyId = await db.getOrCreateFamily(config.familyName);
      const player = await db.getOrCreatePlayer(familyId, playerName);
      playerId = player.id;

      // Ensure at least 1 bunny
      const bunnies = await db.getAllBunnies(familyId);
      if (bunnies.length === 0) {
        await db.insertBunny({
          familyId,
          name: generateBunnyName(),
          color: 'white',
          pattern: 'none',
          stage: 'egg',
        });
      }
      console.log(`🔌 ${playerName} auto-joined family ${familyId}`);
    } catch (err) {
      console.error('WS auto-join failed:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to join family' }));
      ws.close();
      return;
    }
  } else {
    try {
      const player = await db.getPlayerById(playerId);
      if (!player || player.familyId !== familyId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Player is not allowed to access this save' }));
        ws.close();
        return;
      }
      console.log(`🔌 ${playerName} connected to family ${familyId}`);
    } catch (err) {
      console.error('WS ownership check failed:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to validate player' }));
      ws.close();
      return;
    }
  }

  handleConnection(ws, familyId, playerId, playerName);
});

// Startup
async function runMigrations() {
  const fs = await import('fs');
  const path = await import('path');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'migrations', '001_init.sql'), 'utf-8');
    await pool.query(sql);
    console.log('✅ Migration complete');
  } catch (err: any) {
    if (err.code === '42P07') {
      console.log('⏭️  Tables already exist');
    } else {
      throw err;
    }
  }
}

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
    await runMigrations();
    await connectRedis();

    server.listen(config.port, () => {
      console.log(`🐰 Bunny Family backend running on port ${config.port}`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  stopAllTicks();
  server.close();
  wss.close();
  await disconnectRedis();
  await pool.end();
  console.log('👋 Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

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
    console.log(`🔌 ${playerName} connected to family ${familyId}`);
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

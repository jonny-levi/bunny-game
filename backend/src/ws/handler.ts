import WebSocket from 'ws';
import type { ActionType, ClientMessage } from '../shared/types';
import { performAction } from '../game/actions';
import { catchUpFamily, startFamilyTick, stopFamilyTick } from '../game/tick';
import { getPlayerFromWs, broadcastToFamily, joinRoom, leaveRoom, getRoomSize } from './rooms';
import * as db from '../db/queries';

const VALID_ACTIONS = new Set<ActionType>(['feed', 'clean', 'play', 'sleep', 'medicine', 'breed']);
const ACTION_COOLDOWN_MS: Record<ActionType, number> = {
  feed: 1_500,
  clean: 1_500,
  play: 1_500,
  sleep: 2_500,
  medicine: 10_000,
  breed: 10_000,
};
const MAX_ACTIONS_PER_WINDOW = 12;
const ACTION_WINDOW_MS = 10_000;

interface RateState {
  lastByKey: Map<string, number>;
  windowStart: number;
  count: number;
}

const rateStates = new WeakMap<WebSocket, RateState>();

export function handleConnection(ws: WebSocket, familyId: string, playerId: string, playerName: string) {
  joinRoom(ws, { ws, playerId, playerName, familyId });
  rateStates.set(ws, { lastByKey: new Map(), windowStart: Date.now(), count: 0 });

  // Catch up decay and send initial state
  catchUpFamily(familyId, broadcastToFamily).then(async () => {
    const family = await db.getFamily(familyId);
    if (family) {
      ws.send(JSON.stringify({ type: 'state', family, timestamp: Date.now() }));
    }
    // Start tick if first player
    startFamilyTick(familyId, broadcastToFamily);
  }).catch((err) => {
    console.error('Catch-up error:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to load state' }));
  });

  ws.on('message', async (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (!isClientMessage(parsed)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
        return;
      }
      await handleMessage(ws, parsed);
    } catch (err: any) {
      console.error('WS message error:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message || 'Unknown error' }));
    }
  });

  ws.on('close', () => {
    rateStates.delete(ws);
    leaveRoom(ws, familyId);
    if (getRoomSize(familyId) === 0) {
      stopFamilyTick(familyId);
    }
  });
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Partial<ClientMessage> & Record<string, unknown>;
  if (msg.type === 'ping') return true;
  if (msg.type !== 'action') return false;
  if (typeof msg.action !== 'string' || !VALID_ACTIONS.has(msg.action as ActionType)) return false;
  if (!isSafeId(msg.bunnyId)) return false;
  if (msg.targetBunnyId != null && !isSafeId(msg.targetBunnyId)) return false;
  return true;
}

function checkActionRate(ws: WebSocket, action: ActionType, bunnyId: string): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const state = rateStates.get(ws) ?? { lastByKey: new Map<string, number>(), windowStart: now, count: 0 };
  rateStates.set(ws, state);

  if (now - state.windowStart > ACTION_WINDOW_MS) {
    state.windowStart = now;
    state.count = 0;
  }

  state.count += 1;
  if (state.count > MAX_ACTIONS_PER_WINDOW) {
    return { ok: false, message: 'Slow down — too many actions at once.' };
  }

  const key = `${action}:${bunnyId}`;
  const last = state.lastByKey.get(key) ?? 0;
  const cooldown = ACTION_COOLDOWN_MS[action];
  if (now - last < cooldown) {
    return { ok: false, message: 'That action is cooling down.' };
  }

  state.lastByKey.set(key, now);
  return { ok: true };
}

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
    return;
  }

  if (msg.type === 'action') {
    const player = getPlayerFromWs(ws);
    if (!player) return;

    const rate = checkActionRate(ws, msg.action, msg.bunnyId);
    if (!rate.ok) {
      ws.send(JSON.stringify({ type: 'error', message: rate.message }));
      return;
    }

    const dbPlayer = await db.getPlayerById(player.playerId);
    if (!dbPlayer || dbPlayer.familyId !== player.familyId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Player is not allowed to edit this save' }));
      ws.close();
      return;
    }

    const bunnies = await db.getAliveBunnies(player.familyId);
    const bunny = bunnies.find(b => b.id === msg.bunnyId);
    if (!bunny) {
      ws.send(JSON.stringify({ type: 'error', message: 'Bunny not found' }));
      return;
    }

    let targetBunny;
    if (msg.action === 'breed' && msg.targetBunnyId) {
      targetBunny = bunnies.find(b => b.id === msg.targetBunnyId);
      if (!targetBunny) {
        ws.send(JSON.stringify({ type: 'error', message: 'Target bunny not found' }));
        return;
      }
    }

    const result = await performAction(msg.action, bunny, player.playerName, player.playerId, targetBunny);

    if (!result.success) {
      ws.send(JSON.stringify({ type: 'error', message: result.message }));
      return;
    }

    // Broadcast updated state to all players
    const family = await db.getFamily(player.familyId);
    if (family) {
      broadcastToFamily(player.familyId, { type: 'state', family, timestamp: Date.now() });
    }

    // Broadcast activity event
    const entry = (await db.getRecentActivity(player.familyId, 1))[0];
    if (entry) {
      broadcastToFamily(player.familyId, { type: 'event', entry });
    }

    // Broadcast new bunny if breeding
    if (result.newBunny) {
      broadcastToFamily(player.familyId, { type: 'birth', bunny: result.newBunny });
    }
  }
}

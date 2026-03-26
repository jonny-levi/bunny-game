import WebSocket from 'ws';
import type { ClientMessage } from '../shared/types';
import { performAction } from '../game/actions';
import { catchUpFamily, startFamilyTick, stopFamilyTick } from '../game/tick';
import { getPlayerFromWs, broadcastToFamily, joinRoom, leaveRoom, getRoomSize } from './rooms';
import * as db from '../db/queries';

export function handleConnection(ws: WebSocket, familyId: string, playerId: string, playerName: string) {
  joinRoom(ws, { ws, playerId, playerName, familyId });

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
      const msg: ClientMessage = JSON.parse(raw.toString());
      await handleMessage(ws, msg);
    } catch (err: any) {
      console.error('WS message error:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message || 'Unknown error' }));
    }
  });

  ws.on('close', () => {
    leaveRoom(ws, familyId);
    if (getRoomSize(familyId) === 0) {
      stopFamilyTick(familyId);
    }
  });
}

async function handleMessage(ws: WebSocket, msg: ClientMessage) {
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
    return;
  }

  if (msg.type === 'action') {
    const player = getPlayerFromWs(ws);
    if (!player) return;

    const bunnies = await db.getAliveBunnies(player.familyId);
    const bunny = bunnies.find(b => b.id === msg.bunnyId);
    if (!bunny) {
      ws.send(JSON.stringify({ type: 'error', message: 'Bunny not found' }));
      return;
    }

    let targetBunny;
    if (msg.action === 'breed' && msg.targetBunnyId) {
      targetBunny = bunnies.find(b => b.id === msg.targetBunnyId);
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

import WebSocket from 'ws';

interface ConnectedPlayer {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  familyId: string;
}

// familyId → Set of connected players
const rooms = new Map<string, Map<WebSocket, ConnectedPlayer>>();

export function joinRoom(ws: WebSocket, player: ConnectedPlayer) {
  if (!rooms.has(player.familyId)) {
    rooms.set(player.familyId, new Map());
  }
  rooms.get(player.familyId)!.set(ws, player);
}

export function leaveRoom(ws: WebSocket, familyId: string) {
  const room = rooms.get(familyId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) rooms.delete(familyId);
  }
}

export function getRoomSize(familyId: string): number {
  return rooms.get(familyId)?.size ?? 0;
}

export function broadcastToFamily(familyId: string, message: object) {
  const room = rooms.get(familyId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws] of room) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function getPlayerFromWs(ws: WebSocket): ConnectedPlayer | undefined {
  for (const room of rooms.values()) {
    const player = room.get(ws);
    if (player) return player;
  }
  return undefined;
}

export function getAllFamilyIds(): string[] {
  return Array.from(rooms.keys());
}

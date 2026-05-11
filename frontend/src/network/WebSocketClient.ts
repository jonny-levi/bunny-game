import { WS_URL } from '../config';
import { saveClient } from './SaveClient';
import { hydrateIdentities } from '../state/identityRegistry';

export interface BunnyState {
  id: string;
  name: string;
  color: string;
  pattern: string | null;
  stage: string;
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
  health: number;
  isAlive: boolean;
  parentAId: string | null;
  parentBId: string | null;
}

export interface GameState {
  bunnies: BunnyState[];
  familyId: string;
}

export interface GameEvent {
  type: string;
  event?: string;
  bunnyId?: string;
  player?: string;
  message?: string;
  bunnies?: BunnyState[];
  bunnyName?: string;
  cause?: string;
  family?: { bunnies: BunnyState[]; id: string };
  entry?: { message: string };
}

type StateCallback = (state: GameState) => void;
type EventCallback = (event: GameEvent) => void;
type ConnectionCallback = (connected: boolean) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private stateCallbacks: StateCallback[] = [];
  private eventCallbacks: EventCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private playerName: string = '';
  private familyId: string = '';
  private playerId: string = '';
  private connected = false;

  async connect(playerName: string) {
    this.playerName = playerName;
    try {
      // Call REST login - use /login (matches nginx proxy and backend route)
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName }),
      });
      if (res.ok) {
        const data = await res.json();
        this.familyId = data.player?.familyId || data.family?.id || '';
        this.playerId = data.player?.id || '';
        saveClient.setPlayerId(this.playerId);
        const save = await saveClient.loadSave().catch((err) => { console.warn('Save load failed, using local fallback', err); return null; });
        if (save) hydrateIdentities(save);
        console.log('Login success:', { familyId: this.familyId, playerId: this.playerId });
      } else {
        console.warn('Login failed with status:', res.status);
      }
    } catch (e) {
      console.warn('Login API failed, using demo mode', e);
    }
    this.doConnect();
  }

  private doConnect() {
    try {
      const params = new URLSearchParams();
      if (this.familyId) params.set('familyId', this.familyId);
      if (this.playerId) params.set('playerId', this.playerId);
      params.set('playerName', this.playerName);
      this.ws = new WebSocket(`${WS_URL}?${params}`);
      this.ws.onopen = () => {
        this.connected = true;
        this.notifyConnection();
        console.log('WebSocket connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as GameEvent;
          if (data.type === 'state' && data.family) {
            const state: GameState = { bunnies: data.family.bunnies || [], familyId: data.family.id || this.familyId };
            this.stateCallbacks.forEach(cb => cb(state));
          }
          if (data.type === 'tick' && data.bunnies) {
            const state: GameState = { bunnies: data.bunnies, familyId: this.familyId };
            this.stateCallbacks.forEach(cb => cb(state));
          }
          this.eventCallbacks.forEach(cb => cb(data));
        } catch { /* ignore parse errors */ }
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.notifyConnection();
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.connected = false;
        this.notifyConnection();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 3000);
  }

  sendAction(action: string, bunnyId: string) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({
        type: 'action',
        action,
        bunnyId,
        playerId: this.playerId,
      }));
    }
  }

  onState(cb: StateCallback) { this.stateCallbacks.push(cb); }
  onEvent(cb: EventCallback) { this.eventCallbacks.push(cb); }
  onConnectionChange(cb: ConnectionCallback) {
    this.connectionCallbacks.push(cb);
    cb(this.connected);
  }

  private notifyConnection() {
    this.connectionCallbacks.forEach(cb => cb(this.connected));
  }

  isConnected() { return this.connected; }

  disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}

export const wsClient = new WebSocketClient();

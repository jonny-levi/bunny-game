import type { IdentitySave } from '../state/identityRegistry';
import type { Needs } from '../state/needs';

export type CareAction = 'feed' | 'sleep' | 'bathe' | 'play' | 'vet';

export interface ServerSave extends IdentitySave {
  userId: string;
  needs: Needs;
  lastTick: string;
  updatedAt: string;
}

class SaveClient {
  private playerId = '';
  private cache: ServerSave | null = null;

  setPlayerId(playerId: string) {
    this.playerId = playerId;
  }

  getPlayerId() { return this.playerId; }
  getCachedSave() { return this.cache; }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-player-id': this.playerId,
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<ServerSave | null> {
    if (!this.playerId) return null;
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers || {}) },
    });
    if (!res.ok) {
      if (res.status === 409) {
        const payload = await res.json().catch(() => null);
        if (payload?.save) {
          this.cache = payload.save;
          return this.cache;
        }
      }
      throw new Error(`Save request failed: ${res.status}`);
    }
    this.cache = await res.json();
    return this.cache;
  }

  async loadSave() {
    return this.request('/api/save');
  }

  async applyAction(action: CareAction) {
    return this.request('/api/save/needs', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async hatch(save: IdentitySave) {
    return this.request('/api/save/hatch', {
      method: 'POST',
      body: JSON.stringify({ father: save.father, mother: save.mother, egg: save.egg }),
    });
  }
}

export const saveClient = new SaveClient();

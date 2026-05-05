# Backend Report — V7 Bubble Bath Duet

**Specialist:** Backend
**Date:** 2026-05-05
**Spec:** RESEARCH-REPORT-V7.md §A.3, §A.4 (locked).

## Files touched
- `backend/server.js` — feature core (config, state, lifecycle, socket handlers, shop wiring)
- `backend/memoriesSystem.js` — registered `bath_day` event type
- `backend/gameState.js` — no edits required (bath is transient and `loadSavedGameState` defensively zeros it)
- `backend/validation.js` — no edits required (existing default 30/min rate limit covers `bath_grab_station` / `bath_release_station`)

## Changes by region

### `GAME_CONFIG.BATH` (new block, just before `SHOP`)
```
BATH: {
  triggerCleanliness: 30,    // auto-trigger when any meadow baby drops below this
  windowMs: 60000,            // 60s window to start holding both stations
  holdMs: 5000,               // both must hold for 5s
  graceMs: 8000,              // 8s grace for a dropped player
  cooldownMs: 600000,         // 10 min between auto-baths (shop bypasses)
  cleanlinessReward: 60,      // applied on success; partial = round(60 * t/holdMs)
  stations: ['sponge', 'tap']
}
```

### `GAME_CONFIG.SHOP.items.bubble_bath` (new shop item)
- Cost 6 carrots; type `consumable`; effect `{ trigger_bath: true }`. `useShopItem` routes this short-circuit to `room.startBath('shop')`, bypassing the cooldown.

### `coupleStats` (3 new persistent fields)
- `bathsCompleted` — integer, +1 on full success
- `bathStreak` — integer, +1 on full success, NOT touched on partial/failed
- `lastBathAt` — ms timestamp, set on success and partial (used for cooldown gating; partial still updates so spam-trigger doesn't loop). Auto-trigger checks `lastBathAt + cooldownMs`.
- Fully migrated for legacy saves in `loadSavedGameState`.

### `gameState.bath` (transient lifecycle object)
Shape:
```
{
  id, reason ('auto'|'shop'),
  startedAt, expiresAt,
  stations: { sponge: playerId|null, tap: playerId|null },
  stationGrabAt: { sponge: ts, tap: ts },
  holdElapsedMs, lastTickAt,
  bothHeldStartedAt,
  participatingBabies: [babyId, ...],
  graceUntil,
  resolution
}
```
Always nulled on `loadSavedGameState`. If a save file contained a non-null bath, a one-shot `_pendingBathServerReset` flag is set so `tickBath` emits a synthetic `bath_resolved { resolution: 'server_reset' }` to reconnecting clients (acceptance case 5).

### New `GameRoom` methods
- `checkBathTrigger()` — every game-loop tick, gates on cooldown + meadow babies with `cleanliness < 30`, calls `startBath('auto')`.
- `startBath(reason)` — snapshots `participatingBabies` (excludes eggs and `inCave === true`), emits `bath_available`. Returns `false` when there are no eligible babies or a bath is already running.
- `grabStation(playerId, station)` — handles same-player toggling, releases the player's other station first, applies the **50ms concurrent-claim tiebreaker** (acceptance case 7) by redirecting late arrivers to the open station, emits `bath_grab_station`.
- `releaseStation(playerId, station)` — emits `bath_release_station`, pauses both-held tracking.
- `tickBath()` — drives the lifecycle each game-loop tick (8 s interval): detects disconnected holders (8 s grace pause), accumulates hold time only while both stations are held by **different** players, broadcasts `bath_progress`, transitions to `success` (full hold), `partial` (some hold then timeout), `failed_solo` (someone held but never both), or `failed_timeout` (no one held).
- `resolveBath(resolution)` — applies cleanliness gain (full reward on success; `round(reward * t/holdMs)` on partial; zero on failure), updates `coupleStats`, writes a `bath_day` cooperative memory + auto-photo on success only, emits `bath_resolved`, then clears `gameState.bath`.

### Game-loop wiring
Two new `updateFunctions` entries in `startGameLoop`: `tickBath` then `checkBathTrigger`. Both are isolated by the existing per-function try/catch in the loop.

### New socket handlers
- `bath_grab_station` — validates `data.station ∈ {sponge, tap}`, rate-limits, calls `room.grabStation`. On invalid station emits `action_failed`.
- `bath_release_station` — validates `data.station`, rate-limits, calls `room.releaseStation`. Suppresses the "Not holding this station" message (idempotent UX).
- Server-emitted only: `bath_available`, `bath_progress`, `bath_resolved` (delivered via `broadcastEvent`, which packages them as `game_event` payloads — frontend listens to those tags via the existing `onGameEvent` dispatch path).

### `useShopItem` patch
- Detects `item.effect.trigger_bath === true` and short-circuits to `startBath('shop')`. Item is consumed only after the bath actually starts. No baby targeting required for this item.

## Acceptance-case traceability
1. **Golden path** — `resolveBath('success')` applies `cleanlinessReward` to all `participatingBabies`, `bathStreak += 1`, `bath_day` memory + family photo recorded.
2. **Partial credit** — `resolveBath('partial')` uses `Math.round(60 * holdElapsedMs / holdMs)`, no streak change, no memory.
3. **failed_solo** — when `holdElapsedMs === 0` but at least one station was held when the window expired.
4. **8 s grace** — `tickBath` sets `graceUntil = now + 8000` when a holding player disconnects, pauses progress, emits `bath_progress { paused: true, reason: 'partner_dropped' }`. A new `grabStation` call from the reconnecting player clears `graceUntil`. If the grace expires the station is released.
5. **server_reset** — `_pendingBathServerReset` flag → first `tickBath` after reconnect emits `bath_resolved { server_reset }`.
6. **Cooldown** — `checkBathTrigger` returns early when `now - lastBathAt < cooldownMs`. Shop path calls `startBath` directly so it bypasses.
7. **Concurrent station claim** — same-station claim within 50 ms redirects the late arriver to the open station via `_maybeStartBothHeld`.
8. **Cave exclusion** — `startBath` filters with `b.inCave !== true`; `resolveBath` re-checks before applying cleanliness gain.

## Syntax check
```
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c backend/server.js        # OK
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c backend/gameState.js     # OK
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c backend/memoriesSystem.js # OK
```

## Known limitations / deferred
- The active `memoryManager.js` (file-backed, used by `get_memories`) gets the bath success entry via `createMemory({ type: 'cooperative', metadata: { memoryType: 'bath_day' } })`. The in-memory `memoriesSystem.js` `bath_day` event type is registered for completeness but isn't currently wired to a live caller in the running server (consistent with its existing role).
- Rate-limit slots for the two new socket events use the default 30/min bucket — adequate for press-and-hold UX. If the audit flags anti-spam concerns, raise to 60/min for grabs (frontend should debounce).

## FIXES APPLIED (V7.1)

### Fix S-1 [P1] — bath handlers now call `validateGameAction` whitelist
- `backend/validation.js`: added `bath_grab_station` and `bath_release_station` to `validateGameAction`'s whitelist; added a new `validateBathStationAction` helper that enforces `data.station ∈ {sponge, tap}`.
- `backend/server.js`: both bath handlers now call `GameValidator.validateGameAction(...)` after the rate-limit check. The handler-local hand-rolled station check was removed (the validator now throws a `ValidationError` that the catch surfaces via `action_failed`).

### Fix Q-2 [P1] — synchronous grace pause on disconnect
- `backend/server.js`: new `GameRoom.handleBathHolderDisconnect(playerId)` method called from `removePlayer(playerId)`. When a player who is currently holding a bath station drops, the grace timer is armed immediately (`graceUntil = now + graceMs`), the elapsed both-held time is flushed, and a `bath_progress { paused: true, reason: 'partner_dropped' }` event is broadcast — without waiting for the next 8 s `tickBath`. Worst-case grace start latency drops from ~16 s to ~0 s.

### Re-syntax-check
```
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c backend/server.js     # OK
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c backend/validation.js # OK
```

### Deferred (not fixed this iteration)
- **Q-1 [P2]** — partial bath also bumps `lastBathAt` (cooldown applies after partial). Defer until the user weighs in on intent.
- **Q-3 / S-2 [P2]** — `_pendingBathServerReset` could be re-persisted in the narrow auto-save / first-tick window. Cosmetic; defer to V7.1 hardening.
- **S-3 [P2]** — full `gameState.bath` object is broadcast in `game_state_update`. No spectator path exists today, so leakage is bounded to the two players who already see each other's IDs. Defer.
- **Q-6 [P2]** — bath_day memory currently lands as `type: 'cooperative'` in `memoryManager`; `bathDay` flag in metadata only. Defer to a memories-listing pass.
- **S-4, S-5, S-6, S-7, S-8, Q-4, Q-5, Q-7, Q-8, Q-9** — all P3, no action.

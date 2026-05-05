# Security Report — V7 Bubble Bath Duet

**Specialist:** Security
**Date:** 2026-05-05
**Scope:** V7 changes only (bath lifecycle in `backend/server.js`, `bath_day` in `backend/memoriesSystem.js`, frontend bath UI in `frontend/game.js`).

## Severity legend
- **P0** ship-blocking
- **P1** must-fix this iteration
- **P2** non-blocking; fix if quick
- **P3** informational / future hardening

## Findings

### S-1 [P1, BACKEND] `bath_grab_station` / `bath_release_station` skip the `validateGameAction` whitelist
**File:line:** `backend/server.js:~4080–4140` (the two new socket handlers).
**Detail:** The two new socket handlers call `GameValidator.validateRateLimit` but **not** `GameValidator.validateGameAction`. The existing care-action handlers (`feed_baby`, `clean_baby`, etc.) call `validateGameAction` to enforce a typed whitelist. Bath actions therefore skip that defense-in-depth check.
**Risk:** Mostly cosmetic — `data.station` is hand-validated against `['sponge', 'tap']`, and `playerId` is server-derived from `playerSockets`. There is no untrusted-string flowing into the room logic. But the inconsistency means future devs may forget the manual whitelist.
**Fix recommendation:** Either (a) add `bath_grab_station` / `bath_release_station` to `validateGameAction`'s whitelist (`backend/validation.js:65`) and call it from the handlers, or (b) leave a comment in both handlers explaining why they intentionally bypass the whitelist. **Cheap to apply (a) — fix this iteration.**

### S-2 [P2, BACKEND] `_pendingBathServerReset` lives inside `gameState` and could be re-persisted
**File:line:** `backend/server.js:loadSavedGameState` (around the `_pendingBathServerReset` flag) and `backend/server.js:tickBath` (where it's deleted).
**Detail:** When a save file contains a non-null `bath`, we set `gameState._pendingBathServerReset` and clear `gameState.bath`. The flag is deleted on the first `tickBath` after a player joins. **However**, between `loadSavedGameState` returning and the first `tickBath`, an `autoSaveIfNeeded` call could re-persist the new save file with `_pendingBathServerReset` still set. The auto-save interval is 30 s; the game loop is 8 s, so the race is narrow but theoretically present. A second restart in that 8 s window would persist `_pendingBathServerReset` again — harmless but accumulates a stale field.
**Risk:** Low. No data exposure, no auth issue. Only cosmetic state on disk.
**Fix recommendation:** Add the field name to a serialization deny-list in `gameState.js` `_performSave`, or move the flag to a non-persisted in-memory `Map` keyed by roomCode on the `MemoriesSystem` / `GameStateManager`. **Defer to V7.1.**

### S-3 [P2, BACKEND] Bath state object spread into `game_state_update`
**File:line:** `backend/server.js:broadcastGameState` (around `...this.gameState` spread).
**Detail:** `gameState.bath` (including `stations` map of player IDs, `stationGrabAt` timestamps, `holdElapsedMs`, `everHeldAny`, etc.) is broadcast in every `game_state_update` to **all** connected players. Both players already see each other's bunnies and player IDs in this room, so the leakage is bounded; **a third party that joined as a spectator** (room codes are 6 alphanumeric chars and join is gated on capacity, so this isn't possible today) would see the full state.
**Risk:** Low — room model is 2-player capped (`isFull() => this.players.size >= 2`). No spectator path exists.
**Fix recommendation:** Optionally redact `bath` to send only the minimum (e.g. drop `stationGrabAt`, `lastTickAt`) since the dedicated `bath_progress` event already conveys the live numbers. **Defer to V7.1.**

### S-4 [P2, BACKEND] Race in concurrent claim tiebreaker uses server clock, not arrival timestamp
**File:line:** `backend/server.js:grabStation` (the `dt <= 50` check).
**Detail:** The tiebreaker uses `Date.now() - bath.stationGrabAt[station]` to detect a 50 ms collision. Because socket.io callbacks are serialized in the Node event loop, `Date.now()` for two grabs that arrive "simultaneously" will differ by however long the **first handler** takes to run, not by the actual network arrival times. This is fine for the spec ("within 50 ms tiebreaker") because event-loop latency between two handlers is typically sub-ms; but a slow synchronous task in between could push beyond 50 ms.
**Risk:** Low — the only synchronous work between handlers is the bath logic itself, well under 1 ms.
**Fix recommendation:** None required for V7. If precision becomes important, capture `socket.timestamp` from the socket.io packet headers. **No action.**

### S-5 [P3, BACKEND] Default 30/min rate limit on grab/release allows lightweight spam
**File:line:** `backend/validation.js:163` (the rate-limit defaults).
**Detail:** Press-and-hold UX naturally generates one grab and one release per cycle. 30/min is generous. However, a malicious client could `emit('bath_grab_station', { station: 'sponge' })` 30 times per minute (and 30 release events) to flood broadcasts. With 2 players in the room each grab fires 2 emits, so 60 outbound emits/min — bounded.
**Risk:** Very low.
**Fix recommendation:** None.

### S-6 [P3, BOTH] No CSRF / origin enforcement on socket connect
**Detail:** Pre-existing project property — websocket connections do not enforce Origin headers. Out of scope for V7.
**Fix recommendation:** None.

### S-7 [P3, BACKEND] Bath cleanliness gain bypasses `applyPersonalityEffects`
**File:line:** `backend/server.js:resolveBath`.
**Detail:** Direct `baby.cleanliness = ...` write does not flow through the personality / trait effect pipeline that `cleanBaby` uses (e.g. `gentle` trait gets bonus love). Not a security issue — just a balance gap.
**Risk:** None (security).
**Fix recommendation:** Defer; QA report flags as design gap.

### S-8 [P3, BACKEND] Inventory/double-spend on `bubble_bath`
**File:line:** `backend/server.js:useShopItem` for `trigger_bath`.
**Detail:** Item is decremented **after** `startBath` succeeds. Because `useShopItem` is synchronous and `gameState.bath` is checked immediately before the start, there is no concurrent path to double-spend. Verified by tracing through the call graph.
**Risk:** None.

## Summary
- 0 × P0
- 1 × P1 (S-1, validate whitelist)
- 3 × P2 (S-2, S-3, S-4 — all deferrable)
- 4 × P3 (informational)

**Recommended fix this iteration:** S-1 only.

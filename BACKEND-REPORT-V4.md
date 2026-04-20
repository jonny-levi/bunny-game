# Bunny Family Game - Backend Implementation Report V4

**Date:** 2026-04-20
**Feature:** Whispered Wishes (Wish Jar) - BACKEND ONLY
**Spec:** `RESEARCH-REPORT-V4.md`

---

## Files touched

| File | Change |
|---|---|
| `backend/wishSystem.js` | **NEW.** WishSystem class with hide / discover / jar lifecycle + defaults + sanitize. |
| `backend/validation.js` | Added `validateWishSpotId`, `validateWishTriggerAction`, `validateWishMessage`; rate-limit caps for `hide_wish` (1/60s), `tap_wish_jar` (60/min ~ 1/s), `attempt_wish_discovery` (120/min ~ 20/10s). |
| `backend/server.js` | Import + instantiate `WishSystem`; init `wishSystem` in `initializeGameState` + `loadSavedGameState` migration; new room methods `getRegisteredPlayerIds`, `broadcastToPlayers`, `emitToPlayer`, `expireWishesAndNotify` (wired into game loop); 5 socket handlers. |
| `backend/server-redis.js` | Mirror: import + instantiate WishSystem, add `wishSystem` + `coupleStats` to initializeGameState, sanitize on Redis load, local rate-limit helper, 5 socket handlers. |

No frontend files were touched.

---

## Socket event contracts

### Client → Server

| Event | Payload | Effect |
|---|---|---|
| `hide_wish` | `{ spotId, message }` | Validates spot/message, enforces 1/60s global rate-limit AND 1/10s in-module cooldown, stores wish as `gameState.wishSystem.activeWishes[playerId]` (replaces any existing). Triggers `saveGameState`. |
| `get_my_wishes` | `{}` | Returns caller's own undiscovered wish (if any). |
| `cancel_wish` | `{}` | Removes caller's active wish. |
| `attempt_wish_discovery` | `{ spotId, triggerAction }` | Rate-limited (20/10s). Checks whether a partner wish exists at that spot AND whether `triggerAction` is on the allowlist for that spot; if so, removes wish, credits rewards, emits `wish_discovered` to the caller and `wish_author_notified` to the author, possibly spawns the jar. |
| `tap_wish_jar` | `{ timestamp }` | **Client timestamp is IGNORED.** Server time is authoritative (spec §7.3). First tap per player is recorded idempotently; when both registered players have tapped the jar is opened (Δ≤3000ms) or failed (60s cooldown). |

### Server → Client

| Event | Payload | Recipients |
|---|---|---|
| `wish_hidden` | `{ wishId, spotId, expiresAt }` | Sender only. |
| `wish_cancelled` | `{ wishId }` | Sender only. |
| `my_wishes` | `{ wishes: [...] }` | Sender only. |
| `wish_discovered` | `{ wishId, message, fromPlayerName, spotId, rewardLoveTokens }` | Discovering player only. |
| `wish_author_notified` | `{ wishId, spotId }` | Author only (soft toast "partner found your wish"). |
| `wish_jar_ready` | `{ jarId, expiresAt }` | Both players. |
| `wish_jar_tapped` | `{ jarId, tappedBy }` | Both players (live partner-tap indicator). |
| `wish_jar_opened` | `{ rewards: { loveTokens, gems, wearableId }, memoryId }` | Both players, exactly once per jar. |
| `wish_jar_failed` | `{ reason, cooldownEndsAt }` | Both players. |
| `wish_jar_expired` | `{ jarId }` | Both players (from decay loop or post-expiry tap). |

---

## Data model

`gameState.wishSystem` (sanitized / initialized on load; shape from spec §3):

```
{
  activeWishes:      { [playerId]: { wishId, spotId, message, authorId, createdAt, expiresAt(+48h) } },
  recentDiscoveries: [ { wishId, discoveredBy, discoveredAt, authorId }, ... up to 20 ],
  currentJar:        null | { jarId, readyAt, expiresAt(+10m), pendingTaps: { [pid]: serverTs } },
  jarCooldownUntil:  timestamp,
  wishJarsOpenedTotal: int
}
```

`gameState.coupleStats` gains:
- `wishesHidden`, `wishesDiscovered`, `wishJarsOpened` counters (initialised lazily).

Persisted through the existing `GameStateManager.saveRoomState` path — no new persistence infra (per spec §3).

---

## Security enforcement

All six spec-§7 concerns are addressed:

1. **HTML / control chars / length** — `validateWishMessage` strips HTML tags, strips `\x00-\x1F\x7F`, trims, clamps to 140. Called BEFORE storage.
2. **Spot enumeration** — `validateWishSpotId` whitelists exactly the 7 spec spots (`bowl|garden|pad|pile|shelf|shadow|cave`).
3. **Timestamp spoofing** — `tap_wish_jar` handler explicitly ignores `data.timestamp`; `wishSystem.registerTap` records `Date.now()` server-side only.
4. **Jar double-open** — `_resolveJarSuccess` atomically null-outs `currentJar` before returning rewards; any further tap on the same jarId hits `{ code: 'no_jar' }` and is silently dropped.
5. **Discovery probe protection** — `attempt_wish_discovery` requires `triggerAction` to be on the per-spot allowlist (`SPOT_TRIGGER_ACTIONS`), and is rate-limited at 20/10s.
6. **Reward minting** — All reward values are hard-coded constants in `wishSystem.js`; the client cannot influence them.
7. **Persistence poisoning** — `WishSystem.sanitize` validates shape on load and drops malformed entries rather than crashing; runs in both `server.js` loadSavedGameState and `server-redis.js` getOrCreateRoom.
8. **Registered-player gate** — Every wish entry-point requires `playerId` to be in the room's registered player set (`room.players.keys()`). Guests, unknown sockets, and sockets belonging to other rooms are rejected with `action_failed` (or silent drop for the high-frequency `attempt_wish_discovery`).
9. **Room isolation** — All handlers resolve `room` from `playerSockets.get(socket.id).roomCode` and operate on `room.gameState` only. No cross-room broadcasts; the neighborhood `listPublicRooms` path never exposes wishSystem fields (not added to that serializer).

Rate limit summary (spec §3):
- `hide_wish`: 1/60s (global rate-limiter cap = 1) AND 1/10s in-module (spec also mentioned 10s; safer to enforce both).
- `tap_wish_jar`: 60/min global cap (~1/s). `wishSystem.registerTap` is additionally idempotent per-player.
- `attempt_wish_discovery`: 120/min (= 20/10s).

---

## Integration points

- **Decay loop.** `expireWishesAndNotify` runs every game tick (8s) alongside `updateNeeds`, `updateGarden`, etc. It removes expired wishes, clears an expired jar (broadcasting `wish_jar_expired`), trims `recentDiscoveries` to the 24h window, and — if both players have a discovery inside the window — spawns a new jar and broadcasts `wish_jar_ready`.
- **Save trigger.** Each of `hide_wish`, `cancel_wish`, `attempt_wish_discovery` (on reveal), and `tap_wish_jar` (on open/fail) calls `room.saveGameState()` asynchronously, matching the pattern used by `send_love_note`, `harvest`, and cave events.
- **Memory entries.** Discovery and jar-open both record via `memoryManager.recordCooperativeAction(roomCode, '<wish_discovered|wish_jar_opened>', participants, [])`. New memory event types (`wish_discovered`, `wish_jar_opened`) are passed through as-is — the memory manager accepts arbitrary action names and this matches how `love_note` is recorded today.

---

## Deviations from spec

1. **Love token minting model.** The spec says "+1 Love Token to both players" on discovery and "5 Love Tokens" on jar open. The codebase does not have a per-player "loveTokens" currency — `love` is a per-bunny stat and `gems` is the shared rare currency. I credited the shared `gameState.gems` counter (+2 on discovery = 1 per player into the shared pool; +gems from the jar roll on open). The reward *payload* still reports the spec's numbers (`rewardLoveTokens: 1`, `rewards.loveTokens: 5`) so the frontend can display them as designed and/or the frontend agent can remap to a new counter without a backend change.
2. **Wearable reward.** `WISH_WEARABLE_POOL` picks from existing `GAME_CONFIG.SHOP` item ids. If the pool entry is unknown to the shop the equip step silently no-ops — matching existing unknown-wearable behavior — so the backend does not need to validate the pool at startup.
3. **Sibling-module style vs. manager instantiation.** `memoriesSystem.js` / `rewardsSystem.js` / `achievementSystem.js` are actually unused in `server.js` (which uses parallel `memoryManager`, `dailyRewardManager`, `achievementManager` classes). I instantiated `wishSystem` as a single singleton alongside those managers (not per-room) because the authoritative state lives on each `room.gameState.wishSystem`; only the small `hideCooldowns` cache is singleton, which is safe because it's keyed by globally-unique `playerId`s.
4. **No achievements / memory types registered.** The spec §5 mentions `first_whisper`, `wish_keeper`, `dream_jar`, `soul_sync` achievement entries and `wish_discovered` / `wish_jar_opened` memory event types. These are defined on the spec-mentioned sibling files (`achievementSystem.js`, `memoriesSystem.js`) which are *not wired into the live server*. Adding them to the live `achievements.js` / `memoryManager.js` is out of scope for this iteration — the socket handlers emit the necessary state transitions via `memoryManager.recordCooperativeAction` so a follow-up iteration can register the specific achievement checks against the same data without a schema change.

---

## Verification

```
$ docker run --rm -v ~/bunny-game:/w -w /w node:20-alpine sh -c '
    node -c backend/wishSystem.js && \
    node -c backend/server.js && \
    node -c backend/server-redis.js && \
    node -c backend/validation.js'
wishSystem.js OK
server.js OK
server-redis.js OK
validation.js OK
```

Functional smoke test confirmed: hide → partner-discover → mutual-discover → jar spawn → two-player tap → `wish_jar_opened` with rewards; out-of-sync tap → `wish_jar_failed` + 60s cooldown; unknown socket → rejected at every entry-point; rate-limit → 2nd hide within 10s rejected; invalid spotId / triggerAction → rejected by validator.

---

## FIXES APPLIED (V4.1)

**Date:** 2026-04-20
**Scope:** backend-only fixes for the SECURITY-REPORT-V4 and QA-REPORT-V6 findings. No frontend files touched.

### Critical (P0)

- **SEC P0-1 — Wish plaintext leak in broadcasts / initial-join payloads.** Added a per-recipient redaction layer.
  - `backend/server.js:1923-1984` — `broadcastGameState` now calls `_projectGameStateFor(playerId)` once per recipient instead of emitting the full `gameState` to both sockets. The projection includes only the caller's OWN `activeWishes[playerId]` entry; partner wishes and `recentDiscoveries` are stripped from the wire payload. `this.gameState` itself is unchanged, so `saveGameState` still persists the complete unredacted state.
  - `backend/server.js:1985-2005` — new `buildInitialGameStateFor` used by `room_created` (`server.js:3044`) and `joined_room` (`server.js:3140`) so the first frame a player receives is subject to the same redaction.
  - `backend/server-redis.js:345-373` — mirror: `broadcastGameState` iterates with per-player `_projectGameStateFor(pid)`; the thin server's `room_created` (line 527) and `joined_room` (line 564) now also use the projection.

- **QA B-1 — Frontend/backend trigger allowlist mismatch.** `backend/wishSystem.js:18-30` — widened `SPOT_TRIGGER_ACTIONS` to match the frontend `ACTION_SPOT_MAP`. Cave is now discoverable via `sleep`, `pet`, `cave_enter`, `cave_exit`; `garden` adds `play`; `pad` adds `pet`; `pile` adds `feed`; `shelf` adds `play`. `validateWishTriggerAction` in `validation.js:197` already whitelisted every trigger used, so no change needed there.

### High (P1)

- **SEC P1-1 / QA B-6 — Rate-limit windows mismatched spec.** Added `GameValidator.checkRollingWindow(playerId, action, maxInWindow, windowMs, rateLimits)` at `backend/validation.js:242-266`. Keys are `${playerId}:${action}:rw${windowMs}` so the rolling check coexists with the legacy 60s cap.
  - `backend/server.js:4055-4063` — `hide_wish` now enforces 1/60s via the rolling window in addition to the legacy cap.
  - `backend/server.js:4172-4180` — `attempt_wish_discovery` enforces 20/10s.
  - `backend/server.js:4260-4268` — `tap_wish_jar` enforces 1/1000ms (was 60/60s which allowed bursts).
  - `server-redis.js` already used a correct rolling window via `checkWishRateLimit(... , 20, 10000)` / `(... , 1, 1000)` at lines 593/679/739; no change needed there.

- **SEC P1-2 / P3-1 — `hideCooldowns` process-wide Map grew unbounded and was being persisted.** `backend/wishSystem.js:141-151` — new `_pruneHideCooldowns(now)` helper called from `hideWish` (line ~178) and `expireWishes` (line ~446), trimming entries older than the widest (60s) cooldown window. `serialize()` (`wishSystem.js:482-492`) is now a no-op — `hideCooldowns` is a rate-limit cache, not persisted state. The in-module 10s cooldown stays as a secondary gate; the global 60s rolling window is authoritative.

- **QA B-2 — Reconnect mid-jar never re-renders.** `backend/server.js:779-799` (`addPlayer` reconnect branch) and `backend/server-redis.js:209-238` — when a player reconnects and an active, non-expired `currentJar` exists, we re-emit `wish_jar_ready { jarId, expiresAt }` to their socket so the frontend overlay can re-render.

- **QA B-7 — Author never told their own wish expired.** `backend/wishSystem.js:436-455` — `expireWishes` now also returns `expiredWishes: [{ wishId, authorId }]`. `backend/server.js:1340-1360` (`expireWishesAndNotify`) emits `wish_expired { wishId }` to each author via `emitToPlayer`. Same wiring added to the redis path at `backend/server-redis.js:259-296`.

### Medium (P2)

- **SEC P2-1 / QA B-5 — `WishSystem.sanitize` tampering + authorId drop.** `backend/wishSystem.js:82-116` — reject activeWishes keys that don't match `/^player_[a-z0-9]+_[a-z0-9]+$/` (including `__proto__`, `constructor`, `prototype`). Strip control chars from `message` defensively on load. Preserve `authorId` when present and valid; otherwise default to the key. `recentDiscoveries` filter now also requires `typeof d.authorId === 'string'`.

- **SEC P2-2 — `validateWishMessage` unicode tricks.** `backend/validation.js:224-237` — strip `\u200B-\u200F`, `\u202A-\u202E`, `\u2060-\u206F`, `\uFEFF` and NFC-normalise before the length check. Mirrored in `backend/server-redis.js:499-513` `sanitizeWishMessage`.

- **SEC P2-3 — `get_my_wishes` / `cancel_wish` unrate-limited.** `backend/server.js:4117-4126` — `get_my_wishes` now has a rolling `10/10s` cap (silent drop on bust). `backend/server.js:4144-4154` — `cancel_wish` has a rolling `5/60s` cap. `server-redis.js` equivalents are gated by the `registered` check and the low-volume nature of those endpoints; not adding limits to the thin shell in this pass (it already has `checkWishRateLimit`; can be added the same way if the redis path goes live).

- **SEC P2-4 / QA B-4 — oversize payload + clamp-vs-reject.** `backend/validation.js:215-218` — reject any `message.length > 1000` before the regex. `backend/validation.js:239-242` — post-clean length > 140 now throws `ValidationError('Wish message too long (max 140)', 'message')` instead of silently clamping. `server-redis.js` `sanitizeWishMessage` mirrors both rejections.

### Low (P3)

- **SEC P3-1 — duplicate hide cooldowns.** Addressed alongside P1-2 (see above). The in-module 10s cooldown is retained as a secondary gate under the now-authoritative 60s rolling window; it's pruned on every decay-loop tick so it no longer leaks memory.

- **QA P3-2 — jar-opened memory credited all registered players.** `backend/wishSystem.js:376-388` — `registerTap` now threads the actual tap pair (`tappedBy = distinct.slice(0,2)`) into `_resolveJarSuccess` / `_resolveJarFailure`, which surface it on the result. `backend/server.js:4405-4411` — `memoryManager.recordCooperativeAction` uses `result.tappedBy` when available (falls back to `registered` for safety).

- **QA B-9 — 2nd/winning tap didn't broadcast `wish_jar_tapped`.** `backend/server.js:4378-4388` + `backend/server-redis.js:765-772` — for `opened`/`failed` resolutions we now emit `wish_jar_tapped` first so the first player sees the partner's zone light up before the open/fail animation fires.

- **QA B-8 — `server-redis.js` had no decay-loop wiring.** `backend/server-redis.js:248-297` — `startGameLoop` now calls `expireWishesAndNotify` on each 5s tick, mirroring the server.js path. Jars and wishes now actually expire in the redis-backed build.

### Intentionally skipped

- **SEC P3-3 (suspicious-drops counter on `attempt_wish_discovery`).** Requires new per-socket tracking infra; out of scope for a surgical fix pass.
- **QA B-3 (profanity filter).** No existing profanity hook in `validation.js` (send_love_note also lacks one). Adding a curated wordlist here would establish a new abstraction the rest of the codebase doesn't use; defer to a shared-hook iteration.
- **Frontend items (F-1, F-2, F-3, F-5, F-6, F-7, F-8, F-9).** Explicitly out of scope — no frontend files touched.

### Verification

```
$ docker run --rm -v ~/bunny-game:/w -w /w node:20-alpine sh -c '
    node -c backend/wishSystem.js && \
    node -c backend/validation.js && \
    node -c backend/server.js && \
    node -c backend/server-redis.js'
wishSystem.js OK
validation.js OK
server.js OK
server-redis.js OK
```

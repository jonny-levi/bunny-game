# Security Audit — Whispered Wishes (V4)

**Auditor:** Bunny Security Agent
**Date:** 2026-04-20
**Scope:** `backend/wishSystem.js`, `backend/validation.js`, `backend/server.js` (wish paths + room broadcasts), `backend/server-redis.js`, `backend/gameState.js`, `frontend/game.js` (WishUI), `frontend/index.html` (wish modals).
**Spec referenced:** `RESEARCH-REPORT-V4.md` §7.

## TL;DR

- **1 P0** (critical confidentiality failure that breaks the feature's core premise).
- **2 P1** (rate limits wildly looser than spec, cross-room cache leak).
- **4 P2** (rate-limit / input-hygiene / persistence hardening).
- **3 P3** (minor nits).

The top concern is **P0-1: every hidden wish's plaintext is broadcast to the partner inside `game_state_update` before it's ever "discovered"**, because `broadcastGameState()` spreads the entire `gameState` including `wishSystem.activeWishes[*].message`. The partner can read it straight out of the socket frame / browser devtools, making the hide-and-discover ritual trivially circumventable.

---

## BACKEND FIXES

### P0-1. Plaintext wishes leak via `game_state_update` broadcast
**Severity:** P0
**Files:** `backend/server.js:1923-1937`, `backend/server.js:3105`, `backend/server-redis.js:345-354`

`broadcastGameState()` does `{ ...this.gameState, ... }` and emits to both players. `this.gameState.wishSystem.activeWishes[<authorPid>]` contains `{ wishId, spotId, message, authorId, createdAt, expiresAt }` — the raw wish text. It's therefore pushed to the partner's socket on **every** call (feed, harvest, decay tick, etc.) and also delivered on `joined_room` (`server.js:3105`) and `room_created` (server.js:3008).

Any partner can open DevTools, type `gameState.wishSystem.activeWishes`, and read all unfinished wishes in the room, completely bypassing the "stumble upon it" / Wish Jar ritual. Same leak exists in `server-redis.js` where `broadcastGameState` emits raw `this.gameState` (line 350) and `joined_room` payload includes full state (check join_room handler).

**Fix (server.js `broadcastGameState`):**

```js
broadcastGameState() {
    // ... existing playersInfo / babies mapping ...

    // V4: redact wishSystem per-recipient — each player only sees their OWN
    // active wish. Partner wishes must not appear in the broadcast payload.
    const baseWishSystem = this.gameState.wishSystem || {};
    const publicWishSystem = {
        currentJar:          baseWishSystem.currentJar || null,
        jarCooldownUntil:    baseWishSystem.jarCooldownUntil || 0,
        wishJarsOpenedTotal: baseWishSystem.wishJarsOpenedTotal || 0
        // activeWishes and recentDiscoveries intentionally omitted
    };

    this.players.forEach(player => {
        if (!player.connected) return;
        const socket = io.sockets.sockets.get(player.socketId);
        if (!socket) return;
        const own = (baseWishSystem.activeWishes || {})[player.id] || null;
        const perPlayerState = {
            ...this.gameState,
            players: playersInfo,
            babies: /* unchanged */,
            wishSystem: {
                ...publicWishSystem,
                activeWishes: own ? { [player.id]: own } : {}
            }
        };
        socket.emit('game_state_update', perPlayerState);
    });
}
```

And apply the same redaction to the `joined_room` / `room_created` payloads at `server.js:3008` and `server.js:3101-3106`: build a per-player `gameState` clone whose `wishSystem.activeWishes` only contains the joining player's own entry (empty on first join).

Mirror the same change in `server-redis.js:345-354` and in the `joined_room` / `room_created` handlers there.

> The `recentDiscoveries` array only contains `{ wishId, discoveredBy, discoveredAt, authorId }` — no message text — so it does not leak plaintext, but omitting it from broadcasts is still good hygiene since clients never consume it.

---

### P1-1. `hide_wish` + `attempt_wish_discovery` rate-limit caps are far above spec
**Severity:** P1
**File:** `backend/validation.js:273-285`, `backend/server.js:4050,4157`

The spec says:
- `hide_wish`: 1 per 60s
- `attempt_wish_discovery`: 20 per 10s
- `tap_wish_jar`: 1 per 1s

But `validateRateLimit` uses a **single 60-second rolling window** for every action key (`cutoff = now - 60000`, line 258). So:
- `hide_wish` cap is `1` — looks right, but over 60s. OK.
- `attempt_wish_discovery` cap is `120` — spec was 20 per 10s = effectively a burst cap. The current implementation lets an attacker fire **120 discovery probes back-to-back in 1 second**, then nothing for 59s. That's 120 probes in one burst which trivially enumerates all 7 spots x several triggers, blowing past "20 per 10s" spec.
- `tap_wish_jar` cap is `60` over 60s — same flaw: 60 taps can be fired in a single tick.

The `wishSystem.hideCooldowns` 10s cooldown (line 167) partially saves `hide_wish` but does not apply to the other two.

**Fix:** introduce a proper rolling-window check parameterised by window length, and call it for the wish events:

```js
// validation.js — new helper
static checkRollingWindow(playerId, action, maxInWindow, windowMs, rateLimits) {
    if (!playerId || typeof playerId !== 'string') throw new ValidationError('bad pid');
    if (playerId.length > 100 || action.length > 50) throw new ValidationError('key too long');
    const key = `${playerId}:${action}:${windowMs}`;
    const now = Date.now();
    const arr = (rateLimits.get(key) || []).filter(t => t > now - windowMs);
    if (arr.length >= maxInWindow) {
        throw new ValidationError('Rate limit exceeded', 'rateLimit');
    }
    arr.push(now);
    rateLimits.set(key, arr);
    return true;
}
```

Call sites in `server.js`:
- `hide_wish` (line 4050): `checkRollingWindow(pid, 'hide_wish', 1, 60000, rateLimits)` — replaces the current call.
- `attempt_wish_discovery` (line 4157): `checkRollingWindow(pid, 'attempt_wish_discovery', 20, 10000, rateLimits)` — replaces.
- `tap_wish_jar` (line 4243): `checkRollingWindow(pid, 'tap_wish_jar', 1, 1000, rateLimits)` — replaces.

Leave the 60s global cap in place as a secondary cap (the new keys are distinct so both run).

The `server-redis.js` copy **already does this correctly** via `checkWishRateLimit(pid, action, max, windowMs)` at lines 593/679/739 — so the fix here is to bring `server.js` up to parity.

---

### P1-2. `hideCooldowns` grows unbounded across every player in every room
**Severity:** P1
**File:** `backend/wishSystem.js:67, 189`, `backend/server.js:88`

`const wishSystem = new WishSystem();` is a **process-wide singleton** (server.js:88, server-redis.js:59). Its `this.hideCooldowns` Map is never cleared and accumulates one entry per distinct `playerId` that ever calls `hideWish`, across every room, for the lifetime of the process. `serialize()` (line 469) even persists this forever.

Player IDs are 40+ char random strings, so at 100 bytes per entry × N unique players forever, this is a steady memory leak plus a slowly-growing save payload. Not exploitable in a single session but degrades long-running deployments.

**Fix:** periodically prune entries older than the cooldown. In `wishSystem.js`, add a cheap trim at the top of `hideWish` and at the end of `expireWishes`:

```js
_pruneHideCooldowns(now) {
    const stale = now - 60000; // 60s is the widest cooldown anyone cares about
    for (const [pid, ts] of this.hideCooldowns) {
        if (ts < stale) this.hideCooldowns.delete(pid);
    }
}
```

Call `this._pruneHideCooldowns(Date.now())` at the start of `expireWishes` (called every 8s by the decay loop) and drop `hideCooldowns` from `serialize()` entirely (it's an in-memory rate-limit, it should not be persisted).

---

### P2-1. `WishSystem.sanitize` accepts arbitrary `playerId` keys from disk
**Severity:** P2
**File:** `backend/wishSystem.js:84-98`

`sanitize` iterates `Object.entries(state.activeWishes)` and copies every entry whose shape looks right, using the saved `pid` as the output key. It never validates that `pid` matches the `validatePlayerId` format (`/^player_[a-z0-9]+_[a-z0-9]+$/`). If a save file is tampered with (or a future bug writes weird keys), `activeWishes` can end up with keys like `__proto__`, `constructor`, empty string, or 50KB-long junk.

Prototype-pollution risk is mitigated because `Object.entries` returns own-keys only and the code uses bracket assignment, but object key size is unbounded which feeds the P0 broadcast once the server is fixed to only send the *caller's own* wish (an attacker-controlled save with a huge key would still bloat the persisted JSON).

**Fix (wishSystem.js sanitize):** before `out.activeWishes[pid] = ...`, add:
```js
if (typeof pid !== 'string' || !/^player_[a-z0-9]+_[a-z0-9]+$/.test(pid)) continue;
if (pid === '__proto__' || pid === 'constructor' || pid === 'prototype') continue;
```

Also clamp `message` stored length defensively: the existing `substring(0, 140)` is fine, but also strip control chars on load (in case an old save was written before `validateWishMessage` existed):

```js
let msg = w.message.replace(/[\x00-\x1F\x7F]/g, '').substring(0, DEFAULTS.MAX_MESSAGE_LEN);
if (msg.length === 0) continue;
out.activeWishes[pid] = { ..., message: msg, ... };
```

---

### P2-2. `validateWishMessage` does not strip zero-width / bidi unicode tricks
**Severity:** P2
**File:** `backend/validation.js:209-231`

The regex `/[\x00-\x1F\x7F]/g` strips ASCII controls but leaves zero-width joiners (`U+200D`), zero-width spaces (`U+200B`), RTL override (`U+202E`), and other unicode bidi characters. These don't produce XSS (the reveal path escapes HTML correctly — see `frontend/game.js:12121`), but they let an attacker render a wish that appears empty, says the opposite of what was sent, or looks like a different length than 140 to the counter. Since `send_love_note` predates V4 this may be a pre-existing gap, but the wish path is new so fix it here.

**Fix:**
```js
// strip ASCII + common unicode "trick" characters
cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
// zero-width + bidi overrides + format chars
cleaned = cleaned.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
```

Also consider NFC-normalising (`cleaned = cleaned.normalize('NFC')`) so `e + combining-acute` and `é` count the same towards the 140 cap; at minimum count length with `Array.from(cleaned).length` rather than `.length` so surrogate-pair emoji count as 1 char per visible glyph.

---

### P2-3. `get_my_wishes` and `cancel_wish` have no rate limit
**Severity:** P2
**Files:** `backend/server.js:4105-4121` (`get_my_wishes`), `backend/server.js:4123-4148` (`cancel_wish`), same pair in `server-redis.js:631-667`.

`get_my_wishes` does zero rate-limiting and fires `socket.emit('my_wishes', ...)`; a client can spam it hundreds of times a second to amplify server CPU and network egress. `cancel_wish` is de-facto bounded by the 1/60s `hide_wish` limit (you can't cancel something you can't hide) BUT when the player has no wish it returns silently — an attacker can still spam the handler and force a `room.gameState.wishSystem` read per call.

**Fix:** apply the new `checkRollingWindow` to both — e.g., `get_my_wishes` at 10/10s, `cancel_wish` at 5/60s. Same in `server-redis.js`.

---

### P2-4. `message` length check races the HTML-strip regex
**Severity:** P2
**File:** `backend/validation.js:214-228`

`validateWishMessage` strips HTML tags via `/<[^>]*>/g` and then clamps to 140. If an attacker sends a 1 MB payload full of `<x>` tokens, the regex engine will still process the whole 1 MB string before the substring clamp trims it. Not catastrophic (V8 handles this quickly) but the check order lets large payloads consume CPU before the length gate.

**Fix:** reject oversized payloads *before* regex work:
```js
if (typeof message !== 'string') throw new ValidationError('must be string');
if (message.length > 1000) throw new ValidationError('Wish too long', 'message'); // generous reject-before-regex gate
let cleaned = message.replace(/<[^>]*>/g, '');
// ... rest as before
```
Do the same in `server-redis.js` `sanitizeWishMessage` (line 480).

---

### P3-1. Confusing comment: `hide_wish` "1/60s global" comment says 1/60s, code says 60s window / max 1 — it's correct but the in-module 10s cooldown contradicts it
**Severity:** P3
**File:** `backend/wishSystem.js:153-174` + `backend/validation.js:273-276`

Spec: `hide_wish`: 1 per 60s. Code: global 60s window max 1 (correct) AND a separate in-module 10s cooldown (stricter than spec in one direction, looser in the other — if someone clears the global cache, the 10s fallback lets them hide 6x per 60s). Pick one.

**Fix:** delete the `hideCooldowns` 10s cooldown entirely once the P1-1 rolling window is in place — the global limit is already authoritative. Keeps the code simpler and kills the P1-2 memory-leak source.

---

### P3-2. `wish_jar_opened` memory entry uses `registered` as participants, which may include disconnected players
**Severity:** P3
**File:** `backend/server.js:4297-4299`

`memoryManager.recordCooperativeAction(room.roomCode, 'wish_jar_opened', registered, [])` — `registered = room.getRegisteredPlayerIds()` returns all keys of `room.players` regardless of `.connected`. In a stale-ghost scenario (partner left without cleaning up) this credits the ghost. Low impact — memories aren't currency — but it's inconsistent with the registerTap logic which requires both players to actually tap.

**Fix:** feed only the two players whose taps opened the jar. The jar's `pendingTaps` keys are exactly that pair; pass those from `registerTap` through to the handler (extend the opened-result payload with `tappedBy: [pid1, pid2]`).

---

### P3-3. `attempt_wish_discovery` rate-limit failures silently dropped
**Severity:** P3 (info / UX)
**File:** `backend/server.js:4157-4161`

```js
try { GameValidator.validateRateLimit(...) } catch { return; }
```

Silently dropping is intentional per the comment ("don't surface a scary 'slow down' on normal play"), but this also hides abuse. An attacker firing 10,000 probes/sec looks identical to a normal player. Consider incrementing a per-socket `suspicious` counter and disconnecting after N drops in a minute, same as the connection-limit path (`checkConnectionLimit`).

---

## FRONTEND FIXES

### No P0/P1 frontend issues found.

The frontend correctly escapes every server-provided string before DOM insertion:

- Reveal modal text (`game.js:12121`): `escapeHtml(data.message)` → `$('wishRevealText').innerHTML = safeMsg`.
- Reveal modal author (`game.js:12122-12126`): `escapeHtml(data.fromPlayerName)` before concatenation.
- Active wish preview (`game.js:12084`): `escapeHtml(where)` + `escapeHtml(w.message)` before `innerHTML`.
- Wearable id in jar-opened toast (`game.js:12293`): `escapeHtml(r.wearableId)`.
- Spot-option label in hide modal grid (`game.js:12026`): `escapeHtml(sp.label)`.

`escapeHtml` handles `& < > " '` — correct for HTML-context. Since only HTML-context is used (no attribute interpolation with user text, no script/style sinks), this is sufficient.

Client also sanitizes before sending (`sanitizeWishText`, game.js:11997), but — correctly — treats server as authoritative and does not rely on this.

### P3-4. Client sends both `spotId` and `triggerAction` when hiding — `triggerAction` is wire-unused
**Severity:** P3
**File:** `frontend/game.js:12094-12104`

`submitWish` stores `selectedTrigger` locally and only sends `{ spotId, message }` (good — matches spec). The `triggerAction` hint added by the UI is never transmitted for `hide_wish` (correct) but the UI forces the user to pick one on the hide modal (line 12094-12097 rejects submit if not set). That's just a UX choice, not security. No fix needed; logging here for transparency.

### P3-5. `onWishJarOpened` toast uses client-received `rewards.loveTokens` directly
**Severity:** P3 (trust boundary nit)
**File:** `frontend/game.js:12291-12300`

`const lt = r.loveTokens || 0;` is used to display `+${lt} love tokens`. The value comes from `wish_jar_opened` emitted by the server (server.js:4307) — but the server does NOT put `loveTokens` on that payload (only `gems` and `wearableId`; see `_resolveJarSuccess` wishSystem.js:392-404). So `lt` is always 0 in the current code. Not a security issue — just a dead-value display bug the frontend agent should clean up (either hard-code 5 per spec, or the backend agent should add `loveTokens: 5` to the rewards object).

---

## Verified (clean)

- **Auth gate on all 5 events.** Every handler in `server.js:4040-4320` starts with a `playerSockets.get(socket.id)` lookup and then `registered.includes(playerData.playerId)` check. Guests and sockets that haven't joined the room are rejected (or silently dropped for `attempt_wish_discovery`). Same in `server-redis.js:579-786`. The wish system module itself re-checks via `_requireRegisteredPlayer` (`wishSystem.js:144-148`).
- **Author ID is server-derived.** `hide_wish` uses `playerData.playerId` from `playerSockets.get(socket.id)` — never from the client payload. `authorId` on the wish record is set server-side (`wishSystem.js:182`).
- **Client timestamp on `tap_wish_jar` is ignored.** Handler comment at `server.js:4258-4259` explicitly notes this; `wishSystem.registerTap` uses `Date.now()` exclusively (`wishSystem.js:350, 361`).
- **Jar double-open race.** `_resolveJarSuccess` and `_resolveJarFailure` both re-check `state.currentJar.jarId === jar.jarId` before mutating (wishSystem.js:386-389, 409-411) and null the jar atomically before emitting rewards. Node's single-threaded event loop means the tap → check → null-out sequence cannot be interleaved. `registerTap` additionally guards against same-player re-tap via `if (jar.pendingTaps[playerId] == null)` (line 360).
- **Double-reward guarded.** After `currentJar` is nulled, a third tap gets `{ success: false, code: 'no_jar' }` and the handler does not credit gems again.
- **Author cannot discover own wish.** `tryDiscoverAt` explicitly `continue`s on `pid === playerId` (wishSystem.js:258).
- **Spot-ID enum.** `validateWishSpotId` whitelists exactly the 7 spec spots; `validateWishTriggerAction` whitelists 9 gameplay actions; both called before state mutation (`server.js:4073, 4171-4172`). The wish system itself re-checks (`wishSystem.js:158, 240`) — belt and suspenders.
- **Trigger-action allowlist prevents discovery enumeration.** `SPOT_TRIGGER_ACTIONS` restricts which actions can reveal at which spot (wishSystem.js:18-26); an attacker can't just probe every (spot, action) pair — only the legitimate gameplay pairings are accepted.
- **Message sanitation.** `validateWishMessage` strips HTML tags + ASCII control chars + trims + clamps to 140 server-side BEFORE storage. Called at `server.js:4074`.
- **Persistence safety.** `WishSystem.sanitize` is called on every legacy-save load (`server.js:606`, `server-redis.js:437`) and produces a fresh default on any malformed input — corrupt save files can't crash boot. `gameState.js` already sanitizes room codes against path traversal.
- **Room isolation.** `listPublicRooms` (gameState.js:278-311) never exposes `wishSystem` fields. All wish handlers scope to `rooms.get(playerData.roomCode)` and operate only on that room's `gameState.wishSystem`.
- **Secrets not logged.** No wish message text hits stdout/stderr. Error logs use sanitised error messages only (`server.js:4100`).
- **Reward minting server-side.** `loveTokens`, `gems`, and `wearableId` are all computed in `_resolveJarSuccess` from constants in `WISH_WEARABLE_POOL` / `DEFAULTS`. Client never supplies reward values.
- **Frontend escapes all server-provided strings before DOM insertion.** See "No P0/P1 frontend issues found" section above.
- **No unbounded per-room lists in `gameState.wishSystem`.** `recentDiscoveries` capped at 20 (`MAX_RECENT_DISCOVERIES`) and additionally filtered to a 24h window by `expireWishes`. `activeWishes` is keyed by playerId so at most 2 entries per 2-player room. `pendingTaps` capped by registered players.

---

## Summary for fix agents

Backend agent, in priority order:
1. (**P0-1**) Redact `wishSystem.activeWishes` per recipient in `broadcastGameState()` and in `joined_room` / `room_created` payloads, both in `server.js` and `server-redis.js`.
2. (**P1-1**) Replace the single-60s-window rate limits for `hide_wish` / `attempt_wish_discovery` / `tap_wish_jar` with proper rolling-window checks parameterised by spec window lengths.
3. (**P1-2, P3-1**) Add `_pruneHideCooldowns` called from `expireWishes`, drop `hideCooldowns` from `serialize()`, consider removing the duplicative 10s in-module cooldown once the 60s global is authoritative.
4. (**P2-1**) Tighten `WishSystem.sanitize` to validate playerId key format and scrub control chars on load.
5. (**P2-2**) Extend `validateWishMessage` to strip zero-width + bidi unicode characters and NFC-normalise.
6. (**P2-3, P2-4**) Add rate limits to `get_my_wishes` / `cancel_wish` and a 1000-char fast reject to `validateWishMessage` before regex.
7. (**P3-2, P3-3**) Minor: use tap pair as memory participants; track suspicious-drops on `attempt_wish_discovery`.

Frontend agent:
- No security fixes required.
- (**P3-5**) Optional cleanup: `onWishJarOpened` reads `rewards.loveTokens` that the backend never sends; either hard-code the spec value of 5 in the toast or request that the backend agent add `loveTokens: 5` to `_resolveJarSuccess`.

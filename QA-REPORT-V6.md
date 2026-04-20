# Bunny Family Game — QA Report V6

**Date:** 2026-04-20
**Feature under audit:** Whispered Wishes / Wish Jar (V4)
**Inputs audited:**
- `RESEARCH-REPORT-V4.md` §8 (12 QA cases)
- `BACKEND-REPORT-V4.md` + `backend/wishSystem.js`, `backend/server.js`, `backend/server-redis.js`, `backend/validation.js`, `backend/gameState.js`
- `FRONTEND-REPORT-V4.md` + `frontend/game.js`, `frontend/index.html`

---

## Test case matrix

| # | Test | Verdict |
|---|---|---|
| 1  | Happy path hide + discover (garden/harvest)              | **PASS** |
| 2  | Solo player cannot open jar                              | **PASS** |
| 3  | Simultaneous tap succeeds                                | **PASS** (with UX gap — see F-1, F-2) |
| 4  | Sync miss fails gracefully, 60s cooldown                 | **PASS** |
| 5  | Legacy save migration (pre-V4 save → empty wishSystem)   | **PASS** (with minor `authorId` drop on sanitize — B-5) |
| 6  | Message sanitization (`<script>`, profanity, 500 chars)  | **PASS** for HTML/ctrl-chars/length; **FAIL** for profanity (B-3) |
| 7  | Invalid spotId rejected                                  | **PASS** |
| 8  | Rate limit (2×`hide_wish` in 10s)                        | **PASS** |
| 9  | Wish expiry via decay loop                               | **PASS** (stale HUD — F-3) |
| 10 | Reconnect mid-jar — jar overlay re-renders               | **FAIL** — frontend never consults `gameState.wishSystem.currentJar` on load/reconnect (F-4) |
| 11 | Double-tap protection (1 player rapid-taps)              | **PASS** (noisy but correct) |
| 12 | Room isolation                                           | **PASS** |

Additionally a first-class **FAIL** was found that the 12-case checklist doesn't cover:

- **Discovery spot/action mismatch** — the frontend's `ACTION_SPOT_MAP` emits spot↔trigger combos that the backend's `SPOT_TRIGGER_ACTIONS` rejects. Wishes hidden at `cave` can **never** be discovered through any in-game action; and `feed+pile`, `play+garden`, `play+shelf`, `pet+pad`, `pet+cave`, `sleep+cave` are all wasted client emits (B-1 / F-5, **P0**).

---

## Severity counts

- **P0 (blocks feature):** 1
- **P1 (breaks core flow):** 2
- **P2 (degraded UX):** 4
- **P3 (polish):** 4

Top blocker: the ACTION_SPOT_MAP / SPOT_TRIGGER_ACTIONS mismatch — half the hiding spots can never produce a discovery, so the jar condition can never be met from normal play for many spot choices (and `cave` is completely unreachable).

---

## BACKEND FIXES

### B-1 [P0] Frontend/Backend discovery-trigger allowlist mismatch (cross-cutting)
- **Where:** `backend/wishSystem.js:18-26` (`SPOT_TRIGGER_ACTIONS`) vs. `frontend/game.js:12336-12343` (`ACTION_SPOT_MAP`).
- **Bug:** The two maps disagree on nearly every non-trivial spot. Examples:
  - `cave`: backend allows only `cave_enter`/`cave_exit`. Frontend never emits those (nothing calls `attemptDiscoveryFor('cave_enter')`). Cave wishes are **undiscoverable**.
  - `pad`: backend allows only `sleep`; frontend emits `pet+pad`, `sleep+pad`. Client `pet+pad` is wasted.
  - `pile`: backend allows `harvest`, `pet`; frontend emits `feed+pile`, `harvest+pile`. Client `feed+pile` is wasted.
  - `garden`: backend allows `harvest`, `water`; frontend emits `play+garden`, `harvest+garden`. Client `play+garden` wasted.
  - `shelf`: backend allows `pet`; frontend emits `play+shelf`, `pet+shelf`. Client `play+shelf` wasted.
- **Fix:** Pick ONE authoritative list. Recommended: widen the backend allowlist so players can discover wishes through multiple plausible actions, matching spec §2 phrase "feeding, harvesting, petting, etc.". Suggested unified map:
  ```js
  // backend/wishSystem.js
  const SPOT_TRIGGER_ACTIONS = {
      bowl:   ['feed'],
      garden: ['harvest', 'water', 'play'],
      pad:    ['sleep', 'pet'],
      pile:   ['harvest', 'pet', 'feed'],
      shelf:  ['pet', 'play'],
      shadow: ['pet', 'play'],
      cave:   ['sleep', 'pet', 'cave_enter', 'cave_exit']
  };
  ```
  Then update `validation.js:197` whitelist to include everything used (it already does). Frontend ACTION_SPOT_MAP is then consistent with what the backend will actually accept.
- **Tag:** BACKEND (primary) + FRONTEND sanity check.

### B-2 [P1] Reconnect mid-jar — server does not re-emit `wish_jar_ready` on rejoin
- **Where:** `backend/server.js:776-804` (`addPlayer`, reconnect branch), `backend/server-redis.js` equivalent.
- **Bug:** The reconnecting socket gets the current `gameState` (which contains `wishSystem.currentJar`) but never a `wish_jar_ready` event. Combined with F-4 below (frontend doesn't read `gameState.wishSystem`), the reconnecting client never sees the jar overlay again even though it's active for up to 10 min.
- **Fix:** In `addPlayer`'s reconnect branch (line 779-783), after setting `connected=true`, check `if (this.gameState.wishSystem?.currentJar && this.gameState.wishSystem.currentJar.expiresAt > Date.now())` and `io.sockets.sockets.get(socketId)?.emit('wish_jar_ready', { jarId, expiresAt })` so the returning client re-renders. Mirror in `server-redis.js`.
- **Tag:** BACKEND. Pair with F-4.

### B-3 [P2] Profanity filter missing in `validateWishMessage`
- **Where:** `backend/validation.js:209-231`.
- **Bug:** Spec §3 and §7.1 require profanity filtering "via existing validation.js hook" for parity with `send_love_note`. The V4 implementation strips HTML and control chars but never runs a profanity filter. Test case 6 explicitly includes profanity. There is no existing profanity hook in `validation.js` either.
- **Fix:** Either (a) accept the spec deviation and update `BACKEND-REPORT-V4.md` noting no profanity filter exists, or (b) add a simple bad-word list substitution to `validateWishMessage`, shared by `sanitizeMessage` and any future text input. Low-scope recommendation: add a shared `filterProfanity(str)` helper that replaces entries from a small curated list with `***`.
- **Tag:** BACKEND.

### B-4 [P2] `hide_wish` clamps oversize messages instead of rejecting
- **Where:** `backend/validation.js:224-229`.
- **Bug:** Test case 6 expects "backend rejects length" for a 500-char submission. Current code silently truncates. Functionally safe (clamped clean text is stored) but diverges from the stated rejection behavior and the spec §7.6 ("reject larger payloads with existing validator").
- **Fix:** Change to `throw new ValidationError('Wish message too long (max 140)', 'message')` when `cleaned.length > 140`.
- **Tag:** BACKEND.

### B-5 [P2] `WishSystem.sanitize` drops `authorId` from `activeWishes`
- **Where:** `backend/wishSystem.js:79-98`.
- **Bug:** On reload, `activeWishes[pid]` is rebuilt without an `authorId` field. Since the map key is the author ID, `tryDiscoverAt` still works (it uses the key as `authorId`), but downstream consumers who trust `wish.authorId` (e.g. future memory-log enrichment) silently see `undefined`. Also `recentDiscoveries` entries are filtered only for `wishId: string` — any entry with missing `authorId` is carried through as-is, which will silently skip the author in `checkJarCondition` if corrupted.
- **Fix:** In the sanitize branch that rebuilds `activeWishes`, include `authorId: pid` (or preserve `w.authorId` if a valid string). In the `recentDiscoveries` filter, require `typeof d.authorId === 'string'`.
- **Tag:** BACKEND.

### B-6 [P2] `tap_wish_jar` rate limit in `server.js` is 60/min, not 1/s as spec says
- **Where:** `backend/validation.js:277-281`; `backend/server.js:4243`.
- **Bug:** `validateRateLimit` uses a rolling 60s window with max 60. That allows bursts of 60 taps in the first second followed by nothing for the next 59. The spec says 1/s. Idempotency in `registerTap` protects correctness, but the intended 1/s cadence is not enforced. `server-redis.js:739` correctly uses a 1s window with max 1, so the two servers disagree.
- **Fix:** Add a 1s-window sub-check specifically for `tap_wish_jar` (or switch the whole rate-limit module to a window-per-action model). Simplest patch: in `server.js:4236` handler, additionally call a new `checkWishTapBurst(playerId)` that returns false when the last tap from that player was <1000ms ago.
- **Tag:** BACKEND.

### B-7 [P3] `expireWishesAndNotify` doesn't notify authors their wish expired
- **Where:** `backend/server.js:1320-1336`.
- **Bug:** `wishSystem.expireWishes` returns `{ expiredWishIds, expiredJarId }` but the server only broadcasts jar expiry. Author never gets a `wish_expired` / `my_wishes` refresh, so the HUD counter stays at 1 until the player reopens the hide modal. UX drift only.
- **Fix:** For each expired wish, emit a lightweight `wish_expired { wishId }` to the author (reuse `emitToPlayer`). Frontend listener drops it from `myActiveWishes` and calls `updateHUD()`.
- **Tag:** BACKEND (pairs with F-3).

### B-8 [P3] `server-redis.js` has a bare-bones implementation that diverges from `server.js`
- **Where:** `backend/server-redis.js:577-786`.
- **Bug:** Noted discrepancies: different rate-limit window for `tap_wish_jar` (see B-6), different cave_trigger validation list (server-redis has the same list — ok), no game-loop wiring for `expireWishesAndNotify` (server-redis does not run the decay loop, so wishes never expire, jars never auto-expire). Whether server-redis is production-live is unclear, but the asymmetric event registration means the two servers deliver different UX to the same client. No `wish_jar_expired` is broadcast server-side from expiry in redis mode.
- **Fix:** Mirror the decay-loop integration from `server.js:1320-1336` into the redis path. If `server-redis.js` is dead code, delete the V4 handlers from it to prevent drift.
- **Tag:** BACKEND.

### B-9 [P3] `wish_jar_tapped` broadcast does not fire for the 2nd (winning) tap
- **Where:** `backend/server.js:4268-4274`.
- **Bug:** Only the 'waiting' status broadcasts `wish_jar_tapped`. When the 2nd tap arrives it immediately resolves to 'opened' — so the first player never sees the "partner tapped" animation and countdown stop cleanly; they go straight from their-own-tap-only to jar-opened. Minor motion jank.
- **Fix:** Emit `wish_jar_tapped` for the 2nd tap BEFORE the success resolution, or include a `partnerTapped: true` flag in the `wish_jar_opened` payload. Simpler: always emit `wish_jar_tapped { jarId, tappedBy }` when a new `playerId` is recorded, regardless of whether it triggers resolution.
- **Tag:** BACKEND (trivial fix).

---

## FRONTEND FIXES

### F-1 [P1] Jar overlay is not restored on reconnect / page reload
- **Where:** `frontend/game.js:703-715` (`onGameStateUpdate`), `frontend/game.js:651-688` (`onJoinedRoom`), `frontend/game.js:11967+` (`WishUI`).
- **Bug:** `gameState.wishSystem.currentJar` arrives on every `game_state_update` but the frontend never reads it. If a player reloads mid-jar, the jar is invisible on their screen — even though `tap_wish_jar` would still work against the server.
- **Fix:** In `onGameStateUpdate`, call `WishUI.syncFromGameState(newGameState.wishSystem)`. Implement `syncFromGameState(ws)` in WishUI that:
  - If `ws?.currentJar` is present and not expired, and `state.jar` is null, call `showJar({ jarId, expiresAt })`.
  - If `state.jar` exists but server no longer has a jar (or jarId differs), call `hideJar()`.
  - Replace `state.myActiveWishes` from `ws.activeWishes[myPlayerId]` (only own).
- **Tag:** FRONTEND. Pairs with B-2 but either fix alone is enough if implemented completely.

### F-2 [P2] `wish_jar_tapped` for 2nd tap missing in payload; frontend assumes partner tap animation fires
- **Where:** `frontend/game.js:12274-12286` (`onWishJarTapped`), relies on backend emitting for both taps.
- **Bug:** See B-9. Frontend also sets `state.jar.partnerTapped = true` only on receiving the event; if the 2nd tap resolves to 'opened' without a broadcast, the partner zone never visibly lights up for player 1. `onWishJarOpened` simply fades out.
- **Fix:** Defensive: inside `onWishJarOpened`, before the 1.8s fade, set both `wishJarZoneMe` AND `wishJarZonePartner` to `.tapped` class so the celebration shows both zones lit.
- **Tag:** FRONTEND (cosmetic safety net; real fix is backend B-9).

### F-3 [P2] HUD shows stale own-wish count after server-side expiry
- **Where:** `frontend/game.js:12320-12331` (`updateHUD`) + `WishUI` has no listener for server-initiated wish expiry.
- **Bug:** When the decay loop removes a stale wish (48h+ old), the server doesn't notify the author (B-7). Client keeps `myActiveWishes` populated and shows the badge indefinitely.
- **Fix (frontend half):** Add a `wish_expired` listener that removes the wish by id and calls `updateHUD() + renderActiveWishRow()`. Also: in `openHideModal` we already emit `get_my_wishes` — as a belt-and-braces refresh, schedule `get_my_wishes` every time the hide modal is opened AND on `partner_connected` so re-synchronization happens organically.
- **Tag:** FRONTEND (pair with B-7).

### F-4 [P0→P1] (see F-1)
Already covered by F-1 above. Listed separately in the original test matrix as test 10.

### F-5 [P2] ACTION_SPOT_MAP lacks cave discovery triggers (mirror of B-1)
- **Where:** `frontend/game.js:12336-12343`.
- **Bug:** The cave is shown as a hiding spot in the UI (spot-grid) but `ACTION_SPOT_MAP` has no entry that fires `attempt_wish_discovery` with `triggerAction: 'cave_enter'` or `'cave_exit'`. Players can hide wishes at cave; they can never be found.
- **Fix:** After B-1 widens backend triggers, the frontend is already fine. If we keep the narrow backend list, add explicit `attemptDiscoveryFor('cave_enter')` and `attemptDiscoveryFor('cave_exit')` calls inside `toggleCave`'s `cave_entered`/`cave_exited` emit branches (`frontend/game.js:1362` & `:1387`), with a new `ACTION_SPOT_MAP` entry `cave_enter: ['cave'], cave_exit: ['cave']`. Either fix works; B-1 (widen backend) is simpler.
- **Tag:** FRONTEND (or BACKEND via B-1, pick one).

### F-6 [P3] Wish modals have no Escape-key close; hide/reveal modals trap focus but have no keyboard close affordance
- **Where:** `frontend/index.html:1923-1980`, `frontend/game.js:12404-12440` (`bindButtons`).
- **Bug:** Modals have `role="dialog" aria-modal="true"` but no focus trap, no initial-focus move, no Escape keydown handler to close. Keyboard users cannot easily dismiss.
- **Fix:** In `bindButtons`, add `document.addEventListener('keydown', e => { if (e.key==='Escape') { closeHideModal(); closeReveal(); }})` — do NOT close the jar with Escape (misclick risk). On overlay `.show`, focus the primary action button.
- **Tag:** FRONTEND.

### F-7 [P3] Wearable reward displays the raw id ("toy_ball")
- **Where:** `frontend/game.js:12293`.
- **Bug:** On jar success, frontend displays the raw `wearableId` string as-is. That's a code identifier, not a label.
- **Fix:** Look up `SHOP_ITEMS[wearableId]?.name` (or similar pretty-name map already used in the closet UI) and display that; fall back to the id.
- **Tag:** FRONTEND.

### F-8 [P3] Hide-modal "trigger action" picker fires zero actual wire effect
- **Where:** `frontend/game.js:12037-12051` + `submitWish`.
- **Bug:** The selected trigger is validated client-side only (`if (!state.selectedTrigger)` guards submit). It is not sent in `hide_wish`. This forces the user through an extra click with no functional outcome. Confusing UX.
- **Fix:** Either drop the trigger picker (simplest, matches spec §4) or use it as an optional hint that's only used to narrow client-side shimmer. Recommendation: remove the "2. How your partner could find it" row from `#wishHideOverlay` and remove the `selectedTrigger` guard in `submitWish`.
- **Tag:** FRONTEND.

### F-9 [P3] Speculative `wish_shimmer_hint` listener never fires — shimmer feature dead code
- **Where:** `frontend/game.js:12267-12272`, `12362-12401`.
- **Bug:** `FRONTEND-REPORT-V4.md` §deviations acknowledges that no server emit feeds this. Result: shimmer is never visible; ~40 lines of render code are permanently inert. Not a regression (silent), but misleading for anyone reading the code.
- **Fix:** Either delete the shimmer code path or wire up a backend emit (out of scope for this fix agent). Low priority cleanup.
- **Tag:** FRONTEND.

---

## Generic / regression observations (not test-case-tied)

- **Socket event parity** — `server.js` and `server-redis.js` both register all 5 client events. `server-redis.js` does NOT run a decay loop, so jars never auto-expire in that path (see B-8). If `server-redis.js` is live in any environment, test 9 (wish expiry) **FAILS** there; in the `server.js` path it passes.
- **Stale game state after discovery** — `broadcastGameState()` IS called after discovery (line 4229) and after jar open (line 4312). Good. However the server-redis path's discovery handler calls `broadcastGameState` (line 719) but the frontend doesn't re-render wish HUD from gameState. HUD relies on per-event `wish_*` listeners firing — they do fire correctly in both paths.
- **Race on game-loop expiry vs. in-flight tap** — `expireWishesAndNotify` runs every 8s. If a jar expires at the same time a 2nd tap lands, two handlers race. `registerTap` reads `state.currentJar`, checks `now > jar.expiresAt` and null-outs — but the decay loop may have already nulled it, in which case `jar` is null and we return `{code:'no_jar'}` silently. Correct behavior. No bug.
- **Double-submit on `hide_wish`** — hide button is not disabled while the request is in flight. Rapid double-click fires two emits, second rejected by 1/60s rate limit. Cosmetic. Not filed.
- **Existing V3 saves** — `loadSavedGameState` runs `WishSystem.sanitize(gameState.wishSystem)` which returns `defaultState()` for missing field. No V3 field (coupleStats, gems, babies, etc.) was touched. V3 saves boot. Verified by reading the init block (lines 528-640).
- **Accessibility** — modals have aria-modal + aria-labelledby but no focus management or Escape; see F-6.
- **Co-op gate** — jar requires both `tappers` to be in `registeredPlayerIds` AND to have non-null `pendingTaps`. Idempotent per-player. Single-socket-hack path: if P2's socket is disconnected but playerId is still in `room.players.keys()`, P1 still can't tap alone (only one entry in `pendingTaps`). If P2 reconnects (same playerId) and taps, their entry is added. Cannot be bypassed from a single socket. Confirmed secure.
- **Cross-room** — handlers resolve `room` from `playerSockets.get(socket.id).roomCode` and operate only on that room's gameState. Confirmed isolated.

---

## Summary

Fourteen issues total: **1 P0**, **2 P1**, **4 P2**, **4 P3**. The single P0 (B-1 / F-5) is a cross-agent mismatch between the backend's trigger allowlist and the frontend's emit map that makes roughly half of the hiding-spot/action combinations inert and the `cave` spot completely undiscoverable — shippable but badly underdelivered on the advertised gameplay. The P1s are (1) reconnect-mid-jar loses the overlay entirely and (2) the author is never proactively told their wish expired. Fix B-1 first, then wire F-1 and B-2 (reconnect jar-ready), then the P2 cleanup (profanity filter, sanitize `authorId`, server.js tap rate-limit 1/s, stale HUD refresh).

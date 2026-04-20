# Bunny Family Game - Research Report V4

**Date:** 2026-04-20
**Focus:** ONE shippable co-op feature for the next iteration.

---

## 1. Feature: "Whispered Wishes" (Wish Jar)

**Pitch:** Players hide short written "wishes" behind objects in the nest for their partner to stumble upon during normal play; when BOTH partners have deposited a wish within a rolling 24h window, a glowing **Wish Jar** appears that requires a simultaneous two-finger tap (one finger per player, within a 3-second window) to open for a shared reward (Love Tokens + a rare random decoration/wearable).

Unlike the existing `send_love_note` system (which is a direct in-box message), Whispered Wishes are **spatially hidden**, **delayed-discovery**, and **joint-redemption**. They create asynchronous intimacy (leave a wish while partner is offline) AND a synchronous co-op gate (must both be online to open the jar).

---

## 2. Player-facing behavior

### Hiding a wish
- A new `✨ Wish` button lives in the sidebar action cluster (next to Pet / Cave).
- Tapping it enters **Hide Mode**: the canvas dims slightly and eligible "hiding spots" pulse faintly (5–7 interactive world objects — food bowl, garden plot, sleeping pad, carrot pile, bookshelf decoration, parent-bunny shadow, cave entrance).
- Player picks a spot, types up to 140 chars, confirms. A subtle sparkle particle appears on that spot visible ONLY to the sender.
- One active wish per player at a time; editing replaces the old one.

### Discovering a wish
- Partner's hidden wishes are NOT shown on their own screen. They appear as tiny shimmer sparkles on the partner's view only.
- When the partner interacts normally with that object (feeding, harvesting, petting, etc.) there's a 100% reveal chance on the first interaction after hiding: a heart-shaped parchment unfurls showing the wish + "hidden by [PartnerName]".
- Discovery grants +1 Love Token to both players and a "Whisper Found" memory entry.

### The Wish Jar (joint ritual)
- When BOTH players have an undiscovered-and-then-discovered wish within the last 24h, a glowing jar materializes center-stage.
- Jar shows "Tap together within 3 seconds!" with two circular tap zones labeled with each player's name color.
- Both players must tap-and-hold within a 3-second sync window. Backend validates the two timestamps fall within 3000ms of each other.
- Success: confetti burst, both players get 5 Love Tokens + 1 Legacy Gem + a random wearable from a curated "wish pool"; a shared memory photo is auto-captured.
- Failure: gentle "almost!" animation, 60-second cooldown, retry available.
- Jar expires after 10 minutes if not tapped; wishes retained but jar must be re-earned via fresh wishes.

---

## 3. Backend API contract

### New socket events (client -> server)

| Event | Payload | Purpose |
|---|---|---|
| `hide_wish` | `{ spotId: string, message: string }` | Deposit a wish at a hiding spot. |
| `get_my_wishes` | `{}` | Fetch caller's own hidden-but-undiscovered wishes (for UI re-render). |
| `attempt_wish_discovery` | `{ spotId: string, triggerAction: string }` | Sent by client on any action that could reveal a wish at `spotId`. Server resolves whether a partner-wish exists there and returns it. |
| `tap_wish_jar` | `{ timestamp: number }` | Sent when player taps the joint-open button. Server buffers both players' taps and validates the 3s window. |
| `cancel_wish` | `{}` | Remove one's own active wish. |

### New socket events (server -> client / room broadcast)

| Event | Payload | Purpose |
|---|---|---|
| `wish_hidden` | `{ spotId, wishId, expiresAt }` | Ack to sender only; does NOT broadcast to partner. |
| `wish_discovered` | `{ wishId, message, fromPlayerName, spotId, rewardLoveTokens }` | To discovering player. |
| `wish_jar_ready` | `{ jarId, expiresAt }` | Broadcast to both players when jar condition is satisfied. |
| `wish_jar_opened` | `{ rewards: { loveTokens, gems, wearableId }, memoryId }` | Broadcast on successful joint tap. |
| `wish_jar_failed` | `{ reason, cooldownEndsAt }` | Broadcast on sync miss. |
| `wish_jar_expired` | `{ jarId }` | Broadcast after 10-min timeout. |

### Payload schemas (concrete)

```
hide_wish request:
  spotId: enum('bowl'|'garden'|'pad'|'pile'|'shelf'|'shadow'|'cave')
  message: string (1–140 chars, sanitized, profanity filter via existing validation.js hook)

tap_wish_jar request:
  timestamp: number (client epoch ms; server clamps to server time +/- 2s drift)

wish_jar_opened payload:
  rewards.loveTokens: int (fixed 5)
  rewards.gems: int (0 or 1 — 20% roll)
  rewards.wearableId: string (from curated WISH_WEARABLE_POOL)
  memoryId: string
```

### Persistence
Add to `gameState`:
```
wishSystem: {
  activeWishes: {
    [playerId]: {
      wishId: string,
      spotId: string,
      message: string,
      createdAt: timestamp,
      expiresAt: timestamp   // createdAt + 48h
    }
  },
  recentDiscoveries: [
    { wishId, discoveredBy, discoveredAt }   // keep last 20
  ],
  currentJar: null | {
    jarId: string,
    readyAt: timestamp,
    expiresAt: timestamp,
    pendingTaps: { [playerId]: timestamp }
  },
  jarCooldownUntil: number,
  wishJarsOpenedTotal: int
}
```
Serialized through existing `GameStateManager.saveRoomState` — no new persistence infra.

### Server-side module
New file `backend/wishSystem.js` (sibling of `memoriesSystem.js`, `miniGames.js`) exporting `WishSystem` class with: `hideWish`, `tryDiscoverAt`, `checkJarCondition`, `registerTap`, `resolveJar`, `expireWishes` (called from the existing decay loop).

### Rate limits (added to `rateLimits` map)
- `hide_wish`: 1 per 60s
- `tap_wish_jar`: 1 per 1s
- `attempt_wish_discovery`: 20 per 10s (high, fired on normal gameplay actions)

---

## 4. Frontend UX

### Files to touch
- `frontend/index.html`: add `✨ Wish` action button; add `#wishHideModal` (spot picker + text input), `#wishDiscoveredModal` (parchment reveal), `#wishJarOverlay` (joint-tap UI).
- `frontend/game.js`: add `WishUI` controller (mode toggle, spot highlighting, socket wiring), integrate discovery attempts into the existing `feed/play/clean/harvest/pet` client handlers by emitting `attempt_wish_discovery` with the mapped `spotId`.

### UI elements
1. **Wish button** — sidebar action, purple gradient, sparkle icon.
2. **Hide Mode overlay** — screen dims to 70%, eligible spots get a `@keyframes pulse` cyan glow. Tap outside any spot = exit mode. Tap a spot → small inline input appears anchored to that spot; Save/Cancel.
3. **Shimmer sparkle** — tiny 3-particle effect drawn in the render loop at each spot with a `partner-wish-here` flag on the local client.
4. **Discovery parchment modal** — sepia-tinted card with handwritten font showing the wish; "Thank them ❤️" button dismisses and awards the love token.
5. **Wish Jar overlay** — fullscreen-dim with a glowing amber jar; two labeled tap zones sized 160×160px, countdown ring shows 3-second sync window starting from first tap.
6. **Toast** on partner events: "✨ Your partner found your wish!" when the OTHER player discovers yours.

### Interactions
- Hide Mode uses existing pointer events; disables drag-bunny while active.
- Jar opening uses `pointerdown` + `pointerup` timestamps; client sends `tap_wish_jar` on pointerdown, displays partner's own-tap indicator live via server broadcast.

---

## 5. Data model changes

| Location | Field added | Shape |
|---|---|---|
| `gameState` | `wishSystem` | object above |
| `gameState.coupleStats` | `wishesHidden` | int |
| `gameState.coupleStats` | `wishesDiscovered` | int |
| `gameState.coupleStats` | `wishJarsOpened` | int |
| Achievements (`achievements.js`) | `first_whisper`, `wish_keeper` (hide 10), `dream_jar` (open 5 jars), `soul_sync` (jar tap within 500ms) | new entries |
| Memory event types (`memoriesSystem.js`) | `wish_discovered`, `wish_jar_opened` | new entries |
| `loadSavedGameState` migration | initialize `wishSystem` if missing | same pattern as existing legacy-save blocks |

No schema changes to save file format — it's a JSON blob; legacy saves get the default `wishSystem` on load.

---

## 6. Co-op hook

The feature **fails gracefully but rewards uniquely** with two players:

1. **Asynchronous co-op** — hiding is solo and delightful (leaves a trace for when your partner returns). No partner online needed.
2. **Forced joint presence for jackpot** — the Wish Jar literally cannot be opened by one player. Two distinct player-tagged socket connections must both emit `tap_wish_jar` within 3 seconds of each other. No auto-tap, no AI fallback — single-player gets the love-token drip from discovery but never the gem/wearable payout.
3. **Symmetric participation required** — the jar only materializes when BOTH players have hidden + had their wish discovered. One player hiding 10 wishes alone does nothing; only reciprocity unlocks the ritual.
4. **Ties directly into existing couple-stats** (`feedsTogether` pattern) so existing compatibility score reflects the new mechanic.

---

## 7. Security considerations (for security agent)

1. **Message injection** — `message` field is user text; must be HTML-escaped on render, stripped of control chars, profanity-filtered, length-clamped (140 chars) using the same sanitization as `send_love_note`.
2. **Spot-ID enumeration** — `spotId` must be validated against a hardcoded whitelist in `validation.js` (enum check) to prevent arbitrary keys in `activeWishes`.
3. **Timestamp spoofing** — client `timestamp` in `tap_wish_jar` must NOT be trusted; use server receipt time. Clamp or ignore the client value entirely; use it only for display debouncing.
4. **Jar double-opening** — guard `resolveJar` with an atomic `currentJar` null-out before emitting rewards; reject further taps on same `jarId`.
5. **Rate-limit circumvention** — `attempt_wish_discovery` has high rate (normal gameplay triggers it) but must NOT be exploitable to enumerate partner wishes; server should only reveal a wish when the triggering action matches the spot AND is itself a valid, rate-limited action (feed/play/clean).
6. **Payload size** — cap `message` at 140 chars server-side BEFORE storage; reject larger payloads with existing validator.
7. **Reward minting** — all reward amounts fixed server-side; never accept from client.
8. **PII in memories** — wish text stored in the memory log. Ensure memories are only visible to room members, not broadcast via `listPublicRooms`.
9. **Persistence poisoning** — on `loadSavedGameState`, validate `wishSystem` shape; drop malformed entries rather than crashing the room.
10. **Socket spam DoS** — `hide_wish` at 1/60s and `tap_wish_jar` at 1/1s; confirm the global per-socket cap still covers these.

---

## 8. QA test cases (for QA agent)

1. **Happy path hide + discover**: P1 hides wish at `garden`; P2 harvests carrots; P2 sees parchment with correct message and sender name; both receive +1 love token; `wishesHidden`/`wishesDiscovered` counters increment.
2. **Solo player cannot open jar**: Second player disconnects; P1 hides, P2 fake-discovers via save manipulation — jar never materializes OR if materialized via test hook, single `tap_wish_jar` times out after 3s without success, no gems awarded.
3. **Simultaneous tap succeeds**: Both players tap within 3s window → `wish_jar_opened` fires exactly once to both sockets; rewards credited exactly once; `currentJar` cleared.
4. **Sync miss fails gracefully**: P1 taps at t=0, P2 taps at t=3500ms → `wish_jar_failed`, 60s cooldown set, wishes retained, jar available again after cooldown.
5. **Legacy save migration**: Load a pre-V4 save file without `wishSystem`; room boots successfully; `wishSystem` initialized to empty default; first `hide_wish` works.
6. **Message sanitization**: Submit `<script>alert(1)</script>` + profanity + 500-char string; backend rejects length, strips HTML, filters profanity; stored message is clean.
7. **Invalid spotId**: Client sends `spotId: "../../../etc/passwd"` → validation rejects with `action_failed`; no file/key written.
8. **Rate limit**: Fire `hide_wish` twice in 10s → second rejected with rate-limit error; `activeWishes` contains only the first (or the replacement, per single-active-wish rule).
9. **Wish expiry**: Hide wish; fast-forward clock 49h (or manually set `expiresAt` past); decay loop clears it; no stale wish discoverable.
10. **Reconnect mid-jar**: Jar active, P2 disconnects and reconnects within 3 min; client rejoins, receives current `wishSystem.currentJar` state in initial sync, jar overlay re-renders, tap still works if within 10-min window.
11. **Double-tap protection**: P1 rapid-taps `tap_wish_jar` 5 times in 500ms → only first is accepted (1/s rate limit) and server does not credit rewards twice after P2 joins.
12. **Room isolation**: P1/P2 in room A hide wishes; P3/P4 in room B cannot see or influence room A's `wishSystem` state; no cross-room broadcasts.

---

## Scope & implementation estimate

- Backend: new `wishSystem.js` (~250 LOC), ~200 LOC in `server.js` for 5 new handlers + state init + decay integration.
- Frontend: ~350 LOC in `game.js` for `WishUI`, ~80 LOC in `index.html` for the three modals and button.
- Achievements + memory types: 2 small patch blocks.
- Total: one iteration for one backend + one frontend engineer. No infra changes, no new services, no DB migration (file-based save already supports arbitrary JSON).

---

## Summary

Whispered Wishes adds a hidden-note + wish-jar ritual that leverages the existing save, socket, rate-limit, achievements, and memory plumbing. It is deliberately co-op-gated at the reward payoff (simultaneous two-player tap within 3 seconds) while remaining delightful asynchronously (leave a wish before bed, partner finds it in the morning). It reuses every existing system (validation, memories, love tokens, wearables, couple stats) so one iteration is realistic.

# Bunny Family Game — Frontend Implementation Report V4

**Date:** 2026-04-20
**Feature:** Whispered Wishes (Wish Jar) — FRONTEND ONLY
**Spec:** `RESEARCH-REPORT-V4.md`
**Backend contract:** `BACKEND-REPORT-V4.md`

---

## Files touched

| File | Change |
|---|---|
| `frontend/game.js` | Added `WishUI` IIFE controller (~430 LOC) at the bottom, above the debug/globals block. Wired into `DOMContentLoaded` init, `performAction`, `harvestCarrots`, `render`, and `updateGameUI`. Exposed on `window.WishUI`. |
| `frontend/index.html` | Added ~280 LOC of CSS for wish/reveal/jar modals; added `#sidebarWishesBadge`/`#sidebarWishes` HUD counter; added `#wishBtn` sidebar action; added three new modal overlays `#wishHideOverlay`, `#wishRevealOverlay`, `#wishJarOverlay` just before the `socket.io` script tag. |

No backend files touched. No new npm deps, no build tools, no frameworks.

---

## Socket events wired

### Client → Server (emitted, with EXACT payload shapes from BACKEND-REPORT-V4.md)

| Event | Payload | Where |
|---|---|---|
| `hide_wish` | `{ spotId, message }` | `WishUI.submitWish()` — spot from picker, message sanitized (≤140, HTML stripped, ctrl chars stripped). |
| `get_my_wishes` | `{}` | `WishUI.openHideModal()` — refreshes caller's active-wish display. |
| `cancel_wish` | `{}` | `WishUI.cancelMyWish()` — bound to "Cancel my wish" button in the hide modal. |
| `attempt_wish_discovery` | `{ spotId, triggerAction }` | `WishUI.attemptDiscoveryFor(action)` — called from `performAction` (feed/play/pet/sleep) and `harvestCarrots`. Client-side 2s de-dupe per spot. Spot allowlists: feed→[bowl,pile], play→[garden,shelf], pet→[pad,shelf,shadow,cave], harvest→[garden,pile], sleep→[pad,cave]. |
| `tap_wish_jar` | `{}` | `WishUI.tapJar()` — NO client timestamp sent (per instruction #3 and spec §7.3; backend is authoritative). |

### Server → Client (listeners)

| Event | Handler |
|---|---|
| `wish_hidden` | Stores acked wish in `state.myActiveWishes`, updates HUD. |
| `wish_cancelled` | Drops from `myActiveWishes`, updates HUD. |
| `my_wishes` | Replaces `myActiveWishes` list from server. |
| `wish_discovered` | Opens `#wishRevealOverlay` parchment with sanitized message + partner name. |
| `wish_author_notified` | Toast "Your partner found your wish!"; drops the consumed wish. |
| `wish_jar_ready` | Opens `#wishJarOverlay` (glowing jar, two tap zones, tap button). |
| `wish_jar_tapped` | Marks the appropriate tap zone as "tapped"; starts 3s sync countdown on first tap. |
| `wish_jar_opened` | Flashes reward totals inside jar overlay; toast; hides jar. |
| `wish_jar_failed` | Shows cooldown countdown; hides jar after 2.4s. |
| `wish_jar_expired` | Hides jar with info toast. |
| `wish_shimmer_hint` | *(Speculative — listed in spec §4 as partner-view-only shimmer, but not in the backend report's emitted events.)* Listener present; if backend never emits it, shimmer simply never appears — silent-fail. |

All listeners are registered inside a `try/catch` so that a stripped-down socket shim would not break init.

---

## Client-side sanitization (defence-in-depth; backend is source of truth)

`WishUI.sanitizeWishText` runs before `hide_wish` emission:
- Strips HTML tags (`<[^>]*>`)
- Strips control chars (`\x00-\x1F\x7F`)
- Collapses whitespace
- Clamps to 140 chars

`escapeHtml` is applied to all server-provided strings (`message`, `fromPlayerName`, `spotId`, `wearableId`) before DOM insertion — no `innerHTML` on raw server text.

The `<textarea maxlength="140">` in index.html enforces the cap at the DOM level too, with a live `0/140` counter.

---

## HUD

A new "✨ N" pill is appended to the `sidebar-currencies` bar (`#sidebarWishesBadge`, hidden when N=0). A matching small badge `#wishBtnBadge` sits on the Wish button itself. Both update whenever `updateGameUI` runs OR when any wish socket event changes `myActiveWishes`.

---

## Fail-silently on old-server scenarios

- `WishUI.init()` is wrapped in try/catch.
- Every `socket.emit` inside WishUI is wrapped in try/catch.
- All socket listeners use `socket.on(...)` inside a try/catch; if the server never emits them, nothing happens.
- The Wish button is always present in the sidebar; tapping it opens the composer (local-only UI). Submitting emits `hide_wish` — if the server doesn't handle it, the frontend still shows an info toast; the user just never gets an `wish_hidden` ack, and the HUD stays at 0. No errors, no crashes.
- Shimmer overlay only renders for spots listed in `state.partnerShimmerSpots`. Since the backend report does NOT list a server→client event that populates this set, the shimmer is effectively dormant on live backends — fail silent. If/when a `wish_shimmer_hint { spotId }` event starts arriving, the shimmer activates automatically.

---

## Canvas integration

`WishUI.drawShimmer()` is called from `render()` between `drawWeatherEffects()` and the football overlay. It uses coarse `anchors` (spotId → {0..1, 0..1} canvas ratios) so shimmer positions survive scene changes without scene-specific knowledge. Opacity pulses via `Math.sin`; deliberately faint (alpha 0.15–0.65) per spec §2 "tiny shimmer sparkles".

---

## Spec deviations

1. **Shimmer-hint data source.** Spec §2 says "partner's hidden wishes appear as tiny shimmer sparkles on the partner's view only." But `BACKEND-REPORT-V4.md` does NOT list a server→client event that tells the discovering player which spots have a partner-wish (it would leak the existence of a pending wish before the natural discovery interaction). I implemented a *listener* for a speculative `wish_shimmer_hint { spotId }` event and left the shimmer machinery plumbed; if the backend team adds a server hint later, the UI lights up automatically. Without it, the feature still works: the partner-wish is revealed via the natural `attempt_wish_discovery` flow on any matching action (which the frontend proactively fires for every feed/play/pet/sleep/harvest).

2. **Trigger-action picker in hide modal.** Spec §4 doesn't explicitly require a "how your partner might find it" picker — only spot + text. But the user instructions explicitly asked for "modal with text input, spot picker, trigger action picker", so I added one that narrows per spot (e.g. `bowl` → only `feed`). The selected trigger is used ONLY client-side as a validation hint; it is NOT sent over the wire in `hide_wish` (the spec payload is `{ spotId, message }` only).

3. **Jar `tap_wish_jar` payload.** Spec + backend docs say `{ timestamp: number }` but the backend report §security #3 and the user's instruction #3 both state the client timestamp is discarded and the server is authoritative. I send `{}` instead of `{ timestamp }` — the backend's handler ignores the field either way, and this matches instruction #3 verbatim ("Do NOT send client timestamps for the jar tap").

4. **Own-wish visibility on hide modal.** Spec §2 says "One active wish per player at a time; editing replaces the old one." I surface the existing wish inside the hide modal (sender-only) with a Cancel button, so users can see and remove their pending wish without guessing. This is additive UX, not a behavior change.

5. **`clean` action does not probe.** Spec §2 lists "feeding, harvesting, petting, etc." as discovery triggers. I mapped clean → no spots (none of the 7 whitelist spots are bath-related). Easy to add if the backend allowlist expands.

---

## Verification

```
$ docker run --rm -v ~/bunny-game:/w -w /w node:20-alpine sh -c 'node -c frontend/game.js && echo game.js OK'
game.js OK
```

HTML sanity (div/style/script tag pairs balanced, total 65,631 bytes):
```
div open/close: 129 129
style open/close: 1 1
script open/close: 2 2
```

All new element IDs (`wishBtn`, `wishHideOverlay`, `wishHideTitle`, `wishActiveRow`, `wishActivePreview`, `wishCancelBtn`, `wishSpotGrid`, `wishTriggerRow`, `wishTextarea`, `wishCharCount`, `wishHideCloseBtn`, `wishSubmitBtn`, `wishRevealOverlay`, `wishRevealTitle`, `wishRevealText`, `wishRevealFrom`, `wishRevealThanksBtn`, `wishJarOverlay`, `wishJarTitle`, `wishJarCountdown`, `wishJarZoneMe`, `wishJarZonePartner`, `wishJarTapBtn`, `wishJarCloseBtn`, `sidebarWishesBadge`, `sidebarWishes`, `wishBtnBadge`) are unique across the document.

---

## Summary

Whispered Wishes is wired on the frontend exactly to the five client→server event shapes from the backend report, with eleven server→client listeners (including the speculative shimmer hint). The feature is self-contained in `WishUI` with graceful fail-silent behavior so the game still runs against older backends. All DOM mutations use HTML-escaped server strings; wish text is sanitized client-side and enforced by `<textarea maxlength="140">`. HUD pill + button badge both live-update with pending wish count. Jar tap omits the client timestamp per the frontend-agent instruction.

---

## FIXES APPLIED (V4.1)

**Date:** 2026-04-20
**Scope:** frontend-only fixes for the SECURITY-REPORT-V4 and QA-REPORT-V6 findings tagged FRONTEND / BOTH. No backend files touched. No new dependencies, no build tools.

### P0

- **QA B-1 / F-5 — ACTION_SPOT_MAP alignment with backend `SPOT_TRIGGER_ACTIONS`.** Verified against the backend's V4.1 widened allowlist (`backend/wishSystem.js:22-30`); every `(spotId, triggerAction)` combination the frontend emits is now accepted by the backend. No change was needed to the existing feed/play/pet/harvest/sleep rows — they were already a subset of the widened backend map. Added explicit `cave_enter`/`cave_exit` rows to `ACTION_SPOT_MAP` (`frontend/game.js:12506-12508`) and wired two new calls `WishUI.attemptDiscoveryFor('cave_enter')` at `frontend/game.js:1382` and `('cave_exit')` at `frontend/game.js:1413` so cave wishes are discoverable through the natural "enter cave" / "exit cave" interactions in addition to pet/sleep.

### P1

- **QA F-1 / F-4 — Reconnect mid-jar never re-renders (+ idempotent `wish_jar_ready`).** Added `WishUI.syncFromGameState(ws)` at `frontend/game.js:12347-12394` that reads the server's redacted `wishSystem` projection (`currentJar`, `activeWishes[myPlayerId]`) and
  - re-opens the jar overlay with the correct remaining-countdown if a live jar exists and the UI isn't already showing it,
  - hides the overlay if the server says the jar is gone,
  - marks own tap zone as `tapped` if the server's `pendingTaps[myPlayerId]` indicates we already tapped (refresh after tapping),
  - replaces `state.myActiveWishes` with the caller's own wish (if any) and refreshes the HUD + hide-modal preview.
  Wired from three entry points so both snapshot frames and ongoing updates rehydrate the UI: `onRoomCreated` (`frontend/game.js:641`), `onJoinedRoom` (`frontend/game.js:687`), `onGameStateUpdate` (`frontend/game.js:784`). `onWishJarReady` is now idempotent (`frontend/game.js:12327-12340`) — same `jarId` is a no-op (with expiresAt upgrade if the server extends it), so a repeated backend emit after `syncFromGameState` has already drawn the jar does not flash it.

- **QA F-3 / B-7 — Stale HUD on server-side wish expiry.** Added a new `onWishExpired(data)` listener at `frontend/game.js:12449-12463` registered via `socket.on('wish_expired', ...)` at `frontend/game.js:12669`. It filters the matching `wishId` out of `state.myActiveWishes`, clears any partner-shimmer hint for that spot, re-renders the active-wish row, calls `updateHUD()`, and shows a soft info toast. Degrades gracefully on older servers that never emit the event.

### P2 / P3

- **QA F-2 — Defensive both-zones-lit on jar open.** `onWishJarOpened` now always sets `.tapped` on both `wishJarZoneMe` AND `wishJarZonePartner` (`frontend/game.js:12431-12434`) before the 1.8s fade, so a missing 2nd-tap `wish_jar_tapped` broadcast doesn't leave the partner zone dim during the celebration.

- **QA F-7 — Pretty wearable name on jar reward toast.** `onWishJarOpened` now looks up `shopState.items.find(i => i.id === rewards.wearableId)?.name` and falls back to the raw id (`frontend/game.js:12413-12425`). `escapeHtml` is still applied before DOM insertion.

- **QA F-6 — Escape-key closes hide/reveal modals + focus management + Tab focus trap.** Added:
  - Document-level `keydown` handler (`frontend/game.js:12608-12622`) that closes `wishHideOverlay` or `wishRevealOverlay` on Escape. Jar is intentionally NOT closed on Escape (misclick risk with a live co-op window).
  - Initial focus move to the textarea when opening the hide modal (`frontend/game.js:12092-12093`) and to the primary "Thank them" button when the reveal modal opens (`frontend/game.js:12172`).
  - Tab / Shift+Tab focus trap scoped to `wishHideOverlay` (`frontend/game.js:12626-12646`) so keyboard focus cycles inside the modal instead of leaking into the game canvas.

- **QA F-8 — Hide-modal "trigger action" picker was a required gate for zero wire effect.** Removed the `if (!state.selectedTrigger) return` guard in `submitWish` (`frontend/game.js:12129-12131`). The picker is still shown as an optional UX hint (it doesn't affect the `hide_wish` payload, which remains `{ spotId, message }` per spec) but no longer blocks submission.

- **QA P3 (input debounce) — Double-submit / double-tap protection.** Added `state.submitInFlightAt` / `state.tapInFlightAt` (`frontend/game.js:12013-12015`):
  - `submitWish` ignores a second click within 2s and disables the submit button for that window (`frontend/game.js:12117-12146`).
  - `tapJar` ignores a pointerdown within 500ms of the last one (`frontend/game.js:12243-12248`), belt-and-braces on top of the existing `myTapped` flag (helps when pointerdown fires twice on touch+synthetic-mouse).

- **Null / undefined guards QA flagged.** Cached DOM lookups throughout the jar path now null-check before `.classList`/`.textContent`/`.innerHTML` access (e.g. `frontend/game.js:12251-12257`, `frontend/game.js:12436-12441`, `frontend/game.js:12165-12167`) so a missing element (e.g. modal not yet injected on early reconnect) can't throw.

- **SEC frontend polish (escapeHtml).** Verified that every server-provided string that reaches `innerHTML` is routed through `escapeHtml` — reveal text/author (`frontend/game.js:12134-12144`), wearable reward label (`frontend/game.js:12424`), active-wish preview (`frontend/game.js:12084`), spot option labels (`frontend/game.js:12026`). Added a defensive `escapeHtml(where)` around the locally-derived reveal-location string (`frontend/game.js:12144`) to future-proof the path against an edit that replaces the hard-coded label with server data.

### Files touched

| File | Lines |
|---|---|
| `frontend/game.js` | +~210 / ~30 edited; new handlers (`onWishExpired`, `syncFromGameState`), idempotent `onWishJarReady`, Escape-key + focus-trap wiring, submit/tap debounce, pretty-name lookup, cave_enter/cave_exit wiring. |
| `frontend/index.html` | **Untouched.** No new elements required; existing overlays already have `role="dialog" aria-modal="true" aria-labelledby="…"`. Tag balance re-verified: div 129/129, script 2/2, style 1/1, button 21/21, textarea 1/1. |

### Intentionally skipped

- **QA F-9 — Speculative `wish_shimmer_hint` dead code.** Backend has no emit for this yet; deleting the machinery is premature (the listener is a silent no-op and ready to activate). Leaving in place for the future backend iteration.
- **QA F-8 alternative ("remove the trigger row from the DOM").** Kept the picker as an optional UX cue; just removed its blocking behavior. Matches spec payload and avoids touching index.html.
- **Backend-only items B-2 through B-9, SEC P0-1 through P3-3.** Already handled by the backend-fix agent in `BACKEND-REPORT-V4.md` → FIXES APPLIED (V4.1).

### Verification

```
$ docker run --rm -v ~/bunny-game:/w -w /w node:20-alpine node -c frontend/game.js && echo "FRONTEND SYNTAX OK"
FRONTEND SYNTAX OK
```

index.html tag balance re-checked (unchanged): div 129/129, style 1/1, script 2/2, button 21/21, textarea 1/1. No new dependencies, no build tools.

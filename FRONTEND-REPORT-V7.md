# Frontend Report — V7 Bubble Bath Duet

**Specialist:** Frontend
**Date:** 2026-05-05
**Spec:** RESEARCH-REPORT-V7.md §A.3, §A.4 (locked).

## Files touched
- `frontend/game.js` — bath state, listeners, emitters, draw routines, hotspot handling
- `frontend/index.html` — CSS custom properties for tub theming (no DOM additions)

## Changes by region

### `bathState` (new client mirror)
Tracks `active`, `bathId`, `reason`, `expiresAt`, `holdMs`, `holdElapsedMs`, `paused`, `pauseReason`, `graceUntil`, `stations.{sponge,tap}` (server-broadcast holders), `myStation` (this client's locally-pressed station), and `sudsParticles` for the visual overlay. Reset to inactive on `bath_resolved` or fresh `bath_available`.

### `shopState.items` — new entry
- `bubble_bath` added: `{ id: 'bubble_bath', name: 'Bubble Bath', price: 6, icon: '🛁', desc: 'Co-op duet — fills the tub!' }`. Reuses the existing `buy_item` / `use_item` flow, no new shop UI.

### Five new socket-event listeners (routed via `onGameEvent` switch)
- `bath_available` → `onBathAvailable(data)`: arms client state, shows toast.
- `bath_grab_station` → `onBathGrabStation(data)`: updates `bathState.stations[station]`. Surfaces a "redirected" toast when server fires the 50 ms tiebreaker.
- `bath_release_station` → `onBathReleaseStation(data)`: clears the station; if `reason === 'grace_expired'` for `myPlayerId`, also clears `myStation`.
- `bath_progress` → `onBathProgress(data)`: updates pause flag, grace timer, and `holdElapsedMs`/`holdMs`.
- `bath_resolved` → `onBathResolved(data)`: shows resolution-specific toast (success / partial / failed_solo / failed_timeout / cancelled / server_reset), tears down the tub UI.

### Two new emitters (press-and-hold semantics)
- `socket.emit('bath_grab_station', { station })` from `emitBathGrab`. Triggered on `pointerdown` / `touchstart` if the press lands inside a hotspot.
- `socket.emit('bath_release_station', { station })` from `emitBathRelease`. Triggered on `pointerup`, `touchend`, `mouseleave` (via the existing `onPointerUp` path).

### Pointer / touch routing
`onPointerDown`, `onTouchStart`: if `bathState.active && bathHotspotAtPoint(x,y)` returns a station, emit grab and **short-circuit** the existing bunny-drag start. Otherwise the original drag flow runs.
`onPointerUp`, `onTouchEnd`: always release `bathState.myStation` first, then run the original `endDrag()`.

### Render pipeline additions
- `drawTub()` registered in `render()` between `drawWeatherEffects()` and `drawUI()`. Renders nothing when `bathState.active` is false, so cost is one boolean check on idle frames.
- `drawTubHotspots()`: two circular hotspots (Sponge 🧽 left, Tap 🚿 right), each colored differently based on holder identity (idle / mine / partner).
- `drawSudsParticles()`: spawns up to 40 suds particles inside the tub while both stations are held by **different** players and not paused. Particles ascend and decay each frame.
- `drawBathProgressArc()`: 14 px circular gauge above the tub, fills clockwise as `holdElapsedMs/holdMs` ratio. Stroke turns orange when paused.
- `drawBathStatusBanner()`: contextual one-liner above the gauge — "Both grab a station and HOLD!" / "Hold steady…" / "Waiting for the other station…" / "Partner dropped — waiting (8 s grace)".

### `getBathLayout()` — geometry
Tub spans the lower meadow strip: 55 % canvas width (max 360 px), 22 % height (max 120 px), centered horizontally, 20 px above bottom. Hotspots are circles of radius `min(36, tubH * 0.4)` placed inside the tub at left/right margins. All geometry uses CSS pixels (consistent with the rest of the canvas, which is `dpr`-scaled in `resizeCanvas`).

### `index.html` CSS
Eight CSS custom properties added under `:root` — `--bath-tub-fill`, `--bath-tub-stroke`, `--bath-water`, `--bath-suds`, `--bath-progress-track`, `--bath-progress-fill`, `--bath-progress-paused`, `--bath-station-mine`, `--bath-station-partner`, `--bath-station-idle`. No DOM additions; the tub is canvas-rendered. CSS tokens are present so future themers can override without touching JS.

## Acceptance-case traceability
1. **Golden path** — tub renders, both hotspots highlight, suds spawn while both held, progress arc fills to full, `bath_resolved { success }` triggers green toast and streak announcement.
2. **Partial** — release on one side; arc freezes mid-fill; on `bath_resolved { partial }` the info toast announces the cleanliness gain.
3. **failed_solo** — only the player's hotspot lights, no progress, eventual `bath_resolved { failed_solo }` shows an error toast.
4. **8 s grace** — `bath_progress { paused: true, reason: 'partner_dropped' }` switches the banner to grace label and turns the arc orange.
5. **server_reset** — handled by the same `onBathResolved` path with the dedicated message.
6. **Cooldown** — entirely server-driven; the client just shows whatever `bath_available` tells it.
7. **Concurrent station claim** — server-resolved; the client gets a `bath_grab_station { redirected: true }` event and shows the redirect toast.
8. **Cave exclusion** — client just renders the tub; the participating-baby filter is server-side.

## Syntax check
```
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c frontend/game.js   # OK
```
(`index.html` is HTML so a JS syntax check isn't applicable — only CSS additions inside `<style>`.)

## Known limitations / deferred
- The tub overlay relies on the canvas being visible. If a modal (shop, customizer) opens over the canvas, the bath UI is occluded but socket events still fire — clicking through is impossible until the modal is closed. Acceptable for V7 scope; could be fixed in V7.1 with an explicit "Bath in progress" indicator on the action bar.
- Suds particles use `Math.random()`-driven spawning rather than a deterministic count — visual difference between the two players' clients is cosmetic only.

## FIXES APPLIED (V7.1)

No frontend P0/P1 audit findings — Q-7, Q-8, Q-9 in QA-REPORT-V7 are all P3 informational. The progress-arc smoothness improvement (`getInterpolatedHoldElapsed` between server `bath_progress` events) was applied during initial implementation in response to recognising the 8 s game-loop cadence, not as a post-audit fix; documented here for completeness:
- `bathState.holdElapsedAtServerTime` tracks the local time of the last server-confirmed `holdElapsedMs` update.
- `getInterpolatedHoldElapsed()` adds `now - holdElapsedAtServerTime` to the server value while both stations are held and not paused, producing smooth arc fill instead of 8 s stair-stepping.
- `drawBathProgressArc()` consumes the interpolated value.

### Re-syntax-check
```
docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c frontend/game.js   # OK
```

### Deferred (not fixed this iteration)
- **Q-7 / Q-8 / Q-9 [P3]** — informational only.

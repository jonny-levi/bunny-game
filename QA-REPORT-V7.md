# QA Report — V7 Bubble Bath Duet

**Specialist:** QA
**Date:** 2026-05-05
**Method:** Code-walk audit of the 8 acceptance cases against `backend/server.js` (V7 changes), `backend/memoriesSystem.js`, `frontend/game.js`, and `frontend/index.html`. No live server run.

## Severity legend
- **P0** ship-blocking
- **P1** must-fix this iteration
- **P2** non-blocking
- **P3** informational

## Acceptance-case walkthrough

### AC-1 Golden path — Both grab Sponge + Tap, hold 5 s
**Backend trace:** `bath_available` → `grabStation('sponge')` (player A) → `grabStation('tap')` (player B) → `_maybeStartBothHeld` arms `bothHeldStartedAt` → `tickBath` (every 8 s) calls `_flushHoldDelta` → `holdElapsedMs >= 5000` → `resolveBath('success')` → `coupleStats.bathStreak += 1`, cleanliness +60 on participating babies, `bath_day` cooperative memory + auto-photo recorded via `memoryManager.createMemory`.
**Frontend trace:** tub renders, both hotspots colored mine/partner, suds spawn while both held, arc fills (with local interpolation between server ticks), `bath_resolved { success }` shows green toast naming the streak.
**Verdict:** PASS in code. **Note** that the actual game-loop interval is 8 s (`GAME_CONFIG.GAME_LOOP_INTERVAL`), so success is detected on the next tick after the 5 s threshold is crossed — there is up to an 8 s reaction lag on the server detection. The frontend interpolates so the user sees a smooth fill.

### AC-2 Partial credit — both held 2.5 s, then one releases
**Backend trace:** `releaseStation` calls `_flushHoldDelta` which credits the 2.5 s (since the last `bothHeldStartedAt` marker) into `holdElapsedMs`. After release, `bothHeldStartedAt` is 0; subsequent ticks accumulate nothing. On window timeout (`now > expiresAt`), `holdElapsedMs > 0 && < 5000` → `resolveBath('partial')`. Cleanliness gain = `round(60 * 2500/5000) = 30`. Streak unchanged. No memory entry.
**Verdict:** PASS in code.

**Q-1 [P2, BACKEND]** — `resolveBath` sets `stats.lastBathAt = now` on partial too, so the 10-min cooldown gate also applies after a partial. Spec text only requires the cooldown after a `success`. Mild over-restriction; defer to V7.1 unless user wants it loosened.

### AC-3 failed_solo — only Player A holds Sponge for 60 s
**Backend trace:** `everHeldAny = true`, `holdElapsedMs = 0` (other station never grabbed). On timeout: `holdElapsedMs > 0` false → `everHeldAny` true → `resolveBath('failed_solo')`. No cleanliness change, no streak change, no memory. Toast shown to both players.
**Verdict:** PASS in code.

### AC-4 Mid-bath disconnect with 8 s grace
**Backend trace:** Player B disconnects at t=2 s. `tickBath` (next 8s loop) detects `players.get(holderId).connected === false`, calls `_flushHoldDelta(now)` to credit any both-held progress, sets `graceUntil = now + 8000`, broadcasts `bath_progress { paused: true, reason: 'partner_dropped' }`. If B reconnects and re-grabs Tap before `graceUntil`, the new grab clears `graceUntil = 0`, and `_maybeStartBothHeld` re-arms `bothHeldStartedAt`. Hold resumes.
**Verdict:** PASS in code.

**Q-2 [P1, BACKEND]** — The grace detection lives inside `tickBath` which fires every 8 s. If B disconnects between two ticks, the grace window starts from the NEXT tick, not from the actual disconnect time. With `graceMs = 8000` and `GAME_LOOP_INTERVAL = 8000`, the effective wait could be up to ~16 s in the worst case. **Fix recommendation:** detect disconnects synchronously in the existing `socket.on('disconnect')` handler — when a player who currently holds a bath station drops, immediately call a helper like `room.handleBathHolderDisconnect(playerId)` that runs the same grace-arm logic. This brings the worst case to ~8 s. Worth fixing this iteration.

### AC-5 Server restart persistence — bath wiped, synthetic server_reset emitted
**Backend trace:** `loadSavedGameState` clears `gameState.bath`. If the loaded save had a non-null `bath`, sets `gameState._pendingBathServerReset = { bathId, participatingBabies }`. First `tickBath` after a player connects emits `bath_resolved { resolution: 'server_reset' }` and deletes the flag. No streak / no memory change. `gameState.bath` is null on save (since it was wiped on load and never restored).
**Frontend trace:** `onBathResolved` shows the server_reset toast. If the client had any leftover `bathState.active` from a previous session, the resolve path tears it down.
**Verdict:** PASS in code.

**Q-3 [P2, BACKEND]** — See SECURITY-REPORT-V7 S-2. The `_pendingBathServerReset` flag could be re-persisted by an auto-save before the first `tickBath` consumes it. Cosmetic only.

### AC-6 Cooldown enforcement
**Backend trace:** `checkBathTrigger` short-circuits when `now - lastBathAt < 600000`. `useShopItem` for `bubble_bath` calls `startBath('shop')` directly, bypassing `checkBathTrigger` and therefore the cooldown.
**Verdict:** PASS in code.

### AC-7 Concurrent station claim within 50 ms
**Backend trace:** Player A's `grabStation('sponge')` lands first, sets `bath.stations.sponge = A`, `bath.stationGrabAt.sponge = now1`. Player B's `grabStation('sponge')` arrives within 50 ms; finds `bath.stations.sponge = A`, computes `dt = now2 - now1`. If `dt <= 50 && bath.stations.tap === null`, redirects B to `tap` and broadcasts `bath_grab_station { station: 'tap', redirected: true }`.
**Verdict:** PASS in code.

**Q-4 [P3, BACKEND]** — Server-clock based; see SECURITY-REPORT-V7 S-4 for the same observation. No action.

### AC-8 Cave exclusion
**Backend trace:** `startBath` filters `participatingBabies` with `b.inCave !== true`. `resolveBath` re-checks `b.inCave !== true` before applying cleanliness gain (defensive — a baby could enter the cave between `startBath` and resolution).
**Verdict:** PASS in code.

## Cross-cutting observations

**Q-5 [P2, BACKEND]** — `_flushHoldDelta` is a stateful mutation on `gameState.bath`. Two concurrent calls within the same Node event-loop tick are impossible (single-threaded), so no atomicity concern. **No action.**

**Q-6 [P2, BACKEND]** — On a `success` resolution, `resolveBath` writes the bath_day memory through `memoryManager.createMemory({ type: 'cooperative', ... metadata: { memoryType: 'bath_day' } })`. The new `bath_day` event type registered in `memoriesSystem.js` is not consumed by the running server (the live path is `memoryManager`, file-backed). The metadata pin is enough for downstream filtering, but if memory listings expect the `'bath_day'` string in `type`, they will see `'cooperative'` instead. **Fix recommendation:** add a top-level `bathDay: true` flag in metadata and document that bath days are stored as `cooperative`. Defer to V7.1.

**Q-7 [P3, FRONTEND]** — `bathState.sudsParticles` is cleared on `onBathResolved`, but if a player navigates to a different scene mid-bath without resolution (no current path does this — the canvas is always present), the particles array could grow. Currently impossible. **No action.**

**Q-8 [P3, FRONTEND]** — When a modal (shop, customizer) is open, the canvas-rendered tub is occluded but socket events still fire. A player who opens the shop mid-bath cannot release their station until they close the shop. Acceptable for V7. **No action.**

**Q-9 [P2, FRONTEND]** — The frontend's `getCanvasCoordinates` divides by `dpr` and assumes input coords map 1:1 to drawing coords. `getBathLayout` uses `getBoundingClientRect()` directly. Confirmed both are CSS-pixel space, so hotspots align with input. Verified by inspection of `resizeCanvas` (`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`).

## Summary
- 0 × P0
- 1 × P1 (Q-2: handle disconnect synchronously to tighten grace timing)
- 3 × P2 (Q-1, Q-3, Q-6 — deferrable)
- 5 × P3 (informational)

**Recommended fix this iteration:** Q-2.

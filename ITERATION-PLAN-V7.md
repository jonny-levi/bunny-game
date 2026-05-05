# V7 Iteration Plan — Bubble Bath Duet

**Date:** 2026-05-05
**Manager:** bunny-game pipeline / Manager subagent
**Approval:** Option A (vanilla, no variant) — see APPROVAL-DECISION-V7.md.
**Locked spec:** RESEARCH-REPORT-V7.md §A.

## GitHub issue linkage
- `gh` CLI is not installed on this machine — no live `gh issue list` lookup possible.
- Linkage best-effort note: V6 / V7 research reports were standalone proposals; no pre-existing GitHub issue tracks the "Bubble Bath Duet" feature. If a tracking issue is desired post-merge, file it manually against `jonny-levi/bunny-game`. Marked **no issue linkage available** for this iteration.

## Phase order
1. **Plan (this document).**
2. **Implementation (parallel).** Backend + Frontend + DevOps. Each writes its own report and syntax-checks every file it touches via `docker run --rm -v "$PWD":/w -w /w node:20-alpine node -c <file>`.
3. **Audit (parallel).** Security + QA review the implementation reports and the diff. Severity: P0/P1/P2/P3, tagged BACKEND/FRONTEND/BOTH, with file:line references.
4. **Fix (parallel).** Backend-fix and Frontend-fix consume both audit reports, fix P0+P1, append `## FIXES APPLIED (V7.1)` to their original report. P2/P3 deferred unless trivial.
5. **Close.** Stage only V7-affected files. Commit `claude: v7 bubble bath duet (co-op cleanliness gate)`. Tag `bunny-v7-bath-duet`. Push to origin if the configured PAT works; otherwise leave commit local and flag in summary.

## File ownership

### Backend
- `backend/server.js`
  - `GAME_CONFIG` — add `BATH` config block (durations, cooldown, cleanliness gain, gracePeriod).
  - `GAME_CONFIG.SHOP.items` — add `bubble_bath` (cost 6 carrots, type `consumable`, effect `{ trigger_bath: true }`).
  - `initializeGameState()` — add `bath: null` and extend `coupleStats` with `bathsCompleted: 0, bathStreak: 0, lastBathAt: 0`.
  - `loadSavedGameState()` — migrate legacy `coupleStats` to add the three fields when missing; ensure `gameState.bath` is **always** dropped on load (transient).
  - New `GameRoom` methods: `checkBathTrigger()`, `startBath(reason)`, `grabStation(playerId, station)`, `releaseStation(playerId, station)`, `tickBath()`, `resolveBath(resolution)`. Hooked into the `startGameLoop` `updateFunctions` array.
  - 5 new socket handlers: `bath_grab_station`, `bath_release_station`. (`bath_available`, `bath_progress`, `bath_resolved` are server-emitted only — see §A.3.) Plus listener wiring for use-item path.
  - `useShopItem` for `bubble_bath` calls `room.startBath('shop')` bypassing cooldown.
- `backend/gameState.js` — no schema changes required; `gameState.bath` is transient. Comment-only update to call out the exclusion.
- `backend/memoriesSystem.js` — register a new `bath_day` event type in `initializeEventTypes()`. (Note: server.js currently routes through `memoryManager.js`, not `memoriesSystem.js`. Backend will also wire `bath_day` into `memoryManager.createMemory` directly so the event reaches the persisted memory log used by `get_memories`.)
- `backend/validation.js` — extend `validateGameAction` action whitelist with `bath_grab_station`, `bath_release_station`. Add `bath` rate-limit slot (e.g. 30/min).

### Frontend
- `frontend/game.js`
  - New `bathState` client object (mirrors server `gameState.bath`, plus local hold flag).
  - 5 new socket listeners: `bath_available`, `bath_grab_station`, `bath_release_station`, `bath_progress`, `bath_resolved`.
  - 2 new emitters: `bath_grab_station`, `bath_release_station`, with press-and-hold semantics on pointerdown / pointerup / pointercancel.
  - New draw routines: `drawTub()`, `drawTubHotspots()`, `drawSudsParticles()`, `drawBathProgressArc()`, called from `render()` only when `bathState` is active.
  - Toast surface for `bath_resolved` resolutions (`success | partial | failed_solo | failed_timeout | cancelled | server_reset`).
- `frontend/index.html`
  - CSS additions only — no DOM additions required (canvas-rendered tub). Add tub/suds/progress arc colors as CSS custom props if helpful, but otherwise CSS-only ambient styling.

### DevOps
- Confirm docker-compose.yml + k8s manifests don't need changes — V7 is a pure code feature inside an existing container.
- One-paragraph DEVOPS-REPORT-V7.md.

## Acceptance cases (from RESEARCH-REPORT-V7.md §A.4 — mandatory QA coverage)
1. **Golden path.** Both players grab Sponge + Tap, hold 5s. cleanliness +60, `bathStreak`→1, `bath_day` memory exists naming both players, auto-photo recorded.
2. **Partial credit.** Both grab, hold 2.5s, then one releases. cleanliness gains `round(60 * 2.5/5) = 30`, no streak, no memory.
3. **failed_solo.** Only Player A grabs Sponge for the 60s window. `bath_resolved { failed_solo }`, no cleanliness change, no penalty, A sees informational toast.
4. **Mid-bath disconnect with 8s grace.** B disconnects at t=2s elapsed. If B reconnects + re-grabs Tap within 8s, hold resumes from pause. Otherwise resolves to `partial`.
5. **Server restart persistence.** Kill server mid-bath → restart. Reconnecting clients get `bath_resolved { server_reset }`. `gameState.bath` absent from saves; no streak / no memory.
6. **Cooldown enforcement.** After `success`, server does NOT emit `bath_available` again until 10 minutes elapse; shop-item path bypasses cooldown.
7. **Concurrent station claim.** Both players tap the same station within 50ms. Tiebreaker by arrival timestamp; second arrival auto-redirected to the other station.
8. **Cave exclusion.** Babies with `inCave: true` are excluded from `participatingBabies` (cleanliness gains apply only to meadow babies).

## Constraints carried forward
- No infra surface change. Do not run multi-image build scripts (per `feedback_scoped_builds.md`).
- Commit + tag mandatory after implementation (per `feedback_commit_after_deploy.md`).
- No DM channel for subagents; reports are the only interface.
- If push auth fails or any other blocker, capture and continue.

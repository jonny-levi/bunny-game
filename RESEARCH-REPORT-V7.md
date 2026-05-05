# V7 Research Report

**Date:** 2026-05-05
**Researcher:** Bunny pipeline / Researcher subagent
**Iteration:** V7 (V5 and V6 were both prepared but never approved; V4 wish-jar code was reverted on master and is not present in the current backend or frontend — re-confirmed by greps for `wish`/`Wish`/`WISH` returning zero matches in `backend/` and `frontend/`)
**Status:** Awaiting user approval. Implementation has NOT started. No code edits in `backend/` or `frontend/` were made by this research pass.

---

## 0. Context recap (verified by reading current master)

Files audited:
- `backend/server.js` (3907 lines, HEAD `23ae6c4`)
- `backend/gameState.js` (279 lines)
- `frontend/game.js` (4309 lines)
- `frontend/index.html` (1450 lines)
- `git log --oneline -20`

**Currently shipped, stable surface:**

- **Care actions (parallel co-op with timing-bonus windows):** `feed_baby`, `play_with_baby`, `sleep_baby`, `clean_baby`, `pet_baby`, `hatch_egg` (handlers at `server.js` lines 2748–2933).
- **Carrot economy + sinks:** `harvest_carrots` (line 2935), shop (`get_shop_items` 3599, `buy_item` 3621, `use_item` 3646, `get_inventory` 3671), basket UI in frontend (`basketBtn`).
- **Movement & exploration:** `move_bunny` (3441), `cave_entered`/`cave_exited` (3497/3532), `discover_egg` (3570). Cave gives passive comfort bonuses (re-confirmed in `caveState` block at frontend lines 59–62).
- **Couple/social/cosmetic:** `send_love_note`, `get_love_letters`, `capture_photo`, `customize_bunny`, `get_couple_stats`.
- **Day/night cycle:** Toggles via timer at `server.js:1021–1059`. Reads as `gameState.dayNightCycle` ∈ `{day, night}`. Front-end uses it only to dim sky and render an icon (`game.js:1801,1878,2934`). Affects achievement counts and very rare rain (`server.js:1080`). Otherwise mechanically dead.
- **Personality system on babies:** Generated and validated server-side (`server.js:495–603`), influences decay & micro-effects (`getPersonalityMultiplier` 838, `applyPersonalityEffects` 872–906), and emitted in game state under `personalityInfo` per baby (`server.js:1660–1685`).
- **Mini-games (skeletal):** `start_minigame` / `submit_minigame_score` server handlers exist (`server.js:3329–3389`) and `backend/miniGames.js` is 25 KB of scaffolding.

**Surprises found that contradict prior reports:**

1. **Personality is invisible to players.** Server emits rich `personalityInfo` per baby, but `grep -i "personality" frontend/` returns zero matches — the frontend never reads, displays, or mentions it. Five iterations of personality-aware decay have shipped silently with the player having no way to learn their baby's personality. This is the single largest "shipped but invisible" surprise on the codebase.
2. **Mini-games are server-only.** `start_minigame` / `submit_minigame_score` exist in the server, but `grep "start_minigame\|enhanced_garden\|bunny_races\|memory_match\|cooperative_puzzle" frontend/` returns zero matches. The V6 report described them as "skeletal, scaffolded" — they are in fact completely unreachable from the UI. There is no button, no socket emit, no listener. They are dead code from the player's perspective.
3. **Day/night cycle is a backdrop, not a mechanic.** It changes the sky and bumps `playerData.stats.nightActions` for one achievement. No baby behavior, no gameplay variation, no shop variation, no spawn variation depends on it. V6's analysis treated it as already-meaningful; it isn't.
4. **No tutorial/onboarding.** `grep "tutorial\|onboard\|welcome\|first_time"` in frontend returns zero matches. New players land in `menuScreen` (index.html:1278) and immediately see Create/Join with no preface.
5. **Cleanliness gap from V6 still holds.** `clean_baby` (server.js:2848) is still a single-tap +stat with no ritual. V6's diagnosis is correct; it just hasn't been addressed.
6. **Co-op gating gap from V6 still holds.** Searched `getConnectedPlayerCount` usages: every two-player check is a *bonus* path (`if (… === 2) bonus++`), never a *gate*. There is still no verb that fails when only one player is present.

What's still missing in net terms across V1–V6 trajectory:
- Personality is hidden (regression of intent — it shipped without UI).
- Mini-games are unreachable.
- Day/night is cosmetic.
- No genuine co-op gate exists.
- Cleanliness is still the dead stat.
- No first-time onboarding for new couples.

V7 should pick one of these. Three candidates follow.

---

## Candidate A — Bubble Bath Duet (re-surface V6, lightly tightened)

### A.1 One-line pitch
When a baby gets really dirty, a shared bath tub appears in the meadow; the babies can only be fully cleaned if both players man their station (sponge + water tap) and hold for 5 seconds. Produces a sudsy "Bath Day" memory and a clean-streak bonus to couple-stats.

### A.2 Problem it solves
- Cleanliness is the dead stat (`backend/server.js:2848` — `clean_baby` is a 1-click bump with no ritual).
- No co-op verb fails when only one player is present (every `getConnectedPlayerCount() === 2` check is a bonus path, never a gate).
- No shared artifact event auto-produces a "you both did this" memory (`capture_photo` at `server.js:3148` is single-player initiated).

### A.3 Mechanic sketch
- Server: new transient `gameState.bath` lifecycle on the room object; trigger on `cleanliness < 30` inside the existing 8-second game loop or via shop item; new socket events `bath_available`, `bath_grab_station`, `bath_release_station`, `bath_progress`, `bath_resolved`. Both stations must be held simultaneously for 5s. Resolutions: `success`, `partial`, `failed_solo`, `failed_timeout`, `cancelled`, `server_reset`.
- Client: tub sprite in lower meadow with two press-and-hold hotspots, suds particle effect, progress arc.
- Persistence: three new `coupleStats` fields (`bathsCompleted`, `bathStreak`, `lastBathAt`) — already piggybacks on `gameState.js` save path. Bath itself is transient (not persisted).
- Memories: new `bath_day` memory type recorded into existing `memoriesSystem.js` pipeline.
- Optional shop item `bubble_bath` (cost 6 carrots) reuses `buy_item`/`use_item` plumbing.

### A.4 Acceptance cases
1. **Golden path:** Both players grab Sponge + Tap, hold for 5s. Cleanliness +60, `bathStreak` becomes 1, `bath_day` memory exists naming both players, auto-photo recorded.
2. **Partial credit:** Both grab, hold for 2.5s, then one releases until expiry. Cleanliness gains `round(60 * 2.5/5) = 30`, no streak increment, no memory entry.
3. **Single-player failed_solo:** Only Player A grabs Sponge. After 60s window, `bath_resolved { failed_solo }`, no cleanliness change, no penalty, A sees informational toast.
4. **Mid-bath disconnect with 8s grace:** B disconnects at 2s elapsed. If B reconnects and re-grabs Tap within 8s, hold resumes from pause. Otherwise resolves to `partial`.
5. **Server restart persistence:** Kill server mid-bath, restart. Reconnecting clients receive synthetic `bath_resolved { server_reset }`. `gameState.bath` absent from saves; no streak change, no memory write.
6. **Cooldown enforcement:** After a `success`, server does NOT emit `bath_available` again until 10 minutes elapse; shop-item path bypasses cooldown deliberately.
7. **Concurrent station claim:** Both players tap same station within 50ms. Tiebreaker by arrival timestamp; second arrival auto-redirected to the other station.
8. **Cave exclusion:** Babies with `inCave: true` are excluded from `participatingBabies` (cleanliness gains only apply to meadow babies).

### A.5 Effort estimate
- **Backend:** ~150–200 LOC (server.js + gameState.js + optional shop catalog tweak)
- **Frontend:** ~250–300 LOC (game.js + index.html CSS only)
- **Memories integration:** ~20 LOC
- **Subagents needed:** Backend, Frontend, QA. (Security touches existing rate-limiter — small; DevOps not needed.)
- **Scope:** Single PR, no infra, no dependency additions.

### A.6 Suggested variants
- **Variant A1 — Shop item.** Add `bubble_bath` item (cost 6 carrots) so couples can manually trigger a bath for the streak. ~15 LOC. Recommended.
- **Variant A2 — Sync-grab bonus.** If both stations are grabbed within 1.0s of each other, +1 to `coupleStats.cooperativeActions` and an "in sync" toast. Cheap, makes the duet feel duet-y.

---

## Candidate B — Personality Reveal & Bond

### B.1 One-line pitch
Surface the baby personality system that's been silently driving stat decay for five iterations: a personality reveal card per baby, plus two co-op "bond" interactions where each player privately tags how they see the baby and the system reveals the match the next morning.

### B.2 Problem it solves
- **Personality is shipped but invisible.** Server generates `genetics.personality` (`server.js:495–603`), runs decay multipliers and per-personality effects (`server.js:838–906`), and emits `personalityInfo` in game state (`server.js:1660–1685`). Frontend has zero references — `grep -i personality frontend/` returns no matches. Players have no way to learn their baby's personality, but every baby has one and it materially affects gameplay. This is the largest invisible system on the codebase.
- **No reflective co-op verb exists.** All current co-op is action-driven (feed, play, harvest). There's no quiet, asynchronous moment where each player contributes a perspective on the family.

### B.3 Mechanic sketch

**Part 1: Personality reveal (always-on UI).**
- Frontend reads the existing `personalityInfo` field already broadcast by the server. Adds a small "personality" chip below each baby's name in the status panel (`index.html:1374` area) showing primary trait icon + tooltip with both primary/secondary and a short flavor sentence (e.g. "Curious — wanders more, decays energy faster"). Pure read of existing data — no server change needed for Part 1.
- Add a "Meet your baby" reveal animation the first time a baby's personality becomes visible (after egg hatches into newborn): personality card slides up in front of both players' canvases simultaneously. Re-uses existing `broadcastEvent` plumbing.

**Part 2: Co-op "bond" tagging (genuinely two-player).**
- Once per in-game day, while both players are connected, server emits `bond_window_open { babyId }` for each baby older than newborn. Each player privately picks one of three guesses for that baby's primary trait. Picks are NOT shared until both have chosen; server holds them server-side.
- When both players have chosen (or after a 60s window), server emits `bond_resolved { babyId, playerAGuess, playerBGuess, actualPrimary, bondPoints }`. If both guessed the actual trait → +3 `coupleStats.bondPoints` and +5 baby love. If both agreed on a wrong trait → +1 bond points and +2 baby love (still a shared moment). If they disagreed → +1 bond points and a "both perspectives noted" memory (no penalty).
- New persistent counter `coupleStats.bondPoints` — piggybacks on existing `gameState.js` save path.

**Part 3 (optional): Shop bond rewards.**
- Bond points unlock cosmetic personality-themed accessories in the shop: e.g. "Curious explorer hat", "Sleepy cap" — purely cosmetic, no balance impact. Re-uses existing `customizationSystem.js`.

### B.4 Acceptance cases
1. **Reveal on hatch:** New egg hatched. Both players' clients receive the same personality reveal card animation simultaneously. Personality chip persists below baby name afterward.
2. **Personality chip reads server data:** Manually mutate baby's personality in a save file; reload room. Chip updates to match. (Confirms the chip is a pure read of `personalityInfo`, not a frontend-cached guess.)
3. **Bond window — both correct:** Day rolls over with both players online. Server emits `bond_window_open`. Both pick the actual primary trait. Server emits `bond_resolved { … bondPoints: 3 }`, `coupleStats.bondPoints` increments by 3, baby love +5, "we know our baby" memory entry recorded.
4. **Bond window — both wrong but agreed:** Both pick the same wrong trait. Bond points +1, love +2, "we see the same baby" memory entry, no penalty toast.
5. **Bond window — disagreed:** Players pick different traits. Bond points +1, no love change, "two views of one bunny" memory.
6. **Bond window — solo player:** Only Player A is online. Server does NOT open the bond window (waits until both are connected). If A is online alone for the full day, the window is silently skipped — no failed_solo state needed.
7. **Bond window timeout:** Window opens, only A picks within 60s. Server emits `bond_resolved { … resolution: 'partial', actualPrimary, playerAGuess, playerBGuess: null }`. A gets a small love bump if correct, no bond points, no memory entry.
8. **Server restart mid-window:** Picks held in memory only. On restart, window is dropped; no orphan state in saves. Next day's window opens normally.
9. **Personality migration for legacy babies:** A pre-V7 save with babies missing `genetics.personality` is loaded. Server's existing personality migration block (`server.js:451–470`) generates personalities. Reveal card fires the next time those babies are observed (one-time backfill toast, not a fanfare animation).
10. **Bond points persist across sessions:** Earn 3 bond points, kill server, restart, reload room. Counter persists in `coupleStats.bondPoints`.

### B.5 Effort estimate
- **Backend:** ~120–180 LOC (bond window lifecycle in game loop, 2 new socket events, 1 new `coupleStats` field with migration). Optional Part 3 shop catalog: +30 LOC.
- **Frontend:** ~200–280 LOC (personality chip in status panel, reveal animation, bond modal with 3-pick UI, resolution toasts).
- **Memories integration:** ~30 LOC (3 new memory subtypes).
- **Subagents needed:** Backend, Frontend, QA. (No DevOps, no Security beyond existing rate-limit on bond picks.)
- **Scope:** Single PR. Slightly heavier than Bath because of the modal UX, slightly lighter because no real-time hold-and-release.

### B.6 Suggested variants
- **Variant B1 — Part 1 only ("just show the personality").** Ship just the personality chip + reveal animation. ~80 LOC frontend, 0 backend changes. Pure information surfacing. Smallest possible shippable improvement, addresses the biggest invisibility surprise immediately. Recommended if user wants to play it safe.
- **Variant B2 — Daily personality "diary" memory.** Auto-add a daily memory entry summarizing each baby's personality-driven moments that day ("Sage was extra curious today — explored the cave 4 times"). Pure data summarization, no new mechanic. Can run on the existing `personalityEffects` log.

---

## Candidate C — Co-op Onboarding & Mini-Game Discoverability

### C.1 One-line pitch
First-time co-op onboarding: a guided 5-step tutorial that fires when both players first connect to a fresh room, plus surfacing the four already-built-but-unreachable mini-games (`enhanced_garden`, `bunny_races`, `memory_match`, `cooperative_puzzle`) as a discoverable Activities menu so existing scaffolding finally becomes playable.

### C.2 Problem it solves
- **No onboarding exists.** `grep "tutorial\|onboard\|welcome\|first_time"` in `frontend/` returns zero matches. New couples land in `menuScreen` (`index.html:1278`) and must guess the loop.
- **Mini-games are dead code from the player's view.** Backend handlers exist (`server.js:3329–3389`), `backend/miniGames.js` is 25 KB, but `grep "start_minigame\|enhanced_garden\|bunny_races\|memory_match\|cooperative_puzzle"` in `frontend/` returns zero matches. Players cannot reach them. This is shipped backend work with zero player exposure — wasted surface area.
- **Re-engagement loop is thin.** Once the basic care loop is internalized, nothing pulls couples back. Mini-games designed for two players would fill that gap if reachable.

### C.3 Mechanic sketch

**Part 1: Co-op onboarding (5 beats).**
- New `gameState.onboarding = { stepIndex, completed, dismissed }` per room. Persisted via `gameState.js`.
- When a fresh room is created AND both players have joined AND `onboarding.completed === false`: server emits `onboarding_step { step, prompt, requiredAction }`. Steps: (1) "Wave to your partner" — both players click their partner's bunny once. (2) "Feed the egg's first food together" — both feed within 8s. (3) "Plant a carrot in the garden" — one harvests. (4) "Try the basket" — open inventory. (5) "Visit the cave together" — both bunnies enter cave. Each step advances when its requiredAction fires.
- Skippable per-room with a "skip tutorial" button on step 1; persists `onboarding.dismissed = true`.
- Re-uses existing socket actions (no new player-action verbs needed). Onboarding only listens for them.

**Part 2: Activities menu (mini-game surfacing).**
- New `🎲 Activities` button in the action bar (next to `🛒 Shop`). Opens an Activities modal listing the four existing mini-games with cost in carrots (or free per cooldown), description, and a "Start" button that emits the existing `start_minigame` server action.
- Each mini-game gets a minimal in-canvas surface using existing canvas patterns. Scope: the mini-game UIs are already structured server-side — the frontend wraps them in a per-game modal (lightweight, share a layout shell).
- Per-mini-game cooldown of 5 minutes, persisted in `gameState.activitiesState`.

### C.4 Acceptance cases
1. **First-time onboarding fires:** Create a fresh room with 2 players. Both clients receive `onboarding_step { step: 1 }`. Step indicator visible in HUD. After both wave, advances to step 2.
2. **Onboarding skip:** Player A clicks "skip tutorial" on step 1. Server sets `onboarding.dismissed = true`, both clients tear down the tutorial overlay. Reload room — overlay does not re-appear.
3. **Onboarding persistence:** Mid-tutorial (step 3), kill server, restart. On reconnect, `onboarding.stepIndex` persists from save. Both clients resume at step 3.
4. **Activities menu opens & lists 4 games:** Click `🎲 Activities`. Modal shows 4 entries with name, description, cost. Each entry has a Start button.
5. **Mini-game launch — round trip:** Click Start on `bunny_races`. Frontend emits `start_minigame { game: 'bunny_races' }`. Server returns `minigame_started { gameId, state }`. Frontend renders the race surface. Submit a score via `submit_minigame_score`. Server returns `minigame_resolved { score, reward }`. Reward credited.
6. **Mini-game cooldown:** Finish a mini-game. Try to start it again immediately. Activities modal shows "Ready in 4:23" instead of Start. After 5 minutes, Start re-enables.
7. **Cooperative mini-game requires partner:** `cooperative_puzzle` lists with a "needs partner online" badge. If only one player is online, Start is disabled and shows "Waiting for partner". When partner connects, Start enables.
8. **Solo player tries cooperative game:** With only A online, A clicks Start on `cooperative_puzzle`. Server rejects with `action_failed { code: 'partner_required' }`. A sees a friendly toast.
9. **Mini-game crash recovery:** Mid-mini-game, server restarts. On reconnect, the mini-game state is dropped (transient by design). Frontend tears down the mini-game modal cleanly, no orphan UI.
10. **Onboarding does not re-fire for returning rooms:** Existing room with `totalActions > 50` is loaded. Server does NOT emit any `onboarding_step` events. Tutorial overlay never appears.

### C.5 Effort estimate
- **Backend:** ~100–140 LOC (onboarding lifecycle + 1 socket emit; Activities menu requires mostly wiring of existing handlers; per-game cooldown). The existing `miniGames.js` may need 30–60 LOC of glue per game (4 games × ~40 = ~160 LOC) if any of the four are still rough. Worst case backend: ~300 LOC.
- **Frontend:** ~350–450 LOC (tutorial overlay component, Activities modal, 4 mini-game wrapper UIs, cooldown displays). Largest of the three candidates by frontend LOC.
- **Subagents needed:** Backend (light), Frontend (heavy), QA (heavy — many surfaces), DevOps (none), Security (validate the new socket inputs — small).
- **Scope:** Borderline single PR. Could split into C.1 (onboarding only) and C.2 (mini-games only) if scope worries the user — see Variant C1.

### C.6 Suggested variants
- **Variant C1 — Onboarding only.** Drop Part 2. Ship just the 5-step tutorial. ~150 LOC total. Smaller, addresses new-player drop-off without taking on the mini-game surface area. Recommended if the user wants to test the onboarding pattern before committing to the bigger Part 2.
- **Variant C2 — Activities only.** Drop Part 1. Ship just the Activities menu and wrap the 4 mini-games. ~400 LOC. Recommended if existing players are the priority and onboarding feels less urgent.

---

## V4 wish-jar restoration — separate ask, unchanged from V6

Confirmed once more: zero `wish` matches in `backend/` or `frontend/`. If the user wants the wish jar back, file it as a focused restore (e.g. **V7.1**) — re-apply from the `bunny-v4-wishes` tag plus a regression test. Out of scope for V7 itself.

---

## Researcher's recommendation

If the user wants the **biggest fix-to-effort ratio**: pick **Candidate B (Personality Reveal & Bond)** with Variant B1 only — it surfaces a system that has shipped for five iterations completely invisibly, and Variant B1 is ~80 LOC of frontend with zero backend changes. The full Candidate B adds the genuine co-op gating that V6 also wanted, in a different shape (asynchronous, reflective) than Bath (synchronous, physical).

If the user wants the **most "feels like a feature" hand-feel**: pick **Candidate A (Bubble Bath)** — the V6 case for it has not weakened.

If the user wants the **highest leverage on player retention**: pick **Candidate C (Onboarding + Activities)** — there is shipped backend work (mini-games) that produces zero player value today.

All three are scoped to one PR. None require infra changes or new dependencies.

Awaiting approval. No code changes will be made until the supervisor relays the user's decision.

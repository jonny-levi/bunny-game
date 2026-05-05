# V7 Approval Decision

**Decision:** APPROVED — Option A (Bubble Bath Duet)
**Variant:** none (vanilla A)
**Approved by:** user (Theworldisheavy / 770079660)
**Channel:** Telegram group "Bunny game" (-1003953682535), msg 37 reply to 31
**Timestamp:** 2026-05-05 11:30 GMT+3
**Source:** APPROVAL-REQUEST-V7.md

## Implementation scope (locked from RESEARCH-REPORT-V7.md §A)
- New transient `gameState.bath` lifecycle, triggered on `cleanliness < 30` (or shop item).
- 5 new socket events: `bath_available`, `bath_grab_station`, `bath_release_station`, `bath_progress`, `bath_resolved`.
- Both stations (Sponge + Tap) must be held simultaneously for 5s; resolutions: `success | partial | failed_solo | failed_timeout | cancelled | server_reset`.
- Frontend: tub sprite in lower meadow, two press-and-hold hotspots, suds particles, progress arc.
- New `coupleStats` fields: `bathsCompleted`, `bathStreak`, `lastBathAt`.
- New `bath_day` memory type via existing `memoriesSystem.js`.
- Optional shop item `bubble_bath` (6 carrots).
- 8 acceptance cases per §A.4 are mandatory QA coverage.

## Pipeline next step
Manager dispatches Backend + Frontend (parallel, both gated on this spec) → Security + QA audit → fix pass → commit `claude: v7 bubble bath duet` + tag `bunny-v7-bath-duet`.

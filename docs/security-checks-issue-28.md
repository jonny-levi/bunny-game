# Issue #28 security checks

Implemented hardening:

- WebSocket action messages are schema-validated before handling.
- The server ignores client-supplied `playerId` in action payloads and uses the authenticated WebSocket session player.
- A provided `familyId` + `playerId` connection must match an existing player record, preventing cross-save reads/writes.
- Action events are server-rate-limited by connection/window and by action+bunny cooldown.
- Bunny and target bunny lookup is constrained to the connected player's family.
- Asset paths remain constructed only by `assetFor()` / `bunnyAssetRef()` from validated kind/index/state tuples.
- GitHub Actions adds a build gate plus an obvious-secret scanner.

Penetration-style checklist:

- Replay burst of action WebSocket messages: rejected after the short per-action cooldown/window limit.
- Cross-user save attempt using another `familyId` with mismatched `playerId`: WebSocket sends an error and closes.
- Action against a bunny id outside the connected family: rejected as `Bunny not found`.
- Target-bunny tampering for breeding outside the connected family: rejected as `Target bunny not found`.
- Asset traversal such as `../../secret`: no raw path input is accepted by the frontend asset resolver.
- Local hatch override: currently remains local-only onboarding state; server action/save mutation is authoritative for backend bunny state, and server-side hatch persistence should be wired when the #27 server-save PR lands.

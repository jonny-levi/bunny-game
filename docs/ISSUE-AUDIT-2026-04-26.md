# Bunny Game Issue Audit — 2026-04-26

## Scope
Reviewed the live Kubernetes deployment, backend logs, and current frontend/backend source for stability issues that can be fixed safely without redesigning gameplay.

## Live checks
- Live service: `http://172.20.10.114`
- `/health` returned healthy.
- Root page returned HTTP 200 with security headers and CSP.
- Kubernetes namespace `bunny-game` had backend, Redis, and Postgres pods running.

## Issues found and fixed

### 1. Save backup race can log noisy `ENOENT` errors
**Evidence:** live backend logs showed backup creation failing while copying `backend/saves/room_*.json` into backups.

**Risk:** save still usually succeeds, but logs look unhealthy and the race can hide real persistence problems.

**Fix:** `backend/gameState.js`
- Save manager now stores and awaits directory creation before save/delete operations.
- Backup creation treats a disappeared source file as a non-fatal race and continues saving current state.
- Delete error logging no longer risks referencing an undefined sanitized room code.

### 2. Redis adapter endpoint was hardcoded
**Evidence:** live logs showed Redis pub/sub timeout messages. The code only used `redis://bunny-redis:6379`.

**Risk:** deployments or local/dev environments with a different Redis service name cannot configure the Socket.IO adapter cleanly.

**Fix:** `backend/server.js`
- Redis adapter now prefers `REDIS_URL`.
- Falls back to `REDIS_HOST`/`REDIS_PORT`.
- Keeps the existing `redis://bunny-redis:6379` fallback for current Kubernetes.

### 3. Canvas context restore could stack transforms and lose drag handlers
**Risk:** after browser canvas context loss/restore, bunny dragging and rendering scale could behave incorrectly.

**Fix:** `frontend/game.js`
- Context restore now uses `ctx.setTransform(...)` instead of cumulative `ctx.scale(...)`.
- Drag listeners are re-registered after context restore.

### 4. Missing action failure messages could show blank errors
**Risk:** if backend emits `action_failed` without a message, the UI can show an undefined/empty error.

**Fix:** `frontend/game.js`
- Adds a safe fallback: `Action failed. Please try again.`

## Validation run
- `node -c backend/server.js`
- `node -c backend/gameState.js`
- `node -c frontend/game.js`
- `node backend/test-startup.js`
- Local health smoke on `PORT=3301`

## Not completed in this pass
- Full browser gameplay QA was not completed from this environment.
- Live deployment was not updated because this host has no Docker builder and SSH to build server `192.168.100.7` failed with `Permission denied (publickey,password)`.
- Existing Mocha-style tests under `test/` still need a configured test runner/script before they can run as part of CI.

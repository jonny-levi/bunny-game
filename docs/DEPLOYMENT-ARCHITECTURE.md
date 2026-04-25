# Bunny Game Deployment Architecture

## Current production architecture

The current Kubernetes deployment is a **single web entrypoint** architecture:

- `bunny-backend` serves the Express API
- `bunny-backend` also serves the static frontend from `frontend/`
- `bunny-postgres` stores persistent game data
- `bunny-redis` supports runtime/state features

That means **a separate `bunny-frontend` pod/service is not required in the current live setup**.

## Why issue #7 happened

The repository still contains standalone `k8s/frontend-*.yaml` manifests from an older or alternate split-frontend idea. Those files make it look like a frontend Deployment should exist in production, but the live cluster currently serves the game through `bunny-backend` instead.

## Live validation notes

The expected live checks for the current architecture are:

- `bunny-backend` Deployment is healthy
- `bunny-backend` Service is reachable
- `GET /` returns the Bunny Family HTML app shell
- `GET /health` returns healthy status
- frontend assets such as `game.js` and Socket.IO client references are present in the served page

## Guidance going forward

- Treat `bunny-backend` as the canonical public web entrypoint for the current deployment model.
- Do **not** assume a missing frontend pod is an outage by itself.
- If the project later moves to a split frontend/backend architecture, that should be handled as an explicit architecture change and approved/planned separately.

# Bunny Game

## Overview

Bunny Game is a full-stack multiplayer family-care game. Players join a shared bunny family, hatch and care for bunnies, and receive real-time updates through WebSockets. The project includes a Vite/TypeScript frontend, Express/TypeScript backend, PostgreSQL persistence, Redis support, Docker builds, and Kubernetes manifests.

## Features

- Browser-based bunny care game UI built with Vite and TypeScript.
- Express backend with REST endpoints for login, family state, activity, and player saves.
- WebSocket server for real-time family updates.
- PostgreSQL database with migration bootstrap on startup.
- Redis integration for cache/pub-sub style runtime support.
- Player save validation for ownership and UUID checks.
- Egg hatching, needs decay, care actions, names, and family activity logic.
- Frontend can be built separately or bundled into the backend image.
- Kubernetes manifests for frontend, backend, PostgreSQL, Redis, namespace, and build helpers.
- GitHub security workflow documentation/checks.

## Architecture / Structure

```text
backend/                 Express + TypeScript API and WebSocket server
backend/src/db/          PostgreSQL pool, queries, and migrations
backend/src/game/        Game tick, bunny names, save/hatching logic
backend/src/ws/          WebSocket room and connection handling
frontend/                Vite + TypeScript browser client
packages/shared/         Shared constants and types
k8s/                     Kubernetes manifests for app and dependencies
docs/                    Security and operational notes
Dockerfile               Multi-stage build that bundles frontend into backend
backend/Dockerfile       Backend-only image
frontend/Dockerfile      Frontend-only image with Nginx
.github/workflows/       Security workflow
```

Runtime shape:

```text
Browser UI ⇄ Backend REST API / WebSocket ⇄ PostgreSQL
                                  ⇄ Redis
```

## Prerequisites

- Node.js 20+ recommended.
- npm.
- PostgreSQL.
- Redis.
- Docker/Kubernetes for containerized deployment.

## Getting Started

### Backend

```bash
cd backend
npm install
export DATABASE_URL="postgresql://bunny:bunny@localhost:5432/bunny_family"
export REDIS_URL="redis://localhost:6379"
export FAMILY_NAME="The Bunny Family"
npm run dev
```

The backend listens on `PORT` or `3001` by default.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Build for production:

```bash
cd frontend
npm run build
```

### Shared Package

```bash
cd packages/shared
npm install
```

## Configuration

Backend environment variables are defined in `backend/src/config.ts`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Backend HTTP/WebSocket port. |
| `DATABASE_URL` | `postgresql://bunny:bunny@localhost:5432/bunny_family` | PostgreSQL connection string. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string. |
| `FAMILY_NAME` | `The Bunny Family` | Default shared family name. |

## Deployment / Operations

### Docker

Build the combined image from the repository root:

```bash
docker build -t bunny-game:latest .
docker run --rm -p 3001:3001 \
  -e DATABASE_URL="postgresql://bunny:bunny@postgres:5432/bunny_family" \
  -e REDIS_URL="redis://redis:6379" \
  bunny-game:latest
```

### Kubernetes

Review image names and secrets/config in `k8s/`, then apply:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

Useful checks:

```bash
kubectl -n bunny-game get pods,svc
kubectl -n bunny-game logs deploy/bunny-backend -f
curl http://<backend-host>/health
```

## Security Notes

- Do not expose PostgreSQL or Redis publicly.
- Use Kubernetes Secrets or platform secrets for database credentials in real deployments.
- Player actions depend on `x-player-id`; keep ownership validation in place when adding endpoints.
- Restrict CORS before production if the app is exposed outside a trusted network.
- Run the security workflow and review `docs/security-checks-issue-28.md` when changing auth/save logic.

## Author

Jonny Levi — [jonny-levi](https://github.com/jonny-levi)

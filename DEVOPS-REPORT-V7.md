# DevOps Report — V7 Bubble Bath Duet

**Specialist:** DevOps
**Date:** 2026-05-05

V7 is a pure code feature contained inside the existing `bunny-game` container. No infrastructure surface changes are required: `docker-compose.yml`, `Dockerfile`, `Dockerfile.prod`, the `k8s/` manifests, and the Terraform stack all remain unchanged. Both backend and frontend changes ship inside the existing image — backend code is loaded by `node backend/server.js` at container start, and the frontend is served as static files mounted by the same image, so a normal image rebuild + redeploy on the existing pipeline is sufficient if/when this iteration is rolled out. No new env vars, ports, persistent volumes, or service account changes are introduced (the `bath` lifecycle is transient in-memory and `coupleStats` already piggybacks on the existing `saves/` volume). Per `feedback_scoped_builds.md`, do not run multi-image build scripts; only the bunny-game image needs rebuilding when this is deployed. **No infra changes needed.**

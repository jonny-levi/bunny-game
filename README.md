# 🐰 Bunny Family

> A cozy real-time co-op bunny parenting game for two players.

![Platform](https://img.shields.io/badge/platform-web-pink)
![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Socket.IO%20%7C%20HTML5-purple)
![Mode](https://img.shields.io/badge/gameplay-co--op-brightgreen)
![Status](https://img.shields.io/badge/status-active%20prototype-orange)

Bunny Family is a charming browser game where two players raise a shared bunny family together. Instead of competing, you cooperate: hatching eggs, feeding babies, keeping them happy, and watching the family grow in real time.

## ✨ Why it feels special

- **Built for co-op** — both players care for the same bunny family together
- **Live synchronized gameplay** — actions update instantly across both players
- **Cute, cozy identity** — soft visuals, playful animations, and warm game loops
- **Mobile-friendly browser play** — easy to open and play from a phone or desktop
- **Expandable design** — ready for more items, scenes, personalities, and progression

## 🎮 Core gameplay

### Players
- **Black bunny parent** 🐰⬛
- **White bunny parent** 🐰⬜

### Care loop
Players work together to manage each bunny’s needs:
- **🥕 Hunger**
- **😊 Happiness**
- **💤 Energy**
- **🧼 Cleanliness**
- **❤️ Love**

### Family progression
- Hatch eggs together
- Raise babies through multiple life stages
- Grow the family over time
- Earn carrots and use the shop/inventory system
- Build a shared cozy routine, not a competitive score chase

## 🌱 Bunny stages

1. **Egg** 🥚
2. **Newborn** 🐣
3. **Baby** 🐇
4. **Toddler** 🌼
5. **Child / young bunny** ✨

## 🖼️ Media / screenshots

Screenshots and gameplay clips can be added here as the project presentation grows.

Suggested future additions:
- lobby screen
- in-game family scene
- shop/inventory flow
- bunny interaction moments

## 🧰 Tech stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript, Canvas rendering
- **Backend:** Node.js, Express, Socket.IO
- **Realtime:** WebSocket-based multiplayer sync
- **State / runtime services:** Redis, PostgreSQL, file-backed saves in some flows
- **Deployment:** Kubernetes/home-lab oriented runtime

## 🏗️ Current runtime architecture

The current live deployment uses a **single web entrypoint** model:

- `bunny-backend` serves the API
- `bunny-backend` also serves the static frontend
- `bunny-postgres` stores persistent data
- `bunny-redis` supports runtime/state features

More detail: [`docs/DEPLOYMENT-ARCHITECTURE.md`](docs/DEPLOYMENT-ARCHITECTURE.md)

## 🚀 Getting started

### Local development

```bash
cd backend
npm install
node server.js
```

Then open:

```bash
http://localhost:3000
```

### Docker

```bash
docker build -t bunny-family .
docker run -p 3000:3000 bunny-family
```

### Docker Compose

```bash
docker compose up --build
```

## 📁 Project structure

```text
bunny-game/
├── backend/     # Express + Socket.IO server and game logic
├── frontend/    # Browser client, canvas rendering, UI, game interactions
├── docs/        # Design direction and architecture notes
├── k8s/         # Kubernetes manifests
├── terraform/   # Infra-as-code experiments / environment setup
└── test/        # Game logic and behavior tests
```

## 💡 Feature highlights

- real-time room-based multiplayer
- draggable bunny interactions
- growth and progression systems
- egg discovery / family expansion mechanics
- carrot economy and shop items
- responsive UI for casual mobile play
- expressive visual feedback and animations

## 🎨 Design direction

The game aims for a soft, affectionate, cozy look rather than a hyper-competitive or hardcore feel.

Design source of truth:
- [`docs/FIGMA-DESIGN-DIRECTION.md`](docs/FIGMA-DESIGN-DIRECTION.md)
- [`docs/FIGMA-HANDOFF-CHECKLIST.md`](docs/FIGMA-HANDOFF-CHECKLIST.md)

## 🛣️ Roadmap ideas

- better scene variety and environmental storytelling
- bunny customization and improved item fitting
- polished UI/audio feedback
- richer progression and family history systems
- screenshots, trailer GIFs, and better repo media
- broader QA coverage and gameplay balancing

## 🤝 Contributing

This repo is currently evolving quickly. If you contribute:

1. keep the cozy co-op identity intact
2. prefer small, focused PRs
3. include clear validation notes for gameplay changes
4. avoid architecture changes without documenting them clearly

## 📌 Project goal

Bunny Family is meant to feel like a warm shared ritual: a small browser game that turns co-op care, affection, and routine into something playful and memorable.

---

**Bunny Family** — where two players grow one tiny cozy world together 💗

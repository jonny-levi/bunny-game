# 🐰❤️ Bunny Family - Cooperative Tamagotchi Game

A heartwarming cooperative multiplayer browser game where couples raise adorable bunny babies together in real-time!

## 💕 Game Concept

**Bunny Family** is a cooperative Tamagotchi-style game designed for two players (perfect for couples!) who work together to raise virtual bunny babies. Unlike competitive games, this is all about teamwork, love, and nurturing your shared bunny family.

### 👨‍👩‍👧‍👦 Core Gameplay

- **Two Players**: Black bunny parent 🐰⬛ and White bunny parent 🐰⬜
- **Shared Babies**: Both players care for the same bunny babies together
- **Real-time Cooperation**: When one player feeds a baby, the other sees it instantly
- **Growth Journey**: Watch your babies grow from eggs to adults
- **Family Building**: Adult bunnies can have their own babies, expanding your family

### 🥚 Baby Growth Stages

1. **Egg** 🥚 → Both players tap together to hatch
2. **Newborn** 👶 → Tiny and needs lots of attention
3. **Toddler** 🧒 → Starts hopping around, needs playtime  
4. **Young Bunny** 🧑 → More independent, new interactions
5. **Grown Bunny** 👨 → Can have babies of their own!

### 💖 Tamagotchi Care System

Each baby bunny has five essential needs that both players must manage:

- **🥕 Hunger** - Feed them carrots from your shared garden
- **😊 Happiness** - Play with them to keep spirits up
- **💤 Energy** - Help them sleep when tired, wake when rested
- **🧹 Cleanliness** - Keep the nest clean and tidy
- **❤️ Love** - Pet and cuddle for emotional bonding

### 🎮 How to Play

**Lobby & Connection:**
1. One player creates a family with a shareable code
2. Partner joins using the family code
3. Both players click "Ready" to start your family journey

**Daily Care:**
- Monitor status bars for each baby's needs
- Tap action buttons to care for selected babies
- Harvest carrots from the garden (they regrow over time)
- Watch babies make cute sounds and animations
- Coordinate with your partner - teamwork makes the dream work!

**Special Moments:**
- **Egg Hatching**: Both players must tap together to help babies hatch
- **Growth Celebrations**: Babies grow when well-cared for
- **New Arrivals**: Happy adult bunnies may lay new eggs
- **Day/Night Cycles**: Babies have different needs at different times

## 🛠 Technical Features

### Tech Stack
- **Frontend**: HTML5 + Phaser 3 + CSS3
- **Backend**: Node.js + Express + Socket.io  
- **Real-time**: WebSocket synchronization
- **Mobile-first**: Touch-optimized responsive design
- **Graphics**: Programmatically drawn cute sprites

### Key Features
- **Real-time Multiplayer**: All actions sync instantly between players
- **Mobile Optimized**: Perfect for couples playing on their phones
- **Persistent Game State**: Family continues growing between sessions
- **Cute Animations**: Hearts, bouncing, crying, sleeping effects
- **Audio-Visual Feedback**: Expressive animations and mood indicators

## 🚀 Getting Started

### Quick Start

```bash
cd bunny-game
./start.sh
```

### Manual Setup

```bash
cd backend
npm install
node server.js
```

### Using Docker

```bash
docker build -t bunny-family .
docker run -p 3000:3000 bunny-family
```

**Access the game**: Open `http://localhost:3000`

## 📱 Mobile Experience

Bunny Family is designed mobile-first for couples to play together:

- **Touch Controls**: Tap babies to select, tap buttons to interact
- **Responsive Design**: Works perfectly on phones and tablets
- **Portrait/Landscape**: Optimized for both orientations
- **Intuitive UI**: Large buttons and clear visual feedback

## 🎨 Visual Design

Design source of truth: [`docs/FIGMA-DESIGN-DIRECTION.md`](docs/FIGMA-DESIGN-DIRECTION.md)

Implementation-to-Figma bridge: [`docs/FIGMA-COMPONENT-MAP.md`](docs/FIGMA-COMPONENT-MAP.md)

**Art Style**: Cute programmatic graphics with a warm, pastel color palette
- **Bunnies**: Round bodies with triangle ears and expressive eyes
- **Colors**: Pink, purple, and pastel themes for a loving atmosphere
- **Animations**: Hearts float when petting, babies bounce when happy
- **Mood System**: Visual cues show how babies are feeling

**UI Layout**:
- **Top**: Connection status for both players + day/night cycle
- **Status Panel**: Need meters and baby information cards  
- **Game Area**: Interactive nest where babies live and play
- **Garden**: Carrot harvesting area (tap to collect)
- **Controls**: Five care action buttons (Feed, Play, Sleep, Clean, Pet)

## 🧩 Game Mechanics Deep Dive

### Need Management
- **Decay Rates**: Needs decrease over time (newborns need more attention)
- **Satisfaction**: Actions restore specific needs and add growth points
- **Mood System**: Babies show emotions based on overall care quality
- **Cooperation Bonus**: Both players caring together increases family love

### Growth & Development
- **Age-based Progression**: Babies grow every few minutes with good care
- **Growth Points**: Earned through feeding, playing, and love
- **Stage Requirements**: Each growth stage has specific care thresholds
- **Family Legacy**: Track total babies raised across generations

### Garden System
- **Carrot Growth**: Carrots regrow automatically every 30 seconds
- **Shared Resource**: Both players use the same carrot supply
- **Harvest Strategy**: Timing carrot collection for optimal feeding

## 🏆 Success Metrics

**Family Goals:**
- Keep all babies happy and healthy
- Successfully raise babies to adulthood
- Expand your bunny family through generations
- Maximize family love meter through cooperative care
- Create a thriving multi-generational bunny dynasty

## 🌟 Perfect For

- **Couples**: Strengthen your bond through shared virtual parenting
- **Long-distance Relationships**: Stay connected through daily care routines
- **Casual Gamers**: No pressure, just pure cooperative fun
- **Anyone who loves cute things**: Adorable bunnies and heartwarming gameplay

## 🔧 Development Features

### Responsive Architecture
- **Server-authoritative**: Game state managed on backend
- **Real-time Sync**: Socket.io for instant multiplayer updates
- **Mobile Performance**: Optimized for touch devices and slower networks
- **Graceful Degradation**: Handles disconnections elegantly

### Customization Options
- **Extendable**: Easy to add new baby types, needs, or actions
- **Configurable**: Adjust growth rates, decay speeds, and game balance
- **Themeable**: Simple to modify colors and visual style

## 🔮 Future Enhancements

Potential additions for future versions:
- **Baby Personalities**: Unique traits and preferences for each bunny
- **Seasonal Events**: Holiday-themed decorations and special items
- **Photo Albums**: Capture and share favorite family moments  
- **Baby Names**: Custom naming for each family member
- **Family Tree**: Visual genealogy of your bunny dynasty
- **Mini-games**: Special activities to play with older bunnies
- **Customization**: Decorate your nest and choose bunny colors

---

**Start your bunny family adventure today! 🐰❤️**

*Bunny Family - Where love multiplies and families grow together* 💕
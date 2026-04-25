# Bunny Family — Figma Design Direction

**Issue:** #1 — Create a cohesive Figma design direction for bunny-game UI, backgrounds, items, and presentation  
**Status:** PR-ready design-spec artifact  
**Scope:** Visual/design direction only. No feature expansion, no code changes.

## 1. Purpose

This document translates the current Bunny Family game into a **Figma-ready design source of truth** so a designer can build the live file quickly and consistently.

It is grounded in the current repo state:
- 2D browser game for couples raising bunny babies together
- pastel, affectionate, cozy presentation
- current gameplay UI includes lobby, in-game HUD, status bars, garden, action buttons, shop, basket, notifications, growth celebrations, weather states, and scene backgrounds
- current scene set includes **default/day**, **night**, **kitchen**, **playground**, and **bathroom**

## 2. Design North Star

**Emotional goal:** make cooperative care feel warm, playful, and intimate rather than competitive or “gamey.”

**Keywords:**
- cozy
- soft
- affectionate
- toy-like
- readable on mobile
- celebratory
- gentle, not sugary-chaotic

**Experience principle:** every screen should feel like a shared bunny home, not a generic dashboard.

## 3. Art Direction

### Visual style
- **2D cute casual game** with polished mobile-web UI
- rounded shapes, soft corners, friendly spacing
- subtle gradients over flat harsh fills
- hand-made / storybook energy, but clean enough for production UI
- expressive bunny characters and micro-celebration moments

### Avoid
- sharp gamer-neon styling
- dark heavy outlines everywhere
- realistic textures
- cluttered HUDs
- tiny desktop-only interactions

## 4. Core Palette

Use the existing frontend palette as the base design system.

### Primary colors
- **Primary Pink:** `#FFB3D9`
- **Secondary Pink:** `#FF69B4`
- **Primary Purple:** `#9370DB`
- **Soft White:** `#FFFEF7`
- **Warm Cream:** `#FDF6E3`
- **Gentle Green:** `#C8E6C9`
- **Sky Blue:** `#E3F2FD`
- **Sunset Orange:** `#FFE0B2`
- **Text Dark:** `#4A4A4A`

### Accent / utility colors
- **Heart Red:** `#FF6B6B`
- **Carrot Orange:** `#FF9800`
- **Success Green:** `#4CAF50`
- **Sleep Blue:** `#3F51B5`
- **Clean Cyan:** `#00BCD4`
- **Shadow:** `rgba(0,0,0,0.10)`

### Semantic gradients
- Primary CTA: `#FF69B4 → #FFB3D9`
- Room code / special badge: `#FF69B4 → #9370DB`
- Feed: `#FF9800 → #F57C00`
- Play: `#4CAF50 → #388E3C`
- Sleep: `#3F51B5 → #303F9F`
- Clean: `#00BCD4 → #0097A7`
- Pet: `#FF6B6B → #E53935`
- Shop: `#9370DB → #7B1FA2`

## 5. Typography Direction

Current product tone suggests:
- **Display / playful headings:** Baloo 2, Fredoka, or Nunito Rounded
- **UI/body:** Nunito, Quicksand, or Inter Rounded-style fallback

### Type roles
- **H1 / hero:** rounded, bold, high warmth
- **Section titles:** semibold, compact, friendly
- **Body:** high legibility, medium weight
- **Labels / stats:** bold enough for quick scan on phone

### Tone rules
- Use affectionate phrasing and clear verbs
- Prefer “Family Code”, “Cozy Cave”, “Feed”, “Play”, “Basket”
- Avoid overly technical system language in visible UI

## 6. Component Style Rules

### Shape language
- default radius: **20–24 px** for cards/modals/buttons
- pills for counters, chips, and compact badges
- large touch targets: **44 px minimum**

### Elevation
- soft shadows only
- frosted/glass treatment acceptable for overlays if readability stays high
- never use harsh black shadows

### Icon style
- emoji-friendly direction is acceptable for early mocks
- production Figma should also include an equivalent icon layer direction:
  - rounded
  - filled
  - simple silhouettes
  - minimal detail

### Motion direction
In Figma prototypes, show:
- gentle scale-up on tap
- float-up feedback for hearts/stars/carrots
- pop-in celebrations
- slide/fade for shop and notification overlays

## 7. Information Architecture

## 7.1 Primary surfaces
1. **Lobby / Menu**
2. **Player setup**
3. **Main gameplay screen**
4. **Shop modal**
5. **Basket modal**
6. **Toast / notification states**
7. **Growth / achievement celebration overlays**

## 7.2 Main gameplay layout
Use mobile-first composition:
- **Top bar**
  - connection state
  - day/night badge
  - carrot counter
- **Floating room code badge**
- **Main nest scene / canvas area**
- **Selected baby status card**
- **Garden panel**
- **Bottom action bar**

Desktop can widen spacing, but mobile remains the source layout.

## 8. Screen-by-Screen Figma Frames

## 8.1 Lobby / Home
**Goal:** instantly communicate “cute co-op bunny care for couples.”

### Include
- title lockup: Bunny Family
- subtitle
- decorative floating bunnies / hearts / carrots / sparkles
- player name input
- bunny color selection cards
- create room CTA
- room code input
- join room CTA
- optional resume state

### Visual notes
- center card over animated pastel gradient background
- surrounding floating charm elements should frame, not clutter
- card should feel gift-box / scrapbook, not enterprise form

## 8.2 Player Setup
Can be a section inside the lobby or a dedicated frame.

### Include
- player name input state
- bunny color options: black bunny and white bunny
- selected / hover / pressed states

### Behavior notes
- selected card gets pink outline, lifted shadow, soft tint
- color choice should feel like choosing a character identity, not a settings radio button

## 8.3 Main Gameplay — Default Day Scene
**This is the anchor composition.**

### Include
- top status row
- room code chip
- nest/play area
- parent bunny positions
- baby bunny focus state
- selected baby status card with five need bars
- garden module
- action button row

### Need bars
Create component variants for:
- hunger
- happiness
- energy
- cleanliness
- love

Each bar should include:
- icon
- label
- progress fill
- numeric value

### Layout priority
1. scene and bunny interaction
2. selected baby health readability
3. actions within thumb reach

## 8.4 Main Gameplay — Night Variant
Show the same core composition with:
- moonlit background
- stars
- deeper indigo / plum tones
- calmer overall contrast
- action/UI still readable and warm

Night should feel cozy, not gloomy.

## 8.5 Scene Variant — Kitchen
**Purpose:** feeding / domestic warmth.

### Environmental cues
- warm cream to peach wall gradient
- tiled floor
- cabinets
- fridge
- counter edge
- bowl + carrot props
- small window

### Mood
- nurturing
- tidy
- soft household routine

## 8.6 Scene Variant — Playground
**Purpose:** play / joy / activity.

### Environmental cues
- bright sky
- sun
- clouds
- swing set
- slide
- sandbox
- flowers / butterflies

### Mood
- energetic
- bright
- playful

## 8.7 Scene Variant — Bathroom
**Purpose:** cleanliness / bath time.

### Environmental cues
- mint/cyan tile room
- bathtub
- water / bubbles
- duck
- soap bottle

### Mood
- fresh
- clean
- adorable

## 8.8 Shop Modal
### Structure
- overlay dimmer
- rounded modal card
- title row
- close button
- carrot count summary
- responsive item grid

### Item card anatomy
- item icon
- item name
- short benefit line
- price
- buy CTA
- disabled state when currency is insufficient

### Current item set to include in mock
- Bouncy Ball
- Soft Blanket
- Carrot Treat
- Plant
- Night Light

## 8.9 Basket Modal
### Purpose
Inventory handoff screen for owned items.

### Include
- same modal shell as shop for consistency
- item quantity treatment
- “Give to bunny” CTA
- empty state illustration/message

## 8.10 Toasts / Notifications / Celebrations
Create lightweight overlay components for:
- generic success/info/error toast
- egg notification
- growth celebration
- achievement unlock
- cooperative bonus
- purchase success

### Direction
- use strong color framing and emoji/icon anchors
- keep copy short and high-emotion
- animation should feel buoyant and rewarding

## 9. Bunny Character Direction

## 9.1 Parent bunnies
Two clear silhouettes/skins:
- **Black bunny parent**
- **White bunny parent**

### Shared design traits
- rounded body mass
- expressive ears
- simple face at small sizes
- readable silhouette against pastel backgrounds
- affectionate animation poses > realism

## 9.2 Baby bunnies
Growth-stage-aware variants should remain visibly part of the same family.

### Rules
- baby proportions = larger head, smaller body, extra softness
- facial expressions should carry mood quickly
- selected baby should be easy to identify in crowded scenes

## 9.3 Expressions to design in Figma component variants
- happy
- sleepy
- hungry
- dirty / needs cleaning
- loved / cuddled
- surprised / celebration

## 10. Items & Object Direction

The item language should look soft, toy-like, and slightly oversized for readability.

### Immediate item families from current implementation
- food items: carrot, carrot treat, bowl
- comfort items: blanket, night light
- play items: ball
- decor items: plant
- environmental props: cave, flowers, swing, slide, tub, duck

### Rules
- icons must read at small mobile scale
- each item should use 2–4 main colors max
- use soft highlights instead of detailed texture

## 11. Background System Direction

Build backgrounds as reusable systems, not one-off illustrations.

### Base layers per scene
1. sky / wall gradient
2. ground / floor plane
3. major structural props
4. decorative props
5. ambient effects layer

### Ambient effects
- clouds
- stars
- sparkles
- weather particles
- glow around cave / celebrations

### Design constraint
Backgrounds must support gameplay readability first. Bunny silhouettes and status feedback must remain visible over every scene.

## 12. Responsive Design Guidance

## Mobile first
Target first:
- 390 × 844
- 360 × 800

Then adapt to:
- tablet portrait
- desktop landscape

### Mobile priorities
- action bar reachable with thumbs
- status card readable without stealing too much scene space
- top bar compressed into clear chips
- floating decorative elements reduced on smaller screens

## 13. Figma File Structure

Recommended page structure:

### Page 1 — Foundations
- colors
- gradients
- typography
- spacing
- shadows
- icon rules

### Page 2 — Components
- buttons
- bars
- chips
- cards
- modals
- notification patterns
- item cards
- bunny expression variants

### Page 3 — Gameplay Screens
- lobby
- setup
- main gameplay day
- main gameplay night
- scene variants

### Page 4 — Systems
- backgrounds breakdown
- item families
- state overlays
- motion notes / prototype links

### Page 5 — Handoff
- redlines
- spacing tokens
- interaction notes
- asset export list

## 14. Component Inventory for the Figma Build

Create these as reusable components/variants:
- Primary button / hover / pressed / disabled
- Secondary button / hover / pressed / disabled
- Action button variants: feed, play, sleep, clean, pet, cave, shop, basket
- Status chip: connected / disconnected / waiting
- Day-night badge: day / night
- Currency chip
- Room code chip
- Status bar component with 5 semantic skins
- Modal shell
- Shop item card
- Basket item row/card
- Toast: info / success / error / partner
- Celebration card: growth / achievement / purchase / coop bonus
- Bunny color selection card
- Bunny avatar variants: black parent, white parent, baby states

## 15. Presentation / Pitch Direction

If the eventual Figma is shared with collaborators or used in a PR/demo, the presentation should tell this story:
1. **What the game feels like** — cozy co-op bunny parenting
2. **How the UI supports that feeling** — soft, mobile-first, affectionate
3. **How scenes support actions** — kitchen/feed, playground/play, bathroom/clean, night/rest
4. **How rewards feel** — celebratory and emotionally warm

## 16. Out of Scope for This Issue

To keep one issue = one PR, this design direction intentionally does **not** include:
- frontend implementation changes
- backend feature changes
- balance or gameplay redesign
- new screens beyond current implemented product shape
- new monetization or meta-progression systems

## 17. Acceptance Mapping

This artifact covers the issue intent by defining:
- **UI direction** → layout, components, mobile-first structure
- **background direction** → day/night + kitchen/playground/bathroom systems
- **item direction** → shop/inventory item families and style rules
- **presentation direction** → emotional tone, file structure, prototype guidance, handoff framing

## 18. Recommended Next Step After Merge

A designer can now turn this into a live Figma file by:
1. creating the file pages from Section 13
2. building the component inventory from Section 14
3. composing the key frames from Section 8
4. prototyping tap/overlay interactions for lobby, shop, basket, and celebrations
5. using `FIGMA-HANDOFF-CHECKLIST.md` as the execution checklist during file build and handoff
6. using `FIGMA-COMPONENT-MAP.md` to map live frontend surfaces and states into Figma components without drift

---

If this doc becomes the source of truth, the eventual Figma file should mirror its naming and component structure closely to reduce design/dev drift.

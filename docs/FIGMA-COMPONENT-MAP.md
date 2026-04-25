# Bunny Family — Figma Component Map

**Issue:** #1  
**Purpose:** bridge the live frontend and the Figma file so design/dev stay aligned.

This is a companion to `FIGMA-DESIGN-DIRECTION.md`, focused on:
- current UI surfaces that already exist in the repo
- exact visual tokens already present in code
- component/state mapping for Figma variants
- implementation gaps a designer should know before polishing mocks

---

## 1. Current Product Surfaces in Code

## Lobby / entry flow
Implemented in `frontend/index.html`:
- animated pastel lobby background
- title + subtitle + description
- player name input
- bunny color selection cards
- create room CTA
- family code input + join CTA
- hidden resume CTA
- floating decorative bunnies / hearts / carrots / sparkles

## Main gameplay shell
Implemented in `frontend/index.html` + `frontend/game.js`:
- top bar
- floating family code badge
- day/night chip
- carrot counter chip
- scene canvas
- selected bunny status panel
- garden panel
- bottom action bar

## Overlays / modal-like UI
Implemented in `frontend/game.js`:
- shop overlay
- basket overlay
- growth celebration
- purchase success
- generic message toasts
- cooperative bonus banner

## Scene/background set currently rendered
Implemented in `frontend/game.js`:
- default day meadow
- night variant
- kitchen
- playground
- bathroom

**Note:** the top-of-file scene comment still mentions `bedroom`, but the active rendered set is `default`, `night`, `kitchen`, `playground`, and `bathroom`. Figma should follow the active set.

---

## 2. Foundations Already Present in Frontend

## Color tokens from `:root`
- Primary Pink — `#FFB3D9`
- Secondary Pink — `#FF69B4`
- Primary Purple — `#9370DB`
- Soft White — `#FFFEF7`
- Warm Cream — `#FDF6E3`
- Gentle Green — `#C8E6C9`
- Sky Blue — `#E3F2FD`
- Sunset Orange — `#FFE0B2`
- Text Dark — `#4A4A4A`
- Bunny Black — `#2C2C2C`
- Bunny White — `#FFFFFF`
- Heart Red — `#FF6B6B`
- Carrot Orange — `#FF9800`
- Shadow — `rgba(0,0,0,0.10)`

## Existing gradient language
- Primary CTA: `#FF69B4 -> #FFB3D9`
- Room code badge: `#FF69B4 -> #9370DB`
- Feed: `#FF9800 -> #F57C00`
- Play: `#4CAF50 -> #388E3C`
- Sleep: `#3F51B5 -> #303F9F`
- Clean: `#00BCD4 -> #0097A7`
- Pet: `#FF6B6B -> #E53935`
- Cave: `#8D6E63 -> #5D4037`
- Shop: `#9370DB -> #7B1FA2`
- Day top bar shell: `#FFFEF7 -> #FDF6E3`

## Radius language in code
- Primary cards / modals: `25px`
- Standard panels / chips / status areas: `20px`
- Smaller chips/buttons: `15px`
- Circular utility button: `28px` / `40px`

## Typography reality check
Current frontend uses:
- `'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive, sans-serif`

For Figma, the design direction should still move toward a cleaner rounded family, but mocks should preserve the same playful warmth.

---

## 3. Component Mapping for Figma

## A. Lobby components
### `Lobby / Root`
Map from:
- `.menu-screen`
- `.container`
- `.decorative-bunny`
- `.floating-heart`
- `.floating-carrot`
- `.sparkle`

### Variants to design
- default
- focused input
- join flow filled
- create flow ready
- resume available

### Key visual traits
- centered frosted card
- animated pastel background
- floating charm elements only as framing

## B. Bunny color selection card
Map from:
- `.bunny-color-option`
- inline selected styling in lobby markup

### Variants
- black / white
- idle / hover / selected / pressed

### Selected state cues already implied by code
- pink outline
- lifted emphasis
- white card surface

## C. Top system chips
Map from:
- `.connection-status`
- `.day-night-indicator`
- `.carrot-count`
- `.room-code-banner`
- `.room-code-text`
- `.room-code-copy`

### Required variants
- connected / waiting / disconnected
- day / night
- room code idle / copied
- carrot count default / low-attention / reward-updated

## D. Selected bunny status card
Map from:
- `.status-panel`
- `.baby-name`
- `.status-bar`
- `.status-label`
- bar fills updated by `updateStatusBar(...)`

### Required variants
- hunger
- happiness
- energy
- cleanliness
- love

### Data treatment already present in UI
Each row includes:
- icon
- label
- progress fill
- numeric value

## E. Garden panel
Map from:
- `.garden-panel`
- `.garden-stats`
- `.harvest-timer`

### Variants
- growing
- ready to harvest
- recently harvested

## F. Action bar buttons
Map from:
- `.action-panel`
- `.action-btn`
- `.action-btn.feed`
- `.action-btn.play`
- `.action-btn.sleep`
- `.action-btn.clean`
- `.action-btn.pet`
- `.action-btn.cave`
- `.action-btn.shop`
- basket button inline brown gradient

### Variants
- default
- hover
- pressed
- disabled
- active semantic skins per action

### Important behavior notes from code
- Feed disables when no carrots / baby is egg / hunger already high
- Play disables when too tired / sleeping / still egg
- Sleep toggles between sleep and wake copy
- Pet changes to tap for egg state

## G. Shop and basket modal shell
Map from:
- `.shop-overlay`
- `.shop-modal`
- `.shop-header`
- `.close-shop`
- `.shop-items`
- `.shop-item`
- `.buy-button`

### Required variants
- affordable
- unaffordable
- owned
- basket empty state
- item picker / give-to-bunny flow

## H. Celebration and feedback overlays
Map from:
- `.growth-celebration`
- `.purchase-success`
- `.coop-bonus`
- `showMessage(...)`

### Required variants
- growth
- purchase success
- cooperative bonus
- info toast
- error toast
- success toast

---

## 4. Scene Art Breakdown for Figma

## Default day meadow
From `drawDayBackgroundToContext(...)`:
- blue-to-green vertical sky gradient
- moving clouds
- foreground flowers
- cozy cave with warm glow

## Night variant
From `drawNightBackgroundToContext(...)`:
- deep navy / purple sky
- stars
- moon at upper-right
- dark plum ground plane

## Kitchen
From `drawKitchenBackground(...)`:
- warm cream / peach wall gradient
- tiled floor
- brown counter edge
- upper cabinets
- fridge
- bowl + carrot props
- window

## Playground
From `drawPlaygroundBackground(...)`:
- bright sky gradient
- sun glow
- clouds
- swing set
- slide + ladder
- sandbox + bucket
- flowers
- butterflies

## Bathroom
From `drawBathroomBackground(...)`:
- mint / cyan vertical gradient
- wall tile grid
- bathtub with water
- bubbles
- duck
- soap bottle

---

## 5. Responsive Source-of-Truth

Current breakpoints in `frontend/index.html`:
- `max-width: 768px`
- `max-width: 480px`

## Behavior already implied by code
### At tablet/mobile widths
- decorative lobby elements disappear
- top bar tightens
- game layout becomes vertical
- garden becomes a shorter horizontal module
- action buttons shrink

### At smaller phone widths
- lobby container padding drops
- family code badge shifts upward/left
- action buttons shrink again

## Figma frame priority
1. 390×844
2. 360×800
3. tablet portrait
4. desktop reference

---

## 6. Design Risks / Gaps to Keep Visible

These are useful handoff notes, not blockers for issue #1:
- shop and basket are visually consistent with the current card system, but still rely on runtime-generated HTML rather than a more formal component system
- some UI styling still lives inline in markup/JS, so Figma should become the cleaner visual source of truth
- the room code badge in code is more compact than the longer explanatory version mentioned in older UI copy; prefer the compact floating-chip treatment
- current typography is intentionally playful but not polished enough to be the long-term brand direction
- weather visuals exist in canvas logic, but they are not yet described as a polished UI system; optional future design pass

---

## 7. Recommended Figma Build Order

1. Foundations page from the exact code tokens above
2. Gameplay shell components: chips, bars, action buttons, modal shell
3. Anchor gameplay frame for 390×844 day scene
4. Night variant from the same structure
5. Kitchen, playground, and bathroom scene swaps
6. Shop, basket, and celebration overlays
7. Responsive adaptations for 360×800, tablet, and desktop

---

## 8. Definition of Alignment

Design and implementation are aligned when:
- every major live UI surface has a named Figma equivalent
- scene variants use the same active set as code
- component variants cover the same gameplay states the JS already exposes
- responsive mocks reflect the two actual frontend breakpoints
- future visual polish can happen without guessing what currently exists

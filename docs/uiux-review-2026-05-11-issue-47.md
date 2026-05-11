# Bunny Game — UI/UX Design Review & Polish Roadmap

Linked issue: jonny-levi/bunny-game#47
Author: Bunny UI/UX Design Agent
Date: 2026-05-11

This review is based on the current source on `main` (post #41) plus the active branch `bunny-team/issue-44-restore-bunny-movement`. The whole game is a Phaser 3.80 canvas, fixed 800×600, scaled to fit, with everything drawn from primitive `add.rectangle/ellipse/circle/triangle/text` calls and emoji glyphs, plus a 400-piece SVG bunny library used for adult and baby sprites.

---

## 1. Honest read of the current product

Jonny is right: the game looks like a Phaser prototype, not a polished pet game. The mechanics are mostly in place — hatch, rooms, stats, actions, save — but visually it leans on three things that always read as "demo":

1. **Hardcoded geometric shapes pretending to be furniture/walls.** Every room is a stack of `Rectangle + Ellipse + Emoji`. There is no shared art language, no texture, no shading, no perspective. Each scene reinvents its own palette and decoration grammar from scratch.
2. **Emoji-as-art.** Sun, butterflies, magnets, books, hearts, stars, ducks — every "object" that isn't a primitive is a Unicode emoji. Emojis render with the host OS font, so the game literally looks different on iOS / Android / Windows / Mac. That alone kills "unique visual identity".
3. **No visual hierarchy.** Stat bars, action buttons, room label, side panel, arrows, season indicator, mute button — all compete at the same weight in the same general corner. The bunnies (the point of the game) get a smaller share of attention than the dark navy panel.

The 400 hand-drawn SVG bunnies are the strongest asset in the project and are currently fighting the rest of the UI. We should redesign around them, not around them being a feature drop-in.

---

## 2. Art direction proposal — "Storybook Pastel"

A single coherent direction we can ship in 6–8 polish PRs:

- **Genre reference points:** Animal Crossing (warmth, soft palette, charming objects), Stardew Valley (clear pixel-clean silhouettes), Neko Atsume (calm, minimal, "look at this cute thing"), Pokémon Café ReMix (rounded UI, soft shadows). Avoid Tamagotchi / 2000s-flash references — those are the "simple" trap.
- **Visual language:**
  - Rounded everything: 8–14px corner radius on every UI surface, no sharp 90° boxes.
  - Soft, multi-layer drop shadows (`0 4 12 rgba(0,0,0,0.18)` rather than 1px borders).
  - Backgrounds are **painted full-bleed SVG/PNG illustrations**, not Phaser primitive stacks.
  - Bunnies sit on a clearly defined "stage band" with a real ground shadow, not floating ellipses.
  - Lighting unified per room (warm/cool key light + complementary bounce).
- **Palette (single canonical set, replaces ad-hoc colors in every scene):**
  - Brand pink `#FF6B9D` and warm cream `#FFF6E9` stay — they're already the identity.
  - Add: deep plum `#3E1E4F`, sage `#A8D5BA`, butter `#FFD89C`, dusty sky `#B8D8E8`, ink `#2A2440`.
  - Per-room mood overlays use this palette at 8–12% alpha rather than each room inventing new colors.
- **Typography:**
  - Replace `Arial, sans-serif` with a bundled webfont pair: **Fredoka** (rounded display) for titles/HUD, **Nunito** (body geometric) for stats/labels. Both are free, open-license, ~70KB total when subsetted.
- **Iconography:**
  - Replace **every** emoji used as UI/decoration with a custom SVG icon set (carrot, water drop, sparkle, heart, moon, sun, food bowl, stethoscope, etc.). Same stroke weight, same corner radius. Emojis can remain inside chat/activity log because there they are content, not chrome.
- **Motion language:**
  - Default easing: `Sine.easeInOut` for ambient, `Back.easeOut` for tap response, `Cubic.easeOut` for transitions. Standardize per-interaction durations: tap 120ms, hover 180ms, transition 350–450ms.
  - Every interactive element has a 1-frame "press-in" (scale 0.94) on `pointerdown` and a 200ms "bloom" (scale 1.06 + soft glow) on success.

---

## 3. Per-scene findings & recommendations

### 3.1 LoginScene
Current state: the bunny "logo" is literally rendered as ~15 stacked `add.ellipse` calls (`LoginScene.ts:36-64`). The "Jonny" / "Elina" buttons are flat blue/purple rectangles.

Issues:
- The logo bunny does not match the SVG bunnies inside the game — first impression is "two different art styles".
- Title strokes are 4px black on pink — reads as 2008 Flash.
- No game name treatment, no tagline, no version/build, no quiet animation that hints at gameplay.

Recommended:
- Replace the primitive bunny with a hero SVG illustration: family scene (Mom + Dad + egg in nest), painted background, sunset light. Reuse the existing SVG bunny set for father/mother portraits.
- Logotype: "Bunny Family" in Fredoka 56px with a subtle 2px brand-pink outline and a soft drop shadow, plus a tiny tagline "raise your bunny family together".
- Player cards instead of pill buttons: 220×120 rounded cards with avatar (current player's preferred bunny portrait), name, and "last played 3h ago" subtext. Tap card → press-in → fade out.
- Optional: "Add player" empty card so the two-player roster is no longer hardcoded.

### 3.2 BootScene
Current state: 30-frame fake progress bar, plain navy background.

Issues:
- The fake progress bar feels worse than no progress bar — players notice it always finishes in 750ms exactly.
- Loading screen is the first "real" frame of the brand — currently it conveys nothing.

Recommended:
- Tie the bar to actual `Phaser.Loader` `progress` event. The asset preload is real work (SVGs), bind to it.
- Replace navy with the same painted hero scene as Login, just with a slow parallax cloud drift.
- Loading copy rotates through 5–6 charming hints ("Warming up the nest…", "Brushing the bunnies…", "Feeding the carrots…").
- Logo lockup top-center identical to Login (so the boot→login handoff feels continuous, no jump).

### 3.3 OnboardingNestScene (hatch)
Current state: This is the *strongest* scene visually — soft pink, floating hearts, parents on either side, central egg with cracks, progress bar (`OnboardingNestScene.ts:44-202`). It's also the most game-like moment.

Issues:
- The hatch progress UI is at the bottom of the canvas in a thin bar; the emotional payoff (egg cracking) doesn't pulse the whole frame.
- No haptic-feeling moment between tap and the next crack — feels like clicking a button until something happens.
- The parents look at *the camera*, not at the egg.
- The handoff to LivingRoom is a sudden fade.

Recommended:
- Re-stage the scene as a vertical hero composition: parents flank a centered nest, both gently tilted *toward* the egg.
- Replace the bottom progress bar with a "heart meter" floating above the egg that fills in beats — each tap pushes one heart upward like a particle.
- Stronger feedback per tap: chromatic aberration flash on `cameras.main.flash(40)`, ambient hearts speed up briefly, egg gets a 4px glow that intensifies with progress.
- At `taps >= HATCH_TAPS * 0.5` introduce a soft "the egg is moving!" hint that fades after 3s.
- Hatch reveal: not just sparkles → add a brief radial wipe of warm light, hold on baby + parents in a "family photo" pose for 1.5s, then crossfade. Save the moment, optionally as a shareable PNG ("It's Boba!").

### 3.4 LivingRoomScene
Current state: peach wall + wood floor + emoji art (`LivingRoomScene.ts`).

Issues:
- The "couch" is a single coral rectangle with two cushion ellipses — reads as a flag on a brown bar.
- "Picture frames" are emoji in a rectangle.
- Curtains are 16-px-wide pink rectangles.
- The rug is three overlapping ellipses with 0.25 alpha (looks like a stain).

Recommended:
- Replace the entire `drawRoom()` body with a single painted background SVG (`assets/rooms/living-room.svg`) that is the room. Foreground props (couch arm, lamp) can be a second SVG layer for parallax.
- Add seasonal dressing: light flecks through the window in summer, snow on windowsill in winter, falling leaves in autumn. Drive from existing `getSeason()` (`utils/time.ts`).
- Bunnies need a "spot" — a soft area rug or floor cushion that signals "this is where the bunny is". Not three random ellipses.
- The day/night overlay (`RoomScene.ts:84-87`) is a flat tint — replace with a directional light gradient (warm from window in day, cool moonlight from window at night).

### 3.5 KitchenScene
Current state: tile patterns, stove with emoji pots, fridge, food bowl with `🥕🥬` text (`KitchenScene.ts`).

Issues:
- The bowl is literally an ellipse with two emojis floating above it.
- Stove + fridge geometry is fine in structure but flat in shading.
- Tile backsplash is a real grid but uses a colored rectangle for each tile — too noisy.

Recommended:
- Painted kitchen background, **a real food bowl illustration** that the baby bunny can be visually "next to" while eating.
- During `playEating()`, spawn a small carrot/lettuce particle sprite from the bowl that arcs to the bunny's mouth, then `*pop*` disappears. Currently it's just a body-squash. The eating feedback should be visual and obvious.
- Steam from the pot already exists — keep but redo as small SVG puffs, not `'~'` characters.

### 3.6 BathroomScene
Current state: bathtub ellipse, rainbow bubbles, mirror, duck emoji, faucet (`BathroomScene.ts`).

Issues:
- The bubbles are good in concept, weak in execution (flat-color circles).
- No "in the bath" state for the bunny — it just walks around the tub.
- The rubber duck is an emoji.

Recommended:
- During `playClean()`, lift the selected bunny into the bath with a small arc tween; the bunny gets a soap-bubble overlay sprite; foam particles drift upward; mirror gets fog overlay. Currently `clean` just calls `playPlaying()` (`RoomScene.ts:285`) — that's a bug-grade UX miss.
- Custom rubber-duck SVG with idle bob.
- Bubbles get inner highlight + transparent core; spawn from the water surface, not random Y positions.

### 3.7 GardenScene
Current state: sky + sun (`☀️`-adjacent), clouds, fence, grass blades, flowers, butterfly emoji, ball (`GardenScene.ts`).

Issues:
- Strongest "looks like a kid's coloring page" scene. That isn't necessarily bad, but it doesn't match the other rooms' indoor aesthetic.
- Flowers are 5 circles in a pentagon — every flower in the scene looks identical.
- Tree is one ellipse trunk + three circles.
- Butterfly is an emoji that slides on a hardcoded path.

Recommended:
- 3-layer parallax: distant hills, mid-trees, near-grass. Subtle parallax on bunny drag would feel premium.
- Real flower SVGs in 3–4 variants, scatter procedurally.
- Replace ball with a proper SVG yarn-ball or fabric ball that the bunny can chase during `playPlaying()`.
- Add wind: 3% sway on grass and tree, controlled by single shared tween — costs nothing, adds enormous life.

### 3.8 BedroomScene
Current state: night sky, stars, moon, bed with pillows, nightstand, lamp, bookshelf, dim overlay (`BedroomScene.ts`).

Issues:
- The bed is the best composition in the game and proves real geometry can work.
- The dark overlay (`0x000033 alpha 0.2`) flattens the whole scene; you can't tell pillows from blanket.
- During `playSleeping()` the bunny doesn't lie *in* the bed — it sits beside it.

Recommended:
- Real bed SVG. During `playSleeping()`, the bunny tweens to the pillow position, scales to a "lying down" pose (or swap to a `sleeping` SVG variant — that asset already exists in `assets/bunnies/baby/sleeping/`).
- Replace flat dark overlay with a 3-stop radial gradient: brightest around the lamp glow, dim everywhere else. Use a `Phaser.GameObjects.RenderTexture` once instead of one giant rect.
- Stars should occasionally shoot — once every ~30s a small streak crosses the top. Tiny detail, big charm.

### 3.9 VetScene
Current state: mint walls, exam table, medical cross, medicine cabinet, certificate, heart monitor with pulsing `♡` (`VetScene.ts`).

Issues:
- Vet office is the most "clinical" room — fine for theme but currently reads as "PowerPoint clip art".
- No vet character.
- "Take to vet" is a high-emotion moment that should feel reassuring; right now it's just another room.

Recommended:
- Introduce an NPC: "Dr. Hop" — a single bunny SVG in a lab coat (reuse the bunny SVG with a coat overlay layer). She stands behind the exam table; tap her for a one-liner.
- Real heart-monitor sprite that draws a sinusoidal ECG line using `Phaser.GameObjects.Graphics` rather than a pulsing `♡` text.
- Medicine cabinet bottles: same SVGs but with distinct labels (carrot extract, hop syrup, etc.) for personality.

### 3.10 NestScene (post-onboarding)
Current state: pink walls, hearts, big nest, feathers, candles (`NestScene.ts`).

Issues:
- This is technically the "breed" room, so it should be the *most* tender/romantic place in the game.
- Currently it shares 95% of the OnboardingNestScene look — confusing.
- No fireplace, no second nest, no nursery affordances.

Recommended:
- Differentiate from Onboarding: this is the "family room", so add a second smaller nest for the baby, a soft fireplace, a window showing the family tree.
- During `playBreed()`, gentle heart-particle convergence between the two parents, fade-in of a small egg in the nest if breeding succeeds (or "not yet" copy if cooldown active).
- The `breed` action currently has no scene-specific behavior beyond room nav (`RoomScene.ts:269`). Add a clear visual response.

---

## 4. Cross-cutting systems

### 4.1 HUD (`HUDScene.ts`)
Current state: dark navy side panel, 184px wide, stat bars + 2×3 button grid + mute, with a collapse toggle.

Issues:
- Dark navy panel against pastel rooms is jarring — high contrast where we want warmth.
- The bunny's name + stage is text-only inside the panel; player can't see *which* bunny is selected without reading.
- Action buttons all look the same — six pastel pills with one-word labels. No icon, no cooldown ring (cooldown is a tiny text countdown).
- Compact mode shows only a "lowest %" number — that's an aggregate, not actionable.
- The room navigation arrows are 32px ◀ ▶ glyphs at vertical center of the canvas. Slightly hidden, not paginated.

Recommended:
- HUD chrome: switch to a "frosted glass" card style — `0xfff6e9` at 92% alpha, 16px corner radius, soft 16px blur shadow. Stays readable on every room.
- Selected-bunny header inside the HUD: avatar (small SVG portrait), name, life stage, age. Tap to cycle bunnies.
- Stat bars: replace simple horizontal fills with **segmented bars** (5 segments per stat) and a tiny icon. When a stat drops below 30%, the segment pulses and an alert dot appears on the room navigation arrow leading to the relevant room (e.g., low hunger → pulse on the Kitchen direction).
- Action buttons: 64×64 rounded squares with custom icon glyphs and a circular cooldown ring drawn via `Graphics.arc()`. Disable state desaturates instead of going grey.
- Compact mode: show a vertical stack of 5 micro-icons (one per stat) with a colored dot whose hue maps to need urgency. Tap to expand. This is glanceable.
- Replace the left/right arrows with a horizontal **room dock** at the bottom of the canvas (7 small room icons, current room highlighted, badge dot for any room with an actionable need). Massively improves discoverability and screams "real game".

### 4.2 Bunny presentation (`Bunny.ts`)
Current state: programmatic body (24+ shape primitives) overlaid with the SVG sprite when available.

Issues:
- The programmatic body and the SVG body are visually inconsistent — sometimes one shows, sometimes the other, depending on load order.
- Mother / Father / Baby identity is "the SVG number", which means the family doesn't have a strong, stable visual signature beyond color.
- Name labels are bold white with black stroke — fine on dark scenes, harsh on pastel ones.

Recommended:
- **Single source of truth: the SVG sprites.** Use the geometric body *only* as a placeholder while the SVG loads (≤200ms in practice). The current "egg" mode can still use shapes since no SVG exists for that.
- Add a soft ground shadow under each bunny (`ellipse 60x10 0x000 alpha 0.18`) that scales with bunny y — already partially present, make it dynamic so when the bunny jumps it scales smaller.
- Name labels: chip-style pill ("Boba ♥") below the bunny, brand-pink background at 90% alpha, white text. Reads beautifully on every backdrop.
- Identity affordances: keep mother in a soft lavender scarf, father in a sage green bowtie, baby in a butter-yellow bow — overlay sprites that ride on top of the SVG, never moved per-bone. This is the cheapest possible visual identity for the family unit.
- Selected-state ring: a soft pulsing ring `ellipse` under the active bunny, brand-pink at 0.25 alpha, scaled 1.2.

### 4.3 Transitions & micro-interactions
- Replace every `cameras.main.fadeOut(250)` → `start()` with a **room-themed transition**: e.g. a curtain wipe from the side, or a "page turn" if we lean into storybook. Even a 1-second branded transition is enough.
- Every tap on a bunny shows a 3-frame ♥ pop above its head.
- Every successful action shows a +5/+10 floating number from the bunny in the relevant stat color (`Bunny.ts` doesn't currently do this).
- Every cooldown end plays a tiny "ding" + a glow on the button.
- Sleep z's already animate, but they should also fade out and respawn from the bunny's head, not appear at a fixed offset.

### 4.4 Mobile-first layout
Current state: fixed 800×600 with `Phaser.Scale.FIT` (`main.ts:21-24`). The viewport meta blocks pinch (`index.html:5`). HUD has a `MOBILE_BREAKPOINT = 700` and collapses, but the *canvas* itself doesn't reflow.

Issues:
- On a phone in portrait, the canvas scales down to ~60% and leaves huge black bars top/bottom.
- Tap targets at 800×600 logical are ~28px physical on a 360pt portrait phone — touch-hostile.
- The compact HUD panel still sits over the right edge of the canvas where the right-arrow nav lives — they overlap on small screens.

Recommended:
- Switch scale mode to `Phaser.Scale.RESIZE` and add a layout manager that:
  - In portrait, drops the room dock to the bottom edge of the device viewport (outside the play area), enlarges to 56px icon size, and moves the HUD chip stack to top-right.
  - In landscape, keeps current side panel but anchors it to viewport edges, not logical canvas edges.
- All interactive elements ≥ 44pt CSS-equivalent; bunnies have a generous invisible hitbox (already done at 80×130, increase to 100×150 on mobile).
- Drop the `maximum-scale=1.0, user-scalable=no` — that's an a11y red flag and unnecessary if our own scaling is correct.

### 4.5 Desktop scaling
- Add a "max bunny size" guard so on a 4K monitor bunnies aren't 400px tall and pixelated.
- Add an optional "wide" room art variant (1280×640) so on landscape monitors the room isn't pillarboxed.

### 4.6 Empty / loading / error states
Current state: no empty state for "no bunnies", no error UI when WS disconnects, no offline mode messaging.

Recommended:
- **Empty bunny state:** if `gameBunnies` is empty (server hasn't responded yet), show a soft skeleton: greyed-out family silhouettes + "Waking your bunnies…" copy + a Lottie-style spinner. Currently the screen just looks broken.
- **Disconnected state:** thin amber bar across the top "Reconnecting…", retried 3 times with backoff. Currently failures are silent.
- **Action error:** when `applyAction` falls back to local (`RoomScene.ts:211`), surface a tiny toast "Saved locally — will sync".
- **Hatch interrupted:** if the player closes the tab mid-hatch and comes back, currently the egg state restores (good!) but there's no copy explaining "you were at 7/12 taps — keep going". Add the line.
- **First-time tooltip layer:** 4 dismissible coach marks on first session ("This is your stat panel", "Tap a bunny to select", "Drag bunny to move", "Use these to switch rooms"). Persisted in localStorage.

### 4.7 Accessibility & readability
- Color: 5 of 6 action buttons are similarly-saturated pastels and rely on label text alone for distinction. Add a unique glyph per action; verify each pair passes 3:1 non-text contrast.
- Text: every label currently uses Arial with a black stroke. Adopt the Fredoka/Nunito pair, set min 14px body / 12px caption.
- Animation: respect `prefers-reduced-motion` — disable idle bounces and `cameras.shake`, keep transitions but cap at 150ms.
- Keyboard: arrow keys move the selected bunny (good), but you can't switch bunnies or rooms with the keyboard. Add `Tab` to cycle bunnies, `[` `]` to change rooms.
- Screen readers: canvas is opaque to AT. Add an off-canvas live region (`<div aria-live="polite">`) mirroring activity log + action confirmations.

### 4.8 Audio direction
Current state: oscillator blips + a single 8-note triangle loop (`utils/sound.ts`).

Issues:
- The bg music loop is 4 seconds long, never varies, and repeats forever. After 30 seconds it's actively annoying.
- The blips don't feel like the actions — feeding is a 2-tone trill, sleeping is a single tone, cleaning is a bright chirp — none of them are *cute*, they're literal "old electronic toy" sounds.

Recommended (phased):
- **Phase A (cheap):** richer oscillator design — every effect is min 2 oscillators (carrier + modulator), pass through a soft `BiquadFilter` lowpass. Add a tiny 50ms attack + 200ms release envelope. Same Web Audio, much warmer.
- **Phase B (samples):** bundle 8–12 short OGG samples (≤30KB each) — feed, clean, play, sleep, medicine, breed, hatch, success-chime, fail-tone, click. License under CC0 (Freesound.org or Kenney.nl).
- **Phase C (music):** replace the loop with a layered ambient pad (3 looped stems: pad, melody, ornament) that swap per room. Total ~400KB of OGG. Optional, ship behind a feature flag.
- Volume control: add a slider, not just mute/unmute.

### 4.9 Performance
- The 400 SVG library is excellent but lazy-loaded one-by-one. After hatch we know exactly which 4–6 SVGs the player needs forever — preload them on hatch completion.
- Replace the dozens of small `add.rectangle/ellipse/text` ambient particle calls per scene with a single `Phaser.GameObjects.Particles.ParticleEmitter`. Fewer game objects, lower draw calls.

---

## 5. Prioritized polish roadmap

We break the work into one **design epic** and ten **implementable issues**, in three priority tiers. Each is sized to one PR.

### Tier 1 — Foundation (do these first, they unblock everything else)

| # | Title | Effort | Why first |
|---|---|---|---|
| A | Design system: tokens, fonts, icon set | M | Every other PR consumes it |
| B | Painted backgrounds: replace `drawRoom()` primitives with SVG illustrations (7 rooms) | L | Single biggest visual jump |
| C | HUD redesign: frosted card, segmented stats, icon buttons, room dock | M | Owns 40% of screen time |

### Tier 2 — Identity & feel (do these next)

| # | Title | Effort | Why second |
|---|---|---|---|
| D | Bunny presentation: SVG-only body, identity accessories, ground shadow, selection ring | M | Fixes the "two art styles" problem |
| E | Action feedback: floating numbers, +N stat ticks, action-specific bunny choreography per room | S | Cheap, transforms perceived polish |
| F | Onboarding hatch hero moment: heart-particle progress, family-photo reveal, branded transition | M | First-run impression |
| G | Login + Boot redesign: hero illustration, player cards, real progress, brand lockup | S | Front door of the game |

### Tier 3 — Depth (ship after Tier 1–2)

| # | Title | Effort | Why later |
|---|---|---|---|
| H | Mobile-first layout: responsive scale, dock anchoring, ≥44pt tap targets | M | Needs the new dock + HUD landed first |
| I | Empty/loading/error states + first-run coach marks | S | Best built once shape of UI is fixed |
| J | Audio polish (Phase A oscillators + Phase B sample pack) | S | Independent track |
| K | Accessibility pass: reduced motion, contrast, keyboard nav, ARIA mirror | S | Final QA-style sweep |

Operating rule per Jonny: every implementation PR links back to this design issue, QA verifies visual polish before close, and no item deploys to production without his approval.

---

## 6. Acceptance criteria templates

Each child issue will use the same shape so QA can verify visually and the bunny-team agents have a clear contract. See the GitHub issues created from this review for filled-in versions. Template:

```
**Design context:** link back to #47 and this doc.
**Scope:** what changes, what does not change.
**Visual reference:** screenshot/mock or detailed spec from this doc.
**Definition of done:**
- TypeScript builds (`npm --prefix frontend run build`) green.
- Backend unaffected (`npm --prefix backend run build` green if touched).
- Visual QA: side-by-side before/after screenshots posted in the PR.
- Mobile QA: tested at 360×800 portrait and 1280×800 landscape; no element off-canvas.
- a11y QA: keyboard reachable, prefers-reduced-motion respected (if interactive).
- No regression on hatch / save / movement flows.
- PR description links the design issue.
```

---

## 7. What does NOT change in this roadmap

Explicitly out of scope so we don't sneak rewrites in:

- Save/load contract with backend (`network/SaveClient`).
- WebSocket protocol (covered by the separate handoff `docs/research-handoff-2026-05-11-0906.md`).
- Needs decay balance numbers in `state/needs.ts`.
- Action set (`game/actions.ts`) — adding new actions is a separate gameplay decision, not a polish item.
- Kubernetes/Helm deploy pipeline.

---

## 8. Suggested execution order

1. Land issue **A** (design system). Without it, every later PR re-invents tokens.
2. In parallel: **G** (Login/Boot) and **D** (Bunny presentation) — both small, both immediately visible, neither blocks the rooms work.
3. Then **B** (painted rooms) — biggest art lift, scope per-room PR if needed (one PR for backgrounds, one for foreground props).
4. Then **C** (HUD redesign) on top of the new design system.
5. Then **E** + **F** for game-feel.
6. Then **H** + **I** + **J** + **K** in any order; ideally H first since the dock landing changes layout.

Total realistic timeline: ~3–4 weeks of focused work for the full roadmap. First visible jump ("game now looks polished") should land within ~5 PRs.

V7 proposals — pick one (or approve+variant):
A) Bubble Bath Duet — co-op tub with sponge+tap stations; both must hold 5s to fully clean a dirty baby; auto Bath Day memory + photo — medium
B) Personality Reveal & Bond — surface the baby-personality system that's shipped invisibly for 5 iterations + a daily co-op "guess the trait" bond moment — medium (or B+variant1 = chip-only, ~80 LOC, small)
C) Onboarding + Activities — 5-step first-time co-op tutorial AND wire up the 4 already-built-but-unreachable mini-games as a discoverable Activities menu — large

Reply: A / A+variant1 / B / B+variant1 / C / C+variant1 / reject all / change <X>

Notes:
- V4 wish-jar code is still confirmed reverted (zero `wish` matches in backend/ or frontend/). File as V7.1 if you want it restored.
- V5 + V6 were both never approved; their analyses still hold.
- Big surprises this audit: baby personality is fully invisible to players (server emits `personalityInfo`, frontend never reads it); the 4 mini-games exist server-side but are unreachable from the UI; day/night cycle is purely cosmetic.
- Researcher recommends B+variant1 for the smallest defensible win, or A for the most "feature-y" hand-feel.

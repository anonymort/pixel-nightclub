# Contact Physics, Movement, and NPC Goal Plan

## Goal

Improve the first-person exploration feel by making player movement more predictable, contact physics less snaggy, and NPC behavior more spatially aware while preserving the cozy lounge experience.

## Success Criteria

- [x] Player movement has explicit walk/run speed caps and frame-rate-stable acceleration/deceleration.
- [x] Static contact with walls, furniture, doorways, stools, and props feels smooth rather than sticky.
- [x] Player and NPC contact uses one shared collision model instead of unrelated push systems.
- [x] NPCs keep believable personal space without drifting through furniture or blocking paths permanently.
- [x] NPC reactions feel intentional, with field-of-view, cooldowns, and role-specific behavior.
- [x] Movement, collision, and NPC steering have focused automated tests.
- [x] Visual QA remains deterministic enough to compare screenshots between runs.

## Phase 1: Movement Tuning

- [x] Extract player movement constants into named fields:
  - [x] `walkMaxSpeed`
  - [x] `runMaxSpeed`
  - [x] `acceleration`
  - [x] `deceleration`
  - [x] `friction`
- [x] Replace friction-only top speed with explicit velocity clamping.
- [x] Make sprint multiplier match the intended design, likely `1.25x` unless a faster arcade feel is wanted.
- [x] Use exponential damping for frame-rate-stable slowdown.
- [x] Preserve existing pointer-lock and keyboard behavior.
- [x] Add tests for:
  - [x] walk speed cap
  - [x] run speed cap
  - [x] diagonal movement normalization
  - [x] velocity decay when input stops
  - [x] velocity reset on blur or pointer unlock

## Phase 2: Shared Contact Model

- [x] Add a small 2D contact layer for X/Z gameplay collisions.
- [x] Define collider types:
  - [x] `wall`
  - [x] `furniture`
  - [x] `npc`
  - [x] `softNpc`
  - [x] `trigger`
- [x] Use circles or capsules for player and NPC bodies.
- [x] Keep visual meshes separate from physical colliders.
- [x] Give each collider:
  - [x] position
  - [x] radius or half-extents
  - [x] solidness
  - [x] contact weight
  - [x] collision category
- [x] Add a small skin width, around `0.03m`, to prevent jitter from tiny overlaps.
- [x] Replace independent X/Z blocking with contact-normal projection.
- [x] Preserve wall sliding behavior after the resolver change.
- [x] Add tests for:
  - [x] sliding along a flat wall
  - [x] resolving corner contact
  - [x] ignoring trigger-only colliders
  - [x] no jitter when starting near but not inside a wall

## Phase 3: Static Collider Cleanup

- [x] Audit all `MapBuilder` solid objects.
- [x] Replace exact mesh-derived colliders with simpler gameplay colliders where needed.
- [x] Add forgiving doorway colliders so doorframes do not snag the player.
- [x] Treat small props as non-solid unless they meaningfully block movement.
- [x] Make stool/counter collisions feel passable around edges without letting the player walk through the bar.
- [x] Add debug helpers for drawing collider outlines in development.
- [x] Verify these areas manually:
  - [x] exterior entrance
  - [x] lobby-to-hall doorway
  - [x] bar stools
  - [x] music selector booth
  - [x] lounge sofas and coffee table
  - [x] fireplace corner

## Phase 4: NPC Contact and Personal Space

- [x] Register NPC bodies in the shared contact layer.
- [x] Make player-to-NPC contact reciprocal:
  - [x] player slows or slides when pushing a heavy NPC
  - [x] light NPCs yield more easily
  - [x] seated and staff NPCs resist movement more strongly
- [x] Replace current independent NPC crowd resolver with the shared solver.
- [x] Give every NPC a role-specific contact profile:
  - [x] standing patron
  - [x] wanderer
  - [x] seated patron
  - [x] doorman
  - [x] bartender
  - [x] music selector
- [x] Add return-to-anchor behavior after pushed NPCs drift too far.
- [x] Add tests for:
  - [x] two NPCs separating without overshooting
  - [x] player pushing a light NPC
  - [x] player not moving seated/staff NPCs too far
  - [x] pushed NPC returning toward its anchor

## Phase 5: NPC Navigation

- [x] Add a lightweight nav graph for room-to-room movement.
- [x] Include nodes for:
  - [x] exterior entrance
  - [x] lobby
  - [x] hall center
  - [x] bar mingle area
  - [x] lounge mingle area
  - [x] music booth area
  - [x] doorway transitions
- [x] Move wanderers between graph nodes instead of direct straight-line targets.
- [x] Add local avoidance steering around:
  - [x] player
  - [x] other NPCs
  - [x] solid furniture
  - [x] doorway bottlenecks
- [x] Keep each NPC within a home area unless explicitly transitioning.
- [x] Add tests for:
  - [x] path selection between mingle spots
  - [x] no path through solid furniture
  - [x] avoidance when another NPC blocks the route
  - [x] fallback behavior when a path is temporarily blocked

## Phase 6: NPC Reactions and Social Behavior

- [x] Replace pure distance-based looking/waving with field-of-view checks.
- [x] Add cooldowns so NPCs do not all react at once.
- [x] Give reaction weights by role and personality.
- [x] Keep doorman, bartender, seated patrons, and selector behavior distinct.
- [x] Add subtle idle variety without changing the core cozy tone.
- [x] Add tests for:
  - [x] NPC looks at player only inside field-of-view or close range
  - [x] wave cooldown prevents repeated spam
  - [x] staff NPCs favor work animations over social reactions

## Phase 7: Determinism and QA

- [x] Add a seeded random helper for NPC spawning and animation phase setup.
- [x] Use deterministic seeds for visual QA scripts.
- [x] Keep normal gameplay varied when no QA seed is provided.
- [x] Add screenshots or tour checkpoints for collision-heavy locations.
- [x] Run verification:
  - [x] `npm run lint`
  - [x] `npm run test`
  - [x] `npm run build`
  - [x] `npm run qa:screenshots`

## Implementation Order

- [x] Start with movement constants and tests.
- [x] Add the shared contact layer behind the existing player controller.
- [x] Migrate player static collisions.
- [x] Tune static colliders in the map.
- [x] Register NPCs in the shared contact layer.
- [x] Replace NPC crowding and player-push logic.
- [x] Add navigation only after contact behavior is stable.
- [x] Add richer NPC reactions last.
- [x] Finish with visual QA and tuning passes.

## Out of Scope

- [x] Do not replace Three.js or the existing manager architecture.
- [x] Do not rewrite the full map layout.
- [x] Do not add a heavyweight physics engine unless the lightweight contact layer proves insufficient.
- [x] Do not change the cozy lounge art direction or room identity.

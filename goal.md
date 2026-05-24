# Souvenir Snapshot Goal Plan

## Goal

Add a photographer-driven souvenir snapshot feature that lets players trigger a framed keepsake photo from inside the lounge experience, using the existing interaction, UI, NPC, camera, and procedural atmosphere systems without breaking the cozy tone of the app.

## Success Criteria

- [x] The player sees a contextual prompt such as `Take a souvenir photo` near at least one photographer interaction zone.
- [x] Pressing `E` triggers a brief, readable snapshot flow without confusing pointer-lock behavior.
- [x] The photographer NPC gives visible feedback such as a flash or pose reaction when the photo is taken.
- [x] The player sees a styled photo preview within about 1 second of triggering the interaction.
- [x] The preview uses a curated composition rather than a raw first-person frame.
- [x] The player can save the image locally from the browser.
- [x] Existing `sit`, `order a drink`, and `Choose the vibe` interactions continue to work as they do now.
- [x] The new behavior is covered by focused automated tests.

## Phase 1: Snapshot Experience Model

- [x] Define the v1 snapshot flow in shared config or a small dedicated module.
- [x] Decide the initial capture location and framing rules for the first souvenir photo.
- [x] Keep the first slice intentionally narrow:
  - [x] one photographer interaction zone
  - [x] one curated camera composition
  - [x] one postcard-style preview treatment
- [x] Add player-facing copy for:
  - [x] interaction prompt
  - [x] loading/capture feedback
  - [x] preview actions

## Phase 2: Interaction Wiring

- [x] Add a new photographer interactable in `src/interaction/wireInteractables.js`.
- [x] Reuse the current `InteractionManager` verb system instead of creating a separate interaction pathway.
- [x] Add a new interaction verb such as `takeSnapshot`.
- [x] Ensure the prompt only wins when the player is near and facing the intended photographer zone.
- [x] Keep seating, bartender, and turntable behaviors unchanged.

## Phase 3: Camera and Capture Flow

- [x] Add a lightweight app-level flow that can temporarily stage a curated snapshot camera view.
- [x] Prevent movement conflicts while the snapshot is being staged and captured.
- [x] Capture the rendered image from the existing WebGL canvas without introducing a backend service.
- [x] Restore the player camera and controls cleanly after capture.
- [x] Keep the implementation compatible with the current `AppController` and `SceneManager` responsibilities.

## Phase 4: Photographer NPC Feedback

- [x] Reuse the existing photographer flash and reaction system in `src/entities/NPCManager.js`.
- [x] Add a targeted API so the interaction layer can trigger a specific snapshot reaction on demand.
- [x] Keep the reaction brief, legible, and in-character with the existing exterior photographer setup.
- [x] Make sure this behavior does not interfere with the ambient photographer trigger logic already tied to entrance movement.

## Phase 5: Snapshot Preview UI

- [x] Add a preview overlay to `src/ui/UIManager.js` for showing the captured image.
- [x] Style the preview like a lounge keepsake or postcard rather than a debug modal.
- [x] Include at least:
  - [x] dismiss action
  - [x] save/download action
- [x] Make pointer-lock recovery predictable after the preview is closed.
- [x] Keep the overlay testable with the current UI manager patterns.

## Phase 6: Data and Browser Behavior

- [x] Keep all capture and preview behavior client-side.
- [x] Use browser-native image export behavior such as `canvas.toBlob()` or equivalent.
- [x] Avoid adding persistence, accounts, or cloud storage.
- [x] Decide whether preview state should store:
  - [x] image blob URL
  - [x] capture metadata such as title or timestamp
- [x] Clean up temporary object URLs on dismissal/dispose.

## Phase 7: Tests

- [x] Add `InteractionManager` tests for:
  - [x] photographer prompt selection
  - [x] triggering the snapshot verb
  - [x] preserving existing interaction priority behavior
- [x] Add `UIManager` tests for:
  - [x] showing and dismissing the preview
  - [x] preserving timer and cleanup behavior
- [x] Add focused `NPCManager` tests for:
  - [x] explicit photographer reaction triggering
  - [x] coexistence with existing ambient flash behavior
- [x] Add focused controller or scene tests where practical for camera staging / restoration logic.

## Implementation Order

- [x] Start by defining the first photographer interaction zone and the single curated snapshot composition.
- [x] Add the new interaction verb and dispatch flow next.
- [x] Add the NPC reaction hook and camera staging behavior.
- [x] Add the preview overlay and local save action after capture works.
- [x] Finish with tests, pointer-lock polish, and UX tuning.

## Out of Scope

- [x] Do not add backend upload, galleries, accounts, or social sharing integrations.
- [x] Do not build a multi-pose photo studio in the first slice.
- [x] Do not introduce a general-purpose photo mode with free camera controls.
- [x] Do not replace the current manager architecture.
- [x] Do not expand the feature into room-wide collectibles or progression systems yet.

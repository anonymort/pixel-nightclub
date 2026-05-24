// Concrete interactables for the lounge. Coordinates come from MapBuilder
// (bar stools, armchairs) and NPCManager (bartender) — kept in one place so
// neither of those classes has to learn about InteractionManager.
import { INTERACTION_COPY } from '../config/experience.js';

const BAR_STOOL_XS = [5.8, 7.2, 8.6, 10.0, 11.4];
const BAR_STOOL_Z = 5.8;

const ARMCHAIRS = [
  { id: 'armchair-1', x: 10.5, z: -17.0 },
  { id: 'armchair-2', x: 15.5, z: -13.0 },
];

const STOOL_ACOUSTIC = { cutoff: 0.85, volume: 0.92 };
const ARMCHAIR_ACOUSTIC = { cutoff: 0.75, volume: 0.88 };

const BARTENDER_TALK_ANCHOR = { x: 9.0, z: 7.5 };
const TURNTABLE_ANCHOR = { x: 16.4, z: 0.0 };
const PHOTOGRAPHER_ANCHOR = { x: -7.9, z: -2.15 };

export function wireInteractables(interactionManager) {
  for (const x of BAR_STOOL_XS) {
    interactionManager.registerInteractable({
      id: `stool-${x.toFixed(1)}`,
      position: { x, z: BAR_STOOL_Z },
      range: 1.1,
      verb: 'sit',
      label: 'Sit',
      seated: { anchorX: x, anchorZ: BAR_STOOL_Z - 0.2, eyeHeight: 1.0 },
      acoustic: STOOL_ACOUSTIC,
    });
  }

  for (const chair of ARMCHAIRS) {
    interactionManager.registerInteractable({
      id: chair.id,
      position: { x: chair.x, z: chair.z },
      range: 1.2,
      verb: 'sit',
      label: 'Sit',
      seated: { anchorX: chair.x, anchorZ: chair.z, eyeHeight: 0.85 },
      acoustic: ARMCHAIR_ACOUSTIC,
    });
  }

  interactionManager.registerInteractable({
    id: 'bartender-order',
    position: BARTENDER_TALK_ANCHOR,
    range: 1.4,
    verb: 'order',
    label: 'Order a drink',
  });

  interactionManager.registerInteractable({
    id: 'turntable-mood-selector',
    position: TURNTABLE_ANCHOR,
    range: 1.6,
    verb: 'selectMood',
    label: INTERACTION_COPY.moodSelectorLabel,
  });

  interactionManager.registerInteractable({
    id: 'souvenir-snapshot',
    position: PHOTOGRAPHER_ANCHOR,
    range: 1.8,
    verb: 'takeSnapshot',
    label: INTERACTION_COPY.souvenirSnapshotLabel,
  });
}

import * as THREE from 'three';

const DRINK_NAMES = ['WHISKEY, NEAT', 'OLD FASHIONED', 'HOT TODDY', 'GINGER FIZZ'];
const DEFAULT_FOV = Math.PI / 3; // ±60°

export class InteractionManager {
  /**
   * @param {ControlsManager} controls
   * @param {AudioManager} audio
   * @param {NPCManager} npcManager
   * @param {UIManager} uiManager
   */
  constructor(controls, audio, npcManager, uiManager) {
    this.controls = controls;
    this.audio = audio;
    this.npcManager = npcManager;
    this.uiManager = uiManager;

    this.interactables = [];
    this.currentTarget = null;
    this.seatedSpec = null;
    this.drinkCursor = 0;

    this._forward = new THREE.Vector3();
  }

  registerInteractable(spec) {
    this.interactables.push(spec);
    return spec;
  }

  clear() {
    this.interactables = [];
    this.currentTarget = null;
  }

  getActivePrompt() {
    if (this.seatedSpec) return { label: 'Stand', key: 'E' };
    if (!this.currentTarget) return null;
    return { label: this.currentTarget.label, key: 'E' };
  }

  update(_dt) {
    const camera = this.controls?.camera;
    if (!camera) return;

    if (this.controls.interactQueued) {
      this.controls.interactQueued = false;
      this._dispatch();
    }

    if (this.seatedSpec) {
      this.currentTarget = null;
      return;
    }

    this.currentTarget = this._findBestTarget(camera);
  }

  _dispatch() {
    if (this.seatedSpec) {
      this._stand();
      return;
    }
    const target = this.currentTarget;
    if (!target) return;
    if (target.verb === 'sit') this._sit(target);
    else if (target.verb === 'order') this._order();
  }

  _sit(spec) {
    if (!spec.seated) return;
    this.controls.setSeated(spec.seated);
    if (spec.acoustic) {
      this.audio.acousticBias = { ...spec.acoustic };
    }
    this.seatedSpec = spec;
  }

  _stand() {
    this.controls.standUp();
    this.audio.acousticBias = { cutoff: 1, volume: 1 };
    this.seatedSpec = null;
  }

  _order() {
    if (typeof this.audio?.playChime === 'function') this.audio.playChime();
    const drink = DRINK_NAMES[this.drinkCursor % DRINK_NAMES.length];
    this.drinkCursor += 1;
    if (typeof this.uiManager?.showFloatingPrompt === 'function') {
      this.uiManager.showFloatingPrompt(drink, 2200);
    }
    if (typeof this.npcManager?.triggerBartenderFlourish === 'function') {
      this.npcManager.triggerBartenderFlourish();
    }
  }

  _findBestTarget(camera) {
    if (this.interactables.length === 0) return null;
    camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    const flen = Math.hypot(this._forward.x, this._forward.z);
    if (flen < 1e-4) return null;
    const fx = this._forward.x / flen;
    const fz = this._forward.z / flen;

    const px = camera.position.x;
    const pz = camera.position.z;

    let best = null;
    let bestScore = -Infinity;

    for (const spec of this.interactables) {
      const dx = spec.position.x - px;
      const dz = spec.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > spec.range) continue;
      if (dist < 1e-4) {
        if (bestScore < 1) {
          best = spec;
          bestScore = 1;
        }
        continue;
      }
      const dot = (dx * fx + dz * fz) / dist;
      const halfFov = Math.cos(spec.fov ?? DEFAULT_FOV);
      if (dot < halfFov) continue;
      // Prefer alignment, then proximity. Combine into one score in [0, 2].
      const score = dot + (spec.range - dist) / spec.range;
      if (score > bestScore) {
        best = spec;
        bestScore = score;
      }
    }

    return best;
  }

  dispose() {
    this.clear();
    this.seatedSpec = null;
  }
}

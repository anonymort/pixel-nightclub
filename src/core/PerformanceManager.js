export class PerformanceManager {
  constructor(renderer, scene, { devicePixelRatio = 1, enabled = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.devicePixelRatio = devicePixelRatio;
    this.enabled = enabled;
    this.qualityTier = 'high';
    this.frameSamples = [];
    this.updateSamples = new Map();
    this.frameStart = 0;
  }

  applyQualityTier(tier) {
    this.qualityTier = tier;
    if (!this.renderer || typeof this.renderer.setPixelRatio !== 'function') return;
    const ratio = tier === 'low' ? Math.min(1, this.devicePixelRatio) : this.devicePixelRatio;
    this.renderer.setPixelRatio(ratio);
  }

  beginFrame(_deltaTime) {
    if (!this.enabled) return;
    this.frameStart = performance.now();
  }

  recordUpdate(label, durationMs) {
    if (!this.enabled || !label) return;
    const samples = this.updateSamples.get(label) || [];
    samples.push(durationMs);
    if (samples.length > 120) samples.shift();
    this.updateSamples.set(label, samples);
  }

  endFrame() {
    if (!this.enabled) return;
    const elapsed = performance.now() - this.frameStart;
    this.frameSamples.push(elapsed);
    if (this.frameSamples.length > 120) this.frameSamples.shift();
  }

  dispose() {
    this.frameSamples = [];
    this.updateSamples.clear();
  }
}

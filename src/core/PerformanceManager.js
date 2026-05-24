export class PerformanceManager {
  constructor(
    renderer,
    scene,
    {
      devicePixelRatio = 1,
      enabled = false,
      adaptiveQuality = true,
      sampleSize = 90,
      minTierDurationMs = 2500,
    } = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.devicePixelRatio = Math.max(1, Math.min(devicePixelRatio || 1, 2));
    this.enabled = enabled;
    this.adaptiveQuality = adaptiveQuality;
    this.sampleSize = sampleSize;
    this.minTierDurationMs = minTierDurationMs;
    this.qualityTier = 'high';
    this.frameSamples = [];
    this.updateSamples = new Map();
    this.frameStart = 0;
    this.lastTierChangeAt = 0;
    this._lastMetrics = {
      fps: 0,
      frameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      activeMeshes: 0,
      activeLights: 0,
      qualityTier: this.qualityTier,
    };
  }

  applyQualityTier(tier) {
    this.qualityTier = tier;
    if (!this.renderer || typeof this.renderer.setPixelRatio !== 'function') return;
    const ratio =
      tier === 'low'
        ? 1
        : tier === 'medium'
          ? Math.min(1.35, this.devicePixelRatio)
          : this.devicePixelRatio;
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
    if (samples.length > this.sampleSize) samples.shift();
    this.updateSamples.set(label, samples);
  }

  endFrame() {
    if (!this.enabled) return;
    const elapsed = performance.now() - this.frameStart;
    this.frameSamples.push(elapsed);
    if (this.frameSamples.length > this.sampleSize) this.frameSamples.shift();
    this._lastMetrics = this._collectMetrics();
    this._updateAdaptiveQuality();
  }

  getMetrics() {
    if (!this.enabled) {
      return this._collectMetrics();
    }
    return { ...this._lastMetrics, qualityTier: this.qualityTier };
  }

  getUpdateMetrics() {
    const metrics = {};
    for (const [label, samples] of this.updateSamples.entries()) {
      metrics[label] = average(samples);
    }
    return metrics;
  }

  _collectMetrics() {
    const frameTimeMs = average(this.frameSamples);
    let activeMeshes = 0;
    let activeLights = 0;

    if (this.scene && typeof this.scene.traverse === 'function') {
      this.scene.traverse((object) => {
        if (!object.visible) return;
        if (object.isMesh || object.isInstancedMesh) activeMeshes += 1;
        if (object.isLight) activeLights += 1;
      });
    }

    return {
      fps: frameTimeMs > 0 ? 1000 / frameTimeMs : 0,
      frameTimeMs,
      drawCalls: this.renderer?.info?.render?.calls ?? 0,
      triangles: this.renderer?.info?.render?.triangles ?? 0,
      activeMeshes,
      activeLights,
      qualityTier: this.qualityTier,
    };
  }

  _updateAdaptiveQuality() {
    if (!this.adaptiveQuality || this.frameSamples.length < this.sampleSize) return;

    const now = performance.now();
    if (now - this.lastTierChangeAt < this.minTierDurationMs) return;

    const frameTimeMs = this._lastMetrics.frameTimeMs;
    if (frameTimeMs > 24 && this.qualityTier !== 'low') {
      this.applyQualityTier(this.qualityTier === 'high' ? 'medium' : 'low');
      this.lastTierChangeAt = now;
    } else if (frameTimeMs < 17 && this.qualityTier !== 'high') {
      this.applyQualityTier(this.qualityTier === 'low' ? 'medium' : 'high');
      this.lastTierChangeAt = now;
    }
  }

  dispose() {
    this.frameSamples = [];
    this.updateSamples.clear();
  }
}

function average(samples) {
  if (!samples?.length) return 0;
  let total = 0;
  for (let i = 0; i < samples.length; i++) total += samples[i];
  return total / samples.length;
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceManager } from './PerformanceManager.js';

function createRenderer() {
  return {
    setPixelRatio: vi.fn(),
    info: {
      render: {
        calls: 42,
        triangles: 12000,
      },
    },
  };
}

function createScene() {
  const objects = [
    { visible: true, isMesh: true },
    { visible: true, isInstancedMesh: true },
    { visible: false, isMesh: true },
    { visible: true, isLight: true },
  ];
  return {
    traverse(callback) {
      objects.forEach(callback);
    },
  };
}

describe('PerformanceManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports render and scene metrics for perf smoke checks', () => {
    const manager = new PerformanceManager(createRenderer(), createScene(), {
      enabled: true,
      sampleSize: 2,
    });
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(20);

    manager.beginFrame();
    manager.endFrame();

    expect(manager.getMetrics()).toMatchObject({
      fps: 50,
      frameTimeMs: 20,
      drawCalls: 42,
      triangles: 12000,
      activeMeshes: 2,
      activeLights: 1,
      qualityTier: 'high',
    });
  });

  it('steps quality down when sampled frames are consistently slow', () => {
    const renderer = createRenderer();
    const manager = new PerformanceManager(renderer, createScene(), {
      enabled: true,
      devicePixelRatio: 2,
      sampleSize: 2,
      minTierDurationMs: 0,
    });
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce(31)
      .mockReturnValueOnce(61)
      .mockReturnValueOnce(61);

    manager.beginFrame();
    manager.endFrame();
    manager.beginFrame();
    manager.endFrame();

    expect(manager.qualityTier).toBe('medium');
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.35);
  });
});

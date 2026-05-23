import { describe, expect, it, vi } from 'vitest';
import { createAppController } from './AppController.js';

function createFakeSceneManager() {
  return {
    scene: { id: 'scene' },
    camera: { position: { x: -13, z: 0 } },
    renderer: { domElement: { id: 'canvas' } },
    updatables: [],
    addUpdatable(object) {
      this.updatables.push(object);
    },
    removeUpdatable(object) {
      this.updatables = this.updatables.filter((item) => item !== object);
    },
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('createAppController', () => {
  it('builds systems, registers updatables, exposes debug globals, and disposes cleanly', () => {
    const animationCallbacks = [];
    const disposables = [];
    const sceneManager = createFakeSceneManager();
    const audioManager = {
      setPlayerPosition: vi.fn(),
      dispose: vi.fn(),
    };
    const controlsManager = { update: vi.fn(), dispose: vi.fn() };
    const mapBuilder = {
      tileMaterials: ['tile'],
      build: vi.fn(),
    };
    const lightingManager = { update: vi.fn(), dispose: vi.fn() };
    const chandelier = { update: vi.fn(), dispose: vi.fn() };
    const npcManager = { update: vi.fn() };
    const uiManager = { update: vi.fn(), dispose: vi.fn() };

    disposables.push(
      sceneManager,
      audioManager,
      controlsManager,
      lightingManager,
      chandelier,
      uiManager
    );

    const globals = {};
    const controller = createAppController({
      exposeDebugGlobals: true,
      globalTarget: globals,
      requestAnimationFrame: (callback) => {
        animationCallbacks.push(callback);
        return 42;
      },
      cancelAnimationFrame: vi.fn(),
      now: vi.fn(() => 1000),
      createSceneManager: () => sceneManager,
      createAudioManager: () => audioManager,
      createControlsManager: () => controlsManager,
      createMapBuilder: () => mapBuilder,
      createLightingManager: () => lightingManager,
      createChandelier: () => chandelier,
      createNPCManager: () => npcManager,
      createUIManager: () => uiManager,
    });

    expect(mapBuilder.build).toHaveBeenCalledTimes(1);
    expect(sceneManager.updatables).toEqual([
      controlsManager,
      lightingManager,
      chandelier,
      npcManager,
      uiManager,
      expect.objectContaining({ update: expect.any(Function) }),
    ]);
    expect(globals.sceneManager).toBe(sceneManager);
    expect(globals.audioManager).toBe(audioManager);
    expect(globals.controlsManager).toBe(controlsManager);

    controller.start();
    expect(animationCallbacks).toHaveLength(1);

    animationCallbacks[0](1100);
    expect(sceneManager.update).toHaveBeenCalledWith(0.1);
    expect(animationCallbacks).toHaveLength(2);

    const coordinateObserver = sceneManager.updatables.at(-1);
    coordinateObserver.update();
    expect(audioManager.setPlayerPosition).toHaveBeenCalledWith(-13, 0);

    controller.dispose();
    for (const disposable of disposables) {
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    }
    expect(controller.cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});

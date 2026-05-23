import { APP_BRAND } from '../config/experience.js';

export function createAppController(options) {
  const {
    createSceneManager,
    createAudioManager,
    createControlsManager,
    createMapBuilder,
    createLightingManager,
    createChandelier,
    createNPCManager,
    createUIManager,
    requestAnimationFrame,
    cancelAnimationFrame,
    now,
    exposeDebugGlobals = false,
    globalTarget,
  } = options;

  const sceneManager = createSceneManager();
  const audioManager = createAudioManager();
  const controlsManager = createControlsManager(
    sceneManager.camera,
    sceneManager.renderer.domElement
  );

  const mapBuilder = createMapBuilder(sceneManager.scene, controlsManager);
  mapBuilder.build();

  const lightingManager = createLightingManager(
    sceneManager.scene,
    audioManager,
    mapBuilder.tileMaterials
  );
  const chandelier = createChandelier(sceneManager.scene, audioManager);
  const npcManager = createNPCManager(
    sceneManager.scene,
    audioManager,
    controlsManager.contactLayer
  );
  const uiManager = createUIManager(audioManager, controlsManager);

  if (exposeDebugGlobals && globalTarget) {
    globalTarget.sceneManager = sceneManager;
    globalTarget.audioManager = audioManager;
    globalTarget.controlsManager = controlsManager;
  }

  sceneManager.addUpdatable(controlsManager);
  sceneManager.addUpdatable(lightingManager);
  sceneManager.addUpdatable(chandelier);
  sceneManager.addUpdatable(npcManager);
  sceneManager.addUpdatable(uiManager);

  const coordinateObserverNode = {
    update: () => {
      const pos = sceneManager.camera.position;
      audioManager.setPlayerPosition(pos.x, pos.z);
    },
  };
  sceneManager.addUpdatable(coordinateObserverNode);

  let lastTime = now();
  let frameId = null;
  let isRunning = false;

  function animate(currentTime) {
    if (!isRunning) return;

    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    sceneManager.update(Math.min(0.1, dt));
    frameId = requestAnimationFrame(animate);
  }

  function disposeObject(object) {
    if (object && typeof object.dispose === 'function') {
      object.dispose();
    }
  }

  return {
    sceneManager,
    audioManager,
    controlsManager,
    mapBuilder,
    lightingManager,
    chandelier,
    npcManager,
    uiManager,
    get cancelAnimationFrame() {
      return cancelAnimationFrame;
    },
    start() {
      if (isRunning) return;
      isRunning = true;
      lastTime = now();
      frameId = requestAnimationFrame(animate);
      if (globalTarget?.console) {
        globalTarget.console.log(APP_BRAND.consoleReadyMessage);
      }
    },
    dispose() {
      isRunning = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      disposeObject(uiManager);
      disposeObject(npcManager);
      disposeObject(chandelier);
      disposeObject(lightingManager);
      disposeObject(mapBuilder);
      disposeObject(controlsManager);
      disposeObject(audioManager);
      disposeObject(sceneManager);
    },
  };
}

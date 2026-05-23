import { APP_BRAND } from '../config/experience.js';
import { wireInteractables } from '../interaction/wireInteractables.js';

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
    createInteractionManager,
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
  const interactionManager = createInteractionManager
    ? createInteractionManager(controlsManager, audioManager, npcManager)
    : null;
  const uiManager = createUIManager(audioManager, controlsManager, interactionManager);
  if (interactionManager) {
    interactionManager.uiManager = uiManager;
    wireInteractables(interactionManager);
  }

  if (exposeDebugGlobals && globalTarget) {
    globalTarget.sceneManager = sceneManager;
    globalTarget.audioManager = audioManager;
    globalTarget.controlsManager = controlsManager;
    globalTarget.performanceManager = sceneManager.performanceManager;
    if (interactionManager) globalTarget.interactionManager = interactionManager;
  }

  sceneManager.addUpdatable(controlsManager);
  if (interactionManager) sceneManager.addUpdatable(interactionManager);
  sceneManager.addUpdatable(lightingManager);
  sceneManager.addUpdatable(chandelier);
  sceneManager.addUpdatable(npcManager);
  sceneManager.addUpdatable(uiManager);
  if (typeof mapBuilder.update === 'function') {
    sceneManager.addUpdatable(mapBuilder);
  }

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
    performanceManager: sceneManager.performanceManager,
    performance: sceneManager.performanceManager,
    lightingManager,
    chandelier,
    npcManager,
    uiManager,
    interactionManager,
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
      disposeObject(interactionManager);
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

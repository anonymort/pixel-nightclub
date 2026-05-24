import {
  APP_BRAND,
  SOUVENIR_SNAPSHOT_COPY,
  SOUVENIR_SNAPSHOT_SHOT,
} from '../config/experience.js';
import { wireInteractables } from '../interaction/wireInteractables.js';

function captureCanvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas?.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Snapshot capture failed.'));
      }, 'image/png');
      return;
    }

    if (typeof canvas?.toDataURL === 'function') {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (error) {
        reject(error);
      }
      return;
    }

    reject(new Error('Canvas export is unavailable.'));
  });
}

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
    interactionManager.onTakeSnapshot = () => controller.takeSouvenirSnapshot();
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
  const controller = {
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
    async takeSouvenirSnapshot() {
      const camera = sceneManager.camera;
      const previousPose = {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
      };
      const restorePointerLock = Boolean(controlsManager?.isLocked);

      if (restorePointerLock) {
        document.exitPointerLock?.();
      }
      controlsManager?.velocity?.set?.(0, 0, 0);

      camera.position.set(
        SOUVENIR_SNAPSHOT_SHOT.position.x,
        SOUVENIR_SNAPSHOT_SHOT.position.y,
        SOUVENIR_SNAPSHOT_SHOT.position.z
      );
      camera.lookAt(
        SOUVENIR_SNAPSHOT_SHOT.target.x,
        SOUVENIR_SNAPSHOT_SHOT.target.y,
        SOUVENIR_SNAPSHOT_SHOT.target.z
      );
      sceneManager.renderFrame(0.016);

      const blob = await captureCanvasBlob(sceneManager.renderer.domElement);

      camera.position.set(
        previousPose.position.x,
        previousPose.position.y,
        previousPose.position.z
      );
      camera.rotation.x = previousPose.rotation.x;
      camera.rotation.y = previousPose.rotation.y;
      camera.rotation.z = previousPose.rotation.z;
      sceneManager.renderFrame(0.016);

      const payload = {
        blob,
        title: SOUVENIR_SNAPSHOT_COPY.title,
        fileName: SOUVENIR_SNAPSHOT_COPY.fileName,
        meta: SOUVENIR_SNAPSHOT_COPY.meta,
        restorePointerLock,
      };
      await uiManager.showSnapshotPreview?.(payload);
      return payload;
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
  return controller;
}

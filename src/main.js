let app = null;

function afterFirstPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function bootstrap() {
  await afterFirstPaint();

  const [
    { createAppController },
    { SceneManager },
    { ControlsManager },
    { AudioManager },
    { MapBuilder },
    { LightingManager },
    { Chandelier },
    { NPCManager },
    { UIManager },
    { InteractionManager },
  ] = await Promise.all([
    import('./core/AppController.js'),
    import('./core/SceneManager.js'),
    import('./core/ControlsManager.js'),
    import('./core/AudioManager.js'),
    import('./world/MapBuilder.js'),
    import('./world/LightingManager.js'),
    import('./world/Chandelier.js'),
    import('./entities/NPCManager.js'),
    import('./ui/UIManager.js'),
    import('./interaction/InteractionManager.js'),
  ]);

  app = createAppController({
    exposeDebugGlobals: true,
    globalTarget: window,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    now: () => performance.now(),
    createSceneManager: () => new SceneManager('app'),
    createAudioManager: () => new AudioManager(),
    createControlsManager: (camera, domElement) => new ControlsManager(camera, domElement),
    createMapBuilder: (scene, controls) => new MapBuilder(scene, controls),
    createLightingManager: (scene, audio, tileMaterials) =>
      new LightingManager(scene, audio, tileMaterials),
    createChandelier: (scene, audio) => new Chandelier(scene, audio),
    createNPCManager: (scene, audio, contactLayer) => new NPCManager(scene, audio, contactLayer),
    createUIManager: (audio, controls, interactionManager) =>
      new UIManager(audio, controls, interactionManager),
    createInteractionManager: (controls, audio, npcManager) =>
      new InteractionManager(controls, audio, npcManager, null),
  });

  window.hearthsideApp = app;
  app.start();
}

window.addEventListener(
  'beforeunload',
  () => {
    app?.dispose();
  },
  { once: true }
);

bootstrap().catch((error) => {
  console.error('Failed to start Hearthside Lounge', error);
});

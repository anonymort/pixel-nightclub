import { createAppController } from './core/AppController.js';
import { SceneManager } from './core/SceneManager.js';
import { ControlsManager } from './core/ControlsManager.js';
import { AudioManager } from './core/AudioManager.js';
import { MapBuilder } from './world/MapBuilder.js';
import { LightingManager } from './world/LightingManager.js';
import { Chandelier } from './world/Chandelier.js';
import { NPCManager } from './entities/NPCManager.js';
import { UIManager } from './ui/UIManager.js';

const app = createAppController({
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
  createUIManager: (audio, controls) => new UIManager(audio, controls),
});

window.hearthsideApp = app;
window.addEventListener('beforeunload', () => app.dispose(), { once: true });

app.start();

import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { ControlsManager } from './core/ControlsManager.js';
import { AudioManager } from './core/AudioManager.js';
import { MapBuilder } from './world/MapBuilder.js';
import { LightingManager } from './world/LightingManager.js';
import { DiscoBall } from './world/DiscoBall.js';
import { NPCManager } from './entities/NPCManager.js';
import { UIManager } from './ui/UIManager.js';

// 1. Instantiate Core Subsystems
const sceneManager = new SceneManager('app');
const audioManager = new AudioManager();
const controlsManager = new ControlsManager(sceneManager.camera, sceneManager.renderer.domElement);

// Expose core systems globally to allow automated browser testing and camera manipulation
window.sceneManager = sceneManager;
window.audioManager = audioManager;
window.controlsManager = controlsManager;

// 2. Build Procedural Map Environment and Load Collision Meshes
const mapBuilder = new MapBuilder(sceneManager.scene, controlsManager);
mapBuilder.build();

// 3. Instantiate Visual and Actor Systems
const lightingManager = new LightingManager(sceneManager.scene, audioManager, mapBuilder.tileMaterials);
const discoBall = new DiscoBall(sceneManager.scene, audioManager);
const npcManager = new NPCManager(sceneManager.scene, audioManager);
const uiManager = new UIManager(audioManager, controlsManager);

// 4. Register Active Components into central tick loop
sceneManager.addUpdatable(controlsManager);  // Moves camera with collision physics
sceneManager.addUpdatable(lightingManager);  // Sweeps spotlights, pulses dance grid
sceneManager.addUpdatable(discoBall);        // Spins disco ball, orbits reflection sparks
sceneManager.addUpdatable(npcManager);        // Dances voxel NPCs to beat
sceneManager.addUpdatable(uiManager);          // Updates HUD dashboard, visualizer card

// 5. Connect Real-time Player Coordinates to Audio Occlusion filters
const coordinateObserverNode = {
  update: () => {
    const pos = sceneManager.camera.position;
    // Feed coordinates to audio engine to check bounding-box acoustic profiles
    audioManager.setPlayerPosition(pos.x, pos.z);
  }
};
sceneManager.addUpdatable(coordinateObserverNode);

// 6. Animation Frame Dispatcher with highly robust performance.now() delta-time tracking
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const dt = (currentTime - lastTime) / 1000; // convert milliseconds to seconds
  lastTime = currentTime;

  // Cap deltaTime at 100ms to avoid huge physics displacement jumps when tab is blurred/inactive
  const cappedDt = Math.min(0.1, dt);

  sceneManager.update(cappedDt);
}

// Spark up the cyberclub!
animate();

console.log('⚡ Cyber Club initialization complete. Sector 04 online.');

import * as THREE from 'three';
import { PerformanceManager } from './PerformanceManager.js';

function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value && typeof value.dispose === 'function') {
      value.dispose();
    }
  }
  if (typeof material.dispose === 'function') {
    material.dispose();
  }
}

export function disposeObjectTree(root) {
  if (!root || typeof root.traverse !== 'function') return;

  root.traverse((object) => {
    if (object.geometry && typeof object.geometry.dispose === 'function') {
      object.geometry.dispose();
    }

    if (Array.isArray(object.material)) {
      object.material.forEach(disposeMaterial);
    } else if (object.material) {
      disposeMaterial(object.material);
    }
  });

  if (typeof root.clear === 'function') {
    root.clear();
  }
}

export function removeRendererCanvas(renderer) {
  const canvas = renderer?.domElement;
  if (canvas?.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
}

export class SceneManager {
  constructor(containerId = 'app') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`SceneManager: Container element with id '${containerId}' not found.`);
    }

    this.updatables = []; // List of objects requiring frame-by-frame updates
    this._targetFogColor = new THREE.Color();

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initAtmosphere();
    this._initResizeHandler();
  }

  /**
   * Initializes the core Three.js scene container.
   */
  _initScene() {
    this.scene = new THREE.Scene();
  }

  /**
   * Initializes the Perspective Camera for immersive 3D navigation.
   */
  _initCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    // FOV 65 represents a natural human field of vision in indoor first-person play
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 150);

    // Default camera position outside in the exterior queue
    this.camera.position.set(-13, 1.7, 0); // 1.7m matches standard eye-level height
  }

  /**
   * Initializes the WebGLRenderer with optimal settings for the pixel-art lounge.
   */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance

    // Enable shadow mapping for dramatic depth underneath spotlights
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Tone mapping and color space setup
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Append the canvas to the DOM
    this.container.appendChild(this.renderer.domElement);

    const search = window.location?.search || '';
    this.performanceManager = new PerformanceManager(this.renderer, this.scene, {
      devicePixelRatio: window.devicePixelRatio || 1,
      enabled: search.includes('perf=1'),
    });
    this.performanceManager.applyQualityTier('high');
  }

  /**
   * Loads deep, atmospheric fog matching the lounge's warm interior color space.
   */
  _initAtmosphere() {
    const fogColor = 0x0a0807; // Cozy dim warm charcoal base
    this.scene.background = new THREE.Color(fogColor);

    // Exponential fog: slightly dense, catching candle and fire glow
    this.scene.fog = new THREE.FogExp2(fogColor, 0.028);

    // Spawn blocky voxel clouds catching the setting sunset sun
    this._initVoxelClouds();
  }

  /**
   * Spawns multiple procedurally compiled blocky cloud clusters high in the sky.
   */
  _initVoxelClouds() {
    this.clouds = [];

    // Shared semi-emissive sunset cloud material (soft peach-gold sunset clouds)
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x8a5241, // Soft peach-terracotta base
      emissive: 0xffaa44, // Warm golden-orange highlights
      emissiveIntensity: 0.55,
      roughness: 0.9,
      metalness: 0.1,
    });

    const numClouds = 8;
    for (let i = 0; i < numClouds; i++) {
      const cloudGroup = new THREE.Group();

      // Build compound blocky cloud geometries
      // Center base block
      const mainGeo = new THREE.BoxGeometry(
        3.0 + Math.random() * 2.0,
        0.8 + Math.random() * 0.4,
        1.5 + Math.random() * 1.5
      );
      const mainMesh = new THREE.Mesh(mainGeo, cloudMat);
      cloudGroup.add(mainMesh);

      // Left offset block
      if (Math.random() > 0.2) {
        const sideGeo1 = new THREE.BoxGeometry(
          1.5 + Math.random() * 1.0,
          0.6 + Math.random() * 0.3,
          1.0 + Math.random() * 1.0
        );
        const sideMesh1 = new THREE.Mesh(sideGeo1, cloudMat);
        sideMesh1.position.set(-1.2 - Math.random() * 0.5, -0.1, 0.2);
        cloudGroup.add(sideMesh1);
      }

      // Right offset block
      if (Math.random() > 0.2) {
        const sideGeo2 = new THREE.BoxGeometry(
          1.5 + Math.random() * 1.0,
          0.6 + Math.random() * 0.3,
          1.0 + Math.random() * 1.0
        );
        const sideMesh2 = new THREE.Mesh(sideGeo2, cloudMat);
        sideMesh2.position.set(1.2 + Math.random() * 0.5, 0.1, -0.2);
        cloudGroup.add(sideMesh2);
      }

      // Top offset block
      if (Math.random() > 0.3) {
        const topGeo = new THREE.BoxGeometry(
          1.2 + Math.random() * 0.8,
          0.5 + Math.random() * 0.2,
          1.0 + Math.random() * 0.5
        );
        const topMesh = new THREE.Mesh(topGeo, cloudMat);
        topMesh.position.set(0, 0.5, 0);
        cloudGroup.add(topMesh);
      }

      // Random position high up in the sky
      const cx = -35.0 + Math.random() * 45.0;
      const cy = 8.5 + Math.random() * 4.5;
      const cz = -25.0 + Math.random() * 50.0;
      cloudGroup.position.set(cx, cy, cz);

      // Store a custom speed for drifting
      cloudGroup.userData = {
        speed: 0.15 + Math.random() * 0.25, // meters per second
      };

      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }

  /**
   * Installs window resize observers to adapt to screen layout updates smoothly.
   */
  _initResizeHandler() {
    this._onResize = () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;

      // Update Camera Aspect
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // Update WebGL Renderer Size
      this.renderer.setSize(width, height);
    };

    window.addEventListener('resize', this._onResize);
  }

  /**
   * Registers a script/entity class into the update loop.
   */
  addUpdatable(object) {
    if (object && typeof object.update === 'function') {
      this.updatables.push(object);
    }
  }

  /**
   * Removes a script/entity class from the update loop.
   */
  removeUpdatable(object) {
    this.updatables = this.updatables.filter((item) => item !== object);
  }

  dispose() {
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    disposeObjectTree(this.scene);
    this.performanceManager?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      removeRendererCanvas(this.renderer);
    }
  }

  renderFrame(deltaTime = 0.016) {
    this._updateDynamicAtmosphere(deltaTime);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders a single frame of the 3D scene, runs registered updatables, and manages dynamic sky/fog transitions.
   * @param {number} deltaTime - Time elapsed since the last frame (in seconds).
   */
  update(deltaTime) {
    this.performanceManager?.beginFrame(deltaTime);

    // Run updates on all active system components (controls, light rigs, NPCs, passing camera position)
    if (this.performanceManager?.enabled) {
      for (let i = 0; i < this.updatables.length; i++) {
        const updatable = this.updatables[i];
        const startedAt = performance.now();
        updatable.update(deltaTime, this.camera.position);
        this.performanceManager.recordUpdate(
          updatable.performanceLabel || updatable.constructor?.name || `updatable-${i}`,
          performance.now() - startedAt
        );
      }
    } else {
      for (let i = 0; i < this.updatables.length; i++) {
        this.updatables[i].update(deltaTime, this.camera.position);
      }
    }

    // Update drifting sunset clouds
    if (this.clouds) {
      for (let i = 0; i < this.clouds.length; i++) {
        const cloud = this.clouds[i];
        cloud.position.z += cloud.userData.speed * deltaTime;

        // Wrap around Z-axis when cloud drifts past boundary z = 28
        if (cloud.position.z > 28.0) {
          cloud.position.z = -28.0;
          cloud.position.x = -35.0 + Math.random() * 45.0;
          cloud.position.y = 8.5 + Math.random() * 4.5;
        }
      }
    }

    // Render WebGL Viewport
    this.renderFrame(deltaTime);
    this.performanceManager?.endFrame();
  }

  /**
   * Smoothly interpolates fog colors and densities depending on player camera coordinates.
   */
  _updateDynamicAtmosphere(dt) {
    if (!this.camera || !this.scene.fog) return;

    const x = this.camera.position.x;
    const targetColor = this._targetFogColor.setHex(0x0a0807); // Default deep interior background/fog
    let targetDensity = 0.028;

    if (x < -4.8) {
      // Exterior: Gorgeous golden-hour copper-orange sunset
      targetColor.setHex(0x4c2b1a);
      targetDensity = 0.014; // Clearer outside to enjoy the long shadows and sunset
    } else if (x < 1.0) {
      // Lobby Gateway / Coatroom transition zone (soft warm timber/copper glow)
      targetColor.setHex(0x16100d);
      targetDensity = 0.024;
    } else {
      // Deep lounge interior (acoustic floor, bar, fireplace)
      targetColor.setHex(0x0a0807);
      targetDensity = 0.024;
    }

    // Smoothly lerp background color
    this.scene.background.lerp(targetColor, 3.5 * dt);

    // Smoothly lerp fog color and density
    this.scene.fog.color.lerp(targetColor, 3.5 * dt);
    this.scene.fog.density += (targetDensity - this.scene.fog.density) * 3.5 * dt;
  }
}

import * as THREE from 'three';

export class LightingManager {
  /**
   * @param {THREE.Scene} scene - Hearthside scene
   * @param {AudioManager} audio - To read beat sync states
   * @param {Array} tileMaterials - Shared tile materials from MapBuilder
   */
  constructor(scene, audio, tileMaterials) {
    this.scene = scene;
    this.audio = audio;
    this.tileMaterials = tileMaterials;

    this.spotlights = [];
    this.signLetterMaterial = null;
    this.flickerTimer = 0;
    this.fireTimer = 0;
    this.lanternFlickerTimer = 0;

    this._initEnvironmentLights();
    this._initHallSpotlights();
    this._initExteriorLighting();
    this._initEntrySign();
  }

  /**
   * Loads general ambient base and warm localized bar/lounge ambient zones.
   */
  _initEnvironmentLights() {
    // 1. Ambient base (soft warm amber candle/wood tone to lift shadows slightly)
    const ambientLight = new THREE.AmbientLight(0x2d1f18, 0.82);
    this.scene.add(ambientLight);

    // 2. Dual-Tone Hemisphere Light (creates beautiful, natural sunset sky/timber reflections)
    // Top-down color: warm copper sky; Bottom-up color: soft timber brown (boosted to shine up onto rafters)
    const hemiLight = new THREE.HemisphereLight(0x5c3b24, 0x4a321f, 1.02);
    this.scene.add(hemiLight);

    // 3. Bar Backlight (Warm glowing golden honey - optimized falloff and range)
    const barLight = new THREE.PointLight(0xffaa3a, 3.8, 17.0, 1.0);
    barLight.position.set(9.0, 2.2, 9.8);
    this.scene.add(barLight);

    // 4. Lobby Gateway Light (Warm amber entry portal light welcoming players from the street)
    const lobbyLight = new THREE.PointLight(0xffb03a, 2.8, 13.0, 1.0);
    lobbyLight.position.set(-1.9, 3.2, 0);
    this.scene.add(lobbyLight);

    // 5. Fireplace flickering flame light (warm yellow-orange point light centered in cozy fireplace)
    this.fireplaceLight = new THREE.PointLight(0xff5500, 3.5, 15.0, 1.0);
    this.fireplaceLight.position.set(13.0, 1.2, -19.8);
    this.scene.add(this.fireplaceLight);

    // 5b. Fireplace Lounge soft fill light (non-shadow-casting to lift brick chimney left-side silhouette)
    this.fireplaceFillLight = new THREE.PointLight(0xcc6622, 1.55, 17.0, 1.0);
    this.fireplaceFillLight.position.set(10.0, 2.0, -17.0);
    this.scene.add(this.fireplaceFillLight);

    // 5c. Acoustic hall ceiling soft fill light (non-shadow-casting to illuminate rafters and timber beams)
    this.hallCeilingFill = new THREE.PointLight(0xcc7733, 2.4, 18.0, 1.0);
    this.hallCeilingFill.position.set(10.5, 4.4, -1.0);
    this.scene.add(this.hallCeilingFill);

    // 5d. Acoustic Hall low fill, intentionally non-shadow-casting to preserve performance.
    this.acousticHallFill = new THREE.PointLight(0xb86a32, 1.35, 18.0, 1.0);
    this.acousticHallFill.position.set(8.0, 2.4, 1.5);
    this.scene.add(this.acousticHallFill);

    // ==========================================
    // NEW LIGHT SOURCES FOR DARKEST ROOMS
    // ==========================================

    // 6. Cloakroom Hanging Lantern 1 (directly below Lantern 1 at x = -1.6, z = 6.0)
    this.cloakLanternLight1 = new THREE.PointLight(0xffaa3a, 4.5, 12.0, 1.0);
    this.cloakLanternLight1.position.set(-1.6, 3.9, 6.0);
    this.scene.add(this.cloakLanternLight1);

    // 7. Cloakroom Hanging Lantern 2 (directly below Lantern 2 at x = -4.2, z = 6.0)
    this.cloakLanternLight2 = new THREE.PointLight(0xffaa3a, 4.5, 12.0, 1.0);
    this.cloakLanternLight2.position.set(-4.2, 3.9, 6.0);
    this.scene.add(this.cloakLanternLight2);

    // 8. Lounge Wall Sconce Candle Light 1 (at x = 10.5, z = -20.6)
    this.sconceLight1 = new THREE.PointLight(0xffaa3a, 2.2, 10.0, 1.0);
    this.sconceLight1.position.set(10.5, 2.45, -20.6);
    this.scene.add(this.sconceLight1);

    // 9. Lounge Wall Sconce Candle Light 2 (at x = 15.5, z = -20.6)
    this.sconceLight2 = new THREE.PointLight(0xffaa3a, 2.2, 10.0, 1.0);
    this.sconceLight2.position.set(15.5, 2.45, -20.6);
    this.scene.add(this.sconceLight2);
  }

  /**
   * Spawns ceiling mounted spotlights that rotate and sweep volumetric cones (Rebranded as Warm Rafter Cones).
   */
  _initHallSpotlights() {
    // 4 Spotlights configured with elegant warm rafter tones
    const spotlightConfigs = [
      { color: 0xffd480, x: 5.0, z: -4.0, rotOffset: 0.0 }, // Soft Gold
      { color: 0xfff5e6, x: 12.0, z: -4.0, rotOffset: Math.PI / 2 }, // Warm White
      { color: 0xffb399, x: 5.0, z: 4.0, rotOffset: Math.PI }, // Champagne-Rose
      { color: 0xffa64d, x: 12.0, z: 4.0, rotOffset: Math.PI * 1.5 }, // Elegant Amber
    ];

    const ceilingY = 4.8;

    spotlightConfigs.forEach((config) => {
      // 1. Actual SpotLight source
      const spot = new THREE.SpotLight(config.color, 12, 14, Math.PI / 4, 0.6, 1.2);
      spot.position.set(config.x, ceilingY, config.z);

      spot.castShadow = config.x === 5.0 && config.z === -4.0;
      spot.shadow.mapSize.width = 512;
      spot.shadow.mapSize.height = 512;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 10;
      spot.shadow.bias = -0.001;

      // Create lightweight dummy target Object3D to animate target point
      const targetObj = new THREE.Object3D();
      targetObj.position.set(config.x, 0, config.z);
      this.scene.add(targetObj);
      spot.target = targetObj;

      this.scene.add(spot);

      // 2. Beautiful Additive Volumetric Light Beam
      const beamLength = 4.8;
      const beamGeo = new THREE.CylinderGeometry(0.05, 1.4, beamLength, 12, 1, true);
      beamGeo.translate(0, -beamLength / 2, 0);

      const beamMat = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.1, // slightly softer and subtler for natural realism
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(config.x, ceilingY, config.z);

      this.scene.add(beamMesh);

      // Keep tracking information to rotate in the loop
      this.spotlights.push({
        light: spot,
        beam: beamMesh,
        target: targetObj,
        baseX: config.x,
        baseZ: config.z,
        rotOffset: config.rotOffset,
        speed: 0.5 + Math.random() * 0.3, // slowed down sweeps for peaceful ambience
        radius: 1.8, // smaller, cozier sweep radius
      });
    });
  }

  /**
   * Exterior gas streetlight hanging above the trellis bouncer podium.
   */
  _initExteriorLighting() {
    // 1. Warm amber gas streetlight hanging above doorman podium
    const streetLight1 = new THREE.SpotLight(0xffaa22, 18, 13, Math.PI / 3, 0.5, 1.0);
    streetLight1.position.set(-6.5, 4.0, -3.5);
    streetLight1.target.position.set(-6.5, 0, -3.5);

    streetLight1.castShadow = true;
    streetLight1.shadow.mapSize.width = 512;
    streetLight1.shadow.mapSize.height = 512;

    this.scene.add(streetLight1);
    this.scene.add(streetLight1.target);

    // 2. Second warm amber gas streetlight illuminating the far exterior line
    const streetLight2 = new THREE.SpotLight(0xffaa22, 15, 14, Math.PI / 3, 0.5, 1.0);
    streetLight2.position.set(-14.5, 4.0, -3.5);
    streetLight2.target.position.set(-14.5, 0, -3.5);

    streetLight2.castShadow = true;
    streetLight2.shadow.mapSize.width = 512;
    streetLight2.shadow.mapSize.height = 512;

    this.scene.add(streetLight2);
    this.scene.add(streetLight2.target);

    // 3. Golden Hour Setting Sun (Low-angle warm Directional Light shining down the cobblestone sidewalk)
    const sunLight = new THREE.DirectionalLight(0xff6a22, 3.6); // Rich golden-orange sun
    sunLight.position.set(-25.0, 3.5, 2.0); // Low-angle sun in the far west/left
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;

    const d = 12;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunSunlightTop: sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;

    const sunTarget = new THREE.Object3D();
    sunTarget.position.set(-15.0, 0, 0);
    this.scene.add(sunTarget);
    sunLight.target = sunTarget;

    this.scene.add(sunLight);
  }

  /**
   * Creates the custom illuminated carved wooden sign "HEARTHSIDE".
   */
  _initEntrySign() {
    // 1. Carved wooden plaque backing with gold border
    const backingGeo = new THREE.BoxGeometry(0.06, 0.7, 2.6);
    const backingMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b, // Elegant oak wood plaque
      roughness: 0.85,
      metalness: 0.1,
    });
    const backingMesh = new THREE.Mesh(backingGeo, backingMat);
    backingMesh.position.set(-5.23, 3.8, 0);
    this.scene.add(backingMesh);

    const borderGeo = new THREE.BoxGeometry(0.08, 0.76, 2.72);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Polished brass frame border
      roughness: 0.2,
      metalness: 0.9,
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.set(-5.24, 3.8, 0);
    this.scene.add(borderMesh);

    // Polished premium brass letters spelling "HEARTHSIDE" (natural realism, non-emissive, reflecting overhead copper lantern light)
    this.signLetterMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Polished brass gold
      roughness: 0.15,
      metalness: 0.95,
    });

    // Make low-poly block letters out of boxes on the wooden plaque
    const letterConfigs = [
      // "H" (z: -1.1 to -0.98)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -1.06 },
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.94 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0, dz: -1.0 },
      // "E" (z: -0.85 to -0.73)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.83 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.155, dz: -0.77 },
      { h: 0.04, d: 0.08, dx: -0.04, dy: 0.0, dz: -0.79 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: -0.155, dz: -0.77 },
      // "A" (z: -0.66 to -0.54)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.62 },
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.5 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.155, dz: -0.56 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: -0.02, dz: -0.56 },
      // "R" (z: -0.42 to -0.3)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.38 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.155, dz: -0.32 },
      { h: 0.16, d: 0.04, dx: -0.04, dy: 0.08, dz: -0.26 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.0, dz: -0.32 },
      { h: 0.18, d: 0.04, dx: -0.04, dy: -0.09, dz: -0.28 },
      // "T" (z: -0.18 to -0.06)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: -0.12 },
      { h: 0.04, d: 0.18, dx: -0.04, dy: 0.155, dz: -0.12 },
      // "H" (z: 0.02 to 0.14)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: 0.02 },
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: 0.14 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0, dz: 0.08 },
      // "S" (z: 0.24 to 0.38)
      { h: 0.04, d: 0.14, dx: -0.04, dy: 0.155, dz: 0.31 },
      { h: 0.16, d: 0.04, dx: -0.04, dy: 0.08, dz: 0.24 },
      { h: 0.04, d: 0.14, dx: -0.04, dy: 0.0, dz: 0.31 },
      { h: 0.16, d: 0.04, dx: -0.04, dy: -0.08, dz: 0.38 },
      { h: 0.04, d: 0.14, dx: -0.04, dy: -0.155, dz: 0.31 },
      // "I" (z: 0.46 to 0.58)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: 0.52 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.155, dz: 0.52 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: -0.155, dz: 0.52 },
      // "D" (z: 0.66 to 0.78)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: 0.66 },
      { h: 0.04, d: 0.1, dx: -0.04, dy: 0.155, dz: 0.72 },
      { h: 0.04, d: 0.1, dx: -0.04, dy: -0.155, dz: 0.72 },
      { h: 0.28, d: 0.04, dx: -0.04, dy: 0, dz: 0.77 },
      // "E" (z: 0.86 to 1.0)
      { h: 0.35, d: 0.04, dx: -0.04, dy: 0, dz: 0.89 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: 0.155, dz: 0.95 },
      { h: 0.04, d: 0.08, dx: -0.04, dy: 0.0, dz: 0.93 },
      { h: 0.04, d: 0.12, dx: -0.04, dy: -0.155, dz: 0.95 },
    ];

    letterConfigs.forEach((cfg) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, cfg.h, cfg.d),
        this.signLetterMaterial
      );
      mesh.position.set(-5.24 + cfg.dx, 3.8 + (cfg.dy || 0), cfg.dz);
      if (cfg.rx) mesh.rotation.x = cfg.rx;
      this.scene.add(mesh);
    });

    // 2. Elegant overhead copper sconce gas-lantern
    const armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4); // Extended length to 0.5m
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.3,
      metalness: 0.8,
    }); // Copper
    const armMesh = new THREE.Mesh(armGeo, copperMat);
    // Arm sticking out over the sign, extending from inside the wall (at X = -5.12) to the lantern center (at X = -5.62)
    armMesh.position.set(-5.37, 4.3, 0);
    armMesh.rotation.z = Math.PI / 2;
    this.scene.add(armMesh);

    const lanternCapGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.06, 6);
    const lanternCapMesh = new THREE.Mesh(lanternCapGeo, copperMat);
    lanternCapMesh.position.set(-5.62, 4.15, 0);
    this.scene.add(lanternCapMesh);

    const bulbGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffaa3a,
      emissive: 0xffa53a,
      emissiveIntensity: 1.5,
    });
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.set(-5.62, 4.07, 0);
    this.scene.add(bulbMesh);

    // Warm-white/amber PointLight below the copper lantern illuminating the sign and street
    this.signLanternLight = new THREE.PointLight(0xffa53a, 3.5, 14);
    this.signLanternLight.position.set(-5.7, 4.0, 0.0);
    this.scene.add(this.signLanternLight);
  }

  /**
   * Sweeps spotlights, flickers wood lanterns/fireplace, and pulses floor tiles on beat.
   */
  update(dt) {
    const time = performance.now() * 0.001;
    const isBeat = this.audio.isBeatHit;

    // 1. Rotate Spotlights & Aim volumetric beams (slow, tranquil sweeps)
    const spotDecay = 1 - Math.exp(-6.32 * dt);
    this.spotlights.forEach((spot) => {
      const angle = time * spot.speed + spot.rotOffset;
      const targetX = spot.baseX + Math.cos(angle) * spot.radius;
      const targetZ = spot.baseZ + Math.sin(angle * 1.5) * spot.radius;

      // Update target point
      spot.target.position.set(targetX, 0, targetZ);

      // Update volumetric beam orientation
      const targetVec = new THREE.Vector3(targetX, 0, targetZ);
      const directionVec = new THREE.Vector3().subVectors(targetVec, spot.beam.position);
      directionVec.normalize();

      const defaultDir = new THREE.Vector3(0, -1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, directionVec);
      spot.beam.quaternion.copy(quat);

      // Beat-synced spotlight flare and volumetric thickness pulse
      if (isBeat) {
        spot.light.intensity = 18.0;
        spot.beam.material.opacity = 0.22;
      } else {
        spot.light.intensity += (9.0 - spot.light.intensity) * spotDecay;
        spot.beam.material.opacity += (0.1 - spot.beam.material.opacity) * spotDecay;
      }
    });

    // 2. Pulse hardwood floor seams slightly (beat-synced decay for subtle wood highlighting)
    const tileDecay = 1 - Math.exp(-7.67 * dt);
    if (this.tileMaterials) {
      this.tileMaterials.forEach((material) => {
        if (isBeat) {
          material.emissiveIntensity = 0.85; // subtle cozy flare
        } else {
          material.emissiveIntensity += (0.08 - material.emissiveIntensity) * tileDecay;
        }
      });
    }

    // 3. Gas Lantern flickering noise calculation (illuminating the "HEARTHSIDE" sign and street)
    this.flickerTimer += dt;
    if (this.flickerTimer >= 0.06) {
      this.flickerTimer = 0;
      if (this.signLanternLight) {
        const roll = Math.random();
        if (roll > 0.97) {
          this.signLanternLight.intensity = 1.2 + Math.random() * 0.6; // gas flame flicker dip
        } else {
          this.signLanternLight.intensity = 3.5 + Math.random() * 0.8; // warm atmospheric glow
        }
      }
    }

    // 4. Fireplace flickering flame logic (crackles on an 80ms interval)
    this.fireTimer += dt;
    if (this.fireTimer >= 0.08) {
      this.fireTimer = 0;
      if (this.fireplaceLight) {
        const fireRoll = Math.random();
        if (fireRoll > 0.94) {
          this.fireplaceLight.intensity = (1.5 + Math.random() * 1.5) * 1.2; // flame crackle dip
        }
      }
    }

    if (this.fireplaceLight) {
      const fireDecay = 1 - Math.exp(-9.75 * dt);
      this.fireplaceLight.intensity += (3.5 - this.fireplaceLight.intensity) * fireDecay;
    }

    // 5. Flickering animations for new Cloakroom and Lounge sconces (highly atmospheric!)
    this.lanternFlickerTimer += dt;
    if (this.lanternFlickerTimer >= 0.07) {
      this.lanternFlickerTimer = 0;
      const flickerFactor = () => 0.88 + Math.random() * 0.24;

      if (this.cloakLanternLight1) this.cloakLanternLight1.intensity = 4.5 * flickerFactor();
      if (this.cloakLanternLight2) this.cloakLanternLight2.intensity = 4.5 * flickerFactor();
      if (this.sconceLight1) this.sconceLight1.intensity = 2.2 * flickerFactor();
      if (this.sconceLight2) this.sconceLight2.intensity = 2.2 * flickerFactor();
    }
  }
}

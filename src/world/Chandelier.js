import * as THREE from 'three';

export class Chandelier {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;

    this.ballGroup = new THREE.Group();
    this.sparks = [];
    this.flames = [];

    this._buildChandelier();
    this._buildMirrorSparks();

    this.scene.add(this.ballGroup);
  }

  /**
   * Constructs the grand slow-rotating wrought-iron candle chandelier.
   */
  _buildChandelier() {
    const chanPos = new THREE.Vector3(10.5, 3.8, 0); // Hung over center floor

    // 1. Suspension Cord/Chain (Thin black wrought iron rod)
    const chainGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4);
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.95 });
    const chainMesh = new THREE.Mesh(chainGeo, chainMat);
    chainMesh.position.set(chanPos.x, 4.4, chanPos.z); // ceiling is 5.0m, chain pivots around 4.4
    this.ballGroup.add(chainMesh);

    // 2. Wrought Iron Central Hub Group (rotates in update loop)
    this.ballMesh = new THREE.Group();
    this.ballMesh.position.copy(chanPos);
    this.ballGroup.add(this.ballMesh);

    // Central core bracket
    const coreGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.1, 8);
    const coreMesh = new THREE.Mesh(coreGeo, chainMat);
    this.ballMesh.add(coreMesh);

    // Outer decorative wrought iron ring
    const ringGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.05, 16, 1, true);
    const ringMesh = new THREE.Mesh(ringGeo, chainMat);
    ringMesh.position.y = -0.05;
    this.ballMesh.add(ringMesh);

    // 6 Radial Spokes and Candles
    const numSpokes = 6;
    const radius = 0.65;

    const candleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 5);
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.8 }); // Ivory candles

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa3a, // Warm candle-orange glow
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < numSpokes; i++) {
      const angle = (i / numSpokes) * Math.PI * 2;
      const sx = Math.cos(angle) * radius;
      const sz = Math.sin(angle) * radius;

      // Spoke metal arm
      const spokeGeo = new THREE.BoxGeometry(radius, 0.02, 0.02);
      const spokeMesh = new THREE.Mesh(spokeGeo, chainMat);

      // Pivot and position radial spoke arm
      spokeMesh.position.set(sx / 2, -0.05, sz / 2);
      spokeMesh.rotation.y = -angle;
      this.ballMesh.add(spokeMesh);

      // Small brass drip pan under the candle
      const panGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.02, 6);
      const panMat = new THREE.MeshStandardMaterial({
        color: 0xcda45d,
        metalness: 0.8,
        roughness: 0.2,
      }); // Brass
      const panMesh = new THREE.Mesh(panGeo, panMat);
      panMesh.position.set(sx, -0.02, sz);
      this.ballMesh.add(panMesh);

      // Ivory candle cylinder
      const candleMesh = new THREE.Mesh(candleGeo, candleMat);
      candleMesh.position.set(sx, 0.08, sz);
      candleMesh.castShadow = true;
      this.ballMesh.add(candleMesh);

      // Glowing candle flame voxel
      const flameGeo = new THREE.BoxGeometry(0.03, 0.07, 0.03);
      const flameMesh = new THREE.Mesh(flameGeo, flameMat);
      flameMesh.position.set(sx, 0.2, sz);
      this.ballMesh.add(flameMesh);

      // Track the flame mesh to animate its height/scale on sequencer beats
      this.flames.push(flameMesh);
    }

    // 3. Dedicated warm candlelight point light centered just below the chandelier
    this.ballLight = new THREE.PointLight(0xff9e3a, 2.2, 14); // Warm candle amber
    this.ballLight.position.set(chanPos.x, chanPos.y - 0.1, chanPos.z);
    this.ballLight.castShadow = true;
    this.ballLight.shadow.mapSize.width = 512;
    this.ballLight.shadow.mapSize.height = 512;
    this.ballLight.shadow.camera.near = 0.5;
    this.ballLight.shadow.camera.far = 10;
    this.ballLight.shadow.bias = -0.002;
    this.ballGroup.add(this.ballLight);

    // 3b. Dedicated non-shadow-casting ceiling fill light above the chandelier to beautifully illuminate the rafters
    this.ceilingFillLight = new THREE.PointLight(0xff9e3a, 3.2, 12.0, 1.0); // Warm candle amber, linear decay
    this.ceilingFillLight.position.set(chanPos.x, chanPos.y + 0.3, chanPos.z); // higher, close to rafters
    this.ballGroup.add(this.ceilingFillLight);
  }

  /**
   * Spawns a ring of tiny diamond-shaped meshes representing warm golden candle sparks drifting.
   */
  _buildMirrorSparks() {
    const numSparks = 18;
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44, // Warm golden spark reflections
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.sparkMaterial = sparkMat;

    // Vintage boxy glimmers
    const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);

    for (let i = 0; i < numSparks; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);

      // Assign randomized orbit metrics
      const radius = 1.2 + Math.random() * 8.0; // sweep across different distances in the hall
      const speed = (0.08 + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1); // much slower, peaceful orbit
      const angle = Math.random() * Math.PI * 2;
      const height = 0.1 + Math.random() * 2.5; // swept heights from floor to walls

      mesh.position.set(10.5 + Math.cos(angle) * radius, height, 0 + Math.sin(angle) * radius);

      this.scene.add(mesh);

      this.sparks.push({
        mesh: mesh,
        radius: radius,
        speed: speed,
        angle: angle,
        height: height,
      });
    }
  }

  /**
   * Gently spins the chandelier and flickers flames/sparks in sync with sequencer tempo.
   */
  update(dt) {
    const time = performance.now() * 0.001;

    // 1. Peaceful Chandelier Rotation
    if (this.ballMesh) {
      this.ballMesh.rotation.y += 0.06 * dt; // extremely slow, majestic rotation
      // Gentle vertical bobbing sway for realism
      const newY = 3.8 + Math.sin(time * 1.2) * 0.02;
      this.ballMesh.position.y = newY;

      // Keep the point lights locked to the bobbing chandelier
      if (this.ballLight) {
        this.ballLight.position.y = newY - 0.1;
      }
      if (this.ceilingFillLight) {
        this.ceilingFillLight.position.y = newY + 0.3;
      }
    }

    const isBeat = this.audio.isBeatHit;

    // 2. Dynamic Point Light & Flame flickering animations (beat-synced & organic crackles)
    if (this.ballLight) {
      if (isBeat) {
        // Flare beautifully on sequencer kick stomp beats
        this.ballLight.intensity = 3.8;
        if (this.ceilingFillLight) this.ceilingFillLight.intensity = 4.8;

        // Scale the flame shapes up during beat spikes
        this.flames.forEach((flame) => {
          flame.scale.set(1.4, 1.7, 1.4);
        });
      } else {
        // Smoothly decay back to standard glowing states (frame-rate independent)
        const decay = 1 - Math.exp(-6.0 * dt);
        this.ballLight.intensity += (2.4 - this.ballLight.intensity) * decay;
        if (this.ceilingFillLight) {
          this.ceilingFillLight.intensity += (3.2 - this.ceilingFillLight.intensity) * decay;
        }

        // Apply a subtle, organic candlelight flickering noise
        const flicker =
          Math.sin(time * 18.0) * 0.08 + (Math.random() > 0.9 ? (Math.random() - 0.5) * 0.25 : 0);
        this.ballLight.intensity += flicker;
        if (this.ceilingFillLight) {
          this.ceilingFillLight.intensity += flicker;
        }

        // Scale flames back and apply tiny flame flicker/flutter
        this.flames.forEach((flame, index) => {
          const flameDecay = 1 - Math.exp(-8.0 * dt);
          flame.scale.x += (1.0 - flame.scale.x) * flameDecay;
          flame.scale.y +=
            (1.0 + Math.sin(time * 25.0 + index) * 0.08 - flame.scale.y) * flameDecay;
          flame.scale.z += (1.0 - flame.scale.z) * flameDecay;
        });
      }
    }

    // 3. Update Shared Spark Material Opacity
    if (this.sparkMaterial) {
      if (isBeat) {
        this.sparkMaterial.opacity = 0.9;
      } else {
        const opacityDecay = 1 - Math.exp(-4.5 * dt);
        this.sparkMaterial.opacity += (0.55 - this.sparkMaterial.opacity) * opacityDecay;
      }
    }

    // 4. Animate reflecting sparks
    const scaleDecay = 1 - Math.exp(-5.0 * dt);
    this.sparks.forEach((spark) => {
      // Advance orbit angle slowly
      spark.angle += spark.speed * dt;

      const targetX = 10.5 + Math.cos(spark.angle) * spark.radius;
      const targetZ = 0 + Math.sin(spark.angle) * spark.radius;

      spark.mesh.position.x = targetX;
      spark.mesh.position.z = targetZ;

      if (isBeat) {
        // Star spots grow and flare on stomp kicks
        spark.mesh.scale.set(2.4, 2.4, 2.4);
      } else {
        // Glide smoothly back to standard resting size
        spark.mesh.scale.x += (1.0 - spark.mesh.scale.x) * scaleDecay;
        spark.mesh.scale.y += (1.0 - spark.mesh.scale.y) * scaleDecay;
        spark.mesh.scale.z += (1.0 - spark.mesh.scale.z) * scaleDecay;
      }
    });
  }
}

import * as THREE from 'three';
import { getGameplayRandom } from '../config/experience.js';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class MapBuilder {
  /**
   * @param {THREE.Scene} scene - Target scene
   * @param {ControlsManager} controls - To register collision boundaries
   */
  constructor(scene, controls) {
    this.scene = scene;
    this.controls = controls;
    this.random = getGameplayRandom();
    this.colliderDebugMeshes = [];

    // Caches to prevent redundant geometry allocations
    this.geometryCache = new Map();

    // Shared material arrays for performance
    this.tileMaterials = [];
    this.bottleMaterials = [];
    this.jacketMaterials = [];

    // Materials Store (reusable)
    this.materials = {};
    this._initMaterials();

    // Floor meshes requiring beat sync (pulsing dance floor grid)
    this.danceTiles = [];
  }

  /**
   * Returns a cached BoxGeometry of the specified size or creates one if not cached.
   */
  _getBoxGeometry(w, h, d) {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, new THREE.BoxGeometry(w, h, d));
    }
    return this.geometryCache.get(key);
  }

  /**
   * Returns a cached CylinderGeometry of the specified parameters or creates one if not cached.
   */
  _getCylinderGeometry(radiusT, radiusB, height) {
    const key = `${radiusT.toFixed(3)}_${radiusB.toFixed(3)}_${height.toFixed(3)}`;
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, new THREE.CylinderGeometry(radiusT, radiusB, height, 8));
    }
    return this.geometryCache.get(key);
  }

  /**
   * Generates procedurally compiled materials to style the lounge structures.
   */
  _initMaterials() {
    // 1. Procedural Textures
    const wallBrickTex = TextureGenerator.generateBrickWall('#221c38', '#06030c');
    wallBrickTex.repeat.set(4, 2); // repeat bricks across long walls

    const wallConcreteTex = TextureGenerator.generateBrickWall('#12121c', '#06060c');
    wallConcreteTex.repeat.set(3, 3);

    const loungeCarpetTex = TextureGenerator.generateBrickWall('#17122b', '#0d0a1d');
    loungeCarpetTex.repeat.set(5, 5);

    const floorGridTex = TextureGenerator.generateHardwoodFloor('#00f0ff', '#07060e', 128);
    floorGridTex.repeat.set(10, 10);

    const barGridTex = TextureGenerator.generateHardwoodFloor('#ff0055', '#09050d', 128);
    barGridTex.repeat.set(6, 4);

    this.speakerConeTex = TextureGenerator.generateSpeakerCone(128);
    this.turntableConsoleTex = TextureGenerator.generateTurntableConsole(256);

    // 2. High-Quality Standard Materials
    this.materials.brickWall = new THREE.MeshStandardMaterial({
      map: wallBrickTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    this.materials.lobbyWall = new THREE.MeshStandardMaterial({
      map: wallConcreteTex,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.materials.loungeWall = new THREE.MeshStandardMaterial({
      color: 0x2c1f18, // Cozy wood logs/timbers tone
      roughness: 0.9,
      metalness: 0.1,
    });

    // Floors
    this.materials.exteriorFloor = new THREE.MeshStandardMaterial({
      color: 0x3a332d, // Slate/cobblestone grey
      roughness: 0.95,
      metalness: 0.2,
    });

    this.materials.lobbyFloor = new THREE.MeshStandardMaterial({
      color: 0x241d18, // Warm cozy slate
      roughness: 0.8,
      metalness: 0.15,
    });

    this.materials.hallFloorBorder = new THREE.MeshStandardMaterial({
      color: 0x1d140e, // Rich dark walnut border
      roughness: 0.5,
      metalness: 0.4,
    });

    this.materials.loungeFloor = new THREE.MeshStandardMaterial({
      map: loungeCarpetTex,
      roughness: 0.95,
      metalness: 0.0,
    });

    // Bar and Furniture
    this.materials.barCounter = new THREE.MeshStandardMaterial({
      color: 0x4a1a12, // Solid polished mahogany wood
      roughness: 0.2,
      metalness: 0.1,
    });

    this.materials.goldMetal = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.15,
      metalness: 0.95,
    });

    this.materials.velvetRope = new THREE.MeshStandardMaterial({
      color: 0x990022,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.materials.sofaLeather = new THREE.MeshStandardMaterial({
      color: 0x5c2c16, // Tufted dark-cognac brown leather
      roughness: 0.45,
      metalness: 0.15,
    });

    this.materials.woodTable = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b, // Beautiful dark walnut table
      roughness: 0.5,
      metalness: 0.1,
    });

    // --- New Materials for Architectural and Street Expansion ---
    this.materials.roadAsphalt = new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.9,
      metalness: 0.1,
    });

    this.materials.roadMarkingYellow = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.materials.curbStone = new THREE.MeshStandardMaterial({
      color: 0x5c5c62,
      roughness: 0.9,
      metalness: 0.15,
    });

    this.materials.warmAmberGlow = new THREE.MeshStandardMaterial({
      color: 0xffb03a, // Re-mapped to warm amber/lantern glow
      emissive: 0xffb03a,
      emissiveIntensity: 1.0,
      roughness: 0.1,
      metalness: 0.1,
    });

    this.materials.candleGoldGlow = new THREE.MeshStandardMaterial({
      color: 0xffaa3a, // Re-mapped to warm candle gold
      emissive: 0xffaa3a,
      emissiveIntensity: 1.0,
      roughness: 0.1,
      metalness: 0.1,
    });

    this.materials.taxiYellow = new THREE.MeshStandardMaterial({
      color: 0x0c2c12, // British racing green
      roughness: 0.3,
      metalness: 0.7,
    });

    this.materials.taxiBlack = new THREE.MeshStandardMaterial({
      color: 0x18181d,
      roughness: 0.6,
      metalness: 0.2,
    });

    this.materials.glowOrange = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      emissive: 0xff9900,
      emissiveIntensity: 1.2,
    });

    this.materials.glowRed = new THREE.MeshStandardMaterial({
      color: 0xcc2200,
      emissive: 0xcc2200,
      emissiveIntensity: 1.2,
    });

    this.materials.plantGreen = new THREE.MeshStandardMaterial({
      color: 0x184a12, // Beautiful forest green
      roughness: 0.9,
      metalness: 0.0,
    });

    this.materials.potClay = new THREE.MeshStandardMaterial({
      color: 0xa0522d,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.materials.fireBrick = new THREE.MeshStandardMaterial({
      color: 0x4a1a1a,
      roughness: 0.9,
      metalness: 0.05,
    });

    // Premium Hearthside Themes
    this.materials.mahogany = new THREE.MeshStandardMaterial({
      color: 0x4a1a12,
      roughness: 0.25,
      metalness: 0.1,
    });

    this.materials.rusticOak = new THREE.MeshStandardMaterial({
      color: 0x5a3d28,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.materials.foliageGreen = new THREE.MeshStandardMaterial({
      color: 0x224d17,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.materials.emeraldVelvet = new THREE.MeshStandardMaterial({
      color: 0x0f4c23,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.materials.loungeWool = new THREE.MeshStandardMaterial({
      color: 0xeae4d8,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.materials.racingGreen = new THREE.MeshStandardMaterial({
      color: 0x0c2c12,
      roughness: 0.2,
      metalness: 0.8,
    });

    this.materials.chrome = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.1,
      metalness: 0.95,
    });

    this.materials.goldTrim = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Pre-create and cache bottle materials
    const bottleColors = [0xd4af37, 0x8b5a2b, 0x125a22, 0x4a5d1a, 0xb8860b];
    this.bottleMaterials = bottleColors.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.18,
          roughness: 0.05,
          metalness: 0.95,
        })
    );

    // Pre-create and cache jacket materials
    const jacketColors = [0xe1c7a5, 0xa24a38, 0x255232, 0x8a8a92, 0x1c284f, 0xeae4d8];
    this.jacketMaterials = jacketColors.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.85,
          metalness: 0.1,
        })
    );
  }

  /**
   * Helper to construct a mesh box with shadow configurations and automatic collision box generation.
   */
  _buildBox(w, h, d, x, y, z, material, isSolid = true, castShadow = true, receiveShadow = true) {
    const geo = this._getBoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);

    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    this.scene.add(mesh);

    if (isSolid) {
      // Create Box3 and register with the controls collision array
      const bbox = new THREE.Box3().setFromObject(mesh);
      this.controls.registerCollisionBox(bbox);
    }

    return mesh;
  }

  _buildClimbableBox(w, h, d, x, y, z, material, isSolid = true, castShadow = true, receiveShadow = true) {
    const mesh = this._buildBox(w, h, d, x, y, z, material, false, castShadow, receiveShadow);
    if (isSolid && this.controls?.registerClimbableBox) {
      this.controls.registerClimbableBox(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  }

  /**
   * Helper to construct a cylinder mesh (pillars, stools).
   */
  _buildCylinder(radiusT, radiusB, height, x, y, z, material, isSolid = true) {
    const geo = this._getCylinderGeometry(radiusT, radiusB, height);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    if (isSolid) {
      const bbox = new THREE.Box3().setFromObject(mesh);
      this.controls.registerCollisionBox(bbox);
    }

    return mesh;
  }

  _buildClimbableCylinder(radiusT, radiusB, height, x, y, z, material, isSolid = true) {
    const mesh = this._buildCylinder(radiusT, radiusB, height, x, y, z, material, false);
    if (isSolid && this.controls?.registerClimbableBox) {
      this.controls.registerClimbableBox(new THREE.Box3().setFromObject(mesh));
    }
    return mesh;
  }

  addDebugColliderOutlines() {
    const material = new THREE.LineBasicMaterial({ color: 0x77d7ff });
    for (const collider of this.controls.contactLayer?.colliders?.values?.() || []) {
      if (!collider.solid || collider.shape !== 'aabb') continue;
      const points = [
        new THREE.Vector3(
          collider.position.x - collider.halfExtents.x,
          0.05,
          collider.position.z - collider.halfExtents.z
        ),
        new THREE.Vector3(
          collider.position.x + collider.halfExtents.x,
          0.05,
          collider.position.z - collider.halfExtents.z
        ),
        new THREE.Vector3(
          collider.position.x + collider.halfExtents.x,
          0.05,
          collider.position.z + collider.halfExtents.z
        ),
        new THREE.Vector3(
          collider.position.x - collider.halfExtents.x,
          0.05,
          collider.position.z + collider.halfExtents.z
        ),
        new THREE.Vector3(
          collider.position.x - collider.halfExtents.x,
          0.05,
          collider.position.z - collider.halfExtents.z
        ),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const outline = new THREE.Line(geometry, material);
      this.scene.add(outline);
      this.colliderDebugMeshes.push(outline);
    }
    return this.colliderDebugMeshes;
  }

  /**
   * Assembles the complete architectural footprint of the lounge.
   */
  build() {
    this._buildFloors();
    this._buildOuterWalls();
    this._buildInteriorWalls();
    this._buildBarArea();
    this._buildMusicSelectorBooth();
    this._buildChilloutLounge();
    this._buildCloakroom();
    this._buildExteriorQueue();
    this._buildPillars();
    this._buildDecorations();
    this._buildRoof();
  }

  /**
   * Constructs the flat room layouts.
   */
  _buildFloors() {
    // 1. Remodeled Sidewalk Floor (x: -10.8 to -4.8, z: -15 to 15, width: 6m)
    this._buildBox(6, 0.2, 30, -7.8, -0.1, 0, this.materials.exteriorFloor, false);

    // 1b. Asphalt Road Floor (x: -24.8 to -10.8, z: -15 to 15, width: 14m)
    // Sits slightly lower (top face at y = -0.15)
    this._buildBox(14, 0.2, 30, -17.8, -0.25, 0, this.materials.roadAsphalt, false);

    // 1c. Raised Curb Stone at x = -10.8
    // Formed of a single solid-looking block separating sidewalk and asphalt
    this._buildBox(0.3, 0.2, 30, -10.85, -0.05, 0, this.materials.curbStone, false);

    // 1d. Yellow Center Lane Markings
    for (let z = -13.0; z <= 13.0; z += 4.0) {
      this._buildBox(
        0.15,
        0.01,
        1.5,
        -17.8,
        -0.145,
        z,
        this.materials.roadMarkingYellow,
        false,
        false,
        true
      );
    }

    // 2. Lobby Floor (x: -4.8 to 1.0, z: -15 to 15)
    this._buildBox(5.8, 0.2, 30, -1.9, -0.1, 0, this.materials.lobbyFloor, false);

    // 3. Main Acoustic Hall Floor Border (x: 1.0 to 20.0, z: -10.5 to 11.0)
    // Floor is elevated slightly above 0 to prevent z-fighting with borders
    this._buildBox(19, 0.2, 21.5, 10.5, -0.1, 0.25, this.materials.hallFloorBorder, false);

    // 4. Chillout Lounge Floor (x: 6.0 to 20.0, z: -21.0 to -10.5)
    this._buildBox(14, 0.2, 10.5, 13.0, -0.1, -15.75, this.materials.loungeFloor, false);

    // 5. Beautiful Cozy Wood Herringbone Parquet Floor Grid (Interactive)
    // Centered at x: 8, z: -2.5. Total grid is 10x8 tiles
    const tileW = 1.0;
    const tileD = 1.0;
    const gridCols = 10; // X axis
    const gridRows = 8; // Z axis
    const startX = 3.5;
    const startZ = -6.0;

    // Pre-create 8 shared wood tile materials
    this.tileMaterials = [];
    const baseColor = new THREE.Color(0x7d4c37);
    for (let i = 0; i < 8; i++) {
      const woodShade = 0.45 + (i / 7) * 0.25;
      const tileColor = baseColor.clone().multiplyScalar(woodShade + 0.35);
      const tileMat = new THREE.MeshStandardMaterial({
        map: this.materials.loungeFloor.map, // Beautiful wood/carpet texture
        color: tileColor,
        emissive: new THREE.Color(0xffaa3a), // Warm amber glow on beats
        emissiveIntensity: 0.08,
        roughness: 0.45,
        metalness: 0.1,
      });
      this.tileMaterials.push(tileMat);
    }

    for (let c = 0; c < gridCols; c++) {
      for (let r = 0; r < gridRows; r++) {
        const x = startX + c * tileW;
        const z = startZ + r * tileD;

        // Randomly assign one of the 8 shared materials
        const tileMat = this.tileMaterials[Math.floor(this.random() * this.tileMaterials.length)];

        this._buildBox(tileW - 0.08, 0.05, tileD - 0.08, x, 0.025, z, tileMat, false, false, true);
      }
    }
  }

  /**
   * Places high boundaries around the lounge layout.
   */
  _buildOuterWalls() {
    const wallH = 5.0;
    const halfH = wallH / 2;

    // Absolute Boundary Collisions to keep player inside scene
    // 1. Far Left Boundary Wall (z = -15 for Lobby/Exterior, z = -21 for Lounge)
    this._buildBox(20.2, wallH, 1, -14.9, halfH, -15.0, this.materials.lobbyWall);
    this._buildBox(5.8, wallH, 1, -1.9, halfH, -15.0, this.materials.lobbyWall);
    this._buildBox(14, wallH, 1, 13.0, halfH, -21.0, this.materials.loungeWall); // Lounge Back

    // 2. Far Right Boundary Wall (z = 15 for Lobby/Exterior, z = 11 for Bar)
    this._buildBox(26, wallH, 1, -12, halfH, 15.0, this.materials.lobbyWall);
    this._buildBox(19, wallH, 1, 10.5, halfH, 11.0, this.materials.brickWall); // Bar Back

    // 3. Back Boundary Wall (x = 20.0, from z = -21.0 to 11.0)
    this._buildBox(1, wallH, 32, 20.0, halfH, -5.0, this.materials.brickWall);

    // 4. Exterior Back Boundary (x = -25.0)
    this._buildBox(1, wallH, 30, -25.0, halfH, 0, this.materials.lobbyWall);
  }

  /**
   * Places internal rooms partition panels.
   */
  _buildInteriorWalls() {
    const wallH = 5.0;
    const halfH = wallH / 2;
    const wallJoin = 0.12; // overlap to prevent seam-light leaks at transition joints

    // 1. Exterior-to-Lobby Partition Wall (x = -4.8)
    // Left section (z: -15 to -2)
    this._buildBox(
      0.8,
      wallH,
      13 + wallJoin * 2,
      -4.8,
      halfH,
      -8.5 - wallJoin / 2,
      this.materials.lobbyWall
    );
    // Right section (z: 2 to 15)
    this._buildBox(
      0.8,
      wallH,
      13 + wallJoin * 2,
      -4.8,
      halfH,
      8.5 + wallJoin / 2,
      this.materials.lobbyWall
    );
    // Entry lintel over double-door center opening (y: 3.5 to 5.0)
    this._buildBox(0.8, 1.5, 4.0 + wallJoin, -4.8, 4.25, 0, this.materials.lobbyWall);
    // Tight closure caps where wall segments kiss the lintel (prevents visual seam gaps).
    this._buildBox(0.8, wallH, 0.4, -4.8, halfH, -1.9 - wallJoin / 2, this.materials.lobbyWall);
    this._buildBox(0.8, wallH, 0.4, -4.8, halfH, 1.9 + wallJoin / 2, this.materials.lobbyWall);

    // --- Premium Rustic Pergola & Support Columns Remodel ---
    // A. Rustic Oak Trellis Pergola (extending outward over double doors, from z = -2.5 to 2.5)
    // Main horizontal support beams
    this._buildBox(1.8, 0.15, 0.15, -5.7, 3.6, -2.4, this.materials.rusticOak, false);
    this._buildBox(1.8, 0.15, 0.15, -5.7, 3.6, 2.4, this.materials.rusticOak, false);
    this._buildBox(0.15, 0.15, 5.0, -6.5, 3.6, 0, this.materials.rusticOak, false);

    // Cross rafters (grating trellis)
    for (let tz = -2.2; tz <= 2.2; tz += 0.8) {
      this._buildBox(1.6, 0.1, 0.1, -5.6, 3.75, tz, this.materials.rusticOak, false);
    }
    for (let tx = -6.5; tx <= -4.9; tx += 0.4) {
      this._buildBox(0.1, 0.08, 4.8, tx, 3.82, 0, this.materials.rusticOak, false);
    }

    // Hanging Ivy Foliage blocks
    this._buildBox(0.4, 0.6, 0.4, -6.2, 3.3, -1.8, this.materials.foliageGreen, false);
    this._buildBox(0.3, 0.8, 0.3, -5.8, 3.2, 2.0, this.materials.foliageGreen, false);
    this._buildBox(0.4, 0.5, 0.4, -6.4, 3.35, 0.5, this.materials.foliageGreen, false);
    this._buildBox(0.3, 0.7, 0.3, -5.3, 3.25, -1.0, this.materials.foliageGreen, false);

    // B. Support Columns Framing Entrance
    // Left Column
    this._buildBox(0.5, 5.0, 0.5, -5.1, 2.5, -2.3, this.materials.brickWall, true);
    // Right Column
    this._buildBox(0.5, 5.0, 0.5, -5.1, 2.5, 2.3, this.materials.brickWall, true);

    // C. Facade Trims and Panel Seams (Warm oak framing)
    // Top Trim Line
    this._buildBox(0.2, 0.25, 30.0, -5.3, 4.8, 0, this.materials.rusticOak, false);
    // Vertical Seams
    this._buildBox(0.1, 5.0, 0.1, -5.25, 2.5, -12.0, this.materials.rusticOak, false);
    this._buildBox(0.1, 5.0, 0.1, -5.25, 2.5, -6.0, this.materials.rusticOak, false);
    this._buildBox(0.1, 5.0, 0.1, -5.25, 2.5, 6.0, this.materials.rusticOak, false);
    this._buildBox(0.1, 5.0, 0.1, -5.25, 2.5, 12.0, this.materials.rusticOak, false);

    // D. Two Glowing Yellow/Orange Facade Windows with warm ambient frames
    // Left Window
    this._buildBox(0.05, 1.4, 2.4, -5.22, 2.2, -9.0, this.materials.glowOrange, false);
    this._buildBox(0.06, 0.08, 2.4, -5.19, 2.2, -9.0, this.materials.rusticOak, false);
    this._buildBox(0.06, 1.4, 0.08, -5.19, 2.2, -9.0, this.materials.rusticOak, false);
    // Right Window
    this._buildBox(0.05, 1.4, 2.4, -5.22, 2.2, 9.0, this.materials.glowOrange, false);
    this._buildBox(0.06, 0.08, 2.4, -5.19, 2.2, 9.0, this.materials.rusticOak, false);
    this._buildBox(0.06, 1.4, 0.08, -5.19, 2.2, 9.0, this.materials.rusticOak, false);

    // 2. Lobby-to-Acoustic-Hall Partition Wall (x = 1.0)
    // Left section (z: -15 to -3)
    this._buildBox(
      0.8,
      wallH,
      12 + wallJoin * 2,
      1.0,
      halfH,
      -8.95 - wallJoin / 2,
      this.materials.brickWall
    );
    // Right section (z: 3 to 15)
    this._buildBox(
      0.8,
      wallH,
      12 + wallJoin * 2,
      1.0,
      halfH,
      9.05 + wallJoin / 2,
      this.materials.brickWall
    );
    // Portal lintel (y: 3.5 to 5.0)
    this._buildBox(0.8, 1.5, 6.0 + wallJoin, 1.0, 4.25, 0, this.materials.brickWall);
    // Transition seam caps to keep edge joins sealed at doorway corners.
    this._buildBox(0.8, wallH, 0.4, 1.0, halfH, -2.95 - wallJoin / 2, this.materials.brickWall);
    this._buildBox(0.8, wallH, 0.4, 1.0, halfH, 2.95 + wallJoin / 2, this.materials.brickWall);

    // 3. Lounge-to-Acoustic-Hall Separation Wall (z = -10.5)
    // Left section (x: 1.0 to 8.0)
    this._buildBox(7.0 + wallJoin * 2, wallH, 0.8, 4.5, halfH, -10.5, this.materials.brickWall);
    // Right section (x: 13.0 to 20.0)
    this._buildBox(7.0 + wallJoin * 2, wallH, 0.8, 16.5, halfH, -10.5, this.materials.brickWall);
    // Lounge corridor lintel (x: 8.0 to 13.0)
    this._buildBox(5.0 + wallJoin, 1.5, 0.8, 10.5, 4.25, -10.5, this.materials.brickWall);
    // Transition-end caps at the x-extremes of the separator corridor.
    this._buildBox(0.4, wallH, 0.8, 8.0 - wallJoin / 2, halfH, -10.5, this.materials.brickWall);
    this._buildBox(0.4, wallH, 0.8, 13.0 + wallJoin / 2, halfH, -10.5, this.materials.brickWall);

    // 4. Hearthside Lounge left boundary wall (x = 6.0, z: -21.0 to -10.5)
    this._buildBox(0.8, wallH, 10.5, 6.0, halfH, -15.75, this.materials.loungeWall);
  }

  /**
   * Builds the fully stocked Botanist Bar counter and stool nodes.
   */
  _buildBarArea() {
    // Bar Counter shape (L-shape or long rectangular island)
    // Placed at z = 7.2. Spans x = 5.0 to 13.0
    this._buildClimbableBox(8.0, 1.1, 1.0, 9.0, 0.55, 7.5, this.materials.mahogany);

    // Warm golden led strip on bottom edge of bar
    const barLedMat = new THREE.MeshStandardMaterial({
      color: 0xffa544,
      emissive: 0xffa544,
      emissiveIntensity: 0.8,
    });
    this._buildBox(8.0, 0.1, 0.1, 9.0, 0.05, 6.95, barLedMat, false);

    // Place Cylinder Stools
    for (let x = 5.8; x <= 12.2; x += 1.4) {
      // Gold base
      this._buildCylinder(0.18, 0.22, 0.1, x, 0.05, 5.8, this.materials.goldMetal, false);
      // Steel stem
      this._buildCylinder(0.05, 0.05, 0.5, x, 0.3, 5.8, this.materials.goldMetal, false);
      // Emerald velvet cushion top
      this._buildClimbableCylinder(0.2, 0.2, 0.12, x, 0.6, 5.8, this.materials.emeraldVelvet, true);
    }

    // Back Bar Bottle Shelving (placed against wall z = 11)
    this._buildBox(7.0, 0.08, 0.6, 9.0, 1.2, 10.2, this.materials.rusticOak, true);
    this._buildBox(7.0, 0.08, 0.6, 9.0, 2.0, 10.2, this.materials.rusticOak, true);

    // Spawn 15 colorful tiny procedural voxel liquor bottles representing whiskey and herbal glass
    for (let shelfY = 1.26; shelfY <= 2.06; shelfY += 0.8) {
      for (let bx = 6.0; bx <= 12.0; bx += 0.6) {
        if (this.random() > 0.3) {
          const bMat =
            this.bottleMaterials[Math.floor(this.random() * this.bottleMaterials.length)];
          // Bottle shape (small block)
          this._buildBox(0.12, 0.3, 0.12, bx, shelfY + 0.15, 10.2, bMat, false, true, false);
        }
      }
    }
  }

  /**
   * Assembles the music selector booth, turntable console, and dual speaker towers.
   */
  _buildMusicSelectorBooth() {
    // Acoustic Turntable Console Cabinet (centered at far end: x: 18, z: 0)
    this._buildClimbableBox(1.5, 1.15, 3.5, 17.5, 0.575, 0, this.materials.rusticOak);

    // Warm glowing led rim under console
    const consoleLedMat = new THREE.MeshStandardMaterial({
      color: 0xffa544,
      emissive: 0xffa544,
      emissiveIntensity: 0.8,
    });
    this._buildBox(0.1, 0.1, 3.5, 16.7, 1.1, 0, consoleLedMat, false);

    // Turntable decks and mixer mesh overlay
    const deckMat = new THREE.MeshStandardMaterial({
      map: this.turntableConsoleTex,
      roughness: 0.3,
      metalness: 0.8,
    });
    this._buildBox(1.1, 0.05, 2.4, 17.5, 1.17, 0, deckMat, false, true, true);

    // Massive Speaker Towers flanking the booth in Walnut veneers
    const lSpeakerX = 17.5;
    const lSpeakerZLeft = -3.1;
    const lSpeakerZRight = 3.1;

    // Outer boxes (L/R)
    const speakerCabMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b, // Elegant walnut veneered cabinets
      roughness: 0.5,
      metalness: 0.1,
    });
    this._buildBox(1.5, 2.8, 1.5, lSpeakerX, 1.4, lSpeakerZLeft, speakerCabMat, true);
    this._buildBox(1.5, 2.8, 1.5, lSpeakerX, 1.4, lSpeakerZRight, speakerCabMat, true);

    // Speaker Cone front plates
    const coneMat = new THREE.MeshStandardMaterial({
      map: this.speakerConeTex,
      roughness: 0.6,
      metalness: 0.2,
    });

    // We slap 2 cone circles on the front face (-X direction) of each speaker cab
    this._buildBox(0.02, 1.0, 1.0, lSpeakerX - 0.76, 0.7, lSpeakerZLeft, coneMat, false);
    this._buildBox(0.02, 1.0, 1.0, lSpeakerX - 0.76, 1.9, lSpeakerZLeft, coneMat, false);

    this._buildBox(0.02, 1.0, 1.0, lSpeakerX - 0.76, 0.7, lSpeakerZRight, coneMat, false);
    this._buildBox(0.02, 1.0, 1.0, lSpeakerX - 0.76, 1.9, lSpeakerZRight, coneMat, false);
  }

  /**
   * Assembles blocky comfortable couches in the side Chillout Lounge.
   */
  _buildChilloutLounge() {
    // Sofa A (Back wall L-Shape: x: 14 to 18, z: -19.5 to -15)
    // Main cushions
    this._buildClimbableBox(5.0, 0.45, 1.2, 15.5, 0.225, -19.0, this.materials.sofaLeather, true); // Base seat
    this._buildBox(5.0, 0.6, 0.3, 15.5, 0.75, -19.45, this.materials.sofaLeather, true); // Back support

    // Side Armrests
    this._buildBox(1.2, 0.75, 1.2, 12.6, 0.375, -19.0, this.materials.sofaLeather, true);
    this._buildBox(1.2, 0.75, 1.2, 18.4, 0.375, -19.0, this.materials.sofaLeather, true);

    // Sofa B (Faced counter-couch: x: 8 to 11)
    this._buildClimbableBox(1.2, 0.45, 3.5, 8.5, 0.225, -15.5, this.materials.sofaLeather, true); // Seat
    this._buildBox(0.3, 0.6, 3.5, 8.05, 0.75, -15.5, this.materials.sofaLeather, true); // Back support
    this._buildBox(1.2, 0.75, 0.4, 8.5, 0.375, -13.55, this.materials.sofaLeather, true);

    // Elegant Low Coffee Table (centered between sofas)
    this._buildClimbableBox(2.2, 0.35, 1.6, 13.0, 0.175, -15.0, this.materials.woodTable, true);

    // --- Relaxation Lounge Furnishing Upgrades (Phase 4) ---
    // A. Cozy Brick Fireplace (Lounge back wall: x = 13.0, z = -20.5)
    const fX = 13.0;
    const fZ = -20.5;
    // Left brick column
    this._buildBox(0.5, 1.8, 0.7, fX - 0.95, 0.9, fZ, this.materials.fireBrick, true);
    // Right brick column
    this._buildBox(0.5, 1.8, 0.7, fX + 0.95, 0.9, fZ, this.materials.fireBrick, true);
    // Wood Mantelpiece
    this._buildBox(2.6, 0.35, 0.8, fX, 1.975, fZ, this.materials.woodTable, true);
    // Dark fireplace interior backing
    this._buildBox(1.5, 1.5, 0.2, fX, 0.75, fZ - 0.25, this.materials.mahogany, false);
    // Red embers base
    this._buildBox(1.4, 0.15, 0.5, fX, 0.075, fZ, this.materials.glowRed, false);
    // Fire flames (three dynamic glowing voxels)
    this._buildBox(0.2, 0.5, 0.2, fX - 0.2, 0.325, fZ + 0.05, this.materials.glowOrange, false);
    this._buildBox(0.25, 0.7, 0.25, fX, 0.425, fZ, this.materials.glowOrange, false);
    this._buildBox(0.18, 0.45, 0.18, fX + 0.25, 0.3, fZ + 0.05, this.materials.glowOrange, false);

    // B. Cozy Armchair 1 (Wool cushion on dark wood base, x: 10.5, z: -17.0)
    const ac1X = 10.5;
    const ac1Z = -17.0;
    // Back support
    this._buildBox(0.2, 0.7, 0.8, ac1X - 0.35, 0.35, ac1Z, this.materials.loungeWool, true);
    // Seat Cushion
    this._buildClimbableBox(0.7, 0.35, 0.8, ac1X, 0.175, ac1Z, this.materials.loungeWool, true);

    // C. Cozy Armchair 2 (Wool cushion on dark wood base, x: 15.5, z: -13.0)
    const ac2X = 15.5;
    const ac2Z = -13.0;
    // Back support
    this._buildBox(0.2, 0.7, 0.8, ac2X + 0.35, 0.35, ac2Z, this.materials.loungeWool, true);
    // Seat Cushion
    this._buildClimbableBox(0.7, 0.35, 0.8, ac2X, 0.175, ac2Z, this.materials.loungeWool, true);

    // D. Potted Palm Trees in lounge corners
    const loungeCorners = [
      { px: 7.0, pz: -19.5 },
      { px: 19.0, pz: -19.5 },
    ];
    loungeCorners.forEach((corner) => {
      // Pot
      this._buildBox(0.5, 0.6, 0.5, corner.px, 0.3, corner.pz, this.materials.potClay, true);
      // Trunk
      this._buildBox(0.15, 1.4, 0.15, corner.px, 1.3, corner.pz, this.materials.woodTable, true);
      // Leaves (4 blocky fans)
      this._buildBox(
        0.9,
        0.08,
        0.3,
        corner.px + 0.4,
        2.0,
        corner.pz,
        this.materials.plantGreen,
        false
      );
      this._buildBox(
        0.9,
        0.08,
        0.3,
        corner.px - 0.4,
        2.0,
        corner.pz,
        this.materials.plantGreen,
        false
      );
      this._buildBox(
        0.3,
        0.08,
        0.9,
        corner.px,
        2.0,
        corner.pz + 0.4,
        this.materials.plantGreen,
        false
      );
      this._buildBox(
        0.3,
        0.08,
        0.9,
        corner.px,
        2.0,
        corner.pz - 0.4,
        this.materials.plantGreen,
        false
      );
    });

    // E. Elegant framed botanical art on the Lounge side wall face (x: 19.5)
    const frameX = 19.48;
    const frameY = 2.8;
    const frameZ = -15.0;
    // Outer wood frame
    this._buildBox(0.04, 1.4, 1.4, frameX, frameY, frameZ, this.materials.rusticOak, false);
    // Matte card mounting
    this._buildBox(
      0.02,
      1.2,
      1.2,
      frameX - 0.015,
      frameY,
      frameZ,
      this.materials.loungeWool,
      false
    );
    // Botanical print
    const botanicalPosterMat = new THREE.MeshStandardMaterial({
      map: TextureGenerator.generatePoster('BOTANICAL', 128),
    });
    this._buildBox(0.02, 0.9, 0.9, frameX - 0.025, frameY, frameZ, botanicalPosterMat, false);

    // F. Wall-mounted candle sconces flanking the fireplace on the back wall face (z = -20.5)
    const sconces = [
      { sx: 10.5, sy: 2.3, sz: -20.5 },
      { sx: 15.5, sy: 2.3, sz: -20.5 },
    ];
    sconces.forEach((s) => {
      // Brass backing plate
      this._buildBox(0.12, 0.4, 0.04, s.sx, s.sy, s.sz + 0.02, this.materials.goldMetal, false);
      // Brass stem sticking out
      this._buildBox(
        0.04,
        0.06,
        0.12,
        s.sx,
        s.sy - 0.1,
        s.sz + 0.08,
        this.materials.goldMetal,
        false
      );
      // White candle cylinder
      this._buildBox(
        0.08,
        0.18,
        0.08,
        s.sx,
        s.sy + 0.05,
        s.sz + 0.12,
        this.materials.loungeWool,
        false
      );
      // Glowing orange flame
      this._buildBox(
        0.04,
        0.08,
        0.04,
        s.sx,
        s.sy + 0.16,
        s.sz + 0.12,
        this.materials.glowOrange,
        false
      );
    });
  }

  /**
   * Builds the exterior velvet VIP rope queues.
   */
  _buildExteriorQueue() {
    // 1. Shrunk VIP Post and Ropes system guiding queue on the left side of entry
    const postZ = -2.8;
    const ropeH = 0.85;

    // Spawn 3 barrier pillars (Gold Cylinders) on the narrower sidewalk
    for (let px = -10.0; px <= -5.0; px += 2.5) {
      // Base
      this._buildCylinder(0.14, 0.14, 0.05, px, 0.025, postZ, this.materials.goldMetal, true);
      // Rod
      this._buildCylinder(0.04, 0.04, 1.0, px, 0.5, postZ, this.materials.goldMetal, true);
      // Top ball
      const ballGeo = new THREE.SphereGeometry(0.07, 8, 8);
      const ballMesh = new THREE.Mesh(ballGeo, this.materials.goldMetal);
      ballMesh.position.set(px, 1.04, postZ);
      this.scene.add(ballMesh);
    }

    // Hang velvet ropes between posts
    for (let rx = -8.75; rx <= -6.25; rx += 2.5) {
      this._buildBox(2.4, 0.06, 0.06, rx, ropeH, postZ, this.materials.velvetRope, false);
    }

    // 2. Doorman's Mahogany Podium (placed at entrance x = -6, z = -3.5)
    this._buildBox(0.8, 1.1, 0.8, -6.5, 0.55, -3.5, this.materials.mahogany, true);

    // --- Street Accessories (Phase 7 - Part 2) ---
    // A. Red Fire Hydrant
    const hydrantX = -9.2;
    const hydrantZ = -11.0;
    this._buildBox(0.3, 0.6, 0.3, hydrantX, 0.3, hydrantZ, this.materials.fireBrick, true);
    this._buildBox(0.2, 0.1, 0.2, hydrantX, 0.65, hydrantZ, this.materials.goldMetal, false);
    this._buildBox(0.1, 0.12, 0.12, hydrantX - 0.2, 0.4, hydrantZ, this.materials.goldMetal, false);
    this._buildBox(0.1, 0.12, 0.12, hydrantX + 0.2, 0.4, hydrantZ, this.materials.goldMetal, false);

    // B. Wooden Waste Bin
    const canX = -9.2;
    const canZ = 11.0;
    this._buildBox(0.5, 0.8, 0.5, canX, 0.4, canZ, this.materials.rusticOak, true);
    this._buildBox(0.55, 0.08, 0.55, canX, 0.84, canZ, this.materials.mahogany, false);
    this._buildBox(0.15, 0.06, 0.06, canX, 0.91, canZ, this.materials.goldMetal, false);

    // C. Parked 1960s Classic Luxury Sedan
    this._buildClassicCar();
  }

  /**
   * Erects concrete support columns on the dance floor.
   */
  _buildPillars() {
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x111116,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Two big square support columns separating lounge opening from center floor
    this._buildBox(1.2, 5.0, 1.2, 6.0, 2.5, -9.5, pMat, true);
    this._buildBox(1.2, 5.0, 1.2, 15.0, 2.5, -9.5, pMat, true);
  }

  /**
   * Creates glowing sign fixtures and poster boards on the walls.
   */
  _buildDecorations() {
    // Posters stuck inside corridor
    const posterMat1 = new THREE.MeshStandardMaterial({
      map: TextureGenerator.generatePoster('LOUNGE', 128),
    });
    const posterMat2 = new THREE.MeshStandardMaterial({
      map: TextureGenerator.generatePoster('VIP', 128),
    });
    const posterMat3 = new THREE.MeshStandardMaterial({
      map: TextureGenerator.generatePoster('ACOUSTIC', 128),
    });

    // Wall at x = 1.0 (Lobby divider) gets a poster on the lobby side
    this._buildBox(0.05, 1.5, 1.2, 0.55, 1.8, -7.0, posterMat1, false);
    this._buildBox(0.05, 1.5, 1.2, 0.55, 1.8, 7.0, posterMat2, false);

    // Lounge back wall face (z = -20.5) gets a poster
    this._buildBox(1.2, 1.5, 0.05, 11.0, 2.0, -20.475, posterMat3, false);
  }

  /**
   * Furnishes the Lobby Cloakroom area with counter, shelves, coat hooks, hangers, bench and plants.
   */
  _buildCloakroom() {
    // 1. Wood/Gold Reception Desk
    this._buildClimbableBox(1.0, 1.1, 3.2, -1.6, 0.55, 6.0, this.materials.mahogany, true);
    this._buildBox(1.0, 0.05, 3.2, -1.6, 1.125, 6.0, this.materials.goldMetal, false);

    // 2. Coat shelving unit behind the desk (against partition wall face x = 0.6)
    this._buildBox(0.4, 2.4, 4.0, 0.4, 1.2, 6.0, this.materials.rusticOak, true);

    // Spawn cozy folded warm-toned wool jackets inside the shelves
    for (let sy = 0.3; sy <= 2.1; sy += 0.6) {
      for (let sz = 4.4; sz <= 7.6; sz += 0.6) {
        if (this.random() > 0.2) {
          const jacketMat =
            this.jacketMaterials[Math.floor(this.random() * this.jacketMaterials.length)];
          this._buildBox(0.08, 0.35, 0.45, 0.12, sy + 0.175, sz, jacketMat, false);
        }
      }
    }

    // 3. Cozy bench seating along the opposite wall
    this._buildClimbableBox(0.8, 0.3, 3.0, -4.2, 0.15, 6.0, this.materials.woodTable, true);
    // Cozy wool cushions
    this._buildBox(0.7, 0.15, 2.8, -4.2, 0.375, 6.0, this.materials.loungeWool, false);

    // 4. Potted voxel plants in the corners
    const plantSpots = [
      { px: -4.2, pz: 13.0 },
      { px: -4.2, pz: -13.0 },
    ];
    plantSpots.forEach((spot) => {
      // Clay pot
      this._buildBox(0.45, 0.5, 0.45, spot.px, 0.25, spot.pz, this.materials.potClay, true);
      // Main leafy bush
      this._buildBox(0.35, 0.7, 0.35, spot.px, 0.85, spot.pz, this.materials.plantGreen, false);
      // Small top block to taper it
      this._buildBox(0.2, 0.25, 0.2, spot.px, 1.325, spot.pz, this.materials.plantGreen, false);
    });

    // 5. Cozy golden-lit "COATS" Sign on the back partition wall face
    const signX = 0.58;
    const signY = 2.8;
    const signZ = 6.0;
    // Wood backboard
    this._buildBox(0.04, 0.6, 1.5, signX, signY, signZ, this.materials.rusticOak, false);
    // Glowing center bar (warm amber)
    this._buildBox(0.02, 0.4, 1.3, signX - 0.02, signY, signZ, this.materials.glowOrange, false);

    // 6. Cozy hanging brass lanterns (rod, casing, and glowing glass)
    // Lantern 1 above the reception desk (centered at z = 6.0, near desk)
    this._buildBox(0.04, 0.6, 0.04, -1.6, 4.5, 6.0, this.materials.goldMetal, false); // rod/chain
    this._buildBox(0.2, 0.35, 0.2, -1.6, 4.0, 6.0, this.materials.goldMetal, false); // casing
    this._buildBox(0.14, 0.2, 0.14, -1.6, 4.0, 6.0, this.materials.glowOrange, false); // glowing pane

    // Lantern 2 above the seating bench (centered at z = 6.0, near bench)
    this._buildBox(0.04, 0.6, 0.04, -4.2, 4.5, 6.0, this.materials.goldMetal, false); // rod/chain
    this._buildBox(0.2, 0.35, 0.2, -4.2, 4.0, 6.0, this.materials.goldMetal, false); // casing
    this._buildBox(0.14, 0.2, 0.14, -4.2, 4.0, 6.0, this.materials.glowOrange, false); // glowing pane
  }

  /**
   * Assembles a beautiful 1960s classic luxury sedan in British racing green with gold/chrome trims.
   */
  _buildClassicCar() {
    const tx = -13.5;
    const tz = -7.0;
    const ty = -0.15; // Road level is -0.15

    // A. Main lower chassis (black/chrome trims)
    this._buildBox(1.9, 0.15, 4.2, tx, ty + 0.175, tz, this.materials.taxiBlack, false, true, true);
    // Chrome bumpers
    this._buildBox(1.8, 0.12, 0.15, tx, ty + 0.175, tz - 2.12, this.materials.chrome, false);
    this._buildBox(1.8, 0.12, 0.15, tx, ty + 0.175, tz + 2.12, this.materials.chrome, false);

    // B. Middle body (British racing green)
    this._buildBox(
      1.9,
      0.55,
      4.0,
      tx,
      ty + 0.525,
      tz,
      this.materials.racingGreen,
      false,
      true,
      true
    );

    // C. Upper Cabin / Windshield (black glass / chrome trim framing)
    this._buildBox(
      1.7,
      0.45,
      2.2,
      tx,
      ty + 1.025,
      tz - 0.1,
      this.materials.taxiBlack,
      false,
      true,
      true
    );

    // D. Wheel arches & Wheels with Chrome Hubcaps
    const wheelW = 0.35;
    const wheelH = 0.55;
    const wheelD = 0.55;
    const wheelOffsetZ = 1.2;
    const wheelOffsetX = 0.95;

    // Front-left
    this._buildBox(
      wheelW,
      wheelH,
      wheelD,
      tx - wheelOffsetX,
      ty + 0.275,
      tz - wheelOffsetZ,
      this.materials.taxiBlack,
      false
    );
    this._buildBox(
      0.04,
      0.3,
      0.3,
      tx - wheelOffsetX - 0.16,
      ty + 0.275,
      tz - wheelOffsetZ,
      this.materials.chrome,
      false
    );
    // Front-right
    this._buildBox(
      wheelW,
      wheelH,
      wheelD,
      tx + wheelOffsetX,
      ty + 0.275,
      tz - wheelOffsetZ,
      this.materials.taxiBlack,
      false
    );
    this._buildBox(
      0.04,
      0.3,
      0.3,
      tx + wheelOffsetX + 0.16,
      ty + 0.275,
      tz - wheelOffsetZ,
      this.materials.chrome,
      false
    );
    // Rear-left
    this._buildBox(
      wheelW,
      wheelH,
      wheelD,
      tx - wheelOffsetX,
      ty + 0.275,
      tz + wheelOffsetZ,
      this.materials.taxiBlack,
      false
    );
    this._buildBox(
      0.04,
      0.3,
      0.3,
      tx - wheelOffsetX - 0.16,
      ty + 0.275,
      tz + wheelOffsetZ,
      this.materials.chrome,
      false
    );
    // Rear-right
    this._buildBox(
      wheelW,
      wheelH,
      wheelD,
      tx + wheelOffsetX,
      ty + 0.275,
      tz + wheelOffsetZ,
      this.materials.taxiBlack,
      false
    );
    this._buildBox(
      0.04,
      0.3,
      0.3,
      tx + wheelOffsetX + 0.16,
      ty + 0.275,
      tz + wheelOffsetZ,
      this.materials.chrome,
      false
    );

    // E. Elegant Gold Pinstripes / Beltlines
    const stripY = ty + 0.58;
    this._buildBox(
      0.02,
      0.05,
      3.8,
      tx - 0.96,
      stripY,
      tz,
      this.materials.goldTrim,
      false,
      false,
      true
    );
    this._buildBox(
      0.02,
      0.05,
      3.8,
      tx + 0.96,
      stripY,
      tz,
      this.materials.goldTrim,
      false,
      false,
      true
    );

    // F. Classic Chrome Grille (front)
    this._buildBox(0.7, 0.45, 0.08, tx, ty + 0.425, tz - 2.02, this.materials.chrome, false);

    // G. Glowing Headlights (warm candle white glass-bulb style) at the front
    const headlightZ = tz - 2.02;
    const headlightY = ty + 0.45;
    this._buildBox(
      0.2,
      0.2,
      0.05,
      tx - 0.6,
      headlightY,
      headlightZ,
      this.materials.candleGoldGlow,
      false
    );
    this._buildBox(
      0.2,
      0.2,
      0.05,
      tx + 0.6,
      headlightY,
      headlightZ,
      this.materials.candleGoldGlow,
      false
    );

    // H. Glowing Taillights (red) at the rear
    const taillightZ = tz + 2.02;
    const taillightY = ty + 0.45;
    this._buildBox(
      0.2,
      0.12,
      0.05,
      tx - 0.6,
      taillightY,
      taillightZ,
      this.materials.glowRed,
      false
    );
    this._buildBox(
      0.2,
      0.12,
      0.05,
      tx + 0.6,
      taillightY,
      taillightZ,
      this.materials.glowRed,
      false
    );

    // I. Register full vehicle in physical collision engine using single snug sliding bounding box
    const minPt = new THREE.Vector3(tx - 1.1, ty, tz - 2.2);
    const maxPt = new THREE.Vector3(tx + 1.1, ty + 1.5, tz + 2.2);
    const taxiBbox = new THREE.Box3(minPt, maxPt);
    this.controls.registerCollisionBox(taxiBbox);
  }

  /**
   * Constructs a beautiful, enclosing wooden paneled ceiling with exposed oak timber rafters.
   */
  _buildRoof() {
    const ceilingY = 5.0;
    const thickness = 0.15;
    const ceilingMat = this.materials.rusticOak;
    const beamMat = this.materials.rusticOak;
    const beamDepth = 0.3;
    const beamWidth = 0.15;

    // 1. Lobby & Cloakroom Ceiling Slab (x: -4.8 to 1.0, z: -15.0 to 15.0)
    // Width = 5.8, Depth = 30.0, Center = (-1.9, 5.075, 0)
    this._buildBox(
      5.8,
      thickness,
      30.0,
      -1.9,
      ceilingY + thickness / 2,
      0,
      ceilingMat,
      false,
      true,
      true
    );

    // 2. Main Acoustic Hall & Bar Ceiling Slab (x: 1.0 to 20.0, z: -10.5 to 11.0)
    // Width = 19.0, Depth = 21.5, Center = (10.5, 5.075, 0.25)
    this._buildBox(
      19.0,
      thickness,
      21.5,
      10.5,
      ceilingY + thickness / 2,
      0.25,
      ceilingMat,
      false,
      true,
      true
    );

    // 3. Chillout Lounge Ceiling Slab (x: 6.0 to 20.0, z: -21.0 to -10.5)
    // Width = 14.0, Depth = 10.5, Center = (13.0, 5.075, -15.75)
    this._buildBox(
      14.0,
      thickness,
      10.5,
      13.0,
      ceilingY + thickness / 2,
      -15.75,
      ceilingMat,
      false,
      true,
      true
    );

    // 4. Exposed Oak Timber Rafters / Beams running across the rooms
    // A. Lobby Beams (X-aligned, spaced every 3.0m along Z)
    for (let z = -12.0; z <= 12.0; z += 3.0) {
      this._buildBox(
        5.8,
        beamDepth,
        beamWidth,
        -1.9,
        ceilingY - beamDepth / 2,
        z,
        beamMat,
        false,
        true,
        true
      );
    }

    // B. Main Acoustic Hall Beams (X-aligned, spaced every 2.5m along Z)
    for (let z = -10.0; z <= 10.0; z += 2.5) {
      this._buildBox(
        19.0,
        beamDepth,
        beamWidth,
        10.5,
        ceilingY - beamDepth / 2,
        z,
        beamMat,
        false,
        true,
        true
      );
    }

    // C. Chillout Lounge Beams (Z-aligned, spaced every 2.5m along X)
    for (let x = 7.5; x <= 18.5; x += 2.5) {
      this._buildBox(
        beamWidth,
        beamDepth,
        10.5,
        x,
        ceilingY - beamDepth / 2,
        -15.75,
        beamMat,
        false,
        true,
        true
      );
    }
  }
}

import * as THREE from 'three';
import { TextureGenerator } from '../utils/TextureGenerator.js';

export class NPCManager {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.playerPushRadius = 0.76;
    this.playerPushStrength = 1.25;
    this.npcCrowdRadius = 0.58;
    this._lastPlayerPos = null;

    // Pre-allocate shared NPC geometries to optimize draw calls and GPU vertex buffer uploads
    this.torsoGeo = new THREE.BoxGeometry(0.44, 0.6, 0.24);
    this.headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.30);
    this.armGeo = new THREE.BoxGeometry(0.1, 0.44, 0.1);
    this.handGeo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
    this.legGeo = new THREE.BoxGeometry(0.15, 0.52, 0.15);
    this.shoeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.2);

    // Pre-allocate shared shoe material
    this.shoeMat = new THREE.MeshStandardMaterial({ color: 0x1d1a15, roughness: 0.8 });

    // Pre-allocate shared drink accessory geometry and material
    this.glassGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 4);
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff9922,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      metalness: 0.95
    });

    // Preset list of safe social mingle spots where NPCs gather
    this.mingleSpots = [
      { x: 5.5, z: -1.0 },   // Bar Chatters Area
      { x: 12.0, z: -17.0 }, // Fireplace Chatters Area
      { x: 8.5, z: -2.5 },   // Parquet Groovers Area
      { x: -1.5, z: -4.0 }   // Lobby Relaxers Area
    ];

    this.npcs = [];
    this._spawnAllNPCs();
  }

  /**
   * Spawns all cozy visitors and staff across various zones of the venue.
   */
  _spawnAllNPCs() {
    // 1. Spawning 12 Lounge Patrons grouped in conversation circles around mingle spots
    for (let i = 0; i < 12; i++) {
      const spotIdx = i % 4;
      const spot = this.mingleSpots[spotIdx];
      const memberIdx = Math.floor(i / 4); // 0, 1, or 2 for each spot group

      // Arrange in a circle around the mingle spot center
      const angle = (memberIdx * (Math.PI * 2 / 3)) + Math.random() * 0.15;
      const radius = 0.65 + Math.random() * 0.15;
      const x = spot.x + Math.cos(angle) * radius;
      const z = spot.z + Math.sin(angle) * radius;
      
      const skinColor = this._getRandomSkin();
      const suitColor = this._getRandomCozyColor();
      const stripeColor = this._getRandomCozyColor(suitColor);
      const clothingType = ['jacket', 'stripes', 'checker'][Math.floor(Math.random() * 3)];
      const hasGlasses = Math.random() > 0.4;
      const glassesColor = hasGlasses ? '#d4af37' : null; // Gold rims spectacles instead of neon visors

      const npc = this._createVoxelCharacter(skinColor, suitColor, stripeColor, clothingType, glassesColor);
      npc.group.position.set(x, 0, z);
      
      // Compute rotation to face the center of the mingle spot
      const dx = spot.x - x;
      const dz = spot.z - z;
      const faceAngle = Math.atan2(-dx, -dz);
      npc.group.rotation.y = faceAngle;
      npc.baseRotationY = faceAngle;

      // Assign state machine properties
      npc.isWanderer = (i % 4 === 0); // 3 out of 12 patrons are wanderers
      npc.state = 'standing';
      npc.targetPos = null;
      npc.lastMingleTime = performance.now() * 0.001 + Math.random() * 10.0;

      // Assign randomized cozy lounge movement routine
      npc.danceType = Math.floor(Math.random() * 4); // 0 to 3
      npc.dancePhase = Math.random() * Math.PI * 2;
      npc.danceSpeed = 0.7 + Math.random() * 0.4; // slower, relaxing motions
      npc.walkSpeed = 0.85 + Math.random() * 0.35;

      // Subtle scaling variations for character heights
      const scale = 0.85 + Math.random() * 0.2;
      npc.group.scale.set(scale, scale, scale);
      npc.state = 'standing';
      npc.bodyRadius = 0.34 * scale;
      npc.collisionRadius = this.npcCrowdRadius * scale;
      npc.pushRadius = this.playerPushRadius * scale;
      npc.pushWeight = 0.45;
      npc.canBePushed = true;

      // Attach Drink Accessories: 4 select lounge patrons get glasses
      if (i < 4) {
        this._attachDrinkGlass(npc, 'rightArm');
        // Raise right arm slightly to hold glass
        npc.joints.rightArm.rotation.x = -0.5;
        npc.joints.rightArm.rotation.z = -0.1;
      }

      this.scene.add(npc.group);
      this.npcs.push(npc);
    }

    // 2. Spawn 1 Doorman outside guarding the entrance portal (x: -5.8, z: -1.8)
    const doorman = this._createVoxelCharacter('#f2ab7e', '#1c1c24', '#282833', 'jacket', '#d4af37'); // Charcoal grey suit, gold spectacles
    doorman.group.position.set(-5.8, 0, -1.8);
    doorman.group.rotation.y = Math.PI / 2; // Face towards the exterior queue
    doorman.danceType = -1; // Static folded arms doorman pose!
    doorman.baseRotationY = Math.PI / 2;
    doorman.canBePushed = true;
    doorman.bodyRadius = 0.35;
    doorman.collisionRadius = 0.55;
    doorman.pushRadius = 0.82;
    doorman.pushWeight = 0.8;
    
    // Cross arms doorman pose
    doorman.joints.leftArm.rotation.z = -1.1;
    doorman.joints.leftArm.rotation.y = 0.5;
    doorman.joints.rightArm.rotation.z = 1.1;
    doorman.joints.rightArm.rotation.y = -0.5;

    this.scene.add(doorman.group);
    this.npcs.push(doorman);

    // 3. Spawn 2 Bar Patrons seated on stools (x: 7.2 & 11.4, z: 5.8)
    const stoolPositions = [7.2, 11.4];
    stoolPositions.forEach(px => {
      const skin = this._getRandomSkin();
      const col = this._getRandomCozyColor();
      const patron = this._createVoxelCharacter(skin, col, '#1a1815', 'stripes', Math.random() > 0.5 ? '#d4af37' : null);
      
      // Sit on bar stool height (0.65)
      patron.group.position.set(px, 0.65, 5.8);
      patron.group.rotation.y = Math.PI; // Look towards bar counter (+Z)
      patron.danceType = -2; // Seated chatting/drinking pose
      patron.baseRotationY = Math.PI;
      patron.canBePushed = true;
      patron.pushWeight = 0.15;
      patron.isSeated = true;
      patron.bodyRadius = 0.30;
      patron.collisionRadius = 0.52;
      patron.pushRadius = 0.76;
      
      // Pivot legs forward to sit down
      patron.joints.leftLeg.rotation.x = -1.3;
      patron.joints.rightLeg.rotation.x = -1.3;
      // Hold a cocktail/whiskey (represented by raising right hand)
      patron.joints.rightArm.rotation.x = -0.8;
      patron.joints.rightArm.rotation.z = -0.2;

      // Attach glowing whiskey glass to hand!
      this._attachDrinkGlass(patron, 'rightArm');

      this.scene.add(patron.group);
      this.npcs.push(patron);
    });

    // 4. Spawn 1 Music Selector inside the turntable booth (x: 18.2, z: 0)
    const selector = this._createVoxelCharacter('#f3be8a', '#1e1c18', '#8a523f', 'jacket', '#d4af37'); // Warm wood brown jacket, gold spectacles
    selector.group.position.set(18.2, 0.45, 0); // elevated booth stage
    selector.group.rotation.y = -Math.PI / 2; // Face the floor (-X)
    selector.danceType = 99; // Selector special vinyl platters twisting animation!
    selector.baseRotationY = -Math.PI / 2;
    selector.canBePushed = true;
    selector.pushWeight = 0.35;
    selector.bodyRadius = 0.34;
    selector.collisionRadius = 0.56;
    selector.pushRadius = 0.78;
    
    this.scene.add(selector.group);
    this.npcs.push(selector);

    // 5. Spawn 1 Bartender behind the counter (x: 9.0, z: 8.8) facing -Z (rotation.y = 0)
    const skin = '#fcd2a1';
    const suit = '#1c284f'; // navy blue
    const bartender = this._createVoxelCharacter(skin, suit, '#255232', 'jacket', null);
    bartender.group.position.set(9.0, 0, 8.8);
    bartender.group.rotation.y = 0; // Face -Z
    bartender.danceType = 50; // Special Bartender glass-polishing / counter-wiping state
    bartender.dancePhase = Math.random() * Math.PI * 2;
    bartender.danceSpeed = 0.8;
    bartender.baseRotationY = 0;
    bartender.canBePushed = true;
    bartender.pushWeight = 0.28;
    bartender.bodyRadius = 0.32;
    bartender.collisionRadius = 0.54;
    bartender.pushRadius = 0.76;

    // Give bartender a drink glass to polish!
    this._attachDrinkGlass(bartender, 'leftArm');

    this.scene.add(bartender.group);
    this.npcs.push(bartender);
  }

  /**
   * Helper to construct a hierarchical voxel puppet with pivot joints.
   */
  _createVoxelCharacter(skinColor, suitColor, stripeColor, clothingType, glassesColor) {
    const group = new THREE.Group();

    // 1. Core Materials
    const faceTex = TextureGenerator.generateNPCFace(skinColor, '#110a08', glassesColor, 64);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

    const outfitTex = TextureGenerator.generateNPCOutfit(suitColor, stripeColor, clothingType, 64);
    const torsoMat = new THREE.MeshStandardMaterial({ map: outfitTex, roughness: 0.8 });

    const pantsTex = TextureGenerator.generateNPCOutfit('#1e1612', '#2c221a', 'pants', 64);
    const legsMat = new THREE.MeshStandardMaterial({ map: pantsTex, roughness: 0.8 });

    const limbSkinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

    const joints = {};

    // 2. Torso Box (x: -0.22 to 0.22, y: 0.6 to 1.2)
    const torsoMesh = new THREE.Mesh(this.torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.9, 0);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    // 3. Head Box (centered at y = 1.35)
    // Pivot joint for head tilt
    joints.head = new THREE.Group();
    joints.head.position.set(0, 1.2, 0);
    
    const headMesh = new THREE.Mesh(this.headGeo, headMat);
    headMesh.position.set(0, 0.16, 0); // offset origin to bottom neck pivot
    headMesh.castShadow = true;
    joints.head.add(headMesh);

    // Render the face as a small pixel-art panel on the local forward side (+Z).
    // This avoids BoxGeometry material-index ambiguity and keeps every character's
    // face locked to the front of the body regardless of world rotation.
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.28), faceMat);
    faceMesh.position.set(0, 0.16, 0.153);
    faceMesh.castShadow = false;
    joints.head.add(faceMesh);
    group.add(joints.head);

    // 4. Arms Joints and Meshes
    // --- Left Arm Joint (Pivot at shoulder x: -0.26, y: 1.15) ---
    joints.leftArm = new THREE.Group();
    joints.leftArm.position.set(-0.26, 1.15, 0);
    
    const leftArmMesh = new THREE.Mesh(this.armGeo, torsoMat);
    leftArmMesh.position.set(0, -0.22, 0); // hang down from shoulder pivot
    leftArmMesh.castShadow = true;
    joints.leftArm.add(leftArmMesh);
    
    // Slap skin hand on arm bottom
    const leftHand = new THREE.Mesh(this.handGeo, limbSkinMat);
    leftHand.position.set(0, -0.46, 0);
    joints.leftArm.add(leftHand);
    group.add(joints.leftArm);

    // --- Right Arm Joint (Pivot at shoulder x: 0.26, y: 1.15) ---
    joints.rightArm = new THREE.Group();
    joints.rightArm.position.set(0.26, 1.15, 0);
    
    const rightArmMesh = new THREE.Mesh(this.armGeo, torsoMat);
    rightArmMesh.position.set(0, -0.22, 0); // hang down
    rightArmMesh.castShadow = true;
    joints.rightArm.add(rightArmMesh);

    const rightHand = new THREE.Mesh(this.handGeo, limbSkinMat);
    rightHand.position.set(0, -0.46, 0);
    joints.rightArm.add(rightHand);
    group.add(joints.rightArm);

    // 5. Legs Joints and Meshes
    // --- Left Leg Joint (Pivot at hip x: -0.11, y: 0.6) ---
    joints.leftLeg = new THREE.Group();
    joints.leftLeg.position.set(-0.11, 0.6, 0);

    const leftLegMesh = new THREE.Mesh(this.legGeo, legsMat);
    leftLegMesh.position.set(0, -0.26, 0); // hang down from hip pivot
    leftLegMesh.castShadow = true;
    joints.leftLeg.add(leftLegMesh);

    // Shoe box
    const leftShoe = new THREE.Mesh(this.shoeGeo, this.shoeMat);
    leftShoe.position.set(0, -0.54, 0.025);
    joints.leftLeg.add(leftShoe);
    group.add(joints.leftLeg);

    // --- Right Leg Joint (Pivot at hip x: 0.11, y: 0.6) ---
    joints.rightLeg = new THREE.Group();
    joints.rightLeg.position.set(0.11, 0.6, 0);

    const rightLegMesh = new THREE.Mesh(this.legGeo, legsMat);
    rightLegMesh.position.set(0, -0.26, 0); // hang down
    rightLegMesh.castShadow = true;
    joints.rightLeg.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(this.shoeGeo, this.shoeMat);
    rightShoe.position.set(0, -0.54, 0.025);
    joints.rightLeg.add(rightShoe);
    group.add(joints.rightLeg);

    return { group, joints };
  }

  /**
   * Helper to attach a procedural voxel drink glass to a character joint.
   */
  _attachDrinkGlass(npc, armName) {
    if (!npc.joints[armName]) return;
    const glass = new THREE.Mesh(this.glassGeo, this.glassMat);
    // position in voxel palm, offset forward slightly
    glass.position.set(0, -0.52, 0.05);
    npc.joints[armName].add(glass);
  }

  /**
   * Animates arms, legs and hips dynamically matching acoustic tempo.
   */
  update(dt, playerPos) {
    const time = performance.now() * 0.001;
    const isBeat = this.audio.isBeatHit;
    let playerVelX = 0;
    let playerVelZ = 0;
    let playerSpeed = 0;
    if (playerPos && this._lastPlayerPos) {
      playerVelX = playerPos.x - this._lastPlayerPos.x;
      playerVelZ = playerPos.z - this._lastPlayerPos.z;
      playerSpeed = Math.sqrt(playerVelX * playerVelX + playerVelZ * playerVelZ) / Math.max(dt, 0.0001);
    }

    if (playerPos) {
      this._lastPlayerPos = { x: playerPos.x, z: playerPos.z };
    }

    if (playerPos) {
      this.npcs.forEach(npc => this._applyPlayerPush(npc, playerPos, playerVelX, playerVelZ, playerSpeed, dt));
      this._resolveNpcCrowding(dt);
    }

    // Calculate a smooth decay-based beat intensity that spikes on drum kicks
    const decay = 1 - Math.exp(-8.0 * dt);
    if (isBeat) {
      this.beatIntensity = 1.0;
    } else {
      this.beatIntensity = (this.beatIntensity || 0) + (0.0 - (this.beatIntensity || 0)) * decay;
    }

    this.npcs.forEach(npc => {
      // 1. DOORMAN (case -1)
      if (npc.danceType === -1) {
        let isLooking = false;
        if (playerPos) {
          const dx = playerPos.x - npc.group.position.x;
          const dz = playerPos.z - npc.group.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 2.5) {
            isLooking = true;
            const targetGlobalAngle = Math.atan2(-dx, -dz);
            let targetHeadY = targetGlobalAngle - npc.group.rotation.y;
            targetHeadY = Math.atan2(Math.sin(targetHeadY), Math.cos(targetHeadY));
            targetHeadY = Math.max(-1.3, Math.min(1.3, targetHeadY));
            npc.joints.head.rotation.y += (targetHeadY - npc.joints.head.rotation.y) * 8.0 * dt;
          }
        }
        if (!isLooking) {
          npc.joints.head.rotation.y += (0.0 - npc.joints.head.rotation.y) * 4.0 * dt;
        }
        return;
      }

      // 2. BARTENDER (case 50)
      if (npc.danceType === 50) {
        // Slow breathing bob and subtle hip sway
        npc.group.position.y = Math.sin(time * 1.5) * 0.01;
        npc.group.rotation.y = npc.baseRotationY + Math.sin(time * 0.5) * 0.05;

        // Arm polishing routine: left arm holds glass, right arm rubs it
        npc.joints.leftArm.rotation.x = -0.9 + Math.sin(time * 2.0) * 0.05;
        npc.joints.leftArm.rotation.y = 0.3;
        npc.joints.leftArm.rotation.z = -0.2;

        npc.joints.rightArm.rotation.x = -1.0 + Math.sin(time * 10.0) * 0.15;
        npc.joints.rightArm.rotation.y = -0.4;
        npc.joints.rightArm.rotation.z = 0.1;

        npc.joints.head.rotation.x = 0.25 + Math.sin(time * 1.5) * 0.05;
        npc.joints.head.rotation.y = Math.sin(time * 0.5) * 0.08;
        return;
      }

      // 3. VINYL MUSIC SELECTOR TURNTABLE ANIMS (case 99)
      if (npc.danceType === 99) {
        const bobSpeed = 3.5;
        npc.group.position.y = 0.45 + Math.abs(Math.sin(time * bobSpeed)) * 0.04 + this.beatIntensity * 0.06;
        npc.joints.head.rotation.x = Math.sin(time * bobSpeed) * 0.08 + this.beatIntensity * 0.22;

        npc.joints.leftArm.rotation.x = -0.8 + Math.sin(time * 1.5) * 0.15 - this.beatIntensity * 0.25;
        npc.joints.leftArm.rotation.y = -0.15 + Math.sin(time * 0.8) * 0.1;
        
        npc.joints.rightArm.rotation.x = -0.8 + Math.cos(time * 1.2) * 0.15 - this.beatIntensity * 0.25;
        npc.joints.rightArm.rotation.y = 0.15 + Math.cos(time * 0.6) * 0.1;
        return;
      }

      // --- WALK / STATE MACHINE FOR LOUNGE PATRONS (if wanderer) ---
      let isWalking = false;
      if (npc.isWanderer) {
        if (!npc.state) npc.state = 'standing';
        if (!npc.lastMingleTime) npc.lastMingleTime = time + Math.random() * 15;

        if (npc.state === 'walking') {
          isWalking = true;
          const target = npc.targetPos;
          const currentPos = npc.group.position;
          
          const dx = target.x - currentPos.x;
          const dz = target.z - currentPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist > 0.15) {
            const moveDirX = dx / dist;
            const moveDirZ = dz / dist;
            const moveSpeed = npc.walkSpeed || 1.0; // realistic walking pace
            
            currentPos.x += moveDirX * moveSpeed * dt;
            currentPos.z += moveDirZ * moveSpeed * dt;
            
            const walkAngle = Math.atan2(-moveDirX, -moveDirZ);
            // Smoothly interpolate rotation to match walk direction
            let diff = walkAngle - npc.group.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            npc.group.rotation.y += diff * 10.0 * dt;
            npc.baseRotationY = npc.group.rotation.y;
            
            // Leg & Arm swings (opposite swing)
            const swingSpeed = 7.2;
            npc.joints.leftLeg.rotation.x = Math.sin(time * swingSpeed) * 0.45;
            npc.joints.rightLeg.rotation.x = -Math.sin(time * swingSpeed) * 0.45;
            
            // Keep arm holding drink steady if they have drink, swing left arm
            if (npc.joints.rightArm.children.length > 2) {
              npc.joints.leftArm.rotation.x = -Math.sin(time * swingSpeed) * 0.45;
              npc.joints.rightArm.rotation.x = -0.5 + Math.sin(time * swingSpeed) * 0.08;
              npc.joints.rightArm.rotation.z = -0.1;
            } else {
              npc.joints.leftArm.rotation.x = -Math.sin(time * swingSpeed) * 0.45;
              npc.joints.rightArm.rotation.x = Math.sin(time * swingSpeed) * 0.45;
            }
          } else {
            npc.state = 'standing';
            npc.lastMingleTime = time;
            npc.targetPos = null;
            
            // Reset legs to straight standing pose
            npc.joints.leftLeg.rotation.x = 0;
            npc.joints.rightLeg.rotation.x = 0;
            npc.joints.leftLeg.rotation.y = 0;
            npc.joints.rightLeg.rotation.y = 0;
            
            // Look up which spot we reached and set faceAngle
            const spotIdx = this.mingleSpots.findIndex(spot => {
              const sdx = spot.x - currentPos.x;
              const sdz = spot.z - currentPos.z;
              return Math.sqrt(sdx * sdx + sdz * sdz) < 1.6;
            });
            if (spotIdx !== -1) {
              const spot = this.mingleSpots[spotIdx];
              const angle = Math.atan2(-(spot.x - currentPos.x), -(spot.z - currentPos.z)) + (Math.random() - 0.5) * 0.4;
              npc.baseRotationY = angle;
              npc.group.rotation.y = angle;
            }
          }
        } else {
          // Standing: Check if it's time to wander/mingle
          if (time - npc.lastMingleTime > 20 + Math.random() * 15) {
            const currentSpotIdx = this.mingleSpots.findIndex(spot => {
              const sdx = spot.x - npc.group.position.x;
              const sdz = spot.z - npc.group.position.z;
              return Math.sqrt(sdx * sdx + sdz * sdz) < 1.6;
            });
            
            let nextSpotIdx = Math.floor(Math.random() * this.mingleSpots.length);
            if (nextSpotIdx === currentSpotIdx) {
              nextSpotIdx = (nextSpotIdx + 1) % this.mingleSpots.length;
            }
            
            const destSpot = this.mingleSpots[nextSpotIdx];
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.5 + Math.random() * 0.35;
            npc.targetPos = new THREE.Vector3(
              destSpot.x + Math.cos(angle) * radius,
              0,
              destSpot.z + Math.sin(angle) * radius
            );
            npc.state = 'walking';
          }
        }
      }

      // --- PLAYER PROXIMITY DETECTION & EYE CONTACT / WAVING ---
      let isLookingAtPlayer = false;
      let isWavingAtPlayer = false;
      let dist = 999.0;
      let dx = 0, dz = 0;

      if (playerPos) {
        dx = playerPos.x - npc.group.position.x;
        dz = playerPos.z - npc.group.position.z;
        dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2.5) {
          isLookingAtPlayer = true;
          if (dist < 1.8) {
            isWavingAtPlayer = true;
          }
        }
      }

      // Smooth pivot towards player
      if (isLookingAtPlayer) {
        const targetGlobalAngle = Math.atan2(-dx, -dz);
        let targetHeadY = targetGlobalAngle - npc.group.rotation.y;
        targetHeadY = Math.atan2(Math.sin(targetHeadY), Math.cos(targetHeadY));
        
        // Clamp to logical neck limit +/- 75 deg (1.3 radians)
        targetHeadY = Math.max(-1.3, Math.min(1.3, targetHeadY));
        npc.joints.head.rotation.y += (targetHeadY - npc.joints.head.rotation.y) * 8.0 * dt;
        
        // Look up slightly (player camera is at y=1.7m, NPC head is at ~1.35m)
        const targetHeadX = -0.15;
        npc.joints.head.rotation.x += (targetHeadX - npc.joints.head.rotation.x) * 8.0 * dt;

        if (npc.danceType >= 0 && !isWalking && !npc.isSeated) {
          npc.group.rotation.y += ((targetGlobalAngle - npc.group.rotation.y) * 3.0 * dt);
          npc.baseRotationY = npc.group.rotation.y;
        }
      } else {
        // Return head to center smoothly if walking or standing (or let the dance loop handle it)
        if (isWalking) {
          npc.joints.head.rotation.y += (0 - npc.joints.head.rotation.y) * 5.0 * dt;
          npc.joints.head.rotation.x += (0 - npc.joints.head.rotation.x) * 5.0 * dt;
        }
      }

      // Smooth arm wave reaction
      if (isWavingAtPlayer && !isWalking) {
        // Wave left hand
        const waveX = -0.6;
        const waveZ = -1.2 + Math.sin(time * 12.0) * 0.35; // friendly rapid hand wave
        npc.joints.leftArm.rotation.x += (waveX - npc.joints.leftArm.rotation.x) * 8.0 * dt;
        npc.joints.leftArm.rotation.z += (waveZ - npc.joints.leftArm.rotation.z) * 8.0 * dt;
        npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 8.0 * dt;
      }

      // Skip the rest of the dance motion loop if we are walking
      if (isWalking) return;

      // 4. SEATED BAR PATRON ANIMS (Case -2)
      if (npc.danceType === -2) {
        npc.group.position.y = 0.65 + Math.sin(time * 0.6 + npc.dancePhase) * 0.01;
        
        if (!isLookingAtPlayer) {
          npc.joints.head.rotation.y += (Math.sin(time * 0.3 + npc.dancePhase) * 0.1 - npc.joints.head.rotation.y) * 4.0 * dt;
        }
        
        if (!isWavingAtPlayer) {
          npc.joints.leftArm.rotation.x += (Math.sin(time * 0.4 + npc.dancePhase) * 0.06 - npc.joints.leftArm.rotation.x) * 4.0 * dt;
          npc.joints.leftArm.rotation.z += (0.0 - npc.joints.leftArm.rotation.z) * 4.0 * dt;
          npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 4.0 * dt;
        }
        return;
      }

      // 5. LOUNGE VISITORS DANCE/SWAY MOTIONS (beat synced)
      const speedMult = npc.danceSpeed;
      const phase = npc.dancePhase;

      switch (npc.danceType) {
        case 0: // "THE CHILL CHATTERER"
          npc.group.position.y = Math.abs(Math.sin(time * 1.2 * speedMult + phase)) * 0.015 - this.beatIntensity * 0.04;
          npc.group.rotation.y = npc.baseRotationY + Math.sin(time * 0.8 * speedMult + phase) * 0.12;
          
          if (!isLookingAtPlayer) {
            npc.joints.head.rotation.x += (Math.sin(time * 1.2 * speedMult + phase) * 0.05 + this.beatIntensity * 0.12 - npc.joints.head.rotation.x) * 6.0 * dt;
            npc.joints.head.rotation.y += (Math.sin(time * 1.5 + phase) * 0.22 - npc.joints.head.rotation.y) * 6.0 * dt;
          }
          
          if (!isWavingAtPlayer) {
            npc.joints.leftArm.rotation.x += (-0.1 + Math.sin(time * 1.0 + phase) * 0.05 - this.beatIntensity * 0.08 - npc.joints.leftArm.rotation.x) * 6.0 * dt;
            npc.joints.leftArm.rotation.z += (0.0 - npc.joints.leftArm.rotation.z) * 6.0 * dt;
            npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 6.0 * dt;
          }
          npc.joints.rightArm.rotation.x += (-0.1 + Math.cos(time * 1.0 + phase) * 0.05 - this.beatIntensity * 0.08 - npc.joints.rightArm.rotation.x) * 6.0 * dt;
          
          npc.joints.leftLeg.rotation.x = Math.sin(time * 1.2 * speedMult + phase) * 0.04;
          npc.joints.rightLeg.rotation.x = -Math.sin(time * 1.2 * speedMult + phase) * 0.04;
          break;

        case 1: // "THE COZY SWAYER"
          npc.group.position.y = Math.sin(time * 1.5 * speedMult + phase) * 0.015 - this.beatIntensity * 0.045;
          npc.group.rotation.z = Math.sin(time * 1.5 * speedMult + phase) * 0.08 + this.beatIntensity * 0.06 * Math.sin(phase);
          npc.group.rotation.y = npc.baseRotationY;
          
          if (!isLookingAtPlayer) {
            npc.joints.head.rotation.x += (Math.abs(Math.sin(time * 1.5 * speedMult + phase)) * 0.1 + this.beatIntensity * 0.18 - npc.joints.head.rotation.x) * 6.0 * dt;
            npc.joints.head.rotation.y += (0.0 - npc.joints.head.rotation.y) * 6.0 * dt;
          }
          
          if (!isWavingAtPlayer) {
            npc.joints.leftArm.rotation.z += (-0.4 + Math.sin(time * 1.2 + phase) * 0.08 - this.beatIntensity * 0.05 - npc.joints.leftArm.rotation.z) * 6.0 * dt;
            npc.joints.leftArm.rotation.x += (0.0 - npc.joints.leftArm.rotation.x) * 6.0 * dt;
            npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 6.0 * dt;
          }
          npc.joints.rightArm.rotation.z += (0.4 + Math.cos(time * 1.2 + phase) * 0.08 + this.beatIntensity * 0.05 - npc.joints.rightArm.rotation.z) * 6.0 * dt;
          
          npc.joints.leftLeg.rotation.y = Math.sin(time * 1.2 + phase) * 0.08;
          break;

        case 2: // "THE RHYTHMIC NODDER"
          npc.group.position.y = -this.beatIntensity * 0.04;
          npc.group.rotation.y = npc.baseRotationY;
          
          if (!isLookingAtPlayer) {
            npc.joints.head.rotation.x += (Math.abs(Math.sin(time * 2.2 * speedMult + phase)) * 0.24 + this.beatIntensity * 0.35 - npc.joints.head.rotation.x) * 6.0 * dt;
            npc.joints.head.rotation.y += (0.0 - npc.joints.head.rotation.y) * 6.0 * dt;
          }
          
          npc.joints.leftLeg.rotation.x = Math.max(0, Math.sin(time * 4.4 * speedMult + phase)) * 0.1 + this.beatIntensity * 0.22;
          
          if (!isWavingAtPlayer) {
            npc.joints.leftArm.rotation.x += (-0.15 - this.beatIntensity * 0.1 - npc.joints.leftArm.rotation.x) * 6.0 * dt;
            npc.joints.leftArm.rotation.z += (0.0 - npc.joints.leftArm.rotation.z) * 6.0 * dt;
            npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 6.0 * dt;
          }
          npc.joints.rightArm.rotation.x += (-0.15 - this.beatIntensity * 0.1 - npc.joints.rightArm.rotation.x) * 6.0 * dt;
          break;

        case 3: // "THE CONVERSATIONALIST"
          npc.group.position.y = Math.sin(time * 1.0 + phase) * 0.008 - this.beatIntensity * 0.035;
          npc.group.rotation.y = npc.baseRotationY + Math.sin(time * 0.4 + phase) * 0.06 + Math.sin(time * 2.0) * 0.08 * this.beatIntensity;
          
          if (!isLookingAtPlayer) {
            npc.joints.head.rotation.x += (0.0 - npc.joints.head.rotation.x) * 6.0 * dt;
            npc.joints.head.rotation.y += (0.0 - npc.joints.head.rotation.y) * 6.0 * dt;
          }

          if (!isWavingAtPlayer) {
            npc.joints.leftArm.rotation.x += (-0.3 + Math.sin(time * 1.8 + phase) * 0.14 - this.beatIntensity * 0.18 - npc.joints.leftArm.rotation.x) * 6.0 * dt;
            npc.joints.leftArm.rotation.z += (-0.15 + Math.cos(time * 1.2 + phase) * 0.08 - npc.joints.leftArm.rotation.z) * 6.0 * dt;
            npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 6.0 * dt;
          }
          npc.joints.rightArm.rotation.x += (-0.15 - this.beatIntensity * 0.12 - npc.joints.rightArm.rotation.x) * 6.0 * dt;
          npc.joints.rightArm.rotation.z += (0.15 - npc.joints.rightArm.rotation.z) * 6.0 * dt;
          break;
      }
    });
  }

  /**
   * Resolves NPC to NPC personal-space overlap for social movement clarity.
   */
  _resolveNpcCrowding(dt) {
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      if (!a.canBePushed || a.isSeated) continue;
      const aRadius = a.collisionRadius || 0.58;

      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (!b.canBePushed || b.isSeated) continue;

        const dx = b.group.position.x - a.group.position.x;
        const dz = b.group.position.z - a.group.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const required = aRadius + (b.collisionRadius || 0.58);

        if (dist > 0.0001 && dist < required) {
          const overlap = required - dist;
          const nX = dx / dist;
          const nZ = dz / dist;
          const aInv = 1.0 / Math.max(0.2, a.pushWeight || 0.45);
          const bInv = 1.0 / Math.max(0.2, b.pushWeight || 0.45);
          const total = aInv + bInv;
          const pushA = (aInv / total) * overlap * 5.0 * dt;
          const pushB = (bInv / total) * overlap * 5.0 * dt;

          a.group.position.x -= nX * pushA;
          a.group.position.z -= nZ * pushA;
          b.group.position.x += nX * pushB;
          b.group.position.z += nZ * pushB;
        }
      }
    }
  }

  /**
   * Applies player-driven push impulses so NPCs can be moved by player contact.
   */
  _applyPlayerPush(npc, playerPos, playerVelX, playerVelZ, playerSpeed, dt) {
    if (!npc.canBePushed) return;

    const dx = npc.group.position.x - playerPos.x;
    const dz = npc.group.position.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const pushRadius = npc.pushRadius || this.playerPushRadius;

    if (dist < 0.0001 || dist > pushRadius + 0.45) return;

    const toNpcX = dx / dist;
    const toNpcZ = dz / dist;
    const approach = (playerVelX * toNpcX + playerVelZ * toNpcZ);
    const pushImpulse = (Math.max(0, approach) + Math.max(0, 0.55 - dist)) * (npc.pushWeight || 0.45) * this.playerPushStrength;

    if (pushImpulse < 0.015) return;

    const moveBy = (0.12 + Math.min(0.6, playerSpeed * 0.4)) * pushImpulse * dt;
    if (npc.isSeated) return;

    npc.group.position.x += toNpcX * moveBy;
    npc.group.position.z += toNpcZ * moveBy;
  }

  /* --- HELPER SELECTORS --- */

  _getRandomSkin() {
    const skins = ['#f5c396', '#fcd2a1', '#e5a073', '#d49060', '#f2ab7e', '#eccda5'];
    return skins[Math.floor(Math.random() * skins.length)];
  }

  _getRandomCozyColor(excludeColor = null) {
    // Replaces high-tech fluorescent neon shades with premium, natural organic tones
    const cozyColors = [
      '#e1c7a5', // warm oatmeal beige
      '#a24a38', // rust-red terracotta
      '#255232', // forest pine green
      '#8a8a92', // heather grey wool
      '#1c284f', // cozy navy blue flannel
      '#eae4d8', // cream wool cable-knit
      '#5c3d28', // chestnut corduroy brown
      '#cda45d'  // mustard-yellow gold
    ];
    let col = cozyColors[Math.floor(Math.random() * cozyColors.length)];
    while (col === excludeColor) {
      col = cozyColors[Math.floor(Math.random() * cozyColors.length)];
    }
    return col;
  }

  /**
   * Cleans up and disposes of all pre-allocated geometries and materials to prevent memory leaks.
   */
  dispose() {
    if (this.torsoGeo) this.torsoGeo.dispose();
    if (this.headGeo) this.headGeo.dispose();
    if (this.armGeo) this.armGeo.dispose();
    if (this.handGeo) this.handGeo.dispose();
    if (this.legGeo) this.legGeo.dispose();
    if (this.shoeGeo) this.shoeGeo.dispose();
    if (this.shoeMat) this.shoeMat.dispose();
    if (this.glassGeo) this.glassGeo.dispose();
    if (this.glassMat) this.glassMat.dispose();

    this.npcs.forEach(npc => {
      npc.group.traverse(child => {
        if (child.isMesh) {
          if (child.geometry && 
              child.geometry !== this.torsoGeo &&
              child.geometry !== this.headGeo && 
              child.geometry !== this.armGeo &&
              child.geometry !== this.handGeo && 
              child.geometry !== this.legGeo &&
              child.geometry !== this.shoeGeo && 
              child.geometry !== this.glassGeo) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat !== this.shoeMat && mat !== this.glassMat) {
                  if (mat.map) mat.map.dispose();
                  mat.dispose();
                }
              });
            } else if (child.material !== this.shoeMat && child.material !== this.glassMat) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });
    });
  }
}

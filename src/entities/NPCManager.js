import * as THREE from 'three';
import { getGameplayRandom } from '../config/experience.js';
import { ContactLayer } from '../utils/ContactLayer.js';
import { TextureGenerator } from '../utils/TextureGenerator.js';

const ROLE_CONTACT_PROFILES = {
  'standing patron': {
    role: 'standing patron',
    radius: 0.52,
    pushRadius: 0.76,
    contactWeight: 1.0,
    canBePushed: true,
    waveChance: 0.7,
    waveCooldown: 5,
    returnStrength: 0.9,
  },
  wanderer: {
    role: 'wanderer',
    radius: 0.5,
    pushRadius: 0.78,
    contactWeight: 0.75,
    canBePushed: true,
    waveChance: 0.65,
    waveCooldown: 6,
    returnStrength: 1.1,
  },
  'seated patron': {
    role: 'seated patron',
    radius: 0.5,
    pushRadius: 0.74,
    contactWeight: 8,
    canBePushed: true,
    waveChance: 0.25,
    waveCooldown: 9,
    returnStrength: 2.4,
  },
  doorman: {
    role: 'doorman',
    radius: 0.55,
    pushRadius: 0.82,
    contactWeight: 10,
    canBePushed: true,
    waveChance: 0.1,
    waveCooldown: 12,
    returnStrength: 2.8,
  },
  bartender: {
    role: 'bartender',
    radius: 0.54,
    pushRadius: 0.76,
    contactWeight: 12,
    canBePushed: true,
    waveChance: 0.05,
    waveCooldown: 14,
    returnStrength: 3,
  },
  'music selector': {
    role: 'music selector',
    radius: 0.56,
    pushRadius: 0.78,
    contactWeight: 9,
    canBePushed: true,
    waveChance: 0.15,
    waveCooldown: 10,
    returnStrength: 2.4,
  },
  photographer: {
    role: 'photographer',
    radius: 0.48,
    pushRadius: 0.7,
    contactWeight: 10,
    canBePushed: true,
    waveChance: 0,
    waveCooldown: 20,
    returnStrength: 3,
  },
};

const CLUB_EXIT_THRESHOLD_X = -4.8;

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function calculateFacingAngle(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

export function createNpcContactProfile(role = 'standing patron') {
  return { ...(ROLE_CONTACT_PROFILES[role] || ROLE_CONTACT_PROFILES['standing patron']) };
}

export function createDefaultNavGraph() {
  return {
    exterior: ['entrance'],
    entrance: ['exterior', 'lobby'],
    lobby: ['entrance', 'hall-center'],
    'hall-center': ['lobby', 'bar', 'lounge', 'music-booth'],
    bar: ['hall-center'],
    lounge: ['hall-center'],
    'music-booth': ['hall-center'],
  };
}

export function findNavPath(graph, start, goal, blocked = new Set()) {
  if (start === goal) return [start];
  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path.at(-1);
    for (const next of graph[node] || []) {
      if (blocked.has(next)) continue;
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === goal) return nextPath;
      visited.add(next);
      queue.push(nextPath);
    }
  }

  return [start];
}

export function applyLocalAvoidance(direction, position, blockers, avoidRadius = 0.95) {
  let x = direction.x;
  let z = direction.z;

  for (const blocker of blockers) {
    const dx = position.x - blocker.position.x;
    const dz = position.z - blocker.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const required = avoidRadius + (blocker.radius || 0);
    if (dist <= 0.0001 || dist >= required) continue;
    const strength = (required - dist) / required;
    x += (dx / dist || 0) * strength;
    z += (dz / dist || 0.35) * strength;
  }

  const length = Math.sqrt(x * x + z * z);
  if (length <= 0.0001) return direction;
  return { x: x / length, z: z / length };
}

export function canNpcReactToPlayer(npc, playerPos, { fov = Math.PI * 0.72, range = 2.6 } = {}) {
  if (!playerPos) return false;
  const dx = playerPos.x - npc.group.position.x;
  const dz = playerPos.z - npc.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist <= 1.0) return true;
  if (dist > range) return false;
  const targetAngle = Math.atan2(-dx, -dz);
  const facing = npc.baseRotationY ?? npc.group.rotation.y ?? 0;
  return Math.abs(angleDifference(targetAngle, facing)) <= fov / 2;
}

export function canNpcWaveAtPlayer(npc, dist, time) {
  const profile = createNpcContactProfile(npc.role);
  const cooldown = npc.waveCooldown ?? profile.waveCooldown;
  const lastWaveTime = npc.lastWaveTime ?? -Infinity;
  return dist <= 1.8 && profile.waveChance >= 0.2 && time - lastWaveTime >= cooldown;
}

export function applyAnchorReturn(npc, dt) {
  if (!npc.anchor) return;
  const dx = npc.anchor.x - npc.group.position.x;
  const dz = npc.anchor.z - npc.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const anchorRadius = npc.anchorRadius ?? 0.85;
  if (dist <= anchorRadius || dist <= 0.0001) return;
  const step = Math.min(dist - anchorRadius, (npc.returnStrength ?? 1) * dt);
  npc.group.position.x += (dx / dist) * step;
  npc.group.position.z += (dz / dist) * step;
}

export function updatePhotographerTriggerState(previousState, playerX) {
  const currentZone = playerX <= CLUB_EXIT_THRESHOLD_X ? 'outside' : 'inside';
  const lastZone = previousState?.lastZone ?? currentZone;
  let isActive = previousState?.isActive ?? false;

  if (lastZone === 'inside' && currentZone === 'outside') {
    isActive = true;
  } else if (lastZone === 'outside' && currentZone === 'inside') {
    isActive = false;
  }

  return { isActive, lastZone: currentZone };
}

export function getPhotographerFlashInterval(index = 0) {
  return 1.15 + (index % 2) * 0.55;
}

export function updatePhotographerFlash(npc, time, isActive) {
  const interval = npc.flashInterval ?? getPhotographerFlashInterval(npc.photographerIndex ?? 0);
  npc.flashInterval = interval;
  npc.flashDuration = npc.flashDuration ?? 0.12;

  if (!isActive) {
    npc.flashUntil = 0;
    npc.nextFlashTime = time + interval;
    return false;
  }

  if (npc.nextFlashTime == null) {
    npc.nextFlashTime = time + (npc.flashOffset ?? interval);
  }

  if (time < npc.nextFlashTime) return false;

  npc.flashUntil = time + npc.flashDuration;
  npc.nextFlashTime = time + interval;
  return true;
}

export function getNpcUpdateMode(npc, playerPos) {
  if (!playerPos) return 'full';

  const dx = playerPos.x - npc.group.position.x;
  const dz = playerPos.z - npc.group.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (npc.danceType === 75) {
    return dist <= 5.5 || playerPos.x <= CLUB_EXIT_THRESHOLD_X ? 'full' : 'sleep';
  }

  if (npc.danceType === 50 || npc.danceType === 99 || npc.danceType === -1) {
    return dist <= 6 ? 'full' : dist <= 14 ? 'poseOnly' : 'sleep';
  }

  if (dist <= 8) return 'full';
  if (dist <= 16) return 'poseOnly';
  return 'sleep';
}

function approachRotation(current, target, dt, speed = 7) {
  return current + (target - current) * Math.min(1, speed * dt);
}

export function applyStandingDanceMotion(
  npc,
  { beatIntensity = 0, dt = 0.016, isLookingAtPlayer = false, isWavingAtPlayer = false, time = 0 }
) {
  const amplitude = npc.danceAmplitude ?? 1;
  const energy = npc.danceEnergy ?? 1;
  const expression = npc.danceExpression ?? 0;
  const accentPhase = npc.danceAccentPhase ?? 0;
  const speedMult = (npc.danceSpeed ?? 1) * energy;
  const phase = npc.dancePhase ?? 0;
  const groove = time * speedMult + phase + accentPhase * 0.18;
  const baseRotationY = npc.baseRotationY ?? 0;
  const beat = beatIntensity;
  const s1 = Math.sin(groove * 1.7);
  const c1 = Math.cos(groove * 1.7);
  const s2 = Math.sin(groove * 3.4);
  const c2 = Math.cos(groove * 3.4);
  const snap = Math.max(0, Math.sin(groove * 3.4 + Math.PI * 0.2));
  const accentWave = Math.max(0, Math.sin(time * 0.72 + accentPhase));
  const accent = expression * Math.pow(accentWave, 10);

  const pose = {
    bodyY: 0,
    turn: baseRotationY,
    lean: 0,
    headX: 0,
    headY: 0,
    leftArmX: -0.15,
    leftArmY: 0,
    leftArmZ: 0,
    rightArmX: -0.15,
    rightArmY: 0,
    rightArmZ: 0,
    leftLegX: 0,
    rightLegX: 0,
    leftLegY: 0,
    rightLegY: 0,
  };

  switch (npc.danceType) {
    case 0: // Chill chatterer: small steps with loose talking hands.
      pose.bodyY = 0.012 + Math.max(0, s2) * 0.025 - beat * 0.025;
      pose.turn = baseRotationY + s1 * 0.14 + beat * 0.04 * Math.sin(phase);
      pose.lean = c1 * 0.045;
      pose.headX = s2 * 0.06 + beat * 0.08;
      pose.headY = Math.sin(groove * 1.3) * 0.18;
      pose.leftArmX = -0.22 + s1 * 0.16 - beat * 0.08;
      pose.leftArmY = -0.18 + c1 * 0.1;
      pose.leftArmZ = -0.08 + c2 * 0.16;
      pose.rightArmX = -0.18 + c1 * 0.12 - beat * 0.07;
      pose.rightArmY = 0.12 + s1 * 0.08;
      pose.rightArmZ = 0.12 + s2 * 0.12;
      pose.leftLegX = Math.max(0, s1) * 0.12 + beat * 0.07;
      pose.rightLegX = Math.max(0, -s1) * 0.12 + beat * 0.05;
      break;
    case 1: // Cozy swayer: side-to-side weight transfer with shoulder rolls.
      pose.bodyY = 0.008 + Math.abs(s1) * 0.018 - beat * 0.025;
      pose.turn = baseRotationY + c1 * 0.04;
      pose.lean = s1 * 0.12 + beat * 0.045 * Math.sin(phase);
      pose.headX = Math.abs(s1) * 0.1 + beat * 0.12;
      pose.headY = c1 * 0.08;
      pose.leftArmX = -0.08 + c1 * 0.08;
      pose.leftArmY = -0.18;
      pose.leftArmZ = -0.42 + s2 * 0.18 - beat * 0.04;
      pose.rightArmX = -0.08 - c1 * 0.08;
      pose.rightArmY = 0.18;
      pose.rightArmZ = 0.42 + c2 * 0.18 + beat * 0.04;
      pose.leftLegX = Math.max(0, -s1) * 0.1;
      pose.rightLegX = Math.max(0, s1) * 0.1;
      pose.leftLegY = s1 * 0.12;
      pose.rightLegY = -s1 * 0.1;
      break;
    case 2: // Rhythmic nodder: knee bounce and alternating elbow pumps.
      pose.bodyY = Math.max(0, snap) * 0.018 - beat * 0.03;
      pose.turn = baseRotationY + Math.sin(groove * 0.9) * 0.055;
      pose.lean = c1 * 0.11;
      pose.headX = Math.max(0, s2) * 0.22 + beat * 0.22;
      pose.headY = s1 * 0.08;
      pose.leftArmX = -0.28 + s1 * 0.12 - Math.max(0, s2) * 0.18 - beat * 0.08;
      pose.leftArmY = -0.12 + s1 * 0.08;
      pose.leftArmZ = -0.18 + c1 * 0.15;
      pose.rightArmX = -0.28 - s1 * 0.12 - Math.max(0, -s2) * 0.18 - beat * 0.08;
      pose.rightArmY = 0.12 + c1 * 0.08;
      pose.rightArmZ = 0.18 - s1 * 0.15;
      pose.leftLegX = 0.08 + Math.max(0, s2) * 0.24 + (s1 + 1) * 0.08 + beat * 0.16;
      pose.rightLegX = 0.08 + Math.max(0, -s2) * 0.24 + (1 - s1) * 0.08 + beat * 0.12;
      break;
    case 3: // Conversationalist: relaxed step-touch and pointing gesture.
      pose.bodyY = 0.008 + Math.abs(c1) * 0.012 - beat * 0.025;
      pose.turn = baseRotationY + s1 * 0.08 + beat * 0.07 * Math.sin(time * 2);
      pose.lean = -s1 * 0.055;
      pose.headX = c2 * 0.035;
      pose.headY = s1 * 0.12;
      pose.leftArmX = -0.34 + s2 * 0.18 - beat * 0.12;
      pose.leftArmY = -0.08 + snap * 0.22;
      pose.leftArmZ = -0.2 + c1 * 0.18;
      pose.rightArmX = -0.2 + c2 * 0.1 - beat * 0.09;
      pose.rightArmY = 0.1 - snap * 0.14;
      pose.rightArmZ = 0.2 + s1 * 0.14;
      pose.leftLegX = Math.max(0, c1) * 0.12 + beat * 0.06;
      pose.rightLegX = Math.max(0, -c1) * 0.12 + beat * 0.06;
      pose.leftLegY = c1 * 0.05;
      pose.rightLegY = -c1 * 0.05;
      break;
    default:
      return;
  }

  pose.bodyY *= amplitude;
  pose.turn = baseRotationY + (pose.turn - baseRotationY) * amplitude;
  pose.lean *= amplitude;
  pose.headX *= amplitude;
  pose.headY *= amplitude;
  pose.leftArmX *= amplitude;
  pose.leftArmY *= amplitude;
  pose.leftArmZ *= amplitude;
  pose.rightArmX *= amplitude;
  pose.rightArmY *= amplitude;
  pose.rightArmZ *= amplitude;
  pose.leftLegX *= amplitude;
  pose.rightLegX *= amplitude;
  pose.leftLegY *= amplitude;
  pose.rightLegY *= amplitude;

  if (accent > 0.001) {
    const accentSide = Math.sin(accentPhase + (npc.danceType ?? 0) * 1.7) >= 0 ? 1 : -1;
    pose.bodyY += accent * 0.018;
    pose.turn += accentSide * accent * 0.08;
    pose.lean += accentSide * accent * 0.16;
    pose.headX += accent * 0.09;
    pose.headY += accentSide * accent * 0.18;
    pose.leftArmX -= accent * 0.1;
    pose.leftArmY -= accentSide * accent * 0.12;
    pose.leftArmZ -= accentSide * accent * 0.28;
    pose.rightArmX -= accent * 0.08;
    pose.rightArmY += accentSide * accent * 0.16;
    pose.rightArmZ += accentSide * accent * 0.22;
    pose.leftLegX += accent * 0.06;
    pose.rightLegX += accent * 0.04;
  }

  npc.group.position.y = pose.bodyY;
  npc.group.rotation.y = pose.turn;
  npc.group.rotation.z = pose.lean;

  if (!isLookingAtPlayer) {
    npc.joints.head.rotation.x = approachRotation(npc.joints.head.rotation.x, pose.headX, dt);
    npc.joints.head.rotation.y = approachRotation(npc.joints.head.rotation.y, pose.headY, dt);
  }

  if (!isWavingAtPlayer) {
    npc.joints.leftArm.rotation.x = approachRotation(
      npc.joints.leftArm.rotation.x,
      pose.leftArmX,
      dt
    );
    npc.joints.leftArm.rotation.y = approachRotation(
      npc.joints.leftArm.rotation.y,
      pose.leftArmY,
      dt
    );
    npc.joints.leftArm.rotation.z = approachRotation(
      npc.joints.leftArm.rotation.z,
      pose.leftArmZ,
      dt
    );
  }

  npc.joints.rightArm.rotation.x = approachRotation(
    npc.joints.rightArm.rotation.x,
    pose.rightArmX,
    dt
  );
  npc.joints.rightArm.rotation.y = approachRotation(
    npc.joints.rightArm.rotation.y,
    pose.rightArmY,
    dt
  );
  npc.joints.rightArm.rotation.z = approachRotation(
    npc.joints.rightArm.rotation.z,
    pose.rightArmZ,
    dt
  );
  npc.joints.leftLeg.rotation.x = pose.leftLegX;
  npc.joints.rightLeg.rotation.x = pose.rightLegX;
  npc.joints.leftLeg.rotation.y = pose.leftLegY;
  npc.joints.rightLeg.rotation.y = pose.rightLegY;
}

export class NPCManager {
  constructor(scene, audio, contactLayer = new ContactLayer()) {
    this.scene = scene;
    this.audio = audio;
    this.contactLayer = contactLayer;
    this.random = getGameplayRandom();
    this.navGraph = createDefaultNavGraph();
    this.playerPushRadius = 0.76;
    this.playerPushStrength = 1.25;
    this.npcCrowdRadius = 0.58;
    this._lastPlayerPos = null;
    this.photographerTriggerState = null;

    // Pre-allocate shared NPC geometries to optimize draw calls and GPU vertex buffer uploads
    this.torsoGeo = new THREE.BoxGeometry(0.44, 0.6, 0.24);
    this.headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.3);
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
      metalness: 0.95,
    });

    this.cameraBodyGeo = new THREE.BoxGeometry(0.28, 0.16, 0.12);
    this.cameraLensGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.09, 10);
    this.cameraFlashGeo = new THREE.BoxGeometry(0.045, 0.035, 0.02);
    this.cameraGripGeo = new THREE.BoxGeometry(0.06, 0.16, 0.08);
    this.cameraBodyMat = new THREE.MeshStandardMaterial({
      color: 0x111116,
      roughness: 0.5,
      metalness: 0.5,
    });
    this.cameraLensMat = new THREE.MeshStandardMaterial({
      color: 0x050507,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.cameraFlashMat = new THREE.MeshStandardMaterial({
      color: 0xfffff2,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.1,
    });

    // Preset list of safe social mingle spots where NPCs gather
    this.mingleSpots = [
      { node: 'bar', x: 5.5, z: -1.0 }, // Bar Chatters Area
      { node: 'lounge', x: 12.0, z: -17.0 }, // Fireplace Chatters Area
      { node: 'hall-center', x: 8.5, z: -2.5 }, // Parquet Groovers Area
      { node: 'lobby', x: -1.5, z: -4.0 }, // Lobby Relaxers Area
    ];
    this.navNodes = {
      exterior: { x: -8.0, z: 0.0 },
      entrance: { x: -4.4, z: 0.0 },
      lobby: { x: -1.5, z: -4.0 },
      'hall-center': { x: 8.5, z: -2.5 },
      bar: { x: 5.5, z: -1.0 },
      lounge: { x: 12.0, z: -17.0 },
      'music-booth': { x: 16.2, z: -1.0 },
    };

    this.npcs = [];
    this._spawnAllNPCs();
  }

  static createDefaultNavGraph() {
    return createDefaultNavGraph();
  }

  _configureNpcContact(npc, role, scale = 1) {
    const profile = createNpcContactProfile(role);
    npc.role = profile.role;
    npc.collisionRadius = profile.radius * scale;
    npc.pushRadius = profile.pushRadius * scale;
    npc.contactWeight = profile.contactWeight;
    npc.pushWeight = profile.contactWeight;
    npc.canBePushed = profile.canBePushed;
    npc.waveCooldown = profile.waveCooldown;
    npc.returnStrength = profile.returnStrength;
    npc.anchorRadius = role === 'wanderer' ? 1.25 : 0.75;
    npc.anchor = npc.group.position.clone();
    npc.contactCollider = this.contactLayer.addCollider({
      id: `npc-${this.npcs.length}`,
      type: profile.contactWeight <= 1 ? 'softNpc' : 'npc',
      category: 'npc',
      solid: true,
      shape: 'circle',
      position: { x: npc.group.position.x, z: npc.group.position.z },
      radius: npc.collisionRadius,
      contactWeight: profile.contactWeight,
    });
  }

  _syncNpcContactColliders(npcs = this.npcs) {
    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.id) npc.id = `visitor-${i}`;
      if (!npc.contactCollider) {
        npc.contactCollider = this.contactLayer.addCollider({
          id: `npc-${npc.id}`,
          type: (npc.contactWeight ?? npc.pushWeight ?? 1) <= 1 ? 'softNpc' : 'npc',
          category: 'npc',
          solid: true,
          shape: 'circle',
          position: { x: npc.group.position.x, z: npc.group.position.z },
          radius: npc.collisionRadius || 0.52,
          contactWeight: npc.contactWeight ?? npc.pushWeight ?? 1,
        });
        continue;
      }
      npc.contactCollider.position.x = npc.group.position.x;
      npc.contactCollider.position.z = npc.group.position.z;
      npc.contactCollider.radius = npc.collisionRadius || npc.contactCollider.radius;
      npc.contactCollider.contactWeight = npc.contactWeight || npc.contactCollider.contactWeight;
    }
  }

  _applyContactColliderPositions() {
    for (const npc of this.npcs) {
      if (!npc.contactCollider) continue;
      npc.group.position.x = npc.contactCollider.position.x;
      npc.group.position.z = npc.contactCollider.position.z;
    }
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
      const angle = memberIdx * ((Math.PI * 2) / 3) + this.random() * 0.15;
      const radius = 0.65 + this.random() * 0.15;
      const x = spot.x + Math.cos(angle) * radius;
      const z = spot.z + Math.sin(angle) * radius;

      const skinColor = this._getRandomSkin();
      const suitColor = this._getRandomCozyColor();
      const stripeColor = this._getRandomCozyColor(suitColor);
      const clothingType = ['jacket', 'stripes', 'checker'][Math.floor(this.random() * 3)];
      const hasGlasses = this.random() > 0.4;
      const glassesColor = hasGlasses ? '#d4af37' : null; // Gold-rimmed spectacles

      const npc = this._createVoxelCharacter(
        skinColor,
        suitColor,
        stripeColor,
        clothingType,
        glassesColor
      );
      npc.group.position.set(x, 0, z);

      // Compute rotation to face the center of the mingle spot
      const faceAngle = calculateFacingAngle({ x, z }, spot);
      npc.group.rotation.y = faceAngle;
      npc.baseRotationY = faceAngle;

      // Assign state machine properties
      npc.isWanderer = i % 4 === 0; // 3 out of 12 patrons are wanderers
      npc.state = 'standing';
      npc.targetPos = null;
      npc.currentNode = spot.node;
      npc.homeNode = spot.node;
      npc.pathNodes = [];
      npc.lastMingleTime = performance.now() * 0.001 + this.random() * 10.0;

      // Assign randomized cozy lounge movement routine
      npc.danceType = Math.floor(this.random() * 4); // 0 to 3
      npc.dancePhase = this.random() * Math.PI * 2;
      npc.danceSpeed = 0.7 + this.random() * 0.4; // slower, relaxing motions
      npc.danceAmplitude = 0.75 + this.random() * 0.65;
      npc.danceEnergy = 0.8 + this.random() * 0.5;
      npc.danceExpression =
        this.random() < 0.35 ? 0.45 + this.random() * 0.65 : this.random() * 0.25;
      npc.danceAccentPhase = this.random() * Math.PI * 2;
      npc.walkSpeed = 0.85 + this.random() * 0.35;

      // Subtle scaling variations for character heights
      const scale = 0.85 + this.random() * 0.2;
      npc.group.scale.set(scale, scale, scale);
      npc.state = 'standing';
      npc.bodyRadius = 0.34 * scale;
      npc.collisionRadius = this.npcCrowdRadius * scale;
      npc.pushRadius = this.playerPushRadius * scale;
      this._configureNpcContact(npc, npc.isWanderer ? 'wanderer' : 'standing patron', scale);

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
    const doorman = this._createVoxelCharacter(
      '#f2ab7e',
      '#1c1c24',
      '#282833',
      'jacket',
      '#d4af37'
    ); // Charcoal grey suit, gold spectacles
    doorman.group.position.set(-5.8, 0, -1.8);
    doorman.group.rotation.y = Math.PI / 2; // Face towards the exterior queue
    doorman.danceType = -1; // Static folded arms doorman pose!
    doorman.baseRotationY = Math.PI / 2;
    doorman.canBePushed = true;
    doorman.bodyRadius = 0.35;
    doorman.collisionRadius = 0.55;
    doorman.pushRadius = 0.82;
    doorman.pushWeight = 0.8;
    this._configureNpcContact(doorman, 'doorman');

    // Cross arms doorman pose
    doorman.joints.leftArm.rotation.z = -1.1;
    doorman.joints.leftArm.rotation.y = 0.5;
    doorman.joints.rightArm.rotation.z = 1.1;
    doorman.joints.rightArm.rotation.y = -0.5;

    this.scene.add(doorman.group);
    this.npcs.push(doorman);

    // 3. Spawn 2 photographers behind the exterior velvet rope near the entrance.
    const photographerPositions = [
      { x: -8.35, z: -3.45 },
      { x: -7.25, z: -3.42 },
    ];
    photographerPositions.forEach((pos, index) => {
      const photographer = this._createVoxelCharacter(
        index === 0 ? '#e5a073' : '#f5c396',
        index === 0 ? '#1c284f' : '#5c3d28',
        '#cda45d',
        'jacket',
        '#d4af37'
      );
      photographer.id = `photographer-${index + 1}`;
      photographer.group.position.set(pos.x, 0, pos.z);
      const faceAngle = calculateFacingAngle(pos, { x: pos.x, z: -2.8 });
      photographer.group.rotation.y = faceAngle;
      photographer.baseRotationY = faceAngle;
      photographer.danceType = 75;
      photographer.photographerIndex = index;
      photographer.flashInterval = getPhotographerFlashInterval(index);
      photographer.flashOffset = 0.35 + index * 0.45;
      photographer.nextFlashTime = performance.now() * 0.001 + photographer.flashOffset;
      photographer.flashUntil = 0;
      photographer.bodyRadius = 0.3;
      photographer.collisionRadius = 0.48;
      photographer.pushRadius = 0.7;
      photographer.pushWeight = 0.25;
      this._configureNpcContact(photographer, 'photographer');

      photographer.joints.leftArm.rotation.x = 0.9;
      photographer.joints.leftArm.rotation.y = 0.55;
      photographer.joints.leftArm.rotation.z = 0.55;
      photographer.joints.rightArm.rotation.x = 0.9;
      photographer.joints.rightArm.rotation.y = -0.55;
      photographer.joints.rightArm.rotation.z = -0.55;
      photographer.joints.head.rotation.x = -0.05;

      this._attachCamera(photographer);
      this.scene.add(photographer.group);
      this.npcs.push(photographer);
    });

    // 4. Spawn 2 Bar Patrons seated on stools (x: 7.2 & 11.4, z: 5.8)
    const stoolPositions = [7.2, 11.4];
    stoolPositions.forEach((px) => {
      const skin = this._getRandomSkin();
      const col = this._getRandomCozyColor();
      const patron = this._createVoxelCharacter(
        skin,
        col,
        '#1a1815',
        'stripes',
        this.random() > 0.5 ? '#d4af37' : null
      );

      // Sit on bar stool height (0.65)
      patron.group.position.set(px, 0.65, 5.8);
      patron.group.rotation.y = Math.PI; // Look towards bar counter (+Z)
      patron.danceType = -2; // Seated chatting/drinking pose
      patron.baseRotationY = Math.PI;
      patron.canBePushed = true;
      patron.pushWeight = 0.15;
      patron.isSeated = true;
      patron.bodyRadius = 0.3;
      patron.collisionRadius = 0.52;
      patron.pushRadius = 0.76;
      this._configureNpcContact(patron, 'seated patron');

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

    // 5. Spawn 1 Music Selector inside the turntable booth (x: 18.2, z: 0)
    const selector = this._createVoxelCharacter(
      '#f3be8a',
      '#1e1c18',
      '#8a523f',
      'jacket',
      '#d4af37'
    ); // Warm wood brown jacket, gold spectacles
    selector.group.position.set(18.2, 0.45, 0); // elevated booth stage
    selector.group.rotation.y = -Math.PI / 2; // Face the floor (-X)
    selector.danceType = 99; // Selector special vinyl platters twisting animation!
    selector.baseRotationY = -Math.PI / 2;
    selector.canBePushed = true;
    selector.pushWeight = 0.35;
    selector.bodyRadius = 0.34;
    selector.collisionRadius = 0.56;
    selector.pushRadius = 0.78;
    this._configureNpcContact(selector, 'music selector');

    this.scene.add(selector.group);
    this.npcs.push(selector);

    // 6. Spawn 1 Bartender behind the counter (x: 9.0, z: 8.8) facing -Z (rotation.y = 0)
    const skin = '#fcd2a1';
    const suit = '#1c284f'; // navy blue
    const bartender = this._createVoxelCharacter(skin, suit, '#255232', 'jacket', null);
    bartender.group.position.set(9.0, 0, 8.8);
    bartender.group.rotation.y = 0; // Face -Z
    bartender.danceType = 50; // Special Bartender glass-polishing / counter-wiping state
    bartender.dancePhase = this.random() * Math.PI * 2;
    bartender.danceSpeed = 0.8;
    bartender.baseRotationY = 0;
    bartender.canBePushed = true;
    bartender.pushWeight = 0.28;
    bartender.bodyRadius = 0.32;
    bartender.collisionRadius = 0.54;
    bartender.pushRadius = 0.76;
    this._configureNpcContact(bartender, 'bartender');

    // Give bartender a drink glass to polish!
    this._attachDrinkGlass(bartender, 'leftArm');

    this.scene.add(bartender.group);
    this.npcs.push(bartender);
    this.bartender = bartender;
  }

  /**
   * Briefly amplifies the bartender's polishing flourish (~1.2s) — used as
   * visual feedback when the player orders a drink.
   */
  triggerBartenderFlourish() {
    if (!this.bartender) return;
    this.bartender.flourishUntil = performance.now() * 0.001 + 1.2;
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
      polygonOffsetUnits: -1,
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

    // Render the face as a small pixel-art panel on the local forward side (-Z).
    // This avoids BoxGeometry material-index ambiguity and keeps every character's
    // face locked to the front of the body regardless of world rotation.
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.28), faceMat);
    faceMesh.position.set(0, 0.16, -0.153);
    faceMesh.rotation.y = Math.PI;
    faceMesh.castShadow = false;
    joints.head.add(faceMesh);
    group.add(joints.head);

    // 4. Arms Joints and Meshes
    // --- Left Arm Joint (Pivot at shoulder x: -0.26, y: 1.15) ---
    joints.leftArm = new THREE.Group();
    joints.leftArm.position.set(-0.26, 1.15, 0);

    const leftArmMesh = new THREE.Mesh(this.armGeo, torsoMat);
    leftArmMesh.position.set(0, -0.22, 0); // hang down from shoulder pivot
    leftArmMesh.castShadow = false;
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
    rightArmMesh.castShadow = false;
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
    leftLegMesh.castShadow = false;
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
    rightLegMesh.castShadow = false;
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

  _attachCamera(npc) {
    const cameraGroup = new THREE.Group();
    cameraGroup.position.set(0, 0.86, -0.36);
    cameraGroup.rotation.x = 0.08;

    const body = new THREE.Mesh(this.cameraBodyGeo, this.cameraBodyMat);
    body.castShadow = false;
    cameraGroup.add(body);

    const lens = new THREE.Mesh(this.cameraLensGeo, this.cameraLensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, -0.07);
    lens.castShadow = false;
    cameraGroup.add(lens);

    const flash = new THREE.Mesh(this.cameraFlashGeo, this.cameraFlashMat.clone());
    flash.position.set(0.055, 0.045, -0.06);
    flash.visible = false;
    cameraGroup.add(flash);

    const leftGrip = new THREE.Mesh(this.cameraGripGeo, this.cameraBodyMat);
    leftGrip.position.set(-0.17, -0.035, 0);
    leftGrip.castShadow = false;
    cameraGroup.add(leftGrip);

    const rightGrip = new THREE.Mesh(this.cameraGripGeo, this.cameraBodyMat);
    rightGrip.position.set(0.17, -0.035, 0);
    rightGrip.castShadow = false;
    cameraGroup.add(rightGrip);

    const light = new THREE.PointLight(0xffffff, 0, 6, 2);
    light.position.set(0.04, 0.04, -0.18);
    cameraGroup.add(light);

    npc.cameraFlashMesh = flash;
    npc.cameraFlashLight = light;
    npc.group.add(cameraGroup);
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
      playerSpeed =
        Math.sqrt(playerVelX * playerVelX + playerVelZ * playerVelZ) / Math.max(dt, 0.0001);
    }

    if (playerPos) {
      this._lastPlayerPos = { x: playerPos.x, z: playerPos.z };
      this.photographerTriggerState = updatePhotographerTriggerState(
        this.photographerTriggerState,
        playerPos.x
      );
      this.npcs.forEach((npc) => {
        npc.updateMode = getNpcUpdateMode(npc, playerPos);
      });
    }

    if (playerPos) {
      this._applyContactColliderPositions();
      this._syncNpcContactColliders();
      this.npcs.forEach((npc) => {
        if ((npc.updateMode || 'full') === 'full') {
          this._applyPlayerPush(npc, playerPos, playerVelX, playerVelZ, playerSpeed, dt);
        }
      });
      const activeNpcs = this.npcs.filter((npc) => (npc.updateMode || 'full') !== 'sleep');
      this._resolveNpcCrowding(dt, activeNpcs);
      this.npcs.forEach((npc) => {
        if ((npc.updateMode || 'full') !== 'sleep') {
          this._applyAnchorReturn(npc, dt);
        }
      });
      this._syncNpcContactColliders();
    }

    // Calculate a smooth decay-based beat intensity that spikes on drum kicks
    const decay = 1 - Math.exp(-8.0 * dt);
    if (isBeat) {
      this.beatIntensity = 1.0;
    } else {
      this.beatIntensity = (this.beatIntensity || 0) + (0.0 - (this.beatIntensity || 0)) * decay;
    }

    this.npcs.forEach((npc) => {
      let npcDt = dt;
      const updateMode = npc.updateMode || 'full';
      if (updateMode === 'sleep') {
        if (npc.danceType === 75) {
          updatePhotographerFlash(npc, time, false);
          if (npc.cameraFlashMesh) npc.cameraFlashMesh.visible = false;
          if (npc.cameraFlashLight) npc.cameraFlashLight.intensity = 0;
        }
        return;
      }

      if (updateMode === 'poseOnly' && npc.danceType >= 0) {
        npc.poseOnlyAccumulator = (npc.poseOnlyAccumulator || 0) + dt;
        if (npc.poseOnlyAccumulator < 0.12) return;
        npcDt = Math.min(0.2, npc.poseOnlyAccumulator);
        npc.poseOnlyAccumulator = 0;
      }

      // 1. DOORMAN (case -1)
      if (npc.danceType === -1) {
        let isLooking = false;
        if (playerPos) {
          const dx = playerPos.x - npc.group.position.x;
          const dz = playerPos.z - npc.group.position.z;
          if (this._canReactToPlayer(npc, playerPos)) {
            isLooking = true;
            const targetGlobalAngle = Math.atan2(-dx, -dz);
            let targetHeadY = targetGlobalAngle - npc.group.rotation.y;
            targetHeadY = Math.atan2(Math.sin(targetHeadY), Math.cos(targetHeadY));
            targetHeadY = Math.max(-1.3, Math.min(1.3, targetHeadY));
            npc.joints.head.rotation.y += (targetHeadY - npc.joints.head.rotation.y) * 8.0 * npcDt;
          }
        }
        if (!isLooking) {
          npc.joints.head.rotation.y += (0.0 - npc.joints.head.rotation.y) * 4.0 * npcDt;
        }
        return;
      }

      // 2. BARTENDER (case 50)
      if (npc.danceType === 50) {
        // Brief flourish window after the player orders a drink — amplifies the
        // polishing motion and lifts the head for a "coming right up" beat.
        const flourish = Math.max(0, (npc.flourishUntil ?? 0) - time);
        const amp = 1 + flourish * 1.5;

        // Slow breathing bob and subtle hip sway
        npc.group.position.y = Math.sin(time * 1.5) * 0.01;
        npc.group.rotation.y = npc.baseRotationY + Math.sin(time * 0.5) * 0.05;

        // Arm polishing routine: left arm holds glass, right arm rubs it
        npc.joints.leftArm.rotation.x = -0.9 + Math.sin(time * 2.0) * 0.05;
        npc.joints.leftArm.rotation.y = 0.3;
        npc.joints.leftArm.rotation.z = -0.2;

        npc.joints.rightArm.rotation.x = -1.0 + Math.sin(time * 10.0) * 0.15 * amp;
        npc.joints.rightArm.rotation.y = -0.4;
        npc.joints.rightArm.rotation.z = 0.1;

        npc.joints.head.rotation.x = 0.25 - flourish * 0.15 + Math.sin(time * 1.5) * 0.05;
        npc.joints.head.rotation.y = Math.sin(time * 0.5) * 0.08;
        return;
      }

      // 3. PHOTOGRAPHERS (case 75)
      if (npc.danceType === 75) {
        const isPhotographing = this.photographerTriggerState?.isActive ?? false;
        const didFlash = updatePhotographerFlash(npc, time, isPhotographing);
        const flashActive = isPhotographing && time < (npc.flashUntil ?? 0);
        const flashPop = flashActive ? 1 : 0;

        npc.group.position.y = Math.sin(time * 2.2 + (npc.photographerIndex ?? 0)) * 0.01;
        npc.group.rotation.y =
          npc.baseRotationY + Math.sin(time * 1.4 + (npc.photographerIndex ?? 0)) * 0.04;
        npc.joints.head.rotation.x = -0.08 - flashPop * 0.08;
        npc.joints.head.rotation.y =
          Math.sin(time * 1.1 + (npc.photographerIndex ?? 0) * 0.8) * 0.08;
        npc.joints.leftArm.rotation.x = 0.9 + Math.sin(time * 5) * 0.012 - flashPop * 0.04;
        npc.joints.leftArm.rotation.y = 0.55;
        npc.joints.leftArm.rotation.z = 0.55 + flashPop * 0.04;
        npc.joints.rightArm.rotation.x = 0.9 + Math.sin(time * 5.4) * 0.012 - flashPop * 0.04;
        npc.joints.rightArm.rotation.y = -0.55;
        npc.joints.rightArm.rotation.z = -0.55 - flashPop * 0.04;
        npc.joints.leftLeg.rotation.x = Math.sin(time * 1.8) * 0.025;
        npc.joints.rightLeg.rotation.x = -Math.sin(time * 1.8) * 0.025;

        if (npc.cameraFlashMesh) {
          npc.cameraFlashMesh.visible = flashActive;
          if (npc.cameraFlashMesh.material) {
            npc.cameraFlashMesh.material.emissiveIntensity = flashActive ? 4.5 : 0;
          }
        }
        if (npc.cameraFlashLight) {
          npc.cameraFlashLight.intensity = flashActive ? 7 : 0;
        }
        if (didFlash && npc.cameraFlashMesh) {
          npc.cameraFlashMesh.scale.setScalar(1.35);
        } else if (npc.cameraFlashMesh) {
          npc.cameraFlashMesh.scale.setScalar(1);
        }
        return;
      }

      // 4. VINYL MUSIC SELECTOR TURNTABLE ANIMS (case 99)
      if (npc.danceType === 99) {
        const bobSpeed = 3.5;
        npc.group.position.y =
          0.45 + Math.abs(Math.sin(time * bobSpeed)) * 0.04 + this.beatIntensity * 0.06;
        npc.joints.head.rotation.x = Math.sin(time * bobSpeed) * 0.08 + this.beatIntensity * 0.22;

        npc.joints.leftArm.rotation.x =
          -0.8 + Math.sin(time * 1.5) * 0.15 - this.beatIntensity * 0.25;
        npc.joints.leftArm.rotation.y = -0.15 + Math.sin(time * 0.8) * 0.1;

        npc.joints.rightArm.rotation.x =
          -0.8 + Math.cos(time * 1.2) * 0.15 - this.beatIntensity * 0.25;
        npc.joints.rightArm.rotation.y = 0.15 + Math.cos(time * 0.6) * 0.1;
        return;
      }

      // --- WALK / STATE MACHINE FOR LOUNGE PATRONS (if wanderer) ---
      let isWalking = false;
      if (npc.isWanderer) {
        if (!npc.state) npc.state = 'standing';
        if (!npc.lastMingleTime) npc.lastMingleTime = time + this.random() * 15;

        if (npc.state === 'walking') {
          isWalking = true;
          const target = npc.targetPos;
          const currentPos = npc.group.position;

          const dx = target.x - currentPos.x;
          const dz = target.z - currentPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.15) {
            const blockers = this._getLocalAvoidanceBlockers(npc, playerPos);
            const moveDir = this._applyLocalAvoidance(
              { x: dx / dist, z: dz / dist },
              { x: currentPos.x, z: currentPos.z },
              blockers
            );
            const moveDirX = moveDir.x;
            const moveDirZ = moveDir.z;
            const moveSpeed = npc.walkSpeed || 1.0; // realistic walking pace

            currentPos.x += moveDirX * moveSpeed * npcDt;
            currentPos.z += moveDirZ * moveSpeed * npcDt;

            const walkAngle = Math.atan2(-moveDirX, -moveDirZ);
            // Smoothly interpolate rotation to match walk direction
            let diff = walkAngle - npc.group.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            npc.group.rotation.y += diff * 10.0 * npcDt;
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
            if (npc.targetNode) {
              npc.currentNode = npc.targetNode;
            }
            npc.targetNode = null;

            if (npc.pathNodes?.length) {
              const nextNode = npc.pathNodes.shift();
              if (nextNode === 'final-mingle-target' && npc.finalMingleTarget) {
                npc.targetNode = null;
                npc.targetPos = npc.finalMingleTarget;
                npc.finalMingleTarget = null;
                npc.state = 'walking';
              } else {
                const nodePos = this.navNodes[nextNode];
                if (nodePos) {
                  npc.targetNode = nextNode;
                  npc.targetPos = new THREE.Vector3(nodePos.x, 0, nodePos.z);
                  npc.state = 'walking';
                }
              }
              if (npc.state === 'walking') {
                // Continue along the graph route before resuming idle animation.
              } else {
                npc.targetNode = nextNode;
                npc.targetPos = null;
              }
            } else {
              npc.targetPos = null;
            }

            // Reset legs to straight standing pose
            npc.joints.leftLeg.rotation.x = 0;
            npc.joints.rightLeg.rotation.x = 0;
            npc.joints.leftLeg.rotation.y = 0;
            npc.joints.rightLeg.rotation.y = 0;

            // Look up which spot we reached and set faceAngle
            const spotIdx = this.mingleSpots.findIndex((spot) => {
              const sdx = spot.x - currentPos.x;
              const sdz = spot.z - currentPos.z;
              return Math.sqrt(sdx * sdx + sdz * sdz) < 1.6;
            });
            if (spotIdx !== -1) {
              const spot = this.mingleSpots[spotIdx];
              const angle =
                Math.atan2(-(spot.x - currentPos.x), -(spot.z - currentPos.z)) +
                (this.random() - 0.5) * 0.4;
              npc.baseRotationY = angle;
              npc.group.rotation.y = angle;
            }
          }
        } else {
          // Standing: Check if it's time to wander/mingle
          if (time - npc.lastMingleTime > 20 + this.random() * 15) {
            const currentSpotIdx = this.mingleSpots.findIndex((spot) => {
              const sdx = spot.x - npc.group.position.x;
              const sdz = spot.z - npc.group.position.z;
              return Math.sqrt(sdx * sdx + sdz * sdz) < 1.6;
            });

            let nextSpotIdx = Math.floor(this.random() * this.mingleSpots.length);
            if (nextSpotIdx === currentSpotIdx) {
              nextSpotIdx = (nextSpotIdx + 1) % this.mingleSpots.length;
            }

            const destSpot = this.mingleSpots[nextSpotIdx];
            const path = this._findNavPath(npc.currentNode || 'hall-center', destSpot.node);
            const pathNodes = path.slice(1);
            if (pathNodes.length > 0) {
              const finalOffsetAngle = this.random() * Math.PI * 2;
              const finalOffsetRadius = 0.5 + this.random() * 0.35;
              npc.finalMingleTarget = new THREE.Vector3(
                destSpot.x + Math.cos(finalOffsetAngle) * finalOffsetRadius,
                0,
                destSpot.z + Math.sin(finalOffsetAngle) * finalOffsetRadius
              );
              const nextNode = pathNodes.shift();
              npc.pathNodes = [...pathNodes, 'final-mingle-target'];
              const nodePos = this.navNodes[nextNode];
              npc.targetNode = nextNode;
              npc.targetPos = new THREE.Vector3(nodePos.x, 0, nodePos.z);
              npc.state = 'walking';
            }
          }
        }
      }

      // --- PLAYER PROXIMITY DETECTION & EYE CONTACT / WAVING ---
      let isLookingAtPlayer = false;
      let isWavingAtPlayer = false;
      let dist = 999.0;
      let dx = 0,
        dz = 0;

      if (playerPos) {
        dx = playerPos.x - npc.group.position.x;
        dz = playerPos.z - npc.group.position.z;
        dist = Math.sqrt(dx * dx + dz * dz);

        if (this._canReactToPlayer(npc, playerPos)) {
          isLookingAtPlayer = true;
          if (this._canWaveAtPlayer(npc, dist, time)) {
            isWavingAtPlayer = true;
            this._markWave(npc, time);
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
        npc.joints.head.rotation.y += (targetHeadY - npc.joints.head.rotation.y) * 8.0 * npcDt;

        // Look up slightly (player camera is at y=1.7m, NPC head is at ~1.35m)
        const targetHeadX = -0.15;
        npc.joints.head.rotation.x += (targetHeadX - npc.joints.head.rotation.x) * 8.0 * npcDt;

        if (npc.danceType >= 0 && !isWalking && !npc.isSeated) {
          npc.group.rotation.y += (targetGlobalAngle - npc.group.rotation.y) * 3.0 * npcDt;
          npc.baseRotationY = npc.group.rotation.y;
        }
      } else {
        // Return head to center smoothly if walking or standing (or let the dance loop handle it)
        if (isWalking) {
          npc.joints.head.rotation.y += (0 - npc.joints.head.rotation.y) * 5.0 * npcDt;
          npc.joints.head.rotation.x += (0 - npc.joints.head.rotation.x) * 5.0 * npcDt;
        }
      }

      // Smooth arm wave reaction
      if (isWavingAtPlayer && !isWalking) {
        // Wave left hand
        const waveX = -0.6;
        const waveZ = -1.2 + Math.sin(time * 12.0) * 0.35; // friendly rapid hand wave
        npc.joints.leftArm.rotation.x += (waveX - npc.joints.leftArm.rotation.x) * 8.0 * npcDt;
        npc.joints.leftArm.rotation.z += (waveZ - npc.joints.leftArm.rotation.z) * 8.0 * npcDt;
        npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 8.0 * npcDt;
      }

      // Skip the rest of the dance motion loop if we are walking
      if (isWalking) return;

      // 4. SEATED BAR PATRON ANIMS (Case -2)
      if (npc.danceType === -2) {
        npc.group.position.y = 0.65 + Math.sin(time * 0.6 + npc.dancePhase) * 0.01;

        if (!isLookingAtPlayer) {
          npc.joints.head.rotation.y +=
            (Math.sin(time * 0.3 + npc.dancePhase) * 0.1 - npc.joints.head.rotation.y) *
            4.0 *
            npcDt;
        }

        if (!isWavingAtPlayer) {
          npc.joints.leftArm.rotation.x +=
            (Math.sin(time * 0.4 + npc.dancePhase) * 0.06 - npc.joints.leftArm.rotation.x) *
            4.0 *
            npcDt;
          npc.joints.leftArm.rotation.z += (0.0 - npc.joints.leftArm.rotation.z) * 4.0 * npcDt;
          npc.joints.leftArm.rotation.y += (0.0 - npc.joints.leftArm.rotation.y) * 4.0 * npcDt;
        }
        return;
      }

      // 5. LOUNGE VISITORS DANCE/SWAY MOTIONS (beat synced)
      applyStandingDanceMotion(npc, {
        beatIntensity: this.beatIntensity,
        dt: npcDt,
        isLookingAtPlayer,
        isWavingAtPlayer,
        time,
      });
    });
  }

  /**
   * Resolves NPC to NPC personal-space overlap for social movement clarity.
   */
  _resolveNpcCrowding(dt = 1 / 60, npcs = this.npcs) {
    this._syncNpcContactColliders(npcs);
    this.contactLayer.resolveDynamicContacts('npc');
    for (const npc of npcs) {
      if (!npc.contactCollider) continue;
      const blend = Math.min(1, Math.max(0.25, dt * 12));
      npc.group.position.x += (npc.contactCollider.position.x - npc.group.position.x) * blend;
      npc.group.position.z += (npc.contactCollider.position.z - npc.group.position.z) * blend;
    }
  }

  _canReactToPlayer(npc, playerPos) {
    return canNpcReactToPlayer(npc, playerPos);
  }

  _canWaveAtPlayer(npc, dist, time) {
    return canNpcWaveAtPlayer(npc, dist, time);
  }

  _markWave(npc, time) {
    npc.lastWaveTime = time;
  }

  _applyAnchorReturn(npc, dt) {
    applyAnchorReturn(npc, dt);
  }

  _findNavPath(start, goal, blocked = new Set()) {
    return findNavPath(this.navGraph || createDefaultNavGraph(), start, goal, blocked);
  }

  _applyLocalAvoidance(direction, position, blockers) {
    return applyLocalAvoidance(direction, position, blockers);
  }

  _getLocalAvoidanceBlockers(npc, playerPos) {
    const blockers = [];
    if (playerPos) {
      blockers.push({ position: { x: playerPos.x, z: playerPos.z }, radius: 0.45 });
    }
    for (const other of this.npcs) {
      if (other === npc) continue;
      blockers.push({
        position: { x: other.group.position.x, z: other.group.position.z },
        radius: other.collisionRadius || 0.5,
      });
    }
    for (const collider of this.contactLayer?.colliders?.values?.() || []) {
      if (!collider.solid || collider.shape !== 'aabb') continue;
      const dx = Math.abs(npc.group.position.x - collider.position.x);
      const dz = Math.abs(npc.group.position.z - collider.position.z);
      if (dx < collider.halfExtents.x + 1.2 && dz < collider.halfExtents.z + 1.2) {
        blockers.push({
          position: collider.position,
          radius: Math.max(collider.halfExtents.x, collider.halfExtents.z),
        });
      }
    }
    return blockers;
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
    const approach = playerVelX * toNpcX + playerVelZ * toNpcZ;
    const pushImpulse =
      (Math.max(0, approach) + Math.max(0, 0.55 - dist)) *
      (npc.pushWeight || 0.45) *
      this.playerPushStrength;

    if (pushImpulse < 0.015) return;

    const moveBy = (0.12 + Math.min(0.6, playerSpeed * 0.4)) * pushImpulse * dt;
    if (npc.isSeated) return;

    npc.group.position.x += toNpcX * moveBy;
    npc.group.position.z += toNpcZ * moveBy;
  }

  /* --- HELPER SELECTORS --- */

  _getRandomSkin() {
    const skins = ['#f5c396', '#fcd2a1', '#e5a073', '#d49060', '#f2ab7e', '#eccda5'];
    return skins[Math.floor(this.random() * skins.length)];
  }

  _getRandomCozyColor(excludeColor = null) {
    // Premium, natural organic clothing tones
    const cozyColors = [
      '#e1c7a5', // warm oatmeal beige
      '#a24a38', // rust-red terracotta
      '#255232', // forest pine green
      '#8a8a92', // heather grey wool
      '#1c284f', // cozy navy blue flannel
      '#eae4d8', // cream wool cable-knit
      '#5c3d28', // chestnut corduroy brown
      '#cda45d', // mustard-yellow gold
    ];
    let col = cozyColors[Math.floor(this.random() * cozyColors.length)];
    while (col === excludeColor) {
      col = cozyColors[Math.floor(this.random() * cozyColors.length)];
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
    if (this.cameraBodyGeo) this.cameraBodyGeo.dispose();
    if (this.cameraLensGeo) this.cameraLensGeo.dispose();
    if (this.cameraFlashGeo) this.cameraFlashGeo.dispose();
    if (this.cameraGripGeo) this.cameraGripGeo.dispose();
    if (this.cameraBodyMat) this.cameraBodyMat.dispose();
    if (this.cameraLensMat) this.cameraLensMat.dispose();
    if (this.cameraFlashMat) this.cameraFlashMat.dispose();

    this.npcs.forEach((npc) => {
      npc.group.traverse((child) => {
        if (child.isMesh) {
          if (
            child.geometry &&
            child.geometry !== this.torsoGeo &&
            child.geometry !== this.headGeo &&
            child.geometry !== this.armGeo &&
            child.geometry !== this.handGeo &&
            child.geometry !== this.legGeo &&
            child.geometry !== this.shoeGeo &&
            child.geometry !== this.glassGeo &&
            child.geometry !== this.cameraBodyGeo &&
            child.geometry !== this.cameraLensGeo &&
            child.geometry !== this.cameraFlashGeo &&
            child.geometry !== this.cameraGripGeo
          ) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                if (
                  mat !== this.shoeMat &&
                  mat !== this.glassMat &&
                  mat !== this.cameraBodyMat &&
                  mat !== this.cameraLensMat &&
                  mat !== this.cameraFlashMat
                ) {
                  if (mat.map) mat.map.dispose();
                  mat.dispose();
                }
              });
            } else if (
              child.material !== this.shoeMat &&
              child.material !== this.glassMat &&
              child.material !== this.cameraBodyMat &&
              child.material !== this.cameraLensMat &&
              child.material !== this.cameraFlashMat
            ) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });
    });
  }
}

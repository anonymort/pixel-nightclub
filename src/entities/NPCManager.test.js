import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyStandingDanceMotion,
  calculateFacingAngle,
  getPhotographerFlashInterval,
  getNpcUpdateMode,
  NPCManager,
  updatePhotographerFlash,
  updatePhotographerTriggerState,
} from './NPCManager.js';
import { ContactLayer } from '../utils/ContactLayer.js';

function createNpc(overrides = {}) {
  return {
    id: overrides.id || 'npc',
    role: overrides.role || 'standing patron',
    group: {
      position: new THREE.Vector3(overrides.x || 0, overrides.y || 0, overrides.z || 0),
      rotation: new THREE.Euler(),
    },
    joints: {
      head: { rotation: new THREE.Euler() },
      leftArm: { rotation: new THREE.Euler(), children: [] },
      rightArm: { rotation: new THREE.Euler(), children: [] },
      leftLeg: { rotation: new THREE.Euler() },
      rightLeg: { rotation: new THREE.Euler() },
    },
    baseRotationY: overrides.baseRotationY || 0,
    collisionRadius: overrides.collisionRadius || 0.5,
    contactWeight: overrides.contactWeight || 1,
    canBePushed: overrides.canBePushed ?? true,
    anchor: new THREE.Vector3(
      overrides.anchorX || 0,
      overrides.anchorY || 0,
      overrides.anchorZ || 0
    ),
    ...overrides,
  };
}

describe('NPCManager steering helpers', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  it('uses field-of-view and close-range fallback for player reactions', () => {
    const manager = Object.create(NPCManager.prototype);

    const npc = createNpc({ baseRotationY: 0 });

    expect(manager._canReactToPlayer(npc, new THREE.Vector3(0, 0, -2.2))).toBe(true);
    expect(manager._canReactToPlayer(npc, new THREE.Vector3(0, 0, 2.2))).toBe(false);
    expect(manager._canReactToPlayer(npc, new THREE.Vector3(0, 0, 0.9))).toBe(true);
  });

  it('applies a wave cooldown so reactions are not spammed', () => {
    const manager = Object.create(NPCManager.prototype);
    const npc = createNpc({ lastWaveTime: -10, waveCooldown: 4 });

    expect(manager._canWaveAtPlayer(npc, 1, 10)).toBe(true);
    manager._markWave(npc, 10);
    expect(manager._canWaveAtPlayer(npc, 1, 12)).toBe(false);
    expect(manager._canWaveAtPlayer(npc, 1, 14.1)).toBe(true);
  });

  it('moves pushed NPCs back toward their role anchor', () => {
    const manager = Object.create(NPCManager.prototype);
    const npc = createNpc({ x: 2.5, anchorX: 0, returnStrength: 2 });

    manager._applyAnchorReturn(npc, 0.5);

    expect(npc.group.position.x).toBeLessThan(2.5);
    expect(npc.group.position.x).toBeGreaterThan(0);
  });

  it('routes wanderers between nav graph nodes instead of direct furniture crossings', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.navGraph = NPCManager.createDefaultNavGraph();

    const path = manager._findNavPath('lobby', 'lounge');

    expect(path).toEqual(['lobby', 'hall-center', 'lounge']);
  });

  it('falls back to the current node when a path is temporarily blocked', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.navGraph = NPCManager.createDefaultNavGraph();

    const path = manager._findNavPath('lobby', 'lounge', new Set(['hall-center']));

    expect(path).toEqual(['lobby']);
  });

  it('adds local avoidance when another body blocks a route', () => {
    const manager = Object.create(NPCManager.prototype);
    const direction = manager._applyLocalAvoidance({ x: 1, z: 0 }, { x: 0, z: 0 }, [
      { position: { x: 0.55, z: 0 }, radius: 0.5 },
    ]);

    expect(direction.x).toBeGreaterThan(0);
    expect(Math.abs(direction.z)).toBeGreaterThan(0);
  });

  it('registers NPC bodies in the shared contact layer and syncs resolved positions', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.contactLayer = new ContactLayer();
    manager.npcs = [
      createNpc({ id: 'a', x: 0, collisionRadius: 0.5, contactWeight: 0.5 }),
      createNpc({ id: 'b', x: 0.7, collisionRadius: 0.5, contactWeight: 4 }),
    ];

    manager._syncNpcContactColliders();
    manager._resolveNpcCrowding();

    expect(manager.contactLayer.colliders.get('npc-a')).toBeTruthy();
    expect(manager.npcs[0].group.position.x).toBeLessThan(0);
    expect(manager.npcs[1].group.position.x).toBeGreaterThan(0.7);
  });

  it('adopts player-pushed contact-layer positions for light NPCs', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.contactLayer = new ContactLayer();
    const npc = createNpc({ id: 'light', x: 0.7, collisionRadius: 0.5, contactWeight: 0.5 });
    manager.npcs = [npc];
    manager._syncNpcContactColliders();

    manager.contactLayer.moveCircle(
      { x: 0, z: 0 },
      { x: 0.35, z: 0 },
      { radius: 0.45, category: 'player', contactWeight: 1 }
    );
    manager._applyContactColliderPositions();

    expect(npc.group.position.x).toBeGreaterThan(0.7);
  });

  it('keeps seated and staff NPCs from being moved far by player contact', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.contactLayer = new ContactLayer();
    const bartender = createNpc({
      id: 'staff',
      role: 'bartender',
      x: 0.7,
      collisionRadius: 0.5,
      contactWeight: 12,
      canBePushed: false,
    });
    manager.npcs = [bartender];
    manager._syncNpcContactColliders();

    manager.contactLayer.moveCircle(
      { x: 0, z: 0 },
      { x: 0.35, z: 0 },
      { radius: 0.45, category: 'player', contactWeight: 1 }
    );
    manager._applyContactColliderPositions();

    expect(bartender.group.position.x - 0.7).toBeLessThan(0.04);
  });
});

describe('NPCManager performance helpers', () => {
  it('chooses full, pose-only, and sleep update modes by player distance', () => {
    expect(getNpcUpdateMode(createNpc({ x: 0, z: 0 }), new THREE.Vector3(2, 0, 0))).toBe('full');
    expect(getNpcUpdateMode(createNpc({ x: 0, z: 0 }), new THREE.Vector3(11, 0, 0))).toBe(
      'poseOnly'
    );
    expect(getNpcUpdateMode(createNpc({ x: 0, z: 0 }), new THREE.Vector3(19, 0, 0))).toBe('sleep');
  });

  it('keeps photographers and staff responsive while player is near their work zone', () => {
    expect(
      getNpcUpdateMode(
        createNpc({ role: 'photographer', danceType: 75, x: -8.3, z: -3.4 }),
        new THREE.Vector3(-5.2, 0, -2.8)
      )
    ).toBe('full');
    expect(
      getNpcUpdateMode(
        createNpc({ role: 'bartender', danceType: 50, x: 9, z: 8.8 }),
        new THREE.Vector3(13, 0, 8.8)
      )
    ).toBe('full');
  });

  it('keeps wanderers on full updates while they are mid-walk so poses do not freeze', () => {
    expect(
      getNpcUpdateMode(
        createNpc({ role: 'wanderer', isWanderer: true, state: 'walking', x: 0, z: 0 }),
        new THREE.Vector3(11, 0, 0)
      )
    ).toBe('full');
  });

  it('resolves crowding only for active NPCs', () => {
    const manager = Object.create(NPCManager.prototype);
    const active = createNpc({
      id: 'active',
      x: 0,
      collisionRadius: 0.5,
      contactWeight: 1,
      updateMode: 'full',
    });
    const sleeping = createNpc({
      id: 'sleeping',
      x: 0.6,
      collisionRadius: 0.5,
      contactWeight: 1,
      updateMode: 'sleep',
    });
    active.contactCollider = {
      position: { x: 1, z: 0 },
      radius: 0.5,
      contactWeight: 1,
    };
    sleeping.contactCollider = {
      position: { x: 2, z: 0 },
      radius: 0.5,
      contactWeight: 1,
    };
    manager.npcs = [active, sleeping];
    manager.contactLayer = {
      resolveDynamicContacts: vi.fn(() => {
        active.contactCollider.position.x = 1;
      }),
    };

    manager._resolveNpcCrowding(1 / 60, [active]);

    expect(active.group.position.x).toBeGreaterThan(0);
    expect(sleeping.group.position.x).toBe(0.6);
  });
});

describe('standing NPC dance animation', () => {
  it('keeps moving through off-beat frames instead of only jolting on beats', () => {
    const npc = createNpc({ danceType: 2, dancePhase: 0.4, danceSpeed: 1, baseRotationY: 0.25 });

    applyStandingDanceMotion(npc, {
      beatIntensity: 0,
      dt: 1,
      isLookingAtPlayer: false,
      isWavingAtPlayer: false,
      time: 1,
    });
    const firstPose = {
      bodyLean: npc.group.rotation.z,
      leftArm: npc.joints.leftArm.rotation.x,
      rightArm: npc.joints.rightArm.rotation.z,
      leftLeg: npc.joints.leftLeg.rotation.x,
      rightLeg: npc.joints.rightLeg.rotation.x,
    };

    applyStandingDanceMotion(npc, {
      beatIntensity: 0,
      dt: 1,
      isLookingAtPlayer: false,
      isWavingAtPlayer: false,
      time: 1.45,
    });

    expect(Math.abs(npc.group.rotation.z - firstPose.bodyLean)).toBeGreaterThan(0.025);
    expect(Math.abs(npc.joints.leftArm.rotation.x - firstPose.leftArm)).toBeGreaterThan(0.04);
    expect(Math.abs(npc.joints.rightArm.rotation.z - firstPose.rightArm)).toBeGreaterThan(0.04);
    expect(Math.abs(npc.joints.leftLeg.rotation.x - firstPose.leftLeg)).toBeGreaterThan(0.04);
    expect(Math.abs(npc.joints.rightLeg.rotation.x - firstPose.rightLeg)).toBeGreaterThan(0.04);
  });

  it('gives each standing dance type a distinct full-body pose', () => {
    const poses = [0, 1, 2, 3].map((danceType) => {
      const npc = createNpc({
        danceType,
        dancePhase: 0.2,
        danceSpeed: 1,
        baseRotationY: 0,
      });

      applyStandingDanceMotion(npc, {
        beatIntensity: 0.35,
        dt: 1,
        isLookingAtPlayer: false,
        isWavingAtPlayer: false,
        time: 2.1,
      });

      return [
        npc.group.rotation.y.toFixed(3),
        npc.group.rotation.z.toFixed(3),
        npc.joints.leftArm.rotation.x.toFixed(3),
        npc.joints.leftArm.rotation.z.toFixed(3),
        npc.joints.rightArm.rotation.x.toFixed(3),
        npc.joints.rightArm.rotation.z.toFixed(3),
        npc.joints.leftLeg.rotation.x.toFixed(3),
        npc.joints.rightLeg.rotation.x.toFixed(3),
      ].join('|');
    });

    expect(new Set(poses).size).toBe(4);
  });

  it('uses per-NPC personality so matching dance types do not mirror each other', () => {
    const shyNpc = createNpc({
      danceType: 1,
      dancePhase: 0.5,
      danceSpeed: 1,
      danceAmplitude: 0.65,
      danceEnergy: 0.8,
      danceExpression: 0,
      danceAccentPhase: 0,
    });
    const expressiveNpc = createNpc({
      danceType: 1,
      dancePhase: 0.5,
      danceSpeed: 1,
      danceAmplitude: 1.35,
      danceEnergy: 1.2,
      danceExpression: 0.8,
      danceAccentPhase: 2.4,
    });

    [shyNpc, expressiveNpc].forEach((npc) => {
      applyStandingDanceMotion(npc, {
        beatIntensity: 0.25,
        dt: 1,
        isLookingAtPlayer: false,
        isWavingAtPlayer: false,
        time: 3.2,
      });
    });

    const differences = [
      Math.abs(shyNpc.group.rotation.z - expressiveNpc.group.rotation.z),
      Math.abs(shyNpc.joints.head.rotation.x - expressiveNpc.joints.head.rotation.x),
      Math.abs(shyNpc.joints.leftArm.rotation.z - expressiveNpc.joints.leftArm.rotation.z),
      Math.abs(shyNpc.joints.rightLeg.rotation.y - expressiveNpc.joints.rightLeg.rotation.y),
    ];

    expect(differences.filter((difference) => difference > 0.04)).toHaveLength(4);
  });

  it('adds occasional expressionist accents across body and arms', () => {
    const calmNpc = createNpc({
      danceType: 3,
      dancePhase: 0,
      danceSpeed: 1,
      danceAmplitude: 1,
      danceEnergy: 1,
      danceExpression: 0,
      danceAccentPhase: 0,
    });
    const accentNpc = createNpc({
      danceType: 3,
      dancePhase: 0,
      danceSpeed: 1,
      danceAmplitude: 1,
      danceEnergy: 1,
      danceExpression: 1,
      danceAccentPhase: 0,
    });

    [calmNpc, accentNpc].forEach((npc) => {
      applyStandingDanceMotion(npc, {
        beatIntensity: 0,
        dt: 1,
        isLookingAtPlayer: false,
        isWavingAtPlayer: false,
        time: 2.18,
      });
    });

    expect(Math.abs(accentNpc.group.rotation.z - calmNpc.group.rotation.z)).toBeGreaterThan(0.08);
    expect(
      Math.abs(accentNpc.joints.head.rotation.y - calmNpc.joints.head.rotation.y)
    ).toBeGreaterThan(0.08);
    expect(
      Math.abs(accentNpc.joints.leftArm.rotation.z - calmNpc.joints.leftArm.rotation.z)
    ).toBeGreaterThan(0.12);
    expect(
      Math.abs(accentNpc.joints.rightArm.rotation.y - calmNpc.joints.rightArm.rotation.y)
    ).toBeGreaterThan(0.08);
  });
});

describe('photographer entrance behavior', () => {
  it('mounts the camera in front of the photographer body', () => {
    const manager = Object.create(NPCManager.prototype);
    manager.cameraBodyGeo = new THREE.BoxGeometry(0.18, 0.12, 0.1);
    manager.cameraLensGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.08, 10);
    manager.cameraFlashGeo = new THREE.BoxGeometry(0.045, 0.035, 0.02);
    manager.cameraGripGeo = new THREE.BoxGeometry(0.06, 0.16, 0.08);
    manager.cameraBodyMat = new THREE.MeshBasicMaterial();
    manager.cameraLensMat = new THREE.MeshBasicMaterial();
    manager.cameraFlashMat = new THREE.MeshBasicMaterial();
    const photographer = createNpc();
    photographer.group = new THREE.Group();

    manager._attachCamera(photographer);

    const cameraGroup = photographer.group.children[0];
    const body = cameraGroup.children[0];
    const lens = cameraGroup.children[1];
    const flash = cameraGroup.children[2];
    const leftGrip = cameraGroup.children[3];
    const rightGrip = cameraGroup.children[4];
    const light = cameraGroup.children[5];

    expect(cameraGroup.position.z).toBeLessThan(0);
    expect(lens.position.z).toBeLessThan(body.position.z);
    expect(flash.position.z).toBeLessThan(body.position.z);
    expect(leftGrip.position.x).toBeLessThan(body.position.x);
    expect(rightGrip.position.x).toBeGreaterThan(body.position.x);
    expect(light.position.z).toBeLessThan(body.position.z);
  });

  it('faces photographers toward the rope line instead of the entrance door', () => {
    const facing = calculateFacingAngle({ x: -8.35, z: -3.45 }, { x: -8.35, z: -2.8 });

    expect(Math.abs(facing)).toBeCloseTo(Math.PI);
  });

  it('activates only when the player crosses from inside to outside', () => {
    let state = updatePhotographerTriggerState(undefined, -3.8);

    expect(state.isActive).toBe(false);

    state = updatePhotographerTriggerState(state, -5.1);

    expect(state.isActive).toBe(true);
  });

  it('stops photographing when the player re-enters the club', () => {
    let state = updatePhotographerTriggerState({ isActive: true, lastZone: 'outside' }, -5.6);

    expect(state.isActive).toBe(true);

    state = updatePhotographerTriggerState(state, -4.0);

    expect(state.isActive).toBe(false);
  });

  it('keeps photographer flash intervals staggered and between one and two seconds', () => {
    const firstInterval = getPhotographerFlashInterval(0);
    const secondInterval = getPhotographerFlashInterval(1);

    expect(firstInterval).toBeGreaterThanOrEqual(1);
    expect(firstInterval).toBeLessThanOrEqual(2);
    expect(secondInterval).toBeGreaterThanOrEqual(1);
    expect(secondInterval).toBeLessThanOrEqual(2);
    expect(firstInterval).not.toBe(secondInterval);
  });

  it('flashes repeatedly while active and resets when inactive', () => {
    const photographer = createNpc({
      nextFlashTime: 1.2,
      flashInterval: 1.2,
      flashDuration: 0.12,
      flashUntil: 0,
    });

    expect(updatePhotographerFlash(photographer, 1.1, true)).toBe(false);
    expect(updatePhotographerFlash(photographer, 1.2, true)).toBe(true);
    expect(photographer.nextFlashTime).toBeCloseTo(2.4);
    expect(photographer.flashUntil).toBeCloseTo(1.32);

    updatePhotographerFlash(photographer, 1.4, false);

    expect(photographer.flashUntil).toBe(0);
    expect(photographer.nextFlashTime).toBeCloseTo(2.6);
  });

  it('supports an explicit souvenir flash without breaking ambient flash state', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    const manager = Object.create(NPCManager.prototype);
    manager.photographers = [createNpc({ id: 'photographer-1', snapshotFlashUntil: 0 })];

    manager.triggerPhotographerSnapshot(0);

    expect(manager.photographers[0].snapshotFlashUntil).toBeCloseTo(1.18);
    expect(manager.photographers[0].flashUntil).toBeCloseTo(1.18);
  });
});

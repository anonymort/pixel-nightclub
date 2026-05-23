import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NPCManager } from './NPCManager.js';
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
    anchor: new THREE.Vector3(overrides.anchorX || 0, overrides.anchorY || 0, overrides.anchorZ || 0),
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
    const direction = manager._applyLocalAvoidance(
      { x: 1, z: 0 },
      { x: 0, z: 0 },
      [{ position: { x: 0.55, z: 0 }, radius: 0.5 }]
    );

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

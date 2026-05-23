import { describe, expect, it } from 'vitest';
import { ContactLayer } from './ContactLayer.js';

describe('ContactLayer', () => {
  it('slides a circle along a flat wall by projecting movement on the contact normal', () => {
    const layer = new ContactLayer();
    layer.addCollider({
      id: 'wall',
      type: 'wall',
      category: 'wall',
      solid: true,
      shape: 'aabb',
      position: { x: 2, z: 0 },
      halfExtents: { x: 0.25, z: 4 },
      contactWeight: Infinity,
    });

    const result = layer.moveCircle(
      { x: 0, z: 0 },
      { x: 3, z: 1 },
      { radius: 0.45, category: 'player' }
    );

    expect(result.position.x).toBeLessThanOrEqual(1.55);
    expect(result.position.z).toBeGreaterThan(0.7);
    expect(result.contacts.some((contact) => contact.collider.id === 'wall')).toBe(true);
  });

  it('resolves corner contact without leaving a circle inside either wall', () => {
    const layer = new ContactLayer();
    layer.addCollider({
      id: 'east-wall',
      type: 'wall',
      category: 'wall',
      solid: true,
      shape: 'aabb',
      position: { x: 2, z: 0 },
      halfExtents: { x: 0.25, z: 4 },
      contactWeight: Infinity,
    });
    layer.addCollider({
      id: 'south-wall',
      type: 'wall',
      category: 'wall',
      solid: true,
      shape: 'aabb',
      position: { x: 0, z: 2 },
      halfExtents: { x: 4, z: 0.25 },
      contactWeight: Infinity,
    });

    const result = layer.moveCircle(
      { x: 0, z: 0 },
      { x: 3, z: 3 },
      { radius: 0.45, category: 'player' }
    );

    expect(result.position.x).toBeLessThanOrEqual(1.55);
    expect(result.position.z).toBeLessThanOrEqual(1.55);
  });

  it('ignores trigger-only colliders for solid movement', () => {
    const layer = new ContactLayer();
    layer.addCollider({
      id: 'music-trigger',
      type: 'trigger',
      category: 'trigger',
      solid: false,
      shape: 'aabb',
      position: { x: 1, z: 0 },
      halfExtents: { x: 0.5, z: 0.5 },
      contactWeight: 0,
    });

    const result = layer.moveCircle(
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { radius: 0.45, category: 'player' }
    );

    expect(result.position.x).toBeCloseTo(2);
    expect(result.contacts).toHaveLength(0);
  });

  it('does not jitter when starting near but outside a wall skin width', () => {
    const layer = new ContactLayer({ skinWidth: 0.03 });
    layer.addCollider({
      id: 'wall',
      type: 'wall',
      category: 'wall',
      solid: true,
      shape: 'aabb',
      position: { x: 1.5, z: 0 },
      halfExtents: { x: 0.5, z: 2 },
      contactWeight: Infinity,
    });

    const start = { x: 0.52, z: 0 };
    const result = layer.moveCircle(start, { x: 0, z: 0 }, { radius: 0.45, category: 'player' });

    expect(result.position.x).toBeCloseTo(start.x, 5);
    expect(result.position.z).toBeCloseTo(start.z, 5);
  });

  it('keeps tangent motion when starting next to an expanded wall sweep volume', () => {
    const layer = new ContactLayer({ skinWidth: 0.03 });
    layer.addCollider({
      id: 'door-jamb',
      type: 'wall',
      category: 'wall',
      solid: true,
      shape: 'aabb',
      position: { x: -4.8, z: -2.0 },
      halfExtents: { x: 0.4, z: 0.2 },
      contactWeight: Infinity,
    });

    const result = layer.moveCircle(
      { x: -5.65, z: -1.55 },
      { x: 0.3, z: 0.45 },
      { radius: 0.45, category: 'player' }
    );

    expect(result.position.z).toBeGreaterThan(-1.2);
    expect(result.delta.z).toBeGreaterThan(0.3);
  });

  it('separates weighted circle bodies without overshooting', () => {
    const layer = new ContactLayer();
    const light = layer.addCollider({
      id: 'light',
      type: 'softNpc',
      category: 'npc',
      solid: true,
      shape: 'circle',
      position: { x: 0, z: 0 },
      radius: 0.5,
      contactWeight: 0.4,
    });
    const heavy = layer.addCollider({
      id: 'heavy',
      type: 'npc',
      category: 'npc',
      solid: true,
      shape: 'circle',
      position: { x: 0.7, z: 0 },
      radius: 0.5,
      contactWeight: 4,
    });

    const contacts = layer.resolveDynamicContacts();

    expect(contacts).toHaveLength(1);
    expect(light.position.x).toBeLessThan(0);
    expect(heavy.position.x).toBeGreaterThan(0.7);
    expect(heavy.position.x - 0.7).toBeLessThan(Math.abs(light.position.x));
    expect(heavy.position.x - light.position.x).toBeCloseTo(1, 5);
  });
});

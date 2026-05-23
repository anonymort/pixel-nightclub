import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlsManager, requestPointerLockSafely } from './ControlsManager.js';

function createDomElement() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestPointerLock: vi.fn(() => Promise.resolve()),
  };
}

function createControls() {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.7, 0);
  const controls = new ControlsManager(camera, createDomElement());
  controls.isLocked = true;
  return controls;
}

describe('requestPointerLockSafely', () => {
  it('resolves when pointer lock is denied by the browser', async () => {
    const domElement = {
      requestPointerLock: vi.fn(() => Promise.reject(new DOMException('denied', 'SecurityError'))),
    };

    await expect(requestPointerLockSafely(domElement)).resolves.toBe(false);
    expect(domElement.requestPointerLock).toHaveBeenCalledTimes(1);
  });
});

describe('ControlsManager movement tuning', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      pointerLockElement: null,
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes explicit walk and run speed caps with a 1.25x sprint design', () => {
    const controls = createControls();

    expect(controls.walkMaxSpeed).toBeGreaterThan(0);
    expect(controls.runMaxSpeed).toBeCloseTo(controls.walkMaxSpeed * 1.25, 5);
    expect(controls.acceleration).toBeGreaterThan(controls.walkMaxSpeed);
    expect(controls.deceleration).toBeGreaterThan(0);
    expect(controls.friction).toBeGreaterThan(0);
  });

  it('caps walk speed and normalizes diagonal movement', () => {
    const controls = createControls();
    controls.keys.forward = true;
    controls.keys.right = true;

    for (let i = 0; i < 240; i++) {
      controls.update(1 / 60);
    }

    expect(Math.hypot(controls.velocity.x, controls.velocity.z)).toBeLessThanOrEqual(
      controls.walkMaxSpeed + 0.001
    );
  });

  it('caps run speed separately from walk speed', () => {
    const controls = createControls();
    controls.keys.forward = true;
    controls.keys.run = true;

    for (let i = 0; i < 240; i++) {
      controls.update(1 / 60);
    }

    expect(Math.hypot(controls.velocity.x, controls.velocity.z)).toBeLessThanOrEqual(
      controls.runMaxSpeed + 0.001
    );
    expect(Math.hypot(controls.velocity.x, controls.velocity.z)).toBeGreaterThan(
      controls.walkMaxSpeed
    );
  });

  it('uses frame-rate-stable velocity decay when input stops', () => {
    const sixtyFps = createControls();
    const thirtyFps = createControls();
    sixtyFps.velocity.set(3, 0, 0);
    thirtyFps.velocity.set(3, 0, 0);

    for (let i = 0; i < 60; i++) sixtyFps.update(1 / 60);
    for (let i = 0; i < 30; i++) thirtyFps.update(1 / 30);

    expect(sixtyFps.velocity.x).toBeCloseTo(thirtyFps.velocity.x, 2);
  });

  it('resets velocity on blur and pointer unlock', () => {
    const controls = createControls();
    controls.velocity.set(1, 0, 1);
    controls.keys.forward = true;

    controls._onBlur();
    expect(controls.velocity.length()).toBe(0);
    expect(controls.keys.forward).toBe(false);

    controls.velocity.set(1, 0, 0);
    controls.isLocked = false;
    controls.update(1 / 60);
    expect(controls.velocity.length()).toBe(0);
  });

  it('does not register overhead lintels as player-blocking 2D contact colliders', () => {
    const controls = createControls();

    controls.registerCollisionBox(
      new THREE.Box3(new THREE.Vector3(-5.2, 3.5, -2.0), new THREE.Vector3(-4.4, 5.0, 2.0))
    );

    expect(controls.contactLayer.colliders.size).toBe(0);
  });

  it('starts a realistic jump from the ground when Space is pressed', () => {
    const controls = createControls();

    controls._onKeyStateChange({ code: 'Space' }, true);
    controls.update(1 / 60);

    expect(controls.isGrounded).toBe(false);
    expect(controls.verticalVelocity).toBeGreaterThan(0);
    expect(controls.camera.position.y).toBeGreaterThan(controls.eyeHeight);
  });

  it('lands back on the floor after a jump arc', () => {
    const controls = createControls();

    controls._onKeyStateChange({ code: 'Space' }, true);
    for (let i = 0; i < 120; i++) controls.update(1 / 60);

    expect(controls.isGrounded).toBe(true);
    expect(controls.verticalVelocity).toBe(0);
    expect(controls.camera.position.y).toBeCloseTo(controls.eyeHeight);
  });

  it('lands on explicit climbable surfaces while moving across them', () => {
    const controls = createControls();
    controls.registerClimbableBox(
      new THREE.Box3(new THREE.Vector3(1, 0, -1), new THREE.Vector3(3, 1.1, 1))
    );
    controls.camera.position.set(0.8, controls.eyeHeight, 0);
    controls.velocity.set(2.4, 0, 0);
    controls._onKeyStateChange({ code: 'Space' }, true);

    for (let i = 0; i < 90; i++) controls.update(1 / 60);

    expect(controls.currentGroundY).toBeCloseTo(1.1);
    expect(controls.camera.position.y).toBeCloseTo(controls.eyeHeight + 1.1);
    expect(controls.isGrounded).toBe(true);
  });

  it('does not land on unregistered solid furniture tops', () => {
    const controls = createControls();
    controls.registerCollisionBox(
      new THREE.Box3(new THREE.Vector3(1, 0, -1), new THREE.Vector3(3, 1.1, 1))
    );
    controls.camera.position.set(0.8, controls.eyeHeight, 0);
    controls.velocity.set(2.4, 0, 0);
    controls._onKeyStateChange({ code: 'Space' }, true);

    for (let i = 0; i < 90; i++) controls.update(1 / 60);

    expect(controls.currentGroundY).toBe(0);
    expect(controls.camera.position.y).toBeCloseTo(controls.eyeHeight);
  });

  it('seats the player at the anchor and suppresses movement while seated', () => {
    const controls = createControls();
    controls.setSeated({ anchorX: 7.2, anchorZ: 5.6, eyeHeight: 1.0 });

    expect(controls.isSeated).toBe(true);
    expect(controls.eyeHeight).toBe(1.0);
    expect(controls.camera.position.x).toBeCloseTo(7.2);
    expect(controls.camera.position.z).toBeCloseTo(5.6);
    expect(controls.camera.position.y).toBeCloseTo(1.0);

    controls.keys.forward = true;
    controls.keys.right = true;
    for (let i = 0; i < 30; i++) controls.update(1 / 60);

    expect(controls.camera.position.x).toBeCloseTo(7.2);
    expect(controls.camera.position.z).toBeCloseTo(5.6);
    expect(controls.velocity.lengthSq()).toBeCloseTo(0);
  });

  it('stands the player back up at the standing eye height', () => {
    const controls = createControls();
    controls.setSeated({ anchorX: 10.5, anchorZ: -17.0, eyeHeight: 0.85 });
    controls.standUp();

    expect(controls.isSeated).toBe(false);
    expect(controls.seatedAnchor).toBeNull();
    expect(controls.eyeHeight).toBe(controls.standingEyeHeight);
    expect(controls.camera.position.y).toBeCloseTo(controls.standingEyeHeight);
  });

  it('queues an interact request on E keydown', () => {
    const controls = createControls();
    expect(controls.interactQueued).toBe(false);
    controls._onKeyStateChange({ code: 'KeyE' }, true);
    expect(controls.interactQueued).toBe(true);
  });
});

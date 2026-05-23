import * as THREE from 'three';
import { ContactLayer } from '../utils/ContactLayer.js';

export async function requestPointerLockSafely(domElement) {
  if (!domElement || typeof domElement.requestPointerLock !== 'function') {
    return false;
  }

  try {
    await domElement.requestPointerLock();
    return true;
  } catch {
    return false;
  }
}

export class ControlsManager {
  /**
   * @param {THREE.Camera} camera - Three.js active camera
   * @param {HTMLElement} domElement - Canvas element for pointer lock binding
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Ensure camera rotation order is YXZ to avoid gimbal lock during FPS look
    this.camera.rotation.order = 'YXZ';

    this.isLocked = false;
    this.mouseSensitivity = 0.0022;
    this.walkMaxSpeed = 2.35;
    this.runMaxSpeed = this.walkMaxSpeed * 1.25;
    this.acceleration = 18.0;
    this.deceleration = 8.5;
    this.friction = 10.0;
    this.moveSpeed = this.acceleration;
    this.standingEyeHeight = 1.7;
    this.eyeHeight = this.standingEyeHeight;
    this.gravity = 9.8;
    this.jumpVelocity = 5.4;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.currentGroundY = 0;
    this.jumpQueued = false;
    this.climbableSurfaces = [];

    // Seated interaction state — when true the update loop locks the camera
    // to seatedAnchor (xz) and seatedAnchor.eyeHeight, but mouse-look still works.
    this.isSeated = false;
    this.seatedAnchor = null;
    // One-shot flag consumed by InteractionManager when E is pressed.
    this.interactQueued = false;

    // Player Physics States
    this.velocity = new THREE.Vector3();
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false,
      jump: false,
    };

    // Collision Boxes array (list of THREE.Box3 objects representing walls/furniture)
    this.collisionBoxes = [];
    this.contactLayer = new ContactLayer();

    // Player half-width for bounding box collision checks
    this.playerRadius = 0.45; // meters
    this.playerCollisionHeight = 3.0;

    this._initListeners();
  }

  /**
   * Installs pointer-lock and keyboard listeners with bound references for leak-free disposal.
   */
  _initListeners() {
    // 1. Define bound handler functions
    this._onClick = () => {
      if (!this.isLocked) {
        requestPointerLockSafely(this.domElement);
      }
    };

    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (!this.isLocked) {
        this.velocity.set(0, 0, 0);
      }
    };

    this._onMouseMove = (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      // Yaw (horizontal left/right)
      this.camera.rotation.y -= movementX * this.mouseSensitivity;

      // Pitch (vertical up/down)
      this.camera.rotation.x -= movementY * this.mouseSensitivity;

      // Clamp pitch to avoid turning upside down (85 degrees max)
      const maxPitch = 1.48;
      this.camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, this.camera.rotation.x));
    };

    this._onKeyDown = (e) => this._onKeyStateChange(e, true);
    this._onKeyUp = (e) => this._onKeyStateChange(e, false);

    this._onBlur = () => {
      // Clear movement keys and reset velocity when window loses focus (preventing stuck key bugs)
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.run = false;
      this.keys.jump = false;
      this.jumpQueued = false;
      this.interactQueued = false;
      this.velocity.set(0, 0, 0);
    };

    // 2. Add event listeners
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  /**
   * Cleans up event listeners and resets velocity vectors on destruction.
   */
  dispose() {
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.velocity.set(0, 0, 0);
  }

  /**
   * Map key events to movement direction flags.
   */
  _onKeyStateChange(event, isDown) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.run = isDown;
        break;
      case 'Space':
        this.keys.jump = isDown;
        if (isDown) this.jumpQueued = true;
        break;
      case 'KeyE':
        if (isDown) this.interactQueued = true;
        break;
    }
  }

  /**
   * Places the player on a seat (called by InteractionManager). Mouse-look stays on,
   * but movement input is suppressed and the camera is pinned to the anchor.
   */
  setSeated({ anchorX, anchorZ, eyeHeight }) {
    this.isSeated = true;
    this.seatedAnchor = { x: anchorX, z: anchorZ, eyeHeight };
    this.eyeHeight = eyeHeight;
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.currentGroundY = 0;
    this.camera.position.x = anchorX;
    this.camera.position.z = anchorZ;
    this.camera.position.y = eyeHeight;
  }

  standUp() {
    this.isSeated = false;
    this.seatedAnchor = null;
    this.eyeHeight = this.standingEyeHeight;
    this.camera.position.y = this.standingEyeHeight + this.currentGroundY;
  }

  registerCollider(collider) {
    return this.contactLayer.addCollider(collider);
  }

  registerClimbableBox(box3) {
    if (!(box3 instanceof THREE.Box3)) return null;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box3.getSize(size);
    box3.getCenter(center);
    const surface = {
      minX: box3.min.x,
      maxX: box3.max.x,
      minZ: box3.min.z,
      maxZ: box3.max.z,
      topY: box3.max.y,
    };
    this.climbableSurfaces.push(surface);
    this.contactLayer.addCollider({
      id: `climbable-${this.climbableSurfaces.length}`,
      type: 'furniture',
      category: 'furniture',
      solid: true,
      shape: 'aabb',
      position: { x: center.x, z: center.z },
      halfExtents: { x: size.x / 2, z: size.z / 2 },
      minY: box3.min.y,
      maxY: box3.max.y,
      climbable: true,
      contactWeight: Infinity,
    });
    return surface;
  }

  /**
   * Registers a static solid mesh bounding box into the collision system.
   */
  registerCollisionBox(box3) {
    if (box3 instanceof THREE.Box3) {
      this.collisionBoxes.push(box3);
      if (box3.min.y >= this.playerCollisionHeight || box3.max.y <= 0) {
        return;
      }
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box3.getSize(size);
      box3.getCenter(center);
      this.contactLayer.addCollider({
        id: `static-${this.collisionBoxes.length}`,
        type: 'furniture',
        category: 'furniture',
        solid: true,
        shape: 'aabb',
        position: { x: center.x, z: center.z },
        halfExtents: { x: size.x / 2, z: size.z / 2 },
        minY: box3.min.y,
        maxY: box3.max.y,
        contactWeight: Infinity,
      });
    }
  }

  /**
   * Helper to construct player's 3D bounding box centered on a tentative (x, z) coordinate.
   */
  _getPlayerBox(x, z) {
    // We only care about x/z plane collisions because the floor is flat (y = 1.7)
    // The player box spans slightly below the floor and above the head
    return new THREE.Box3(
      new THREE.Vector3(x - this.playerRadius, 0.0, z - this.playerRadius),
      new THREE.Vector3(x + this.playerRadius, 3.0, z + this.playerRadius)
    );
  }

  /**
   * Checks if a player's box intersects with any registered wall or solid object.
   * @returns {boolean} True if a collision occurs
   */
  _checkCollision(playerBox) {
    for (let i = 0; i < this.collisionBoxes.length; i++) {
      if (playerBox.intersectsBox(this.collisionBoxes[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Updates player position and velocity, resolving boundaries and collisions.
   * @param {number} dt - Delatime (seconds)
   */
  update(dt) {
    if (!this.isLocked) {
      // If pointer lock is released, slow player down quickly and return
      this.velocity.set(0, 0, 0);
      return;
    }

    if (this.isSeated && this.seatedAnchor) {
      this.velocity.set(0, 0, 0);
      this.camera.position.x = this.seatedAnchor.x;
      this.camera.position.z = this.seatedAnchor.z;
      this.camera.position.y = this.seatedAnchor.eyeHeight;
      return;
    }

    // 1. Calculate input heading vector relative to camera direction
    const direction = new THREE.Vector3();
    const front = new THREE.Vector3();
    const side = new THREE.Vector3();

    // Project camera front and side directions onto the flat floor (y = 0 plane)
    this.camera.getWorldDirection(front);
    front.y = 0;
    front.normalize();

    side.crossVectors(front, this.camera.up);
    side.y = 0;
    side.normalize();

    if (this.keys.forward) direction.add(front);
    if (this.keys.backward) direction.sub(front);
    if (this.keys.left) direction.sub(side);
    if (this.keys.right) direction.add(side);

    direction.normalize();

    // 2. Apply explicit acceleration and frame-rate-stable exponential slowdown.
    const hasInput = direction.lengthSq() > 0;
    const maxSpeed = this.keys.run ? this.runMaxSpeed : this.walkMaxSpeed;
    if (hasInput) {
      this.velocity.x += direction.x * this.acceleration * dt;
      this.velocity.z += direction.z * this.acceleration * dt;
      this._clampHorizontalVelocity(maxSpeed);
    } else {
      const damping = Math.exp(-this.deceleration * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;
      if (Math.hypot(this.velocity.x, this.velocity.z) < 0.001) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    this._updateVerticalMotion(dt);

    // 3. Shared 2D contact layer movement with contact-normal projection.
    const start = { x: this.camera.position.x, z: this.camera.position.z };
    const move = { x: this.velocity.x * dt, z: this.velocity.z * dt };
    const result = this.contactLayer.moveCircle(start, move, {
      radius: this.playerRadius,
      category: 'player',
      footY: this.camera.position.y - this.eyeHeight,
      climbClearance: 0.05,
      isAirborne: !this.isGrounded,
    });
    this.camera.position.x = result.position.x;
    this.camera.position.z = result.position.z;
    if (dt > 0) {
      this.velocity.x = result.delta.x / dt;
      this.velocity.z = result.delta.z / dt;
    }

    // 4. Double-check world absolute boundaries (clamping player to within lounge parameters)
    this.camera.position.x = Math.max(-25.0, Math.min(25.0, this.camera.position.x));
    this.camera.position.z = Math.max(-25.0, Math.min(25.0, this.camera.position.z));

    this._updateGroundSupport();
  }

  _clampHorizontalVelocity(maxSpeed) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }
  }

  _updateVerticalMotion(dt) {
    if (this.jumpQueued && this.isGrounded) {
      this.verticalVelocity = this.jumpVelocity;
      this.isGrounded = false;
    }
    this.jumpQueued = false;

    if (this.isGrounded) {
      this.camera.position.y = this.eyeHeight + this.currentGroundY;
      return;
    }

    const previousFootY = this.camera.position.y - this.eyeHeight;
    this.verticalVelocity -= this.gravity * dt;
    let nextFootY = previousFootY + this.verticalVelocity * dt;

    const landingY = this._findLandingSurface(previousFootY, nextFootY);
    if (landingY !== null) {
      this.currentGroundY = landingY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.camera.position.y = this.eyeHeight + landingY;
      return;
    }

    if (nextFootY <= 0) {
      nextFootY = 0;
      this.currentGroundY = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    this.camera.position.y = this.eyeHeight + nextFootY;
  }

  _findLandingSurface(previousFootY, nextFootY) {
    if (this.verticalVelocity > 0) return null;
    let bestY = null;
    for (const surface of this.climbableSurfaces) {
      if (previousFootY < surface.topY || nextFootY > surface.topY) continue;
      if (!this._isOverSurface(surface)) continue;
      if (bestY === null || surface.topY > bestY) bestY = surface.topY;
    }
    return bestY;
  }

  _isOverSurface(surface) {
    const x = this.camera.position.x;
    const z = this.camera.position.z;
    return (
      x + this.playerRadius > surface.minX &&
      x - this.playerRadius < surface.maxX &&
      z + this.playerRadius > surface.minZ &&
      z - this.playerRadius < surface.maxZ
    );
  }

  _updateGroundSupport() {
    if (!this.isGrounded || this.currentGroundY <= 0) return;
    const supported = this.climbableSurfaces.some(
      (surface) =>
        Math.abs(surface.topY - this.currentGroundY) < 0.001 && this._isOverSurface(surface)
    );
    if (!supported) {
      this.isGrounded = false;
      this.verticalVelocity = 0;
    }
  }
}

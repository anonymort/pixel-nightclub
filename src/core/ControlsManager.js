import * as THREE from 'three';

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
    this.moveSpeed = 20.0;      // m/s^2 acceleration (increased by 25%)
    this.friction = 10.0;       // friction damping coefficient

    // Player Physics States
    this.velocity = new THREE.Vector3();
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      run: false
    };

    // Collision Boxes array (list of THREE.Box3 objects representing walls/furniture)
    this.collisionBoxes = [];

    // Player half-width for bounding box collision checks
    this.playerRadius = 0.45; // meters

    this._initListeners();
  }

  /**
   * Installs pointer-lock and keyboard listeners with bound references for leak-free disposal.
   */
  _initListeners() {
    // 1. Define bound handler functions
    this._onClick = () => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
      }
    };

    this._onPointerLockChange = () => {
      this.isLocked = (document.pointerLockElement === this.domElement);
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
    }
  }

  /**
   * Registers a static solid mesh bounding box into the collision system.
   */
  registerCollisionBox(box3) {
    if (box3 instanceof THREE.Box3) {
      this.collisionBoxes.push(box3);
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

    // 2. Apply Acceleration and Friction damping
    // Acceleration: dv/dt = a - friction * v
    const currentSpeed = this.keys.run ? this.moveSpeed * 2.0 : this.moveSpeed;
    const accel = direction.multiplyScalar(currentSpeed);
    
    this.velocity.x += (accel.x - this.friction * this.velocity.x) * dt;
    this.velocity.z += (accel.z - this.friction * this.velocity.z) * dt;

    // 3. Independent Axis Movement & Collision Resolution (Sliding Physics)
    const currentPos = this.camera.position.clone();

    // --- Resolve X Axis ---
    const stepX = this.velocity.x * dt;
    if (Math.abs(stepX) > 0.0001) {
      const targetX = currentPos.x + stepX;
      const testBoxX = this._getPlayerBox(targetX, currentPos.z);
      
      if (!this._checkCollision(testBoxX)) {
        this.camera.position.x = targetX;
      } else {
        // Hit a wall on X: stop X velocity, but allow Z movement sliding!
        this.velocity.x = 0;
      }
    }

    // --- Resolve Z Axis ---
    const stepZ = this.velocity.z * dt;
    if (Math.abs(stepZ) > 0.0001) {
      const targetZ = currentPos.z + stepZ;
      const testBoxZ = this._getPlayerBox(this.camera.position.x, targetZ);
      
      if (!this._checkCollision(testBoxZ)) {
        this.camera.position.z = targetZ;
      } else {
        // Hit a wall on Z: stop Z velocity, but allow X movement sliding!
        this.velocity.z = 0;
      }
    }

    // 4. Double-check world absolute boundaries (clamping player to within club parameters)
    this.camera.position.x = Math.max(-25.0, Math.min(25.0, this.camera.position.x));
    this.camera.position.z = Math.max(-25.0, Math.min(25.0, this.camera.position.z));
    
    // Ensure eye height is perfectly flat on the nightclub floor
    this.camera.position.y = 1.7; 
  }
}

export class UIManager {
  /**
   * @param {AudioManager} audio - Reference to active audio manager
   * @param {ControlsManager} controls - Reference to player controls
   */
  constructor(audio, controls) {
    this.audio = audio;
    this.controls = controls;

    this.lastRoomName = '';
    this.promptTimeoutId = null;

    this._bindElements();
    this._installEventHandlers();
  }

  /**
   * Locates necessary overlay and HUD DOM nodes.
   */
  _bindElements() {
    this.modal = document.getElementById('audio-modal');
    this.btnStart = document.getElementById('btn-start');
    this.roomTag = document.getElementById('active-room-tag');
    this.roomDesc = document.getElementById('active-room-desc');
    this.prompt = document.getElementById('floating-prompt');
    this.beatPulse = document.getElementById('beat-pulse');

    // Store references to the 12 EQ bars
    this.eqBars = [];
    for (let i = 0; i < 12; i++) {
      const bar = document.getElementById(`eq-${i}`);
      if (bar) this.eqBars.push(bar);
    }
  }

  /**
   * Installs VIP ticket button click and pointers.
   */
  _installEventHandlers() {
    if (this.btnStart) {
      this.btnStart.addEventListener('click', async () => {
        // 1. Initialize synthesized audio
        await this.audio.start();

        // 2. Hide Landing Splash Overlay with CSS slide fade
        if (this.modal) {
          this.modal.classList.add('fade-out');
        }

        // 3. Immediately request Pointer Lock to lock user input
        setTimeout(() => {
          if (this.controls && !this.controls.isLocked) {
            this.controls.domElement.requestPointerLock();
          }
        }, 500);

        // 4. Fire initial welcome notification
        this._showFloatingPrompt('VIP MEMBERS ADMITTED — SECTOR 04', 3000);
      });
    }
  }

  /**
   * Shows a gorgeous neon banner in the middle of the screen for room alerts.
   */
  _showFloatingPrompt(text, duration = 2000) {
    if (!this.prompt) return;

    // Reset previous timeouts to avoid overlapping transitions
    clearTimeout(this.promptTimeoutId);

    this.prompt.textContent = text;
    this.prompt.classList.add('show');

    this.promptTimeoutId = setTimeout(() => {
      this.prompt.classList.remove('show');
    }, duration);
  }

  /**
   * Refreshes Equalizers, Room HUD elements, and Beat LEDs.
   */
  update() {
    // 1. Update active room indicators
    const currentRoom = this.audio.currentRoom;
    if (currentRoom) {
      if (this.roomTag) this.roomTag.textContent = currentRoom.name;
      if (this.roomDesc) this.roomDesc.textContent = currentRoom.desc;

      // Detect room transitions to alert player
      if (currentRoom.name !== this.lastRoomName) {
        if (this.lastRoomName !== '') {
          // Play pop-up sound or flash banner
          this._showFloatingPrompt(`ENTERING: ${currentRoom.name}`, 2200);
        }
        this.lastRoomName = currentRoom.name;
      }
    }

    // 2. Update CSS 12-bar frequency equalizer
    const eqData = this.audio.getByteFrequencyData();
    for (let i = 0; i < this.eqBars.length; i++) {
      const byteVal = eqData[i];
      // Convert 0-255 amplitude to 10% to 100% height
      const heightPercent = Math.max(8, (byteVal / 255) * 100);
      this.eqBars[i].style.height = `${heightPercent}%`;
    }

    // 3. Pulse Beat status indicator in sync with synthesizer kicks
    if (this.beatPulse) {
      if (this.audio.isBeatHit) {
        this.beatPulse.style.transform = 'scale(1.4)';
        this.beatPulse.style.backgroundColor = '#ff0055'; // Vibrant pink flare
      } else {
        // Smoothly decay scale back
        this.beatPulse.style.transform = 'scale(1.0)';
        this.beatPulse.style.backgroundColor = '#9e0030'; // Dark red rest
      }
    }
  }
}

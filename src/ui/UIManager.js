import { requestPointerLockSafely } from '../core/ControlsManager.js';
import { SOUVENIR_SNAPSHOT_COPY } from '../config/experience.js';

export class UIManager {
  /**
   * @param {AudioManager} audio - Reference to active audio manager
   * @param {ControlsManager} controls - Reference to player controls
   * @param {InteractionManager} [interactionManager] - Optional interaction manager
   */
  constructor(audio, controls, interactionManager = null) {
    this.audio = audio;
    this.controls = controls;
    this.interactionManager = interactionManager;

    this.lastRoomName = '';
    this.promptTimeoutId = null;
    this.pointerLockTimeoutId = null;
    this.lastInteractText = '';
    this.snapshotUrl = null;
    this.snapshotFileName = '';
    this.snapshotRestorePointerLock = false;

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
    this.interactPrompt = document.getElementById('interact-prompt');
    this.beatPulse = document.getElementById('beat-pulse');
    this.snapshotOverlay = document.getElementById('snapshot-overlay');
    this.snapshotImage = document.getElementById('snapshot-image');
    this.snapshotTitle = document.getElementById('snapshot-title');
    this.snapshotMeta = document.getElementById('snapshot-meta');
    this.snapshotClose = document.getElementById('snapshot-close');
    this.snapshotSave = document.getElementById('snapshot-save');

    if (this.snapshotTitle) this.snapshotTitle.textContent = SOUVENIR_SNAPSHOT_COPY.title;
    if (this.snapshotMeta) this.snapshotMeta.textContent = SOUVENIR_SNAPSHOT_COPY.meta;
    if (this.snapshotSave) this.snapshotSave.textContent = SOUVENIR_SNAPSHOT_COPY.saveAction;
    if (this.snapshotClose) this.snapshotClose.textContent = SOUVENIR_SNAPSHOT_COPY.dismissAction;

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
      this._onStartClick = async () => {
        // 1. Initialize synthesized audio
        await this.audio.start();

        // 2. Hide Landing Splash Overlay with CSS slide fade
        if (this.modal) {
          this.modal.classList.add('fade-out');
        }

        // 3. Immediately request Pointer Lock to lock user input
        this.pointerLockTimeoutId = setTimeout(() => {
          if (this.controls && !this.controls.isLocked) {
            requestPointerLockSafely(this.controls.domElement);
          }
        }, 500);

        // 4. Fire initial welcome notification
        this._showFloatingPrompt('VIP MEMBERS ADMITTED — SECTOR 04', 3000);
      };

      this.btnStart.addEventListener('click', this._onStartClick);
    }

    this._onSnapshotClose = () => {
      this.dismissSnapshotPreview();
    };
    this._onSnapshotSave = () => {
      this._handleSnapshotSave();
    };

    this.snapshotClose?.addEventListener('click', this._onSnapshotClose);
    this.snapshotSave?.addEventListener('click', this._onSnapshotSave);
  }

  /**
   * Shows a warm banner in the middle of the screen for room alerts. Public
   * so InteractionManager and other systems can flash transient messages.
   */
  showFloatingPrompt(text, duration = 2000) {
    if (!this.prompt) return;

    // Reset previous timeouts to avoid overlapping transitions
    clearTimeout(this.promptTimeoutId);

    this.prompt.textContent = text;
    this.prompt.classList.add('show');

    this.promptTimeoutId = setTimeout(() => {
      this.prompt.classList.remove('show');
    }, duration);
  }

  _showFloatingPrompt(text, duration) {
    this.showFloatingPrompt(text, duration);
  }

  async requestPointerLock() {
    return requestPointerLockSafely(this.controls?.domElement);
  }

  async showSnapshotPreview({
    blob,
    title,
    fileName,
    meta = '',
    restorePointerLock = false,
  }) {
    if (!blob) return null;
    await this.dismissSnapshotPreview({ restorePointerLock: false });

    this.snapshotUrl = URL.createObjectURL(blob);
    this.snapshotFileName = fileName || 'hearthside-lounge-souvenir.png';
    this.snapshotRestorePointerLock = restorePointerLock;

    if (this.snapshotTitle) this.snapshotTitle.textContent = title || 'Souvenir Snapshot';
    if (this.snapshotMeta) this.snapshotMeta.textContent = meta;
    if (this.snapshotImage) this.snapshotImage.src = this.snapshotUrl;
    this.snapshotOverlay?.classList.add('show');

    return { url: this.snapshotUrl, fileName: this.snapshotFileName };
  }

  _handleSnapshotSave() {
    if (!this.snapshotUrl) return;
    const link = document.createElement('a');
    link.href = this.snapshotUrl;
    link.download = this.snapshotFileName || 'hearthside-lounge-souvenir.png';
    link.click();
  }

  async dismissSnapshotPreview({ restorePointerLock } = {}) {
    this.snapshotOverlay?.classList.remove('show');
    if (this.snapshotImage) this.snapshotImage.src = '';
    if (this.snapshotUrl) {
      URL.revokeObjectURL(this.snapshotUrl);
      this.snapshotUrl = null;
    }

    const shouldRestore =
      restorePointerLock ?? this.snapshotRestorePointerLock;
    this.snapshotRestorePointerLock = false;

    if (shouldRestore) {
      await this.requestPointerLock();
    }
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

    // 4. Contextual interact prompt (sit / order / stand)
    if (this.interactPrompt) {
      const prompt = this.interactionManager?.getActivePrompt?.();
      const text = prompt ? `${prompt.label}  [${prompt.key}]` : '';
      if (text !== this.lastInteractText) {
        this.interactPrompt.textContent = text;
        this.lastInteractText = text;
      }
      this.interactPrompt.classList.toggle('show', Boolean(prompt));
    }
  }

  dispose() {
    if (this.btnStart && this._onStartClick) {
      this.btnStart.removeEventListener('click', this._onStartClick);
    }
    this.snapshotClose?.removeEventListener('click', this._onSnapshotClose);
    this.snapshotSave?.removeEventListener('click', this._onSnapshotSave);
    clearTimeout(this.promptTimeoutId);
    clearTimeout(this.pointerLockTimeoutId);
    this.promptTimeoutId = null;
    this.pointerLockTimeoutId = null;
    if (this.snapshotUrl) {
      URL.revokeObjectURL(this.snapshotUrl);
      this.snapshotUrl = null;
    }
  }
}

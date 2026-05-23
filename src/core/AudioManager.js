import { ROOMS, getRoomForPosition } from '../config/experience.js';

export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.filterNode = null;
    this.analyser = null;

    // Sequencer States
    this.isPlaying = false;
    this.bpm = 80; // Slowed down from 120 to 80 BPM (cozy acoustic chill)
    this.stepTime = 60 / this.bpm / 4; // 16th note step time (0.1875s for 80BPM)
    this.currentStep = 0;
    this.nextStepTime = 0.0;
    this.lookAhead = 0.1; // How far ahead to schedule audio (seconds)
    this.timerId = null;

    // Acoustic Lerping variables
    this.targetCutoff = 300; // Hz
    this.currentCutoff = 300;
    this.targetVolume = 0.25; // gain
    this.currentVolume = 0.25;

    // Beat Sync Flag (set to true on kick drum triggers)
    this.isBeatHit = false;

    // Multiplicative bias applied to room acoustic targets (used by InteractionManager
    // to muffle audio when the player is seated). Defaults to identity.
    this.acousticBias = { cutoff: 1, volume: 1 };

    // Room boundaries and HUD definitions for acoustic occlusion.
    this.rooms = ROOMS;

    this.currentRoom = this.rooms[0]; // Default start room: exterior

    // Track active timeouts to prevent memory leaks and stray triggers
    this.activeTimeouts = [];

    // Pre-allocated reusable audio resources
    this.noiseBuffer = null;
    this.hiHatFilter = null;
    this.subBassFilter = null;
  }

  /**
   * Initializes the Web Audio API nodes. Must be called from a user gesture event.
   */
  async start() {
    if (this.isPlaying) return;

    // 1. Create AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();

    // 2. Set up Nodes
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioContext.currentTime);

    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(this.currentCutoff, this.audioContext.currentTime);
    this.filterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64; // Small size for visualizer bars

    // Connect: Synth Instruments -> Filter -> Analyser -> Master Gain -> Speakers
    this.filterNode.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    // Pre-allocate 1-second white noise buffer
    const bufferSize = this.audioContext.sampleRate; // 1 second
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Pre-allocate hi-hat highpass filter (lowered frequency to sound like a soft brushed shaker)
    this.hiHatFilter = this.audioContext.createBiquadFilter();
    this.hiHatFilter.type = 'highpass';
    this.hiHatFilter.frequency.setValueAtTime(2500, this.audioContext.currentTime); // Slower, softer brushed hat
    this.hiHatFilter.connect(this.filterNode);

    // Pre-allocate sub-bass lowpass filter
    this.subBassFilter = this.audioContext.createBiquadFilter();
    this.subBassFilter.type = 'lowpass';
    this.subBassFilter.frequency.setValueAtTime(180, this.audioContext.currentTime);
    this.subBassFilter.connect(this.filterNode);

    // 3. Start scheduler
    this.isPlaying = true;
    this.nextStepTime = this.audioContext.currentTime + 0.05;
    this._scheduler();

    // Trigger visualizer loop animation
    this._tickLerping();
  }

  /**
   * The scheduler loop. Keeps scheduling steps slightly ahead.
   */
  _scheduler() {
    while (this.nextStepTime < this.audioContext.currentTime + this.lookAhead) {
      this._scheduleStep(this.currentStep, this.nextStepTime);
      this._advanceStep();
    }
    // Schedule next polling check in 25ms
    this.timerId = setTimeout(() => this._scheduler(), 25);
  }

  /**
   * Advances the 16-step sequencer pattern.
   */
  _advanceStep() {
    this.currentStep = (this.currentStep + 1) % 16;
    this.nextStepTime += this.stepTime;
  }

  /**
   * Schedules synthesizers triggers for a specific 16th-note step.
   * @param {number} step - Current step (0 to 15)
   * @param {number} time - Exact audio context timeline mark to trigger synthesis
   */
  _scheduleStep(step, time) {
    // 1. Cozy Kick Drum (Wooden stomp heartbeat kick on steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      this._synthesizeKick(time);

      // Calculate delay in milliseconds until the sound actually plays
      const delayMs = Math.max(0, (time - this.audioContext.currentTime) * 1000);

      const tId = setTimeout(() => {
        this.isBeatHit = true;
        const tId2 = setTimeout(() => {
          this.isBeatHit = false;
          const idx2 = this.activeTimeouts.indexOf(tId2);
          if (idx2 > -1) this.activeTimeouts.splice(idx2, 1);
        }, 80);
        this.activeTimeouts.push(tId2);

        const idx = this.activeTimeouts.indexOf(tId);
        if (idx > -1) this.activeTimeouts.splice(idx, 1);
      }, delayMs);
      this.activeTimeouts.push(tId);
    }

    // 2. Brushed Shaker Hi-Hat (Offbeat hat on steps 2, 6, 10, 14; subtle tick on others)
    if (step % 4 === 2) {
      this._synthesizeHiHat(time, 0.16); // Soft offbeat brushed shaker
    } else if (step % 2 === 1) {
      this._synthesizeHiHat(time, 0.04); // Quiet rhythmic tick
    }

    // 3. Acoustic Double-Bass (Triangle warm woody pluck)
    // Plays a syncopated, walking acoustic jazz pattern
    const bassPattern = [
      130.81 / 4, // C1 (step 0)
      0,
      130.81 / 4, // C1 (step 2)
      196.0 / 4, // G1 (step 3)
      155.56 / 4, // Eb1 (step 4)
      0,
      155.56 / 4, // Eb1 (step 6)
      233.08 / 4, // Bb1 (step 7)
      196.0 / 4, // G1 (step 8)
      0,
      196.0 / 4, // G1 (step 10)
      293.66 / 4, // D2 (step 11)
      174.61 / 4, // F1 (step 12)
      0,
      174.61 / 4, // F1 (step 14)
      220.0 / 4, // A1 (step 15)
    ];
    const bassFreq = bassPattern[step];
    if (bassFreq > 0) {
      this._synthesizeSubBass(time, bassFreq, 0.25);
    }

    // 4. Soothing Rhodes Chords & Mellow Melodies
    if (step === 0) {
      // Play C Minor 7 chord (warm and lush)
      this._synthesizeLead(time, 130.81, 0.15); // C3
      this._synthesizeLead(time, 155.56, 0.13); // Eb3
      this._synthesizeLead(time, 196.0, 0.13); // G3
      this._synthesizeLead(time, 233.08, 0.11); // Bb3
    } else if (step === 4) {
      // Soft melodic top note
      this._synthesizeLead(time, 293.66, 0.12); // D4
    } else if (step === 8) {
      // Play G Minor 7 chord
      this._synthesizeLead(time, 196.0, 0.15); // G3
      this._synthesizeLead(time, 233.08, 0.13); // Bb3
      this._synthesizeLead(time, 293.66, 0.13); // D4
      this._synthesizeLead(time, 349.23, 0.11); // F4
    } else if (step === 12) {
      // High bell transition note
      this._synthesizeLead(time, 392.0, 0.12); // G4
    } else if (step === 2 || step === 6 || step === 10 || step === 14) {
      // Gentle acoustic filler notes
      const fillers = [155.56, 196.0, 233.08, 293.66];
      const freq = fillers[(step / 2) % fillers.length];
      this._synthesizeLead(time, freq, 0.07);
    }
  }

  /* --- SYNTH INSTRUMENTS SYNTHESIS --- */

  /**
   * Generates a soft, warm wooden heartbeat thump.
   */
  _synthesizeKick(time) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.filterNode);

    // Deep organic swoop down (100Hz down to 32Hz, instead of 145 -> 45)
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);

    // Softened volume envelope decay (heartbeat foot stomp box style)
    gain.gain.setValueAtTime(0.55, time); // Softer volume
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16); // Smoother, longer release

    osc.start(time);
    osc.stop(time + 0.17);
  }

  /**
   * Generates brushed shaker noise hi-hats.
   */
  _synthesizeHiHat(time, volume = 0.1) {
    if (!this.noiseBuffer || !this.hiHatFilter) return;

    const noiseNode = this.audioContext.createBufferSource();
    noiseNode.buffer = this.noiseBuffer;

    const randomOffset = Math.random() * 0.95;
    const gain = this.audioContext.createGain();

    noiseNode.connect(gain);
    gain.connect(this.hiHatFilter);

    // Envelope (softened attack and longer decay for a brushed shaker sound)
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(volume * 0.6, time + 0.01); // Soft attack rise
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08); // Longer, softer brushed decay

    noiseNode.start(time, randomOffset, 0.09);
  }

  /**
   * Generates a warm, plucky, woody acoustic double-bass pluck.
   */
  _synthesizeSubBass(time, frequency, volume = 0.2) {
    if (!this.subBassFilter) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    // Triangle wave gives a warm, woody resonance.
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);

    osc.connect(gain);
    gain.connect(this.subBassFilter);

    // Soft plucky acoustic envelope
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015); // soft pluck attack
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15); // rich wooden ring decay

    osc.start(time);
    osc.stop(time + 0.16);
  }

  /**
   * Generates lush, bell-like vintage Rhodes electric piano notes and chords.
   */
  _synthesizeLead(time, frequency, volume = 0.1) {
    // 1. Fundamental mellow tone (Sine wave)
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, time);

    // 2. Metallic bell pluck overtone (Triangle wave at double frequency)
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(frequency * 2.0, time);

    // 3. Low warm harmonic hum (Triangle wave at half frequency)
    const osc3 = this.audioContext.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(frequency * 0.5, time);

    const gain1 = this.audioContext.createGain();
    const gain2 = this.audioContext.createGain();
    const gain3 = this.audioContext.createGain();

    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(800, time);

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(lowpass);
    gain2.connect(lowpass);
    gain3.connect(lowpass);
    lowpass.connect(this.filterNode);

    // Fundamental Envelope (Lingering warm body)
    gain1.gain.setValueAtTime(0.0, time);
    gain1.gain.linearRampToValueAtTime(volume * 0.7, time + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    // Bell Tinkle Envelope (Fast metallic strike decay)
    gain2.gain.setValueAtTime(0.0, time);
    gain2.gain.linearRampToValueAtTime(volume * 0.28, time + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    // Sub-harmonic Envelope (Deep warm base weight)
    gain3.gain.setValueAtTime(0.0, time);
    gain3.gain.linearRampToValueAtTime(volume * 0.45, time + 0.02);
    gain3.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);

    osc1.stop(time + 0.5);
    osc2.stop(time + 0.5);
    osc3.stop(time + 0.5);
  }

  /* --- ACOUSTIC GEOMETRY ENGINE --- */

  /**
   * Receives player position and matches it against room bounding boxes to adjust acoustics.
   * @param {number} x - Player X coordinate
   * @param {number} z - Player Z coordinate
   */
  setPlayerPosition(x, z) {
    const detectedRoom = getRoomForPosition(x, z);

    this.currentRoom = detectedRoom;
    this.targetCutoff = detectedRoom.cutoff;

    // Apply distance attenuation based on Chandelier proximity (located around x = 10.5, z = 0)
    if (detectedRoom.name === 'ACOUSTIC HALL') {
      const dx = 10.5 - x;
      const dz = 0 - z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Volume scales from 1.0 (at center) to 0.72 (at edge)
      const distanceAttenuation = Math.max(0.68, 1.1 - dist * 0.022);
      this.targetVolume = detectedRoom.volume * distanceAttenuation;
    } else {
      this.targetVolume = detectedRoom.volume;
    }

    this.targetCutoff *= this.acousticBias.cutoff;
    this.targetVolume *= this.acousticBias.volume;
  }

  /**
   * Plays a short bell-like chime (used as audible feedback for interactions).
   */
  playChime() {
    if (!this.audioContext) return;
    this._synthesizeLead(this.audioContext.currentTime + 0.02, 523.25, 0.13);
  }

  /**
   * Interpolator loop (Lerp) to smoothly glide frequency and gain, preventing pop/clicks.
   */
  _tickLerping() {
    if (!this.isPlaying) return;

    // Linear interpolation: 7% shift per frame makes room acoustic changes extremely smooth
    const lerpFactor = 0.07;

    this.currentCutoff += (this.targetCutoff - this.currentCutoff) * lerpFactor;
    this.currentVolume += (this.targetVolume - this.currentVolume) * lerpFactor;

    // Constrain limits
    this.currentCutoff = Math.max(150, Math.min(22000, this.currentCutoff));
    this.currentVolume = Math.max(0.01, Math.min(1.0, this.currentVolume));

    // Commit to nodes
    this.filterNode.frequency.setValueAtTime(this.currentCutoff, this.audioContext.currentTime);
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioContext.currentTime);

    // Recursively run on next frame
    requestAnimationFrame(() => this._tickLerping());
  }

  /**
   * Returns frequency data array from analyser for HUD EQ.
   */
  getByteFrequencyData() {
    if (!this.analyser) return new Uint8Array(12).fill(0);
    const array = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(array);

    // Map full FFT bins down to our 12 neat UI bands
    const eqBands = new Uint8Array(12);
    const step = Math.floor(array.length / 12);
    for (let i = 0; i < 12; i++) {
      eqBands[i] = array[i * step] || 0;
    }
    return eqBands;
  }

  /**
   * Destroys audio nodes on disposal.
   */
  dispose() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
    if (this.activeTimeouts) {
      this.activeTimeouts.forEach((id) => clearTimeout(id));
      this.activeTimeouts = [];
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

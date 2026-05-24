import { describe, expect, it } from 'vitest';
import { AudioManager, AUDIO_MOODS } from './AudioManager.js';

describe('AudioManager moods', () => {
  it('starts with the default mood selected', () => {
    const manager = new AudioManager();

    expect(AUDIO_MOODS.map((mood) => mood.key)).toEqual([
      'fireside-jazz',
      'late-night-hush',
      'lively-bar-set',
    ]);
    expect(manager.getSelectedMood().key).toBe('fireside-jazz');
    expect(manager.activeMoodKey).toBe('fireside-jazz');
    expect(manager.bpm).toBe(manager.getSelectedMood().bpm);
  });

  it('queues the next mood while playing and applies it on the next step boundary', () => {
    const manager = new AudioManager();
    manager.isPlaying = true;

    const selected = manager.cycleMood();

    expect(selected.key).toBe('late-night-hush');
    expect(manager.getSelectedMood().key).toBe('late-night-hush');
    expect(manager.pendingMoodKey).toBe('late-night-hush');
    expect(manager.activeMoodKey).toBe('fireside-jazz');

    manager._advanceStep();

    expect(manager.pendingMoodKey).toBeNull();
    expect(manager.activeMoodKey).toBe('late-night-hush');
    expect(manager.bpm).toBe(72);
    expect(manager.stepTime).toBeCloseTo(60 / 72 / 4);
  });
});

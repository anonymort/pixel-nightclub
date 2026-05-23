import { afterEach, describe, expect, it, vi } from 'vitest';
import { UIManager } from './UIManager.js';

function createElement(id) {
  return {
    id,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
    },
    style: {},
    textContent: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('UIManager', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('removes event listeners and clears timers on dispose', () => {
    vi.useFakeTimers();

    const elements = new Map();
    const button = createElement('btn-start');
    elements.set('btn-start', button);
    elements.set('audio-modal', createElement('audio-modal'));
    elements.set('active-room-tag', createElement('active-room-tag'));
    elements.set('active-room-desc', createElement('active-room-desc'));
    elements.set('floating-prompt', createElement('floating-prompt'));
    elements.set('beat-pulse', createElement('beat-pulse'));

    vi.stubGlobal('document', {
      getElementById: vi.fn((id) => elements.get(id) || null),
    });

    const manager = new UIManager(
      {
        currentRoom: null,
        getByteFrequencyData: () => new Uint8Array(12),
      },
      { domElement: {}, isLocked: false }
    );

    manager._showFloatingPrompt('TEST', 1000);
    manager.pointerLockTimeoutId = setTimeout(() => {}, 500);
    manager.dispose();

    expect(button.removeEventListener).toHaveBeenCalledWith('click', manager._onStartClick);
    expect(vi.getTimerCount()).toBe(0);
  });
});

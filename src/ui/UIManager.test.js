import { afterEach, describe, expect, it, vi } from 'vitest';
import { UIManager } from './UIManager.js';

function createElement(id) {
  return {
    id,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
      toggle: vi.fn(),
    },
    style: {},
    textContent: '',
    src: '',
    href: '',
    download: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    click: vi.fn(),
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

  it('shows a souvenir preview, downloads it, and restores pointer lock on close', async () => {
    const elements = new Map();
    const closeButton = createElement('snapshot-close');
    const saveButton = createElement('snapshot-save');
    const previewImage = createElement('snapshot-image');
    const snapshotTitle = createElement('snapshot-title');
    const snapshotMeta = createElement('snapshot-meta');
    const snapshotOverlay = createElement('snapshot-overlay');

    elements.set('btn-start', createElement('btn-start'));
    elements.set('audio-modal', createElement('audio-modal'));
    elements.set('active-room-tag', createElement('active-room-tag'));
    elements.set('active-room-desc', createElement('active-room-desc'));
    elements.set('floating-prompt', createElement('floating-prompt'));
    elements.set('beat-pulse', createElement('beat-pulse'));
    elements.set('snapshot-overlay', snapshotOverlay);
    elements.set('snapshot-image', previewImage);
    elements.set('snapshot-title', snapshotTitle);
    elements.set('snapshot-meta', snapshotMeta);
    elements.set('snapshot-close', closeButton);
    elements.set('snapshot-save', saveButton);

    const createObjectURL = vi.fn(() => 'blob:preview');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      getElementById: vi.fn((id) => elements.get(id) || null),
      createElement: vi.fn(() => createElement('a')),
    });

    const controls = { domElement: {}, isLocked: false };
    const manager = new UIManager(
      {
        currentRoom: null,
        getByteFrequencyData: () => new Uint8Array(12),
      },
      controls
    );

    const result = await manager.showSnapshotPreview({
      blob: new Blob(['photo'], { type: 'image/png' }),
      title: 'Tonight at Hearthside',
      fileName: 'hearthside-souvenir.png',
      meta: 'Front walk keepsake',
      restorePointerLock: true,
    });

    expect(result.url).toBe('blob:preview');
    expect(snapshotTitle.textContent).toBe('Tonight at Hearthside');
    expect(snapshotMeta.textContent).toBe('Front walk keepsake');
    expect(previewImage.src).toBe('blob:preview');
    expect(snapshotOverlay.classList.add).toHaveBeenCalledWith('show');

    manager._handleSnapshotSave();
    const downloadLink = document.createElement.mock.results[0].value;
    expect(downloadLink.href).toBe('blob:preview');
    expect(downloadLink.download).toBe('hearthside-souvenir.png');
    expect(downloadLink.click).toHaveBeenCalledTimes(1);

    const requestPointerLock = vi.spyOn(manager, 'requestPointerLock').mockResolvedValue(true);
    await manager.dismissSnapshotPreview();
    expect(snapshotOverlay.classList.remove).toHaveBeenCalledWith('show');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
  });
});

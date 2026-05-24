import * as THREE from 'three';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InteractionManager } from './InteractionManager.js';

function createCamera({ x = 0, z = 0, yaw = 0 } = {}) {
  const camera = new THREE.PerspectiveCamera();
  camera.rotation.order = 'YXZ';
  camera.position.set(x, 1.7, z);
  camera.rotation.y = yaw;
  return camera;
}

function createControls(camera) {
  return {
    camera,
    interactQueued: false,
    isSeated: false,
    setSeated: vi.fn(function ({ anchorX, anchorZ, eyeHeight }) {
      this.isSeated = true;
      this.seatedAnchor = { x: anchorX, z: anchorZ, eyeHeight };
      camera.position.set(anchorX, eyeHeight, anchorZ);
    }),
    standUp: vi.fn(function () {
      this.isSeated = false;
      this.seatedAnchor = null;
    }),
  };
}

function createAudio() {
  return {
    acousticBias: { cutoff: 1, volume: 1 },
    playChime: vi.fn(),
    cycleMood: vi.fn(() => ({ key: 'late-night-hush', name: 'Late-Night Hush' })),
  };
}

function createNpc() {
  return {
    triggerBartenderFlourish: vi.fn(),
    triggerSelectorFlourish: vi.fn(),
    triggerPhotographerSnapshot: vi.fn(),
  };
}

function createUi() {
  return { showFloatingPrompt: vi.fn() };
}

function makeIM({ x = 0, z = 0, yaw = 0 } = {}) {
  const camera = createCamera({ x, z, yaw });
  const controls = createControls(camera);
  const audio = createAudio();
  const npc = createNpc();
  const ui = createUi();
  const im = new InteractionManager(controls, audio, npc, ui);
  return { im, controls, audio, npc, ui, camera };
}

const stoolSpec = (id = 'stool-a', x = 0, z = -1.5) => ({
  id,
  position: { x, z },
  range: 1.6,
  verb: 'sit',
  label: 'Sit',
  seated: { anchorX: x, anchorZ: z, eyeHeight: 1.0 },
  acoustic: { cutoff: 0.85, volume: 0.92 },
});

describe('InteractionManager registry', () => {
  it('stores and clears specs', () => {
    const { im } = makeIM();
    im.registerInteractable(stoolSpec('s1', 0, -1));
    im.registerInteractable(stoolSpec('s2', 0, -2));
    expect(im.interactables).toHaveLength(2);
    im.clear();
    expect(im.interactables).toHaveLength(0);
  });
});

describe('InteractionManager target selection', () => {
  let setup;
  beforeEach(() => {
    setup = makeIM({ x: 0, z: 0, yaw: 0 });
  });

  it('picks the spec the camera is facing when two are in range', () => {
    setup.im.registerInteractable(stoolSpec('front', 0, -1.0));
    setup.im.registerInteractable(stoolSpec('right', 1.0, 0));
    setup.im.update(0.016);
    expect(setup.im.currentTarget?.id).toBe('front');
  });

  it('ignores specs outside the FOV cone even when closer', () => {
    setup.im.registerInteractable(stoolSpec('behind', 0, 0.4));
    setup.im.registerInteractable(stoolSpec('front', 0, -1.4));
    setup.im.update(0.016);
    expect(setup.im.currentTarget?.id).toBe('front');
  });

  it('returns null when no interactable is in range', () => {
    setup.im.registerInteractable(stoolSpec('far', 0, -10));
    setup.im.update(0.016);
    expect(setup.im.currentTarget).toBeNull();
    expect(setup.im.getActivePrompt()).toBeNull();
  });

  it('renders a Sit prompt when targeting a sit verb', () => {
    setup.im.registerInteractable(stoolSpec('front', 0, -1.0));
    setup.im.update(0.016);
    expect(setup.im.getActivePrompt()).toEqual({ label: 'Sit', key: 'E' });
  });
});

describe('InteractionManager sit/stand dispatch', () => {
  it('seats the player and applies acoustic bias on E', () => {
    const { im, controls, audio } = makeIM();
    const spec = stoolSpec('seat', 0, -1.0);
    im.registerInteractable(spec);
    im.update(0.016);

    controls.interactQueued = true;
    im.update(0.016);

    expect(controls.setSeated).toHaveBeenCalledWith(spec.seated);
    expect(controls.isSeated).toBe(true);
    expect(audio.acousticBias).toEqual(spec.acoustic);
    expect(im.getActivePrompt()).toEqual({ label: 'Stand', key: 'E' });
  });

  it('stands the player back up and restores acoustic bias on second E', () => {
    const { im, controls, audio } = makeIM();
    im.registerInteractable(stoolSpec('seat', 0, -1.0));
    im.update(0.016);

    controls.interactQueued = true;
    im.update(0.016);
    expect(controls.isSeated).toBe(true);

    controls.interactQueued = true;
    im.update(0.016);

    expect(controls.standUp).toHaveBeenCalledTimes(1);
    expect(controls.isSeated).toBe(false);
    expect(audio.acousticBias).toEqual({ cutoff: 1, volume: 1 });
  });
});

describe('InteractionManager order dispatch', () => {
  it('plays chime, shows banner, and triggers bartender flourish', () => {
    const { im, controls, audio, npc, ui } = makeIM();
    im.registerInteractable({
      id: 'bartender',
      position: { x: 0, z: -1.0 },
      range: 1.5,
      verb: 'order',
      label: 'Order a drink',
    });
    im.update(0.016);
    controls.interactQueued = true;
    im.update(0.016);

    expect(audio.playChime).toHaveBeenCalledTimes(1);
    expect(ui.showFloatingPrompt).toHaveBeenCalledTimes(1);
    expect(ui.showFloatingPrompt.mock.calls[0][0]).toBe('WHISKEY, NEAT');
    expect(npc.triggerBartenderFlourish).toHaveBeenCalledTimes(1);
  });

  it('cycles through drink names deterministically', () => {
    const { im, controls, ui } = makeIM();
    im.registerInteractable({
      id: 'bartender',
      position: { x: 0, z: -1.0 },
      range: 1.5,
      verb: 'order',
      label: 'Order a drink',
    });
    for (let i = 0; i < 4; i++) {
      im.update(0.016);
      controls.interactQueued = true;
      im.update(0.016);
    }
    const banners = ui.showFloatingPrompt.mock.calls.map((c) => c[0]);
    expect(banners).toEqual(['WHISKEY, NEAT', 'OLD FASHIONED', 'HOT TODDY', 'GINGER FIZZ']);
  });
});

describe('InteractionManager music selector dispatch', () => {
  it('cycles the booth mood, shows a banner, and triggers selector feedback', () => {
    const { im, controls, audio, npc, ui } = makeIM();
    im.registerInteractable({
      id: 'turntable',
      position: { x: 0, z: -1.0 },
      range: 1.6,
      verb: 'selectMood',
      label: 'Choose the vibe',
    });
    im.update(0.016);

    expect(im.getActivePrompt()).toEqual({ label: 'Choose the vibe', key: 'E' });

    controls.interactQueued = true;
    im.update(0.016);

    expect(audio.cycleMood).toHaveBeenCalledTimes(1);
    expect(ui.showFloatingPrompt).toHaveBeenCalledTimes(1);
    expect(ui.showFloatingPrompt.mock.calls[0][0]).toContain('Late-Night Hush');
    expect(npc.triggerSelectorFlourish).toHaveBeenCalledTimes(1);
  });
});

describe('InteractionManager souvenir snapshot dispatch', () => {
  it('triggers the photographer prompt, snapshot flow, and photographer flash', async () => {
    const onTakeSnapshot = vi.fn(async () => ({
      title: 'Tonight at Hearthside',
      fileName: 'hearthside-souvenir.png',
    }));
    const { im, controls, audio, npc, ui } = makeIM();
    im.onTakeSnapshot = onTakeSnapshot;
    im.registerInteractable({
      id: 'photographer-snapshot',
      position: { x: 0, z: -1.0 },
      range: 1.8,
      verb: 'takeSnapshot',
      label: 'Take a souvenir photo',
    });
    im.update(0.016);

    expect(im.getActivePrompt()).toEqual({ label: 'Take a souvenir photo', key: 'E' });

    controls.interactQueued = true;
    await im.update(0.016);

    expect(onTakeSnapshot).toHaveBeenCalledTimes(1);
    expect(audio.playChime).toHaveBeenCalledTimes(1);
    expect(ui.showFloatingPrompt).toHaveBeenCalledWith('Tonight at Hearthside', 2600);
    expect(npc.triggerPhotographerSnapshot).toHaveBeenCalledTimes(1);
  });
});

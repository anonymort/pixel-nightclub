import { describe, expect, it, vi } from 'vitest';
import { disposeObjectTree, removeRendererCanvas } from './SceneManager.js';

describe('SceneManager disposal helpers', () => {
  it('disposes geometry and material resources in an object tree', () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn(), map: { dispose: vi.fn() } };
    const root = {
      traverse(callback) {
        callback({ geometry, material });
      },
      clear: vi.fn(),
    };

    disposeObjectTree(root);

    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.map.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(root.clear).toHaveBeenCalledTimes(1);
  });

  it('removes renderer canvas from its parent node', () => {
    const domElement = {};
    const parentNode = { removeChild: vi.fn() };
    domElement.parentNode = parentNode;

    removeRendererCanvas({ domElement });

    expect(parentNode.removeChild).toHaveBeenCalledWith(domElement);
  });
});

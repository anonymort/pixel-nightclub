import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOMS,
  SCREENSHOT_ROOMS,
  TOUR_KEYFRAMES,
  createSeededRandom,
  getGameplayRandom,
  getRoomForPosition,
  resolveArtifactPath,
} from './experience.js';

describe('experience config', () => {
  it('maps representative coordinates to the correct room', () => {
    expect(getRoomForPosition(-13, 0).name).toBe('COBBLESTONE STREET');
    expect(getRoomForPosition(-2, 6).name).toBe('RECEPTION & COATROOM');
    expect(getRoomForPosition(8, 8).name).toBe('BOTANIST BAR');
    expect(getRoomForPosition(13, -16).name).toBe('HEARTHSIDE LOUNGE');
    expect(getRoomForPosition(10, 0).name).toBe('ACOUSTIC HALL');
  });

  it('keeps room data ordered from specific zones to fallback hall', () => {
    expect(ROOMS.at(-1).name).toBe('ACOUSTIC HALL');
    expect(ROOMS.map((room) => room.name)).toEqual([
      'COBBLESTONE STREET',
      'RECEPTION & COATROOM',
      'BOTANIST BAR',
      'HEARTHSIDE LOUNGE',
      'ACOUSTIC HALL',
    ]);
  });

  it('resolves visual QA artifacts under a portable repo-local directory by default', () => {
    const artifactPath = resolveArtifactPath('screenshots', 'exterior.png');

    expect(artifactPath).toContain(path.join('artifacts', 'visual-qa', 'screenshots'));
    expect(artifactPath.endsWith(path.join('screenshots', 'exterior.png'))).toBe(true);
  });

  it('honors platform-specific separators when resolving artifact paths', () => {
    process.env.VISUAL_QA_PATH_SEPARATOR = '\\';

    try {
      const artifactPath = resolveArtifactPath('screenshots', 'exterior.png');

      expect(artifactPath).toContain('artifacts\\visual-qa\\screenshots');
      expect(artifactPath.endsWith('screenshots\\exterior.png')).toBe(true);
    } finally {
      delete process.env.VISUAL_QA_PATH_SEPARATOR;
    }
  });

  it('exposes reusable camera routes for screenshots and tours', () => {
    expect(SCREENSHOT_ROOMS.map((room) => room.name)).toEqual([
      'exterior',
      'cloakroom',
      'bar',
      'fireplace',
      'acoustic_hall',
    ]);
    expect(TOUR_KEYFRAMES[0].name).toBe('street_entrance');
    expect(TOUR_KEYFRAMES.at(-1).name).toBe('turntable_booth');
  });

  it('creates deterministic seeded random streams for visual QA', () => {
    const firstGenerator = createSeededRandom('qa-seed');
    const first = Array.from({ length: 5 }, () => firstGenerator());
    const secondGenerator = createSeededRandom('qa-seed');
    const second = Array.from({ length: 5 }, () => secondGenerator());

    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('uses deterministic gameplay randomness only when a QA seed is provided', () => {
    process.env.VISUAL_QA_SEED = 'screenshots';

    try {
      const random = getGameplayRandom();

      expect(random()).toBe(createSeededRandom('screenshots')());
    } finally {
      delete process.env.VISUAL_QA_SEED;
    }
  });
});

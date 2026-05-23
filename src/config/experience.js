const DEFAULT_VISUAL_QA_BASE_URL = 'http://localhost:5173/';
const DEFAULT_ARTIFACT_ROOT = 'artifacts/visual-qa';

function getEnv(name) {
  if (name === 'VISUAL_QA_SEED' && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return window.__VISUAL_QA_SEED || params.get('visualQaSeed') || params.get('qaSeed') || undefined;
  }
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}

function getPathSeparator() {
  const configuredSeparator = getEnv('VISUAL_QA_PATH_SEPARATOR');
  if (configuredSeparator) return configuredSeparator;

  return typeof process !== 'undefined' && process.platform === 'win32' ? '\\' : '/';
}

function joinPath(...segments) {
  const separator = getPathSeparator();
  return segments
    .filter(Boolean)
    .map((segment, index) => {
      const value = String(segment);
      if (index === 0) return value.replace(/[\\/]+$/, '').replace(/[\\/]+/g, separator);
      return value.replace(/^[\\/]+|[\\/]+$/g, '').replace(/[\\/]+/g, separator);
    })
    .join(separator);
}

export const APP_BRAND = {
  packageName: 'hearthside-lounge',
  title: 'Hearthside Lounge',
  subtitle: 'Botanist Bar & Retreat',
  consoleReadyMessage: 'Hearthside Lounge initialized.',
};

export const VISUAL_QA_BASE_URL = getEnv('VISUAL_QA_BASE_URL') || DEFAULT_VISUAL_QA_BASE_URL;

function hashSeed(seed) {
  let hash = 2166136261;
  const value = String(seed);
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function getGameplayRandom() {
  const seed = getEnv('VISUAL_QA_SEED');
  return seed ? createSeededRandom(seed) : Math.random;
}

export const ROOMS = [
  {
    name: 'COBBLESTONE STREET',
    desc: 'Walking along the sidewalk. Distant fireplace crackles and soft jazz through the door.',
    cutoff: 280,
    volume: 0.28,
    bounds: { xMin: -50, xMax: -4.8, zMin: -50, zMax: 50 },
  },
  {
    name: 'RECEPTION & COATROOM',
    desc: 'Muffled chatter. Inside the wood-paneled lobby cloakroom.',
    cutoff: 750,
    volume: 0.55,
    bounds: { xMin: -4.8, xMax: 1.0, zMin: -50, zMax: 50 },
  },
  {
    name: 'BOTANIST BAR',
    desc: 'Sitting by the polished mahogany bar. Warm acoustic guitar and Rhodes electric piano.',
    cutoff: 1800,
    volume: 0.8,
    bounds: { xMin: 1.0, xMax: 13.0, zMin: 5.5, zMax: 11.0 },
  },
  {
    name: 'HEARTHSIDE LOUNGE',
    desc: 'Relaxing on the cognac sofas by the brick fireplace. Comfortable, soothing warmth.',
    cutoff: 1200,
    volume: 0.7,
    bounds: { xMin: 6.0, xMax: 19.0, zMin: -21.0, zMax: -10.5 },
  },
  {
    name: 'ACOUSTIC HALL',
    desc: 'Swaying under the grand candle chandelier. Warm, crisp acoustic reverberation.',
    cutoff: 20000,
    volume: 1.0,
    bounds: { xMin: 1.0, xMax: 20.0, zMin: -10.5, zMax: 5.5 },
  },
];

export const SCREENSHOT_ROOMS = [
  {
    name: 'exterior',
    pos: { x: -16.0, y: 1.75, z: -5.4 },
    target: { x: -5.6, y: 1.85, z: -2.2 },
  },
  {
    name: 'cloakroom',
    pos: { x: -3.5, y: 1.7, z: 6.0 },
    target: { x: 1.0, y: 1.65, z: 6.0 },
  },
  {
    name: 'bar',
    pos: { x: 4.2, y: 1.7, z: 7.8 },
    target: { x: 12.0, y: 1.75, z: 8.8 },
  },
  {
    name: 'fireplace',
    pos: { x: 8.2, y: 1.7, z: -13.0 },
    target: { x: 13.0, y: 1.45, z: -20.2 },
  },
  {
    name: 'acoustic_hall',
    pos: { x: 5.8, y: 1.7, z: 1.4 },
    target: { x: 11.6, y: 2.7, z: -2.4 },
  },
];

export const TOUR_KEYFRAMES = [
  {
    num: '01',
    name: 'street_entrance',
    pos: { x: -16.0, y: 1.75, z: -5.4 },
    target: { x: -5.6, y: 1.85, z: -2.2 },
    desc: 'Exterior facade, sidewalk queue, sedan curb edge, trellis, brass sign, and copper sconce lantern.',
  },
  {
    num: '02',
    name: 'approaching_door',
    pos: { x: -8.8, y: 1.7, z: -1.6 },
    target: { x: -3.8, y: 1.75, z: 0.4 },
    desc: 'Approaching the double-door entrance with brick framing.',
  },
  {
    num: '03',
    name: 'entering_lobby',
    pos: { x: -4.5, y: 1.7, z: 0.0 },
    target: { x: -1.0, y: 1.7, z: 3.0 },
    desc: 'Entering the warm charcoal-toned lobby area.',
  },
  {
    num: '04',
    name: 'cloakroom_counter',
    pos: { x: -3.5, y: 1.7, z: 6.0 },
    target: { x: 1.0, y: 1.7, z: 6.0 },
    desc: 'Looking at the mahogany cloakroom counter, rustic oak coat shelf, and warm COATS sign.',
  },
  {
    num: '05',
    name: 'cloakroom_seating',
    pos: { x: -0.6, y: 1.7, z: 5.4 },
    target: { x: -4.4, y: 1.55, z: 7.0 },
    desc: 'Looking back at wool bench cushions and potted clay plants.',
  },
  {
    num: '06',
    name: 'entering_hall',
    pos: { x: -1.0, y: 1.7, z: 1.0 },
    target: { x: 4.0, y: 1.7, z: 0.0 },
    desc: 'Stepping through the portal partition wall onto the acoustic parquet floor.',
  },
  {
    num: '07',
    name: 'botanist_bar',
    pos: { x: 4.2, y: 1.7, z: 7.8 },
    target: { x: 12.0, y: 1.75, z: 8.8 },
    desc: 'Looking down the mahogany Botanist Bar counter with honey shelves and velvet stools.',
  },
  {
    num: '08',
    name: 'hall_chandelier',
    pos: { x: 5.8, y: 1.7, z: 1.4 },
    target: { x: 11.6, y: 2.7, z: -2.4 },
    desc: 'Looking up at the exposed oak timber rafters and the candle chandelier.',
  },
  {
    num: '09',
    name: 'entering_lounge',
    pos: { x: 9.0, y: 1.7, z: -11.0 },
    target: { x: 13.0, y: 1.7, z: -16.0 },
    desc: 'Stepping into the intimate Hearthside Lounge.',
  },
  {
    num: '10',
    name: 'fireplace_and_sconces',
    pos: { x: 8.2, y: 1.7, z: -13.0 },
    target: { x: 13.0, y: 1.45, z: -20.2 },
    desc: 'Looking at the brick fireplace flanked by brass candle sconces.',
  },
  {
    num: '11',
    name: 'botanical_art_wall',
    pos: { x: 13.2, y: 1.7, z: -14.0 },
    target: { x: 19.5, y: 1.65, z: -15.0 },
    desc: 'Viewing the wall-mounted botanical art frame on the lounge side wall.',
  },
  {
    num: '12',
    name: 'turntable_transition',
    pos: { x: 12.2, y: 1.7, z: -6.5 },
    target: { x: 16.0, y: 1.6, z: -3.0 },
    desc: 'Transitioning from lounge to the music selector booth.',
  },
  {
    num: '13',
    name: 'turntable_booth',
    pos: { x: 13.0, y: 1.7, z: -1.4 },
    target: { x: 18.0, y: 1.55, z: 0.0 },
    desc: 'The turntable console and walnut-veneered speaker towers.',
  },
];

export function getRoomForPosition(x, z) {
  return (
    ROOMS.find((room) => {
      const bounds = room.bounds;
      return x >= bounds.xMin && x <= bounds.xMax && z >= bounds.zMin && z <= bounds.zMax;
    }) || ROOMS.at(-1)
  );
}

export function resolveArtifactPath(...segments) {
  const root = getEnv('VISUAL_QA_OUT_DIR') || DEFAULT_ARTIFACT_ROOT;
  return joinPath(root, ...segments);
}

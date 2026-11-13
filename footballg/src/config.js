// World layout (metres). The goal we shoot at sits on the line z = 0, the pitch
// extends towards +z, +x is to the kicker's right, +y is up.
export const F = {
  halfW: 34,
  length: 105,
  goalHalfW: 3.66,
  goalH: 2.44,
  postR: 0.06,
  ballR: 0.11,
  ballMass: 0.43,
  penaltyZ: 11,
  netTopDepth: 1.0,
  netBottomDepth: 2.2,
  boardZ: -5.2,
  boardX: 38.5,
};

export const QUALITY = {
  low: {
    label: '低',
    maxPixelRatio: 0.8,
    shadowLights: 1,
    shadowSize: 1024,
    post: false,
    msaa: 0,
    smaa: false,
    bloom: false,
    dof: false,
    ao: false,
    motionBlur: false,
    blades: 0,
    crowd: 0.4,
    envSize: 64,
    anisotropy: 2,
    netStep: 2,
  },
  medium: {
    label: '中',
    maxPixelRatio: 1,
    shadowLights: 2,
    shadowSize: 1024,
    post: true,
    msaa: 0,
    smaa: true,
    bloom: true,
    dof: false,
    ao: false,
    motionBlur: false,
    blades: 0,
    crowd: 0.75,
    envSize: 128,
    anisotropy: 4,
    netStep: 1,
  },
  high: {
    label: '高',
    maxPixelRatio: 1.5,
    shadowLights: 4,
    shadowSize: 2048,
    post: true,
    msaa: 0,
    smaa: true,
    bloom: true,
    dof: true,
    ao: true,
    motionBlur: true,
    blades: 70000,
    crowd: 1,
    envSize: 256,
    anisotropy: 8,
    netStep: 1,
  },
  ultra: {
    label: '极致',
    maxPixelRatio: 2,
    shadowLights: 4,
    shadowSize: 4096,
    post: true,
    msaa: 4,
    smaa: true,
    bloom: true,
    dof: true,
    ao: true,
    motionBlur: true,
    blades: 150000,
    crowd: 1,
    envSize: 256,
    anisotropy: 16,
    netStep: 1,
  },
};

export const DIFFICULTY = {
  easy: { label: '简单', react: 0.34, speed: 4.6, guessRight: 0.42, noise: 0.55, reach: 0.92 },
  normal: { label: '普通', react: 0.27, speed: 5.4, guessRight: 0.55, noise: 0.38, reach: 1.0 },
  hard: { label: '困难', react: 0.21, speed: 6.1, guessRight: 0.68, noise: 0.24, reach: 1.06 },
};

const params = new URLSearchParams(location.search);

export const URLP = {
  quality: params.get('q'),
  capture: params.has('capture'),
  debug: params.has('debug'),
  seed: params.get('seed'),
  mute: params.has('mute'),
  autostart: params.get('start'),
};

export function loadSettings() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem('footballg.settings') || '{}');
  } catch (e) {
    s = {};
  }
  return {
    quality: URLP.quality || s.quality || null,
    difficulty: s.difficulty || 'normal',
    sound: s.sound !== false,
  };
}

export function saveSettings(s) {
  try {
    localStorage.setItem('footballg.settings', JSON.stringify(s));
  } catch (e) {
    /* storage unavailable */
  }
}

// Small deterministic PRNG so world generation is stable between runs.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

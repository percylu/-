import * as THREE from 'three';
import { mulberry32 } from '../config.js';

// Fictional squads. Names are generic surnames; none of these describe a real player.
export const HOME_SQUAD = [
  { name: 'LIN', cn: '林', number: 10, skin: 0xd6a27a, hair: 0x15100c, style: 'crop', beard: 0.15, height: 1.0, bulk: 1.0, foot: 'R', boots: [0x16181c, 0xe8ff3a], eye: 0x2b1a10 },
  { name: 'ZHOU', cn: '周', number: 7, skin: 0xe4b792, hair: 0x221810, style: 'quiff', beard: 0.0, height: 0.975, bulk: 0.94, foot: 'L', boots: [0xf4f4f4, 0xff5a36], eye: 0x2b1a10 },
  { name: 'ADE', cn: '阿德', number: 9, skin: 0x7b4f35, hair: 0x0c0a09, style: 'buzz', beard: 0.55, height: 1.04, bulk: 1.08, foot: 'R', boots: [0xff6a1a, 0x16181c], eye: 0x1c100a },
  { name: 'COSTA', cn: '科斯塔', number: 8, skin: 0xb98159, hair: 0x1a120c, style: 'curly', beard: 0.4, height: 0.99, bulk: 1.0, foot: 'R', boots: [0x19c2e6, 0xffffff], eye: 0x3a2412 },
  { name: 'BERG', cn: '贝里', number: 11, skin: 0xefc6a2, hair: 0xb8904e, style: 'mop', beard: 0.1, height: 1.02, bulk: 0.97, foot: 'L', boots: [0x16181c, 0xffffff], eye: 0x4a6a7c },
];

export const AWAY_SQUAD = [
  { name: 'HALE', number: 5, skin: 0xe0b08a, hair: 0x3a2a1a, style: 'crop', beard: 0.5, height: 1.05, bulk: 1.06, boots: [0x1a1a1a, 0xff5a36], eye: 0x3a2a1a },
  { name: 'MORO', number: 4, skin: 0x8d5a3b, hair: 0x0e0b0a, style: 'curly', beard: 0.2, height: 1.03, bulk: 1.04, boots: [0xf2f2f2, 0x19c2e6], eye: 0x1c100a },
  { name: 'YUN', number: 8, skin: 0xd9a57c, hair: 0x14100c, style: 'quiff', beard: 0.0, height: 0.97, bulk: 0.95, boots: [0xe8ff3a, 0x16181c], eye: 0x2b1a10 },
  { name: 'IVES', number: 6, skin: 0xf0c8a0, hair: 0x6b4a2a, style: 'mop', beard: 0.3, height: 1.0, bulk: 1.0, boots: [0x1a1a1a, 0xffffff], eye: 0x4a6a4a },
  { name: 'DIAS', number: 3, skin: 0xc08a60, hair: 0x1c1410, style: 'buzz', beard: 0.6, height: 0.99, bulk: 1.02, boots: [0xff3a6a, 0x16181c], eye: 0x2b1a10 },
  { name: 'NOOR', number: 2, skin: 0xa9714b, hair: 0x100c0a, style: 'crop', beard: 0.35, height: 1.01, bulk: 0.98, boots: [0x1a1a1a, 0xe8ff3a], eye: 0x2b1a10 },
];

export const KEEPER_LOOK = { name: 'WEN', number: 1, skin: 0xc9966c, hair: 0x2a1c12, style: 'crop', beard: 0.45, height: 1.045, bulk: 1.04, boots: [0xf2f2f2, 0x16181c], eye: 0x2b1a10 };
export const REF_LOOK = { name: '', number: null, skin: 0xdcae88, hair: 0x4a4038, style: 'buzz', beard: 0.25, height: 0.98, bulk: 1.0, boots: [0x16181c, 0x16181c], eye: 0x3a2a1a };

const css = (c, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
// colours are picked in sRGB so the canvas matches the hex values used for vertex colours
const srgb = (hex) => {
  const c = new THREE.Color();
  c.setHex(hex, THREE.NoColorSpace);
  return c;
};
const mix = (a, b, k) => a.clone().lerp(b, k);

// Face texture bounds in bind space (metres). The head maps into it with a frontal planar projection.
export const FACE_RECT = { x0: -0.095, w: 0.19, y0: 1.565, h: 0.26 };

export function makeFaceTexture(look) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = mulberry32((look.number || 3) * 7919 + (look.skin & 0xffff));
  const X = (x) => ((x - FACE_RECT.x0) / FACE_RECT.w) * S;
  const Y = (y) => (1 - (y - FACE_RECT.y0) / FACE_RECT.h) * S;
  const sx = S / FACE_RECT.w;
  const sy = S / FACE_RECT.h;
  const skin = srgb(look.skin);
  const hair = srgb(look.hair);
  const dark = mix(skin, srgb(0x2a1208), 0.55);
  const red = mix(skin, srgb(0xb0453a), 0.5);
  const light = mix(skin, srgb(0xfff0e0), 0.35);
  const lum = skin.r * 0.3 + skin.g * 0.6 + skin.b * 0.1;

  g.fillStyle = css(skin);
  g.fillRect(0, 0, S, S);

  const blob = (x, y, rx, ry, col, a) => {
    g.save();
    g.translate(X(x), Y(y));
    g.scale(rx * sx, ry * sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, css(col, a));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  // broad modelling: forehead light, temples, cheeks, jaw, sockets
  blob(0, 1.752, 0.05, 0.022, light, 0.22);
  blob(0, 1.694, 0.012, 0.03, light, 0.2);
  for (const s of [-1, 1]) {
    blob(s * 0.046, 1.668, 0.026, 0.022, red, 0.18);
    blob(s * 0.064, 1.63, 0.03, 0.045, dark, 0.3);
    blob(s * 0.031, 1.716, 0.022, 0.014, dark, 0.42);
    blob(s * 0.074, 1.72, 0.02, 0.05, dark, 0.22);
    blob(s * 0.02, 1.672, 0.01, 0.012, dark, 0.3);
  }
  blob(0, 1.655, 0.016, 0.006, dark, 0.5);
  blob(0, 1.612, 0.03, 0.008, dark, 0.3);
  blob(0, 1.596, 0.02, 0.012, light, 0.16);
  blob(0, 1.67, 0.012, 0.008, red, 0.25);

  // stubble / beard
  if (look.beard > 0.05) {
    const bc = mix(hair, skin, 0.25);
    const n = Math.round(2600 * look.beard);
    for (let i = 0; i < n; i++) {
      const x = (rng() * 2 - 1) * 0.078;
      const y = 1.572 + rng() * 0.092;
      const ax = Math.abs(x);
      // jaw line, chin and moustache; keep the cheeks and lips clear
      const jaw = y < 1.612 + ax * 0.75;
      const tache = y > 1.648 && y < 1.661 && ax < 0.03;
      const chin = ax < 0.028 && y < 1.626;
      if (!(jaw || tache || chin)) continue;
      if (ax < 0.024 && y > 1.628 && y < 1.647) continue;
      g.fillStyle = css(bc, 0.2 + 0.5 * look.beard * rng());
      g.fillRect(X(x), Y(y), 1.6, 1.9);
    }
    if (look.beard > 0.45) {
      blob(0, 1.6, 0.075, 0.035, bc, 0.3 * look.beard);
      blob(0, 1.655, 0.03, 0.007, bc, 0.5 * look.beard);
    }
  }

  // hairline
  const hl = look.style === 'buzz' ? 0.55 : 0.95;
  g.save();
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, Y(1.69));
  g.lineTo(X(-0.079), Y(1.7));
  g.quadraticCurveTo(X(-0.07), Y(1.745), X(-0.05), Y(1.766));
  g.quadraticCurveTo(X(0), Y(1.782), X(0.05), Y(1.766));
  g.quadraticCurveTo(X(0.07), Y(1.745), X(0.079), Y(1.7));
  g.lineTo(S, Y(1.69));
  g.lineTo(S, 0);
  g.closePath();
  g.shadowColor = css(hair, hl);
  g.shadowBlur = 7;
  g.fillStyle = css(hair, hl);
  g.fill();
  g.restore();

  for (const s of [-1, 1]) {
    const ex = s * 0.0315;
    const ey = 1.7135;
    // upper lid shadow and crease
    blob(ex, ey + 0.007, 0.02, 0.006, dark, 0.5);
    // eye white
    g.save();
    g.beginPath();
    g.moveTo(X(ex - 0.0165), Y(ey - 0.0008));
    g.quadraticCurveTo(X(ex - 0.002 * s), Y(ey + 0.0108), X(ex + 0.0165), Y(ey + 0.0006));
    g.quadraticCurveTo(X(ex), Y(ey - 0.0074), X(ex - 0.0165), Y(ey - 0.0008));
    g.closePath();
    g.fillStyle = lum > 0.5 ? '#e9e3dc' : '#ded6cc';
    g.fill();
    g.clip();
    // iris, pupil, catch light
    const ic = srgb(look.eye || 0x2b1a10);
    g.fillStyle = css(mix(ic, srgb(0x000000), 0.35));
    g.beginPath();
    g.ellipse(X(ex), Y(ey + 0.0008), 0.0076 * sx, 0.0076 * sy, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(ic);
    g.beginPath();
    g.ellipse(X(ex), Y(ey + 0.0008), 0.0063 * sx, 0.0063 * sy, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#060404';
    g.beginPath();
    g.ellipse(X(ex), Y(ey + 0.0008), 0.003 * sx, 0.003 * sy, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(X(ex + 0.002), Y(ey + 0.0036), 2.2, 2.2);
    // shade under the upper lid
    g.fillStyle = 'rgba(20,10,6,0.35)';
    g.fillRect(X(ex - 0.018), Y(ey + 0.0105), 0.036 * sx, 0.005 * sy);
    g.restore();
    // lash line and lower lid
    g.strokeStyle = 'rgba(24,12,8,0.9)';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(ex - 0.0175), Y(ey - 0.001));
    g.quadraticCurveTo(X(ex - 0.002 * s), Y(ey + 0.0114), X(ex + 0.0175), Y(ey + 0.0004));
    g.stroke();
    g.strokeStyle = css(dark, 0.55);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(X(ex - 0.0145), Y(ey - 0.0024));
    g.quadraticCurveTo(X(ex), Y(ey - 0.008), X(ex + 0.015), Y(ey - 0.0008));
    g.stroke();
    // brow: short strokes following an arch, thicker towards the nose
    const bc = mix(hair, srgb(0x120a06), 0.35);
    for (let i = 0; i < 90; i++) {
      const k = rng();
      const bx = ex + s * (-0.017 + k * 0.036);
      const arch = 1.7355 + Math.sin(k * 2.4) * 0.0048 - k * 0.0022;
      const th = (1 - k * 0.6) * 0.0036;
      const by = arch + (rng() - 0.5) * th * 2;
      g.strokeStyle = css(bc, 0.5 + rng() * 0.4);
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(X(bx), Y(by));
      g.lineTo(X(bx + s * 0.0045), Y(by + 0.0014 - k * 0.003));
      g.stroke();
    }
    // nostril and nose wing
    blob(s * 0.0085, 1.6635, 0.0048, 0.003, srgb(0x1a0c08), 0.75);
    g.strokeStyle = css(dark, 0.4);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(X(s * 0.0155), Y(1.676));
    g.quadraticCurveTo(X(s * 0.019), Y(1.666), X(s * 0.012), Y(1.661));
    g.stroke();
    // smile line
    g.strokeStyle = css(dark, 0.22);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(s * 0.02), Y(1.664));
    g.quadraticCurveTo(X(s * 0.031), Y(1.65), X(s * 0.03), Y(1.632));
    g.stroke();
  }

  // lips
  const lipU = mix(skin, srgb(0x7a2f2c), lum > 0.45 ? 0.5 : 0.35);
  const lipL = mix(skin, srgb(0xa5524c), lum > 0.45 ? 0.45 : 0.3);
  g.fillStyle = css(lipU, 0.95);
  g.beginPath();
  g.moveTo(X(-0.024), Y(1.6375));
  g.quadraticCurveTo(X(-0.01), Y(1.6465), X(-0.003), Y(1.6442));
  g.quadraticCurveTo(X(0), Y(1.6428), X(0.003), Y(1.6442));
  g.quadraticCurveTo(X(0.01), Y(1.6465), X(0.024), Y(1.6375));
  g.quadraticCurveTo(X(0), Y(1.6392), X(-0.024), Y(1.6375));
  g.fill();
  g.fillStyle = css(lipL, 0.95);
  g.beginPath();
  g.moveTo(X(-0.024), Y(1.6375));
  g.quadraticCurveTo(X(0), Y(1.6388), X(0.024), Y(1.6375));
  g.quadraticCurveTo(X(0.012), Y(1.6268), X(0), Y(1.6262));
  g.quadraticCurveTo(X(-0.012), Y(1.6268), X(-0.024), Y(1.6375));
  g.fill();
  blob(0, 1.6315, 0.01, 0.003, light, 0.3);
  g.strokeStyle = 'rgba(40,14,12,0.85)';
  g.lineWidth = 1.7;
  g.beginPath();
  g.moveTo(X(-0.0245), Y(1.6372));
  g.quadraticCurveTo(X(0), Y(1.6394), X(0.0245), Y(1.6372));
  g.stroke();

  // pores / freckle noise so the skin is not one flat tone
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rng() < 0.5 ? css(dark, 0.05) : css(light, 0.05);
    g.fillRect(rng() * S, rng() * S, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Shirt front: generic crest on the wearer's left chest plus a small number.
export function makeFrontTexture(kit) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const fg = kit.numColor || '#ffffff';
  // image x grows towards the wearer's left once mapped on the chest
  const bx = 186;
  const by = 78;
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(bx - 20, by - 24);
  g.lineTo(bx + 20, by - 24);
  g.lineTo(bx + 20, by + 4);
  g.quadraticCurveTo(bx + 18, by + 22, bx, by + 30);
  g.quadraticCurveTo(bx - 18, by + 22, bx - 20, by + 4);
  g.closePath();
  g.fill();
  g.fillStyle = `#${new THREE.Color(kit.jersey).getHexString()}`;
  g.beginPath();
  g.moveTo(bx - 14, by - 18);
  g.lineTo(bx + 14, by - 18);
  g.lineTo(bx + 14, by + 3);
  g.quadraticCurveTo(bx + 12, by + 17, bx, by + 23);
  g.quadraticCurveTo(bx - 12, by + 17, bx - 14, by + 3);
  g.closePath();
  g.fill();
  g.fillStyle = fg;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 4.5 : 10.5;
    g.lineTo(bx + Math.cos(a) * r, by + 1 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  if (kit.number !== null && kit.number !== undefined) {
    g.font = '900 58px "Helvetica Neue",Arial,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(kit.number), 128, 150);
  }
  // maker-less sleeve-colour chevron on the other side
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(56, 70);
  g.lineTo(70, 86);
  g.lineTo(84, 70);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

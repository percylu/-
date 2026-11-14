import * as THREE from 'three';
import { mulberry32 } from '../config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Tileable fBm value noise, four decorrelated channels.
export function makeNoiseTexture(size = 256) {
  const rnd = mulberry32(1337);
  const data = new Uint8Array(size * size * 4);
  for (let ch = 0; ch < 4; ch++) {
    const octaves = [4, 8, 16, 32, 64];
    const grids = octaves.map((p) => {
      const g = new Float32Array(p * p);
      for (let i = 0; i < g.length; i++) g[i] = rnd();
      return g;
    });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        let amp = 0.5;
        let norm = 0;
        for (let o = 0; o < octaves.length; o++) {
          const p = octaves[o];
          const g = grids[o];
          const fx = (x / size) * p;
          const fy = (y / size) * p;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          let tx = fx - x0;
          let ty = fy - y0;
          tx = tx * tx * (3 - 2 * tx);
          ty = ty * ty * (3 - 2 * ty);
          const x1 = (x0 + 1) % p;
          const y1 = (y0 + 1) % p;
          const a = g[y0 * p + x0];
          const b = g[y0 * p + x1];
          const c = g[y1 * p + x0];
          const d = g[y1 * p + x1];
          v += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
          norm += amp;
          amp *= 0.5;
        }
        data[(y * size + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round((v / norm) * 255)));
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Dense field of grass blade strokes -> greyscale height used for albedo
// modulation and a derived normal map.
export function makeGrassDetail(size = 512) {
  const rnd = mulberry32(4242);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = '#6a6a6a';
  g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  const blades = Math.round(size * size * 0.09);
  for (let i = 0; i < blades; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 5 + rnd() * 12;
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    const v = Math.round(60 + rnd() * 170);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 0.8 + rnd() * 1.4;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * size;
        const py = y + oy * size;
        if (px < -20 || px > size + 20 || py < -20 || py > size + 20) continue;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + dx * 0.5 + (rnd() - 0.5) * 3, py + dy * 0.5, px + dx, py + dy);
        g.stroke();
      }
    }
  }
  const img = g.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) h[i] = img[i * 4] / 255;
  const out = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x + size - 1) % size;
      const xp = (x + 1) % size;
      const ym = (y + size - 1) % size;
      const yp = (y + 1) % size;
      const dx = (h[y * size + xp] - h[y * size + xm]) * strength;
      const dy = (h[yp * size + x] - h[ym * size + x]) * strength;
      const l = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = Math.round((-dx * l * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((-dy * l * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((l * 0.5 + 0.5) * 255);
      out[i + 3] = Math.round(h[y * size + x] * 255);
    }
  }
  const tex = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Classic 32-panel ball (truncated icosahedron) baked into equirect maps.
export function makeBallTextures(width = 2048) {
  const height = width / 2;
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw = [];
  for (const a of [-1, 1]) {
    for (const b of [-phi, phi]) {
      raw.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }
  // Rotate so that one vertex sits on the +Y pole (keeps UV pinching inside a pentagon).
  const up = new THREE.Vector3(...raw[0]).normalize();
  const rot = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
  const verts = raw.map((v) => new THREE.Vector3(...v).normalize().applyQuaternion(rot));
  const faces = [];
  const edgeDot = verts[0].dot(verts.slice(1).reduce((best, v) => (v.dot(verts[0]) > best.dot(verts[0]) ? v : best)));
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (
          Math.abs(verts[i].dot(verts[j]) - edgeDot) < 1e-3 &&
          Math.abs(verts[j].dot(verts[k]) - edgeDot) < 1e-3 &&
          Math.abs(verts[i].dot(verts[k]) - edgeDot) < 1e-3
        ) {
          faces.push(new THREE.Vector3().add(verts[i]).add(verts[j]).add(verts[k]).normalize());
        }
      }
    }
  }
  const P = new Float32Array(36);
  verts.forEach((v, i) => v.toArray(P, i * 3));
  const H = new Float32Array(60);
  faces.forEach((v, i) => v.toArray(H, i * 3));

  const colorC = canvas(width, height);
  const cg = colorC.getContext('2d');
  const cImg = cg.createImageData(width, height);
  const bumpC = canvas(width, height);
  const bg = bumpC.getContext('2d');
  const bImg = bg.createImageData(width, height);
  const rnd = mulberry32(99);
  const SHIFT = 0.0775;
  for (let y = 0; y < height; y++) {
    const lat = (0.5 - (y + 0.5) / height) * Math.PI;
    const cy = Math.sin(lat);
    const cl = Math.cos(lat);
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * Math.PI * 2;
      const dx = cl * Math.cos(lon);
      const dz = cl * Math.sin(lon);
      let p1 = -2;
      for (let i = 0; i < 36; i += 3) {
        const d = dx * P[i] + cy * P[i + 1] + dz * P[i + 2];
        if (d > p1) p1 = d;
      }
      let h1 = -2;
      let h2 = -2;
      for (let i = 0; i < 60; i += 3) {
        const d = dx * H[i] + cy * H[i + 1] + dz * H[i + 2];
        if (d > h1) {
          h2 = h1;
          h1 = d;
        } else if (d > h2) h2 = d;
      }
      const aP = Math.acos(Math.min(1, p1));
      const aH = Math.acos(Math.min(1, h1));
      const aH2 = Math.acos(Math.min(1, h2));
      const s = aP - aH + SHIFT;
      const isPent = s < 0;
      const seam = Math.min(Math.abs(s) * 0.5, isPent ? 1 : (aH2 - aH) * 0.5);
      const seamLine = 1 - Math.min(1, Math.max(0, (seam - 0.004) / 0.006));
      const puff = Math.min(1, seam / 0.06);
      const puffS = puff * puff * (3 - 2 * puff);
      const grain = rnd();
      let r;
      let g;
      let b;
      if (isPent) {
        r = 14;
        g = 15;
        b = 18;
      } else {
        r = 238;
        g = 238;
        b = 234;
      }
      // Thin accent ring inside the hexagons for a modern match-ball look.
      const ring = !isPent && seam > 0.03 && seam < 0.036 ? 0.12 : 0;
      const k = 1 - seamLine * 0.72 - ring;
      const i4 = (y * width + x) * 4;
      cImg.data[i4] = r * k;
      cImg.data[i4 + 1] = g * k;
      cImg.data[i4 + 2] = b * k;
      cImg.data[i4 + 3] = 255;
      const hv = Math.round((0.25 + 0.7 * puffS + (grain - 0.5) * 0.05) * 255);
      bImg.data[i4] = bImg.data[i4 + 1] = bImg.data[i4 + 2] = hv;
      bImg.data[i4 + 3] = 255;
    }
  }
  cg.putImageData(cImg, 0, 0);
  bg.putImageData(bImg, 0, 0);
  const map = new THREE.CanvasTexture(colorC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(bumpC);
  bump.wrapS = THREE.RepeatWrapping;
  return { map, bump };
}

export function makeNetTexture() {
  const s = 64;
  const c = canvas(s, s);
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(s, 0);
  g.moveTo(0, s);
  g.lineTo(s, s);
  g.moveTo(0, 0);
  g.lineTo(0, s);
  g.moveTo(s, 0);
  g.lineTo(s, s);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.premultiplyAlpha = false;
  return tex;
}

export function makeGlowTexture() {
  const s = 128;
  const c = canvas(s, s);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Crowd atlas: 8 columns x 4 rows. Rows 0-1 seated/neutral, rows 2-3 arms raised.
export function makeCrowdAtlas() {
  const cw = 64;
  const ch = 96;
  const cols = 8;
  const rows = 4;
  const c = canvas(cw * cols, ch * rows);
  const g = c.getContext('2d');
  const rnd = mulberry32(777);
  const skins = ['#f1c9a5', '#e0ac82', '#c68a5e', '#8d5a3b', '#5c3a26', '#f6d7bd'];
  const hairs = ['#1b1512', '#2e211a', '#5a3b22', '#8a6a3a', '#111111', '#3a3a3a', '#c9b48a'];
  const shirts = [
    '#c8102e', '#c8102e', '#d82040', '#f2f2f2', '#e8e8e8', '#b00d25',
    '#1d2a44', '#2b2b2b', '#3d5a80', '#d9b310', '#4a4a4a', '#7a1020', '#ffffff', '#20304a',
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cw;
      const y0 = row * ch;
      const up = row >= 2;
      const seedIdx = (row % 2) * cols + col;
      const r2 = mulberry32(1000 + seedIdx * 31);
      const skin = skins[Math.floor(r2() * skins.length)];
      const hair = hairs[Math.floor(r2() * hairs.length)];
      const shirt = shirts[Math.floor(r2() * shirts.length)];
      const scarf = r2() < 0.3;
      const cx = x0 + cw / 2;
      g.save();
      g.beginPath();
      g.rect(x0, y0, cw, ch);
      g.clip();
      // torso
      g.fillStyle = shirt;
      g.beginPath();
      g.moveTo(cx - 19, y0 + ch);
      g.lineTo(cx - 20, y0 + 52);
      g.quadraticCurveTo(cx - 19, y0 + 40, cx - 8, y0 + 38);
      g.lineTo(cx + 8, y0 + 38);
      g.quadraticCurveTo(cx + 19, y0 + 40, cx + 20, y0 + 52);
      g.lineTo(cx + 19, y0 + ch);
      g.closePath();
      g.fill();
      // arms
      g.strokeStyle = shirt;
      g.lineWidth = 8;
      g.lineCap = 'round';
      if (up) {
        g.beginPath();
        g.moveTo(cx - 17, y0 + 46);
        g.lineTo(cx - 25, y0 + 22);
        g.moveTo(cx + 17, y0 + 46);
        g.lineTo(cx + 25, y0 + 22);
        g.stroke();
        g.strokeStyle = skin;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(cx - 25, y0 + 22);
        g.lineTo(cx - 27, y0 + 6);
        g.moveTo(cx + 25, y0 + 22);
        g.lineTo(cx + 27, y0 + 6);
        g.stroke();
      } else {
        g.beginPath();
        g.moveTo(cx - 19, y0 + 48);
        g.lineTo(cx - 22, y0 + 76);
        g.moveTo(cx + 19, y0 + 48);
        g.lineTo(cx + 22, y0 + 76);
        g.stroke();
      }
      // shading on torso
      const sh = g.createLinearGradient(x0, y0 + 38, x0, y0 + ch);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = sh;
      g.fillRect(x0, y0 + 38, cw, ch - 38);
      if (scarf) {
        g.fillStyle = r2() < 0.5 ? '#f2f2f2' : '#c8102e';
        g.fillRect(cx - 10, y0 + 36, 20, 6);
      }
      // neck + head
      g.fillStyle = skin;
      g.fillRect(cx - 4, y0 + 30, 8, 10);
      g.beginPath();
      g.ellipse(cx, y0 + 22, 9.5, 11.5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(cx, y0 + 17, 10, 8.5, 0, Math.PI, Math.PI * 2);
      g.fill();
      if (rnd() < 0.2) {
        // cap
        g.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
        g.beginPath();
        g.ellipse(cx, y0 + 15, 10.5, 7, 0, Math.PI, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

const AD_SEGMENTS = [
  { text: '绿茵绝杀 FOOTBALL G', bg: ['#0b1e5b', '#1746c9'], fg: '#ffffff' },
  { text: '公平竞赛 · FAIR PLAY', bg: ['#f2f2f2', '#ffffff'], fg: '#0b1e5b' },
  { text: '冠军之夜 CHAMPIONS NIGHT', bg: ['#b3001b', '#e11d2f'], fg: '#ffffff' },
  { text: '为热爱而战', bg: ['#0d0d0d', '#1f1f1f'], fg: '#f5c518' },
  { text: '一脚定胜负 ONE SHOT', bg: ['#00603a', '#00a35c'], fg: '#ffffff' },
  { text: '尊重 · RESPECT', bg: ['#f5c518', '#ffd84a'], fg: '#111111' },
];

export function makeAdBoardTexture() {
  const segW = 768;
  const h = 96;
  const c = canvas(segW * AD_SEGMENTS.length, h);
  const g = c.getContext('2d');
  AD_SEGMENTS.forEach((s, i) => {
    const x0 = i * segW;
    const grad = g.createLinearGradient(x0, 0, x0 + segW, 0);
    grad.addColorStop(0, s.bg[0]);
    grad.addColorStop(0.5, s.bg[1]);
    grad.addColorStop(1, s.bg[0]);
    g.fillStyle = grad;
    g.fillRect(x0, 0, segW, h);
    g.fillStyle = s.fg;
    g.font = '900 54px "PingFang SC","Microsoft YaHei","Noto Sans SC","WenQuanYi Micro Hei",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s.text, x0 + segW / 2, h / 2 + 3, segW - 60);
  });
  // LED pixel grid
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let x = 0; x < c.width; x += 4) g.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, c.width, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return { tex, aspect: c.width / h };
}

export function makeNumberTexture(number, name, fg = '#ffffff') {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 34px "Helvetica Neue",Arial,sans-serif';
  g.fillText(name, 128, 34, 240);
  g.font = '900 190px "Helvetica Neue",Arial,sans-serif';
  g.fillText(String(number), 128, 156);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

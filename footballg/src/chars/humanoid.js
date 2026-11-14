import * as THREE from 'three';
import { makeNumberTexture } from '../world/textures.js';
import { mulberry32 } from '../config.js';
import { makeFaceTexture, makeFrontTexture, FACE_RECT } from './looks.js';

// Procedural skinned footballer. Bind pose: standing, facing +z, arms down.
export const BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'uArmL', 'lArmL', 'handL', 'uArmR', 'lArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
];
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const PARENT = {
  spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  uArmL: 'chest', lArmL: 'uArmL', handL: 'lArmL', uArmR: 'chest', lArmR: 'uArmR', handR: 'lArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR',
};
const AX = 0.19; // shoulder / arm line
const LX = 0.094; // hip / leg line
const BIND = {
  hips: [0, 0.97, 0], spine: [0, 1.08, 0], chest: [0, 1.27, 0], neck: [0, 1.495, 0], head: [0, 1.585, 0],
  uArmL: [AX, 1.445, 0], lArmL: [AX, 1.165, 0], handL: [AX, 0.905, 0],
  uArmR: [-AX, 1.445, 0], lArmR: [-AX, 1.165, 0], handR: [-AX, 0.905, 0],
  thighL: [LX, 0.925, 0], shinL: [LX, 0.5, 0], footL: [LX, 0.085, 0],
  thighR: [-LX, 0.925, 0], shinR: [-LX, 0.5, 0], footR: [-LX, 0.085, 0],
};
export const HIP_HEIGHT = BIND.hips[1];
export const ANKLE_H = BIND.footL[1];
const L_THIGH = BIND.thighL[1] - BIND.shinL[1];
const L_SHIN = BIND.shinL[1] - BIND.footL[1];
export const LEG_LEN = L_THIGH + L_SHIN;
// hip joint relative to the hips bone
export const HIP_JOINT = [LX, BIND.thighL[1] - BIND.hips[1]];

export const KITS = {
  home: {
    jersey: 0xc4122e, trim: 0xf4f4f4, shorts: 0xf2f2f2, shortsTrim: 0xc4122e, socks: 0xc4122e, sockTrim: 0xf4f4f4,
    pattern: 1, patCol: 0x8f0b20, long: false, gloves: null, numColor: '#ffffff',
  },
  keeper: {
    jersey: 0x1fb45a, trim: 0x0d3b1f, shorts: 0x12331f, shortsTrim: 0x1fb45a, socks: 0x1fb45a, sockTrim: 0x0d3b1f,
    pattern: 3, patCol: 0x0d3b1f, long: true, gloves: 0xf3f3f0, gloveTrim: 0xff5a1f, numColor: '#0d3b1f',
  },
  away: {
    jersey: 0x16264f, trim: 0x6fb7ff, shorts: 0x16264f, shortsTrim: 0x6fb7ff, socks: 0xf2f2f2, sockTrim: 0x16264f,
    pattern: 2, patCol: 0x6fb7ff, long: false, gloves: null, numColor: '#ffffff',
  },
  referee: {
    jersey: 0xe9d72b, trim: 0x15171a, shorts: 0x15171a, shortsTrim: 0x15171a, socks: 0x15171a, sockTrim: 0xe9d72b,
    pattern: 0, patCol: 0x15171a, long: false, gloves: null, numColor: '#15171a',
  },
};
const DEFAULT_LOOK = { skin: 0xd9a57c, hair: 0x1c1410, style: 'crop', beard: 0, bulk: 1, boots: [0x16181c, 0xe8ff3a], number: null, name: '' };

const HAIR_STYLES = {
  crop: { top: 0.015, side: 0.007, front: 0.009, curl: 0.0035, fade: 0.35, fringe: 0, nape: 0, skinMix: 0 },
  quiff: { top: 0.02, side: 0.005, front: 0.03, curl: 0.003, fade: 0.65, fringe: 0, nape: 0, skinMix: 0 },
  buzz: { top: 0.004, side: 0.003, front: 0, curl: 0.0005, fade: 0.5, fringe: 0, nape: 0, skinMix: 0.32 },
  curly: { top: 0.03, side: 0.02, front: 0.012, curl: 0.009, fade: 0.15, fringe: 0.004, nape: 0, skinMix: 0 },
  mop: { top: 0.022, side: 0.016, front: 0.012, curl: 0.004, fade: 0, fringe: 0.016, nape: 0.03, skinMix: 0 },
};

const M = { SKIN: 0, JERSEY: 1, GLOSS: 2, HAIR: 3, GLOVE: 4, FACE: 5, SHORTS: 6, SOCK: 7 };

class MeshBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.mat = [];
    this.aux = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
  }

  vert(v) {
    const p = v.p;
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(v.c.r, v.c.g, v.c.b);
    this.mat.push(v.m || 0);
    this.aux.push(v.loose || 0, v.uv ? v.uv[0] : -1, v.uv ? v.uv[1] : -1);
    const bw = v.bw;
    this.si.push(bw[0], bw[2] !== undefined ? bw[2] : bw[0], 0, 0);
    this.sw.push(bw[1], bw[3] !== undefined ? bw[3] : 0, 0, 0);
    return this.pos.length / 3 - 1;
  }

  // Closed-loop grid: fn(row, col) -> { p, c, bw, m, loose, uv }
  grid(nr, ns, fn, capA = true, capB = true, refRow = 0) {
    const start = this.pos.length / 3;
    const startIdx = this.idx.length;
    const rows = [];
    for (let r = 0; r < nr; r++) {
      const row = [];
      for (let s = 0; s < ns; s++) {
        const v = fn(r, s);
        row.push(v);
        this.vert(v);
      }
      rows.push(row);
    }
    for (let r = 0; r < nr - 1; r++) {
      for (let s = 0; s < ns; s++) {
        const a = start + r * ns + s;
        const b = start + r * ns + ((s + 1) % ns);
        const c = a + ns;
        const d = b + ns;
        this.idx.push(a, c, b, b, c, d);
      }
    }
    const centre = (ri) => {
      const p = [0, 0, 0];
      for (const v of rows[ri]) for (let k = 0; k < 3; k++) p[k] += v.p[k] / ns;
      return p;
    };
    const cap = (ri, flip) => {
      const ci = this.vert({ ...rows[ri][0], p: centre(ri) });
      for (let s = 0; s < ns; s++) {
        const a = start + ri * ns + s;
        const b = start + ri * ns + ((s + 1) % ns);
        if (flip) this.idx.push(ci, b, a);
        else this.idx.push(ci, a, b);
      }
    };
    if (capA) cap(0, false);
    if (capB) cap(nr - 1, true);
    // make sure faces point outwards
    const ri = startIdx + refRow * ns * 6;
    const i0 = this.idx[ri];
    const i1 = this.idx[ri + 1];
    const i2 = this.idx[ri + 2];
    const v = (i) => new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    const n = new THREE.Vector3().subVectors(v(i1), v(i0)).cross(new THREE.Vector3().subVectors(v(i2), v(i0)));
    const c0 = centre(refRow);
    const c1 = centre(refRow + 1);
    const mid = v(i0).add(v(i1)).add(v(i2)).multiplyScalar(1 / 3);
    const ctr = new THREE.Vector3((c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2);
    if (n.dot(mid.sub(ctr)) < 0) {
      for (let i = startIdx; i < this.idx.length; i += 3) {
        const t = this.idx[i + 1];
        this.idx[i + 1] = this.idx[i + 2];
        this.idx[i + 2] = t;
      }
    }
  }

  // rings: [{ a, c: [u, v], r: [ru, rv] | [ru, rvPos, rvNeg], n (superellipse), col | colFn(theta, p), bw, m, loose }]
  tube(rings, seg, axis = 'y', opt = {}) {
    const P = (a, u, v) => (axis === 'y' ? [u, a, v] : axis === 'z' ? [u, v, a] : [a, u, v]);
    this.grid(
      rings.length,
      seg,
      (r, s) => {
        const ring = rings[r];
        const th = (s / seg) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const e = 2 / (ring.n || 2);
        const cu = Math.sign(cs) * Math.abs(cs) ** e;
        const sv = Math.sign(sn) * Math.abs(sn) ** e;
        const rv = ring.r.length > 2 ? (sn >= 0 ? ring.r[1] : ring.r[2]) : ring.r[1];
        const p = P(ring.a, ring.c[0] + ring.r[0] * cu, ring.c[1] + rv * sv);
        return { p, c: ring.colFn ? ring.colFn(th, p) : ring.col, bw: ring.bw, m: ring.m || 0, loose: ring.loose || 0 };
      },
      opt.capA !== false,
      opt.capB !== false,
      opt.refRow || 0
    );
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aBind', new THREE.Float32BufferAttribute(this.pos.slice(), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.aux, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
// piecewise-linear lookup in a table of rows [key, ...values]
function lut(table, key) {
  if (key <= table[0][0]) return table[0];
  const last = table[table.length - 1];
  if (key >= last[0]) return last;
  let i = 0;
  while (table[i + 1][0] < key) i++;
  const a = table[i];
  const b = table[i + 1];
  const k = sstep(0, 1, (key - a[0]) / (b[0] - a[0])) * 0.5 + ((key - a[0]) / (b[0] - a[0])) * 0.5;
  return a.map((v, j) => v + (b[j] - v) * k);
}

// [y, half width, front depth, back depth, centre z, hips weight, spine weight, chest weight, looseness]
const JERSEY = [
  [0.962, 0.181, 0.131, 0.141, 0.0, 1, 0, 0, 1],
  [1.0, 0.177, 0.127, 0.135, 0.0, 1, 0, 0, 0.8],
  [1.06, 0.166, 0.119, 0.123, 0.0, 0.5, 0.5, 0, 0.5],
  [1.12, 0.158, 0.113, 0.113, 0.002, 0, 1, 0, 0.4],
  [1.19, 0.16, 0.116, 0.111, 0.004, 0, 1, 0, 0.25],
  [1.27, 0.169, 0.125, 0.116, 0.006, 0, 0.5, 0.5, 0.1],
  [1.34, 0.177, 0.134, 0.123, 0.006, 0, 0, 1, 0],
  [1.4, 0.178, 0.129, 0.126, 0.002, 0, 0, 1, 0],
  [1.445, 0.168, 0.112, 0.12, -0.004, 0, 0, 1, 0],
  [1.478, 0.128, 0.092, 0.108, -0.008, 0, 0, 1, 0],
  [1.502, 0.084, 0.074, 0.088, -0.008, 0, 0, 1, 0],
];
const TORSO_N = 2.5;
function torsoZ(x, y, front, bulk) {
  const r = lut(JERSEY, y);
  const k = Math.min(0.97, Math.abs(x) / (r[1] * bulk));
  const d = (1 - k ** TORSO_N) ** (1 / TORSO_N);
  return r[4] + (front ? r[2] : -r[3]) * bulk * d;
}

// [y, half width, front depth, back depth]
const SKULL = [
  [1.57, 0.028, 0.05, 0.02],
  [1.582, 0.043, 0.078, 0.038],
  [1.6, 0.054, 0.089, 0.053],
  [1.625, 0.062, 0.094, 0.066],
  [1.655, 0.068, 0.0965, 0.079],
  [1.685, 0.0725, 0.096, 0.089],
  [1.715, 0.075, 0.0945, 0.096],
  [1.742, 0.076, 0.096, 0.1],
  [1.768, 0.0745, 0.094, 0.1],
  [1.79, 0.068, 0.084, 0.093],
  [1.806, 0.054, 0.063, 0.074],
  [1.816, 0.03, 0.033, 0.042],
];
const SKULL_N = 2.25;
function faceRelief(x, y) {
  let d = 0;
  d += 0.0035 * gauss(y - 1.737, 0.008) * (1 - 0.4 * gauss(x, 0.012));
  d -= 0.0062 * gauss(y - 1.713, 0.011) * (gauss(x - 0.032, 0.014) + gauss(x + 0.032, 0.014));
  d += 0.004 * gauss(x, 0.012) * sstep(1.66, 1.7, y) * (1 - sstep(1.72, 1.742, y));
  d += 0.003 * gauss(y - 1.685, 0.014) * (gauss(x - 0.05, 0.016) + gauss(x + 0.05, 0.016));
  d += 0.0045 * gauss(y - 1.637, 0.011) * gauss(x, 0.024);
  d -= 0.002 * gauss(y - 1.615, 0.006) * gauss(x, 0.02);
  d += 0.004 * gauss(y - 1.594, 0.01) * gauss(x, 0.02);
  return d;
}
function skull(y, th) {
  const r = lut(SKULL, y);
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const e = 2 / SKULL_N;
  const x = r[1] * Math.sign(cs) * Math.abs(cs) ** e;
  let z = 0.004 + (sn >= 0 ? r[2] : r[3]) * Math.sign(sn) * Math.abs(sn) ** e;
  if (sn > 0) z += faceRelief(x, y) * sstep(0, 0.5, sn);
  return [x, z];
}
// hairline height by angle from the front of the head
const HAIRLINE = [[0, 1.774], [0.55, 1.771], [0.95, 1.748], [1.2, 1.708], [1.4, 1.712], [1.6, 1.742], [1.85, 1.69], [2.3, 1.648], [Math.PI, 1.638]];

function buildGeometry(kit) {
  const C = (hex) => new THREE.Color(hex);
  const jersey = C(kit.jersey);
  const trim = C(kit.trim);
  const shorts = C(kit.shorts);
  const shortsTrim = C(kit.shortsTrim);
  const socks = C(kit.socks);
  const sockTrim = C(kit.sockTrim);
  const boots = C(kit.boots[0]);
  const bootTrim = C(kit.boots[1]);
  const sole = C(0x101012);
  const skin = C(kit.skin);
  const skinWarm = C(kit.skin).lerp(C(0xb5503f), 0.22);
  const inner = C(kit.jersey).multiplyScalar(0.35);
  const hairC = C(kit.hair);
  const gloves = kit.gloves ? C(kit.gloves) : null;
  const gloveTrim = kit.gloves ? C(kit.gloveTrim || kit.trim) : null;
  const white = C(0xffffff);
  const bulk = kit.bulk || 1;
  const rng = mulberry32((kit.number || 17) * 9973 + 11);
  const mb = new MeshBuilder();
  const B = BI;

  // --- pelvis + shorts ---
  const Sh = (a, rx, rf, rb, bw, loose = 0, col = shorts) => ({ a, c: [0, 0], r: [rx * bulk, rf * bulk, rb * bulk], n: 2.4, col, bw, m: M.SHORTS, loose });
  mb.tube(
    [
      Sh(0.79, 0.03, 0.05, 0.05, [B.hips, 1]),
      Sh(0.815, 0.075, 0.082, 0.09, [B.hips, 1]),
      Sh(0.87, 0.142, 0.1, 0.114, [B.hips, 1]),
      Sh(0.925, 0.166, 0.11, 0.13, [B.hips, 1]),
      Sh(0.985, 0.164, 0.111, 0.124, [B.hips, 1]),
      Sh(1.03, 0.157, 0.108, 0.114, [B.hips, 0.8, B.spine, 0.2]),
      Sh(1.07, 0.15, 0.104, 0.108, [B.hips, 0.5, B.spine, 0.5]),
    ],
    20
  );

  // --- jersey ---
  const sideCol = (th) => (Math.abs(Math.cos(th)) > 0.955 ? trim : jersey);
  const jRing = (row, col = null) => {
    const [y, rx, rf, rb, cz, wh, ws, wc, loose] = row;
    const bw = wh >= 1 ? [B.hips, 1] : ws >= 1 ? [B.spine, 1] : wc >= 1 ? [B.chest, 1] : wh > 0 ? [B.hips, wh, B.spine, ws] : [B.spine, ws, B.chest, wc];
    return { a: y, c: [0, cz], r: [rx * bulk, rf * bulk, rb * bulk], n: TORSO_N, col, colFn: col ? null : sideCol, bw, m: M.JERSEY, loose };
  };
  mb.tube(
    [
      { ...jRing(JERSEY[0], inner), a: 0.985, r: [0.168 * bulk, 0.118 * bulk, 0.128 * bulk], loose: 0.6 },
      { ...jRing(JERSEY[0], trim), a: 0.958 },
      ...JERSEY.map((r) => jRing(r)),
      { a: 1.522, c: [0, -0.006], r: [0.07, 0.068, 0.076], col: trim, bw: [B.chest, 0.6, B.neck, 0.4], m: M.JERSEY },
      { a: 1.528, c: [0, -0.004], r: [0.064, 0.062, 0.07], col: trim, bw: [B.chest, 0.6, B.neck, 0.4], m: M.JERSEY },
      { a: 1.5, c: [0, -0.004], r: [0.058, 0.056, 0.064], col: inner, bw: [B.chest, 0.6, B.neck, 0.4], m: M.JERSEY },
    ],
    24,
    'y',
    { capA: false, refRow: 3 }
  );

  // --- neck ---
  const N = (a, r, bw, cz) => ({ a, c: [0, cz], r: [r, r * 1.08, r * 1.04], col: skin, bw, m: M.SKIN });
  mb.tube(
    [
      N(1.46, 0.062, [B.chest, 0.6, B.neck, 0.4], -0.012),
      N(1.5, 0.056, [B.chest, 0.3, B.neck, 0.7], -0.008),
      N(1.545, 0.0525, [B.neck, 1], -0.002),
      N(1.59, 0.052, [B.neck, 0.4, B.head, 0.6], 0.004),
      N(1.62, 0.054, [B.head, 1], 0.006),
    ],
    14
  );

  // --- head ---
  const hb = [B.head, 1];
  {
    const NR = 23;
    const NS = 28;
    const y0 = 1.57;
    const y1 = 1.816;
    mb.grid(NR, NS, (r, s) => {
      const y = y0 + ((y1 - y0) * r) / (NR - 1);
      const th = (s / NS) * Math.PI * 2;
      const [x, z] = skull(y, th);
      const u = z > -0.012 ? (x - FACE_RECT.x0) / FACE_RECT.w : x > 0 ? 0.985 : 0.015;
      return { p: [x, y, z], c: white, bw: y < 1.6 ? [B.head, 0.75, B.neck, 0.25] : hb, m: M.FACE, uv: [u, (y - FACE_RECT.y0) / FACE_RECT.h] };
    });
    // nose
    const Ns = (a, hw, front, cz) => ({ a, c: [0, cz], r: [hw, front, 0.012], col: skin, bw: hb, m: M.SKIN });
    mb.tube(
      [Ns(1.72, 0.0045, 0.003, 0.098), Ns(1.705, 0.006, 0.008, 0.098), Ns(1.692, 0.008, 0.014, 0.098), Ns(1.682, 0.011, 0.021, 0.098), Ns(1.674, 0.0135, 0.02, 0.098), Ns(1.668, 0.0115, 0.012, 0.098), Ns(1.663, 0.006, 0.005, 0.098)],
      10
    );
    // ears
    for (const sx of [-1, 1]) {
      const E = (a, rx, rz, dx, cz) => ({ a, c: [sx * (0.0745 + dx), cz], r: [rx, rz], col: skinWarm, bw: hb, m: M.SKIN });
      mb.tube([E(1.672, 0.004, 0.006, -0.002, -0.004), E(1.688, 0.007, 0.012, 0.002, -0.008), E(1.71, 0.009, 0.017, 0.005, -0.012), E(1.728, 0.008, 0.015, 0.005, -0.014), E(1.739, 0.004, 0.008, 0.002, -0.014)], 8);
    }
    // hair shell following the skull
    const st = HAIR_STYLES[kit.style] || HAIR_STYLES.crop;
    const hairBase = hairC.clone().lerp(skin, st.skinMix);
    const NH = 10;
    const NC = 26;
    const top = 1.812;
    mb.grid(
      NH,
      NC,
      (r, s) => {
        const th = (s / NC) * Math.PI * 2;
        let phi = Math.abs(th - Math.PI / 2);
        if (phi > Math.PI) phi = Math.PI * 2 - phi;
        let hl = lut(HAIRLINE, phi)[1];
        hl -= st.fringe * gauss(phi, 0.8) + st.nape * sstep(1.7, 2.6, phi);
        const last = r === NH - 1;
        const v = last ? 1 : r / (NH - 2);
        const y = hl + (top - hl) * Math.sin((v * Math.PI) / 2);
        const [x, z] = skull(Math.min(y, top), th);
        let t = st.side + (st.top - st.side) * sstep(0.2, 0.85, v);
        t += st.front * gauss(phi, 0.65) * sstep(0.05, 0.55, v);
        t += (rng() - 0.5) * 2 * st.curl;
        if (r === 0) t = 0.0012;
        const R = Math.hypot(x, z) || 1e-4;
        const k = last ? 0.35 : (R + t) / R;
        const lift = t * v * v * (last ? 1.15 : 0.9);
        const shade = 0.8 + rng() * 0.4;
        const c = hairBase.clone().multiplyScalar(shade);
        if (v < 0.4) c.lerp(skin, st.fade * (1 - v / 0.4) * 0.8);
        return { p: [x * k, y + lift + (last ? 0.004 : 0), z * k + st.front * 0.35 * gauss(phi, 0.6) * sstep(0.3, 0.8, v)], c, bw: hb, m: M.HAIR };
      },
      false,
      true
    );
  }

  for (const side of [1, -1]) {
    const L = side > 0;
    const uArm = L ? B.uArmL : B.uArmR;
    const lArm = L ? B.lArmL : B.lArmR;
    const hand = L ? B.handL : B.handR;
    const thigh = L ? B.thighL : B.thighR;
    const shin = L ? B.shinL : B.shinR;
    const foot = L ? B.footL : B.footR;
    const ax = AX * side;
    const ab = 0.5 + bulk * 0.5;
    const A = (a, r, col, bw, m, dx = 0, loose = 0, cz = 0) => ({ a, c: [ax + dx * side, cz], r: [r * ab, r * ab * 1.08], col, bw, m, loose });

    // sleeve
    const sl = kit.long;
    const sleeveRings = [
      A(1.492, 0.03, jersey, [B.chest, 0.6, uArm, 0.4], M.JERSEY, -0.04),
      A(1.48, 0.054, jersey, [uArm, 0.8, B.chest, 0.2], M.JERSEY, -0.018),
      A(1.448, 0.064, jersey, [uArm, 1], M.JERSEY, -0.006),
      A(1.39, 0.0635, jersey, [uArm, 1], M.JERSEY, 0, 0.2),
      A(1.33, 0.062, jersey, [uArm, 1], M.JERSEY, 0, 0.5),
    ];
    if (!sl) {
      sleeveRings.push(A(1.295, 0.0625, jersey, [uArm, 1], M.JERSEY, 0, 0.9), A(1.288, 0.063, trim, [uArm, 1], M.JERSEY, 0, 1), A(1.272, 0.063, trim, [uArm, 1], M.JERSEY, 0, 1), A(1.279, 0.053, inner, [uArm, 1], M.JERSEY, 0, 0.5));
      mb.tube(sleeveRings, 14, 'y', { capB: false });
      // bare arm
      const S = (a, r, bw, cz = 0, col = skin) => A(a, r, col, bw, M.SKIN, 0, 0, cz);
      mb.tube(
        [
          S(1.37, 0.052, [uArm, 1]),
          S(1.31, 0.053, [uArm, 1], 0.004),
          S(1.25, 0.049, [uArm, 1], 0.003),
          S(1.2, 0.044, [uArm, 0.85, lArm, 0.15]),
          S(1.165, 0.042, [uArm, 0.5, lArm, 0.5], -0.003, skinWarm),
          S(1.13, 0.0455, [lArm, 0.85, uArm, 0.15]),
          S(1.09, 0.047, [lArm, 1], 0.002),
          S(1.02, 0.042, [lArm, 1]),
          S(0.955, 0.034, [lArm, 1]),
          S(0.92, 0.029, [lArm, 1]),
          S(0.9, 0.026, [lArm, 0.5, hand, 0.5]),
        ],
        12
      );
    } else {
      // padded long sleeve with cuff
      sleeveRings.push(
        A(1.26, 0.059, jersey, [uArm, 1], M.JERSEY, 0, 0.4),
        A(1.2, 0.054, jersey, [uArm, 0.85, lArm, 0.15], M.JERSEY, 0, 0.3),
        A(1.165, 0.053, trim, [uArm, 0.5, lArm, 0.5], M.JERSEY, 0, 0.2),
        A(1.13, 0.054, trim, [lArm, 0.85, uArm, 0.15], M.JERSEY, 0, 0.2),
        A(1.085, 0.052, jersey, [lArm, 1], M.JERSEY, 0, 0.3),
        A(1.0, 0.046, jersey, [lArm, 1], M.JERSEY, 0, 0.3),
        A(0.95, 0.04, jersey, [lArm, 1], M.JERSEY, 0, 0.2),
        A(0.935, 0.04, trim, [lArm, 1], M.JERSEY),
        A(0.915, 0.038, trim, [lArm, 0.5, hand, 0.5], M.JERSEY)
      );
      mb.tube(sleeveRings, 14);
    }

    // hand: palm, four fingers, thumb. Palms face the thighs in the bind pose.
    const gk = gloves ? 1.45 : 1.1;
    const hc = gloves || skin;
    const hm = gloves ? M.GLOVE : M.SKIN;
    const hx = ax;
    const Hd = (a, rx, rz, cz = 0.004, dx = 0, col = hc) => ({ a, c: [hx + dx * side, cz], r: [rx * gk, rz * gk], n: 2.6, col, bw: [hand, 1], m: hm });
    mb.tube(
      [Hd(0.93, 0.023, 0.027, 0, 0, gloves ? gloveTrim : hc), Hd(0.905, 0.021, 0.03, 0.002, 0, gloves ? gloveTrim : hc), Hd(0.895, 0.0165, 0.037, 0.004), Hd(0.86, 0.0155, 0.043, 0.005), Hd(0.825, 0.0135, 0.042, 0.005, -0.002), Hd(0.812, 0.009, 0.038, 0.005, -0.003)],
      10
    );
    for (let f = 0; f < 4; f++) {
      const fz = (-0.031 + f * 0.0215) * gk + 0.005;
      const len = [0.068, 0.078, 0.082, 0.072][f] * (gloves ? 1.25 : 1);
      const fr = (gloves ? 0.0125 : 0.0088) * (f === 0 ? 0.9 : 1);
      // relaxed curl towards the palm
      const Fg = (k, r) => ({ a: 0.822 - len * k, c: [hx - side * (0.003 + 0.02 * k * k) * (gloves ? 0.5 : 1), fz * (1 - 0.06 * k)], r: [r, r], col: hc, bw: [hand, 1], m: hm });
      mb.tube([Fg(0, fr), Fg(0.38, fr), Fg(0.72, fr * 0.92), Fg(0.95, fr * 0.8), Fg(1.03, fr * 0.4)], 6);
    }
    {
      const tr = gloves ? 0.014 : 0.0105;
      const Th = (a, cz, dx, r) => ({ a, c: [hx - side * dx, cz * gk], r: [r, r], col: hc, bw: [hand, 1], m: hm });
      mb.tube([Th(0.892, 0.03, 0.002, tr * 1.15), Th(0.862, 0.046, 0.006, tr), Th(0.832, 0.055, 0.012, tr * 0.92), Th(0.812, 0.058, 0.016, tr * 0.6)], 6);
    }

    // --- shorts leg (open hem) ---
    const lx = LX * side;
    const lb = 0.45 + bulk * 0.55;
    const hemCol = (th) => (Math.cos(th) * side > 0.8 ? shortsTrim : shorts);
    const Q = (a, rx, rz, bw, loose, col = null, dx = 0) => ({ a, c: [lx + dx * side, 0], r: [rx * lb, rz * lb], col, colFn: col ? null : hemCol, bw, m: M.SHORTS, loose });
    mb.tube(
      [
        Q(0.955, 0.07, 0.085, [B.hips, 0.6, thigh, 0.4], 0, shorts, -0.01),
        Q(0.9, 0.098, 0.108, [thigh, 0.7, B.hips, 0.3], 0),
        Q(0.82, 0.103, 0.113, [thigh, 1], 0.3),
        Q(0.73, 0.106, 0.116, [thigh, 1], 0.7),
        Q(0.665, 0.109, 0.119, [thigh, 1], 1),
        Q(0.655, 0.11, 0.12, [thigh, 1], 1, shortsTrim),
        Q(0.646, 0.11, 0.12, [thigh, 1], 1, shortsTrim),
        Q(0.652, 0.098, 0.106, [thigh, 1], 0.6, C(kit.shorts).multiplyScalar(0.4)),
      ],
      14,
      'y',
      { capB: false }
    );

    // --- leg ---
    const Lg = (a, r, rf, rb, col, bw, m, cz = 0) => ({ a, c: [lx, cz], r: [r * lb, rf * lb, rb * lb], col, bw, m });
    mb.tube(
      [
        Lg(0.8, 0.088, 0.094, 0.092, skin, [thigh, 1], M.SKIN),
        Lg(0.7, 0.084, 0.093, 0.087, skin, [thigh, 1], M.SKIN, 0.004),
        Lg(0.62, 0.074, 0.084, 0.076, skin, [thigh, 1], M.SKIN, 0.004),
        Lg(0.56, 0.062, 0.068, 0.063, skin, [thigh, 0.85, shin, 0.15], M.SKIN, 0.003),
        Lg(0.52, 0.057, 0.065, 0.057, skinWarm, [thigh, 0.65, shin, 0.35], M.SKIN, 0.006),
        Lg(0.49, 0.055, 0.063, 0.055, skinWarm, [thigh, 0.4, shin, 0.6], M.SKIN, 0.006),
        Lg(0.462, 0.052, 0.054, 0.056, skin, [shin, 0.85, thigh, 0.15], M.SKIN, 0.002),
        Lg(0.462, 0.052, 0.054, 0.056, sockTrim, [shin, 0.85, thigh, 0.15], M.SOCK, 0.002),
        Lg(0.455, 0.0545, 0.056, 0.0585, sockTrim, [shin, 1], M.SOCK, 0.001),
        Lg(0.437, 0.0555, 0.057, 0.0605, sockTrim, [shin, 1], M.SOCK, 0),
        Lg(0.431, 0.0555, 0.057, 0.061, socks, [shin, 1], M.SOCK, 0),
        Lg(0.39, 0.057, 0.058, 0.069, socks, [shin, 1], M.SOCK, -0.002),
        Lg(0.34, 0.057, 0.057, 0.072, socks, [shin, 1], M.SOCK, -0.004),
        Lg(0.27, 0.051, 0.052, 0.061, socks, [shin, 1], M.SOCK, -0.003),
        Lg(0.19, 0.042, 0.045, 0.046, socks, [shin, 1], M.SOCK, 0),
        Lg(0.13, 0.038, 0.039, 0.04, socks, [shin, 1], M.SOCK, 0),
        Lg(0.1, 0.038, 0.039, 0.041, socks, [shin, 0.5, foot, 0.5], M.SOCK, 0),
        Lg(0.07, 0.039, 0.04, 0.042, socks, [foot, 1], M.SOCK, 0),
      ],
      14
    );

    // --- boot (heel -> toe), rings in the XY plane, studs underneath ---
    const SOLE = 0.012;
    const bootCol = (z) => (th, p) => {
      const sn = Math.sin(th);
      if (sn < -0.55) return sole;
      if (sn > 0.82 && z > -0.01 && z < 0.11) return bootTrim;
      if (Math.abs(sn) < 0.3 && z > 0.02 && z < 0.1 && Math.cos(th) * side > 0) return bootTrim;
      void p;
      return boots;
    };
    const Ft = (z, rx, top, bot, cy) => ({ a: z, c: [lx, cy + SOLE], r: [rx, top, bot], n: 2.6, colFn: bootCol(z), bw: [foot, 1], m: M.GLOSS });
    mb.tube(
      [
        Ft(-0.08, 0.02, 0.028, 0.02, 0.034),
        Ft(-0.066, 0.034, 0.05, 0.03, 0.032),
        Ft(-0.03, 0.04, 0.066, 0.034, 0.034),
        Ft(0.02, 0.043, 0.056, 0.034, 0.034),
        Ft(0.07, 0.047, 0.043, 0.032, 0.032),
        Ft(0.12, 0.049, 0.032, 0.028, 0.028),
        Ft(0.165, 0.044, 0.025, 0.024, 0.024),
        Ft(0.19, 0.03, 0.018, 0.018, 0.019),
        Ft(0.2, 0.014, 0.009, 0.009, 0.016),
      ],
      12,
      'z'
    );
    for (const [sx, sz] of [[-0.022, -0.05], [0.022, -0.05], [-0.03, 0.075], [0.03, 0.075], [-0.024, 0.145], [0.024, 0.145]]) {
      const St = (a, r) => ({ a, c: [lx + sx, sz], r: [r, r], col: bootTrim, bw: [foot, 1], m: M.GLOSS });
      mb.tube([St(0.016, 0.008), St(0.001, 0.0055)], 5);
    }
  }
  return mb.build();
}

const BODY_FRAG_PARS = /* glsl */ `
varying vec3 vBind;
varying float vMatId;
varying vec2 vFuv;
uniform sampler2D uFace;
uniform vec4 uPattern;
float fgIs(float id) { return 1.0 - step(0.5, abs(vMatId - id)); }
float fgFold(vec3 p) {
  float a = sin(dot(p, vec3(9.0, 31.0, 6.0)) + 2.2 * sin(dot(p, vec3(17.0, -7.0, 11.0))));
  float b = sin(dot(p, vec3(-23.0, 14.0, 19.0)) + 1.7 * sin(dot(p, vec3(8.0, 21.0, -13.0))));
  float c = sin(dot(p, vec3(61.0, 47.0, -53.0)));
  float d = sin(dot(p, vec3(5.0, 12.0, 4.0)) + 1.6 * sin(dot(p, vec3(-11.0, 6.0, 9.0))));
  return d * 0.45 + a * 0.32 + b * 0.2 + c * 0.08;
}
float fgHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float fgNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fgHash(i), fgHash(i + vec3(1, 0, 0)), f.x), mix(fgHash(i + vec3(0, 1, 0)), fgHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fgHash(i + vec3(0, 0, 1)), fgHash(i + vec3(1, 0, 1)), f.x), mix(fgHash(i + vec3(0, 1, 1)), fgHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 fgBump(vec3 surfPos, vec3 n, float h, float faceDir) {
  vec2 dH = vec2(dFdx(h), dFdy(h));
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

function makeBodyMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aBind;\nattribute float aMat;\nattribute vec3 aAux;\nuniform vec3 uLag;\nuniform float uFlutter;\nvarying vec3 vBind;\nvarying float vMatId;\nvarying vec2 vFuv;'
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;\nvMatId = aMat;\nvFuv = aAux.yz;')
      .replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\ntransformed += aAux.x * (uLag + uFlutter * vec3(sin(aBind.y * 41.0 + uLag.x * 90.0), 0.0, cos(aBind.y * 37.0 + uLag.z * 90.0)));'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BODY_FRAG_PARS}`)
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        float fgFace = fgIs(5.0);
        float fgSkin = max(fgIs(0.0), fgFace);
        float fgJersey = fgIs(1.0);
        float fgShorts = fgIs(6.0);
        float fgSock = fgIs(7.0);
        float fgCloth = max(max(fgJersey, fgShorts), fgSock);
        float fgGloss = fgIs(2.0);
        float fgHair = fgIs(3.0);
        float fgGlove = fgIs(4.0);
        if (fgFace > 0.5) diffuseColor.rgb = texture2D(uFace, vFuv).rgb;
        // kit pattern
        if (fgJersey > 0.5) {
          float inBody = step(abs(vBind.x), 0.172);
          if (uPattern.x > 0.5 && uPattern.x < 1.5) {
            float st = abs(fract(vBind.x * 12.5 + 0.5) - 0.5) * 2.0;
            float aa = fwidth(vBind.x * 12.5) * 2.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, uPattern.yzw, smoothstep(0.5 - aa, 0.5 + aa, st) * inBody * step(vBind.y, 1.47));
          } else if (uPattern.x > 1.5 && uPattern.x < 2.5) {
            float aa = fwidth(vBind.y) * 1.5;
            float band = smoothstep(1.262 - aa, 1.262 + aa, vBind.y) * (1.0 - smoothstep(1.33 - aa, 1.33 + aa, vBind.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, uPattern.yzw, band * inBody);
          } else if (uPattern.x > 2.5) {
            float sh = sin(vBind.y * 23.0 + vBind.x * 17.0) * sin(vBind.x * 29.0 - vBind.y * 9.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, uPattern.yzw, smoothstep(0.0, 0.25, sh) * 0.4);
          }
        }
        float fgFoldH = fgFold(vBind * mix(1.0, 1.5, fgShorts));
        float fgRib = fgSock * sin(vBind.y * 210.0) * smoothstep(0.24, 0.1, vBind.y);
        float fgStrand = fgNoise(vBind * vec3(170.0, 110.0, 170.0));
        float fgPore = fgNoise(vBind * 55.0);
        // creases catch less light, weave breaks up the flat colour
        diffuseColor.rgb *= mix(1.0, mix(0.76, 1.05, smoothstep(-0.7, 0.7, fgFoldH)), fgCloth * (1.0 - 0.55 * fgSock) * (1.0 - 0.6 * fgShorts));
        float fgWeave = sin(vBind.x * 900.0) * sin(vBind.y * 900.0);
        diffuseColor.rgb *= 1.0 + fgCloth * 0.06 * fgWeave * (1.0 - smoothstep(0.0008, 0.003, fwidth(vBind.y)));
        diffuseColor.rgb *= mix(1.0, 0.78 + 0.44 * fgStrand, fgHair);
        diffuseColor.rgb *= mix(1.0, 0.93 + 0.14 * fgPore, fgSkin);
        roughnessFactor = mix(roughnessFactor, 0.84, fgCloth);
        roughnessFactor = mix(roughnessFactor, 0.5 + 0.2 * fgPore, fgSkin);
        roughnessFactor = mix(roughnessFactor, 0.3, fgGloss);
        roughnessFactor = mix(roughnessFactor, 0.5, fgHair);
        roughnessFactor = mix(roughnessFactor, 0.68, fgGlove);
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        float fgH = fgFoldH * 0.019 * fgCloth * (1.0 - 0.6 * fgSock) + fgRib * 0.0012 + (fgStrand - 0.5) * 0.004 * fgHair + (fgPore - 0.5) * 0.0006 * fgSkin;
        normal = fgBump(-vViewPosition, normal, fgH, faceDirection);
        float fgRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        // light bleeding through skin at grazing angles, soft sheen on fabric
        diffuseColor.rgb += fgSkin * fgRim * diffuseColor.rgb * vec3(0.55, 0.16, 0.1);
        diffuseColor.rgb += fgCloth * fgRim * (diffuseColor.rgb * 0.45 + 0.02);
        `
      );
  };
  return mat;
}

const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _q4 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _e = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);
const cl = (v) => Math.max(-1, Math.min(1, v));

// Upper-arm orientation from a pointing direction given in chest space.
export function armQuat(out, dir, side, twist = 0) {
  _v1.set(dir[0], dir[1], dir[2]).normalize();
  _v2.set(side, 0, 0);
  if (_v1.dot(_v2) < -0.92) {
    _v1.addScaledVector(_v2, 0.3).normalize();
  }
  _q1.setFromAxisAngle(Z, (side * Math.PI) / 2);
  _q2.setFromUnitVectors(_v2, _v1);
  out.copy(_q2).multiply(_q1);
  if (twist) out.multiply(_q3.setFromAxisAngle(Y, twist));
  return out;
}

export function legQuat(out, dir, twist = 0) {
  _v1.set(dir[0], dir[1], dir[2]).normalize();
  out.setFromUnitVectors(DOWN, _v1);
  if (twist) out.multiply(_q3.setFromAxisAngle(Y, twist));
  return out;
}

const DEFAULT_SPEC = {
  pos: [0, 0, 0], // hips offset from the bind position
  rot: [0, 0, 0], // hips euler (YXZ)
  spine: [0, 0, 0],
  chest: [0, 0, 0],
  neck: [0, 0, 0],
  head: [0, 0, 0],
  armL: [0.14, -1, 0.02],
  armR: [-0.14, -1, 0.02],
  elbowL: 0.18,
  elbowR: 0.18,
  twistL: 0,
  twistR: 0,
  handL: [0, 0, 0],
  handR: [0, 0, 0],
  legL: [0.03, -1, 0],
  legR: [-0.03, -1, 0],
  kneeL: 0.04,
  kneeR: 0.04,
  footL: 0,
  footR: 0,
  legTwistL: 0,
  legTwistR: 0,
};

// A pose is 17 quaternions followed by the hips offset.
export const POSE_SIZE = BONES.length * 4 + 3;

export function makePose(spec = {}, out = new Float32Array(POSE_SIZE)) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const set = (name, q) => q.toArray(out, BI[name] * 4);
  const eul = (name, a, order = 'YXZ') => set(name, _q1.setFromEuler(_e.set(a[0], a[1], a[2], order)));
  eul('hips', s.rot);
  eul('spine', s.spine);
  eul('chest', s.chest);
  eul('neck', s.neck);
  eul('head', s.head);
  const q = _q4;
  set('uArmL', armQuat(q, s.armL, 1, s.twistL));
  set('uArmR', armQuat(q, s.armR, -1, s.twistR));
  set('lArmL', q.setFromAxisAngle(X, -s.elbowL));
  set('lArmR', q.setFromAxisAngle(X, -s.elbowR));
  eul('handL', s.handL);
  eul('handR', s.handR);
  set('thighL', legQuat(q, s.legL, s.legTwistL));
  set('thighR', legQuat(q, s.legR, s.legTwistR));
  set('shinL', q.setFromAxisAngle(X, s.kneeL));
  set('shinR', q.setFromAxisAngle(X, s.kneeR));
  set('footL', q.setFromAxisAngle(X, s.footL));
  set('footR', q.setFromAxisAngle(X, s.footR));
  out[BONES.length * 4] = s.pos[0];
  out[BONES.length * 4 + 1] = s.pos[1];
  out[BONES.length * 4 + 2] = s.pos[2];
  return out;
}

export function blendPose(a, b, t, out = new Float32Array(POSE_SIZE)) {
  for (let i = 0; i < BONES.length; i++) {
    _q1.fromArray(a, i * 4);
    _q2.fromArray(b, i * 4);
    _q1.slerp(_q2, t).toArray(out, i * 4);
  }
  const k = BONES.length * 4;
  for (let i = 0; i < 3; i++) out[k + i] = a[k + i] + (b[k + i] - a[k + i]) * t;
  return out;
}

// Sample a keyframed clip: [{ t, pose, ease? }]
export function sampleClip(clip, t, out) {
  if (t <= clip[0].t) return out.set(clip[0].pose), out;
  const last = clip[clip.length - 1];
  if (t >= last.t) return out.set(last.pose), out;
  let i = 0;
  while (i < clip.length - 2 && clip[i + 1].t <= t) i++;
  const a = clip[i];
  const b = clip[i + 1];
  let k = (t - a.t) / (b.t - a.t);
  const ease = b.ease || 'smooth';
  if (ease === 'smooth') k = k * k * (3 - 2 * k);
  else if (ease === 'in') k = k * k;
  else if (ease === 'out') k = 1 - (1 - k) * (1 - k);
  return blendPose(a.pose, b.pose, k, out);
}

function curvedDecal(tex, w, h, cy, front, bulk, flipU) {
  const nx = 10;
  const ny = 6;
  const pos = [];
  const uv = [];
  const idx = [];
  const chest = BIND.chest;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / ny;
      const x = (u - 0.5) * w;
      const y = cy + (v - 0.5) * h;
      const z = torsoZ(x, y, front, bulk) + (front ? 0.003 : -0.003);
      pos.push(x - chest[0], y - chest[1], z - chest[2]);
      uv.push(flipU ? 1 - u : u, v);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      if (front) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
  m.renderOrder = 1;
  return m;
}

export class Humanoid {
  // kit: one of KITS merged with a look from looks.js
  constructor(kitIn, opts = {}) {
    const kit = { ...DEFAULT_LOOK, ...kitIn };
    this.kit = kit;
    const geo = buildGeometry(kit);
    this.uniforms = {
      uFace: { value: makeFaceTexture(kit) },
      uPattern: { value: new THREE.Vector4(kit.pattern || 0, 0, 0, 0) },
      uLag: { value: new THREE.Vector3() },
      uFlutter: { value: 0 },
    };
    const pc = new THREE.Color(kit.patCol || 0);
    this.uniforms.uPattern.value.set(kit.pattern || 0, pc.r, pc.g, pc.b);
    const mat = makeBodyMaterial(this.uniforms);
    this.bones = BONES.map((n) => {
      const b = new THREE.Bone();
      b.name = n;
      return b;
    });
    BONES.forEach((n, i) => {
      const p = PARENT[n];
      const b = this.bones[i];
      if (p) {
        this.bones[BI[p]].add(b);
        b.position.set(BIND[n][0] - BIND[p][0], BIND[n][1] - BIND[p][1], BIND[n][2] - BIND[p][2]);
      } else {
        b.position.set(...BIND[n]);
      }
    });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(this.bones[0]);
    mesh.bind(new THREE.Skeleton(this.bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.object = new THREE.Group();
    this.object.add(mesh);
    this.scale = opts.scale || kit.height || 1;
    this.object.scale.setScalar(this.scale);

    const bulk = kit.bulk || 1;
    if (kit.number !== null && kit.number !== undefined) {
      this.bones[BI.chest].add(curvedDecal(makeNumberTexture(kit.number, kit.name || '', kit.numColor), 0.25, 0.25, 1.3, false, bulk, true));
    }
    this.bones[BI.chest].add(curvedDecal(makeFrontTexture(kit), 0.25, 0.25, 1.33, true, bulk, false));

    this.pose = makePose();
    this.joints = {};
    for (const n of BONES) this.joints[n] = new THREE.Vector3();
    this.joints.toeL = new THREE.Vector3();
    this.joints.toeR = new THREE.Vector3();
    this.joints.tipL = new THREE.Vector3();
    this.joints.tipR = new THREE.Vector3();
    this.joints.crown = new THREE.Vector3();
    this._lagPos = new THREE.Vector3();
    this._lagVel = new THREE.Vector3();
    this._lagFresh = true;
    this.applyPose(this.pose);
  }

  bone(name) {
    return this.bones[BI[name]];
  }

  applyPose(pose) {
    if (pose !== this.pose) this.pose.set(pose);
    const b = this.bones;
    for (let i = 0; i < b.length; i++) b[i].quaternion.fromArray(pose, i * 4);
    const k = BONES.length * 4;
    b[0].position.set(BIND.hips[0] + pose[k], BIND.hips[1] + pose[k + 1], BIND.hips[2] + pose[k + 2]);
  }

  // Two-bone reach: put the palm of one arm on a world-space target.
  aimArm(side, target, minElbow, blend, twist = 0) {
    const chest = this.bone('chest');
    const upper = this.bone(side > 0 ? 'uArmL' : 'uArmR');
    const lower = this.bone(side > 0 ? 'lArmL' : 'lArmR');
    this.object.updateMatrixWorld(true);
    upper.getWorldPosition(_v1);
    const dir = _v2.subVectors(target, _v1);
    let d = dir.length() / this.scale;
    dir.normalize();
    chest.getWorldQuaternion(_q3).invert();
    dir.applyQuaternion(_q3);
    const l1 = 0.28;
    const l2 = 0.345;
    const maxD = Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(minElbow));
    d = Math.min(maxD, Math.max(0.14, d));
    const el = Math.PI - Math.acos(cl((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
    const alpha = Math.acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const q = armQuat(_q4, [dir.x, dir.y, dir.z], side, twist);
    q.multiply(_q2.setFromAxisAngle(X, alpha));
    upper.quaternion.slerp(q, blend);
    lower.quaternion.slerp(_q2.setFromAxisAngle(X, -el), blend);
  }

  // Two-bone leg IK: put the ankle on a world-space target.
  // opt: { pitch (toe down +), yaw (world heading of the foot), toeOut, blend }
  aimLeg(side, ankle, opt = {}) {
    const blend = opt.blend === undefined ? 1 : opt.blend;
    if (blend <= 0) return;
    const L = side > 0;
    const hips = this.bones[0];
    const thigh = this.bone(L ? 'thighL' : 'thighR');
    const shin = this.bone(L ? 'shinL' : 'shinR');
    const foot = this.bone(L ? 'footL' : 'footR');
    this.object.updateMatrixWorld(true);
    const hipPos = _v1.setFromMatrixPosition(thigh.matrixWorld);
    const dir = _v2.subVectors(ankle, hipPos);
    let d = dir.length() / this.scale;
    dir.normalize();
    d = Math.max(0.22, Math.min(LEG_LEN * 0.999, d));
    const flex = Math.PI - Math.acos(cl((L_THIGH * L_THIGH + L_SHIN * L_SHIN - d * d) / (2 * L_THIGH * L_SHIN)));
    const alpha = Math.acos(cl((L_THIGH * L_THIGH + d * d - L_SHIN * L_SHIN) / (2 * L_THIGH * d)));
    const qh = hips.getWorldQuaternion(_q3);
    const toeOut = (opt.toeOut === undefined ? 0.1 : opt.toeOut) * side;
    // knee hinge axis: the pelvis' lateral axis, made perpendicular to the leg line
    const hinge = _v3.set(Math.cos(toeOut), 0, -Math.sin(toeOut)).applyQuaternion(qh);
    hinge.addScaledVector(dir, -hinge.dot(dir));
    if (hinge.lengthSq() < 1e-5) hinge.set(0, 0, 1).applyQuaternion(qh).cross(dir);
    hinge.normalize();
    const thighDir = _v4.copy(dir).applyAxisAngle(hinge, -alpha);
    const yAxis = _v5.copy(thighDir).negate();
    const zAxis = _v2.crossVectors(hinge, yAxis);
    _m1.makeBasis(hinge, yAxis, zAxis);
    const qw = _q1.setFromRotationMatrix(_m1);
    const qThigh = _q2.copy(qh).invert().multiply(qw);
    if (blend >= 1) thigh.quaternion.copy(qThigh);
    else thigh.quaternion.slerp(qThigh, blend);
    const qKnee = _q4.setFromAxisAngle(X, flex);
    if (blend >= 1) shin.quaternion.copy(qKnee);
    else shin.quaternion.slerp(qKnee, blend);
    // foot keeps a world-space orientation
    const fwd = _v3.set(0, 0, 1).applyQuaternion(qh);
    const yaw = opt.yaw === undefined || opt.yaw === null ? Math.atan2(fwd.x, fwd.z) + toeOut : opt.yaw;
    const qShinW = qw.multiply(qKnee);
    const qFootW = _q2.setFromEuler(_e.set(opt.pitch || 0, yaw, opt.roll || 0, 'YXZ'));
    const qFoot = qShinW.invert().multiply(qFootW);
    if (blend >= 1) foot.quaternion.copy(qFoot);
    else foot.quaternion.slerp(qFoot, blend);
  }

  // Turn neck and head towards a world-space point.
  lookAt(target, weight = 1, maxYaw = 1.25) {
    if (weight <= 0) return;
    const neck = this.bone('neck');
    const head = this.bone('head');
    this.object.updateMatrixWorld(true);
    head.getWorldPosition(_v1);
    const dir = _v2.subVectors(target, _v1).normalize();
    this.bone('chest').getWorldQuaternion(_q3).invert();
    dir.applyQuaternion(_q3);
    const yaw = Math.max(-maxYaw, Math.min(maxYaw, Math.atan2(dir.x, dir.z)));
    const pitch = Math.max(-0.7, Math.min(0.9, -Math.asin(cl(dir.y))));
    _q1.setFromEuler(_e.set(pitch * 0.4, yaw * 0.4, 0, 'YXZ'));
    neck.quaternion.slerp(_q1, weight);
    _q1.setFromEuler(_e.set(pitch * 0.6, yaw * 0.6, 0, 'YXZ'));
    head.quaternion.slerp(_q1, weight);
  }

  // Shift the hips so the lowest foot rests on the turf.
  groundFeet(offset = 0) {
    const j = this.updateJoints();
    const s = this.scale;
    const low = Math.min(j.footL.y - ANKLE_H * s, j.footR.y - ANKLE_H * s, j.toeL.y - 0.022 * s, j.toeR.y - 0.022 * s);
    this.bones[0].position.y -= (low - this.object.position.y) / s - offset;
  }

  updateJoints() {
    this.object.updateMatrixWorld(true);
    const j = this.joints;
    for (let i = 0; i < BONES.length; i++) j[BONES[i]].setFromMatrixPosition(this.bones[i].matrixWorld);
    j.toeL.set(0, -0.058, 0.18).applyMatrix4(this.bone('footL').matrixWorld);
    j.toeR.set(0, -0.058, 0.18).applyMatrix4(this.bone('footR').matrixWorld);
    j.tipL.set(0, -0.12, 0).applyMatrix4(this.bone('handL').matrixWorld);
    j.tipR.set(0, -0.12, 0).applyMatrix4(this.bone('handR').matrixWorld);
    j.crown.set(0, 0.14, 0.01).applyMatrix4(this.bone('head').matrixWorld);
    return j;
  }

  // Loose cloth trails behind the body: feed the shader a smoothed, clamped velocity.
  updateCloth(dt) {
    const hips = _v1.setFromMatrixPosition(this.bones[0].matrixWorld);
    if (this._lagFresh || dt <= 0) {
      this._lagPos.copy(hips);
      this._lagVel.set(0, 0, 0);
      this._lagFresh = false;
      return;
    }
    const v = _v2.subVectors(hips, this._lagPos).multiplyScalar(1 / dt);
    this._lagPos.copy(hips);
    if (v.lengthSq() > 400) v.set(0, 0, 0);
    this._lagVel.lerp(v, 1 - Math.exp(-9 * dt));
    const lag = this.uniforms.uLag.value;
    lag.copy(this._lagVel).applyQuaternion(_q1.copy(this.object.quaternion).invert()).multiplyScalar(-0.0075);
    lag.clampLength(0, 0.035);
    this.uniforms.uFlutter.value = Math.min(0.006, this._lagVel.length() * 0.0011);
  }

  resetCloth() {
    this._lagFresh = true;
    this.uniforms.uLag.value.set(0, 0, 0);
    this.uniforms.uFlutter.value = 0;
  }

  snapshot() {
    const o = this.object;
    const out = new Float32Array(7 + BONES.length * 4 + 3);
    out[0] = o.position.x;
    out[1] = o.position.y;
    out[2] = o.position.z;
    o.quaternion.toArray(out, 3);
    for (let i = 0; i < BONES.length; i++) this.bones[i].quaternion.toArray(out, 7 + i * 4);
    this.bones[0].position.toArray(out, 7 + BONES.length * 4);
    return out;
  }

  restore(a, b, t) {
    const o = this.object;
    const B2 = b || a;
    o.position.set(a[0] + (B2[0] - a[0]) * t, a[1] + (B2[1] - a[1]) * t, a[2] + (B2[2] - a[2]) * t);
    _q1.fromArray(a, 3);
    _q2.fromArray(B2, 3);
    o.quaternion.copy(_q1.slerp(_q2, t));
    for (let i = 0; i < BONES.length; i++) {
      _q1.fromArray(a, 7 + i * 4);
      _q2.fromArray(B2, 7 + i * 4);
      this.bones[i].quaternion.copy(_q1.slerp(_q2, t));
    }
    const k = 7 + BONES.length * 4;
    this.bones[0].position.set(a[k] + (B2[k] - a[k]) * t, a[k + 1] + (B2[k + 1] - a[k + 1]) * t, a[k + 2] + (B2[k + 2] - a[k + 2]) * t);
  }
}

import * as THREE from 'three';
import { makeNumberTexture } from '../world/textures.js';

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
const BIND = {
  hips: [0, 0.96, 0], spine: [0, 1.07, 0], chest: [0, 1.27, 0], neck: [0, 1.5, 0], head: [0, 1.59, 0],
  uArmL: [0.205, 1.455, 0], lArmL: [0.215, 1.17, 0], handL: [0.22, 0.915, 0],
  uArmR: [-0.205, 1.455, 0], lArmR: [-0.215, 1.17, 0], handR: [-0.22, 0.915, 0],
  thighL: [0.095, 0.92, 0], shinL: [0.1, 0.49, 0], footL: [0.1, 0.08, 0],
  thighR: [-0.095, 0.92, 0], shinR: [-0.1, 0.49, 0], footR: [-0.1, 0.08, 0],
};
export const HIP_HEIGHT = BIND.hips[1];

export const KITS = {
  home: {
    jersey: 0xc4122e, trim: 0xf4f4f4, shorts: 0xf2f2f2, socks: 0xc4122e, sockTrim: 0xf4f4f4, boots: 0x16181c, bootTrim: 0xe8ff3a,
    skin: 0xd9a57c, hair: 0x1c1410, long: false, gloves: null, number: 10, name: 'LIN', numColor: '#ffffff',
  },
  keeper: {
    jersey: 0x21c45d, trim: 0x0d3b1f, shorts: 0x0f3d22, socks: 0x21c45d, sockTrim: 0x0d3b1f, boots: 0xf2f2f2, bootTrim: 0x16181c,
    skin: 0xc68e62, hair: 0x2a1c12, long: true, gloves: 0xf5f5f5, number: 1, name: 'KEEPER', numColor: '#0d3b1f',
  },
  away: {
    jersey: 0x16264f, trim: 0x6fb7ff, shorts: 0x16264f, socks: 0xf2f2f2, sockTrim: 0x16264f, boots: 0x1a1a1a, bootTrim: 0xff5a36,
    skin: 0xe0b08a, hair: 0x3a2a1a, long: false, gloves: null, number: 5, name: 'AWAY', numColor: '#ffffff',
  },
};

// material ids stored per vertex: 0 skin, 1 cloth, 2 glossy (boots), 3 hair, 4 glove
class MeshBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.mat = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
  }

  vert(x, y, z, c, bw, m) {
    this.pos.push(x, y, z);
    this.col.push(c.r, c.g, c.b);
    this.mat.push(m);
    this.si.push(bw[0], bw[2] !== undefined ? bw[2] : bw[0], 0, 0);
    this.sw.push(bw[1], bw[3] !== undefined ? bw[3] : 0, 0, 0);
    return this.pos.length / 3 - 1;
  }

  // rings: [{ a: position along axis, c: [u, v] centre, r: [ru, rv] | [ru, rvFront, rvBack], col | colFn(theta), bw, m }]
  tube(rings, seg, axis = 'y') {
    const start = this.pos.length / 3;
    const startIdx = this.idx.length;
    const P = (a, u, v) => (axis === 'y' ? [u, a, v] : axis === 'z' ? [u, v, a] : [a, u, v]);
    for (const ring of rings) {
      for (let s = 0; s < seg; s++) {
        const th = (s / seg) * Math.PI * 2;
        const sn = Math.sin(th);
        const rv = ring.r.length > 2 ? (sn >= 0 ? ring.r[1] : ring.r[2]) : ring.r[1];
        const p = P(ring.a, ring.c[0] + ring.r[0] * Math.cos(th), ring.c[1] + rv * sn);
        const c = ring.colFn ? ring.colFn(th) : ring.col;
        this.vert(p[0], p[1], p[2], c, ring.bw, ring.m || 0);
      }
    }
    for (let r = 0; r < rings.length - 1; r++) {
      for (let s = 0; s < seg; s++) {
        const a = start + r * seg + s;
        const b = start + r * seg + ((s + 1) % seg);
        const c = a + seg;
        const d = b + seg;
        this.idx.push(a, c, b, b, c, d);
      }
    }
    const cap = (ri, flip) => {
      const ring = rings[ri];
      const p = P(ring.a, ring.c[0], ring.c[1]);
      const ci = this.vert(p[0], p[1], p[2], ring.colFn ? ring.colFn(0) : ring.col, ring.bw, ring.m || 0);
      for (let s = 0; s < seg; s++) {
        const a = start + ri * seg + s;
        const b = start + ri * seg + ((s + 1) % seg);
        if (flip) this.idx.push(ci, b, a);
        else this.idx.push(ci, a, b);
      }
    };
    cap(0, false);
    cap(rings.length - 1, true);
    // make sure faces point outwards
    const i0 = this.idx[startIdx];
    const i1 = this.idx[startIdx + 1];
    const i2 = this.idx[startIdx + 2];
    const v = (i) => new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    const n = new THREE.Vector3().subVectors(v(i1), v(i0)).cross(new THREE.Vector3().subVectors(v(i2), v(i0)));
    const ctr = new THREE.Vector3(...P(rings[0].a, rings[0].c[0], rings[0].c[1]));
    const mid = v(i0).add(v(i1)).add(v(i2)).multiplyScalar(1 / 3);
    const ctr2 = new THREE.Vector3(...P(rings[1].a, rings[1].c[0], rings[1].c[1])).add(ctr).multiplyScalar(0.5);
    if (n.dot(mid.sub(ctr2)) < 0) {
      for (let i = startIdx; i < this.idx.length; i += 3) {
        const t = this.idx[i + 1];
        this.idx[i + 1] = this.idx[i + 2];
        this.idx[i + 2] = t;
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aBind', new THREE.Float32BufferAttribute(this.pos.slice(), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

function buildGeometry(kit) {
  const C = (hex) => new THREE.Color(hex);
  const jersey = C(kit.jersey);
  const trim = C(kit.trim);
  const shorts = C(kit.shorts);
  const socks = C(kit.socks);
  const sockTrim = C(kit.sockTrim);
  const boots = C(kit.boots);
  const bootTrim = C(kit.bootTrim);
  const skin = C(kit.skin);
  const skinDark = C(kit.skin).multiplyScalar(0.62);
  const lip = C(kit.skin).lerp(C(0x8a3b3b), 0.45);
  const hair = C(kit.hair);
  const eye = C(0x120c0a);
  const gloves = kit.gloves ? C(kit.gloves) : null;
  const mb = new MeshBuilder();
  const B = BI;
  const SKIN = 0;
  const CLOTH = 1;
  const GLOSS = 2;
  const HAIR = 3;
  const GLOVE = 4;

  // --- torso ---
  const sidePanel = (base) => (th) => (Math.abs(Math.cos(th)) > 0.93 ? trim : base);
  const T = (a, rx, rz, col, bw, cz = 0, fn = null, rzBack = null) => ({ a, c: [0, cz], r: rzBack ? [rx, rz, rzBack] : [rx, rz], col, colFn: fn, bw, m: CLOTH });
  mb.tube(
    [
      T(0.84, 0.08, 0.07, shorts, [B.hips, 1]),
      T(0.87, 0.15, 0.105, shorts, [B.hips, 1], 0, null, 0.118),
      T(0.93, 0.176, 0.118, shorts, [B.hips, 1], 0, null, 0.136),
      T(1.0, 0.174, 0.118, shorts, [B.hips, 1], 0, null, 0.128),
      T(1.03, 0.168, 0.116, shorts, [B.hips, 0.8, B.spine, 0.2]),
      T(1.03, 0.176, 0.124, jersey, [B.hips, 0.8, B.spine, 0.2], 0, sidePanel(jersey)),
      T(1.09, 0.166, 0.114, jersey, [B.spine, 0.7, B.hips, 0.3], 0, sidePanel(jersey)),
      T(1.17, 0.168, 0.113, jersey, [B.spine, 1], 0.002, sidePanel(jersey)),
      T(1.27, 0.186, 0.124, jersey, [B.spine, 0.5, B.chest, 0.5], 0.004, sidePanel(jersey), 0.118),
      T(1.36, 0.204, 0.138, jersey, [B.chest, 1], 0.004, sidePanel(jersey), 0.124),
      T(1.43, 0.21, 0.128, jersey, [B.chest, 1], 0.0, null, 0.122),
      T(1.475, 0.178, 0.1, jersey, [B.chest, 1], -0.004, null, 0.108),
      T(1.5, 0.12, 0.078, jersey, [B.chest, 0.7, B.neck, 0.3], -0.006, null, 0.09),
      T(1.515, 0.07, 0.066, trim, [B.chest, 0.5, B.neck, 0.5], -0.004),
    ],
    20
  );
  // neck
  const N = (a, r, bw, cz) => ({ a, c: [0, cz], r: [r, r * 1.05], col: skin, bw, m: SKIN });
  mb.tube([N(1.47, 0.056, [B.chest, 0.5, B.neck, 0.5], -0.006), N(1.54, 0.054, [B.neck, 1], 0), N(1.62, 0.056, [B.head, 1], 0.006)], 12);

  // --- head ---
  const hb = [B.head, 1];
  {
    // [y, half width, front depth, back depth]
    const prof = [
      [1.588, 0.022, 0.05, 0.02],
      [1.6, 0.044, 0.072, 0.042],
      [1.625, 0.058, 0.084, 0.062],
      [1.655, 0.066, 0.09, 0.08],
      [1.69, 0.071, 0.093, 0.092],
      [1.725, 0.074, 0.093, 0.099],
      [1.76, 0.074, 0.09, 0.1],
      [1.79, 0.068, 0.08, 0.094],
      [1.812, 0.052, 0.06, 0.074],
      [1.824, 0.026, 0.03, 0.04],
    ];
    mb.tube(
      prof.map(([y, rx, rf, rb]) => ({
        a: y,
        c: [0, 0.004],
        r: [rx, rf, rb],
        bw: hb,
        m: SKIN,
        colFn: (th) => {
          // light shading in the eye sockets and under the cheekbones
          const front = Math.sin(th);
          if (front > 0.55 && y > 1.7 && y < 1.74 && Math.abs(Math.cos(th)) > 0.25) return skinDark;
          return skin;
        },
      })),
      18
    );
    // hair cap: sides/back low, full cover above the hairline
    const hp = [
      [1.655, 0.062, -0.03, 0.058],
      [1.69, 0.078, -0.03, 0.07],
      [1.73, 0.082, -0.022, 0.082],
      [1.765, 0.083, -0.008, 0.096],
      [1.79, 0.08, 0.002, 0.098],
      [1.815, 0.066, 0.0, 0.084],
      [1.836, 0.04, -0.004, 0.05],
      [1.842, 0.012, -0.006, 0.016],
    ];
    mb.tube(hp.map(([y, rx, cz, rz]) => ({ a: y, c: [0, cz], r: [rx, rz], col: hair, bw: hb, m: HAIR })), 16);
    // nose
    mb.tube(
      [
        { a: 0.088, c: [0, 1.7], r: [0.013, 0.02], col: skin, bw: hb, m: SKIN },
        { a: 0.106, c: [0, 1.692], r: [0.012, 0.013], col: skin, bw: hb, m: SKIN },
        { a: 0.114, c: [0, 1.688], r: [0.006, 0.006], col: skin, bw: hb, m: SKIN },
      ],
      6,
      'z'
    );
    for (const sx of [-1, 1]) {
      // eyes, brows, ears
      mb.tube(
        [
          { a: 0.083, c: [sx * 0.031, 1.722], r: [0.012, 0.006], col: eye, bw: hb, m: GLOSS },
          { a: 0.0935, c: [sx * 0.031, 1.722], r: [0.011, 0.0055], col: eye, bw: hb, m: GLOSS },
          { a: 0.095, c: [sx * 0.031, 1.722], r: [0.006, 0.003], col: eye, bw: hb, m: GLOSS },
        ],
        6,
        'z'
      );
      mb.tube(
        [
          { a: 0.085, c: [sx * 0.032, 1.74], r: [0.017, 0.0045], col: hair, bw: hb, m: HAIR },
          { a: 0.0965, c: [sx * 0.032, 1.74], r: [0.016, 0.004], col: hair, bw: hb, m: HAIR },
        ],
        6,
        'z'
      );
      mb.tube(
        [
          { a: 1.685, c: [sx * 0.076, -0.006], r: [0.006, 0.012], col: skin, bw: hb, m: SKIN },
          { a: 1.705, c: [sx * 0.08, -0.008], r: [0.009, 0.018], col: skin, bw: hb, m: SKIN },
          { a: 1.73, c: [sx * 0.08, -0.01], r: [0.008, 0.016], col: skin, bw: hb, m: SKIN },
          { a: 1.742, c: [sx * 0.077, -0.01], r: [0.004, 0.008], col: skin, bw: hb, m: SKIN },
        ],
        6
      );
    }
    // mouth
    mb.tube(
      [
        { a: 0.08, c: [0, 1.648], r: [0.022, 0.0045], col: lip, bw: hb, m: SKIN },
        { a: 0.0905, c: [0, 1.648], r: [0.02, 0.004], col: lip, bw: hb, m: SKIN },
      ],
      6,
      'z'
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
    const ax = 0.222 * side;
    const A = (a, r, col, bw, m, dx = 0, rz = null) => ({ a, c: [ax + dx * side, 0], r: [r, rz || r * 1.06], col, bw, m });
    const sleeve = kit.long ? jersey : skin;
    const sm = kit.long ? CLOTH : SKIN;
    const cuff = kit.long ? trim : skin;
    mb.tube(
      [
        A(1.5, 0.03, jersey, [uArm, 1], CLOTH, -0.02),
        A(1.485, 0.058, jersey, [uArm, 1], CLOTH, -0.012),
        A(1.44, 0.068, jersey, [uArm, 1], CLOTH, -0.004),
        A(1.36, 0.064, jersey, [uArm, 1], CLOTH),
        A(1.29, 0.062, jersey, [uArm, 1], CLOTH),
        A(1.275, 0.062, trim, [uArm, 1], CLOTH),
        A(1.272, kit.long ? 0.058 : 0.054, sleeve, [uArm, 1], sm),
        A(1.22, 0.051, sleeve, [uArm, 0.9, lArm, 0.1], sm),
        A(1.17, 0.046, sleeve, [uArm, 0.5, lArm, 0.5], sm),
        A(1.12, 0.05, sleeve, [lArm, 0.9, uArm, 0.1], sm),
        A(1.06, 0.05, sleeve, [lArm, 1], sm),
        A(0.98, 0.041, sleeve, [lArm, 1], sm),
        A(0.93, 0.034, cuff, [lArm, 1], sm),
        A(0.905, 0.031, cuff, [lArm, 0.5, hand, 0.5], sm),
      ],
      12
    );
    // hand / glove: palm + thumb
    const gk = gloves ? 1.5 : 1;
    const hc = gloves || skin;
    const hm = gloves ? GLOVE : SKIN;
    const Hd = (a, rx, rz, cz = 0.004) => ({ a, c: [0.222 * side, cz], r: [rx * gk, rz * gk], col: hc, bw: [hand, 1], m: hm });
    mb.tube([Hd(0.925, 0.025, 0.031), Hd(0.895, 0.023, 0.044), Hd(0.85, 0.022, 0.05), Hd(0.8, 0.019, 0.048), Hd(0.76, 0.015, 0.041), Hd(0.737, 0.008, 0.024)], 8);
    mb.tube([Hd(0.9, 0.012, 0.012, 0.04), Hd(0.86, 0.012, 0.012, 0.058 * gk), Hd(0.83, 0.008, 0.008, 0.062 * gk)], 6);

    // leg (top -> ankle)
    const lx = 0.098 * side;
    const Lg = (a, r, col, bw, m, cz = 0, rz = null) => ({ a, c: [lx, cz], r: [r, rz || r], col, bw, m });
    mb.tube(
      [
        Lg(0.96, 0.06, shorts, [thigh, 1], CLOTH),
        Lg(0.9, 0.098, shorts, [thigh, 1], CLOTH),
        Lg(0.8, 0.106, shorts, [thigh, 1], CLOTH, 0, 0.112),
        Lg(0.7, 0.108, shorts, [thigh, 1], CLOTH, 0, 0.114),
        Lg(0.695, 0.085, skin, [thigh, 1], SKIN, 0.004, 0.092),
        Lg(0.62, 0.078, skin, [thigh, 1], SKIN, 0.004, 0.084),
        Lg(0.545, 0.062, skin, [thigh, 0.85, shin, 0.15], SKIN, 0.002, 0.066),
        Lg(0.49, 0.057, skin, [thigh, 0.5, shin, 0.5], SKIN, 0.006, 0.061),
        Lg(0.45, 0.052, skin, [shin, 0.85, thigh, 0.15], SKIN, 0.002),
        Lg(0.438, 0.055, sockTrim, [shin, 1], CLOTH, 0),
        Lg(0.41, 0.057, socks, [shin, 1], CLOTH, -0.006, 0.062),
        Lg(0.34, 0.061, socks, [shin, 1], CLOTH, -0.014, 0.07),
        Lg(0.24, 0.048, socks, [shin, 1], CLOTH, -0.008, 0.053),
        Lg(0.13, 0.039, socks, [shin, 1], CLOTH, 0),
        Lg(0.085, 0.039, socks, [shin, 0.5, foot, 0.5], CLOTH, 0),
      ],
      14
    );
    // boot (heel -> toe), rings in the XY plane
    const Ft = (z, rx, ry, cy, col) => ({ a: z, c: [lx, cy], r: [rx, ry], col, bw: [foot, 1], m: GLOSS });
    mb.tube(
      [
        Ft(-0.078, 0.022, 0.03, 0.05, boots),
        Ft(-0.058, 0.04, 0.05, 0.055, boots),
        Ft(0.0, 0.046, 0.056, 0.058, boots),
        Ft(0.06, 0.048, 0.046, 0.048, bootTrim),
        Ft(0.12, 0.048, 0.035, 0.037, boots),
        Ft(0.17, 0.041, 0.027, 0.029, boots),
        Ft(0.2, 0.02, 0.014, 0.02, boots),
      ],
      10,
      'z'
    );
  }
  return mb.build();
}

const BODY_FRAG_PARS = /* glsl */ `
varying vec3 vBind;
varying float vMatId;
float fgFold(vec3 p) {
  float a = sin(dot(p, vec3(9.0, 31.0, 6.0)) + 2.2 * sin(dot(p, vec3(17.0, -7.0, 11.0))));
  float b = sin(dot(p, vec3(-23.0, 14.0, 19.0)) + 1.7 * sin(dot(p, vec3(8.0, 21.0, -13.0))));
  float c = sin(dot(p, vec3(61.0, 47.0, -53.0)));
  return a * 0.5 + b * 0.35 + c * 0.12;
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

function makeBodyMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nattribute float aMat;\nvarying vec3 vBind;\nvarying float vMatId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;\nvMatId = aMat;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BODY_FRAG_PARS}`)
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        float fgCloth = 1.0 - smoothstep(0.5, 0.51, abs(vMatId - 1.0));
        float fgSkin = 1.0 - smoothstep(0.5, 0.51, vMatId);
        float fgGloss = 1.0 - smoothstep(0.5, 0.51, abs(vMatId - 2.0));
        roughnessFactor = mix(roughnessFactor, 0.86, fgCloth);
        roughnessFactor = mix(roughnessFactor, 0.5, fgSkin);
        roughnessFactor = mix(roughnessFactor, 0.28, fgGloss);
        `
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        normal = fgBump(-vViewPosition, normal, fgFold(vBind) * 0.011 * fgCloth, faceDirection);
        `
      );
  };
  return mat;
}

const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _e = new THREE.Euler();
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);

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
  rot: [0, 0, 0], // hips euler (XYZ)
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
  const q = new THREE.Quaternion();
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

export class Humanoid {
  constructor(kit, opts = {}) {
    this.kit = kit;
    const geo = buildGeometry(kit);
    const mat = makeBodyMaterial();
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
    this.scale = opts.scale || 1;
    this.object.scale.setScalar(this.scale);

    if (kit.number !== undefined && opts.number !== false) {
      const tex = makeNumberTexture(opts.number || kit.number, opts.name || kit.name, kit.numColor);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.27, 0.27),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })
      );
      decal.position.set(0, 0.07, -0.131);
      decal.rotation.y = Math.PI;
      this.bones[BI.chest].add(decal);
    }

    this.pose = makePose();
    this.joints = {};
    for (const n of BONES) this.joints[n] = new THREE.Vector3();
    this.joints.toeL = new THREE.Vector3();
    this.joints.toeR = new THREE.Vector3();
    this.joints.tipL = new THREE.Vector3();
    this.joints.tipR = new THREE.Vector3();
    this.joints.crown = new THREE.Vector3();
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
    const dir = new THREE.Vector3().subVectors(target, _v1);
    let d = dir.length() / this.scale;
    dir.normalize();
    chest.getWorldQuaternion(_q3).invert();
    dir.applyQuaternion(_q3);
    const l1 = 0.285;
    const l2 = 0.345;
    const maxD = Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(minElbow));
    d = Math.min(maxD, Math.max(0.14, d));
    const cl = (v) => Math.max(-1, Math.min(1, v));
    const el = Math.PI - Math.acos(cl((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
    const alpha = Math.acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const q = armQuat(new THREE.Quaternion(), [dir.x, dir.y, dir.z], side, twist);
    q.multiply(_q2.setFromAxisAngle(X, alpha));
    upper.quaternion.slerp(q, blend);
    lower.quaternion.slerp(_q2.setFromAxisAngle(X, -el), blend);
  }

  // Shift the hips so the lowest foot rests on the turf.
  groundFeet(offset = 0) {
    const j = this.updateJoints();
    const low = Math.min(j.footL.y - 0.075 * this.scale, j.footR.y - 0.075 * this.scale, j.toeL.y - 0.02 * this.scale, j.toeR.y - 0.02 * this.scale);
    this.bones[0].position.y -= (low - this.object.position.y) / this.scale - offset;
  }

  updateJoints() {
    this.object.updateMatrixWorld(true);
    const j = this.joints;
    for (let i = 0; i < BONES.length; i++) j[BONES[i]].setFromMatrixPosition(this.bones[i].matrixWorld);
    j.toeL.set(0, -0.04, 0.17).applyMatrix4(this.bone('footL').matrixWorld);
    j.toeR.set(0, -0.04, 0.17).applyMatrix4(this.bone('footR').matrixWorld);
    j.tipL.set(0, -0.12, 0).applyMatrix4(this.bone('handL').matrixWorld);
    j.tipR.set(0, -0.12, 0).applyMatrix4(this.bone('handR').matrixWorld);
    j.crown.set(0, 0.14, 0.01).applyMatrix4(this.bone('head').matrixWorld);
    return j;
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

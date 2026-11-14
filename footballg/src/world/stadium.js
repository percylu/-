import * as THREE from 'three';
import { F, mulberry32 } from '../config.js';
import { makeCrowdAtlas, makeAdBoardTexture, makeGlowTexture } from './textures.js';

const CZ = 52.5;
const HX = 43;
const HZ = 62;
const RC = 16;
const SEAT_W = 0.56;
const ROW_D = 0.86;

const TIERS = [
  { d0: 0.4, y0: 1.05, d1: 19.2, y1: 10.8 },
  { d0: 17.6, y0: 13.6, d1: 36, y1: 26.6 },
];

function makePath(step) {
  const pts = [];
  let s = 0;
  const push = (x, z, nx, nz, ds) => {
    s += ds;
    pts.push({ x, z, nx, nz, s });
  };
  const line = (x0, z0, x1, z1, nx, nz) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz, len / n);
    }
  };
  const arc = (cx, cz, a0, a1) => {
    const len = Math.abs(a1 - a0) * RC;
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      push(cx + Math.cos(a) * RC, cz + Math.sin(a) * RC, Math.cos(a), Math.sin(a), len / n);
    }
  };
  const ix = HX - RC;
  const iz = HZ - RC;
  line(HX, CZ - iz, HX, CZ + iz, 1, 0);
  arc(ix, CZ + iz, 0, Math.PI / 2);
  line(ix, CZ + HZ, -ix, CZ + HZ, 0, 1);
  arc(-ix, CZ + iz, Math.PI / 2, Math.PI);
  line(-HX, CZ + iz, -HX, CZ - iz, -1, 0);
  arc(-ix, CZ - iz, Math.PI, Math.PI * 1.5);
  line(-ix, CZ - HZ, ix, CZ - HZ, 0, -1);
  arc(ix, CZ - iz, Math.PI * 1.5, Math.PI * 2);
  const total = s;
  return { pts, total };
}

// Sweep the profile segment (d0,y0)-(d1,y1) around the path.
function sweep(path, d0, y0, d1, y1, uScale, v0, v1, flip = false) {
  const { pts, total } = path;
  const n = pts.length;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    const s = i === n ? total + pts[0].s : p.s;
    const k = i * 6;
    pos[k] = p.x + p.nx * d0;
    pos[k + 1] = y0;
    pos[k + 2] = p.z + p.nz * d0;
    pos[k + 3] = p.x + p.nx * d1;
    pos[k + 4] = y1;
    pos[k + 5] = p.z + p.nz * d1;
    uv[i * 4] = s * uScale;
    uv[i * 4 + 1] = v0;
    uv[i * 4 + 2] = s * uScale;
    uv[i * 4 + 3] = v1;
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    if (flip) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    else idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeSeatTexture() {
  const seats = 24;
  const c = document.createElement('canvas');
  c.width = seats * 16;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1d22';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < seats; i++) {
    if (i === seats - 1) {
      g.fillStyle = '#6d7076';
      g.fillRect(i * 16, 0, 16, 32);
      g.fillStyle = '#8c8f96';
      g.fillRect(i * 16, 0, 16, 10);
      continue;
    }
    g.fillStyle = '#1b2f6e';
    g.fillRect(i * 16 + 2, 4, 12, 16);
    g.fillStyle = '#2947a3';
    g.fillRect(i * 16 + 2, 4, 12, 5);
    g.fillStyle = '#0d1a40';
    g.fillRect(i * 16 + 2, 20, 12, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function buildCrowd(path, quality, group) {
  const rnd = mulberry32(555);
  const posArr = [];
  const dataArr = [];
  const flashPos = [];
  const { pts, total } = path;
  const seatsPerLoop = Math.floor(total / SEAT_W);
  const density = quality.crowd;
  for (const tier of TIERS) {
    const rows = Math.floor((tier.d1 - tier.d0) / ROW_D);
    const slope = (tier.y1 - tier.y0) / (tier.d1 - tier.d0);
    for (let r = 0; r < rows; r++) {
      const d = tier.d0 + (r + 0.55) * ROW_D;
      const y = tier.y0 + slope * (d - tier.d0) + 0.18;
      let pi = 0;
      for (let k = 0; k < seatsPerLoop; k++) {
        const s = (k + (r % 2) * 0.5) * SEAT_W;
        if (k % 24 === 23) continue;
        while (pi < pts.length - 1 && pts[pi + 1].s <= s) pi++;
        const a = pts[pi];
        const b = pts[(pi + 1) % pts.length];
        const seg = pi + 1 < pts.length ? b.s - a.s : total + pts[0].s - a.s;
        const t = Math.min(1, Math.max(0, (s - a.s) / (seg || 1)));
        const nx = a.nx + (b.nx - a.nx) * t;
        const nz = a.nz + (b.nz - a.nz) * t;
        const nl = Math.hypot(nx, nz) || 1;
        const x = a.x + (b.x - a.x) * t + (nx / nl) * d;
        const z = a.z + (b.z - a.z) * t + (nz / nl) * d;
        // Keep the end behind the goal full, thin out the far stands on low settings.
        const keep = z < 30 ? Math.max(density, quality.crowdNear ?? 0.93) : density * 0.93;
        const roll = rnd();
        if (roll > keep) continue;
        // outward spacing grows on corners: skip a few to keep density even
        posArr.push(x + (rnd() - 0.5) * 0.08, y + (rnd() - 0.5) * 0.06, z + (rnd() - 0.5) * 0.08);
        dataArr.push(Math.atan2(-nx, -nz), Math.floor(rnd() * 8), Math.floor(rnd() * 2), rnd());
        if (rnd() < 0.045) flashPos.push(x, y + 0.75, z);
      }
    }
  }
  // stewards / photographers sitting behind the boards at the goal end
  for (let x = -30; x <= 30; x += 0.9) {
    if (rnd() < 0.45) continue;
    posArr.push(x + rnd() * 0.3, -0.25, F.boardZ - 1.2 - rnd() * 1.6);
    dataArr.push(0, Math.floor(rnd() * 8), 0, rnd());
    if (rnd() < 0.5) flashPos.push(x, 0.5, F.boardZ - 1.4);
  }

  const count = posArr.length / 3;
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  // Split the crowd into angular sectors so stands outside the view are frustum-culled.
  const SECTORS = 18;
  const buckets = Array.from({ length: SECTORS }, () => ({ pos: [], data: [] }));
  for (let i = 0; i < count; i++) {
    const x = posArr[i * 3];
    const z = posArr[i * 3 + 2];
    const k = Math.min(SECTORS - 1, Math.floor(((Math.atan2(z - CZ, x) + Math.PI) / (Math.PI * 2)) * SECTORS));
    buckets[k].pos.push(x, posArr[i * 3 + 1], z);
    buckets[k].data.push(dataArr[i * 4], dataArr[i * 4 + 1], dataArr[i * 4 + 2], dataArr[i * 4 + 3]);
  }

  const uniforms = {
    uAtlas: { value: makeCrowdAtlas() },
    uTime: { value: 0 },
    uExcite: { value: 0 },
    uLight: { value: 0.31 },
    uFogColor: { value: new THREE.Color(0x0a0f18) },
    uFogDensity: { value: 0.0018 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute vec4 aData;
      uniform float uTime;
      uniform float uExcite;
      varying vec2 vUv;
      varying float vShade;
      varying float vFogDepth;
      void main() {
        float ph = aData.w;
        float exc = smoothstep(ph * 0.55, ph * 0.55 + 0.35, uExcite);
        float jump = exc * abs(sin(uTime * (4.5 + ph * 2.0) + ph * 31.0)) * 0.26;
        float idle = sin(uTime * (1.1 + ph * 1.6) + ph * 47.0) * 0.022;
        vec3 p = position;
        p.x *= 0.64;
        p.y *= 0.98;
        p.x += sin(uTime * (1.0 + ph * 0.9) + ph * 20.0) * 0.035 * position.y;
        vec2 toCam = normalize(cameraPosition.xz - aPos.xz);
        vec2 face = normalize(mix(vec2(sin(aData.x), cos(aData.x)), toCam, 0.8));
        vec3 w = aPos + vec3(face.y * p.x, p.y + jump + idle, -face.x * p.x);
        float row = aData.z + (exc > 0.5 ? 2.0 : 0.0);
        vUv = vec2((aData.y + uv.x) / 8.0, 1.0 - (row + 1.0 - uv.y) / 4.0);
        vShade = (0.6 + 0.5 * fract(ph * 7.31)) * (0.55 + 0.6 * uv.y);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uLight;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vUv;
      varying float vShade;
      varying float vFogDepth;
      void main() {
        vec4 c = texture2D(uAtlas, vUv);
        if (c.a < 0.5) discard;
        vec3 col = c.rgb * uLight * vShade;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Group();
  mesh.name = 'crowd';
  for (const bk of buckets) {
    const n = bk.pos.length / 3;
    if (!n) continue;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(bk.pos), 3));
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(bk.data), 4));
    geo.instanceCount = n;
    const box = new THREE.Box3().setFromArray(bk.pos);
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    geo.boundingSphere.radius += 2.5;
    mesh.add(new THREE.Mesh(geo, mat));
  }
  group.add(mesh);

  // camera flashes
  const fgeo = new THREE.BufferGeometry();
  const fcount = flashPos.length / 3;
  fgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flashPos), 3));
  const seeds = new Float32Array(fcount);
  for (let i = 0; i < fcount; i++) seeds[i] = rnd() * 1000;
  fgeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const funi = { uTime: { value: 0 }, uRate: { value: 0.004 }, uScale: { value: 1 } };
  const fmat = new THREE.ShaderMaterial({
    uniforms: funi,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uRate;
      uniform float uScale;
      varying float vOn;
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      void main() {
        float tick = floor(uTime * 14.0);
        float h = hash(aSeed + tick * 1.37);
        vOn = step(1.0 - uRate, h);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = vOn * uScale * 420.0 / max(1.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vOn;
      void main() {
        if (vOn < 0.5) discard;
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(14.0, 14.5, 16.0) * a * a, a);
      }
    `,
  });
  const flashes = new THREE.Points(fgeo, fmat);
  flashes.frustumCulled = false;
  flashes.name = 'flashes';
  group.add(flashes);

  return { uniforms, flashUniforms: funi, count };
}

export function createStadium(gfx, quality) {
  const group = new THREE.Group();
  group.name = 'stadium';
  const path = makePath(2.0);
  const seatTex = makeSeatTexture();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.9 });
  const darkWall = new THREE.MeshStandardMaterial({ color: 0x0f1a33, roughness: 0.7 });
  const add = (geo, mat, shadow = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = shadow;
    group.add(m);
    return m;
  };

  // front wall
  add(sweep(path, 0, -0.1, 0, 1.05, 0.2, 0, 1, true), darkWall);
  add(sweep(path, 0, 1.05, 0.4, 1.05, 0.2, 0, 1, true), concrete);

  TIERS.forEach((t, i) => {
    const rows = Math.floor((t.d1 - t.d0) / ROW_D);
    const mat = new THREE.MeshStandardMaterial({ map: seatTex, roughness: 0.75, color: 0xffffff });
    add(sweep(path, t.d0, t.y0, t.d1, t.y1, 1 / (24 * SEAT_W), 0, rows, true), mat);
    if (i === 0) {
      // fascia between the tiers with an LED ribbon
      add(sweep(path, t.d1, t.y1, t.d1, 11.2, 0.2, 0, 1, true), concrete);
      add(sweep(path, TIERS[1].d0, 12.5, TIERS[1].d0, TIERS[1].y0, 0.2, 0, 1, true), concrete);
      add(sweep(path, TIERS[1].d0, 11.2, t.d1 + 0.2, 11.2, 0.2, 0, 1, false), concrete);
    }
  });

  const ad = makeAdBoardTexture();
  const ribbonTex = new THREE.CanvasTexture(ad.tex.image);
  ribbonTex.colorSpace = THREE.SRGBColorSpace;
  ribbonTex.wrapS = ribbonTex.wrapT = THREE.RepeatWrapping;
  ribbonTex.anisotropy = 4;
  const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbonTex, color: new THREE.Color(1.1, 1.1, 1.1) });
  add(sweep(path, TIERS[1].d0 - 0.05, 11.2, TIERS[1].d0 - 0.05, 12.5, 1 / (1.3 * ad.aspect), 0, 1, true), ribbonMat);

  // back wall + roof
  const roofTop = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.55, metalness: 0.4 });
  const roofUnder = new THREE.MeshStandardMaterial({ color: 0x20252c, roughness: 0.8, metalness: 0.2 });
  add(sweep(path, 36, 26.6, 36, 33.2, 0.1, 0, 1, true), concrete);
  add(sweep(path, 38, 34.2, 8.5, 30.2, 0.1, 0, 1, true), roofTop);
  add(sweep(path, 38, 33.2, 8.5, 29.5, 0.1, 0, 1, false), roofUnder);
  add(sweep(path, 8.5, 29.5, 8.5, 30.2, 0.1, 0, 1, false), new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.5 }));
  add(sweep(path, 38, 26.6, 38, 34.2, 0.1, 0, 1, false), concrete);

  // roof trusses + floodlight banks
  const lampGeo = new THREE.PlaneGeometry(0.46, 0.46);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 29, 26.5), side: THREE.DoubleSide });
  const lampPos = [];
  const glowPos = [];
  const trussGeo = new THREE.BoxGeometry(0.35, 1.1, 29);
  const trussPos = [];
  const { pts } = path;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    trussPos.push(p);
  }
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    const tx = -p.nz;
    const tz = p.nx;
    const bx = p.x + p.nx * 9.6;
    const bz = p.z + p.nz * 9.6;
    glowPos.push(bx, 29.0, bz);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        const o = (c - 2) * 0.62;
        lampPos.push({ x: bx + tx * o + p.nx * r * 0.5, y: 29.2 - r * 0.02, z: bz + tz * o + p.nz * r * 0.5, nx: p.nx, nz: p.nz });
      }
    }
  }
  const truss = new THREE.InstancedMesh(trussGeo, roofUnder, trussPos.length);
  trussPos.forEach((p, i) => {
    dummy.position.set(p.x + p.nx * 23.5, 31.2, p.z + p.nz * 23.5);
    dummy.rotation.set(0, Math.atan2(p.nx, p.nz), 0);
    dummy.rotateX(-0.127);
    dummy.updateMatrix();
    truss.setMatrixAt(i, dummy.matrix);
  });
  group.add(truss);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPos.length);
  lampPos.forEach((l, i) => {
    dummy.position.set(l.x, l.y, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.lookAt(l.x - l.nx * 10, l.y - 8, l.z - l.nz * 10);
    dummy.updateMatrix();
    lamps.setMatrixAt(i, dummy.matrix);
  });
  lamps.frustumCulled = false;
  group.add(lamps);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(glowPos), 3));
  const glow = new THREE.Points(
    glowGeo,
    new THREE.PointsMaterial({
      map: makeGlowTexture(),
      size: 9,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(0.9, 0.95, 1.1),
      opacity: 0.55,
      fog: false,
    })
  );
  glow.frustumCulled = false;
  group.add(glow);

  // LED advertising boards
  const boardFace = new THREE.MeshBasicMaterial({ map: ad.tex, color: new THREE.Color(1.25, 1.25, 1.25) });
  const boardBack = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 });
  const boardH = 0.95;
  const texPerMetre = 1 / (boardH * ad.aspect);
  const mkBoard = (len, x, z, rotY, uOff) => {
    const g = new THREE.BoxGeometry(len, boardH, 0.16);
    const uvA = g.attributes.uv;
    // +z face is the display: remap its u to metres
    for (let i = 16; i < 20; i++) uvA.setX(i, uvA.getX(i) * len * texPerMetre + uOff);
    const mats = [boardBack, boardBack, boardBack, boardBack, boardFace, boardBack];
    const m = new THREE.Mesh(g, mats);
    m.position.set(x, boardH / 2 + 0.02, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    group.add(m);
  };
  mkBoard(F.boardX * 2, 0, F.boardZ - 0.08, 0, 0.012);
  mkBoard(F.boardX * 2, 0, 105 - F.boardZ + 0.08, Math.PI, 0.3);
  mkBoard(105 - 2 * F.boardZ, F.boardX + 0.08, CZ, -Math.PI / 2, 0.55);
  mkBoard(105 - 2 * F.boardZ, -F.boardX - 0.08, CZ, Math.PI / 2, 0.8);

  // corner flags
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xf2d21b, roughness: 0.6, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
  for (const sx of [-1, 1]) {
    for (const z of [0, 105]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), poleMat);
      pole.position.set(sx * 34, 0.75, z);
      pole.castShadow = true;
      group.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), flagMat);
      flag.position.set(sx * 34 - sx * 0.2, 1.33, z);
      group.add(flag);
    }
  }

  // sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 top = vec3(0.004, 0.008, 0.022);
          vec3 hor = vec3(0.035, 0.045, 0.085);
          vec3 col = mix(hor, top, pow(h, 0.45));
          vec2 g = floor(d.xz / max(0.15, d.y) * 90.0);
          float s = step(0.9975, hash(g)) * smoothstep(0.25, 0.7, h);
          col += vec3(0.6, 0.65, 0.8) * s * hash(g + 3.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.position.set(0, 0, CZ);
  sky.name = 'sky';
  group.add(sky);

  const crowd = buildCrowd(path, quality, group);

  return {
    group,
    crowd,
    update(time, excite, flashRate) {
      crowd.uniforms.uTime.value = time;
      crowd.uniforms.uExcite.value = excite;
      crowd.flashUniforms.uTime.value = time;
      crowd.flashUniforms.uRate.value = flashRate;
      crowd.flashUniforms.uScale.value = gfx.pixelRatio * gfx.height / 720;
      ad.tex.offset.x = time * 0.004;
      ribbonTex.offset.x = time * 0.006;
    },
  };
}

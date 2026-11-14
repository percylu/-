import * as THREE from 'three';
import { F } from '../config.js';
import { makeNetTexture } from './textures.js';

const CELL = 0.12;
const FRAME_Y = F.goalH + F.postR; // crossbar centre height
const POST_X = F.goalHalfW + F.postR;

// Back panel plane (outward normal points away from the goal volume).
const BACK_P0 = new THREE.Vector3(0, FRAME_Y, -F.netTopDepth);
const BACK_N = new THREE.Vector3(0, F.netBottomDepth - F.netTopDepth, -FRAME_Y).normalize();

export function netBackZ(y) {
  const t = THREE.MathUtils.clamp(y / FRAME_Y, 0, 1);
  return -(F.netBottomDepth + (F.netTopDepth - F.netBottomDepth) * t);
}

class ClothPanel {
  constructor(cols, rows, posFn, pinFn, uvFn) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);
    this.pinned = new Uint8Array(n);
    const uv = new Float32Array(n * 2);
    const v = new THREE.Vector3();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        posFn(c, r, v);
        v.toArray(this.pos, i * 3);
        v.toArray(this.prev, i * 3);
        v.toArray(this.rest, i * 3);
        this.pinned[i] = pinFn(c, r) ? 1 : 0;
        const t = uvFn(c, r);
        uv[i * 2] = t[0];
        uv[i * 2 + 1] = t[1];
      }
    }
    const cons = [];
    const d = (a, b) => {
      const dx = this.rest[a * 3] - this.rest[b * 3];
      const dy = this.rest[a * 3 + 1] - this.rest[b * 3 + 1];
      const dz = this.rest[a * 3 + 2] - this.rest[b * 3 + 2];
      return Math.hypot(dx, dy, dz);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c + 1 < cols) cons.push(i, i + 1, d(i, i + 1) * 1.035);
        if (r + 1 < rows) cons.push(i, i + cols, d(i, i + cols) * 1.035);
      }
    }
    this.cons = new Float32Array(cons);
    const idx = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c;
        idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.geo = geo;
  }

  step(dt, ball, ballR, iterations) {
    const { pos, prev, pinned, cons, n } = this;
    const g = -2.2 * dt * dt;
    const damp = 0.965;
    let maxMove = 0;
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const k = i * 3;
      const vx = (pos[k] - prev[k]) * damp;
      const vy = (pos[k + 1] - prev[k + 1]) * damp;
      const vz = (pos[k + 2] - prev[k + 2]) * damp;
      prev[k] = pos[k];
      prev[k + 1] = pos[k + 1];
      prev[k + 2] = pos[k + 2];
      pos[k] += vx;
      pos[k + 1] += vy + g;
      pos[k + 2] += vz;
      const m = Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
      if (m > maxMove) maxMove = m;
    }
    const R = ballR + 0.015;
    const R2 = R * R;
    for (let it = 0; it < iterations; it++) {
      for (let ci = 0; ci < cons.length; ci += 3) {
        const a = cons[ci] * 3;
        const b = cons[ci + 1] * 3;
        const rest = cons[ci + 2];
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= rest * rest) continue;
        const dd = Math.sqrt(d2);
        const pa = pinned[a / 3];
        const pb = pinned[b / 3];
        if (pa && pb) continue;
        const diff = (dd - rest) / dd;
        const wa = pa ? 0 : pb ? 1 : 0.5;
        const wb = pb ? 0 : pa ? 1 : 0.5;
        pos[a] += dx * diff * wa;
        pos[a + 1] += dy * diff * wa;
        pos[a + 2] += dz * diff * wa;
        pos[b] -= dx * diff * wb;
        pos[b + 1] -= dy * diff * wb;
        pos[b + 2] -= dz * diff * wb;
      }
      if (ball) {
        for (let i = 0; i < n; i++) {
          if (pinned[i]) continue;
          const k = i * 3;
          const dx = pos[k] - ball.x;
          const dy = pos[k + 1] - ball.y;
          const dz = pos[k + 2] - ball.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < R2 && d2 > 1e-8) {
            const s = R / Math.sqrt(d2);
            pos[k] = ball.x + dx * s;
            pos[k + 1] = ball.y + dy * s;
            pos[k + 2] = ball.z + dz * s;
            maxMove = 1;
          }
        }
      }
    }
    // keep the net above the turf
    for (let i = 0; i < n; i++) {
      if (pos[i * 3 + 1] < 0.01) pos[i * 3 + 1] = 0.01;
    }
    return maxMove;
  }
}

export function createGoal(quality) {
  const group = new THREE.Group();
  group.name = 'goal';
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.32, metalness: 0.05 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.45, metalness: 0.6 });

  const tube = (a, b, r, mat, seg = 20) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  tube(V(-POST_X, 0, 0), V(-POST_X, FRAME_Y, 0), F.postR, white, 28);
  tube(V(POST_X, 0, 0), V(POST_X, FRAME_Y, 0), F.postR, white, 28);
  tube(V(-POST_X, FRAME_Y, 0), V(POST_X, FRAME_Y, 0), F.postR, white, 28);
  for (const sx of [-1, 1]) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(F.postR, 20, 14), white);
    joint.position.set(sx * POST_X, FRAME_Y, 0);
    joint.castShadow = true;
    group.add(joint);
    const r = 0.022;
    tube(V(sx * POST_X, FRAME_Y, 0), V(sx * POST_X, FRAME_Y, -F.netTopDepth), r, grey, 10);
    tube(V(sx * POST_X, FRAME_Y, -F.netTopDepth), V(sx * POST_X, 0.02, -F.netBottomDepth), r, grey, 10);
    tube(V(sx * POST_X, 0.025, 0), V(sx * POST_X, 0.025, -F.netBottomDepth), r, grey, 10);
  }
  tube(V(-POST_X, FRAME_Y, -F.netTopDepth), V(POST_X, FRAME_Y, -F.netTopDepth), 0.022, grey, 10);
  tube(V(-POST_X, 0.025, -F.netBottomDepth), V(POST_X, 0.025, -F.netBottomDepth), 0.022, grey, 10);

  // --- net ---
  const netTex = makeNetTexture();
  netTex.anisotropy = quality.anisotropy;
  const netMat = new THREE.MeshStandardMaterial({
    map: netTex,
    color: 0xffffff,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.85,
    metalness: 0,
    emissive: 0x30363c,
    emissiveMap: netTex,
  });

  const step = quality.netStep || 1;
  const cell = CELL * step;
  const panels = [];
  const W = POST_X * 2;
  const cols = Math.round(W / cell) + 1;
  const topRows = Math.round(F.netTopDepth / cell);
  const backLen = Math.hypot(F.netBottomDepth - F.netTopDepth, FRAME_Y);
  const backRows = Math.round(backLen / cell);
  const rows = topRows + backRows + 1;
  panels.push(
    new ClothPanel(
      cols,
      rows,
      (c, r, v) => {
        const x = -POST_X + (c / (cols - 1)) * W;
        if (r <= topRows) v.set(x, FRAME_Y, -(r / topRows) * F.netTopDepth);
        else {
          const t = (r - topRows) / backRows;
          v.set(x, FRAME_Y * (1 - t), -(F.netTopDepth + (F.netBottomDepth - F.netTopDepth) * t));
        }
      },
      (c, r) => r === 0 || r === topRows || r === rows - 1 || c === 0 || c === cols - 1,
      (c, r) => [c * step, r * step]
    )
  );
  const sideCols = Math.round(F.netBottomDepth / cell) + 1;
  const sideRows = Math.round(FRAME_Y / cell) + 1;
  for (const sx of [-1, 1]) {
    panels.push(
      new ClothPanel(
        sideCols,
        sideRows,
        (c, r, v) => {
          const y = FRAME_Y * (1 - r / (sideRows - 1));
          v.set(sx * POST_X, y, (c / (sideCols - 1)) * netBackZ(y));
        },
        (c, r) => r === 0 || r === sideRows - 1 || c === 0 || c === sideCols - 1,
        (c, r) => [c * step * (0.55 + 0.45 * (r / (sideRows - 1))), r * step]
      )
    );
  }
  for (const p of panels) {
    const mesh = new THREE.Mesh(p.geo, netMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    group.add(mesh);
    p.mesh = mesh;
  }

  let awake = 120;
  const ballV = new THREE.Vector3();

  const net = {
    panels,
    wake(frames = 240) {
      awake = Math.max(awake, frames);
    },
    update(dt, ballPos, ballR) {
      const near = ballPos && ballPos.z < 0.6 && Math.abs(ballPos.x) < POST_X + 0.6 && ballPos.y < FRAME_Y + 0.6 && ballPos.z > -F.netBottomDepth - 0.8;
      if (near) awake = Math.max(awake, 200);
      if (awake <= 0) return;
      awake--;
      const sub = Math.max(1, Math.min(4, Math.round(dt / (1 / 120))));
      const h = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (const p of panels) p.step(h, near ? ballV.copy(ballPos) : null, ballR, 4);
      }
      for (const p of panels) {
        p.posAttr.needsUpdate = true;
        p.geo.computeVertexNormals();
      }
    },
    snapshot() {
      return panels.map((p) => p.pos.slice());
    },
    restore(a, b, t) {
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const A = a[i];
        const B = b ? b[i] : A;
        for (let k = 0; k < p.pos.length; k++) p.pos[k] = A[k] + (B[k] - A[k]) * t;
        p.posAttr.needsUpdate = true;
        p.geo.computeVertexNormals();
      }
    },
    resetPrev() {
      for (const p of panels) p.prev.set(p.pos);
    },
    reset() {
      for (const p of panels) {
        p.pos.set(p.rest);
        p.prev.set(p.rest);
        p.posAttr.needsUpdate = true;
      }
      awake = 90;
    },
  };

  return { group, net, FRAME_Y, POST_X, BACK_P0, BACK_N };
}

export const GOAL_GEOM = { FRAME_Y, POST_X, BACK_P0, BACK_N };

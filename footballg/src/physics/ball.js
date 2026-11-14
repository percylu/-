import * as THREE from 'three';
import { F } from '../config.js';
import { GOAL_GEOM, netBackZ } from '../world/goal.js';

const G = 9.81;
const KD = 0.0118; // 0.5 * rho * Cd * A / m
const KM = 0.0056; // Magnus coefficient
const SUB = 1 / 480;
const NET_K = 700; // spring / mass
const NET_C = 28; // damper / mass

const _a = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _dq = new THREE.Quaternion();
const FRAME_A = [
  new THREE.Vector3(-GOAL_GEOM.POST_X, -1, 0),
  new THREE.Vector3(GOAL_GEOM.POST_X, -1, 0),
  new THREE.Vector3(-GOAL_GEOM.POST_X, GOAL_GEOM.FRAME_Y, 0),
];
const FRAME_B = [
  new THREE.Vector3(-GOAL_GEOM.POST_X, GOAL_GEOM.FRAME_Y, 0),
  new THREE.Vector3(GOAL_GEOM.POST_X, GOAL_GEOM.FRAME_Y, 0),
  new THREE.Vector3(GOAL_GEOM.POST_X, GOAL_GEOM.FRAME_Y, 0),
];

function aero(v, w, out) {
  const sp = v.length();
  out.set(0, -G, 0);
  out.addScaledVector(v, -KD * sp);
  // Magnus: KM * (w x v)
  out.x += KM * (w.y * v.z - w.z * v.y);
  out.y += KM * (w.z * v.x - w.x * v.z);
  out.z += KM * (w.x * v.y - w.y * v.x);
  return out;
}

// Free flight used by the aim solver and the keeper's read of the shot.
function flyToPlane(p0, v0, w0, planeZ, withGround, maxT = 4) {
  const p = p0.clone();
  const v = v0.clone();
  const w = w0.clone();
  const acc = new THREE.Vector3();
  const dt = 1 / 240;
  let t = 0;
  let bounces = 0;
  while (t < maxT) {
    aero(v, w, acc);
    const pzPrev = p.z;
    const pxPrev = p.x;
    const pyPrev = p.y;
    v.addScaledVector(acc, dt);
    p.addScaledVector(v, dt);
    t += dt;
    if (withGround && p.y < F.ballR && v.y < 0) {
      p.y = F.ballR;
      v.y *= -0.55;
      v.x *= 0.8;
      v.z *= 0.8;
      bounces++;
    }
    if ((pzPrev - planeZ) * (p.z - planeZ) <= 0 && pzPrev !== p.z) {
      const k = (pzPrev - planeZ) / (pzPrev - p.z);
      return {
        reached: true,
        t: t - dt + k * dt,
        x: pxPrev + (p.x - pxPrev) * k,
        y: pyPrev + (p.y - pyPrev) * k,
        speed: v.length(),
        bounces,
      };
    }
  }
  return { reached: false, t, x: p.x, y: p.y, speed: v.length(), bounces };
}

export function spinFor(dirH, curve, lift) {
  // curve > 0 bends the ball towards the kicker's right late in flight.
  const w = new THREE.Vector3(0, -curve * 58, 0);
  const back = new THREE.Vector3().crossVectors(dirH, new THREE.Vector3(0, 1, 0)).normalize();
  w.addScaledVector(back, lift);
  return w;
}

// Find the launch velocity that carries the ball through `target` on the goal plane.
export function solveShot(p0, target, speed, curve, lift = 8) {
  const aim = target.clone();
  const dir = new THREE.Vector3();
  const v0 = new THREE.Vector3();
  let w = new THREE.Vector3();
  let res = null;
  for (let i = 0; i < 12; i++) {
    dir.subVectors(aim, p0).normalize();
    v0.copy(dir).multiplyScalar(speed);
    const dirH = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    w = spinFor(dirH, curve, lift);
    res = flyToPlane(p0, v0, w, target.z, false, 3.5);
    if (!res.reached) {
      aim.y += 1.5;
      continue;
    }
    const ex = target.x - res.x;
    const ey = target.y - res.y;
    if (Math.abs(ex) < 0.004 && Math.abs(ey) < 0.004) break;
    aim.x += ex * 0.9;
    aim.y += ey * 0.9;
    // do not allow absurd lobs
    const maxY = p0.y + Math.hypot(aim.x - p0.x, aim.z - p0.z) * 1.1;
    if (aim.y > maxY) aim.y = maxY;
  }
  return { v: v0.clone(), w, t: res ? res.t : 1 };
}

export function predictAtGoal(p0, v0, w0, planeZ = 0) {
  return flyToPlane(p0, v0, w0, planeZ, true, 3.5);
}

export class BallSim {
  constructor() {
    this.p = new THREE.Vector3(0, F.ballR, F.penaltyZ);
    this.v = new THREE.Vector3();
    this.w = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.acc = new THREE.Vector3();
    this.active = false;
    this.inside = false;
    this.goal = false;
    this.held = null;
    this.events = [];
    this.colliders = [];
    this.touchedKeeper = false;
    this.touchedPost = false;
    this.touchedWall = false;
    this.netHit = false;
    this.time = 0;
    this.grounded = false;
  }

  reset(pos) {
    this.p.copy(pos);
    this.p.y = F.ballR;
    this.v.set(0, 0, 0);
    this.w.set(0, 0, 0);
    this.active = false;
    this.inside = false;
    this.goal = false;
    this.held = null;
    this.events.length = 0;
    this.touchedKeeper = false;
    this.touchedPost = false;
    this.touchedWall = false;
    this.netHit = false;
    this.time = 0;
  }

  launch(v, w) {
    this.v.copy(v);
    this.w.copy(w);
    this.active = true;
    this.time = 0;
  }

  emit(type, strength, extra) {
    this.events.push({ type, strength, extra, t: this.time });
  }

  // Generic rigid contact with normal n (pointing out of the surface).
  contact(n, e, mu, surfVel) {
    const v = this.v;
    const w = this.w;
    _vc.copy(v);
    if (surfVel) _vc.sub(surfVel);
    const vn = _vc.dot(n);
    if (vn >= 0) return 0;
    // contact point velocity including spin: v + w x (-R n)
    _a.crossVectors(w, n).multiplyScalar(-F.ballR);
    _vc.add(_a);
    const jn = -(1 + e) * vn;
    _t.copy(_vc).addScaledVector(n, -_vc.dot(n));
    const vt = _t.length();
    v.addScaledVector(n, jn);
    if (vt > 1e-5) {
      _t.multiplyScalar(1 / vt);
      const jt = Math.min(mu * jn, vt / 2.5);
      v.addScaledVector(_t, -jt);
      _a.crossVectors(n, _t).multiplyScalar((1.5 * jt) / F.ballR);
      w.add(_a);
    }
    return -vn;
  }

  capsule(a, b, r, e, mu, vel) {
    const p = this.p;
    _ab.subVectors(b, a);
    const l2 = _ab.lengthSq();
    let t = l2 > 1e-9 ? _a.subVectors(p, a).dot(_ab) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    _c.copy(a).addScaledVector(_ab, t);
    _n.subVectors(p, _c);
    const d = _n.length();
    const R = r + F.ballR;
    if (d >= R || d < 1e-6) return 0;
    _n.multiplyScalar(1 / d);
    p.copy(_c).addScaledVector(_n, R);
    const s = this.contact(_n, e, mu, vel);
    return s > 0 ? s : 1e-4;
  }

  netSpring(n, depth, dt) {
    const v = this.v;
    const vn = v.dot(n);
    const f = NET_K * depth + NET_C * vn;
    if (!this.netHit) {
      this.netHit = true;
      this.emit('net', v.length());
    }
    if (f > 0) v.addScaledVector(n, -f * dt);
    const k = Math.exp(-5 * dt);
    const vn2 = v.dot(n);
    v.x = n.x * vn2 + (v.x - n.x * vn2) * k;
    v.y = n.y * vn2 + (v.y - n.y * vn2) * k;
    v.z = n.z * vn2 + (v.z - n.z * vn2) * k;
    this.w.multiplyScalar(Math.exp(-8 * dt));
  }

  stepNet(dt) {
    const p = this.p;
    const R = F.ballR;
    const { FRAME_Y, POST_X, BACK_P0, BACK_N } = GOAL_GEOM;
    if (this.inside) {
      let d = _a.subVectors(p, BACK_P0).dot(BACK_N) + R;
      if (d > 0) this.netSpring(BACK_N, d, dt);
      d = p.y - FRAME_Y + R;
      if (d > 0 && p.z < -0.12) this.netSpring(_n.set(0, 1, 0), d, dt);
      d = p.x - POST_X + R;
      if (d > 0 && p.z < -0.1) this.netSpring(_n.set(1, 0, 0), d, dt);
      d = -p.x - POST_X + R;
      if (d > 0 && p.z < -0.1) this.netSpring(_n.set(-1, 0, 0), d, dt);
    } else {
      if (p.z > 0.05 || p.z < -F.netBottomDepth - 0.4 || Math.abs(p.x) > POST_X + 0.4 || p.y > FRAME_Y + 0.4) return;
      const inX = Math.abs(p.x) < POST_X;
      // top from above
      let s = p.y - FRAME_Y;
      if (inX && p.z < -0.08 && p.z > -F.netTopDepth && s > -R * 0.5 && s < R) this.netSpring(_n.set(0, -1, 0), R - s, dt);
      // back from behind
      s = _a.subVectors(p, BACK_P0).dot(BACK_N);
      if (inX && p.y < FRAME_Y && s > -R * 0.5 && s < R) this.netSpring(_n.copy(BACK_N).negate(), R - s, dt);
      // sides from outside
      for (const sx of [-1, 1]) {
        s = sx * p.x - POST_X;
        if (p.y < FRAME_Y && p.z < -0.1 && p.z > netBackZ(p.y) && s > -R * 0.5 && s < R) this.netSpring(_n.set(-sx, 0, 0), R - s, dt);
      }
    }
  }

  step(dt) {
    if (!this.active || this.held) return;
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(SUB, remaining);
      remaining -= h;
      this.substep(h);
    }
  }

  substep(h) {
    const p = this.p;
    const v = this.v;
    const w = this.w;
    const R = F.ballR;
    this.time += h;
    aero(v, w, this.acc);
    const zPrev = p.z;
    v.addScaledVector(this.acc, h);
    p.addScaledVector(v, h);
    w.multiplyScalar(Math.exp(-0.18 * h));

    // goal mouth crossing
    if (!this.inside && zPrev >= 0 && p.z < 0 && Math.abs(p.x) < F.goalHalfW && p.y < F.goalH) this.inside = true;
    else if (this.inside && p.z > 0.02) this.inside = false;
    if (this.inside && !this.goal && p.z < -(F.postR + R)) {
      this.goal = true;
      this.emit('goal', v.length());
    }

    // frame
    for (let i = 0; i < 3; i++) {
      const s = this.capsule(FRAME_A[i], FRAME_B[i], F.postR, 0.62, 0.25, null);
      if (s > 0.5) {
        this.touchedPost = true;
        this.emit('post', s, i);
      }
    }

    // dynamic bodies (keeper, wall)
    for (const col of this.colliders) {
      if (!col.enabled) continue;
      const s = this.capsule(col.a, col.b, col.r, col.e, col.mu, col.vel);
      if (s > 0) {
        if (col.owner === 'keeper') this.touchedKeeper = true;
        else this.touchedWall = true;
        if (s > 0.3) this.emit(col.owner, s, col);
        if (col.push) v.addScaledVector(col.push, 1);
      }
    }

    this.stepNet(h);

    // advertising boards behind the goal and along the sides
    if (p.y < 0.95 + R) {
      if (p.z < F.boardZ + R && p.z > F.boardZ - 0.4 && v.z < 0) {
        p.z = F.boardZ + R;
        const s = this.contact(_n.set(0, 0, 1), 0.45, 0.3, null);
        if (s > 1) this.emit('board', s);
      }
      for (const sx of [-1, 1]) {
        if (sx * p.x > F.boardX - R && sx * p.x < F.boardX + 0.4 && sx * v.x > 0) {
          p.x = sx * (F.boardX - R);
          const s = this.contact(_n.set(-sx, 0, 0), 0.45, 0.3, null);
          if (s > 1) this.emit('board', s);
        }
      }
    }

    // ground / stand slope behind the boards
    let floorY = 0;
    _n.set(0, 1, 0);
    if (p.z < -9.5) {
      floorY = 1.0 + (-9.5 - p.z) * 0.52;
      _n.set(0, 0.887, 0.461);
    }
    if (p.y < floorY + R) {
      p.y = floorY + R;
      const vn = -v.dot(_n);
      const e = vn > 0.7 ? (floorY > 0 ? 0.25 : 0.58) : 0;
      const s = this.contact(_n, e, 0.55, null);
      if (s > 1.2) this.emit('bounce', s);
      if (e === 0) {
        // rolling: resistance and spin locked to travel
        const sp = Math.hypot(v.x, v.z);
        const dec = (floorY > 0 ? 6 : 1.25) * h;
        if (sp > dec) {
          const k = (sp - dec) / sp;
          v.x *= k;
          v.z *= k;
        } else {
          v.x = 0;
          v.z = 0;
        }
        const k2 = Math.min(1, 12 * h);
        w.x += (v.z / R - w.x) * k2;
        w.z += (-v.x / R - w.z) * k2;
        w.y *= Math.exp(-2.5 * h);
        this.grounded = true;
      }
    } else {
      this.grounded = false;
    }

    // orientation
    const wl = w.length();
    if (wl > 1e-4) {
      _dq.setFromAxisAngle(_a.copy(w).multiplyScalar(1 / wl), wl * h);
      this.q.premultiply(_dq).normalize();
    }
  }

  get speed() {
    return this.v.length();
  }
}

import * as THREE from 'three';
import { HIP_HEIGHT, ANKLE_H, LEG_LEN, HIP_JOINT } from './humanoid.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;

const BALL_OF_FOOT = 0.125;
const HEEL = 0.06;

// Ankle joint for a foot whose sole reference point (under the ankle when flat) is at (gx, gz).
// pitch > 0 rolls up onto the ball of the foot, pitch < 0 rocks back on the heel.
export function ankleOf(out, gx, gz, yaw, pitch, scale, lift = 0) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  let f;
  let u;
  if (pitch >= 0) {
    f = BALL_OF_FOOT - BALL_OF_FOOT * c + ANKLE_H * s;
    u = BALL_OF_FOOT * s + ANKLE_H * c;
  } else {
    f = -HEEL + HEEL * c + ANKLE_H * s;
    u = -HEEL * s + ANKLE_H * c;
  }
  return out.set(gx + fx * f * scale, u * scale + lift, gz + fz * f * scale);
}

// Shared swing shape: where the foot is between lift-off and touch-down.
// k in [0,1]; run in [0,1] scales heel recovery; returns { e, lift, pitch }.
export function swingShape(k, run, pitchOff = 0.85, pitchLand = -0.18) {
  const e = k * k * (3 - 2 * k);
  const lift = (0.045 + 0.2 * run) * Math.sin(Math.PI * k) ** 0.85 * (1 - 0.35 * k);
  const mid = 0.45 + 0.45 * run;
  const pitch = k < 0.4 ? lerp(pitchOff, mid, k / 0.4) : lerp(mid, pitchLand, smooth(0.4, 1, k));
  return { e, lift, pitch };
}

// Highest pelvis that keeps a planted ankle within reach.
export function reachLimit(ax, ay, az, px, pz, yaw, side, scale, stretch = 0.985) {
  const jx = px + Math.cos(yaw) * side * HIP_JOINT[0] * scale;
  const jz = pz - Math.sin(yaw) * side * HIP_JOINT[0] * scale;
  const h2 = (ax - jx) ** 2 + (az - jz) ** 2;
  const L = LEG_LEN * scale * stretch;
  return ay + Math.sqrt(Math.max(0.02, L * L - h2)) - HIP_JOINT[1] * scale;
}

const _a = new THREE.Vector3();

// Online foot planting for walking, jogging, running and standing. The caller moves the body
// (position + heading); the feet stay planted on the turf and step when they have to.
export class Gait {
  constructor(h, opts = {}) {
    this.h = h;
    this.s = h.scale;
    this.width = opts.width || 0.1;
    this.pos = new THREE.Vector2();
    this.vel = new THREE.Vector2();
    this.yaw = 0;
    this.speed = 0;
    this.clock = 0;
    this.next = 1;
    this.sinceStep = 1;
    this.crouch = 0;
    this.hipY = HIP_HEIGHT * this.s;
    this.feet = { 1: this._foot(1), [-1]: this._foot(-1) };
    this.fresh = true;
  }

  _foot(side) {
    return { side, planted: true, x: 0, z: 0, yaw: 0, pitch: 0, t: 0, T: 0, x0: 0, z0: 0, yaw0: 0, run: 0, landT: 1, ankle: new THREE.Vector3() };
  }

  home(side, out, width = this.width) {
    const w = side * width * this.s;
    out.x = this.pos.x + Math.cos(this.yaw) * w;
    out.z = this.pos.y - Math.sin(this.yaw) * w;
    return out;
  }

  reset(x, z, yaw, width = this.width) {
    this.pos.set(x, z);
    this.vel.set(0, 0);
    this.yaw = yaw;
    this.speed = 0;
    this.clock = 0;
    this.width = width;
    this.fresh = true;
    for (const side of [1, -1]) {
      const f = this.feet[side];
      this.home(side, f);
      f.planted = true;
      f.yaw = yaw;
      f.pitch = 0;
      f.landT = 1;
      ankleOf(f.ankle, f.x, f.z, f.yaw + side * 0.1, 0, this.s);
    }
  }

  // Continue from feet that another controller left on the ground.
  adopt(x, z, yaw, vx, vz, feet) {
    this.pos.set(x, z);
    this.vel.set(vx, vz);
    this.speed = this.vel.length();
    this.yaw = yaw;
    this.fresh = false;
    this.clock = 0.5;
    for (const side of [1, -1]) {
      const f = this.feet[side];
      const src = feet[side];
      f.planted = true;
      f.x = src.x;
      f.z = src.z;
      f.yaw = src.yaw;
      f.pitch = 0;
      f.landT = 1;
    }
    // step first with the foot that trails
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const dL = (this.feet[1].x - x) * fx + (this.feet[1].z - z) * fz;
    const dR = (this.feet[-1].x - x) * fx + (this.feet[-1].z - z) * fz;
    this.next = dL < dR ? 1 : -1;
  }

  get moving() {
    return this.speed > 0.3 || !this.feet[1].planted || !this.feet[-1].planted;
  }

  // Body moved to (x, z) facing yaw. Advances the step logic.
  update(dt, x, z, yaw) {
    const s = this.s;
    if (this.fresh || dt <= 0) {
      this.fresh = false;
      this.pos.set(x, z);
      this.yaw = yaw;
    } else {
      const vx = (x - this.pos.x) / dt;
      const vz = (z - this.pos.y) / dt;
      const k = 1 - Math.exp(-14 * dt);
      this.vel.x += (vx - this.vel.x) * k;
      this.vel.y += (vz - this.vel.y) * k;
      this.pos.set(x, z);
      this.yaw = yaw;
    }
    const speed = this.vel.length();
    this.speed = speed;
    const run = smooth(2.2, 5, speed);
    const rate = 1.5 + 0.3 * speed;
    this.sinceStep += dt;
    const feet = this.feet;
    const mvx = speed > 0.05 ? this.vel.x / speed : Math.sin(yaw);
    const mvz = speed > 0.05 ? this.vel.y / speed : Math.cos(yaw);

    if (speed > 0.35) {
      this.clock += dt * rate;
      if (this.clock >= 1) {
        const f = feet[this.next];
        if (f.planted) {
          this.clock -= 1;
          this._lift(f, lerp(0.8, 1.2, run) / rate, run);
          this.next = -this.next;
        } else {
          this.clock = 1;
        }
      }
    } else {
      this.clock = 0.6;
      // standing: step only when a foot has been left behind or twisted
      let worst = null;
      let worstErr = 0;
      for (const side of [1, -1]) {
        const f = feet[side];
        if (!f.planted) {
          worst = null;
          worstErr = -1;
          break;
        }
        this.home(side, _a);
        const err = Math.hypot(f.x - _a.x, f.z - _a.z) / s + Math.abs(wrapAngle(f.yaw - yaw)) * 0.25;
        if (err > worstErr) {
          worstErr = err;
          worst = f;
        }
      }
      if (worst && worstErr > 0.15 && this.sinceStep > 0.1) {
        this._lift(worst, 0.24 + Math.min(0.12, worstErr * 0.12), 0);
        this.next = -worst.side;
      }
    }

    for (const side of [1, -1]) {
      const f = feet[side];
      if (!f.planted) {
        f.t += dt;
        const k = Math.min(1, f.t / f.T);
        // keep correcting the landing spot while the foot is in the air
        if (k < 0.85) {
          const rest = f.T - f.t;
          const stance = Math.max(0.08, 2 / rate - f.T);
          const lead = speed > 0.35 ? rest + stance * lerp(0.48, 0.3, run) : rest;
          this.home(side, _a, speed > 0.35 ? this.width * lerp(0.75, 0.45, run) : this.width);
          f.tx = _a.x + this.vel.x * lead;
          f.tz = _a.z + this.vel.y * lead;
          f.tyaw = yaw;
        }
        const sh = swingShape(k, f.run, f.pitch0, speed > 0.35 ? lerp(-0.2, 0.05, run) : 0);
        f.x = lerp(f.x0, f.tx, sh.e);
        f.z = lerp(f.z0, f.tz, sh.e);
        f.yaw = lerpAngle(f.yaw0, f.tyaw, sh.e);
        f.pitch = sh.pitch;
        ankleOf(f.ankle, f.x, f.z, f.yaw + side * 0.1, f.pitch, s, sh.lift * s * (speed > 0.35 ? 1 : 0.55));
        if (k >= 1) {
          f.planted = true;
          f.landT = 0;
          f.x = f.tx;
          f.z = f.tz;
          f.yaw = f.tyaw;
          this.sinceStep = 0;
        }
      } else {
        f.landT += dt;
        // heel comes up once the body has travelled past the foot
        const ahead = ((this.pos.x - f.x) * mvx + (this.pos.y - f.z) * mvz) / s;
        let pitch = speed > 0.35 ? clamp((ahead - 0.1) * 2.4, 0, 0.9) : 0;
        if (f.landT < 0.09 && speed > 0.35) pitch = lerp(lerp(-0.2, 0.05, run), pitch, f.landT / 0.09);
        f.pitch = pitch;
        ankleOf(f.ankle, f.x, f.z, f.yaw + side * 0.1, pitch, s);
      }
    }

    // pelvis height: bob with the steps, never beyond the reach of a planted leg
    const bob = speed > 0.35 ? -lerp(0.018, 0.034, run) * Math.cos(Math.PI * 2 * (this.clock - 0.12)) - 0.025 * run : 0;
    let y = (HIP_HEIGHT - this.crouch + bob) * s;
    for (const side of [1, -1]) {
      const f = feet[side];
      if (f.planted) y = Math.min(y, reachLimit(f.ankle.x, f.ankle.y, f.ankle.z, x, z, yaw, side, s));
    }
    this.hipY = y;
  }

  _lift(f, T, run) {
    f.planted = false;
    f.t = 0;
    f.T = T;
    f.x0 = f.x;
    f.z0 = f.z;
    f.yaw0 = f.yaw;
    f.tx = f.x;
    f.tz = f.z;
    f.tyaw = f.yaw;
    f.run = run;
    f.pitch0 = Math.max(f.pitch, run > 0 || this.speed > 0.35 ? 0.6 : 0.15);
  }

  // Swing value in [-1, 1]: +1 when the left foot leads. Drives arm swing and torso counter-rotation.
  get swing() {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const d = ((this.feet[1].x - this.feet[-1].x) * fx + (this.feet[1].z - this.feet[-1].z) * fz) / this.s;
    return clamp(d / (0.35 + 0.16 * this.speed), -1, 1);
  }

  // Call after the pose has been applied: puts the body at its position and solves both legs.
  apply(blend = 1, extraY = 0) {
    const h = this.h;
    h.object.position.set(this.pos.x, 0, this.pos.y);
    h.object.rotation.set(0, this.yaw, 0);
    if (blend >= 1) h.bones[0].position.y = (this.hipY + extraY) / this.s;
    else h.bones[0].position.y = lerp(h.bones[0].position.y, (this.hipY + extraY) / this.s, blend);
    for (const side of [1, -1]) {
      const f = this.feet[side];
      if (extraY > 0 && f.planted) {
        // airborne (jump): feet leave the turf with the body
        _a.copy(f.ankle);
        _a.y += extraY;
        h.aimLeg(side, _a, { pitch: Math.min(0.8, f.pitch + extraY * 3), yaw: f.yaw + side * 0.1, blend });
      } else {
        h.aimLeg(side, f.ankle, { pitch: f.pitch, yaw: f.yaw + side * 0.1, blend });
      }
    }
  }
}

// Cubic Hermite through keys [{ t, v: number[] }] with finite-difference tangents.
export function sampleTrack(keys, t, out) {
  const n = keys.length;
  const dim = keys[0].v.length;
  if (t <= keys[0].t) {
    for (let i = 0; i < dim; i++) out[i] = keys[0].v[i];
    return out;
  }
  if (t >= keys[n - 1].t) {
    for (let i = 0; i < dim; i++) out[i] = keys[n - 1].v[i];
    return out;
  }
  let i = 0;
  while (i < n - 2 && keys[i + 1].t <= t) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2.t - k1.t;
  const u = (t - k1.t) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (let d = 0; d < dim; d++) {
    const m1 = k1.stop ? 0 : k1 === k0 ? (k2.v[d] - k1.v[d]) / h : (k2.v[d] - k0.v[d]) / (k2.t - k0.t);
    const m2 = k2.stop ? 0 : k3 === k2 ? (k2.v[d] - k1.v[d]) / h : (k3.v[d] - k1.v[d]) / (k3.t - k1.t);
    out[d] = h00 * k1.v[d] + h10 * h * m1 + h01 * k2.v[d] + h11 * h * m2;
  }
  return out;
}

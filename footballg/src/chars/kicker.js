import * as THREE from 'three';
import { F } from '../config.js';
import { makePose, blendPose, sampleClip, POSE_SIZE, HIP_HEIGHT } from './humanoid.js';
import { Gait, ankleOf, swingShape, reachLimit, sampleTrack, wrapAngle } from './gait.js';
import { mirrorSpec } from './keeper.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _look = new THREE.Vector3();

// Upper-body shapes for a right-footed strike (plant foot = left). Legs come from IK.
const KICK_KEYS = [
  [-0.27, { spine: [0.0, -0.1, 0], chest: [-0.05, -0.2, 0], armL: [0.6, -0.5, 0.55], elbowL: 0.5, armR: [-0.35, -0.75, -0.55], elbowR: 0.7 }],
  [-0.11, { spine: [-0.12, -0.15, 0], chest: [-0.1, -0.32, 0], armL: [0.88, -0.02, 0.32], elbowL: 0.3, armR: [-0.45, -0.6, -0.65], elbowR: 0.5 }],
  [0, { spine: [0.1, 0.0, 0], chest: [0.12, 0.12, 0], armL: [0.9, -0.3, -0.18], elbowL: 0.28, armR: [-0.4, -0.85, 0.1], elbowR: 0.5 }],
  [0.16, { spine: [0.1, 0.2, 0], chest: [0.08, 0.36, 0], armL: [0.55, -0.6, -0.6], elbowL: 0.5, armR: [-0.3, -0.6, 0.68], elbowR: 0.95 }],
  [0.44, { spine: [0.15, 0.05, 0], chest: [0.08, 0.05, 0], armL: [0.3, -0.9, -0.2], elbowL: 0.7, armR: [-0.3, -0.9, 0.25], elbowR: 0.8 }],
];
const STAND = { spine: [0.03, 0, 0], chest: [0.02, 0, 0], armL: [0.16, -1, 0.03], armR: [-0.16, -1, 0.03], elbowL: 0.22, elbowR: 0.22 };
const HANDS_ON_HIPS = { spine: [0.05, 0, 0], chest: [0.02, 0, 0], armL: [0.62, -0.75, -0.18], armR: [-0.62, -0.75, -0.18], elbowL: 1.75, elbowR: 1.75, twistL: 0.9, twistR: -0.9 };
const ARMS_WIDE = { spine: [-0.1, 0, 0], chest: [-0.12, 0, 0], head: [-0.2, 0, 0], armL: [0.95, 0.22, -0.12], armR: [-0.95, 0.22, -0.12], elbowL: 0.18, elbowR: 0.18 };
const FIST = { spine: [0.12, 0.1, 0], chest: [0.1, 0.15, 0], head: [0.05, 0, 0], armL: [0.3, -0.8, -0.3], elbowL: 1.0, armR: [-0.25, 0.25, 0.7], elbowR: 1.9 };
const ARMS_UP = { spine: [-0.14, 0, 0], chest: [-0.12, 0, 0], head: [-0.28, 0, 0], armL: [0.42, 0.9, 0.08], armR: [-0.42, 0.9, 0.08], elbowL: 0.3, elbowR: 0.3 };
const DESPAIR = { spine: [0.12, 0, 0], head: [0.3, 0, 0], armL: [0.5, 0.55, 0.35], armR: [-0.5, 0.55, 0.35], elbowL: 2.3, elbowR: 2.3 };
const SLUMP = { spine: [0.2, 0, 0], chest: [0.12, 0, 0], head: [0.45, 0, 0], armL: [0.14, -1, 0.05], armR: [-0.14, -1, 0.05], elbowL: 0.15, elbowR: 0.15 };

function runSpec(w, amp, lean) {
  return {
    spine: [0.05 + lean * 0.5, 0.07 * w * amp, 0],
    chest: [0.03 + lean * 0.5, 0.13 * w * amp, 0],
    armL: [0.2, -0.92, -0.62 * w * amp + 0.04],
    armR: [-0.2, -0.92, 0.62 * w * amp + 0.04],
    elbowL: 0.3 + amp * (0.95 + 0.35 * Math.max(0, -w)),
    elbowR: 0.3 + amp * (0.95 + 0.35 * Math.max(0, w)),
  };
}

// Write lean / twist / roll straight into the hips slot of a pose.
function setHips(pose, lean, twist, roll) {
  _q.setFromEuler(_e.set(lean, twist, roll, 'YXZ')).toArray(pose, 0);
}

// The taker: walks to his mark, runs up, plants, strikes through the ball and reacts to the outcome.
export class Kicker {
  constructor() {
    this.tmp = new Float32Array(POSE_SIZE);
    this.tmp2 = new Float32Array(POSE_SIZE);
    this.poses = {};
    for (const [k, s] of Object.entries({ STAND, HANDS_ON_HIPS, ARMS_WIDE, FIST, ARMS_UP, DESPAIR, SLUMP })) this.poses[k] = makePose(s);
    this.clips = {
      1: KICK_KEYS.map(([t, s]) => ({ t, pose: makePose(s) })),
      [-1]: KICK_KEYS.map(([t, s]) => ({ t, pose: makePose(mirrorSpec(s)) })),
    };
    this.ball = new THREE.Vector3(0, F.ballR, F.penaltyZ);
    this.mark = new THREE.Vector2();
    this.t = -10;
    this.mode = 'idle';
    this.mood = null;
    this.moodT = 0;
    this.idleT = 0;
    this.struck = false;
    this.m = 1;
    this.plan = null;
    this.vel = new THREE.Vector2();
    this.heading = 0;
    this.h = null;
  }

  get object() {
    return this.h.object;
  }

  // Hand the kick to a player (a Humanoid). foot: 'R' | 'L'.
  use(h, foot = 'R') {
    this.h = h;
    this.m = foot === 'L' ? -1 : 1;
    if (!h.gait) h.gait = new Gait(h);
    this.gait = h.gait;
    this.s = h.scale;
  }

  // style: { back, side, walkIn }. The mark sits behind the ball on the plant-foot side.
  place(ball, goalDir, style = {}) {
    const s = this.s;
    this.ball.copy(ball);
    const fx = goalDir.x;
    const fz = goalDir.z;
    const lx = fz * this.m;
    const lz = -fx * this.m;
    const back = (style.back || 3.2) * s;
    const side = (style.side || 1.6) * s;
    this.mark.set(ball.x - fx * back + lx * side, ball.z - fz * back + lz * side);
    this.goalDir = new THREE.Vector2(fx, fz);
    this.mode = 'idle';
    this.mood = null;
    this.struck = false;
    this.plan = null;
    this.pendingRun = null;
    this.cheerTo = null;
    this.t = -10;
    this.idleT = (style.phase || 0) * 7;
    this.idlePose = style.hips ? this.poses.HANDS_ON_HIPS : this.poses.STAND;
    const face = Math.atan2(ball.x - this.mark.x, ball.z - this.mark.y);
    if (style.walkIn) {
      // he has just put the ball down and now backs off to his mark
      const k = style.walkIn;
      const x = lerp(ball.x - fx * 0.8 * s + lx * 0.25 * s, this.mark.x, 1 - k);
      const z = lerp(ball.z - fz * 0.8 * s + lz * 0.25 * s, this.mark.y, 1 - k);
      this.gait.reset(x, z, face);
      this.walking = true;
    } else {
      this.gait.reset(this.mark.x, this.mark.y, face);
      this.walking = false;
    }
    this.heading = face;
    this.h.resetCloth();
    this.update(0, null);
  }

  // target: aim point on the goal plane; power 0..1; curve -1..1. Returns false while he is still walking to his mark.
  startRun(target, power, curve) {
    this.pendingRun = { target: target.clone(), power, curve };
    if (!this.walking) this._beginRun();
  }

  _beginRun() {
    const { target, power, curve } = this.pendingRun;
    this.pendingRun = null;
    this.plan = this._plan(target, power, curve);
    this.t = this.plan.t0;
    this.mode = 'run';
    this.struck = false;
  }

  get runTime() {
    return this.plan ? -this.plan.t0 : 1.6;
  }

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.moodT = 0;
  }

  _plan(target, power, curve) {
    const s = this.s;
    const m = this.m;
    const g = this.gait;
    const B = this.ball;
    let fx = target.x - B.x;
    let fz = target.z - B.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const lx = fz * m;
    const lz = -fx * m;
    const inside = power < 0.5 || Math.abs(curve) > 0.35;
    const P = (lat, fwd) => [B.x + lx * lat * s + fx * fwd * s, B.z + lz * lat * s + fz * fwd * s];
    const GP = P(inside ? 0.23 : 0.2, inside ? -0.08 : -0.03);
    const P0 = [g.pos.x, g.pos.y];
    // approach line: from where he stands to just inside the plant foot
    const C0 = [GP[0] - lx * 0.085 * s, GP[1] - lz * 0.085 * s];
    let ax = C0[0] - P0[0];
    let az = C0[1] - P0[1];
    const D = Math.hypot(ax, az);
    ax /= D;
    az /= D;
    // lateral axis of the approach, pointing to the plant side
    let px = lx - ax * (lx * ax + lz * az);
    let pz = lz - az * (lx * ax + lz * az);
    const pl = Math.hypot(px, pz) || 1;
    px /= pl;
    pz /= pl;
    const base = [1.28 + 0.25 * power, 1.05, 0.9, 0.76, 0.64].map((v) => v * s);
    let n = 2;
    let sum = base[0] + base[1];
    while (n < 5 && sum < D - 0.35 * s) {
      sum += base[n];
      n++;
    }
    const k = clamp((D - 0.12 * s) / sum, 0.6, 1.3);
    const stride = base.map((v) => v * k);
    const dur = [0.3 + 0.04 * power, 0.29, 0.3, 0.33, 0.36];
    const tPlant = -0.125;
    const plantSide = m;
    const kickSide = -m;
    const yawA = Math.atan2(ax, az);
    const yawF = Math.atan2(fx, fz);
    const hop = power > 0.42 ? smooth(0.42, 0.8, power) * 0.6 + 0.4 : 0;

    // footfalls, counted back from the plant (index 0)
    const falls = [{ side: plantSide, t: tPlant, x: GP[0], z: GP[1], yaw: yawF + m * 0.18 }];
    let cum = 0;
    let t = tPlant;
    for (let i = 1; i <= n; i++) {
      cum += stride[i - 1];
      t -= dur[i - 1];
      const side = i % 2 ? kickSide : plantSide;
      const lat = side === kickSide ? -0.17 * s : 0;
      falls.push({ side, t, x: GP[0] - ax * cum + px * lat, z: GP[1] - az * cum + pz * lat, yaw: yawA, cum });
    }
    const t0 = falls[n].t - 0.4;
    const st = { 1: [], [-1]: [] };
    for (const side of [1, -1]) {
      const f = g.feet[side];
      st[side].push({ tDown: -1e9, tUp: 0, x: f.x, z: f.z, yaw: f.yaw, landPitch: 0, offPitch: 0.35, heelT: 0.1, run: 0.1 });
    }
    for (let i = n; i >= 0; i--) {
      const f = falls[i];
      const runK = 1 - (i - 1) / n;
      const list = st[f.side];
      const prev = list[list.length - 1];
      // the foot before this one leaves the ground around the time this one lands
      const other = st[-f.side][st[-f.side].length - 1];
      const fl2 = i === 0 ? 0.11 : lerp(-0.06, 0.05, runK);
      other.tUp = f.t - fl2;
      if (prev.tDown < -1e8 && i === n) prev.tUp = t0 + 0.07;
      list.push({ tDown: f.t, tUp: 1e9, x: f.x, z: f.z, yaw: f.yaw, landPitch: i === 0 ? -0.3 : lerp(-0.2, 0.0, runK), offPitch: 0.85, heelT: i === 0 ? 0.22 : 0.1, run: i === 0 ? 0.9 : runK, plant: i === 0 });
    }
    // after the strike: kicking foot lands ahead, plant foot follows
    const tLand = hop ? 0.34 + 0.08 * power : 0.4;
    const GK2 = hop ? P(-0.02, 0.8 + 0.42 * power) : P(0.02, 0.5);
    const GP2 = hop ? P(0.2, 1.38 + 0.5 * power) : P(0.2, 0.95);
    const tLand2 = hop ? tLand + 0.3 : 0.86;
    const plantSt = st[plantSide][st[plantSide].length - 1];
    plantSt.tUp = hop ? 0.15 : 0.5;
    plantSt.offPitch = 0.8;
    st[plantSide].push({ tDown: tLand2, tUp: 1e9, x: GP2[0], z: GP2[1], yaw: yawF, landPitch: -0.1, offPitch: 0.6, heelT: 0.1, run: 0.5 });
    const kickSt = st[kickSide][st[kickSide].length - 1];
    kickSt.tUp = tPlant - 0.1;
    kickSt.custom = true;
    st[kickSide].push({ tDown: tLand, tUp: 1e9, x: GK2[0], z: GK2[1], yaw: yawF, landPitch: -0.12, offPitch: 0.6, heelT: 0.1, run: 0.5 });
    const tHand = tLand2 + 0.03;

    // pelvis: over each stance foot, behind the plant, through the ball, on to the landing
    const line = (c, lat = 0) => [C0[0] - ax * c + px * lat, C0[1] - az * c + pz * lat];
    const pel = [{ t: t0, v: P0, stop: true }];
    for (let i = n; i >= 1; i--) {
      const f = falls[i];
      const stn = st[f.side].find((x) => x.tDown === f.t);
      pel.push({ t: f.t + 0.45 * Math.min(0.3, stn.tUp - f.t), v: line(f.cum - 0.03 * s, (f.side === plantSide ? 1 : -1) * 0.02 * s) });
    }
    pel.push({ t: tPlant, v: line(0.44 * s) });
    const Pc = P(inside ? 0.15 : 0.12, -0.22);
    pel.push({ t: 0, v: Pc });
    pel.push({ t: 0.15, v: P(0.1, hop ? 0.16 : 0.0) });
    pel.push({ t: tLand, v: hop ? P(0.06, 0.55 + 0.4 * power) : P(0.08, 0.28) });
    pel.push({ t: tHand, v: hop ? P(0.1, 1.12 + 0.48 * power) : P(0.1, 0.72) });
    pel.sort((a, b) => a.t - b.t);

    // pelvis height offsets (metres, before the reach limit)
    const hy = [{ t: t0, v: [0] }, { t: t0 + 0.22, v: [-0.035 * s] }];
    for (let i = n; i >= 1; i--) {
      const f = falls[i];
      hy.push({ t: f.t + 0.07, v: [-0.07 * s] });
      const nxt = falls[i - 1];
      if (i > 1) hy.push({ t: (f.t + nxt.t) / 2 + 0.07, v: [-0.03 * s] });
    }
    hy.push({ t: tPlant - 0.12, v: [-0.015 * s] });
    hy.push({ t: tPlant + 0.04, v: [-0.1 * s] });
    hy.push({ t: 0, v: [-0.06 * s] });
    if (hop) {
      hy.push({ t: 0.25, v: [0.045 * hop * s] });
      hy.push({ t: tLand + 0.06, v: [-0.1 * s] });
    } else {
      hy.push({ t: 0.25, v: [-0.04 * s] });
    }
    hy.push({ t: tHand, v: [-0.05 * s] });
    hy.sort((a, b) => a.t - b.t);

    // body angles: [heading offset from the shot line (towards the kicking side), lean, roll, pelvis twist]
    const th = wrapAngle(yawA - yawF) * -m;
    const loft = clamp((target.y - 1.2) / 1.6, -0.5, 1);
    const ang = [
      { t: t0, v: [th, 0.02, 0, 0] },
      { t: t0 + 0.35, v: [th, 0.2, 0, 0] },
      { t: tPlant - 0.2, v: [th, 0.16, 0, 0] },
      { t: tPlant + 0.02, v: [th * 0.8 + 0.12, -0.14, 0.1, 0.22] },
      { t: 0, v: [th * 0.3 + 0.05, 0.02 - 0.1 * loft, 0.15 + 0.1 * Math.abs(curve), -0.05] },
      { t: 0.17, v: [-0.3, 0.14, 0.06, -0.25] },
      { t: tLand, v: [-0.12, 0.2, 0, -0.05] },
      { t: tHand, v: [0, 0.1, 0, 0] },
    ];

    const plan = { t0, tPlant, tLand, tHand, st, pel, hy, ang, fx, fz, lx, lz, yawF, yawA, plantSide, kickSide, power, curve, hop, inside, n };

    // kicking foot: toe-off, heel to the backside, knee through, instep on the ball, follow through, landing
    const R = F.ballR;
    const body = (tt, back, lat, y) => {
      const p = sampleTrack(pel, tt, [0, 0]);
      const a = sampleTrack(ang, tt, [0, 0, 0, 0])[0];
      const dx = Math.cos(a) * fx - Math.sin(a) * lx;
      const dz = Math.cos(a) * fz - Math.sin(a) * lz;
      return [p[0] - dx * back * s - lx * lat * s, y * s, p[1] - dz * back * s - lz * lat * s];
    };
    const off = { ...kickSt };
    const a0 = ankleOf(new THREE.Vector3(), off.x, off.z, off.yaw, 0.9, s);
    const yawOut = yawF - m * (inside ? 1.0 : 0.3);
    const cPitch = inside ? 0.12 : 0.62;
    const cBack = inside ? R + 0.05 * s : R + 0.1 * s;
    const cY = inside ? 0.105 * s : 0.155 * s;
    const contact = [B.x - fx * cBack + lx * (inside ? 0.0 : -0.012) * s, cY, B.z - fz * cBack + lz * (inside ? 0.0 : -0.012) * s];
    const sw = 0.55 + 0.45 * power;
    const ft = [
      { t: kickSt.tUp, v: [a0.x, a0.y, a0.z, 0.9, yawA] },
      { t: -0.115, v: [...body(-0.115, 0.3 + 0.2 * sw, 0.13, 0.42 + 0.22 * sw), 1.0, lerp(yawA, yawF, 0.3)] },
      { t: -0.045, v: [...body(-0.045, 0.24, 0.1, 0.26), 0.9, lerp(yawA, yawOut, 0.7)] },
      { t: 0, v: [...contact, cPitch, yawOut] },
      { t: 0.06, v: [contact[0] + fx * 0.42 * sw * s + lx * 0.03 * s, cY + (0.14 + 0.16 * sw) * s, contact[2] + fz * 0.42 * sw * s + lz * 0.03 * s, cPitch, yawOut] },
      { t: 0.16, v: [...body(0.16, -(0.42 + 0.26 * sw), -0.02, 0.36 + 0.42 * sw * sw), 0.45, lerp(yawOut, yawF, 0.6)] },
      { t: tLand - 0.07, v: [...body(tLand - 0.07, -0.34, 0.07, 0.26 + 0.08 * sw), 0.25, yawF] },
      { t: tLand, v: [GK2[0], HIP_HEIGHT * 0 + 0.085 * s, GK2[1], -0.1, yawF] },
    ];
    // unwrap yaw so it never spins the long way round
    for (let i = 1; i < ft.length; i++) ft[i].v[4] = ft[i - 1].v[4] + wrapAngle(ft[i].v[4] - ft[i - 1].v[4]);
    plan.kickTrack = ft;
    return plan;
  }

  // Evaluate one foot of the scripted run-up.
  _foot(side, t, out) {
    const p = this.plan;
    const s = this.s;
    const list = p.st[side];
    let i = 0;
    while (i < list.length - 1 && list[i + 1].tDown <= t) i++;
    const cur = list[i];
    const next = list[i + 1];
    if (t <= cur.tUp || !next) {
      const since = t - cur.tDown;
      const toGo = cur.tUp - t;
      let pitch = since < 0.07 ? lerp(cur.landPitch, 0, since / 0.07) : 0;
      if (toGo < cur.heelT) pitch = lerp(pitch, cur.offPitch, smooth(0, 1, 1 - toGo / cur.heelT));
      out.x = cur.x;
      out.z = cur.z;
      out.yaw = cur.yaw;
      out.pitch = pitch;
      out.planted = true;
      ankleOf(out.ankle, cur.x, cur.z, cur.yaw, pitch, s);
    } else if (cur.custom) {
      const v = sampleTrack(p.kickTrack, t, this._kv || (this._kv = [0, 0, 0, 0, 0]));
      out.ankle.set(v[0], Math.max(0.07 * s, v[1]), v[2]);
      out.pitch = v[3];
      out.yaw = v[4];
      out.x = v[0];
      out.z = v[2];
      out.planted = false;
    } else {
      const k = (t - cur.tUp) / (next.tDown - cur.tUp);
      const sh = swingShape(k, next.run, cur.offPitch, next.landPitch);
      out.x = lerp(cur.x, next.x, sh.e);
      out.z = lerp(cur.z, next.z, sh.e);
      out.yaw = cur.yaw + wrapAngle(next.yaw - cur.yaw) * sh.e;
      out.pitch = sh.pitch;
      out.planted = false;
      ankleOf(out.ankle, out.x, out.z, out.yaw, sh.pitch, s, sh.lift * s);
    }
    return out;
  }

  update(dt, ball) {
    const h = this.h;
    if (!h) return;
    this.idleT += dt;
    this.justStruck = false;
    if (this.mode === 'run') this._updateRun(dt, ball);
    else this._updateFree(dt, ball);
    h.updateCloth(dt);
  }

  _updateRun(dt, ball) {
    const h = this.h;
    const p = this.plan;
    const s = this.s;
    const m = this.m;
    let t = this.t + dt;
    if (!this.struck && t >= 0) {
      // land exactly on the contact frame so the boot is on the ball when it leaves
      t = 0;
      this.struck = true;
      this.justStruck = true;
    }
    this.t = t;
    const pel = sampleTrack(p.pel, t, this._pv || (this._pv = [0, 0]));
    const a = sampleTrack(p.ang, t, this._av || (this._av = [0, 0, 0, 0]));
    const dy = sampleTrack(p.hy, t, this._hv || (this._hv = [0]))[0];
    const dx = Math.cos(a[0]) * p.fx - Math.sin(a[0]) * p.lx;
    const dz = Math.cos(a[0]) * p.fz - Math.sin(a[0]) * p.lz;
    const yaw = Math.atan2(dx, dz);
    const fL = this._foot(1, t, this._fl || (this._fl = { ankle: new THREE.Vector3() }));
    const fR = this._foot(-1, t, this._fr || (this._fr = { ankle: new THREE.Vector3() }));

    // upper body: arm swing from the stride, blending into the strike shapes
    const fwdL = (fL.x - fR.x) * dx + (fL.z - fR.z) * dz;
    const w = clamp(fwdL / (0.75 * s), -1, 1);
    const amp = smooth(p.t0, p.t0 + 0.5, t) * (1 - smooth(p.tLand, p.tHand + 0.1, t) * 0.4);
    makePose(runSpec(w, amp, a[1]), this.tmp);
    const kw = smooth(-0.36, -0.2, t) * (1 - smooth(0.4, p.tHand, t));
    if (kw > 0) blendPose(this.tmp, sampleClip(this.clips[m], t, this.tmp2), kw, this.tmp);
    if (this.mood && t > 0.5) this._moodPose(this.tmp, smooth(0.5, 0.9, t));
    setHips(this.tmp, a[1], a[3] * -m - 0.08 * w * amp, a[2] * -m);
    h.applyPose(this.tmp);

    const o = h.object;
    o.position.set(pel[0], 0, pel[1]);
    o.rotation.set(0, yaw, 0);
    let y = HIP_HEIGHT * s + dy;
    if (fL.planted) y = Math.min(y, reachLimit(fL.ankle.x, fL.ankle.y, fL.ankle.z, pel[0], pel[1], yaw, 1, s));
    if (fR.planted) y = Math.min(y, reachLimit(fR.ankle.x, fR.ankle.y, fR.ankle.z, pel[0], pel[1], yaw, -1, s));
    h.bones[0].position.y = y / s;
    h.aimLeg(1, fL.ankle, { pitch: fL.pitch, yaw: fL.yaw + 0.08 });
    h.aimLeg(-1, fR.ankle, { pitch: fR.pitch, yaw: fR.yaw - 0.08 });
    // eyes on the ball through the strike, then up to follow it
    _look.copy(t < 0.12 || !ball ? this.ball : ball);
    h.lookAt(_look, t < 0.12 ? 0.85 : 0.7);

    if (t >= p.tHand) {
      // hand over to free locomotion with the momentum he has left
      const p2 = sampleTrack(p.pel, t - 0.03, [0, 0]);
      const vx = (pel[0] - p2[0]) / 0.03;
      const vz = (pel[1] - p2[1]) / 0.03;
      this.gait.adopt(pel[0], pel[1], yaw, vx, vz, { 1: fL, [-1]: fR });
      this.vel.set(vx, vz);
      this.heading = yaw;
      this.mode = 'free';
      this.freeT = 0;
    }
  }

  _moodPose(pose, k) {
    const P = this.poses;
    const mt = this.moodT;
    if (this.mood === 'cheer') {
      // fist pump first, then arms thrown wide on the run
      const pump = 0.5 + 0.5 * Math.sin(mt * 11);
      blendPose(pose, P.FIST, k * (1 - smooth(0.55, 0.9, mt)) * (0.75 + 0.25 * pump), pose);
      blendPose(pose, P.ARMS_WIDE, k * smooth(0.6, 1.0, mt) * (1 - smooth(2.6, 3.2, mt)), pose);
      blendPose(pose, P.ARMS_UP, k * smooth(2.7, 3.3, mt), pose);
    } else if (this.mood === 'despair') {
      blendPose(pose, P.DESPAIR, k * smooth(0.0, 0.45, mt) * (1 - smooth(1.5, 2.2, mt)), pose);
      blendPose(pose, P.SLUMP, k * smooth(1.6, 2.3, mt), pose);
    }
  }

  _updateFree(dt, ball) {
    const h = this.h;
    const g = this.gait;
    const s = this.s;
    const P = this.poses;
    let x = g.pos.x;
    let z = g.pos.y;
    let yaw = this.heading;
    let lookW = 0.6;
    _look.copy(ball || this.ball);

    if (this.mode === 'idle') {
      if (this.walking) {
        // back off to the mark, still facing the ball
        const dx = this.mark.x - x;
        const dz = this.mark.y - z;
        const d = Math.hypot(dx, dz);
        const sp = Math.min(1.35, 0.4 + d * 2.2);
        if (d < 0.06) {
          this.walking = false;
          this.vel.set(0, 0);
          if (this.pendingRun && !g.moving) this._beginRun();
        } else {
          this.vel.set((dx / d) * sp, (dz / d) * sp);
        }
      } else {
        this.vel.set(0, 0);
        if (this.pendingRun && !g.moving) {
          this._beginRun();
          this._updateRun(0, ball);
          return;
        }
      }
      x += this.vel.x * dt;
      z += this.vel.y * dt;
      yaw += wrapAngle(Math.atan2(this.ball.x - x, this.ball.z - z) - yaw) * Math.min(1, dt * 4);
      // shift the weight from foot to foot while waiting
      const sway = this.walking ? 0 : Math.sin(this.idleT * 0.7) * 0.022 * s;
      g.update(dt, x, z, yaw);
      blendPose(this.idlePose, P.STAND, this.walking ? 1 : 0, this.tmp);
      const br = Math.sin(this.idleT * 1.9);
      setHips(this.tmp, 0.02, 0, Math.sin(this.idleT * 0.7) * 0.03);
      h.applyPose(this.tmp);
      h.bone('chest').rotateX(br * 0.012);
      g.apply();
      h.object.position.x += Math.cos(yaw) * sway;
      h.object.position.z -= Math.sin(yaw) * sway;
      h.aimLeg(1, g.feet[1].ankle, { pitch: g.feet[1].pitch, yaw: g.feet[1].yaw + 0.1 });
      h.aimLeg(-1, g.feet[-1].ankle, { pitch: g.feet[-1].pitch, yaw: g.feet[-1].yaw - 0.1 });
      // glance between the ball and the goal
      const gl = Math.sin(this.idleT * 0.55 + 1) > 0.25;
      if (gl) _look.set(0, 1.2, 0);
      h.lookAt(_look, 0.75);
      this.heading = yaw;
      return;
    }

    // after the strike
    this.freeT += dt;
    if (this.mood) this.moodT += dt;
    let speed = this.vel.length();
    let dirx = speed > 0.01 ? this.vel.x / speed : Math.sin(yaw);
    let dirz = speed > 0.01 ? this.vel.y / speed : Math.cos(yaw);
    let want = 0;
    let wantYaw = Math.atan2(_look.x - x, _look.z - z);
    let turn = 3;
    if (this.mood === 'cheer') {
      // wheel away towards the corner, slow down in front of the stand
      const mt = this.moodT;
      if (!this.cheerTo) {
        const sx = x >= 0 ? 1 : -1;
        this.cheerTo = new THREE.Vector2(sx * (12 + Math.abs(x) * 0.3), 4.5);
      }
      const tx = this.cheerTo.x - x;
      const tz = this.cheerTo.y - z;
      const d = Math.hypot(tx, tz);
      want = d < 0.4 ? 0 : Math.min(5.6, 1.5 + d * 1.6) * smooth(0.15, 0.7, mt);
      if (mt > 3.4) want = Math.min(want, 1.2);
      const k = 1 - Math.exp(-3.2 * dt);
      dirx += (tx / (d || 1) - dirx) * k;
      dirz += (tz / (d || 1) - dirz) * k;
      const dl = Math.hypot(dirx, dirz) || 1;
      dirx /= dl;
      dirz /= dl;
      wantYaw = speed > 0.8 ? Math.atan2(dirx, dirz) : Math.atan2(-x * 0.2, -1);
      turn = 6;
      lookW = 0;
    } else if (this.mood === 'despair') {
      const mt = this.moodT;
      // stops, then trudges back up the pitch
      want = mt > 2.2 ? 1.15 : 0;
      if (mt > 2.0) {
        const k = 1 - Math.exp(-2.5 * dt);
        dirx += (0 - dirx) * k;
        dirz += (1 - dirz) * k;
        const dl = Math.hypot(dirx, dirz) || 1;
        dirx /= dl;
        dirz /= dl;
        wantYaw = Math.atan2(dirx, dirz);
        lookW = 0;
      }
    } else {
      want = 0;
    }
    const acc = want > speed ? 7 : 5.5;
    speed += clamp(want - speed, -acc * dt, acc * dt);
    this.vel.set(dirx * speed, dirz * speed);
    x += this.vel.x * dt;
    z += this.vel.y * dt;
    yaw += wrapAngle(wantYaw - yaw) * Math.min(1, dt * turn);
    this.heading = yaw;
    g.update(dt, x, z, yaw);
    const run = smooth(0.3, 3, g.speed);
    makePose(runSpec(g.swing, run, 0.05 + 0.1 * smooth(2, 5, g.speed)), this.tmp);
    blendPose(this.tmp, P.STAND, 1 - run, this.tmp);
    if (this.mood) this._moodPose(this.tmp, 1);
    const lean = 0.04 + 0.12 * smooth(1.5, 5, g.speed);
    setHips(this.tmp, lean, -0.07 * g.swing * run, 0);
    h.applyPose(this.tmp);
    g.apply();
    if (lookW > 0) h.lookAt(_look, lookW);
  }
}

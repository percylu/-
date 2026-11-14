import * as THREE from 'three';
import { F } from '../config.js';
import { Humanoid, KITS, BONES, makePose, blendPose, POSE_SIZE, HIP_HEIGHT } from './humanoid.js';
import { KEEPER_LOOK } from './looks.js';
import { Gait } from './gait.js';
import { predictAtGoal } from '../physics/ball.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mirrorSpec(s) {
  const m = { ...s };
  const flipDir = (d) => [-d[0], d[1], d[2]];
  const flipEul = (e) => [e[0], -e[1], -e[2]];
  const swap = (a, b, f = (x) => x) => {
    const A = s[a];
    const Bv = s[b];
    if (Bv !== undefined) m[a] = f(Bv);
    else delete m[a];
    if (A !== undefined) m[b] = f(A);
    else delete m[b];
  };
  swap('armL', 'armR', flipDir);
  swap('legL', 'legR', flipDir);
  swap('elbowL', 'elbowR');
  swap('kneeL', 'kneeR');
  swap('footL', 'footR');
  swap('twistL', 'twistR', (x) => -x);
  swap('legTwistL', 'legTwistR', (x) => -x);
  swap('handL', 'handR', flipEul);
  for (const k of ['rot', 'spine', 'chest', 'neck', 'head']) if (s[k]) m[k] = flipEul(s[k]);
  if (s.pos) m.pos = [-s.pos[0], s.pos[1], s.pos[2]];
  return m;
}

const TALL = {
  pos: [0, -0.02, 0],
  spine: [0.04, 0, 0],
  chest: [-0.04, 0, 0],
  head: [-0.05, 0, 0],
  armL: [0.92, 0.3, 0.12],
  armR: [-0.92, 0.3, 0.12],
  elbowL: 0.3,
  elbowR: 0.3,
};
const READY = {
  pos: [0, -0.09, 0],
  spine: [0.22, 0, 0],
  chest: [0.12, 0, 0],
  head: [-0.28, 0, 0],
  armL: [0.62, -0.62, 0.42],
  armR: [-0.62, -0.62, 0.42],
  elbowL: 0.75,
  elbowR: 0.75,
};
const SET = {
  ...READY,
  pos: [0, -0.16, 0],
  spine: [0.3, 0, 0],
  armL: [0.75, -0.5, 0.4],
  armR: [-0.75, -0.5, 0.4],
};
// Dive towards the keeper's left (+x in model space). Arms are driven by IK once the ball is on its way.
const LOAD_L = {
  pos: [0, -0.29, 0],
  spine: [0.34, 0, -0.14],
  chest: [0.12, 0, -0.1],
  head: [-0.25, 0, 0.1],
  armL: [0.5, -0.75, 0.3],
  armR: [-0.3, -0.8, 0.4],
  elbowL: 0.7,
  elbowR: 0.9,
};
const PUSH_L = {
  spine: [0.1, 0, -0.2],
  chest: [0.02, 0, -0.15],
  head: [-0.1, 0, -0.2],
  armL: [0.7, 0.5, 0.25],
  armR: [0.05, 0.8, 0.35],
  elbowL: 0.3,
  elbowR: 0.5,
  legL: [0.0, -1, -0.1],
  kneeL: 0.15,
  footL: 0.75,
  legR: [-0.1, -0.75, 0.6],
  kneeR: 1.35,
  footR: 0.4,
};
const FLY_L = {
  spine: [0.05, 0, -0.16],
  chest: [0.0, 0, -0.12],
  head: [-0.1, 0, -0.2],
  armL: [0.5, 0.85, 0.15],
  armR: [0.1, 0.95, 0.2],
  elbowL: 0.15,
  elbowR: 0.3,
  legL: [0.1, -1, -0.12],
  legR: [-0.05, -0.8, 0.55],
  kneeL: 0.2,
  kneeR: 1.15,
  footL: 0.6,
  footR: 0.3,
};
const LAND_L = {
  spine: [0.12, 0, -0.05],
  chest: [0.05, 0, 0],
  head: [0.0, 0, -0.3],
  armL: [0.45, 0.85, 0.25],
  armR: [0.25, 0.6, 0.7],
  elbowL: 0.35,
  elbowR: 0.9,
  legL: [0.05, -1, 0.15],
  legR: [-0.05, -0.8, 0.55],
  kneeL: 0.55,
  kneeR: 1.0,
  footL: 0.5,
  footR: 0.3,
};
const CURL_L = {
  spine: [0.35, 0, -0.05],
  chest: [0.25, 0, 0],
  head: [0.3, 0, -0.15],
  legL: [0.05, -0.8, 0.6],
  legR: [-0.05, -0.7, 0.75],
  kneeL: 1.2,
  kneeR: 1.3,
  footL: 0.4,
  footR: 0.4,
};
const SIDESIT_L = {
  spine: [0.2, 0, 0.25],
  chest: [0.1, 0, 0.2],
  head: [-0.05, 0, 0.3],
  armL: [0.6, -0.7, 0.1],
  elbowL: 0.2,
  armR: [-0.3, -0.7, 0.5],
  elbowR: 0.8,
  legL: [-0.55, -0.58, 0.6],
  kneeL: 1.6,
  legR: [-0.42, 0.0, 0.85],
  kneeR: 1.7,
  footL: 0.5,
};
const KNEEL_L = {
  spine: [0.3, 0, 0],
  chest: [0.12, 0, 0],
  head: [-0.2, 0, 0],
  armL: [0.25, -0.9, 0.3],
  elbowL: 0.5,
  armR: [-0.2, -0.6, 0.75],
  elbowR: 0.6,
  legL: [0.05, -1, 0.05],
  kneeL: 1.75,
  footL: 0.9,
  legR: [-0.12, -0.12, 1],
  kneeR: 1.5,
};
const STAND_SAVE = {
  pos: [0, -0.04, 0],
  spine: [0.1, 0, 0],
  chest: [0.05, 0, 0],
  head: [-0.1, 0, 0],
};
const CROUCH_SAVE = {
  pos: [0, -0.36, 0],
  spine: [0.55, 0, 0],
  chest: [0.3, 0, 0],
  head: [-0.5, 0, 0],
};
const HOLD_STAND = {
  pos: [0, -0.02, 0],
  spine: [0.06, 0, 0],
  chest: [0.02, 0, 0],
  head: [0.05, 0, 0],
};
const DEJECTED = {
  pos: [0, -0.02, 0],
  spine: [0.14, 0, 0],
  chest: [0.06, 0, 0],
  head: [0.38, 0, 0],
  armL: [0.62, -0.75, -0.18],
  armR: [-0.62, -0.75, -0.18],
  elbowL: 1.75,
  elbowR: 1.75,
  twistL: 0.9,
  twistR: -0.9,
};

const SEGS = [
  ['hips', 'chest', 0.17, 'torso', 0.22],
  ['chest', 'neck', 0.16, 'torso', 0.22],
  ['head', 'crown', 0.11, 'head', 0.45],
  ['uArmL', 'lArmL', 0.055, 'arm', 0.3],
  ['lArmL', 'handL', 0.05, 'arm', 0.3],
  ['handL', 'tipL', 0.105, 'hand', 0.32],
  ['uArmR', 'lArmR', 0.055, 'arm', 0.3],
  ['lArmR', 'handR', 0.05, 'arm', 0.3],
  ['handR', 'tipR', 0.105, 'hand', 0.32],
  ['thighL', 'shinL', 0.085, 'leg', 0.35],
  ['shinL', 'footL', 0.06, 'leg', 0.4],
  ['footL', 'toeL', 0.055, 'foot', 0.5],
  ['thighR', 'shinR', 0.085, 'leg', 0.35],
  ['shinR', 'footR', 0.06, 'leg', 0.4],
  ['footR', 'toeR', 0.055, 'foot', 0.5],
];

export function makeBodyColliders(owner, handScale = 1) {
  const list = SEGS.map(([a, b, r, part, e]) => ({
    ja: a,
    jb: b,
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    r: part === 'hand' ? r * handScale : r,
    e,
    mu: 0.45,
    vel: new THREE.Vector3(),
    prev: new THREE.Vector3(),
    fresh: true,
    owner,
    part,
    enabled: true,
  }));
  const mid = new THREE.Vector3();
  return {
    list,
    update(h, dt) {
      const j = h.updateJoints();
      for (const c of list) {
        c.a.copy(j[c.ja]);
        c.b.copy(j[c.jb]);
        mid.addVectors(c.a, c.b).multiplyScalar(0.5);
        if (c.fresh || dt <= 0) c.vel.set(0, 0, 0);
        else c.vel.subVectors(mid, c.prev).multiplyScalar(1 / dt).clampLength(0, 12);
        c.prev.copy(mid);
        c.fresh = false;
      }
    },
    reset() {
      for (const c of list) c.fresh = true;
    },
  };
}

const POSE_Y = BONES.length * 4 + 1;
const _roll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

export class Keeper {
  constructor(rng) {
    this.rng = rng;
    this.h = new Humanoid({ ...KITS.keeper, ...KEEPER_LOOK });
    this.object = this.h.object;
    this.gait = new Gait(this.h, { width: 0.2 });
    this.z = 0.22;
    const P = (s) => makePose(s);
    const set = (m) => ({
      load: P(m(LOAD_L)),
      push: P(m(PUSH_L)),
      fly: P(m(FLY_L)),
      land: P(m(LAND_L)),
      curl: P(m(CURL_L)),
      sidesit: P(m(SIDESIT_L)),
      kneel: P(m(KNEEL_L)),
    });
    this.poses = {
      tall: P(TALL),
      ready: P(READY),
      set: P(SET),
      stand: P(STAND_SAVE),
      crouch: P(CROUCH_SAVE),
      hold: P(HOLD_STAND),
      dejected: P(DEJECTED),
      1: set((x) => x),
      [-1]: set(mirrorSpec),
    };
    this.tmp = new Float32Array(POSE_SIZE);
    this.tmp2 = new Float32Array(POSE_SIZE);
    this.col = makeBodyColliders('keeper', 1.15);
    this.H = new THREE.Vector3();
    this.Heff = new THREE.Vector3();
    this.holdOffset = new THREE.Vector3();
    this.look = new THREE.Vector3(0, 1, 11);
    this.reset(0);
  }

  reset(x0 = 0, style = {}) {
    this.x0 = x0;
    this.t = 0;
    this.plan = null;
    this.holding = false;
    this.tension = 0;
    this.result = null;
    this.resultT = 0;
    this.tc = null;
    this.idleT = (style.phase || 0) * 9;
    this.wander = style.wander === undefined ? 0.22 : style.wander;
    this.landT = null;
    this.lie = null;
    this.upReset = false;
    this.gait.crouch = 0.09;
    this.gait.reset(x0, this.z, 0, 0.2);
    this.object.position.set(x0, 0, this.z);
    this.object.rotation.set(0, 0, 0);
    this.col.reset();
    this.h.resetCloth();
    this.update(0, null);
  }

  // Called at the moment of the kick.
  onKick(shot, diff, isPenalty) {
    const rnd = this.rng;
    this.x0 = this.gait.pos.x;
    this.tc = null;
    const goalPred = predictAtGoal(shot.p0, shot.v0, shot.w0);
    // intercept where the hands actually are, slightly in front of the line
    const pred = predictAtGoal(shot.p0, shot.v0, shot.w0, this.z + 0.12);
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
    let tx = pred.x;
    let ty = clamp(pred.y, 0.1, 3.2);
    let delay;
    const onTarget = goalPred.reached && Math.abs(goalPred.x) < F.goalHalfW + 0.9 && goalPred.y < F.goalH + 0.8;
    let mode = 'react';
    if (isPenalty) {
      const guess = rnd() < 0.38;
      if (guess) {
        mode = 'guess';
        delay = 0.02 + rnd() * 0.05;
        const central = Math.abs(pred.x) < 0.75;
        const right = rnd() < diff.guessRight;
        if (central) {
          // a committed keeper leaves the middle open most of the time
          if (rnd() < 0.3 + (diff.guessRight - 0.5) * 0.6) {
            tx = pred.x + gauss() * 0.25;
          } else {
            tx = (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 1.2);
            ty = 0.4 + rnd() * 1.2;
          }
        } else if (right) {
          tx = pred.x + gauss() * diff.noise;
          ty = clamp(pred.y + gauss() * diff.noise * 0.8, 0.15, 2.5);
        } else {
          tx = -Math.sign(pred.x) * (1.4 + rnd() * 1.6);
          ty = 0.3 + rnd() * 1.5;
        }
      } else {
        delay = diff.react + 0.06 + rnd() * 0.12;
        tx = pred.x + gauss() * diff.noise * 0.35;
        ty = clamp(pred.y + gauss() * diff.noise * 0.3, 0.15, 2.6);
      }
    } else {
      // the wall hides the strike, so the keeper picks the ball up late
      delay = diff.react + 0.15 + rnd() * 0.08;
      const curveK = 1 + Math.min(1.2, Math.abs(shot.w0.y) / 50);
      tx = pred.x + gauss() * diff.noise * 0.45 * curveK;
      ty = clamp(pred.y + gauss() * diff.noise * 0.35, 0.15, 2.6);
    }
    if (!onTarget && mode === 'react') {
      // clearly off target: just watch it
      tx = this.x0 + clamp(pred.x - this.x0, -0.5, 0.5);
      ty = 1.2;
    }
    const tHit = Math.max(delay + 0.1, pred.reached ? pred.t : 1.2);
    const tau = tHit - delay;
    const x0 = this.x0;
    let d = tx - x0;
    const side = d >= 0 ? 1 : -1;
    const maxHip = isPenalty
      ? Math.min(2.7, diff.speed * Math.max(0, tau - 0.09)) * diff.reach
      : Math.min(2.25, diff.speed * 0.56 * Math.max(0, tau - 0.09)) * diff.reach;
    const kind = Math.abs(d) < 0.5 ? 'stand' : 'dive';
    const plan = { tStart: delay, tHit, kind, side, x0, mode, pred, onTarget };
    this.H.set(tx, clamp(ty, 0.12, 2.75), this.z + 0.12);
    if (kind === 'dive') {
      const D = Math.abs(d);
      let phi = lerp(0.5, 1.45, smooth(0.5, 2.4, D));
      if (ty < 0.6) phi += 0.22;
      if (ty > 1.8) phi -= 0.3;
      phi = clamp(phi, 0.35, 1.6);
      const arm = 1.2;
      let hipX = tx - side * arm * Math.sin(phi);
      let hipY = clamp(ty - arm * Math.cos(phi), 0.32, HIP_HEIGHT + 0.42);
      let travel = (hipX - x0) * side;
      if (travel < 0.1) travel = 0.1;
      if (travel > maxHip) travel = maxHip;
      hipX = x0 + side * travel;
      plan.phi = phi;
      plan.hipX = hipX;
      plan.hipY = hipY;
    } else {
      plan.hipX = x0 + d * 0.7;
      const jump = ty > 2.05 ? Math.min(0.5, ty - 2.0) : 0;
      plan.jump = jump;
      plan.crouch = smooth(1.0, 0.3, ty);
    }
    this.plan = plan;
    this.t = 0;
    return plan;
  }

  // Whether the gloves can kill the ball: clean contact near the hands and a shot that is not too hot.
  canCatch(part, ballSpeed, ballPos) {
    if (!this.plan || this.holding) return false;
    if (part !== 'hand' && part !== 'torso' && part !== 'arm') return false;
    const j = this.h.joints;
    _t1.copy(j.tipL).add(j.tipR).multiplyScalar(0.5);
    const off = ballPos ? _t1.distanceTo(ballPos) : 0.2;
    const r = this.rng();
    if (this.plan.kind === 'stand') {
      const p = part === 'torso' ? 0.9 - ballSpeed / 60 : 1.3 - ballSpeed / 38 - off * 0.6;
      return ballSpeed < 27 && r < Math.min(0.92, p);
    }
    const p = 1.25 - ballSpeed / 19 - off * 1.4;
    return ballSpeed < 18 && part !== 'torso' && r < Math.min(0.75, p);
  }

  startHold(ballPos) {
    this.holding = true;
    this.holdT = 0;
    const j = this.h.joints;
    _t1.copy(j.tipL).add(j.tipR).multiplyScalar(0.5);
    this.holdOffset.subVectors(ballPos, _t1);
    this.Heff.copy(ballPos);
    this.H.copy(ballPos);
  }

  setResult(kind) {
    if (this.result === kind) return;
    this.result = kind;
    this.resultT = 0;
  }

  _idle(dt, P) {
    const h = this.h;
    const g = this.gait;
    const s = h.scale;
    const tc = this.tc;
    this.idleT += dt;
    let x = this.x0 + Math.sin(this.idleT * 0.8) * this.wander * (1 - this.tension);
    let hop = 0.012 * Math.max(0, Math.sin(this.idleT * 5.2)) * (1 - this.tension);
    blendPose(P.ready, P.set, this.tension, this.tmp);
    if (tc !== null) {
      // makes himself big as the taker sets off, then drops into his set with a split step
      const big = smooth(-1.75, -1.45, tc) * (1 - smooth(-0.85, -0.5, tc));
      if (big > 0) blendPose(this.tmp, P.tall, big, this.tmp);
      hop = big * 0.05 * Math.abs(Math.sin(this.idleT * 8.5));
      if (tc > -0.32 && tc < -0.06) hop += 0.065 * Math.sin((Math.PI * (tc + 0.32)) / 0.26);
      x = lerp(x, g.pos.x, smooth(-1.2, -0.6, tc));
    }
    g.crouch = -this.tmp[POSE_Y];
    g.update(dt, x, this.z, 0);
    h.applyPose(this.tmp);
    g.apply(1, hop * s);
    h.lookAt(this.look, 0.7);
  }

  _stand(dt, P, plan) {
    const h = this.h;
    const g = this.gait;
    const t = this.t;
    const s = (t - plan.tStart) / (plan.tHit - plan.tStart);
    const sc = clamp(s, 0, 1);
    const after = Math.max(0, t - plan.tHit);
    if (t < plan.tStart) {
      blendPose(P.ready, P.set, 1, this.tmp);
    } else {
      const crouchPose = blendPose(P.stand, P.crouch, plan.crouch, this.tmp2);
      blendPose(P.set, crouchPose, smooth(0, 0.6, s), this.tmp);
    }
    let aimW = t < plan.tStart ? 0 : smooth(0.1, 0.7, s);
    let up = 0;
    if (plan.jump > 0 && t >= plan.tStart) {
      const tj = t - plan.tStart;
      const T = plan.tHit - plan.tStart;
      up = tj < T ? plan.jump * smooth(0.25, 1, tj / T) : Math.max(0, plan.jump - 4.9 * after * after);
    }
    if (this.holding) {
      blendPose(this.tmp, P.hold, smooth(0.25, 0.9, after), this.tmp);
    } else if (this.result === 'goal') {
      const k = smooth(0.45, 1.2, this.resultT);
      blendPose(this.tmp, P.dejected, k, this.tmp);
      aimW *= 1 - smooth(0.4, 0.9, this.resultT);
    } else if (after > 0.45) {
      const k = smooth(0.45, 1.1, after);
      blendPose(this.tmp, P.ready, k, this.tmp);
      aimW *= 1 - k;
    }
    const x = plan.x0 + (plan.hipX - plan.x0) * smooth(0, 1, sc);
    g.crouch = -this.tmp[POSE_Y];
    g.update(dt, x, this.z, 0);
    h.applyPose(this.tmp);
    g.apply(1, up);
    if (after > 0.5) h.lookAt(this.look, smooth(0.5, 1, after) * 0.7);
    return aimW;
  }

  _dive(dt, P, plan) {
    const h = this.h;
    const g = this.gait;
    const s = h.scale;
    const o = this.object;
    const t = this.t;
    const side = plan.side;
    const D = P[side];
    if (t < plan.tStart) {
      blendPose(P.ready, P.set, 1, this.tmp);
      g.crouch = -this.tmp[POSE_Y];
      g.update(dt, plan.x0, this.z, 0);
      h.applyPose(this.tmp);
      g.apply(1);
      return 0;
    }
    const T = plan.tHit - plan.tStart;
    const tTake = plan.tStart + T * 0.54;
    const xA = plan.x0 + (plan.hipX - plan.x0) * 0.24;
    const yA = (HIP_HEIGHT - 0.12) * s;
    const landY = 0.215 * s;
    let aimW;
    let phi;
    if (t < tTake) {
      // load the near leg: side step, sink, lean into the dive
      const u = (t - plan.tStart) / (tTake - plan.tStart);
      const x = plan.x0 + (xA - plan.x0) * u * u;
      blendPose(P.set, D.load, smooth(0, 0.6, u), this.tmp);
      blendPose(this.tmp, D.push, smooth(0.6, 1.05, u), this.tmp);
      g.crouch = lerp(0.2, 0.14, u) + 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.05));
      g.update(dt, x, this.z, 0);
      h.applyPose(this.tmp);
      phi = plan.phi * 0.3 * smooth(0.2, 1, u);
      h.bones[0].quaternion.premultiply(_roll.setFromAxisAngle(_zAxis, -side * phi));
      g.apply(1);
      this.takeY = g.hipY;
      return smooth(0.3, 1, u) * 0.6;
    }
    // airborne: the hips follow a ballistic arc through the save point, then hit the turf and slide
    const tau = t - tTake;
    const Df = Math.max(0.06, plan.tHit - tTake);
    const y0 = this.takeY || yA;
    const vx = (plan.hipX - xA) / Df;
    const vy = (plan.hipY - y0) / Df + 4.905 * Df;
    let x = xA + vx * tau;
    let y = y0 + vy * tau - 4.905 * tau * tau;
    if (this.landT === null && y <= landY && tau > 0.04) {
      this.landT = t;
      this.landX = x;
      this.landV = vx;
      this.landPhi = tau < Df ? lerp(plan.phi * 0.3, plan.phi, smooth(0, 1, tau / Df)) : lerp(plan.phi, 1.52, smooth(0, 0.35, tau - Df));
    }
    const kf = smooth(0, 0.55, tau / Df);
    blendPose(D.push, D.fly, kf, this.tmp);
    aimW = lerp(0.6, 1, smooth(0, 0.3, tau / Df));
    let ik = 1 - smooth(0, 0.1, tau);
    let handW = 0;
    if (this.landT === null) {
      phi = tau < Df ? lerp(plan.phi * 0.3, plan.phi, smooth(0, 1, tau / Df)) : lerp(plan.phi, 1.52, smooth(0, 0.35, tau - Df));
    } else {
      const tl = t - this.landT;
      x = this.landX + clamp(this.landV * 0.13, -0.5, 0.5) * (1 - Math.exp(-tl / 0.13));
      y = landY + 0.035 * s * Math.exp(-7 * tl) * Math.abs(Math.sin(13 * tl));
      phi = lerp(this.landPhi, 1.52, smooth(0, 0.14, tl));
      blendPose(this.tmp, this.holding ? D.curl : D.land, smooth(0, 0.24, tl), this.tmp);
      if (!this.holding) aimW *= 1 - smooth(0.08, 0.4, tl);
      if (this.lie === null && tl > 0.36) this.lie = this.result === 'goal' ? 1.0 : this.holding ? 0.75 : 0.42;
      const tg = this.lie === null ? -1 : tl - this.lie;
      if (tg > 0) {
        // prop up on the arm, get a knee under, stand
        const slow = this.result === 'goal' ? 1.3 : 1;
        const s1 = smooth(0, 0.5 * slow, tg);
        const s2 = smooth(0.5 * slow, 1.05 * slow, tg);
        const s3 = smooth(1.05 * slow, 1.7 * slow, tg);
        const final = this.result === 'goal' ? P.dejected : this.holding ? P.hold : P.ready;
        blendPose(this.tmp, D.sidesit, s1, this.tmp);
        blendPose(this.tmp, D.kneel, s2, this.tmp);
        blendPose(this.tmp, final, s3, this.tmp);
        phi = lerp(lerp(1.52, 0.75, s1), 0, s2);
        y = lerp(lerp(landY, 0.21 * s, s1), 0.53 * s, s2);
        handW = this.holding ? 0 : smooth(0.08, 0.4, tg) * (1 - smooth(0.8 * slow, 1.1 * slow, tg));
        if (s3 > 0) {
          if (!this.upReset) {
            this.upReset = true;
            g.reset(x + side * 0.05, this.z, 0, 0.14);
          }
          g.crouch = -final[POSE_Y];
          g.update(dt, g.pos.x, this.z, 0);
          y = lerp(y, g.hipY, s3);
          ik = s3;
        } else {
          ik = 0;
        }
        this.upK = s3;
      }
    }
    h.applyPose(this.tmp);
    o.position.set(x, 0, this.z);
    o.rotation.set(0, 0, 0);
    h.bones[0].position.y = y / s;
    h.bones[0].quaternion.premultiply(_roll.setFromAxisAngle(_zAxis, -side * phi));
    if (ik > 0) {
      for (const sd of [1, -1]) {
        const f = g.feet[sd];
        h.aimLeg(sd, f.ankle, { pitch: this.upReset ? f.pitch : 0.7, yaw: f.yaw + sd * 0.1, blend: ik });
      }
    }
    if (handW > 0) {
      _t1.set(x + side * 0.5 * s, 0.05, this.z + 0.1);
      h.aimArm(side, _t1, 0.08, handW, side * 0.2);
    }
    if (this.upK > 0.3) h.lookAt(this.look, smooth(0.3, 1, this.upK) * 0.7);
    return aimW;
  }

  // ball: BallSim (or null); look: point the keeper watches when he is not busy
  update(dt, ball) {
    const h = this.h;
    const P = this.poses;
    this.t += dt;
    const plan = this.plan;
    if (ball) this.look.copy(ball.p);
    let aimW = 0;
    this.upK = 0;
    if (!plan) this._idle(dt, P);
    else if (plan.kind === 'stand') aimW = this._stand(dt, P, plan);
    else aimW = this._dive(dt, P, plan);
    if (this.result) this.resultT += dt;

    if (plan && aimW > 0) {
      // late correction towards the real ball when it gets close
      this.Heff.copy(this.H);
      if (this.holding) {
        this.holdT += dt;
        const chest = h.updateJoints().chest;
        _t1.set(chest.x, Math.max(0.24, chest.y - 0.12), chest.z + 0.28);
        this.H.lerp(_t1, 1 - Math.exp(-3.5 * dt));
        this.Heff.copy(this.H);
      } else if (ball && ball.active && ball.v.z < -1 && !ball.touchedKeeper) {
        const tz = (ball.p.z - this.H.z) / -ball.v.z;
        if (tz > -0.02 && tz < 0.3) {
          const px = ball.p.x + ball.v.x * tz;
          const py = ball.p.y + ball.v.y * tz - 4.9 * tz * tz;
          const w = smooth(0.3, 0.06, tz);
          this.Heff.x += clamp(px - this.H.x, -0.3, 0.3) * w;
          this.Heff.y += clamp(py - this.H.y, -0.3, 0.3) * w;
        }
      }
      const side = plan.side;
      const two = plan.kind === 'stand' || this.holding;
      const lead = this.Heff;
      if (two) {
        h.aimArm(1, _t1.copy(lead).setX(lead.x + 0.1), 0.25, aimW, 0.3);
        h.aimArm(-1, _t2.copy(lead).setX(lead.x - 0.1), 0.25, aimW, -0.3);
      } else {
        h.aimArm(side, lead, 0.12, aimW, side * 0.4);
        _t2.set(lead.x - side * 0.16, lead.y + 0.1, lead.z);
        h.aimArm(-side, _t2, 0.3, aimW * 0.9, -side * 0.4);
      }
    }

    this.col.update(h, dt);
    if (this.holding && ball) {
      const j = h.joints;
      this.holdOffset.multiplyScalar(Math.exp(-9 * dt));
      ball.p.copy(j.tipL).add(j.tipR).multiplyScalar(0.5).add(this.holdOffset);
      ball.p.z += 0.06;
      ball.p.y = Math.max(F.ballR, ball.p.y);
      ball.v.set(0, 0, 0);
      ball.w.multiplyScalar(0.8);
    }
    h.updateCloth(dt);
  }
}

import * as THREE from 'three';
import { F } from '../config.js';
import { Humanoid, KITS, makePose, blendPose, POSE_SIZE, HIP_HEIGHT } from './humanoid.js';
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

const READY = {
  pos: [0, -0.1, 0],
  spine: [0.24, 0, 0],
  chest: [0.14, 0, 0],
  head: [-0.3, 0, 0],
  armL: [0.62, -0.62, 0.42],
  armR: [-0.62, -0.62, 0.42],
  elbowL: 0.75,
  elbowR: 0.75,
  legL: [0.24, -0.9, 0.3],
  legR: [-0.24, -0.9, 0.3],
  kneeL: 0.66,
  kneeR: 0.66,
  footL: -0.3,
  footR: -0.3,
};
const SET = {
  ...READY,
  pos: [0, -0.15, 0],
  spine: [0.3, 0, 0],
  armL: [0.75, -0.5, 0.4],
  armR: [-0.75, -0.5, 0.4],
  legL: [0.3, -0.86, 0.34],
  legR: [-0.3, -0.86, 0.34],
  kneeL: 0.82,
  kneeR: 0.82,
};
// Dive towards the keeper's left (+x in model space). Arms are driven by IK.
const DIVE_L = {
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
  ...DIVE_L,
  spine: [0.1, 0, -0.1],
  legL: [0.05, -1, 0.1],
  legR: [-0.05, -0.85, 0.5],
  kneeL: 0.5,
  kneeR: 0.9,
};
const STAND_SAVE = {
  pos: [0, -0.04, 0],
  spine: [0.1, 0, 0],
  chest: [0.05, 0, 0],
  head: [-0.1, 0, 0],
  legL: [0.14, -1, 0.1],
  legR: [-0.14, -1, 0.1],
  kneeL: 0.28,
  kneeR: 0.28,
  footL: -0.1,
  footR: -0.1,
};
const CROUCH_SAVE = {
  pos: [0, -0.34, 0],
  spine: [0.55, 0, 0],
  chest: [0.3, 0, 0],
  head: [-0.5, 0, 0],
  legL: [0.2, -0.72, 0.62],
  legR: [-0.2, -0.72, 0.62],
  kneeL: 1.5,
  kneeR: 1.5,
  footL: -0.5,
  footR: -0.5,
};
const DEJECTED = {
  spine: [0.15, 0, 0],
  head: [0.35, 0, 0],
  armL: [0.25, -1, 0.1],
  armR: [-0.25, -1, 0.1],
  elbowL: 1.9,
  elbowR: 1.9,
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

export class Keeper {
  constructor(rng) {
    this.rng = rng;
    this.h = new Humanoid(KITS.keeper, { scale: 1.03 });
    this.object = this.h.object;
    this.z = 0.22;
    this.poses = {
      ready: makePose(READY),
      set: makePose(SET),
      diveL: makePose(DIVE_L),
      diveR: makePose(mirrorSpec(DIVE_L)),
      landL: makePose(LAND_L),
      landR: makePose(mirrorSpec(LAND_L)),
      stand: makePose(STAND_SAVE),
      crouch: makePose(CROUCH_SAVE),
      dejected: makePose(DEJECTED),
    };
    this.tmp = new Float32Array(POSE_SIZE);
    this.tmp2 = new Float32Array(POSE_SIZE);
    this.col = makeBodyColliders('keeper', 1.15);
    this.H = new THREE.Vector3();
    this.Heff = new THREE.Vector3();
    this.holdOffset = new THREE.Vector3();
    this.reset(0);
  }

  reset(x0 = 0) {
    this.x0 = x0;
    this.t = 0;
    this.state = 'ready';
    this.plan = null;
    this.holding = false;
    this.tension = 0;
    this.result = null;
    this.resultT = 0;
    this.object.position.set(x0, 0, this.z);
    this.object.rotation.set(0, 0, 0);
    this.col.reset();
    this.update(0, null);
  }

  // Called at the moment of the kick.
  onKick(shot, diff, isPenalty) {
    const rnd = this.rng;
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
      const guess = rnd() < 0.62;
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
        delay = diff.react;
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
    this.state = 'plan';
    this.t = 0;
    return plan;
  }

  canCatch(part, ballSpeed) {
    if (!this.plan || this.holding) return false;
    if (part !== 'hand' && part !== 'torso' && part !== 'arm') return false;
    const r = this.rng();
    if (this.plan.kind === 'stand') return ballSpeed < 26 && r < 0.85;
    return ballSpeed < 17 && r < 0.5;
  }

  startHold(ballPos) {
    this.holding = true;
    this.holdT = 0;
    this.Heff.copy(ballPos);
    this.H.copy(ballPos);
  }

  setResult(kind) {
    if (this.result) return;
    this.result = kind;
    this.resultT = 0;
  }

  update(dt, ball) {
    const h = this.h;
    const P = this.poses;
    this.t += dt;
    const t = this.t;
    const plan = this.plan;
    const o = this.object;
    let aimW = 0;
    let rollZ = 0;
    let hipY = null;
    let ground = true;

    if (!plan) {
      // ready stance: light bounce, more coiled as the kick approaches
      const b = Math.sin(t * 5.2) * 0.012;
      blendPose(P.ready, P.set, this.tension, this.tmp);
      h.applyPose(this.tmp);
      o.position.set(this.x0 + Math.sin(t * 1.3) * 0.05 * (1 - this.tension), 0, this.z);
      h.groundFeet(Math.max(0, b));
    } else if (t < plan.tStart) {
      blendPose(P.ready, P.set, Math.max(this.tension, smooth(0, plan.tStart, t)), this.tmp);
      h.applyPose(this.tmp);
      h.groundFeet(0);
    } else {
      const s = (t - plan.tStart) / (plan.tHit - plan.tStart);
      const sc = Math.min(1, s);
      const f = sc < 0.3 ? (sc * sc) / (0.3 * 1.7) : (2 * sc - 0.3) / 1.7;
      const after = Math.max(0, t - plan.tHit);
      if (plan.kind === 'dive') {
        const side = plan.side;
        const dive = side > 0 ? P.diveL : P.diveR;
        const land = side > 0 ? P.landL : P.landR;
        blendPose(P.set, dive, smooth(0, 0.55, s), this.tmp);
        if (after > 0) blendPose(this.tmp, land, smooth(0.05, 0.5, after), this.tmp);
        h.applyPose(this.tmp);
        const slide = (plan.hipX - plan.x0) * 0.22 * (1 - Math.exp(-3.5 * after));
        o.position.x = plan.x0 + (plan.hipX - plan.x0) * f + slide;
        const yStart = h.bones[0].position.y;
        const dip = sc < 0.3 ? -0.1 * Math.sin((Math.PI * sc) / 0.3) : 0;
        let y = lerp(HIP_HEIGHT - 0.15, plan.hipY, smooth(0.05, 1, sc)) + dip;
        const landY = 0.27;
        let phi = plan.phi * smooth(0.02, 0.8, s);
        if (after > 0) {
          const vy = (plan.hipY - (HIP_HEIGHT - 0.15)) / (plan.tHit - plan.tStart) * 0.35;
          y = Math.max(landY, plan.hipY + vy * after - 4.9 * after * after);
          const grounded = smooth(plan.hipY, landY, y);
          phi = lerp(plan.phi, 1.52, Math.max(grounded, smooth(0, 0.5, after)));
        }
        void yStart;
        hipY = y;
        rollZ = -side * phi;
        ground = false;
        aimW = smooth(0.05, 0.6, s);
      } else {
        const crouchPose = blendPose(P.stand, P.crouch, plan.crouch, this.tmp2);
        blendPose(P.set, crouchPose, smooth(0, 0.6, s), this.tmp);
        h.applyPose(this.tmp);
        o.position.x = plan.x0 + (plan.hipX - plan.x0) * smooth(0, 1, sc);
        if (plan.jump > 0) {
          const tj = t - plan.tStart;
          const T = plan.tHit - plan.tStart;
          const up = tj < T ? plan.jump * smooth(0.25, 1, tj / T) : Math.max(0, plan.jump - 4.9 * after * after);
          ground = false;
          h.groundFeet(0);
          h.bones[0].position.y += up;
        }
        aimW = smooth(0.1, 0.7, s);
      }
      if (this.result === 'goal' && this.resultT > 0.5 && plan.kind === 'stand') {
        blendPose(this.tmp, P.dejected, smooth(0.5, 1.2, this.resultT), this.tmp);
        h.applyPose(this.tmp);
        aimW *= 1 - smooth(0.5, 1.0, this.resultT);
      }
    }
    if (this.result) this.resultT += dt;

    if (hipY !== null) {
      const hips = h.bones[0];
      hips.position.y = hipY / h.scale;
      // roll the whole body about the forward axis
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollZ);
      hips.quaternion.premultiply(q);
    } else if (ground && plan && this.t >= plan.tStart && !(plan.jump > 0)) {
      h.groundFeet(0);
    }

    if (plan && aimW > 0) {
      // late correction towards the real ball when it gets close
      this.Heff.copy(this.H);
      if (this.holding) {
        this.holdT += dt;
        const hips = h.updateJoints().chest;
        const cradle = new THREE.Vector3(hips.x, Math.max(0.35, hips.y - 0.1), hips.z + 0.3);
        this.H.lerp(cradle, 1 - Math.exp(-3 * dt));
        this.Heff.copy(this.H);
      } else if (ball && ball.active && ball.v.z < -1 && !ball.touchedKeeper) {
        const tz = (ball.p.z - this.H.z) / -ball.v.z;
        if (tz > -0.02 && tz < 0.3) {
          const px = ball.p.x + ball.v.x * tz;
          const py = ball.p.y + ball.v.y * tz - 4.9 * tz * tz;
          const w = smooth(0.3, 0.06, tz);
          const dx = clamp(px - this.H.x, -0.3, 0.3);
          const dy = clamp(py - this.H.y, -0.3, 0.3);
          this.Heff.x += dx * w;
          this.Heff.y += dy * w;
        }
      }
      const side = plan.side;
      const two = plan.kind === 'stand' || this.holding;
      const lead = this.Heff;
      const off = new THREE.Vector3(two ? 0.1 : 0.0, 0, 0);
      if (two) {
        h.aimArm(1, new THREE.Vector3().copy(lead).add(off), 0.25, aimW, 0.3);
        h.aimArm(-1, new THREE.Vector3().copy(lead).sub(off), 0.25, aimW, -0.3);
      } else {
        h.aimArm(side, lead, 0.12, aimW, side * 0.4);
        const second = new THREE.Vector3(lead.x - side * 0.16, lead.y + 0.1, lead.z);
        h.aimArm(-side, second, 0.3, aimW * 0.9, -side * 0.4);
      }
    }

    this.col.update(h, dt);
    if (this.holding && ball) {
      const j = h.joints;
      ball.p.copy(j.tipL).add(j.tipR).multiplyScalar(0.5);
      ball.p.z += 0.06;
      ball.p.y = Math.max(F.ballR, ball.p.y);
      ball.v.set(0, 0, 0);
      ball.w.multiplyScalar(0.8);
    }
  }
}

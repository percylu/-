import * as THREE from 'three';
import { Humanoid, KITS, makePose, blendPose, sampleClip, POSE_SIZE } from './humanoid.js';
import { makeBodyColliders, mirrorSpec } from './keeper.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Right-footed strike. Model space: facing +z, left side is +x.
const READY = {
  spine: [0.06, 0, 0],
  head: [0.12, 0, 0],
  armL: [0.2, -1, 0.05],
  armR: [-0.2, -1, 0.05],
  elbowL: 0.3,
  elbowR: 0.3,
  legL: [0.09, -1, 0.06],
  legR: [-0.09, -1, -0.04],
  kneeL: 0.1,
  kneeR: 0.12,
};
const STRIDE_L = {
  // left foot forward, right pushing off
  rot: [0.1, 0.08, 0],
  spine: [0.16, -0.1, 0],
  chest: [0.05, -0.12, 0],
  head: [0.05, 0.1, 0],
  armL: [0.2, -0.8, -0.5],
  armR: [-0.18, -0.72, 0.6],
  elbowL: 1.0,
  elbowR: 1.35,
  legL: [0.03, -0.86, 0.5],
  legR: [-0.03, -0.88, -0.46],
  kneeL: 0.4,
  kneeR: 1.0,
  footL: -0.25,
  footR: 0.6,
};
const STRIDE_R = mirrorSpec(STRIDE_L);
const PLANT = {
  rot: [-0.06, -0.38, 0.06],
  spine: [-0.04, 0.12, -0.08],
  chest: [-0.05, 0.2, -0.08],
  head: [0.3, 0.12, 0],
  armL: [0.82, -0.2, 0.32],
  armR: [-0.4, -0.78, -0.5],
  elbowL: 0.45,
  elbowR: 0.7,
  legL: [0.06, -0.93, 0.36],
  legR: [-0.1, -0.7, -0.7],
  kneeL: 0.3,
  kneeR: 1.85,
  footL: -0.2,
  footR: 0.9,
};
const CONTACT = {
  rot: [0.02, -0.05, 0.08],
  spine: [0.1, 0.05, -0.1],
  chest: [0.08, 0.1, -0.06],
  head: [0.4, 0, 0],
  armL: [0.85, -0.3, -0.05],
  armR: [-0.35, -0.85, 0.15],
  elbowL: 0.35,
  elbowR: 0.6,
  legL: [0.07, -1, 0.0],
  legR: [-0.1, -0.92, 0.36],
  kneeL: 0.32,
  kneeR: 0.3,
  footL: 0,
  footR: 0.85,
};
const FOLLOW = {
  pos: [0, 0.07, 0],
  rot: [-0.05, 0.35, 0.05],
  spine: [-0.06, 0.1, -0.05],
  chest: [-0.04, 0.12, 0],
  head: [0.1, -0.2, 0],
  armL: [0.6, -0.55, -0.55],
  armR: [-0.12, -0.6, 0.72],
  elbowL: 0.5,
  elbowR: 0.95,
  legL: [0.04, -1, -0.16],
  legR: [0.14, -0.38, 0.92],
  kneeL: 0.12,
  kneeR: 0.28,
  footL: 0.5,
  footR: 0.7,
};
const LAND = {
  rot: [0.06, 0.15, 0],
  spine: [0.14, 0, 0],
  armL: [0.3, -0.9, -0.2],
  armR: [-0.3, -0.9, 0.25],
  elbowL: 0.6,
  elbowR: 0.7,
  legL: [0.05, -0.88, -0.45],
  legR: [-0.05, -0.93, 0.34],
  kneeL: 0.85,
  kneeR: 0.5,
  footL: 0.5,
  footR: -0.2,
};
const WATCH = {
  spine: [0.02, 0, 0],
  head: [-0.05, 0, 0],
  armL: [0.18, -1, 0.04],
  armR: [-0.18, -1, 0.04],
  elbowL: 0.25,
  elbowR: 0.25,
  legL: [0.1, -1, 0.05],
  legR: [-0.1, -1, -0.05],
};
const CHEER = {
  pos: [0, 0.0, 0],
  spine: [-0.12, 0, 0],
  chest: [-0.1, 0, 0],
  head: [-0.25, 0, 0],
  armL: [0.45, 0.88, 0.08],
  armR: [-0.45, 0.88, 0.08],
  elbowL: 0.35,
  elbowR: 0.35,
  legL: [0.12, -1, 0.02],
  legR: [-0.12, -1, -0.02],
  kneeL: 0.15,
  kneeR: 0.15,
};
const CHEER2 = {
  ...CHEER,
  spine: [0.1, 0, 0],
  chest: [0.05, 0, 0],
  head: [-0.05, 0, 0],
  armL: [0.55, 0.2, 0.75],
  armR: [-0.55, 0.2, 0.75],
  elbowL: 1.7,
  elbowR: 1.7,
  legL: [0.14, -1, 0.3],
  legR: [-0.14, -1, 0.3],
  kneeL: 0.75,
  kneeR: 0.75,
  pos: [0, -0.1, 0],
};
const DESPAIR = {
  spine: [0.1, 0, 0],
  head: [0.35, 0, 0],
  armL: [0.5, 0.55, 0.35],
  armR: [-0.5, 0.55, 0.35],
  elbowL: 2.3,
  elbowR: 2.3,
  legL: [0.1, -1, 0.03],
  legR: [-0.1, -1, -0.03],
};

export const RUNUP_TIME = 0.88;

export class Kicker {
  constructor() {
    this.h = new Humanoid(KITS.home);
    this.object = this.h.object;
    const P = (s) => makePose(s);
    this.clip = [
      { t: -RUNUP_TIME, pose: P(READY) },
      { t: -0.64, pose: P(STRIDE_L) },
      { t: -0.4, pose: P(STRIDE_R) },
      { t: -0.13, pose: P(PLANT) },
      { t: 0, pose: P(CONTACT), ease: 'in' },
      { t: 0.17, pose: P(FOLLOW), ease: 'out' },
      { t: 0.5, pose: P(LAND) },
      { t: 1.05, pose: P(WATCH) },
    ];
    this.ready = P(READY);
    this.cheer = P(CHEER);
    this.cheer2 = P(CHEER2);
    this.despair = P(DESPAIR);
    this.watch = P(WATCH);
    this.tmp = new Float32Array(POSE_SIZE);
    this.start = new THREE.Vector3();
    this.contactPos = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, -1);
    this.t = -10;
    this.running = false;
    this.mood = null;
    this.moodT = 0;
    this.idleT = 0;
    this.col = makeBodyColliders('kicker');
  }

  // ball: Vector3, goalDir: unit vector from ball towards the target (xz).
  place(ball, goalDir) {
    const back = new THREE.Vector3(-goalDir.x, 0, -goalDir.z);
    const right = new THREE.Vector3(-goalDir.z, 0, goalDir.x); // forward x up
    const left = right.clone().negate();
    this.start.copy(ball).addScaledVector(back, 2.35).addScaledVector(left, 1.25);
    this.start.y = 0;
    // hips at contact: beside and slightly behind the ball
    this.contactPos.copy(ball).addScaledVector(left, 0.2).addScaledVector(back, 0.2);
    this.contactPos.y = 0;
    this.dir.subVectors(this.contactPos, this.start).normalize();
    // finish the run pointing a bit more towards the goal
    this.heading0 = Math.atan2(this.dir.x, this.dir.z);
    this.heading1 = Math.atan2(goalDir.x * 0.75 + this.dir.x * 0.25, goalDir.z * 0.75 + this.dir.z * 0.25);
    this.t = -10;
    this.running = false;
    this.mood = null;
    this.object.position.copy(this.start);
    this.object.rotation.set(0, this.heading0, 0);
    this.goalDir = goalDir.clone();
    this.update(0);
  }

  startRun() {
    this.t = -RUNUP_TIME;
    this.running = true;
  }

  setMood(mood) {
    this.mood = mood;
    this.moodT = 0;
  }

  update(dt) {
    const h = this.h;
    this.idleT += dt;
    if (this.running) this.t += dt;
    const t = this.t;
    if (!this.running) {
      h.applyPose(this.ready);
      const sway = Math.sin(this.idleT * 1.4) * 0.012;
      h.bone('spine').rotation.z += sway;
      h.bone('chest').rotation.x += Math.sin(this.idleT * 2.1) * 0.01;
      h.groundFeet(0);
      this.col.update(h, dt);
      return;
    }
    sampleClip(this.clip, t, this.tmp);
    let air = 0;
    let turn = 0;
    if (this.mood && t > 0.7) {
      this.moodT += dt;
      const k = smooth(0, 0.45, this.moodT);
      if (this.mood === 'cheer') {
        // crouch, leap with both arms up, land, repeat
        const bounce = Math.max(0, Math.sin(this.moodT * 4.6 - 0.4));
        blendPose(this.cheer2, this.cheer, smooth(0, 0.7, bounce), this.tmp);
        blendPose(sampleClip(this.clip, t, new Float32Array(POSE_SIZE)), this.tmp, k, this.tmp);
        air = bounce * 0.27 * k;
        turn = Math.sin(this.moodT * 1.9) * 0.32 * k;
      } else {
        blendPose(this.tmp, this.despair, k, this.tmp);
      }
    }
    h.applyPose(this.tmp);
    // root motion
    const o = this.object;
    const runK = Math.max(0, Math.min(1, (t + RUNUP_TIME) / RUNUP_TIME));
    // accelerate into the ball
    const travel = runK * runK * (1.4 - 0.4 * runK);
    o.position.lerpVectors(this.start, this.contactPos, travel);
    if (t > 0) {
      const d = 1.15 * (1 - Math.exp(-3.2 * t));
      o.position.addScaledVector(this.goalDir, d * 0.8).addScaledVector(this.dir, d * 0.2);
    }
    const hk = smooth(-0.3, 0.25, t);
    o.rotation.y = this.heading0 + (this.heading1 - this.heading0) * hk + turn;
    // vertical: bounce with the strides, hop on the follow through
    let hop = 0;
    if (t < -0.13) hop = Math.abs(Math.sin(((t + RUNUP_TIME) / 0.245) * Math.PI)) * 0.05;
    else if (t > 0.02 && t < 0.5) hop = Math.sin(((t - 0.02) / 0.48) * Math.PI) * 0.1;
    h.groundFeet(hop + air);
    this.col.update(h, dt);
  }
}

const WALL_STAND = {
  spine: [0.03, 0, 0],
  head: [-0.05, 0, 0],
  armL: [0.02, -1, 0.25],
  armR: [-0.02, -1, 0.25],
  elbowL: 0.55,
  elbowR: 0.55,
  twistL: -0.8,
  twistR: 0.8,
  legL: [0.05, -1, 0],
  legR: [-0.05, -1, 0],
  kneeL: 0.06,
  kneeR: 0.06,
};
const WALL_JUMP = {
  ...WALL_STAND,
  spine: [-0.05, 0, 0],
  head: [-0.2, 0, 0],
  legL: [0.04, -1, 0.02],
  legR: [-0.04, -1, 0.02],
  kneeL: 0.05,
  kneeR: 0.05,
  footL: 0.7,
  footR: 0.7,
};
const WALL_CROUCH = { ...WALL_STAND, pos: [0, -0.1, 0], kneeL: 0.6, kneeR: 0.6, legL: [0.05, -0.95, 0.3], legR: [-0.05, -0.95, 0.3], footL: -0.3, footR: -0.3 };

export class Wall {
  constructor(count, rng) {
    this.rng = rng;
    this.group = new THREE.Group();
    this.members = [];
    this.colliders = [];
    const skins = [0xe0b08a, 0x8d5a3b, 0xd9a57c, 0xc68e62, 0xf0c8a0];
    const hairs = [0x3a2a1a, 0x111111, 0x6b4a2a, 0x1c1410, 0xc9a25a];
    for (let i = 0; i < count; i++) {
      const kit = { ...KITS.away, skin: skins[i % skins.length], hair: hairs[i % hairs.length], number: [5, 4, 8, 6, 3][i % 5], name: '' };
      const h = new Humanoid(kit, { scale: 0.97 + rng() * 0.07 });
      const col = makeBodyColliders('wall');
      this.members.push({ h, col, delay: 0, jump: 0 });
      this.group.add(h.object);
      this.colliders.push(...col.list);
    }
    this.stand = makePose(WALL_STAND);
    this.jumpPose = makePose(WALL_JUMP);
    this.crouch = makePose(WALL_CROUCH);
    this.tmp = new Float32Array(POSE_SIZE);
    this.t = -1;
    this.active = false;
    this.group.visible = false;
  }

  // Line the wall up 9.15 m from the ball, covering the near post.
  place(ball, postSide) {
    this.active = true;
    this.group.visible = true;
    this.t = -1;
    const n = this.members.length;
    const toPost = new THREE.Vector3(postSide * 2.6, 0, 0).sub(new THREE.Vector3(ball.x, 0, ball.z));
    const dist = Math.min(9.15, toPost.length() - 1.5);
    const dir = toPost.clone().normalize();
    const centre = new THREE.Vector3(ball.x, 0, ball.z).addScaledVector(dir, dist);
    const lat = new THREE.Vector3(-dir.z, 0, dir.x);
    const facing = Math.atan2(-dir.x, -dir.z);
    this.members.forEach((m, i) => {
      const off = (i - (n - 1) / 2) * 0.56;
      m.h.object.position.copy(centre).addScaledVector(lat, off);
      m.h.object.rotation.set(0, facing + (this.rng() - 0.5) * 0.08, 0);
      m.delay = 0.08 + this.rng() * 0.16;
      m.jump = 0.2 + this.rng() * 0.16;
      m.col.reset();
    });
    this.centre = centre;
    this.update(0);
  }

  hide() {
    this.active = false;
    this.group.visible = false;
    for (const c of this.colliders) c.enabled = false;
  }

  onKick() {
    this.t = 0;
  }

  update(dt) {
    if (!this.active) return;
    if (this.t >= 0) this.t += dt;
    for (const m of this.members) {
      let up = 0;
      if (this.t >= 0) {
        const tj = this.t - m.delay;
        const T = Math.sqrt((8 * m.jump) / 9.81);
        if (tj < 0) {
          blendPose(this.stand, this.crouch, smooth(0, m.delay, this.t), this.tmp);
        } else if (tj < T) {
          up = Math.max(0, 0.5 * 9.81 * tj * (T - tj));
          blendPose(this.crouch, this.jumpPose, smooth(0, 0.12, tj), this.tmp);
        } else {
          blendPose(this.crouch, this.stand, smooth(T, T + 0.3, tj), this.tmp);
        }
        m.h.applyPose(this.tmp);
      } else {
        m.h.applyPose(this.stand);
      }
      m.h.groundFeet(up);
      m.col.update(m.h, dt);
      for (const c of m.col.list) c.enabled = true;
    }
  }
}

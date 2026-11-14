import * as THREE from 'three';
import { Humanoid, KITS, makePose, blendPose, POSE_SIZE } from './humanoid.js';
import { Gait } from './gait.js';
import { AWAY_SQUAD } from './looks.js';
import { makeBodyColliders } from './keeper.js';

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
const WALL_CROUCH = {
  ...WALL_STAND,
  pos: [0, -0.1, 0],
  kneeL: 0.6,
  kneeR: 0.6,
  legL: [0.05, -0.95, 0.3],
  legR: [-0.05, -0.95, 0.3],
  footL: -0.3,
  footR: -0.3,
};

// Up to five wall players; each round uses three to five of them.
export class Wall {
  constructor(max, rng) {
    this.rng = rng;
    this.group = new THREE.Group();
    this.members = [];
    this.colliders = [];
    for (let i = 0; i < max; i++) {
      const look = AWAY_SQUAD[i % AWAY_SQUAD.length];
      const kit = { ...KITS.away, ...look, name: '' };
      const h = new Humanoid(kit, { scale: look.height * (0.98 + rng() * 0.04) });
      h.gait = new Gait(h, { width: 0.12 });
      const col = makeBodyColliders('wall');
      this.members.push({ h, col, delay: 0, jump: 0, active: false });
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

  place(ball, postSide, count = 4) {
    const n = Math.min(this.members.length, Math.max(3, count));
    this.active = true;
    this.group.visible = true;
    this.t = -1;
    this.distOff = (this.rng() - 0.5) * 0.35;
    const toPost = new THREE.Vector3(postSide * 2.6, 0, 0).sub(new THREE.Vector3(ball.x, 0, ball.z));
    const dist = Math.min(9.15 + this.distOff, toPost.length() - 1.2);
    const dir = toPost.clone().normalize();
    const centre = new THREE.Vector3(ball.x, 0, ball.z).addScaledVector(dir, dist);
    const lat = new THREE.Vector3(-dir.z, 0, dir.x);
    const facing = Math.atan2(-dir.x, -dir.z);
    const spacing = 0.52 + this.rng() * 0.08;
    let slot = 0;
    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      const on = i < n;
      m.active = on;
      m.h.object.visible = on;
      for (const c of m.col.list) c.enabled = on;
      if (!on) continue;
      const off = (slot - (n - 1) / 2) * spacing;
      m.h.object.position.copy(centre).addScaledVector(lat, off);
      m.h.object.rotation.set(0, facing + (this.rng() - 0.5) * 0.1, 0);
      m.delay = 0.06 + this.rng() * 0.18 + slot * 0.02;
      m.jump = 0.16 + this.rng() * 0.14;
      m.col.reset();
      m.h.resetCloth();
      slot++;
    }
    this.centre = centre;
    this.update(0);
  }

  hide() {
    this.active = false;
    this.group.visible = false;
    for (const c of this.colliders) c.enabled = false;
    for (const m of this.members) m.active = false;
  }

  onKick() {
    this.t = 0;
  }

  update(dt) {
    if (!this.active) return;
    if (this.t >= 0) this.t += dt;
    for (const m of this.members) {
      if (!m.active) continue;
      let up = 0;
      const h = m.h;
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
        h.applyPose(this.tmp);
      } else {
        h.applyPose(this.stand);
      }
      h.groundFeet(up);
      m.col.update(h, dt);
      h.updateCloth(dt);
    }
  }
}
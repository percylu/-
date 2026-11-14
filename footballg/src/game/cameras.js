import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _l = new THREE.Vector3();

// Broadcast-style camera director. All cameras share one PerspectiveCamera.
export class CameraDirector {
  constructor(camera) {
    this.cam = camera;
    this.pos = camera.position.clone();
    this.look = new THREE.Vector3(0, 1.2, 0);
    this.fov = 38;
    this.mode = 'menu';
    this.modeT = 0;
    this.t = 0;
    this.shake = 0;
    this.cutNext = true;
    this.base = { B: new THREE.Vector3(0, 0, 11), g: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0), dist: 11 };
    this.focus = new THREE.Vector3(0, 1, 0);
    this.dofRange = 12;
    this.dofScale = 0;
    this.replaySide = 1;
  }

  setBase(B) {
    const b = this.base;
    b.B.copy(B);
    b.g.set(-B.x, 0, -B.z).normalize();
    b.right.set(-b.g.z, 0, b.g.x);
    b.dist = Math.hypot(B.x, B.z);
  }

  setMode(mode, cut = false) {
    if (mode === this.mode && !cut) return;
    this.mode = mode;
    this.modeT = 0;
    if (cut) this.cutNext = true;
  }

  addShake(s) {
    this.shake = Math.max(this.shake, s);
  }

  aimPose(outPos, outLook, aim, push = 0) {
    const { B, g, right, dist } = this.base;
    const far = dist > 14;
    const D = (far ? 6.6 : 7.2) - push;
    outPos.copy(B).addScaledVector(g, -D).addScaledVector(right, far ? 1.0 : 0.9);
    outPos.y = far ? 2.0 : 2.15;
    outLook.set(0, 1.1, 0);
    if (aim) outLook.lerp(aim, 0.16);
    return far ? 26 : 30;
  }

  update(dt, ctx) {
    this.t += dt;
    this.modeT += dt;
    const t = this.modeT;
    const { ball, aim, kicker, keeper } = ctx;
    const { B, g, right } = this.base;
    let rate = 6;
    let fov = this.fov;
    let fovRate = 4;
    this.dofScale = 0;
    switch (this.mode) {
      case 'menu': {
        const a = this.t * 0.05;
        _p.set(Math.sin(a) * 17, 5.2 + Math.sin(this.t * 0.08) * 1.2, 20 + Math.cos(a) * 5);
        _l.set(0, 2.0, 0);
        fov = 40;
        rate = 1.5;
        this.focus.set(0, 1.2, 0);
        this.dofRange = 16;
        this.dofScale = 2.5;
        break;
      }
      case 'intro': {
        // sweeping crane move into the aiming position
        const k = Math.min(1, t / 2.2);
        const e = k * k * (3 - 2 * k);
        const tp = new THREE.Vector3();
        const tl = new THREE.Vector3();
        const f = this.aimPose(tp, tl, aim);
        _p.set(B.x + 14 * (1 - e), 9 * (1 - e) + tp.y * e, B.z + 16 * (1 - e) + (tp.z - B.z) * e);
        _p.x = _p.x * (1 - e) + tp.x * e;
        _l.copy(tl);
        fov = 44 + (f - 44) * e;
        rate = 30;
        fovRate = 30;
        this.focus.copy(B);
        this.dofRange = 14;
        this.dofScale = 2;
        break;
      }
      case 'aim':
      case 'runup': {
        const push = this.mode === 'runup' ? Math.min(0.35, t * 0.4) : 0;
        fov = this.aimPose(_p, _l, aim, push);
        rate = 5;
        this.focus.set(0, 1, 0).lerp(B, 0.45);
        this.dofRange = 16;
        this.dofScale = 2.4;
        break;
      }
      case 'flight': {
        const f0 = this.aimPose(_p, _l, aim, 0.35);
        const prog = THREE.MathUtils.clamp(1 - Math.hypot(ball.x, ball.z) / Math.max(1, this.base.dist), 0, 1);
        _p.addScaledVector(g, prog * 1.6);
        _p.y += prog * 0.25;
        // follow the ball, but never swing far away from the goal mouth
        _l.lerp(_l.clone().set(THREE.MathUtils.clamp(ball.x, -5.5, 5.5), THREE.MathUtils.clamp(ball.y, 0.5, 3.2), THREE.MathUtils.clamp(ball.z, -2, B.z)), 0.7);
        fov = f0 - 4 * prog;
        rate = 7;
        this.focus.copy(ball);
        this.dofRange = 12;
        this.dofScale = 1.8;
        break;
      }
      case 'celebrate': {
        const kp = kicker;
        const orbit = Math.sin(t * 0.5) * 0.5;
        _p.copy(kp).addScaledVector(g, 7.0).addScaledVector(right, 1.8 + orbit);
        _p.y = 0.85;
        _l.set(kp.x, 1.75, kp.z);
        fov = 29;
        rate = 3;
        this.focus.copy(_l);
        this.dofRange = 4.5;
        this.dofScale = 4;
        break;
      }
      case 'keeperCam': {
        const s = keeper.x >= 0 ? 1 : -1;
        _p.set(keeper.x * 0.4 - s * 2.6, 0.95, 6.2);
        _l.set(keeper.x, 1.4, 0.3);
        fov = 26;
        rate = 3;
        this.focus.copy(_l);
        this.dofRange = 3.5;
        this.dofScale = 4;
        break;
      }
      case 'replayKick': {
        _p.copy(B).addScaledVector(g, 3.5).addScaledVector(right, 3.1);
        _p.y = 0.5;
        _l.set(B.x, 0.9, B.z).lerp(ball, 0.25);
        _l.y = Math.max(0.75, Math.min(1.25, _l.y));
        fov = 36;
        rate = 4;
        this.focus.copy(B);
        this.focus.y = 0.6;
        this.dofRange = 2.8;
        this.dofScale = 4.5;
        break;
      }
      case 'replayNet': {
        const s = this.replaySide;
        _p.set(-s * 2.0, 1.15, -4.4);
        _l.set(ball.x * 0.85, Math.max(0.6, ball.y * 0.8 + 0.2), Math.max(0.5, ball.z * 0.6));
        fov = 44;
        rate = 6;
        this.focus.copy(ball);
        this.dofRange = 5;
        this.dofScale = 3.5;
        break;
      }
      case 'replaySide': {
        const s = this.replaySide;
        _p.set(s * 21, 4.2, 5.5);
        _l.copy(ball);
        _l.y = Math.max(0.9, ball.y * 0.8);
        _l.z = Math.min(ball.z, 9) * 0.8;
        _l.x = ball.x * 0.7;
        fov = 15;
        rate = 5;
        this.focus.copy(ball);
        this.dofRange = 6;
        this.dofScale = 4;
        break;
      }
      case 'replayPost': {
        const s = this.replaySide;
        _p.set(s * 5.4, 0.5, 2.4);
        _l.set(ball.x * 0.5 - s * 0.5, Math.max(0.8, ball.y * 0.7), Math.min(ball.z * 0.5, 1.5) - 0.4);
        fov = 40;
        rate = 5;
        this.focus.copy(ball);
        this.dofRange = 4;
        this.dofScale = 3.5;
        break;
      }
      case 'free': {
        // inspection camera for tools: director.free = { pos, look, fov, dof }
        const f = this.free || {};
        _p.fromArray(f.pos || [0, 1.6, 14]);
        _l.fromArray(f.look || [0, 1, 11]);
        fov = f.fov || 30;
        rate = 100;
        fovRate = 100;
        this.focus.copy(_l);
        this.dofRange = 3;
        this.dofScale = f.dof || 0;
        break;
      }
      default:
        break;
    }
    if (this.cutNext) {
      this.pos.copy(_p);
      this.look.copy(_l);
      this.fov = fov;
      this.cutNext = false;
    } else {
      const k = 1 - Math.exp(-rate * dt);
      this.pos.lerp(_p, k);
      this.look.lerp(_l, 1 - Math.exp(-rate * 1.4 * dt));
      this.fov += (fov - this.fov) * (1 - Math.exp(-fovRate * dt));
    }
    const cam = this.cam;
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      cam.position.x += (Math.sin(this.t * 91) + Math.sin(this.t * 57)) * 0.02 * this.shake;
      cam.position.y += (Math.sin(this.t * 83) + Math.sin(this.t * 49)) * 0.02 * this.shake;
      this.shake *= Math.exp(-6 * dt);
    }
    cam.up.copy(UP);
    cam.lookAt(this.look);
    // keep the horizontal framing on narrow (portrait) screens
    let vf = this.fov;
    if (cam.aspect < 1.5) vf = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(vf / 2)) * 1.5) / cam.aspect)));
    if (Math.abs(cam.fov - vf) > 0.01) {
      cam.fov = vf;
      cam.updateProjectionMatrix();
    }
  }
}

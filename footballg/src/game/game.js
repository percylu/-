import * as THREE from 'three';
import { F, DIFFICULTY, mulberry32 } from '../config.js';
import { BallSim, solveShot } from '../physics/ball.js';
import { createBallMesh } from '../world/ballMesh.js';
import { Keeper } from '../chars/keeper.js';
import { Kicker, Wall, RUNUP_TIME } from '../chars/kicker.js';
import { CameraDirector } from './cameras.js';

const MODE_LABEL = { penalty: '点球大战', freekick: '任意球挑战' };
const FK_SPOTS = [
  [-7, 21], [6, 23], [0.5, 25], [-10, 19.5], [9, 26], [3.5, 20.5], [-4, 27], [11, 21], [-1.5, 22.5],
];
const ROUNDS = 5;
// free kicks are struck with top spin so they clear the wall and dip under the bar
const FK_LIFT = -20;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeReticle() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 40, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28);
    g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    g.stroke();
  }
  g.fillStyle = 'rgba(245,200,75,1)';
  g.beginPath();
  g.arc(64, 64, 7, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, fog: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  s.scale.setScalar(0.62);
  s.renderOrder = 20;
  return s;
}

function makeDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(16, 16, 11, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
}

function makeBlob() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 3;
  return m;
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    const { gfx, quality } = ctx;
    const scene = gfx.scene;
    this.scene = scene;
    this.rng = mulberry32(ctx.seed);
    this.sim = new BallSim();
    this.ballMesh = createBallMesh(quality);
    scene.add(this.ballMesh);
    this.blob = makeBlob();
    scene.add(this.blob);
    this.keeper = new Keeper(this.rng);
    scene.add(this.keeper.object);
    this.kicker = new Kicker();
    scene.add(this.kicker.object);
    this.wall = new Wall(4, this.rng);
    scene.add(this.wall.group);
    this.sim.colliders = [...this.keeper.col.list, ...this.wall.colliders];
    this.wall.hide();

    this.reticle = makeReticle();
    this.reticle.visible = false;
    scene.add(this.reticle);
    const N = 26;
    this.trajN = N;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.traj = new THREE.Points(
      tg,
      new THREE.PointsMaterial({ color: new THREE.Color(1.7, 1.7, 1.7), map: makeDot(), size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, fog: false })
    );
    this.traj.frustumCulled = false;
    this.traj.renderOrder = 19;
    this.traj.visible = false;
    scene.add(this.traj);

    this.director = new CameraDirector(gfx.camera);
    this.state = 'menu';
    this.mode = 'penalty';
    this.time = 0;
    this.aim = new THREE.Vector3(0, 1.2, 0);
    this.curve = 0;
    this.keyCurve = 0;
    this.dragCurve = 0;
    this.power = 0;
    this.chargeT = 0;
    this.excite = 0;
    this.flash = 0.003;
    this.frames = [];
    this.marks = [];
    this.goals = 0;
    this.points = 0;
    this.round = 1;
    this.ballStart = new THREE.Vector3(0, F.ballR, F.penaltyZ);
    this.kickerPos = new THREE.Vector3();
    this.grassFocus = new THREE.Vector3(0, 0, 12);
    this.keys = { left: false, right: false };
    this.slowmo = 1;
    this.fkOrder = [];
    this.setupMenuScene();
  }

  get difficulty() {
    const base = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    // the keeper reads you a little better every round
    const k = (this.round - 1) * 0.025;
    return { ...base, guessRight: Math.min(0.85, base.guessRight + k), noise: base.noise * (1 - k) };
  }

  setupMenuScene() {
    this.state = 'menu';
    this.sim.reset(new THREE.Vector3(0, F.ballR, F.penaltyZ));
    this.director.setBase(this.sim.p);
    this.kicker.place(this.sim.p, this.director.base.g);
    this.keeper.reset(0);
    this.wall.hide();
    this.goal.net.reset();
    this.lighting.focus(0, 8);
    this.director.setMode('menu', true);
    this.reticle.visible = false;
    this.traj.visible = false;
    this.hud.show('scorebug', false);
    this.hud.show('controls', false);
    this.hud.show('topbtns', false);
    this.hud.show('shootBtn', false);
    this.hud.show('replayBadge', false);
    this.hud.show('summary', false);
    this.hud.hideBanner();
    this.hud.show('menu', true);
  }

  startMatch(mode) {
    this.mode = mode;
    this.round = 1;
    this.marks = [];
    this.goals = 0;
    this.points = 0;
    this.fkOrder = FK_SPOTS.map((s, i) => [this.rng(), i]).sort((a, b) => a[0] - b[0]).map((x) => FK_SPOTS[x[1]]);
    this.hud.show('menu', false);
    this.hud.show('summary', false);
    this.hud.show('scorebug', true);
    this.hud.show('topbtns', true);
    this.setupRound(true);
  }

  setupRound(intro = false) {
    const pen = this.mode === 'penalty';
    if (pen) this.ballStart.set(0, F.ballR, F.penaltyZ);
    else {
      const s = this.fkOrder[(this.round - 1) % this.fkOrder.length];
      this.ballStart.set(s[0], F.ballR, s[1]);
    }
    const B = this.ballStart;
    this.sim.reset(B);
    this.director.setBase(B);
    this.kicker.place(B, this.director.base.g);
    if (pen) {
      this.wall.hide();
      this.keeper.reset(0);
    } else {
      const postSide = B.x >= 0 ? 1 : -1;
      this.wall.place(B, postSide);
      this.keeper.reset(-postSide * 0.9);
    }
    this.goal.net.reset();
    this.lighting.focus(B.x * 0.5, clamp((B.z - 2) * 0.5 + 1, 7, 14));
    this.aim.set(0, 1.2, 0);
    this.curve = this.keyCurve = this.dragCurve = 0;
    this.power = 0;
    this.pending = null;
    this.outcome = null;
    this.frames = [];
    this.slowmo = 1;
    this.keeperHandled = false;
    this.touchT = 0;
    this.holdSeen = 0;
    this.oohDone = false;
    this.state = intro ? 'intro' : 'aim';
    this.stateT = 0;
    this.whistled = false;
    this.director.setMode(intro ? 'intro' : 'aim', true);
    this.gfx.resetBallBlur();
    this.hud.hideBanner();
    this.hud.show('replayBadge', false);
    this.hud.show('controls', true);
    this.hud.show('shootBtn', this.touch === true);
    this.hud.setPower(0);
    this.hud.setCurve(0);
    this.hud.setHint(this.touch ? '拖动屏幕瞄准，按住「射门」蓄力' : '移动鼠标瞄准，按住左键蓄力，松开射门');
    this.updateScoreHud();
    this.reticle.visible = !intro;
    this.traj.visible = !intro;
    this.updatePreview();
  }

  updateScoreHud() {
    this.hud.setScore({ modeLabel: MODE_LABEL[this.mode], round: this.round, max: ROUNDS, marks: this.marks, goals: this.goals, points: this.points });
  }

  // ---- input ----
  pointerAim(nx, ny) {
    if (this.state !== 'aim') return;
    const cam = this.gfx.camera;
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
    if (v.z > -0.01) return;
    const t = -cam.position.z / v.z;
    this.setAim(cam.position.x + v.x * t, cam.position.y + v.y * t);
  }

  aimDelta(dx, dy) {
    if (this.state !== 'aim') return;
    this.setAim(this.aim.x + dx, this.aim.y + dy);
  }

  setAim(x, y) {
    this.aim.set(clamp(x, -5.4, 5.4), clamp(y, 0.18, 3.6), 0);
  }

  chargeStart() {
    if (this.state !== 'aim') return false;
    this.state = 'charge';
    this.chargeT = 0;
    this.dragCurve = 0;
    this.lastTick = 0;
    this.hud.setHint('左右拖动加弧线 · 松开射门');
    return true;
  }

  chargeDrag(norm) {
    if (this.state !== 'charge') return;
    this.dragCurve = clamp(norm, -1, 1);
  }

  chargeEnd() {
    if (this.state !== 'charge') return;
    this.pending = { power: Math.max(0.1, this.power), curve: this.curve, target: this.aim.clone() };
    this.state = 'runup';
    this.stateT = 0;
    this.kicker.startRun();
    this.director.setMode('runup');
    this.reticle.visible = false;
    this.traj.visible = false;
    this.hud.show('controls', false);
    this.hud.show('shootBtn', false);
    this.frames = [];
  }

  skip() {
    if (this.state === 'replay') this.nextRound();
    else if (this.state === 'result' && this.stateT > 0.8) this.afterResult(true);
    else if (this.state === 'intro') {
      this.state = 'aim';
      this.director.setMode('aim');
      this.reticle.visible = true;
      this.traj.visible = true;
    }
  }

  debugShoot(power, curve = 0) {
    if (!this.chargeStart()) return false;
    this.power = power;
    this.keyCurve = 0;
    this.dragCurve = curve;
    this.curve = curve;
    this.chargeEnd();
    return true;
  }

  debugState() {
    return { state: this.state, stateT: this.stateT, round: this.round, goals: this.goals, points: this.points, replaySeg: this.replaySeg, last: this.lastShot, cam: this.director.mode };
  }

  // ---- shot ----
  launch() {
    const p = this.pending;
    const rnd = this.rng;
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
    const pen = this.mode === 'penalty';
    const speed = 14.5 + 17.5 * p.power;
    const dist = this.sim.p.distanceTo(p.target);
    const over = clamp((p.power - 0.86) / 0.14, 0, 1);
    const under = clamp((0.25 - p.power) / 0.25, 0, 1);
    const sigma = 0.0045 + over * 0.03 + Math.abs(p.curve) * 0.006 + under * 0.01;
    const target = p.target.clone();
    target.x += gauss() * sigma * dist;
    target.y += gauss() * sigma * dist * 0.8 + over * 0.042 * dist;
    target.y = Math.max(0.12, target.y);
    const sol = solveShot(this.sim.p, target, speed, p.curve, pen ? 6 : FK_LIFT);
    const p0 = this.sim.p.clone();
    this.sim.launch(sol.v, sol.w);
    this.shot = { p0, v0: sol.v.clone(), w0: sol.w.clone(), speed, target };
    this.plan = this.keeper.onKick(this.shot, this.difficulty, pen);
    this.wall.onKick();
    this.audio.kick(p.power);
    this.state = 'flight';
    this.stateT = 0;
    this.kickFrame = this.frames.length;
    this.director.setMode('flight');
    this.flash = 0.05;
  }

  handleEvents() {
    const sim = this.sim;
    for (const ev of sim.events) {
      switch (ev.type) {
        case 'bounce':
          this.audio.bounce(ev.strength);
          break;
        case 'post':
          this.audio.post(ev.strength);
          this.director.addShake(Math.min(1.5, ev.strength / 14));
          break;
        case 'net':
          this.audio.net(ev.strength);
          this.goal.net.wake(300);
          break;
        case 'board':
          this.audio.board(ev.strength);
          break;
        case 'wall':
          this.audio.body(ev.strength);
          break;
        case 'keeper':
          this.audio.glove(ev.strength);
          if (!this.keeperHandled && !sim.goal) {
            this.keeperHandled = true;
            if (this.keeper.canCatch(ev.extra.part, ev.strength)) {
              sim.held = this.keeper;
              this.keeper.startHold(sim.p);
            }
          }
          break;
        default:
          break;
      }
    }
    sim.events.length = 0;
  }

  checkOutcome() {
    const sim = this.sim;
    const t = this.stateT;
    if (sim.goal) return 'goal';
    if (sim.held) {
      if (!this.holdSeen) this.holdSeen = t;
      return t - this.holdSeen > 0.3 ? 'save' : null;
    }
    const p = sim.p;
    const v = sim.v;
    let dead = false;
    if (sim.touchedKeeper) {
      // a parried ball that is no longer heading for the goal is a save straight away
      if (!this.touchT) this.touchT = t;
      const goalward = v.z < -0.8 && Math.abs(p.x) < F.goalHalfW + 0.3 && p.y < F.goalH + 0.3 && p.z > -0.3;
      if (t - this.touchT > 0.35 && !goalward && !sim.inside) dead = true;
    }
    if (t > 0.25) {
      if (p.z < -0.5 && !sim.inside) dead = true;
      if (Math.abs(p.x) > 36 || p.z > 60) dead = true;
      if (v.z > 0.5 && p.z > 2.5 && (sim.touchedKeeper || sim.touchedPost || sim.touchedWall)) dead = true;
      if (sim.speed < 1.2 && t > 0.9 && !sim.inside) dead = true;
      if (sim.touchedWall && sim.speed < 6 && p.z > 5) dead = true;
      if (t > 4.5) dead = true;
    }
    if (!dead) return null;
    if (sim.touchedKeeper) return 'save';
    if (sim.touchedPost) return 'post';
    if (sim.touchedWall) return 'wall';
    return 'miss';
  }

  finishShot(outcome) {
    this.outcome = outcome;
    this.lastShot = { outcome, plan: this.plan && { mode: this.plan.mode, side: this.plan.side }, held: !!this.sim.held, x: +this.sim.p.x.toFixed(2), y: +this.sim.p.y.toFixed(2) };
    this.state = 'result';
    this.stateT = 0;
    this.holdSeen = 0;
    this.touchT = 0;
    const goal = outcome === 'goal';
    this.marks.push(goal ? 'goal' : 'miss');
    let sub = '';
    if (goal) {
      this.goals++;
      const pr = this.plan.pred;
      const cx = Math.abs(this.sim.p.x);
      const cy = this.sim.p.y;
      const corner = clamp((cx - 1.6) / 1.9, 0, 1) * 60 + clamp((cy - 1.3) / 1.0, 0, 1) * 40;
      const speedB = Math.round(clamp((this.shot.speed - 20) / 12, 0, 1) * 50);
      const distB = this.mode === 'freekick' ? 50 : 0;
      const pts = 100 + Math.round(corner) + speedB + distB;
      this.points += pts;
      void pr;
      const kmh = Math.round(this.shot.speed * 3.6);
      sub = corner > 70 ? `世界波！ +${pts} 分 · ${kmh} km/h` : corner > 35 ? `角度刁钻 +${pts} 分 · ${kmh} km/h` : `+${pts} 分 · ${kmh} km/h`;
      this.hud.banner('进球！', sub, 'goal', 2600);
      this.audio.roar();
      this.excite = 1;
      this.flash = 0.06;
      this.kicker.setMood('cheer');
      this.keeper.setResult('goal');
    } else {
      const text = { save: '扑出！', post: '击中门框！', wall: '人墙挡出！', miss: '射偏了！' }[outcome];
      const subs = {
        save: this.sim.held ? '门将稳稳抱住皮球' : '门将做出精彩扑救',
        post: '差之毫厘',
        wall: '试试弧线绕过人墙',
        miss: this.pending.power > 0.9 ? '力量过大，皮球高出横梁' : '皮球偏出球门',
      };
      this.hud.banner(text, subs[outcome], outcome === 'save' ? 'save' : 'miss', 2200);
      this.audio.ooh();
      this.excite = Math.max(this.excite, 0.35);
      this.kicker.setMood('despair');
      this.keeper.setResult('save');
    }
    this.updateScoreHud();
    this.hud.show('controls', false);
    this.hud.show('shootBtn', false);
  }

  afterResult(skipReplay = false) {
    const o = this.outcome;
    if (!skipReplay && (o === 'goal' || o === 'save' || o === 'post') && this.frames.length > 20) this.startReplay();
    else this.nextRound();
  }

  nextRound() {
    this.hud.show('replayBadge', false);
    this.audio.setExcite(0);
    if (this.round >= ROUNDS) {
      this.showSummary();
      return;
    }
    this.round++;
    this.setupRound(false);
  }

  showSummary() {
    this.state = 'summary';
    this.director.setMode('menu', true);
    this.reticle.visible = false;
    this.traj.visible = false;
    this.hud.show('controls', false);
    this.hud.show('shootBtn', false);
    const key = `footballg.best.${this.mode}`;
    let best = 0;
    try {
      best = Number(localStorage.getItem(key) || 0);
      if (this.points > best) {
        best = this.points;
        localStorage.setItem(key, String(best));
      }
    } catch (e) {
      best = this.points;
    }
    const ratings = ['今天不在状态', '还需多加练习', '渐入佳境', '稳定输出', '金靴水准', '传奇射手'];
    this.hud.showSummary({ goals: this.goals, max: ROUNDS, points: this.points, best, marks: this.marks, rating: ratings[this.goals], title: `${MODE_LABEL[this.mode]} · 比赛结束` });
    // tidy the pitch behind the summary
    this.sim.reset(new THREE.Vector3(0, F.ballR, F.penaltyZ));
    this.director.setBase(this.sim.p);
    this.kicker.place(this.sim.p, this.director.base.g);
    this.keeper.reset(0);
    this.wall.hide();
    this.goal.net.reset();
  }

  // ---- replay ----
  record() {
    if (this.frames.length > 1500) return;
    this.frames.push({
      t: this.recT,
      bp: this.sim.p.clone(),
      bq: this.sim.q.clone(),
      keeper: this.keeper.h.snapshot(),
      kicker: this.kicker.h.snapshot(),
      wall: this.wall.active ? this.wall.members.map((m) => m.h.snapshot()) : null,
      net: this.goal.net.snapshot(),
    });
  }

  startReplay() {
    const fr = this.frames;
    this.state = 'replay';
    this.stateT = 0;
    const kickT = fr[Math.min(this.kickFrame, fr.length - 1)].t;
    const endT = fr[fr.length - 1].t;
    // find the decisive moment (ball reaching the goal area)
    let hitT = endT;
    for (const f of fr) {
      if (f.t > kickT && f.bp.z < 0.6) {
        hitT = f.t;
        break;
      }
    }
    const side = this.sim.p.x >= 0 ? 1 : -1;
    this.director.replaySide = side;
    const o = this.outcome;
    const second = o === 'goal' ? (this.round % 2 ? 'replayNet' : 'replaySide') : o === 'save' ? 'replayPost' : 'replaySide';
    if (second === 'replayPost') this.director.replaySide = -side;
    this.replaySegs = [
      { cam: 'replayKick', from: kickT - 0.45, to: kickT + 0.28, speed: 0.5 },
      { cam: second, from: Math.max(kickT + 0.02, hitT - 0.5), to: Math.min(endT, hitT + 1.1), speed: 0.34 },
    ];
    this.replaySeg = -1;
    this.replayT = 0;
    this.advanceReplay();
    this.hud.hideBanner();
    this.hud.show('replayBadge', true);
    this.reticle.visible = false;
    this.gfx.resetBallBlur();
  }

  advanceReplay() {
    this.replaySeg++;
    if (this.replaySeg >= this.replaySegs.length) {
      this.nextRound();
      return false;
    }
    const seg = this.replaySegs[this.replaySeg];
    this.replayT = seg.from;
    this.applyFrame(this.replayT);
    this.director.setMode(seg.cam, true);
    return true;
  }

  applyFrame(t) {
    const fr = this.frames;
    let i = this._ri || 0;
    if (i >= fr.length - 1 || fr[i].t > t) i = 0;
    while (i < fr.length - 2 && fr[i + 1].t <= t) i++;
    this._ri = i;
    const a = fr[i];
    const b = fr[Math.min(i + 1, fr.length - 1)];
    const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    this.ballMesh.position.lerpVectors(a.bp, b.bp, k);
    this.ballMesh.quaternion.copy(a.bq).slerp(b.bq, k);
    this.keeper.h.restore(a.keeper, b.keeper, k);
    this.kicker.h.restore(a.kicker, b.kicker, k);
    if (a.wall && b.wall) this.wall.members.forEach((m, j) => m.h.restore(a.wall[j], b.wall[j], k));
    this.goal.net.restore(a.net, b.net, k);
  }

  // ---- preview ----
  updatePreview() {
    this.reticle.position.copy(this.aim);
    const power = this.state === 'charge' ? Math.max(0.2, this.power) : 0.7;
    const speed = 14.5 + 17.5 * power;
    const sol = solveShot(this.sim.p, this.aim, speed, this.curve, this.mode === 'penalty' ? 6 : FK_LIFT);
    const pos = this.traj.geometry.attributes.position;
    const p = this.sim.p.clone();
    const v = sol.v.clone();
    const w = sol.w;
    const dt = 1 / 120;
    const total = Math.max(0.2, sol.t * 0.62);
    const every = Math.max(1, Math.round(total / dt / this.trajN));
    let n = 0;
    let step = 0;
    const acc = new THREE.Vector3();
    while (n < this.trajN) {
      const sp = v.length();
      acc.set(0, -9.81, 0).addScaledVector(v, -0.0118 * sp);
      acc.x += 0.0056 * (w.y * v.z - w.z * v.y);
      acc.y += 0.0056 * (w.z * v.x - w.x * v.z);
      acc.z += 0.0056 * (w.x * v.y - w.y * v.x);
      v.addScaledVector(acc, dt);
      p.addScaledVector(v, dt);
      step++;
      if (step % every === 0) {
        pos.setXYZ(n, p.x, Math.max(0.03, p.y), p.z);
        n++;
      }
    }
    pos.needsUpdate = true;
  }

  // ---- main update ----
  update(dtReal) {
    const dt = dtReal;
    this.time += dt;
    this.stateT += dt;
    const sim = this.sim;
    const st = this.state;
    const playing = st === 'aim' || st === 'charge' || st === 'runup' || st === 'flight' || st === 'result' || st === 'intro';

    if (st === 'intro') {
      if (this.stateT > 2.3) {
        this.state = 'aim';
        this.stateT = 0;
        this.director.setMode('aim');
        this.reticle.visible = true;
        this.traj.visible = true;
      }
    }
    if ((st === 'aim' || st === 'intro') && !this.whistled && this.stateT > (st === 'intro' ? 1.6 : 0.5)) {
      this.whistled = true;
      this.audio.whistle(0.45);
    }

    if (st === 'aim' || st === 'charge') {
      const kc = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      if (kc) this.keyCurve = clamp(this.keyCurve + kc * dt * 1.5, -1, 1);
      this.curve = clamp(this.keyCurve + this.dragCurve, -1, 1);
      if (st === 'charge') {
        this.chargeT += dt;
        const ph = (this.chargeT / 1.05) % 2;
        this.power = ph < 1 ? ph : 2 - ph;
        if (this.chargeT - this.lastTick > 0.085) {
          this.lastTick = this.chargeT;
          this.audio.tick(this.power);
        }
      }
      this.hud.setPower(this.power);
      this.hud.setCurve(this.curve);
      this.updatePreview();
      this.keeper.tension = st === 'charge' ? Math.min(1, this.keeper.tension + dt * 2) : Math.max(0, this.keeper.tension - dt);
      const pulse = 1 + Math.sin(this.time * 6) * 0.05;
      const d = this.gfx.camera.position.distanceTo(this.aim);
      this.reticle.scale.setScalar(0.045 * d * pulse);
    }

    if (st === 'runup') {
      this.keeper.tension = Math.min(1, this.keeper.tension + dt * 3);
      if (this.kicker.t + dt >= 0) this.launchNext = true;
    }

    if (playing) {
      this.kicker.update(dt);
      if (this.launchNext) {
        this.launchNext = false;
        this.launch();
      }
      if (this.state === 'flight' || this.state === 'result') {
        sim.step(dt);
        this.handleEvents();
      }
      this.keeper.update(dt, sim);
      this.wall.update(dt);
      this.goal.net.update(dt, sim.active ? sim.p : null, F.ballR);
      this.ballMesh.position.copy(sim.p);
      this.ballMesh.quaternion.copy(sim.q);
      if (this.state === 'runup' || this.state === 'flight' || this.state === 'result') {
        this.recT = (this.recT || 0) + dt;
        this.record();
      } else {
        this.recT = 0;
      }
    }

    if (this.state === 'flight') {
      const o = this.checkOutcome();
      if (o) this.finishShot(o);
    } else if (this.state === 'result') {
      const goal = this.outcome === 'goal';
      if (this.director.mode === 'flight') {
        if (goal && this.stateT > 1.0) this.director.setMode('celebrate', true);
        else if (this.outcome === 'save' && this.stateT > 0.3) this.director.setMode('keeperCam', true);
      }
      if (this.stateT > (goal ? 3.4 : 2.4)) this.afterResult();
    } else if (this.state === 'replay') {
      const seg = this.replaySegs[this.replaySeg];
      this.replayT += dt * seg.speed;
      if (this.replayT >= seg.to) {
        if (!this.advanceReplay()) return;
      } else {
        this.applyFrame(this.replayT);
      }
    } else if (this.state === 'menu' || this.state === 'summary') {
      this.kicker.update(dt);
      this.keeper.update(dt, null);
      this.goal.net.update(dt, null, F.ballR);
      this.ballMesh.position.copy(sim.p);
      this.ballMesh.quaternion.copy(sim.q);
    }

    // crowd + flashes
    this.excite = Math.max(0, this.excite - dt * (this.state === 'result' || this.state === 'replay' ? 0.12 : 0.5));
    // the stands get restless while the kicker winds up
    if (this.state === 'charge' || this.state === 'runup') this.excite = Math.min(0.3, Math.max(this.excite, 0) + dt * 0.5);
    this.flash += ((this.state === 'charge' || this.state === 'runup' ? 0.03 : this.excite > 0.5 ? 0.04 : 0.004) - this.flash) * Math.min(1, dt * 3);
    if (this.state !== 'result' && this.state !== 'replay') this.audio.setExcite(this.state === 'charge' || this.state === 'runup' ? 0.25 : 0.04);
    this.audio.update(dt);
    this.hud.update(dt);

    // camera
    const bp = this.ballMesh.position;
    this.kickerPos.setFromMatrixPosition(this.kicker.h.bone('hips').matrixWorld);
    this.kickerPos.y = 0;
    this.director.update(dt, { ball: bp, aim: this.aim, kicker: this.kickerPos, keeper: this.keeper.object.position });
    const cam = this.gfx.camera;
    this.gfx.setDof(this.director.dofScale > 0 ? this.director.focus : null, this.director.dofRange, this.director.dofScale);
    this.gfx.updateBallBlur(bp, F.ballR, sim.speed, this.state === 'flight' || this.state === 'result');

    // contact shadow under the ball
    const h = Math.max(0, bp.y - F.ballR);
    this.blob.position.set(bp.x, 0.012, bp.z);
    const s = 0.34 + h * 0.5;
    this.blob.scale.set(s, s, 1);
    this.blob.material.opacity = bp.z < -0.1 && bp.y > 0.5 ? 0 : clamp(0.62 - h * 0.45, 0, 0.62);
    this.blob.visible = bp.z > F.boardZ;

    // 3D grass follows the area in front of the camera
    const dir = cam.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    dir.normalize();
    this.grassFocus.set(cam.position.x + dir.x * 4.2, 0, cam.position.z + dir.z * 4.2);
  }
}

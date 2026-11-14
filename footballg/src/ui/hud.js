import { QUALITY, DIFFICULTY } from '../config.js';

const $ = (sel, root = document) => root.querySelector(sel);

const TEMPLATE = /* html */ `
<div class="loading" id="loading"><div class="loading-ball"></div><div class="loading-text" id="loadingText">正在进入球场…</div></div>

<div class="scorebug hidden" id="scorebug">
  <div class="sb-brand">绿茵绝杀</div>
  <div class="sb-body">
    <div class="sb-row"><span class="sb-mode" id="sbMode">点球大战</span><span class="sb-round" id="sbRound">第 1/5 轮</span></div>
    <div class="sb-marks" id="sbMarks"></div>
  </div>
  <div class="sb-score"><div class="sb-goals"><b id="sbGoals">0</b><span>进球</span></div><div class="sb-points"><b id="sbPoints">0</b><span>得分</span></div></div>
</div>

<div class="topbtns hidden" id="topbtns">
  <button class="tbtn" id="btnSound" type="button">声音：开</button>
  <button class="tbtn" id="btnMenu" type="button">主菜单</button>
</div>

<div class="fps hidden" id="fps"></div>

<div class="controls hidden" id="controls">
  <div class="meter curve">
    <div class="meter-label"><span>左旋</span><b>弧线</b><span>右旋</span></div>
    <div class="curve-track"><div class="curve-mid"></div><div class="curve-fill" id="curveFill"></div><div class="curve-thumb" id="curveThumb"></div></div>
  </div>
  <div class="meter power">
    <div class="meter-label"><b>力量</b><span id="powerVal">0%</span></div>
    <div class="power-track"><div class="power-fill" id="powerFill"></div><div class="power-mark" id="powerMark"></div></div>
  </div>
  <div class="hint" id="hint"></div>
</div>

<button class="shoot hidden" id="shootBtn" type="button"><span>射门</span><small>按住蓄力</small></button>

<div class="banner" id="banner"><div class="banner-main" id="bannerMain"></div><div class="banner-sub" id="bannerSub"></div></div>

<div class="replay hidden" id="replayBadge"><i></i>精彩回放<span>点击任意处跳过</span></div>

<div class="screen hidden" id="menu">
  <div class="menu-panel">
    <div class="logo"><div class="logo-main">绿茵绝杀</div><div class="logo-sub">FOOTBALL G · 3D 射门</div></div>
    <div class="modes">
      <button class="mode-card" data-mode="penalty" type="button"><b>点球大战</b><span>十二码前，五轮定胜负</span></button>
      <button class="mode-card" data-mode="freekick" type="button"><b>任意球挑战</b><span>绕过人墙，弧线破门</span></button>
    </div>
    <div class="opts">
      <div class="opt"><label>难度</label><div class="seg" id="segDiff"></div></div>
      <div class="opt"><label>画质</label><div class="seg" id="segQuality"></div></div>
      <div class="opt"><label>声音</label><div class="seg" id="segSound"></div></div>
    </div>
    <div class="howto">
      <div><b>鼠标</b>移动瞄准 · 按住左键蓄力 · 蓄力时左右拖动加弧线 · 松开射门</div>
      <div><b>触屏</b>拖动屏幕瞄准 · 按住「射门」蓄力并左右滑动加弧线 · 松开射门</div>
      <div><b>键盘</b>空格蓄力 · A / D 调整弧线 · 回放时任意键跳过</div>
    </div>
    <div class="menu-foot" id="menuFoot"></div>
  </div>
</div>

<div class="screen hidden" id="summary">
  <div class="menu-panel summary-panel">
    <div class="sum-title" id="sumTitle">比赛结束</div>
    <div class="sum-rating" id="sumRating"></div>
    <div class="sum-stats">
      <div><b id="sumGoals">0/5</b><span>进球</span></div>
      <div><b id="sumPoints">0</b><span>得分</span></div>
      <div><b id="sumBest">0</b><span>最高纪录</span></div>
    </div>
    <div class="sb-marks big" id="sumMarks"></div>
    <div class="sum-btns">
      <button class="btn primary" id="btnAgain" type="button">再来一次</button>
      <button class="btn" id="btnBack" type="button">返回主菜单</button>
    </div>
  </div>
</div>
`;

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = TEMPLATE;
    this.el = {};
    for (const id of [
      'loading', 'loadingText', 'scorebug', 'sbMode', 'sbRound', 'sbMarks', 'sbGoals', 'sbPoints', 'topbtns', 'btnSound', 'btnMenu',
      'controls', 'curveFill', 'curveThumb', 'powerFill', 'powerMark', 'powerVal', 'hint', 'shootBtn', 'banner', 'bannerMain', 'bannerSub',
      'replayBadge', 'menu', 'segDiff', 'segQuality', 'segSound', 'menuFoot', 'summary', 'sumTitle', 'sumRating', 'sumGoals', 'sumPoints',
      'sumBest', 'sumMarks', 'btnAgain', 'btnBack', 'fps',
    ]) {
      this.el[id] = $(`#${id}`, root);
    }
    this._bannerLeft = 0;
  }

  show(id, on) {
    this.el[id].classList.toggle('hidden', !on);
  }

  setLoading(text) {
    if (text === null) {
      this.el.loading.classList.add('fade');
      setTimeout(() => this.show('loading', false), 600);
    } else {
      this.el.loadingText.textContent = text;
    }
  }

  buildMenu(settings, qualityName, glName, cb) {
    const seg = (el, items, current, onPick) => {
      el.innerHTML = '';
      for (const [key, label] of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.className = key === current ? 'on' : '';
        b.addEventListener('click', () => {
          for (const c of el.children) c.classList.remove('on');
          b.classList.add('on');
          onPick(key);
        });
        el.appendChild(b);
      }
    };
    seg(this.el.segDiff, Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label]), settings.difficulty, cb.onDifficulty);
    seg(this.el.segQuality, Object.entries(QUALITY).map(([k, v]) => [k, v.label]), qualityName, cb.onQuality);
    seg(this.el.segSound, [['on', '开'], ['off', '关']], settings.sound ? 'on' : 'off', (k) => cb.onSound(k === 'on'));
    for (const card of this.el.menu.querySelectorAll('.mode-card')) {
      card.addEventListener('click', () => cb.onStart(card.dataset.mode));
    }
    this.el.menuFoot.textContent = `渲染器：${glName} · 切换画质会重新载入球场`;
    this.el.btnSound.addEventListener('click', () => cb.onSoundToggle());
    this.el.btnMenu.addEventListener('click', () => cb.onMenu());
    this.el.btnAgain.addEventListener('click', () => cb.onAgain());
    this.el.btnBack.addEventListener('click', () => cb.onMenu());
  }

  setSoundLabel(on) {
    this.el.btnSound.textContent = on ? '声音：开' : '声音：关';
    const seg = this.el.segSound;
    if (seg.children.length === 2) {
      seg.children[0].classList.toggle('on', on);
      seg.children[1].classList.toggle('on', !on);
    }
  }

  setScore({ modeLabel, round, max, marks, goals, points }) {
    this.el.sbMode.textContent = modeLabel;
    this.el.sbRound.textContent = `第 ${Math.min(round, max)}/${max} 轮`;
    this.el.sbGoals.textContent = goals;
    this.el.sbPoints.textContent = points;
    this.el.sbMarks.innerHTML = this._marks(marks, max, round - 1);
  }

  _marks(marks, max, current) {
    let html = '';
    for (let i = 0; i < max; i++) {
      const m = marks[i];
      const cls = m === undefined ? (i === current ? 'cur' : '') : m === 'goal' ? 'goal' : 'miss';
      html += `<i class="${cls}"></i>`;
    }
    return html;
  }

  setPower(p) {
    this.el.powerFill.style.width = `${(p * 100).toFixed(1)}%`;
    this.el.powerMark.style.left = `${(p * 100).toFixed(1)}%`;
    this.el.powerVal.textContent = `${Math.round(p * 100)}%`;
    this.el.powerFill.classList.toggle('over', p > 0.88);
  }

  setCurve(c) {
    const pct = 50 + c * 50;
    this.el.curveThumb.style.left = `${pct}%`;
    const f = this.el.curveFill;
    f.style.left = `${Math.min(50, pct)}%`;
    f.style.width = `${Math.abs(pct - 50)}%`;
  }

  setHint(text) {
    this.el.hint.textContent = text;
  }

  banner(main, sub = '', kind = 'goal', ms = 2200) {
    const b = this.el.banner;
    this.el.bannerMain.textContent = main;
    this.el.bannerSub.textContent = sub;
    b.className = `banner show ${kind}`;
    this._bannerLeft = ms > 0 ? ms / 1000 : Infinity;
  }

  hideBanner() {
    this._bannerLeft = 0;
    this.el.banner.className = 'banner';
  }

  // Banner lifetime follows game time, so it also behaves in fixed-step capture and slow motion.
  update(dt) {
    if (this._bannerLeft > 0) {
      this._bannerLeft -= dt;
      if (this._bannerLeft <= 0) this.el.banner.className = 'banner';
    }
  }

  showSummary({ goals, max, points, best, marks, rating, title }) {
    this.el.sumTitle.textContent = title;
    this.el.sumRating.textContent = rating;
    this.el.sumGoals.textContent = `${goals}/${max}`;
    this.el.sumPoints.textContent = points;
    this.el.sumBest.textContent = best;
    this.el.sumMarks.innerHTML = this._marks(marks, max, -1);
    this.show('summary', true);
  }

  setFps(text) {
    this.el.fps.textContent = text;
  }
}

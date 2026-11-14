import * as THREE from 'three';
import './ui/style.css';
import { QUALITY, URLP, loadSettings, saveSettings } from './config.js';
import { Gfx, detectSoftwareGL } from './core/gfx.js';
import { createPitch } from './world/pitch.js';
import { createStadium } from './world/stadium.js';
import { createGoal } from './world/goal.js';
import { createLighting } from './world/lighting.js';
import { Hud } from './ui/hud.js';
import { Audio } from './audio/audio.js';
import { Game } from './game/game.js';
import { bindInput } from './game/input.js';

const settings = loadSettings();
const hud = new Hud(document.getElementById('ui'));
const canvas = document.getElementById('game');

function pickQuality() {
  const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  const info = probe ? detectSoftwareGL(probe) : { software: true, name: '不支持 WebGL' };
  let name = settings.quality;
  if (!name || !QUALITY[name]) {
    const small = Math.min(window.innerWidth, window.innerHeight) < 520;
    const discrete = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m\d|apple gpu/i.test(info.name);
    name = info.software ? 'low' : small || !discrete ? 'medium' : 'high';
  }
  return { name, info };
}

function boot() {
  const { name: qName, info } = pickQuality();
  let quality = QUALITY[qName];
  // without a GPU everything is rasterized on the CPU: thin the crowd so the game stays interactive
  if (info.software && qName === 'low' && !URLP.capture) quality = { ...quality, crowd: 0.2, crowdNear: 0.5 };
  const gfx = new Gfx(canvas, quality);
  const { scene } = gfx;

  const pitch = createPitch(gfx, quality);
  scene.add(pitch.group);
  const stadium = createStadium(gfx, quality);
  scene.add(stadium.group);
  const goal = createGoal(quality);
  scene.add(goal.group);
  const lighting = createLighting(gfx, quality);
  lighting.focus(0, 8);
  lighting.bakeEnvironment([]);

  const audio = new Audio(settings.sound && !URLP.mute);
  const seed = URLP.seed ? Number(URLP.seed) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const game = new Game({ gfx, quality, pitch, stadium, goal, lighting, hud, audio, settings, seed });
  bindInput(canvas, hud, game, audio);

  hud.buildMenu(settings, qName, info.name, {
    onStart: (mode) => {
      audio.init();
      audio.click();
      game.startMatch(mode);
    },
    onDifficulty: (d) => {
      settings.difficulty = d;
      saveSettings(settings);
      audio.click();
    },
    onQuality: (q) => {
      if (q === qName) return;
      settings.quality = q;
      saveSettings(settings);
      const url = new URL(location.href);
      url.searchParams.delete('q');
      location.href = url.toString();
    },
    onSound: (on) => {
      settings.sound = on;
      saveSettings(settings);
      audio.init();
      audio.setEnabled(on);
      hud.setSoundLabel(on);
    },
    onSoundToggle: () => {
      settings.sound = !settings.sound;
      saveSettings(settings);
      audio.init();
      audio.setEnabled(settings.sound);
      hud.setSoundLabel(settings.sound);
    },
    onMenu: () => {
      audio.click();
      game.setupMenuScene();
    },
    onAgain: () => {
      audio.click();
      game.startMatch(game.mode);
    },
  });
  hud.setSoundLabel(settings.sound);

  let time = 0;
  let fpsAcc = 0;
  let fpsN = 0;
  let slowT = 0;
  let fastT = 0;
  const app = {
    ready: false,
    gfx,
    game,
    quality: qName,
    tick(dt) {
      time += dt;
      game.update(dt);
    },
    step(dt) {
      time += dt;
      game.update(dt);
      pitch.update(time, game.grassFocus);
      stadium.update(time, game.excite, game.flash);
      gfx.render(dt);
    },
  };
  window.__fg = app;
  window.addEventListener('resize', () => gfx.resize());

  if (URLP.debug) hud.show('fps', true);

  // software rasterizers (no GPU) need a much smaller frame to stay interactive
  const minScale = info.software ? 0.3 : 0.5;
  if (info.software && !URLP.capture) gfx.setResolutionScale(0.45);

  if (!URLP.capture) {
    let last = performance.now();
    gfx.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const raw = (now - last) / 1000;
      last = now;
      // long frames are split so the simulation stays stable at low frame rates
      const total = Math.min(0.2, raw);
      const n = Math.max(1, Math.ceil(total / (1 / 30)));
      for (let i = 0; i < n - 1; i++) app.tick(total / n);
      app.step(total / n);
      // dynamic resolution keeps the frame rate playable on weak GPUs
      fpsAcc += raw;
      fpsN++;
      if (fpsAcc >= 0.5) {
        const fps = fpsN / fpsAcc;
        fpsAcc = 0;
        fpsN = 0;
        if (fps < 40) {
          slowT++;
          fastT = 0;
        } else if (fps > 57) {
          fastT++;
          slowT = 0;
        } else {
          slowT = fastT = 0;
        }
        if (slowT >= 2 && gfx.resScale > minScale) {
          gfx.setResolutionScale(Math.max(minScale, gfx.resScale - (fps < 25 ? 0.15 : 0.08)));
          slowT = 0;
        } else if (fastT >= 6 && gfx.resScale < 1) {
          gfx.setResolutionScale(Math.min(1, gfx.resScale + 0.05));
          fastT = 0;
        }
        if (URLP.debug) {
          const info = gfx.renderer.info;
          hud.setFps(`${fps.toFixed(0)} FPS · ${quality.label} · 分辨率 ${(gfx.resScale * 100).toFixed(0)}%\n${info.render.calls} 次绘制 · ${(info.render.triangles / 1000).toFixed(0)}k 三角形`);
        }
      }
    });
  }
  app.step(1 / 60);
  app.ready = true;
  hud.setLoading(null);
  if (URLP.autostart) game.startMatch(URLP.autostart === 'freekick' ? 'freekick' : 'penalty');
  console.log('[fg] ready', qName, info.name);
}

// let the loading screen paint before the (synchronous) world build
requestAnimationFrame(() => setTimeout(boot, 30));

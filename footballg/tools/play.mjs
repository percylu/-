// Scripted headless play-through with a fixed time step.
//   node tools/play.mjs --script tools/scripts/demo.mjs [--url ...] [--frames dir] [--fps 30] [--w 1280 --h 720] [--dry 1] [--every N]
// The script module default-exports `async (api) => {}` where api = { ev(js), step(n), shot(path), state(), log }.
// With --frames every simulated frame is written as a JPEG so ffmpeg can assemble a video.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const w = Number(args.w || 1280);
const h = Number(args.h || 720);
const fps = Number(args.fps || 30);
const url = args.url || 'http://localhost:5173/?capture&q=low&seed=7&mute';
const framesDir = args.frames ? path.resolve(args.frames) : null;
if (framesDir) fs.mkdirSync(framesDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--mute-audio', `--window-size=${w},${h}`],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
let frame = 0;
// --dry: never render (fast, for finding inputs); --every N: render only every Nth frame (preview pass)
const dry = 'dry' in args;
const every = Number(args.every || 1);
const load = async (u) => {
  await page.goto(u, { waitUntil: 'load' });
  await page.waitForFunction('window.__fg && window.__fg.ready', { timeout: 240000 });
};
const tick = (n = 1) => page.evaluate((k, d) => { for (let i = 0; i < k; i++) window.__fg.tick(d); }, n, 1 / fps);
const api = {
  fps,
  dry,
  url,
  goto: load,
  ev: (js) => page.evaluate(js),
  async step(n = 1) {
    for (let i = 0; i < n; i++) {
      if (dry || frame % every !== 0) await tick(1);
      else {
        await page.evaluate((d) => window.__fg.step(d), 1 / fps);
        if (framesDir) {
          await page.screenshot({ path: path.join(framesDir, `f${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
        }
      }
      frame++;
    }
  },
  // advance the simulation without rendering (fast-forward)
  tick,
  async shot(p) {
    if (dry) return;
    await page.evaluate(() => window.__fg.step(0));
    await page.screenshot({ path: p });
  },
  state: () => page.evaluate('window.__fg.game.debugState()'),
  log: (...a) => console.log(...a),
  get frame() {
    return frame;
  },
};
await load(url);
const mod = await import(pathToFileURL(path.resolve(args.script)).href);
await mod.default(api, args);
console.log('frames', frame);
await browser.close();

// Headless screenshot helper: node tools/shot.mjs --url <url> --out <png> [--w 1280 --h 720] [--eval js] [--steps n] [--dt s]
import puppeteer from 'puppeteer-core';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const url = args.url || 'http://localhost:5173/?capture';
const out = args.out || '/tmp/fg-shot.png';
const w = Number(args.w || 1280);
const h = Number(args.h || 720);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--mute-audio', `--window-size=${w},${h}`],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__fg && window.__fg.ready', { timeout: 180000 });
console.log('ready in', Date.now() - t0, 'ms');
if (args.eval) console.log('eval ->', await page.evaluate(args.eval));
const steps = Number(args.steps || 2);
const dt = Number(args.dt || 1 / 30);
const t1 = Date.now();
for (let i = 0; i < steps; i++)
  await page.evaluate((d) => {
    window.__fg.step(d);
    // readPixels forces the GPU process to finish the frame so the timing is honest
    const gl = window.__fg.gfx.renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }, dt);
console.log('frame ms', (Date.now() - t1) / steps);
if (args.eval2) console.log('eval2 ->', await page.evaluate(args.eval2));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();

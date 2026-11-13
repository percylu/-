// Real-time input test (no fixed step): drives the game with real mouse events like a player would.
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://localhost:5173/?debug&seed=3';
const out = process.argv[3] || '/tmp/live';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--window-size=1280,720'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__fg && window.__fg.ready', { timeout: 240000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = () => page.evaluate('JSON.stringify(Object.assign(__fg.game.debugState(), {fps: document.getElementById("fps").textContent, scale: __fg.gfx.resScale}))');
await sleep(3000);
console.log('menu', await st());
await page.screenshot({ path: `${out}-menu.png` });
await page.click('.mode-card[data-mode="penalty"]');
await sleep(4500);
console.log('after start', await st());
const targets = [[880, 250, 650], [420, 330, 800], [640, 300, 500]];
for (let i = 0; i < targets.length; i++) {
  const [x, y, hold] = targets[i];
  await page.mouse.move(x - 40, y + 30, { steps: 5 });
  await page.mouse.move(x, y, { steps: 5 });
  await sleep(400);
  await page.screenshot({ path: `${out}-aim${i}.png` });
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.move(x + (i === 1 ? 120 : 0), y, { steps: 3 });
  await page.screenshot({ path: `${out}-charge${i}.png` });
  await page.mouse.up();
  console.log('released', await st());
  await sleep(1700);
  await page.screenshot({ path: `${out}-flight${i}.png` });
  let s;
  const t0 = Date.now();
  do {
    await sleep(500);
    s = JSON.parse(await st());
  } while (!(s.state === 'aim' && s.round === i + 2) && s.state !== 'summary' && Date.now() - t0 < 40000);
  console.log('round done', JSON.stringify(s), 'in', Date.now() - t0, 'ms');
}
await page.screenshot({ path: `${out}-end.png` });
await browser.close();

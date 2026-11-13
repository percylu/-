// Monte-Carlo balance check: fires many shots without rendering and prints outcome rates.
//   node tools/play.mjs --script tools/scripts/balance.mjs [--n 150] [--only freekick]
export default async function (api, args) {
  const n = Number(args.n || 150);
  for (const mode of ['penalty', 'freekick']) {
    if (args.only && args.only !== mode) continue;
    for (const diff of ['easy', 'normal', 'hard']) {
      const res = await api.ev(`(() => {
        const g = __fg.game; const out = {};
        g.settings.difficulty = '${diff}';
        let s = 12345;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const add = (k, o) => { const r = (out[k] = out[k] || { n: 0 }); r.n++; r[o] = (r[o] || 0) + 1; };
        const fk = '${mode}' === 'freekick';
        g.startMatch('${mode}');
        for (let i = 0; i < ${n}; i++) {
          g.round = 1 + (i % 5); g.marks = []; g.setupRound(false);
          const side = g.ballStart.x >= 0 ? 1 : -1;
          const x = (rnd() * 2 - 1) * 3.5, y = 0.25 + rnd() * 2.1, pw = (fk ? 0.3 : 0.5) + rnd() * (fk ? 0.6 : 0.38);
          const cv = fk ? (rnd() * 2 - 1) * 0.8 : 0;
          g.setAim(x, y); g.debugShoot(pw, cv);
          let k = 0;
          while (g.state !== 'result' && k++ < 900) __fg.tick(1 / 60);
          const o = g.outcome || 'timeout';
          const ax = Math.abs(x);
          let zone = ax > 2.6 ? (y > 1.5 ? 'cornerHigh' : 'cornerLow') : ax > 1.3 ? 'mid' : 'center';
          add('all', o); add(zone, o);
          if (fk) {
            add(x * side > 0 ? 'wallSide' : 'farSide', o);
            add(y > 1.6 ? 'high' : 'low', o);
            add(pw < 0.5 ? 'pwLow' : pw < 0.7 ? 'pwMid' : 'pwHigh', o);
            if (ax > 2.4 && y > 1.5) add(x * side > 0 ? 'topWall' : 'topFar', o);
          }
        }
        g.setupMenuScene();
        return out;
      })()`);
      const fmt = (r) => Object.entries(r).map(([k, v]) => (k === 'n' ? `n=${v}` : `${k}=${Math.round((v / r.n) * 100)}%`)).join(' ');
      api.log(mode, diff);
      for (const [k, r] of Object.entries(res)) api.log('   ', k.padEnd(11), fmt(r));
    }
  }
}

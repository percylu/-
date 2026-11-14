// Numeric probe of single shots (no rendering): node tools/play.mjs --script tools/scripts/probe.mjs --mode freekick
export default async function (api, args) {
  const mode = args.mode || 'freekick';
  const res = await api.ev(`(() => {
    const g = __fg.game; const out = [];
    g.settings.difficulty = '${args.diff || 'normal'}';
    let s = 999;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.startMatch('${mode}');
    for (let i = 0; i < ${Number(args.n || 14)}; i++) {
      g.round = 1 + (i % 5); g.marks = []; g.setupRound(false);
      const x = (rnd() * 2 - 1) * 1.2, y = 0.5 + rnd() * 1.2, pw = ${args.pw || '0.3 + rnd() * 0.15'};
      g.setAim(x, y); g.debugShoot(pw, 0);
      let k = 0; let cross = null;
      while (g.state !== 'result' && k++ < 900) {
        __fg.tick(1 / 60);
        if (!cross && g.state === 'flight' && g.sim.p.z < 0.45) {
          const j = g.keeper.h.updateJoints();
          cross = { t: +g.stateT.toFixed(2), bx: +g.sim.p.x.toFixed(2), by: +g.sim.p.y.toFixed(2), hips: [+g.keeper.object.position.x.toFixed(2)], handL: j.handL && [+j.handL.x.toFixed(2), +j.handL.y.toFixed(2), +j.handL.z.toFixed(2)], handR: j.handR && [+j.handR.x.toFixed(2), +j.handR.y.toFixed(2), +j.handR.z.toFixed(2)] };
        }
      }
      const p = g.plan;
      out.push({ B: [g.ballStart.x, g.ballStart.z], aim: [+x.toFixed(2), +y.toFixed(2)], pw: +pw.toFixed(2), o: g.outcome, plan: { kind: p.kind, side: p.side, tStart: +p.tStart.toFixed(2), tHit: +p.tHit.toFixed(2), x0: p.x0, hipX: +p.hipX.toFixed(2), px: +p.pred.x.toFixed(2), py: +p.pred.y.toFixed(2), b: p.pred.bounces }, H: [+g.keeper.H.x.toFixed(2), +g.keeper.H.y.toFixed(2)], cross });
    }
    g.setupMenuScene();
    return out;
  })()`);
  for (const r of res) api.log(JSON.stringify(r));
}

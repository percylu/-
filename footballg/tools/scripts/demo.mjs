// The scripted play-through used for the gameplay video: a penalty goal, a penalty save and a free-kick goal.
// Inputs go through the same game API the mouse handlers call (setAim / chargeStart / chargeDrag / chargeEnd).
//   dry run to find a seed:  node tools/play.mjs --script tools/scripts/demo.mjs --dry 1 --seeds 1,2,3,4
//   final capture:           node tools/play.mjs --script tools/scripts/demo.mjs --frames .capture/frames --stills .capture
const ease = (t) => t * t * (3 - 2 * t);

export default async function (api, args) {
  const stills = args.stills || null;
  const base = api.url.replace(/[?&]seed=\d+/, '');
  const seeds = (args.seeds || '').split(',').filter(Boolean);
  const want = (args.want || 'goal,save,goal').split(',');

  const aimTo = async (from, to, frames) => {
    for (let i = 1; i <= frames; i++) {
      const k = ease(i / frames);
      await api.ev(`__fg.game.setAim(${from[0] + (to[0] - from[0]) * k}, ${from[1] + (to[1] - from[1]) * k})`);
      await api.step(1);
    }
  };
  // returns the outcome; `marks` maps a moment name to a still file name
  const shoot = async ({ path, chargeFrames, curve = 0, marks = {}, cutReplayAt = null }) => {
    for (let i = 0; i < path.length - 1; i++) await aimTo(path[i].p, path[i + 1].p, path[i + 1].f);
    await api.step(6);
    if (marks.aim && stills) await api.shot(`${stills}/${marks.aim}.png`);
    await api.ev('__fg.game.chargeStart()');
    for (let i = 0; i < chargeFrames; i++) {
      if (curve) await api.ev(`__fg.game.chargeDrag(${(curve * (i + 1)) / chargeFrames})`);
      await api.step(1);
    }
    await api.ev('__fg.game.chargeEnd()');
    const done = {};
    let st;
    let n = 0;
    const round0 = (await api.state()).round;
    const once = async (key, cond) => {
      if (marks[key] && stills && !done[key] && cond) {
        done[key] = true;
        await api.shot(`${stills}/${marks[key]}.png`);
      }
    };
    for (;;) {
      await api.step(1);
      n++;
      st = await api.state();
      await once('flight', st.state === 'flight' && st.stateT > 0.3);
      await once('result', st.state === 'result' && st.stateT > 0.5);
      await once('celebrate', st.state === 'result' && st.stateT > 2.2);
      await once('replayKick', st.state === 'replay' && st.replaySeg === 0 && st.stateT > 0.9);
      await once('replayB', st.state === 'replay' && st.replaySeg === 1 && st.stateT > (marks.replayBAt || 3.2));
      await once('replayC', st.state === 'replay' && st.replaySeg === 1 && st.stateT > (marks.replayCAt || 4.4));
      if (cutReplayAt && st.state === 'replay' && st.stateT > cutReplayAt) {
        await api.ev('__fg.game.skip()');
        await api.step(1);
        break;
      }
      if (api.dry && st.state === 'result') {
        // nothing left to learn from the replay in a dry run
        await api.tick(30);
        await api.ev('__fg.game.afterResult(true)');
        break;
      }
      if (st.state === 'summary' || (st.state === 'aim' && st.round !== round0) || n > 1500) break;
    }
    st = await api.state();
    return st.last;
  };

  const run = async (seed) => {
    await api.goto(`${base}&seed=${seed}`);
    const out = [];
    // menu
    await api.step(api.dry ? 1 : 54);
    await api.ev(`__fg.game.startMatch('penalty')`);
    await api.step(78);
    // 1) penalty into the top right corner
    out.push(
      await shoot({
        path: [{ p: [0, 1.2] }, { p: [-1.6, 0.9], f: 16 }, { p: [3.05, 2.02], f: 26 }],
        chargeFrames: 25,
        marks: { aim: 'aim1', flight: 'flight1', celebrate: 'celebrate1', replayKick: 'kick1', replayB: 'net1', replayC: 'net1b' },
      })
    );
    if (out[0].outcome !== want[0] && api.dry) return out;
    // 2) penalty low to the left, saved
    out.push(
      await shoot({
        path: [{ p: [3.05, 2.02] }, { p: [-2.1, 0.75], f: 26 }],
        chargeFrames: 20,
        marks: { aim: 'aim2', flight: 'flight2', result: 'save2', replayB: 'save2b', replayC: 'save2c' },
      })
    );
    if (out[1].outcome !== want[1] && api.dry) return out;
    // 3) free kick curled over the wall
    await api.ev('__fg.game.setupMenuScene()');
    await api.step(api.dry ? 1 : 24);
    await api.ev(`__fg.game.startMatch('freekick')`);
    await api.step(78);
    const side = await api.ev('__fg.game.ballStart.x >= 0 ? 1 : -1');
    out.push(
      await shoot({
        path: [{ p: [0, 1.2] }, { p: [side * 1.2, 1.4], f: 14 }, { p: [side * 3.1, 2.05], f: 24 }],
        chargeFrames: 14,
        curve: -side * 0.35,
        marks: { aim: 'aim3', flight: 'flight3', celebrate: 'celebrate3', replayKick: 'kick3', replayB: 'net3', replayC: 'net3b' },
      })
    );
    if (!api.dry) await api.step(40);
    return out;
  };

  if (api.dry) {
    for (const seed of seeds.length ? seeds : ['7']) {
      const out = await run(seed);
      const ok = out.length === want.length && out.every((o, i) => o.outcome === want[i]);
      api.log(ok ? 'MATCH' : '     ', 'seed', seed, JSON.stringify(out.map((o) => [o.outcome, o.plan.mode, o.held ? 'held' : ''].join(':'))));
    }
  } else {
    const out = await run(args.seed || '7');
    api.log('outcomes', JSON.stringify(out));
  }
}

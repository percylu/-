// Renders stills at the key moments of a few shots (fast-forwards in between).
//   node tools/play.mjs --script tools/scripts/stills.mjs --mode penalty --out /tmp/st --url "...q=high..."
export default async function (api, args) {
  const out = args.out || '/tmp/st';
  const mode = args.mode || 'penalty';
  let shots = [[3.1, 2.0, 0.78, 0], [-2.2, 0.6, 0.62, 0], [0.4, 1.1, 0.6, 0]];
  if (mode === 'freekick') shots = [[3.0, 2.0, 0.45, 0], [-1.0, 1.2, 0.6, 0.5], [3.1, 2.0, 0.42, -0.3]];
  if (args.aim) shots = [args.aim.split(',').map(Number)];
  shots = shots.slice(0, Number(args.shots || 3));
  const want = (args.want || 'aim,runup,flight,result,result2,replayA,replayB').split(',');
  await api.ev(`__fg.game.startMatch('${mode}')`);
  await api.tick(90);
  for (let i = 0; i < shots.length; i++) {
    let [x, y, pw, cv] = shots[i];
    if (mode === 'freekick') x = Math.abs(x) * (await api.ev('__fg.game.ballStart.x >= 0 ? 1 : -1')) * Math.sign(x);
    await api.ev(`__fg.game.setAim(${x},${y})`);
    await api.tick(20);
    const snap = async (name) => {
      if (!want.includes(name)) return;
      await api.step(1);
      await api.shot(`${out}/${mode[0]}${i}-${name}.png`);
    };
    await snap('aim');
    await api.ev(`__fg.game.debugShoot(${pw},${cv})`);
    const done = {};
    const once = async (k, cond, name) => {
      if (!done[k] && cond) {
        done[k] = true;
        await snap(name);
      }
    };
    let st;
    let n = 0;
    do {
      await api.tick(1);
      n++;
      st = await api.state();
      await once('runup', st.state === 'runup' && st.stateT > 0.62, 'runup');
      await once('flight', st.state === 'flight' && st.stateT > Number(args.ft || 0.3), 'flight');
      await once('result', st.state === 'result' && st.stateT > 0.35, 'result');
      await once('result2', st.state === 'result' && st.stateT > 1.9, 'result2');
      await once('replayA', st.state === 'replay' && st.replaySeg === 0 && st.stateT > 0.95, 'replayA');
      await once('replayB', st.state === 'replay' && st.replaySeg === 1 && st.stateT > 3.3, 'replayB');
      await once('replayC', st.state === 'replay' && st.replaySeg === 1 && st.stateT > 4.3, 'replayC');
    } while ((st.state !== 'aim' || st.round !== i + 2) && st.state !== 'summary' && n < 1200);
    api.log('shot', i, JSON.stringify(st.last), 'frames', n);
  }
}

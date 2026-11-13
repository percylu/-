// Plays a few penalties and prints the outcomes; saves a handful of screenshots.
export default async function (api, args) {
  const out = args.out || '/tmp/fg';
  const mode = args.mode || 'penalty';
  await api.ev(`__fg.game.startMatch('${mode}')`);
  await api.step(80);
  await api.shot(`${out}/s-aim.png`);
  let shots = [
    [2.9, 0.5, 0.75, 0], [-3.1, 1.9, 0.8, 0.3], [0.3, 1.0, 0.6, 0], [3.2, 2.1, 0.85, -0.4], [-2.6, 0.4, 0.98, 0],
  ];
  if (mode === 'freekick') shots = [[3.0, 2.0, 0.45, 0], [0.5, 1.2, 0.6, 0.5], [3.1, 2.0, 0.42, -0.3], [-3.0, 1.9, 0.5, 0.3], [2.5, 0.6, 0.8, 0]];
  shots = shots.slice(0, Number(args.shots || 5));
  for (let i = 0; i < shots.length; i++) {
    let [x, y, pw, cv] = shots[i];
    if (mode === 'freekick') x = Math.abs(x) * (await api.ev('__fg.game.ballStart.x >= 0 ? 1 : -1')) * Math.sign(x);
    await api.ev(`__fg.game.setAim(${x},${y})`);
    await api.step(6);
    await api.shot(`${out}/s${i}-aim.png`);
    await api.ev(`__fg.game.debugShoot(${pw},${cv})`);
    let st;
    let n = 0;
    let shotDone = false;
    do {
      await api.step(1);
      n++;
      st = await api.state();
      if (n === 12) await api.shot(`${out}/s${i}-runup.png`);
      if (st.state === 'flight' && st.stateT > 0.33 && !shotDone) { shotDone = true; await api.shot(`${out}/s${i}-flight.png`); }
      if (st.state === 'result' && Math.abs(st.stateT - 0.5) < 0.02) await api.shot(`${out}/s${i}-result.png`);
      if (st.state === 'result' && Math.abs(st.stateT - 1.8) < 0.02) await api.shot(`${out}/s${i}-result2.png`);
      if (st.state === 'replay' && st.replaySeg === 0 && n % 20 === 0) await api.shot(`${out}/s${i}-replayA.png`);
      if (st.state === 'replay' && st.replaySeg === 1 && n % 25 === 0) await api.shot(`${out}/s${i}-replayB.png`);
    } while ((st.state !== 'aim' || st.round !== i + 2) && st.state !== 'summary' && n < 900);
    api.log('shot', i, JSON.stringify(st.last), 'frames', n);
  }
  await api.step(10);
  await api.shot(`${out}/s-summary.png`);
}

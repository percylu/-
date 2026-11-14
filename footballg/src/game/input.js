// Mouse, touch and keyboard bindings.
export function bindInput(canvas, hud, game, audio) {
  const shootBtn = hud.el.shootBtn;
  let mouseDown = false;
  let startX = 0;
  let touchId = null;
  let lastX = 0;
  let lastY = 0;
  let btnId = null;
  let btnStartX = 0;

  const ndc = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  };
  const curveSpan = () => Math.max(120, Math.min(window.innerWidth * 0.2, 320));
  const enableTouch = () => {
    if (game.touch) return;
    game.touch = true;
    if (game.state === 'aim' || game.state === 'charge') {
      hud.show('shootBtn', true);
      hud.setHint('拖动屏幕瞄准，按住「射门」蓄力');
    }
  };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enableTouch();

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    audio.init();
    if (game.state === 'replay' || game.state === 'result' || game.state === 'intro') {
      game.skip();
      return;
    }
    if (e.pointerType === 'touch') {
      enableTouch();
      if (touchId === null) {
        touchId = e.pointerId;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      return;
    }
    if (e.button !== 0) return;
    const [nx, ny] = ndc(e);
    game.pointerAim(nx, ny);
    if (game.chargeStart()) {
      mouseDown = true;
      startX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (e.pointerId !== touchId) return;
      // relative drag: a full-height swipe covers roughly the goal height
      const k = 7.5 / Math.max(240, window.innerHeight);
      game.aimDelta((e.clientX - lastX) * k, -(e.clientY - lastY) * k);
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    if (mouseDown) {
      game.chargeDrag((e.clientX - startX) / curveSpan());
    } else {
      const [nx, ny] = ndc(e);
      game.pointerAim(nx, ny);
    }
  });

  const up = (e) => {
    if (e.pointerType === 'touch') {
      if (e.pointerId === touchId) touchId = null;
      return;
    }
    if (mouseDown) {
      mouseDown = false;
      game.chargeEnd();
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  shootBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.init();
    if (game.chargeStart()) {
      btnId = e.pointerId;
      btnStartX = e.clientX;
      shootBtn.classList.add('down');
      shootBtn.setPointerCapture(e.pointerId);
    }
  });
  shootBtn.addEventListener('pointermove', (e) => {
    if (e.pointerId === btnId) game.chargeDrag((e.clientX - btnStartX) / (curveSpan() * 0.7));
  });
  const btnUp = (e) => {
    if (e.pointerId !== btnId) return;
    btnId = null;
    shootBtn.classList.remove('down');
    game.chargeEnd();
  };
  shootBtn.addEventListener('pointerup', btnUp);
  shootBtn.addEventListener('pointercancel', btnUp);

  let spaceDown = false;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    audio.init();
    if (game.state === 'replay' || (game.state === 'result' && e.code !== 'Space')) {
      game.skip();
      return;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') game.keys.left = true;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') game.keys.right = true;
    else if (e.code === 'Space') {
      e.preventDefault();
      if (game.chargeStart()) spaceDown = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') game.keys.left = false;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') game.keys.right = false;
    else if (e.code === 'Space' && spaceDown) {
      spaceDown = false;
      game.chargeEnd();
    }
  });
  window.addEventListener('blur', () => {
    game.keys.left = game.keys.right = false;
  });
}

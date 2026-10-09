// Loading screen: a big percentage that fills like water from left to right, then the camera
// "zooms into" the middle 0 and the page appears through it.
// orange on the first visit of a session, blue on the customize page.
// API for pages that load heavy stuff: window.__loader.progress(0..1) and window.__loader.finish().
const html = document.documentElement;
const el = document.getElementById('loader');

if (!el || !html.classList.contains('loading')) {
  window.__loader = { progress() {}, finish() {} };
} else {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blue = /customize/.test(location.pathname);
  const COLOR = blue ? '#35b8e8' : '#ff6a1f';
  const COLOR_LIGHT = blue ? 'rgba(120,214,246,.5)' : 'rgba(255,150,90,.5)';
  const BG = '#070b0e';
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const off = document.createElement('canvas'), octx = off.getContext('2d');
  let W = 0, H = 0, dpr = 1, fontPx = 100;
  const state = { real: 0, shown: 0, done: false, zoomStarted: false, t0: performance.now() };
  const MIN_MS = reduce ? 500 : 2200; // the count never finishes faster than this

  const fontStr = () => `600 ${fontPx}px Jost, "Noto Sans Thai", system-ui, sans-serif`;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = off.width = Math.round(W * dpr); cv.height = off.height = Math.round(H * dpr);
    fontPx = Math.min(W * 0.3, H * 0.34, 340);
  }
  size();
  addEventListener('resize', () => { if (!state.zoomStarted) size(); });

  // layout of the number "100": returns the centre of the middle 0
  function layout(str) {
    ctx.font = fontStr();
    const w = ctx.measureText(str).width;
    const m0 = ctx.measureText('0');
    const asc = m0.actualBoundingBoxAscent, desc = m0.actualBoundingBoxDescent;
    const base = H / 2 + (asc - desc) / 2;
    return { x0: W / 2 - w / 2, w, base, asc, desc };
  }

  function drawNumber(p, t) {
    const str = String(Math.round(p * 100));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H); octx.clearRect(0, 0, W, H);
    const L = layout(str);
    ctx.font = fontStr(); ctx.textBaseline = 'alphabetic';
    // faint outline of the whole number
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillText(str, L.x0, L.base);
    // the "water": polygons (front moves left -> right) clipped to the glyph shapes
    const top = L.base - L.asc - 30, bot = L.base + L.desc + 30;
    const front = p >= 1 ? L.x0 + L.w + 200 : L.x0 + p * L.w;
    const wave = (off2, amp, k, ph) => {
      octx.beginPath();
      octx.moveTo(L.x0 - 200, top);
      for (let y = top; y <= bot; y += 5) octx.lineTo(front + off2 + amp * Math.sin(y * k + ph), y);
      octx.lineTo(L.x0 - 200, bot);
      octx.closePath();
    };
    octx.globalCompositeOperation = 'source-over';
    octx.fillStyle = COLOR_LIGHT; wave(26 * (1 - Math.min(p, 1)) + 16, 9, 0.045, t * 3.2); octx.fill(); // lighter wave behind
    octx.fillStyle = COLOR; wave(0, 6, 0.06, -t * 4.5); octx.fill(); // main water edge
    octx.globalCompositeOperation = 'destination-in'; // keep the water only where the number is
    octx.font = fontStr(); octx.textBaseline = 'alphabetic'; octx.fillStyle = '#000';
    octx.fillText(str, L.x0, L.base);
    octx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0, W, H);
    return L;
  }

  // final frame: dark plate + filled "100", transparent only inside the middle 0
  function buildPlate(L) {
    const f = document.createElement('canvas'); f.width = Math.round(W); f.height = Math.round(H);
    const fx = f.getContext('2d', { willReadFrequently: true });
    fx.fillStyle = BG; fx.fillRect(0, 0, f.width, f.height);
    fx.font = fontStr(); fx.textBaseline = 'alphabetic'; fx.fillStyle = COLOR;
    fx.fillText('100', L.x0, L.base);
    // glyph coverage (to find the 0's counter)
    const g = document.createElement('canvas'); g.width = f.width; g.height = f.height;
    const gx = g.getContext('2d', { willReadFrequently: true });
    gx.font = fontStr(); gx.textBaseline = 'alphabetic'; gx.fillStyle = '#000';
    gx.fillText('100', L.x0, L.base);
    const gd = gx.getImageData(0, 0, g.width, g.height).data;
    const w = g.width, h = g.height, solid = i => gd[i * 4 + 3] > 127;
    const w1 = gx.measureText('1').width, w0 = gx.measureText('0').width;
    let sx = Math.round(L.x0 + w1 + w0 * 1.5), sy = Math.round(L.base - (L.asc - L.desc) / 2); // centre of the middle 0
    let guard = 0;
    while (solid(sy * w + sx) && guard++ < 80) sx += 2; // nudge off the stroke if needed
    const hole = new Uint8Array(w * h);
    const stack = [sy * w + sx]; hole[stack[0]] = 1;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue; // never leak outside
      for (const j of [i - 1, i + 1, i - w, i + w]) { if (!hole[j] && !solid(j)) { hole[j] = 1; stack.push(j); } }
    }
    const img = fx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < w * h; i++) {
      if (hole[i]) d[i * 4 + 3] = 0;
      else if (gd[i * 4 + 3] < 255 && (hole[i - 1] || hole[i + 1] || hole[i - w] || hole[i + w])) d[i * 4 + 3] = gd[i * 4 + 3]; // soft edge
    }
    fx.putImageData(img, 0, 0);
    return { plate: f, cx: sx, cy: sy, hw: (maxX - minX) / 2 || 20, hh: (maxY - minY) / 2 || 30 };
  }

  function finish() { state.done = true; }
  window.__loader = { progress: v => { state.real = Math.max(state.real, Math.min(v, 1)); }, finish };

  function startZoom(L) {
    state.zoomStarted = true;
    const done = () => {
      html.classList.remove('loading');
      el.remove();
      try { sessionStorage.setItem('rocket:seen', '1'); } catch { /* storage unavailable */ }
      document.dispatchEvent(new Event('rocket:revealed'));
    };
    html.classList.add('ld-reveal');
    document.dispatchEvent(new Event('rocket:revealing'));
    if (reduce) { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(done, 320); return; }
    const mk = buildPlate(L);
    const far = Math.max(Math.hypot(mk.cx, mk.cy), Math.hypot(W - mk.cx, mk.cy), Math.hypot(mk.cx, H - mk.cy), Math.hypot(W - mk.cx, H - mk.cy));
    const S = (far / Math.min(mk.hw, mk.hh)) * 1.1;
    el.style.background = 'transparent'; // from now on the canvas itself is the plate (with a see-through 0)
    const DUR = 1500, t0 = performance.now();
    const frame = now => {
      const k = Math.min((now - t0) / DUR, 1), e = k * k * k; // slow start, accelerating push-in
      const s = Math.pow(S, e);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * mk.cx * (1 - s), dpr * mk.cy * (1 - s));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(mk.plate, 0, 0, W, H);
      if (k < 1) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  }

  let last = performance.now(), phase = 0;
  const tick = now => {
    if (state.zoomStarted) return;
    const dt = Math.min(now - last, 60); last = now; phase += dt / 1000;
    const timeP = Math.min((now - state.t0) / MIN_MS, 1);
    // never ahead of real progress; stays a hair below 100 until the page says it is ready
    const target = Math.min(timeP, state.done ? 1 : Math.min(state.real, 0.99));
    state.shown += (target - state.shown) * Math.min(dt / 140, 1);
    if (target >= 1 && state.shown > 0.997) state.shown = 1;
    const L = drawNumber(state.shown, phase);
    if (state.shown >= 1) {
      drawNumber(1, phase);
      setTimeout(() => startZoom(layoutFinal()), reduce ? 0 : 280);
      state.zoomStarted = true; // stop further ticks; zoom takes over
      return;
    }
    requestAnimationFrame(tick);
  };
  const layoutFinal = () => layout('100');

  // pages without heavy work are "ready" once everything has loaded
  const ready = () => { if (!window.__loaderManual) { state.real = 1; state.done = true; } };
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready, { once: true });
  setTimeout(() => { state.done = true; state.real = 1; }, 15000); // failsafe

  (document.fonts?.load ? document.fonts.load('600 100px Jost').catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(tick));
}

// Motion layer: wordmark animation, starfield that reacts to scroll/swipe speed,
// scroll progress, staggered reveals and count-up numbers. No libraries.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);

/* ---------- count-up ---------- */
window.countUp = (el, to, suffix = '', ms = 1400) => {
  if (!el) return;
  if (reduce) { el.textContent = to + suffix; return; }
  const t0 = performance.now();
  const tick = now => {
    const k = clamp((now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e) + suffix;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
// start entrance animations once the loading screen has revealed the page
const whenRevealed = fn => (document.documentElement.classList.contains('loading') ? document.addEventListener('rocket:revealing', fn, { once: true }) : fn());
whenRevealed(() => document.querySelectorAll('[data-count]').forEach(el => window.countUp(el, +el.dataset.count)));

/* ---------- wordmark: settle, shine, periodic glitch ---------- */
const word = $('word');
if (word && !reduce) whenRevealed(() => {
  setTimeout(() => word.classList.add('ready'), 2200); // after the letters have landed
  const glitch = () => {
    word.classList.add('glitch');
    setTimeout(() => word.classList.remove('glitch'), 460);
    setTimeout(glitch, 4200 + Math.random() * 3500);
  };
  setTimeout(glitch, 3200);
});

/* ---------- pointer parallax (intro) ---------- */
const intro = document.querySelector('.intro');
if (intro && !reduce) {
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    intro.style.setProperty('--mx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
    intro.style.setProperty('--my', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
  }, { passive: true });
}

/* ---------- staggered reveal ---------- */
document.querySelectorAll('.stag').forEach(g => {
  [...g.children].forEach((c, i) => c.style.setProperty('--k', i));
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { g.classList.add('in'); o.disconnect(); } }, { threshold: 0.2 }).observe(g);
});

/* ---------- scroll-linked values ---------- */
let lastY = scrollY, vel = 0;
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty('--sp', max > 0 ? (scrollY / max).toFixed(4) : 0);
  if (intro && !reduce) intro.style.setProperty('--p', clamp(scrollY / innerHeight).toFixed(4));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- starfield: streaks stretch with scroll / swipe speed ---------- */
const cv = document.body.dataset.stars === 'off' ? null : $('stars'); // the customize page keeps the GPU for the 3D view
if (cv && !reduce) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, stars = [];
  const seed = () => {
    const n = innerWidth < 700 ? 70 : 150;
    stars = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8,
      c: Math.random() < 0.12 ? '255,160,110' : Math.random() < 0.2 ? '159,232,255' : '255,255,255',
    }));
  };
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  };
  size(); addEventListener('resize', size);
  let last = performance.now();
  const frame = now => {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(now - last, 50); last = now;
    const dy = scrollY - lastY; lastY = scrollY;
    vel += (dy - vel) * 0.18; // smoothed px per frame
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const base = 0.012 * dt; // slow upward drift
    for (const s of stars) {
      s.y -= (base + vel * 0.0016) * s.z; // fraction of screen height
      if (s.y < -0.05) s.y = 1.05; else if (s.y > 1.05) s.y = -0.05;
      const x = s.x * innerWidth, y = s.y * innerHeight;
      const len = Math.min(Math.abs(vel) * s.z * 1.3, 70);
      ctx.strokeStyle = `rgba(${s.c},${0.12 + s.z * 0.38})`;
      ctx.lineWidth = s.z * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + Math.sign(vel || 1) * (len + 0.1));
      ctx.stroke();
    }
  };
  requestAnimationFrame(frame);
}

/* ---------- home stats from the manifest ---------- */
if ($('st-parts')) {
  fetch('rocket3d/parts_manifest.json').then(r => r.json()).then(j => {
    const parts = j.parts;
    whenRevealed(() => {
      window.countUp($('st-parts'), parts.length);
      window.countUp($('st-docs'), Math.round(parts.filter(p => p.accuracy === 'documented').length / parts.length * 100), '%');
    });
  }).catch(() => { $('st-parts').textContent = '145'; $('st-docs').textContent = '40%'; });
}

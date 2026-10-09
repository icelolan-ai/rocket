// Customize section: live 3D rocket (left) + options panel (right).
// Shares model/paint/explode code with rocket3d/viewer.html. The page scrolls normally;
// disassembly is controlled only by the button / slider.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Manifest, loadModel, unloadGLB } from '../rocket3d/model.js';
import { VEHICLES, SWATCHES, FINISHES, loadSaved, saveState, makeShadow, placeShadow, zoomStep, focusBox, pointerModes, keepTargetInside } from '../rocket3d/common.js';
import { t, partName, partNameAlt, zoneLabel, onLang } from '../rocket3d/i18n.js';

const $ = id => document.getElementById(id);
const stage = $('hero-stage'), canvas = $('gl3d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = { manifest: null, veh: null, model: null, base: null, sel: null, token: 0, dirty: true, anim: null, visible: true, idleAt: 0 };
const DIR0 = new THREE.Vector3(0.5, 0.06, 1).normalize();
let renderer, scene, camera, controls, boxHelper, shadow;

/* ---------------- three.js ---------------- */
function setup() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // softer, more filmic response: whites keep their shading instead of blowing out
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight(0xfff1e0, 1.5); // warm key from the upper right
  key.position.set(50, 70, 60);
  const rim = new THREE.DirectionalLight(0x9fd8ee, 0.7); // cool rim to separate the rocket from the backdrop
  rim.position.set(-60, 30, -50);
  const fill = new THREE.DirectionalLight(0x8aa6b8, 0.18);
  fill.position.set(-40, 10, 60);
  scene.add(key, rim, fill, new THREE.HemisphereLight(0xaac4d2, 0x0d151a, 0.18));
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = true; // wheel / pinch zoom, towards the cursor so small parts can be inspected
  controls.zoomSpeed = 1.2;
  controls.screenSpacePanning = true; // right-drag pans (mouse only; touch pinch is pure zoom)
  pointerModes(controls, canvas, document.getElementById('z-hand'));
  window.__cu = { controls, camera };
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { S.idleAt = performance.now(); });
  controls.addEventListener('change', () => { keepTargetInside(controls, camera, S.limit); invalidate(); });
  canvas.style.touchAction = 'pan-y'; // vertical one-finger swipes scroll the page; pinch / drag go to the 3D view
  boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0x35b8e8);
  boxHelper.visible = false;
  shadow = makeShadow();
  scene.add(boxHelper, shadow);
  new ResizeObserver(resize).observe(stage);
  resize();
  new IntersectionObserver(es => { S.visible = es[0].isIntersecting; invalidate(); }).observe(stage);
  requestAnimationFrame(loop);
}
const invalidate = () => { S.dirty = true; };
function resize() {
  const r = stage.getBoundingClientRect();
  if (!renderer || !r.width) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (S.base) frame(S.model.t > 0.05 ? S.model.box(S.model.meshes) : S.base, true);
  invalidate();
}
function frame(box, keepDir = false) {
  if (box.isEmpty()) return;
  if (S.base) { const s = S.base.getSize(new THREE.Vector3()); S.limit = S.base.clone().expandByScalar(Math.max(s.x, s.y, s.z) * 0.3 + 15); }
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = Math.max(sz.x, sz.z);
  const dist = (Math.max(sz.y / 2 / tan, w / 2 / (tan * camera.aspect)) + w / 2) * 1.12;
  const dir = keepDir ? camera.position.clone().sub(controls.target).normalize() : DIR0.clone();
  camera.position.copy(c).addScaledVector(dir, dist);
  camera.near = 0.2; camera.far = dist * 40;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
  controls.minDistance = 1.5; controls.maxDistance = dist * 4;
  controls.update();
  invalidate();
}
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function loop(now) {
  requestAnimationFrame(loop);
  if (!S.visible) return;
  if (!reduceMotion && !controls.autoRotate && S.idleAt && now - S.idleAt > 6000 && !S.sel && !S.anim) { controls.autoRotate = true; S.idleAt = 0; }
  stepAnim(now);
  if (controls.update()) S.dirty = true;
  if (S.dirty) { S.dirty = false; renderer.render(scene, camera); }
}

/* ---------------- loading a vehicle ---------------- */
async function loadVehicle(key) {
  const v = VEHICLES.find(x => x.key === key), token = ++S.token;
  $('loading3d').classList.remove('done');
  $('loading3d').querySelector('span').textContent = t('cu.loadingV', { name: v.label });
  try {
    const model = await loadModel(`rocket3d/models/${v.file}.glb`, S.manifest, key, f => window.__loader?.progress(0.12 + f * 0.72));
    if (token !== S.token) { model.dispose(); return; }
    if (S.model) { const prev = S.veh; S.model.dispose(); unloadGLB(`rocket3d/models/${prev.file}.glb`); }
    S.veh = v; S.model = model; S.sel = null;
    scene.add(model.root);
    const saved = loadSaved(key);
    if (saved?.paint) model.importPaint(saved.paint);
    const variant = model.variantNames.includes(saved?.variant) ? saved.variant : v.variant;
    if (model.variantNames.length) await model.setVariant(variant);
    $('explode-btn').setAttribute('aria-pressed', 'false');
    S.base = model.box(model.meshes);
    applyExplode(0);
    frame(S.base);
    buildVehicleUI();
    updateSelectionUI();
    $('loading3d').classList.add('done');
    window.__loader?.progress(0.97);
    requestAnimationFrame(() => requestAnimationFrame(() => window.__loader?.finish())); // after the first rendered frame
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('span').innerHTML = t('cu.loadErr');
    window.__loader?.finish();
  }
}

/* ---------------- vehicle / variant / specs ---------------- */
function buildVehicleUI() {
  const m = S.model, h = S.base.getSize(new THREE.Vector3()).y;
  document.querySelectorAll('#veh button').forEach(b => b.setAttribute('aria-checked', b.dataset.key === S.veh.key));
  $('panel-title').textContent = S.veh.label;
  $('sp-model').textContent = S.veh.label;
  $('sp-height').textContent = `${h.toFixed(1)} m`;
  $('sp-parts').textContent = m.partIds().length;
  const box = $('variants');
  box.innerHTML = '';
  $('variant-sec').hidden = !m.variantNames.length;
  for (const n of m.variantNames) {
    const b = document.createElement('button');
    b.dataset.v = n; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', n === m.variant);
    b.onclick = async () => {
      await m.setVariant(n);
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
      saveState(S.veh.key, { variant: n }); invalidate(); updatePaintUI();
    };
    box.append(b);
  }
  renderLabels();
  renderPartsList();
}
// text that depends on the language
function renderLabels() {
  document.querySelectorAll('#variants button').forEach(b => { b.textContent = t('var.' + b.dataset.v); b.title = t('varL.' + b.dataset.v); });
  document.querySelectorAll('#swatches button').forEach(b => b.setAttribute('aria-label', t('cu.swatch', { c: b.dataset.c })));
  const lo = $('loading3d').querySelector('span');
  if (!$('loading3d').classList.contains('done') && S.veh) lo.textContent = t('cu.loadingV', { name: S.veh.label });
}

/* ---------------- explode (button / slider only) ---------------- */
function applyExplode(tt) {
  const m = S.model; if (!m) return;
  m.setExplode(tt);
  $('explode').value = tt;
  $('explode-out').textContent = `${Math.round(tt * 100)}%`;
  placeShadow(shadow, m.box(m.meshes.filter(x => x.visible)));
  updateHighlight();
  invalidate();
}
function animateTo(to) {
  S.anim = { from: S.model.t, to, t0: performance.now(), dur: 1800 * Math.abs(to - S.model.t) + 200 };
  $('explode-btn').setAttribute('aria-pressed', to === 1);
  controls.autoRotate = false;
  invalidate();
}
function stepAnim(now) {
  const a = S.anim; if (!a) return;
  const k = Math.min((now - a.t0) / a.dur, 1);
  applyExplode(k >= 1 ? a.to : a.from + (a.to - a.from) * ease(k)); // ends on the exact value
  if (k >= 1) { S.anim = null; frame(a.to === 1 ? S.model.box(S.model.meshes) : S.base, true); }
}
$('explode-btn').onclick = () => { if (S.model) animateTo(S.model.t < 0.5 ? 1 : 0); };
$('explode').addEventListener('input', e => {
  S.anim = null; controls.autoRotate = false;
  applyExplode(+e.target.value);
  $('explode-btn').setAttribute('aria-pressed', +e.target.value >= 0.5);
});
$('explode').addEventListener('change', () => frame(S.model.t > 0.05 ? S.model.box(S.model.meshes) : S.base, true));

/* ---------------- parts list / selection ---------------- */
function renderPartsList() {
  const ids = S.model.partIds().sort(), q = $('parts-search').value.trim().toLowerCase(), ul = $('parts-list');
  $('parts-count').textContent = `(${ids.length})`;
  ul.innerHTML = '';
  for (const id of ids) {
    const p = S.manifest.get(id), label = partName(p, id);
    if (q && !`${id} ${p?.name_th ?? ''} ${p?.name_en ?? ''}`.toLowerCase().includes(q)) continue;
    const li = document.createElement('li'), b = document.createElement('button');
    b.dataset.id = id; b.innerHTML = '<b></b><code></code>';
    b.firstChild.textContent = label; b.lastChild.textContent = id;
    if (S.sel?.pid === id) b.classList.add('on');
    b.onclick = () => select(id);
    li.append(b); ul.append(li);
  }
}
$('parts-search').addEventListener('input', renderPartsList);

function select(pid, mesh) {
  const m = S.model;
  mesh ??= pid && (m.meshesOf(pid)[0] ?? m.meshesUnder(pid)[0]);
  S.sel = pid ? { pid, mesh } : null;
  if (pid) controls.autoRotate = false;
  updateSelectionUI();
}
const accHtml = acc => (acc ? `<span class="acc" data-l="${acc}">${t('accn.' + acc)}</span>` : `<span class="acc">${t('cu.unknown')}</span>`);
function updateSelectionUI() {
  const sel = S.sel, p = sel && S.manifest.get(sel.pid), chip = $('chip');
  document.querySelectorAll('#parts-list button').forEach(b => b.classList.toggle('on', !!sel && b.dataset.id === sel.pid));
  chip.hidden = !sel;
  $('info').hidden = !sel; $('info-empty').hidden = !!sel;
  if (sel) {
    chip.innerHTML = `<span></span><code></code>${p?.accuracy ? accHtml(p.accuracy) : ''}`;
    chip.firstChild.textContent = partName(p, sel.pid); chip.children[1].textContent = sel.pid;
    $('d-th').textContent = partName(p, sel.pid);
    $('d-en').textContent = p ? partNameAlt(p) : t('cu.noManifest');
    $('d-id').textContent = sel.pid;
    $('d-acc').innerHTML = `${accHtml(p?.accuracy)} <small>${p?.accuracy ? t('acc.' + p.accuracy) : ''}</small>`;
    $('d-mat').textContent = p?.material && p.material !== '-' ? p.material : (sel.mesh?._baseMat?.name ?? '-');
    const z = sel.mesh && S.model.zoneOf(sel.mesh);
    $('d-zone').textContent = z ? `${z}${zoneLabel(S.manifest, z) ? ` (${zoneLabel(S.manifest, z)})` : ''}` : '-';
    $('isolate').textContent = S.model.isolated === sel.pid ? t('cu.unisolate') : t('cu.isolate');
  }
  updatePaintUI(); updateHighlight();
}
function updateHighlight() {
  const sel = S.sel, m = S.model;
  if (!sel || !m) { boxHelper.visible = false; invalidate(); return; }
  const meshes = m.meshesUnder(sel.pid).filter(x => x.visible && (!sel.mesh?.isInstancedMesh || x.isInstancedMesh));
  const b = m.box(meshes);
  boxHelper.visible = !b.isEmpty();
  boxHelper.box.copy(b);
  invalidate();
}
$('isolate').onclick = () => { const s = S.sel; if (!s) return; S.model.setIsolated(S.model.isolated === s.pid ? null : s.pid); updateSelectionUI(); invalidate(); };
$('showall').onclick = () => { S.model.showAll(); updateSelectionUI(); invalidate(); };

/* ---------------- zoom / focus ---------------- */
const selBox = () => {
  const sel = S.sel, m = S.model;
  if (!sel || !m) return null;
  return m.box(m.meshesUnder(sel.pid).filter(x => x.visible && (!sel.mesh?.isInstancedMesh || x.isInstancedMesh)));
};
const fitAll = () => { controls.autoRotate = false; focusBox(camera, controls, S.model.t > 0.05 ? S.model.box(S.model.meshes) : S.base, invalidate, 1.15); };
$('z-in').onclick = () => { controls.autoRotate = false; zoomStep(camera, controls, 0.6, invalidate); };
$('z-out').onclick = () => { controls.autoRotate = false; zoomStep(camera, controls, 1.6, invalidate); };
$('z-fit').onclick = () => S.model && fitAll();
$('z-focus').onclick = () => { const b = selBox(); controls.autoRotate = false; b ? focusBox(camera, controls, b, invalidate) : S.model && fitAll(); };

/* ---------------- picking ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const visibleDeep = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function pick(ev) {
  if (!S.model) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObject(S.model.root, true)) {
    if (h.object._pid && visibleDeep(h.object)) return { pid: h.object._pid, mesh: h.object };
  }
  return null;
}
let down = null, lastTap = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 5 || dt > 600) return; // camera drag, not a click
  const h = pick(e);
  h ? select(h.pid, h.mesh) : select(null);
  // double-click / double-tap: focus the part (or fit everything when tapping empty space)
  const now = performance.now();
  if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) {
    lastTap = null;
    const b = h ? selBox() : null;
    controls.autoRotate = false;
    b ? focusBox(camera, controls, b, invalidate) : fitAll();
  } else lastTap = { t: now, x: e.clientX, y: e.clientY };
});
let hoverQueued = false;
canvas.addEventListener('pointermove', e => {
  if (e.buttons || hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => { hoverQueued = false; canvas.style.cursor = pick(e) ? 'pointer' : ''; });
});

/* ---------------- paint ---------------- */
const hexOk = v => /^#[0-9a-f]{6}$/i.test(v);
function hex2hsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  return [h, s * 100, l * 100];
}
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}
let recent = [];
try { recent = JSON.parse(localStorage.getItem('rocket3d:recent') || '[]').filter(hexOk).slice(0, 8); } catch { /* storage unavailable */ }
function pushRecent(hex) {
  recent = [hex, ...recent.filter(c => c !== hex)].slice(0, 8);
  try { localStorage.setItem('rocket3d:recent', JSON.stringify(recent)); } catch { /* storage unavailable */ }
  renderRecent();
}
function renderRecent() {
  const box = $('recent'); box.textContent = '';
  for (const c of recent) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.setProperty('--sw', c); b.dataset.c = c; b.setAttribute('aria-label', t('cu.swatch', { c }));
    b.onclick = () => paint(c);
    box.append(b);
  }
}
function setMixUI(hex) {
  $('color').value = hex; $('hex').value = hex.slice(1);
  const [h, s, l] = hex2hsl(hex);
  $('c-h').value = Math.round(h); $('c-s').value = Math.round(s); $('c-l').value = Math.round(l);
  $('c-s').style.setProperty('--from', hsl2hex(h, 0, l)); $('c-s').style.setProperty('--to', hsl2hex(h, 100, l));
  $('c-l').style.setProperty('--mid', hsl2hex(h, s, 50));
}
function updatePaintUI() {
  const sel = S.sel, wrapEl = $('paint'), matEl = $('material'), hint = $('paint-hint');
  hint.title = '';
  const off = on => { wrapEl.classList.toggle('off', on); matEl.classList.toggle('off', on); };
  if (!sel?.mesh) { off(true); hint.textContent = t('cu.paint.none'); return; }
  const m = S.model, p = S.manifest.get(sel.pid), name = partName(p, sel.pid);
  if (!m.isPaintable(sel.mesh)) {
    off(true); hint.textContent = t('cu.paint.no', { name });
    hint.title = t('cu.paint.why', { m: sel.mesh._baseMat?.name ?? '?' });
    return;
  }
  off(false);
  hint.textContent = name;
  const cur = (m.colorOf(sel.mesh) ?? m.defaultColor(sel.mesh)).toLowerCase();
  setMixUI(cur);
  document.querySelectorAll('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.c === cur));
  const fin = m.finishOf(sel.mesh), has = !!m.paint.fin?.[sel.pid];
  $('m-r').value = Math.round(fin.r * 100); $('m-m').value = Math.round(fin.m * 100);
  document.querySelectorAll('#finishes button').forEach(b => {
    const f = FINISHES.find(x => x.key === b.dataset.k);
    b.setAttribute('aria-pressed', String(f ? has && Math.abs(f.r - fin.r) < 0.01 && Math.abs(f.m - fin.m) < 0.01 : !has));
  });
}
const persist = () => saveState(S.veh.key, { paint: S.model.exportPaint() });
function paint(hex, keepRecent = false) {
  const sel = S.sel; if (!sel?.mesh || !hexOk(hex)) return;
  S.model.setColor(sel.mesh, hex.toLowerCase(), 'part'); // all instances of the part
  persist(); updatePaintUI(); invalidate();
  if (!keepRecent) pushRecent(hex.toLowerCase());
}
function finish(fin) {
  const sel = S.sel; if (!sel?.mesh) return;
  S.model.setFinish(sel.mesh, fin);
  persist(); updatePaintUI(); invalidate();
}
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.c = c; b.style.setProperty('--sw', c);
  b.onclick = () => paint(c, true);
  $('swatches').append(b);
}
let paintRaf = 0;
const live = hex => { cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(() => paint(hex, true)); };
$('color').addEventListener('input', e => live(e.target.value));
$('color').addEventListener('change', e => pushRecent(e.target.value.toLowerCase()));
$('hex').addEventListener('input', e => { const v = '#' + e.target.value.replace(/[^0-9a-f]/gi, ''); if (v.length === 7) live(v); });
$('hex').addEventListener('change', e => { const v = '#' + e.target.value.replace(/[^0-9a-f]/gi, ''); if (v.length === 7) pushRecent(v.toLowerCase()); });
const hsl = () => hsl2hex(+$('c-h').value, +$('c-s').value, +$('c-l').value);
for (const id of ['c-h', 'c-s', 'c-l']) { $(id).addEventListener('input', () => live(hsl())); $(id).addEventListener('change', () => pushRecent(hsl())); }
{ // finishes
  const box = $('finishes');
  const mk = (k, label, onclick) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.setAttribute('aria-pressed', 'false'); b.dataset.fin = k; b.textContent = label; b.onclick = onclick; box.append(b); return b; };
  mk('original', t('fin.original'), () => finish(null));
  for (const f of FINISHES) mk(f.key, t('fin.' + f.key), () => finish(f));
}
const slFinish = () => finish({ r: $('m-r').value / 100, m: $('m-m').value / 100 });
$('m-r').addEventListener('input', () => { cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(slFinish); });
$('m-m').addEventListener('input', () => { cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(slFinish); });
$('apply-all').onclick = () => {
  const sel = S.sel; if (!sel?.mesh || !S.model.isPaintable(sel.mesh)) return;
  S.model.paintAll({ hex: S.model.colorOf(sel.mesh) ?? S.model.defaultColor(sel.mesh), fin: S.model.paint.fin?.[sel.pid] ?? null });
  persist(); updatePaintUI(); invalidate();
};
$('reset-part').onclick = () => { if (S.sel) { S.model.resetPaint(S.sel.pid); persist(); updatePaintUI(); invalidate(); } };
$('reset-all').onclick = () => { S.model.resetPaint(); persist(); updatePaintUI(); invalidate(); };
renderRecent();
onLang(() => { renderRecent(); document.querySelectorAll('#finishes button').forEach(b => { b.textContent = t('fin.' + b.dataset.k); }); });

/* ---------------- vehicle switch ---------------- */
VEHICLES.forEach((v, i) => {
  const li = document.createElement('li'), b = document.createElement('button');
  b.dataset.key = v.key; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
  b.innerHTML = `<span>00${i + 1}</span><b></b>`;
  b.lastChild.textContent = v.label; b.lastChild.style.fontWeight = 'inherit';
  b.onclick = () => { if (S.veh?.key !== v.key) loadVehicle(v.key); };
  li.append(b); $('veh').append(li);
});
/* ---------------- language ---------------- */
onLang(() => {
  if (!S.model) return;
  renderLabels();
  renderPartsList();
  updateSelectionUI();
});

/* ---------------- boot ---------------- */
const whenNear = el => new Promise(res => { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: '500px' }); io.observe(el); });
async function boot() {
  try {
    setup();
    S.manifest = await Manifest.load('rocket3d/parts_manifest.json');
    window.__loader?.progress(0.12);
    const parts = S.manifest.json.parts;
    window.countUp?.($('st-parts'), parts.length);
    window.countUp?.($('st-docs'), Math.round(parts.filter(p => p.accuracy === 'documented').length / parts.length * 100), '%');
    await whenNear(stage); // fetch the ~3 MB model only when the lab is about to be seen
    const want = new URLSearchParams(location.search).get('v');
    await loadVehicle(VEHICLES.some(v => v.key === want) ? want : 'f9');
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('i').hidden = true;
    $('loading3d').querySelector('span').innerHTML = t('cu.webgl');
    window.__loader?.finish();
  }
}
boot();
window.__hero = { S, controls, get camera() { return camera; }, select, applyExplode, loadVehicle };

// Home-page hero: live 3D rocket (shares model/paint/explode code with rocket3d/viewer.html)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Manifest, loadModel, unloadGLB } from '../rocket3d/model.js';
import { VEHICLES, SWATCHES, ACC_TH, loadSaved, saveState, makeShadow, placeShadow } from '../rocket3d/common.js';

const $ = id => document.getElementById(id);
const stage = $('hero-stage'), canvas = $('gl3d');
const whenNear = el => new Promise(res => { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { rootMargin: '500px' }); io.observe(el); });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = { manifest: null, veh: null, model: null, base: null, sel: null, token: 0, dirty: true, anim: null, visible: true, idleAt: 0 };
let renderer, scene, camera, controls, boxHelper, shadow;

/* ---------------- three.js ---------------- */
function setup() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(40, 70, 60);
  const rim = new THREE.DirectionalLight(0x9fe8ff, 1.1); // cool rim light to match the teal backdrop
  rim.position.set(-60, 30, -40);
  scene.add(key, rim, new THREE.HemisphereLight(0xcfe9f2, 0x1a2a33, 0.4));
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = false; // the wheel would hijack page scroll; enabled once the canvas has focus
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.9;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  controls.addEventListener('end', () => { S.idleAt = performance.now(); });
  controls.addEventListener('change', invalidate);
  canvas.style.touchAction = 'pan-y'; // vertical swipes still scroll the page on phones
  canvas.addEventListener('focus', () => { controls.enableZoom = true; });
  canvas.addEventListener('blur', () => { controls.enableZoom = false; });
  boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xff6a1f);
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
  if (S.base) frame(S.model?.t > 0.05 ? S.model.box(S.model.meshes) : S.base, true);
  invalidate();
}
function frame(box, keepDir = false) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = Math.max(sz.x, sz.z);
  const dist = (Math.max(sz.y / 2 / tan, w / 2 / (tan * camera.aspect)) + w / 2) * 1.08;
  const dir = keepDir ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(0.5, 0.06, 1).normalize();
  camera.position.copy(c).addScaledVector(dir, dist);
  camera.near = dist / 200; camera.far = dist * 40;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
  controls.minDistance = dist * 0.05; controls.maxDistance = dist * 4;
  controls.update();
  invalidate();
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!S.visible) return;
  if (!reduceMotion && !controls.autoRotate && S.idleAt && now - S.idleAt > 6000 && !S.sel) { controls.autoRotate = true; S.idleAt = 0; }
  stepAnim(now);
  if (controls.update()) S.dirty = true;
  if (S.dirty) { S.dirty = false; renderer.render(scene, camera); }
}

/* ---------------- loading a vehicle ---------------- */
async function loadVehicle(key) {
  const v = VEHICLES.find(x => x.key === key), token = ++S.token;
  $('loading3d').classList.remove('done');
  $('loading3d').querySelector('span').textContent = `กำลังโหลด ${v.label}…`;
  try {
    const model = await loadModel(`rocket3d/models/${v.file}.glb`, S.manifest, key);
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
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('span').innerHTML = 'โหลดโมเดลไม่สำเร็จ — <a href="rocket3d/viewer.html" style="text-decoration:underline">เปิด 3D Viewer</a>';
  }
}

/* ---------------- vehicle / variant / specs ---------------- */
function buildVehicleUI() {
  const m = S.model, h = S.base.getSize(new THREE.Vector3()).y;
  document.querySelectorAll('#veh button').forEach(b => b.setAttribute('aria-checked', b.dataset.key === S.veh.key));
  $('sp-model').textContent = S.veh.label;
  $('sp-height').textContent = `${h.toFixed(1)} m`;
  $('sp-parts').textContent = m.partIds().length;
  const box = $('variants');
  box.innerHTML = '';
  for (const n of m.variantNames) {
    const b = document.createElement('button');
    b.textContent = n.replace(/^SV_/, '').replace(/_/g, ' ');
    b.title = S.manifest.variantLabels[n] ?? '';
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', n === m.variant);
    b.onclick = async () => {
      await m.setVariant(n);
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
      saveState(S.veh.key, { variant: n }); invalidate(); updatePaintUI();
    };
    box.append(b);
  }
  renderPartsList();
}

/* ---------------- explode ---------------- */
function applyExplode(t) {
  const m = S.model; if (!m) return;
  m.setExplode(t);
  $('explode').value = t;
  $('explode-out').textContent = `${Math.round(t * 100)}%`;
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
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  applyExplode(k >= 1 ? a.to : a.from + (a.to - a.from) * e); // ends on the exact value
  if (k >= 1) { S.anim = null; frame(a.to === 1 ? S.model.box(S.model.meshes) : S.base, true); }
}
$('explode-btn').onclick = () => { if (S.model) animateTo(S.model.t < 0.5 ? 1 : 0); };
$('explode').addEventListener('input', e => {
  S.anim = null; controls.autoRotate = false;
  applyExplode(+e.target.value);
  $('explode-btn').setAttribute('aria-pressed', +e.target.value >= 0.5);
});
$('explode').addEventListener('change', () => frame(S.model.t > 0.05 ? S.model.box(S.model.meshes) : S.base, true));

/* ---------------- parts drawer / selection ---------------- */
function renderPartsList() {
  const ids = S.model.partIds().sort(), q = $('parts-search').value.trim().toLowerCase(), ul = $('parts-list');
  $('parts-count').textContent = `(${ids.length})`;
  ul.innerHTML = '';
  for (const id of ids) {
    const p = S.manifest.get(id), label = p?.name_th ?? id;
    if (q && !`${id} ${label} ${p?.name_en ?? ''}`.toLowerCase().includes(q)) continue;
    const li = document.createElement('li'), b = document.createElement('button');
    b.dataset.id = id; b.innerHTML = '<b></b><code></code>';
    b.firstChild.textContent = label; b.lastChild.textContent = id;
    if (S.sel?.pid === id) b.classList.add('on');
    b.onclick = () => select(id);
    li.append(b); ul.append(li);
  }
}
$('parts-search').addEventListener('input', renderPartsList);
function setDrawer(open) {
  $('drawer').hidden = !open;
  $('open-parts').setAttribute('aria-expanded', open);
}
$('open-parts').onclick = () => setDrawer($('drawer').hidden);
$('close-drawer').onclick = () => setDrawer(false);

function select(pid, mesh) {
  const m = S.model;
  mesh ??= pid && (m.meshesOf(pid)[0] ?? m.meshesUnder(pid)[0]);
  S.sel = pid ? { pid, mesh } : null;
  if (pid) controls.autoRotate = false;
  updateSelectionUI();
}
function updateSelectionUI() {
  const sel = S.sel, p = sel && S.manifest.get(sel.pid), chip = $('chip');
  document.querySelectorAll('#parts-list button').forEach(b => b.classList.toggle('on', !!sel && b.dataset.id === sel.pid));
  chip.hidden = !sel;
  $('info').hidden = !sel;
  if (sel) {
    const acc = p?.accuracy;
    chip.innerHTML = `<span></span><code></code>${acc ? `<span class="acc" data-l="${acc}">${acc}</span>` : ''}`;
    chip.firstChild.textContent = p?.name_th ?? sel.pid; chip.children[1].textContent = sel.pid;
    $('d-th').textContent = p?.name_th ?? sel.pid;
    $('d-en').textContent = p?.name_en ?? 'ไม่มีข้อมูลใน parts_manifest.json';
    $('d-id').textContent = sel.pid;
    $('d-acc').innerHTML = acc ? `<span class="acc" data-l="${acc}">${acc} · ${ACC_TH[acc] ?? ''}</span>` : '<span class="acc">ไม่ทราบ</span>';
    $('d-mat').textContent = p?.material && p.material !== '-' ? p.material : (sel.mesh?._baseMat?.name ?? '-');
    const z = sel.mesh && S.model.zoneOf(sel.mesh);
    $('d-zone').textContent = z ? `${z} (${S.manifest.paintZones[z]?.label_th ?? ''})` : '-';
    $('isolate').textContent = S.model.isolated === sel.pid ? 'ยกเลิก Isolate' : 'Isolate';
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
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 5 || dt > 600) return; // camera drag, not a click
  const h = pick(e);
  h ? select(h.pid, h.mesh) : select(null);
});
let hoverQueued = false;
canvas.addEventListener('pointermove', e => {
  if (e.buttons || hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => { hoverQueued = false; canvas.style.cursor = pick(e) ? 'pointer' : ''; });
});

/* ---------------- paint ---------------- */
function updatePaintUI() {
  const sel = S.sel, wrap = $('paint'), hint = $('paint-hint');
  if (!sel?.mesh) { wrap.classList.add('off'); hint.textContent = 'เลือกชิ้นส่วนก่อน'; return; }
  const m = S.model, p = S.manifest.get(sel.pid);
  if (!m.isPaintable(sel.mesh)) { wrap.classList.add('off'); hint.textContent = `${p?.name_th ?? sel.pid}: เปลี่ยนสีไม่ได้`; hint.title = `วัสดุ ${sel.mesh._baseMat?.name ?? '?'} ไม่ใช่ MAT_PAINT_`; return; }
  wrap.classList.remove('off'); hint.title = '';
  hint.textContent = p?.name_th ?? sel.pid;
  const cur = m.colorOf(sel.mesh) ?? m.defaultColor(sel.mesh);
  $('color').value = cur;
  document.querySelectorAll('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.c === cur));
}
function paint(hex) {
  const sel = S.sel; if (!sel?.mesh) return;
  S.model.setColor(sel.mesh, hex, 'part'); // all instances of the part
  saveState(S.veh.key, { paint: S.model.exportPaint() });
  updatePaintUI(); invalidate();
}
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.dataset.c = c; b.style.setProperty('--sw', c); b.setAttribute('aria-label', `สี ${c}`);
  b.onclick = () => paint(c);
  $('swatches').append(b);
}
let paintRaf = 0;
$('color').addEventListener('input', e => { const v = e.target.value; cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(() => paint(v)); });
$('reset-part').onclick = () => { if (S.sel) { S.model.resetPaint(S.sel.pid); saveState(S.veh.key, { paint: S.model.exportPaint() }); updatePaintUI(); invalidate(); } };

/* ---------------- vehicle switch (list + cards) ---------------- */
VEHICLES.forEach((v, i) => {
  const li = document.createElement('li'), b = document.createElement('button');
  b.dataset.key = v.key; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
  b.innerHTML = `<span>00${i + 1}</span><small></small>`;
  b.lastChild.textContent = v.label;
  b.onclick = () => { if (S.veh?.key !== v.key) loadVehicle(v.key); };
  li.append(b); $('veh').append(li);
});
document.querySelectorAll('.rk [data-key]').forEach(el => el.addEventListener('click', () => {
  const key = el.dataset.key;
  document.getElementById('lab').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  if (S.veh?.key !== key) loadVehicle(key);
}));

/* ---------------- boot ---------------- */
async function boot() {
  try {
    setup();
    S.manifest = await Manifest.load('rocket3d/parts_manifest.json');
    const parts = S.manifest.json.parts;
    $('st-parts').textContent = parts.length;
    $('st-docs').textContent = `${Math.round(parts.filter(p => p.accuracy === 'documented').length / parts.length * 100)}%`;
    await whenNear(stage); // fetch the ~3 MB model only when the lab is about to be seen
    const want = new URLSearchParams(location.search).get('v');
    await loadVehicle(VEHICLES.some(v => v.key === want) ? want : 'f9');
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('i').hidden = true;
    $('loading3d').querySelector('span').innerHTML = 'เบราว์เซอร์นี้แสดง 3D ไม่ได้ — <a href="rocket3d/viewer.html" style="text-decoration:underline">ลองเปิด 3D Viewer</a>';
  }
}
boot();
window.__hero = { S, controls, select, applyExplode, loadVehicle, setDrawer };

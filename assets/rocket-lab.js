// Rocket Lab: live 3D rocket inside the home-page device frame.
// Reuses the model/paint/explode code of the full viewer (rocket3d/model.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Manifest, loadModel, unloadGLB } from '../rocket3d/model.js';
import { VEHICLES, SWATCHES, ACC_TH, loadSaved, saveState, makeShadow, placeShadow } from '../rocket3d/common.js';

const $ = id => document.getElementById(id);
const section = $('dynamics');
const stage = $('lab-stage');
const canvas = $('lab-gl');

const S = { manifest: null, veh: null, model: null, sel: null, token: 0, dirty: true, anim: null, visible: false, tab: 'assembly' };
let renderer, scene, camera, controls, boxHelper, shadow;

/* ---------------- three.js setup ---------------- */
function setup() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(40, 80, 60);
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.45));
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = false; // wheel would hijack page scrolling; enabled once the canvas has focus
  controls.addEventListener('change', invalidate);
  canvas.style.touchAction = 'pan-y'; // vertical swipe still scrolls the page on phones
  canvas.addEventListener('focus', () => { controls.enableZoom = true; });
  canvas.addEventListener('blur', () => { controls.enableZoom = false; });
  boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0x16171a);
  boxHelper.visible = false;
  shadow = makeShadow();
  scene.add(boxHelper, shadow);
  new ResizeObserver(resize).observe(stage);
  resize();
  new IntersectionObserver(es => { S.visible = es[0].isIntersecting; invalidate(); }).observe(stage);
  requestAnimationFrame(loop);
}
function invalidate() { S.dirty = true; }
function resize() {
  const r = stage.getBoundingClientRect();
  if (!renderer || !r.width) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  invalidate();
}
function frame(box) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = Math.max(sz.x, sz.z);
  const dist = (Math.max(sz.y / 2 / tan, w / 2 / (tan * camera.aspect)) + w / 2) * 1.12;
  camera.position.copy(c).addScaledVector(new THREE.Vector3(0.55, 0.16, 1).normalize(), dist);
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
  stepAnim(now);
  if (controls.update()) S.dirty = true;
  if (S.dirty) { S.dirty = false; renderer.render(scene, camera); }
}

/* ---------------- vehicle loading ---------------- */
async function loadVehicle(key) {
  const v = VEHICLES.find(x => x.key === key), token = ++S.token;
  $('lab-loading').classList.remove('done');
  $('lab-loading').querySelector('span').textContent = `กำลังโหลด ${v.label}…`;
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
    buildVehicleUI();
    applyExplode(0);
    S.base = model.box(model.meshes);
    frame(S.base);
    updateSpecs();
    updateSelectionUI();
    $('lab-loading').classList.add('done');
  } catch (e) {
    console.error(e);
    $('lab-loading').querySelector('span').innerHTML = `โหลดโมเดลไม่สำเร็จ — <a href="rocket3d/viewer.html" style="text-decoration:underline">เปิด 3D Viewer</a>`;
  }
}

/* ---------------- UI: vehicle / variant / specs ---------------- */
function buildVehicleUI() {
  const m = S.model;
  document.querySelectorAll('#lab-vehicles button').forEach(b => b.setAttribute('aria-checked', b.dataset.key === S.veh.key));
  const box = $('lab-variants');
  box.innerHTML = '';
  for (const n of m.variantNames) {
    const b = document.createElement('button');
    b.textContent = n.replace(/_/g, ' ');
    b.dataset.v = n; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', n === m.variant);
    b.title = S.manifest.variantLabels[n] ?? '';
    b.onclick = async () => {
      await m.setVariant(n);
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
      saveState(S.veh.key, { variant: n }); invalidate(); updatePaintUI();
    };
    box.append(b);
  }
  box.parentElement.querySelector('h4:nth-of-type(2)').hidden = box.hidden = !m.variantNames.length;
  $('lab-ghost').textContent = S.veh.code;
  $('tag-code').textContent = S.veh.code;
  $('tag-name').textContent = S.veh.label;
  buildPartsList();
}
function updateSpecs() {
  const m = S.model, h = S.base.getSize(new THREE.Vector3()).y;
  const ids = m.partIds();
  const docd = ids.filter(id => S.manifest.get(id)?.accuracy === 'documented').length;
  const set = (bar, val, text, frac) => { $('b-' + bar).style.setProperty('--w', `${Math.round(Math.min(frac, 1) * 100)}%`); $('v-' + bar).textContent = text; };
  set('h', 0, `${h.toFixed(1)} m`, h / 110.6);
  set('p', 0, String(ids.length), ids.length / 70);
  set('d', 0, `${Math.round((docd / ids.length) * 100)}%`, docd / ids.length);
}

/* ---------------- explode ---------------- */
function applyExplode(t) {
  const m = S.model; if (!m) return;
  m.setExplode(t);
  $('lab-explode').value = t;
  $('lab-explode-out').textContent = `${Math.round(t * 100)}%`;
  placeShadow(shadow, m.box(m.meshes.filter(x => x.visible)));
  updateHighlight();
  invalidate();
}
function animateTo(to) {
  S.anim = { from: S.model.t, to, t0: performance.now(), dur: 1800 * Math.abs(to - S.model.t) + 200 };
  $('lab-explode-btn').setAttribute('aria-pressed', to === 1);
  invalidate();
}
function stepAnim(now) {
  const a = S.anim; if (!a) return;
  const k = Math.min((now - a.t0) / a.dur, 1);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  applyExplode(k >= 1 ? a.to : a.from + (a.to - a.from) * e); // end on the exact value
  if (k >= 1) {
    S.anim = null;
    if (a.to === 1) frame(S.model.box(S.model.meshes)); // keep the exploded stack in frame
    else frame(S.base);
  }
}
$('lab-explode-btn').onclick = () => { if (S.model) animateTo(S.model.t < 0.5 ? 1 : 0); };
$('lab-explode').addEventListener('input', e => {
  S.anim = null;
  applyExplode(+e.target.value);
  $('lab-explode-btn').setAttribute('aria-pressed', +e.target.value >= 0.5);
});
$('lab-explode').addEventListener('change', () => { if (S.model) frame(S.model.t > 0.05 ? S.model.box(S.model.meshes) : S.base); });

/* ---------------- parts list / selection ---------------- */
function buildPartsList() {
  const ids = S.model.partIds().sort();
  $('lab-parts-count').textContent = `(${ids.length})`;
  renderPartsList(ids);
}
function renderPartsList(ids = S.model.partIds().sort()) {
  const q = $('lab-search').value.trim().toLowerCase(), ul = $('lab-parts');
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
$('lab-search').addEventListener('input', () => renderPartsList());

function select(pid, mesh) {
  const m = S.model;
  mesh ??= m.meshesOf(pid)[0] ?? m.meshesUnder(pid)[0];
  S.sel = pid ? { pid, mesh } : null;
  updateSelectionUI();
}
function updateSelectionUI() {
  const sel = S.sel, p = sel && S.manifest.get(sel.pid), chip = $('lab-chip');
  document.querySelectorAll('#lab-parts button').forEach(b => b.classList.toggle('on', !!sel && b.dataset.id === sel.pid));
  chip.hidden = !sel;
  if (sel) {
    const acc = p?.accuracy;
    chip.innerHTML = `<span></span><code></code>${acc ? `<span class="acc" data-l="${acc}">${acc}</span>` : ''}`;
    chip.firstChild.textContent = p?.name_th ?? sel.pid; chip.children[1].textContent = sel.pid;
  }
  $('lab-info-empty').hidden = !!sel; $('lab-info').hidden = !sel;
  if (sel) {
    $('li-th').textContent = p?.name_th ?? sel.pid;
    $('li-en').textContent = p?.name_en ?? 'ไม่มีข้อมูลใน parts_manifest.json';
    $('li-id').textContent = sel.pid;
    const acc = p?.accuracy;
    $('li-acc').innerHTML = acc ? `<span class="acc" data-l="${acc}">${acc} · ${ACC_TH[acc] ?? ''}</span>` : '<span class="acc">ไม่ทราบ</span>';
    $('li-mat').textContent = p?.material && p.material !== '-' ? p.material : (sel.mesh?._baseMat?.name ?? '-');
    const z = sel.mesh && S.model.zoneOf(sel.mesh);
    $('li-zone').textContent = z ? `${z} (${S.manifest.paintZones[z]?.label_th ?? ''})` : '-';
    $('lab-isolate').textContent = S.model.isolated === sel.pid ? 'ยกเลิก Isolate' : 'Isolate';
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
$('lab-isolate').onclick = () => { const s = S.sel; if (!s) return; S.model.setIsolated(S.model.isolated === s.pid ? null : s.pid); updateSelectionUI(); invalidate(); };
$('lab-showall').onclick = () => { S.model.showAll(); updateSelectionUI(); invalidate(); };

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
  if (moved > 5 || dt > 600) return; // a drag, not a click
  const h = pick(e);
  h ? select(h.pid, h.mesh) : select(null);
});
let hoverQueued = false;
canvas.addEventListener('pointermove', e => {
  if (e.buttons || hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => { hoverQueued = false; canvas.style.cursor = pick(e) ? 'pointer' : ''; });
});

/* ---------------- colors ---------------- */
function updatePaintUI() {
  const sel = S.sel, msg = $('lab-paint-msg'), ui = $('lab-paint-ui');
  if (!sel?.mesh) { msg.textContent = 'คลิกชิ้นส่วนบนโมเดลหรือเลือกจากแท็บ Parts'; msg.hidden = false; ui.hidden = true; return; }
  const m = S.model, p = S.manifest.get(sel.pid);
  if (!m.isPaintable(sel.mesh)) {
    msg.textContent = `${p?.name_th ?? sel.pid}: เปลี่ยนสีไม่ได้ — วัสดุ ${sel.mesh._baseMat?.name ?? '?'} ไม่ใช่ผิวที่เป็นสี (MAT_PAINT_)`;
    msg.hidden = false; ui.hidden = true; return;
  }
  msg.textContent = `${p?.name_th ?? sel.pid} · ใช้กับทุก instance ของชิ้นนี้`; msg.hidden = false;
  ui.hidden = false;
  const cur = m.colorOf(sel.mesh) ?? m.defaultColor(sel.mesh);
  $('lab-color').value = cur;
  document.querySelectorAll('#lab-swatches button').forEach(b => b.classList.toggle('on', b.dataset.c === cur));
}
function paint(hex) {
  const sel = S.sel; if (!sel?.mesh) return;
  S.model.setColor(sel.mesh, hex, 'part');
  saveState(S.veh.key, { paint: S.model.exportPaint() });
  updatePaintUI(); invalidate();
}
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.dataset.c = c; b.style.setProperty('--sw', c); b.setAttribute('aria-label', `สี ${c}`);
  b.onclick = () => paint(c);
  $('lab-swatches').append(b);
}
let paintRaf = 0;
$('lab-color').addEventListener('input', e => { const v = e.target.value; cancelAnimationFrame(paintRaf); paintRaf = requestAnimationFrame(() => paint(v)); });
$('lab-reset-part').onclick = () => { if (S.sel) { S.model.resetPaint(S.sel.pid); saveState(S.veh.key, { paint: S.model.exportPaint() }); updatePaintUI(); invalidate(); } };
$('lab-reset-all').onclick = () => { S.model.resetPaint(); saveState(S.veh.key, { paint: S.model.exportPaint() }); updatePaintUI(); invalidate(); };

/* ---------------- tabs ---------------- */
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.tabs button[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('.hud-right [data-pane]').forEach(p => (p.hidden = p.dataset.pane !== tab));
}
document.querySelectorAll('.tabs button[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* ---------------- boot ---------------- */
for (const v of VEHICLES) {
  const b = document.createElement('button');
  b.dataset.key = v.key; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
  b.innerHTML = '<span></span><small></small>';
  b.firstChild.textContent = v.label; b.lastChild.textContent = v.note;
  b.onclick = () => { if (S.veh?.key !== v.key) loadVehicle(v.key); };
  $('lab-vehicles').append(b);
}
async function boot() {
  try {
    setup();
    S.manifest = await Manifest.load('rocket3d/parts_manifest.json');
    for (const [k, v] of Object.entries(S.manifest.json.accuracy_levels)) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.innerHTML = `<span class="acc" data-l="${k}">${k}</span>`; dd.textContent = v;
      $('lab-legend').append(dt, dd);
    }
    await loadVehicle('f9');
  } catch (e) {
    console.error(e);
    $('lab-loading').querySelector('span').innerHTML = `เบราว์เซอร์นี้แสดง 3D ไม่ได้ — <a href="rocket3d/viewer.html" style="text-decoration:underline">ลองเปิด 3D Viewer</a>`;
    $('lab-loading').querySelector('i').hidden = true;
  }
}
// load the ~3 MB model only when the section is about to be seen
new IntersectionObserver((es, obs) => { if (es.some(e => e.isIntersecting)) { obs.disconnect(); boot(); } }, { rootMargin: '400px' }).observe(section);
window.__lab = { S, select, applyExplode, loadVehicle, setTab };

// 3D Rocket Viewer — static ES module, no build step.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Manifest, loadModel, unloadGLB } from './model.js';
import { VEHICLES, SWATCHES, ACC_TH, loadSaved, saveState, makeShadow, placeShadow } from './common.js';
import { slotInfo, applySlot, placeTarget, placeModule } from './slots.js';

const $ = id => document.getElementById(id);

const GALLERY = [
  ['Falcon 9 / Heavy', ['S1_TNK', 'S1_AFT', 'S1_LEG', 'IS', 'S2', 'PL', 'ENG_M1D', 'ENG_M1D_x9', 'ENG_MVAC']],
  ['ชิ้นสลับ (slot)', ['IS_GRIDFIN_AL', 'PL_FAIRING_EXT', 'PL_PAYLOAD_B']],
  ['Saturn V', ['SV_IC', 'SV_II', 'SV_IVB', 'SV_IU', 'SV_SLA', 'SV_CSM', 'SV_LES', 'ENG_F1', 'ENG_J2']],
];
const S = {
  manifest: null, mode: 'viewer', veh: null, main: null, gal: null, galKey: null,
  sel: null, vehToken: 0, galToken: 0, dirty: true, anim: null, cams: {},
};

/* ---------------- renderer / camera ---------------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(40, 80, 60);
const rim = new THREE.DirectionalLight(0x9fe8ff, 1.0); // cool rim light for the teal backdrop
rim.position.set(-60, 30, -40);
scene.add(sun, rim, new THREE.HemisphereLight(0xcfe9f2, 0x1a2a33, 0.4));
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.addEventListener('change', invalidate);
controls.listenToKeyEvents(canvas); // arrow keys pan (canvas is focusable)
const boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xff6a1f);
const shadow = makeShadow();
scene.add(shadow);
boxHelper.visible = false;
scene.add(boxHelper);

function invalidate() { S.dirty = true; }
const cur = () => (S.mode === 'viewer' ? S.main : S.gal);

function resize() {
  const r = $('stage').getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(r.height, 1);
  camera.updateProjectionMatrix();
  invalidate();
}
new ResizeObserver(resize).observe($('stage'));

function frame(box) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = Math.max(sz.x, sz.z);
  const dist = (Math.max(sz.y / 2 / tan, w / 2 / (tan * camera.aspect)) + w / 2) * 1.15;
  const dir = new THREE.Vector3(0.55, 0.18, 1).normalize();
  camera.position.copy(c).addScaledVector(dir, dist);
  camera.near = dist / 200; camera.far = dist * 40;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
  controls.minDistance = dist * 0.04;
  controls.maxDistance = dist * 5;
  controls.update();
  invalidate();
}
function resetView() {
  const m = cur();
  if (m) { frame(m.box(m.meshes)); }
}
function updateShadow() {
  const m = cur();
  if (m) placeShadow(shadow, m.box(m.meshes.filter(x => x.visible)));
  invalidate();
}

/* ---------------- notices / loading ---------------- */
let noticeTimer;
function notice(msg, ms = 6000) {
  const el = $('notice');
  el.textContent = msg; el.hidden = !msg;
  clearTimeout(noticeTimer);
  if (msg && ms) noticeTimer = setTimeout(() => (el.hidden = true), ms);
}
function loading(on, text) {
  $('loading').hidden = !on;
  if (text) $('loading').querySelector('span').textContent = text;
}

/* ---------------- persistence (per vehicle) ---------------- */
function save() {
  const m = S.main;
  if (!m) return;
  saveState(S.veh.key, {
    variant: m.variant, paint: m.exportPaint(),
    slots: Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, v]) => [k, v.current])),
  });
}
const restore = loadSaved;

/* ---------------- vehicle loading ---------------- */
async function loadVehicle(key) {
  const v = VEHICLES.find(x => x.key === key);
  const token = ++S.vehToken;
  loading(true, `กำลังโหลด ${v.label} …`);
  clearSelection();
  try {
    const model = await loadModel(`models/${v.file}.glb`, S.manifest, key);
    if (token !== S.vehToken) { model.dispose(); return; }
    if (S.main) { const prev = S.veh; S.main.dispose(); unloadGLB(`models/${prev.file}.glb`); }
    S.veh = v; S.main = model;
    scene.add(model.root);
    model.root.visible = S.mode === 'viewer';
    const saved = restore(key);
    if (saved?.paint) model.importPaint(saved.paint);
    const variant = model.variantNames.includes(saved?.variant) ? saved.variant : v.variant;
    if (model.variantNames.length) await model.setVariant(variant);
    for (const [slot, id] of Object.entries(saved?.slots ?? {})) {
      try { await applySlot(S.manifest, model, slot, id); } catch (e) { console.warn('slot restore', slot, e.message); }
    }
    buildVehicleUI();
    if (S.mode === 'viewer') { applyExplode(0); frame(model.box(model.meshes)); }
    $('explode').value = 0; $('explode-out').textContent = '0.00';
  } catch (e) {
    console.error(e);
    notice(`โหลด ${v.label} ไม่สำเร็จ: ${e.message}`, 0);
  } finally {
    if (token === S.vehToken) loading(false);
  }
}

function buildVehicleUI() {
  const m = S.main;
  document.querySelectorAll('#vehicles button').forEach(b => b.setAttribute('aria-checked', b.dataset.key === S.veh.key));
  const sel = $('variant');
  sel.innerHTML = '';
  for (const n of m.variantNames) {
    const o = document.createElement('option');
    o.value = n; o.textContent = `${n} — ${S.manifest.variantLabels[n] ?? ''}`;
    sel.append(o);
  }
  sel.value = m.variant ?? '';
  sel.disabled = !m.variantNames.length;
  buildScope();
  buildPartsList();
}

/* ---------------- explode ---------------- */
function buildScope() {
  const m = cur(); if (!m) return;
  const sel = $('scope');
  const opts = [['', 'ทั้งลำ / ทั้งโมเดล'], ['@sel', 'ตามชิ้นที่เลือก (assembly ที่ครอบ)']];
  for (const [id, nodes] of m.nodesById) {
    const p = S.manifest.get(id);
    if (p?.type === 'assembly' && nodes.length === 1) opts.push([id, `${p.name_th} (${id})`]);
  }
  const prev = sel.value;
  sel.innerHTML = '';
  for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); }
  sel.value = opts.some(o => o[0] === prev) ? prev : '';
}
function scopeId() {
  const v = $('scope').value, m = cur();
  if (v !== '@sel') return v || null;
  if (!S.sel) return null;
  for (const id of S.manifest.ancestors(S.sel.pid)) {
    if (S.manifest.get(id)?.type === 'assembly' && m.nodesById.get(id)?.length === 1) return id;
  }
  return null;
}
function applyExplode(t) {
  const m = cur(); if (!m) return;
  m.setExplode(t, scopeId());
  $('explode').value = t;
  $('explode-out').textContent = t.toFixed(2);
  updateHighlight();
  updateShadow();
}
function animateExplode(to) {
  const m = cur(); if (!m) return;
  const from = m.t, t0 = performance.now(), dur = 1800 * Math.abs(to - from) + 200;
  const btn = $('explode-anim');
  btn.setAttribute('aria-pressed', to === 1);
  S.anim = { from, to, t0, dur };
  invalidate();
}
function stepAnim(now) {
  const a = S.anim; if (!a) return;
  const k = Math.min((now - a.t0) / a.dur, 1);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  applyExplode(k >= 1 ? a.to : a.from + (a.to - a.from) * e); // exact end value
  if (k >= 1) { S.anim = null; $('explode-anim').textContent = a.to === 1 ? 'ประกอบกลับ' : 'ถอดแยก'; }
}

/* ---------------- parts list ---------------- */
function buildPartsList() {
  const m = cur(); if (!m) return;
  const ids = m.partIds().sort();
  $('parts-count').textContent = `(${ids.length})`;
  renderPartsList(ids);
}
function renderPartsList(ids) {
  const q = $('parts-search').value.trim().toLowerCase();
  const ul = $('parts-list');
  ul.innerHTML = '';
  for (const id of ids) {
    const p = S.manifest.get(id);
    const label = p?.name_th ?? id;
    if (q && !(`${id} ${label} ${p?.name_en ?? ''}`.toLowerCase().includes(q))) continue;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.dataset.id = id;
    b.innerHTML = `<b></b><code></code>`;
    b.firstChild.textContent = label; b.lastChild.textContent = id;
    if (S.sel?.pid === id) b.classList.add('on');
    b.addEventListener('click', () => selectPart(id));
    li.append(b); ul.append(li);
  }
}
$('parts-search').addEventListener('input', () => { const m = cur(); if (m) renderPartsList(m.partIds().sort()); });

/* ---------------- selection / info ---------------- */
function selectPart(pid, mesh) {
  const m = cur();
  mesh ??= m.meshesOf(pid)[0] ?? m.meshesUnder(pid)[0];
  S.sel = { model: m, pid, mesh };
  updateSelectionUI();
}
function clearSelection() {
  S.sel = null;
  updateSelectionUI();
}
function nodeSlot(sel) {
  for (let o = sel.mesh; o; o = o.parent) if (o.userData?.slot) return o.userData.slot;
  return S.manifest.get(sel.pid)?.slot || null;
}
function updateSelectionUI() {
  const sel = S.sel, p = sel && S.manifest.get(sel.pid);
  $('info-empty').hidden = !!sel; $('info-body').hidden = !sel;
  document.querySelectorAll('#parts-list button').forEach(b => b.classList.toggle('on', !!sel && b.dataset.id === sel.pid));
  if (sel) {
    $('i-th').textContent = p?.name_th ?? sel.pid;
    $('i-en').textContent = p?.name_en ?? 'ไม่มีข้อมูลใน parts_manifest.json';
    $('i-id').textContent = sel.pid;
    const acc = p?.accuracy;
    $('i-acc').innerHTML = acc ? `<span class="acc" data-l="${acc}">${acc} · ${ACC_TH[acc] ?? ''}</span>` : '<span class="acc">ไม่ทราบ</span>';
    $('i-mat').textContent = p?.material && p.material !== '-' ? p.material : (sel.mesh?._baseMat?.name ?? '-');
    const z = sel.mesh && sel.model.zoneOf(sel.mesh);
    $('i-zone').textContent = z ? `${z} (${S.manifest.paintZones[z]?.label_th ?? ''})` : '-';
    $('i-slot').textContent = nodeSlot(sel) ?? '-';
    $('i-qty').textContent = p?.qty_per_parent ? `${p.qty_per_parent} ต่อ ${p.parent ?? '-'}` : '-';
    const hid = sel.model.hidden.has(sel.pid);
    $('a-hide').textContent = hid ? 'แสดง' : 'ซ่อน';
    $('a-isolate').textContent = sel.model.isolated === sel.pid ? 'ยกเลิก Isolate' : 'Isolate';
  }
  updatePaintUI(); updateSlotUI(); updatePlaceUI(); updateHighlight();
  if ($('scope').value === '@sel') applyExplode(cur().t);
}
// the same part id can occur in several places (S2's engine reuses M1D ids, 4 legs):
// highlight only the occurrence that was clicked
function selectionMeshes(sel) {
  const { model, pid, mesh } = sel;
  const all = model.meshesUnder(pid);
  if (!mesh) return all;
  if (mesh.isInstancedMesh) return all.filter(m => m.isInstancedMesh);
  let a = mesh.parent;
  while (a && !(a.userData?.part_id && S.manifest.get(a.userData.part_id)?.type === 'assembly' && a !== mesh)) a = a.parent;
  if (!a || a === model.gltf.scene) return all.filter(m => !m.isInstancedMesh);
  return all.filter(m => !m.isInstancedMesh && a.getObjectById(m.id));
}
function updateHighlight() {
  const sel = S.sel;
  if (!sel || sel.model !== cur() || !sel.model.root.visible) { boxHelper.visible = false; invalidate(); return; }
  const b = sel.model.box(selectionMeshes(sel).filter(x => x.visible));
  boxHelper.visible = !b.isEmpty();
  boxHelper.box.copy(b);
  invalidate();
}

$('a-clear').onclick = clearSelection;
$('a-hide').onclick = () => { const s = S.sel; if (!s) return; s.model.setHidden(s.pid, !s.model.hidden.has(s.pid)); updateSelectionUI(); invalidate(); };
$('a-isolate').onclick = () => { const s = S.sel; if (!s) return; s.model.setIsolated(s.model.isolated === s.pid ? null : s.pid); updateSelectionUI(); invalidate(); };
$('show-all').onclick = () => { cur()?.showAll(); updateSelectionUI(); invalidate(); };

/* ---------------- picking ---------------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function visibleDeep(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function pickAt(ev) {
  const m = cur(); if (!m) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObject(m.root, true)) {
    if (h.object._pid && visibleDeep(h.object)) return { pid: h.object._pid, mesh: h.object, x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  return null;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 5 || dt > 600) return; // it was a camera drag
  const h = pickAt(e);
  h ? selectPart(h.pid, h.mesh) : clearSelection();
});
let hoverQueued = false;
canvas.addEventListener('pointermove', e => {
  if (e.buttons || hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => {
    hoverQueued = false;
    const h = pickAt(e), tip = $('tooltip');
    if (!h) { tip.hidden = true; canvas.style.cursor = ''; return; }
    const p = S.manifest.get(h.pid);
    tip.textContent = `${p?.name_th ?? h.pid} · ${h.pid} · ${p?.accuracy ?? '?'}`;
    tip.hidden = false;
    tip.style.left = `${Math.min(h.x + 14, canvas.clientWidth - tip.offsetWidth - 6)}px`;
    tip.style.top = `${h.y + 14}px`;
    canvas.style.cursor = 'pointer';
  });
});
canvas.addEventListener('pointerleave', () => { $('tooltip').hidden = true; });

/* ---------------- paint ---------------- */
let paintRaf = 0;
function updatePaintUI() {
  const sel = S.sel, msg = $('paint-msg'), ui = $('paint-ui');
  if (!sel || !sel.mesh) { msg.textContent = 'เลือกชิ้นส่วนก่อนเพื่อเปลี่ยนสี'; ui.hidden = true; return; }
  const m = sel.model, mesh = sel.mesh;
  if (!m.isPaintable(mesh)) {
    msg.textContent = `ชิ้นนี้เปลี่ยนสีไม่ได้ — วัสดุ ${mesh._baseMat?.name ?? '?'} ไม่ใช่ MAT_PAINT_ (เปลี่ยนได้เฉพาะผิวที่เป็นสี)`;
    ui.hidden = true; return;
  }
  msg.textContent = '';
  ui.hidden = false;
  $('color').value = m.colorOf(mesh) ?? m.defaultColor(mesh);
  const hasZone = !!m.zoneOf(mesh);
  document.querySelector('input[name=pscope][value=zone]').disabled = !hasZone;
  if (!hasZone && document.querySelector('input[name=pscope]:checked').value === 'zone') document.querySelector('input[name=pscope][value=mesh]').checked = true;
  $('notex-wrap').hidden = !m.hasTexture(mesh);
  $('notex').checked = !!m.paint.noTex[sel.pid];
}
function applyColor(hex) {
  const sel = S.sel; if (!sel?.mesh) return;
  const scope = document.querySelector('input[name=pscope]:checked').value;
  sel.model.setColor(sel.mesh, hex, scope);
  save(); invalidate();
}
$('color').addEventListener('input', e => {
  const v = e.target.value;
  cancelAnimationFrame(paintRaf);
  paintRaf = requestAnimationFrame(() => applyColor(v));
});
for (const c of SWATCHES) {
  const b = document.createElement('button');
  b.style.setProperty('--sw', c); b.setAttribute('aria-label', `สี ${c}`);
  b.onclick = () => { $('color').value = c; applyColor(c); };
  $('swatches').append(b);
}
$('notex').onchange = e => { const s = S.sel; if (s?.mesh) { s.model.setNoTexture(s.mesh, e.target.checked); save(); invalidate(); } };
$('paint-reset-part').onclick = () => { const s = S.sel; if (s) { s.model.resetPaint(s.pid); updatePaintUI(); save(); invalidate(); } };
$('paint-reset-all').onclick = () => { cur()?.resetPaint(); updatePaintUI(); save(); invalidate(); };
$('paint-export').onclick = () => {
  const m = S.main; if (!m) return;
  const data = { app: 'rocket3d', vehicle: S.veh.key, variant: m.variant, paint: m.exportPaint(), slots: Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, v]) => [k, v.current])) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `rocket3d-${S.veh.key}-colors.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('paint-import').onclick = () => $('paint-file').click();
$('paint-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== 'rocket3d' || !d.paint) throw new Error('ไม่ใช่ไฟล์สีของ rocket3d');
    if (d.vehicle !== S.veh.key) await switchVehicle(d.vehicle);
    S.main.importPaint(d.paint);
    if (d.variant && S.main.variantNames.includes(d.variant)) { await S.main.setVariant(d.variant); $('variant').value = d.variant; }
    for (const [slot, id] of Object.entries(d.slots ?? {})) await applySlot(S.manifest, S.main, slot, id).catch(err => notice(err.message));
    updatePaintUI(); save(); invalidate(); notice('นำเข้าสีเรียบร้อย');
  } catch (err) { notice('Import ไม่สำเร็จ: ' + err.message, 8000); }
};

/* ---------------- variants ---------------- */
$('variant').onchange = async e => {
  const m = S.main; if (!m) return;
  await m.setVariant(e.target.value);
  const n = Object.keys(m.paint.meshes).length + Object.keys(m.paint.parts).length + Object.keys(m.paint.zones).length;
  notice(n ? `สลับเป็น ${e.target.value} — สีที่ตั้งไว้ ${n} รายการยังคงอยู่ (ชิ้นที่มีลายเขม่าจะแสดงเป็นสี × ลาย ปิดลายได้ที่แผง "เปลี่ยนสี")` : '');
  updatePaintUI(); save(); invalidate();
};

/* ---------------- slot swap ---------------- */
function updateSlotUI() {
  const sec = $('sec-slot'), sel = S.sel;
  const slot = sel && S.mode === 'viewer' ? nodeSlot(sel) : null;
  sec.hidden = !slot;
  if (!slot) return;
  const info = slotInfo(S.manifest, S.main, slot);
  $('slot-ui').hidden = !info.ok;
  $('slot-msg').textContent = info.ok ? `slot: ${slot}` : `${slot}: ${info.reason}`;
  if (!info.ok) return;
  const s = $('slot-select');
  s.innerHTML = '';
  for (const o of info.options) { const op = document.createElement('option'); op.value = o.id ?? ''; op.textContent = o.label; s.append(op); }
  s.value = info.current ?? '';
  s.dataset.slot = slot;
}
$('slot-apply').onclick = async () => {
  const s = $('slot-select'), slot = s.dataset.slot;
  try {
    loading(true, 'กำลังโหลดชิ้นส่วน…');
    const r = await applySlot(S.manifest, S.main, slot, s.value || null);
    buildPartsList(); buildScope();
    const pid = s.value || S.sel?.pid;
    if (s.value) selectPart(s.value); else clearSelection();
    applyExplode(S.main.t);
    save();
    notice(r.warning ?? 'สลับชิ้นส่วนเรียบร้อย', r.warning ? 10000 : 4000);
    void pid;
  } catch (e) { notice('สลับไม่สำเร็จ: ' + e.message, 8000); }
  finally { loading(false); }
};

/* ---------------- gallery ---------------- */
async function buildGalleryList() {
  const ul = $('gallery-list');
  if (ul.childElementCount) return;
  const rootIds = {
    S1_TNK: 'S1-TNK-000', S1_AFT: 'S1-AFT-000', S1_LEG: 'S1-LEG-000', IS: 'IS-000', S2: 'S2-000', PL: 'PL-000',
    ENG_M1D: 'ENG-M1D-000', ENG_MVAC: 'ENG-MVAC-000', IS_GRIDFIN_AL: 'IS-021', PL_FAIRING_EXT: 'PL-021', PL_PAYLOAD_B: 'PL-051',
    SV_IC: 'SV-IC-000', SV_II: 'SV-II-000', SV_IVB: 'SV-IVB-000', SV_IU: 'SV-IU-000', SV_SLA: 'SV-SLA-000', SV_CSM: 'SV-CSM-000',
    SV_LES: 'SV-LES-000', ENG_F1: 'ENG-F1-000', ENG_J2: 'ENG-J2-000',
  };
  for (const [group, files] of GALLERY) {
    const h = document.createElement('li'); h.innerHTML = `<small></small>`; h.firstChild.textContent = group; h.style.cssText = 'font-size:.6rem;letter-spacing:.12em;opacity:.6;margin-top:6px;text-transform:uppercase';
    ul.append(h);
    for (const f of files) {
      const li = document.createElement('li'), b = document.createElement('button');
      const p = S.manifest.get(rootIds[f]);
      b.dataset.file = f;
      b.innerHTML = '<b></b><code></code>';
      b.firstChild.textContent = p?.name_th ?? (f === 'ENG_M1D_x9' ? 'เครื่องยนต์ Merlin 1D ×9 (กลุ่ม)' : f);
      b.lastChild.textContent = f;
      b.onclick = () => loadGallery(f);
      li.append(b); ul.append(li);
    }
  }
}
async function loadGallery(file) {
  const token = ++S.galToken;
  loading(true, `กำลังโหลดโมดูล ${file} …`);
  try {
    const model = await loadModel(`models/${file}.glb`, S.manifest, 'gal:' + file);
    if (token !== S.galToken) { model.dispose(); return; }
    if (S.gal) { S.gal.dispose(); }
    S.gal = model; S.galKey = file;
    scene.add(model.root);
    document.querySelectorAll('#gallery-list button').forEach(b => b.classList.toggle('on', b.dataset.file === file));
    clearSelection();
    buildScope(); buildPartsList();
    $('explode').value = 0; $('explode-out').textContent = '0.00';
    applyExplode(0);
    frame(model.box(model.meshes));
    updatePlaceUI();
  } catch (e) { notice(`โหลดโมดูลไม่สำเร็จ: ${e.message}`, 0); }
  finally { if (token === S.galToken) loading(false); }
}
function placeInfo() {
  // what "place into open vehicle" would do for the current gallery module
  const g = S.gal, v = S.main;
  if (!g || !v) return { kind: 'none', msg: 'เลือกโมดูลจากรายการ' };
  const id = g.rootId ?? S.manifest.normId(g.meshes.find(m => !m.isInstancedMesh)?._pid ?? g.meshes[0]?._pid);
  // slot variant (gridfin / fairing / payload)
  let slotNote = '';
  for (const [slot, def] of Object.entries(S.manifest.slots)) {
    if (def.variants.includes(id) && slot !== 'SLOT_SV_PATTERN') {
      const info = slotInfo(S.manifest, v, slot);
      if (info.ok) return { kind: 'slot', slot, id, msg: `โมดูลนี้เป็นตัวเลือกของ ${slot} — วางแทนใน ${S.veh.label} ได้` };
      slotNote = `${slot}: ${info.reason}. `;
    }
  }
  if (placeTarget(S.manifest, v, g)) return { kind: 'module', id, msg: `${slotNote}วางแทน ${id} ใน ${S.veh.label} (ตรวจขนาดเทียบตำแหน่งเดิม ±15%)` };
  const n = v.nodesById.get(id)?.length ?? 0;
  const why = n > 1
    ? `ลำที่เปิดอยู่มี "${id}" ${n} ตำแหน่ง (instance) — ยังไม่รองรับการวางแทนหลายตำแหน่ง`
    : `ไม่มีตำแหน่ง "${id}" ที่เข้ากันใน ${S.veh.label} ที่เปิดอยู่`;
  return { kind: 'none', msg: `${slotNote}${why} — ดูอย่างเดียว (หมุน/ถอด/เปลี่ยนสีได้)` };
}
function updatePlaceUI() {
  const sec = $('sec-place');
  sec.hidden = S.mode !== 'gallery';
  if (S.mode !== 'gallery') return;
  const info = placeInfo();
  $('place-msg').textContent = info.msg;
  $('place-btn').hidden = info.kind === 'none';
}
$('place-btn').onclick = async () => {
  const info = placeInfo();
  try {
    let warning = null;
    if (info.kind === 'slot') warning = (await applySlot(S.manifest, S.main, info.slot, info.id)).warning;
    else if (info.kind === 'module') warning = placeModule(S.manifest, S.main, S.gal);
    if (warning && !confirm(`${warning}\nวางต่อไปหรือไม่? (ยกเลิกไม่ได้ย้อนกลับ ต้องโหลดลำใหม่)`)) { await reloadVehicle(); return; }
    save();
    notice(warning ?? 'วางโมดูลในลำที่เปิดอยู่แล้ว — กลับไปแท็บ "จรวดทั้งลำ" เพื่อดู', 8000);
  } catch (e) { notice('วางไม่สำเร็จ: ' + e.message, 8000); }
};
async function reloadVehicle() { unloadGLB(`models/${S.veh.file}.glb`); const k = S.veh.key; S.main?.dispose(); S.main = null; await loadVehicle(k); }

/* ---------------- tabs ---------------- */
async function setMode(mode) {
  if (S.mode === mode) return;
  S.cams[S.mode] = { p: camera.position.clone(), t: controls.target.clone() };
  S.mode = mode;
  const g = mode === 'gallery';
  $('tab-viewer').classList.toggle('on', !g); $('tab-viewer').setAttribute('aria-selected', !g);
  $('tab-gallery').classList.toggle('on', g); $('tab-gallery').setAttribute('aria-selected', g);
  $('sec-vehicle').hidden = g; $('sec-gallery').hidden = !g;
  if (S.main) S.main.root.visible = !g;
  if (S.gal) S.gal.root.visible = g;
  clearSelection();
  S.anim = null;
  if (g) await buildGalleryList();
  buildScope(); buildPartsList();
  const m = cur();
  if (m) { applyExplode(m.t); }
  const c = S.cams[mode];
  if (c) { camera.position.copy(c.p); controls.target.copy(c.t); controls.update(); } else resetView();
  updatePlaceUI(); invalidate();
}
$('tab-viewer').onclick = () => setMode('viewer');
$('tab-gallery').onclick = () => setMode('gallery');

/* ---------------- wiring ---------------- */
async function switchVehicle(key) { if (S.veh?.key !== key) await loadVehicle(key); }
for (const v of VEHICLES) {
  const b = document.createElement('button');
  b.dataset.key = v.key; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
  b.innerHTML = `<span></span><small></small>`;
  b.firstChild.textContent = v.label; b.lastChild.textContent = v.note;
  b.onclick = () => { switchVehicle(v.key); };
  $('vehicles').append(b);
}
$('explode').addEventListener('input', e => { S.anim = null; applyExplode(+e.target.value); $('explode-anim').textContent = +e.target.value >= 0.5 ? 'ประกอบกลับ' : 'ถอดแยก'; });
$('explode-anim').onclick = () => { const m = cur(); if (m) animateExplode(m.t < 0.5 ? 1 : 0); };
$('explode-zero').onclick = () => animateExplode(0);
$('stagger').onchange = e => { const m = cur(); if (m) { m.stagger = e.target.checked; applyExplode(m.t); } };
$('scope').onchange = () => { const m = cur(); if (m) { m.setExplode(0); applyExplode(+$('explode').value); } };
$('reset-view').onclick = resetView;

function loop(now) {
  requestAnimationFrame(loop);
  stepAnim(now);
  if (controls.update()) S.dirty = true;
  if (S.dirty) { S.dirty = false; renderer.render(scene, camera); }
}

async function init() {
  if (!renderer.getContext()) { notice('เบราว์เซอร์นี้ไม่รองรับ WebGL', 0); return; }
  resize();
  requestAnimationFrame(loop);
  S.manifest = await Manifest.load('parts_manifest.json');
  const legend = $('legend');
  for (const [k, v] of Object.entries(S.manifest.json.accuracy_levels)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.innerHTML = `<span class="acc" data-l="${k}">${k}</span>`; dd.textContent = v;
    legend.append(dt, dd);
  }
  const want = new URLSearchParams(location.search).get('v');
  await loadVehicle(VEHICLES.some(v => v.key === want) ? want : 'f9');
  window.__rocket3d = { S, THREE, selectPart, applyExplode, scene, camera, renderer, setMode, loadGallery, loadVehicle };
}
init().catch(e => { console.error(e); notice('เริ่มต้นไม่สำเร็จ: ' + e.message, 0); });

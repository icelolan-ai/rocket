// Home page story: a pinned 3D rocket that takes itself apart as you scroll.
// Scroll progress drives the explode amount and a camera tour over every part (with captions);
// at the end the rocket reassembles and the "Let's explore" button pops in.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Manifest, loadModel, unloadGLB } from '../rocket3d/model.js';
import { VEHICLES, loadSaved, makeShadow, placeShadow } from '../rocket3d/common.js';
import { t, getLang, onLang } from '../rocket3d/i18n.js';

const $ = id => document.getElementById(id);
try { history.scrollRestoration = 'manual'; } catch { /* unsupported */ }
scrollTo(0, 0); // always open on the ROCKET page, never mid-story
const arm = () => { scrollTo(0, 0); S.armed = true; S.p = 0; if (S.model) apply(0, 0); };
if (document.documentElement.classList.contains('loading')) { document.addEventListener('rocket:revealing', () => scrollTo(0, 0), { once: true }); document.addEventListener('rocket:revealed', arm, { once: true }); setTimeout(() => { if (!S.armed) arm(); }, 21000); } else queueMicrotask(() => { S.armed = true; });
addEventListener('pageshow', e => { if (e.persisted) arm(); });
const story = $('story'), stage = $('top'), canvas = $('gl3d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const back = k => { k = clamp(k); return k >= 1 ? 1 : 1 + 2.9 * Math.pow(k - 1, 3) + 1.9 * Math.pow(k - 1, 2); }; // ease-out-back
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// What each part does. [en, th]. Simplified on purpose; model sizes are partly approximate.
const TXT = {
  fairing: [['Payload fairing', 'ฝาครอบสัมภาระ (แฟริ่ง)'], ['Two shell halves shield the satellite from air pressure, heat and noise during the climb, then split open once the rocket is above the thick atmosphere.', 'เปลือกสองซีกปกป้องดาวเทียมจากแรงอากาศ ความร้อน และเสียงระหว่างพุ่งขึ้น แล้วแยกออกเมื่อจรวดพ้นชั้นบรรยากาศหนาแน่น']],
  payload: [['Payload', 'สัมภาระ (ดาวเทียม)'], ['The cargo the whole rocket exists to deliver. Here it is a generic dummy satellite.', 'สิ่งที่จรวดทั้งลำมีไว้เพื่อส่งขึ้นไป ในโมเดลนี้เป็นดาวเทียมจำลองทั่วไป']],
  s2: [['Second stage', 'สเตจที่ 2'], ['Takes over after the first stage drops away and carries the payload the rest of the way to orbit with one engine tuned for vacuum.', 'ทำงานต่อหลังสเตจแรกแยกตัว พาสัมภาระขึ้นสู่วงโคจรด้วยเครื่องยนต์เดียวที่ออกแบบสำหรับสุญญากาศ']],
  is: [['Interstage', 'ส่วนต่อระหว่างสเตจ'], ['Joins the two stages and holds the separation pushers. Grid fins on this section steer the first stage on its way back down.', 'เชื่อมสองสเตจเข้าด้วยกัน และมีตัวดันแยกสเตจ กริดฟินบนส่วนนี้ช่วยบังคับทิศสเตจแรกตอนกลับลงมา']],
  tanks: [['First-stage tanks', 'ถังเชื้อเพลิงสเตจแรก'], ['Most of the rocket is fuel: tanks of kerosene and liquid oxygen feed the engines below. The thin walls are also the structure.', 'ส่วนใหญ่ของจรวดคือเชื้อเพลิง ถังน้ำมันก๊าดและออกซิเจนเหลวป้อนเครื่องยนต์ด้านล่าง ผนังบางเหล่านี้ยังเป็นโครงสร้างของลำด้วย']],
  tanks3: [['Three first-stage cores', 'แกนสเตจแรกสามแกน'], ['A centre core plus two side boosters, all carrying propellant. The side boosters separate early and can land on their own.', 'แกนกลางกับบูสเตอร์ข้างสองท่อน ทุกท่อนบรรทุกเชื้อเพลิง บูสเตอร์ข้างแยกตัวก่อนและลงจอดเองได้']],
  engines: [['Engines', 'เครื่องยนต์'], ['Merlin 1D engines burn kerosene with liquid oxygen. The cluster at the base provides the thrust that lifts everything off the pad.', 'เครื่องยนต์ Merlin 1D เผาน้ำมันก๊าดกับออกซิเจนเหลว กลุ่มเครื่องยนต์ที่ฐานให้แรงขับยกจรวดทั้งลำขึ้นจากแท่น']],
  legs: [['Landing legs', 'ขาลงจอด'], ['Folded against the body during ascent, they swing out before touchdown so the first stage can land and fly again.', 'พับแนบลำตัวระหว่างขึ้น แล้วกางออกก่อนแตะพื้นเพื่อให้สเตจแรกลงจอดและกลับมาใช้ซ้ำได้']],
  les: [['Launch escape system', 'ระบบหนีภัยตอนปล่อย'], ['A small rocket tower on top that could yank the crew capsule away if the launch went wrong.', 'หอจรวดขนาดเล็กด้านบนที่ดึงแคปซูลลูกเรือหนีได้ทันทีหากการปล่อยผิดพลาด']],
  csm: [['Command & Service Module', 'โมดูลบังคับการและโมดูลบริการ'], ['The crew capsule plus the service module with the main engine, power and supplies for the trip to the Moon and back.', 'แคปซูลลูกเรือพร้อมโมดูลบริการที่มีเครื่องยนต์หลัก พลังงาน และเสบียงสำหรับเดินทางไปกลับดวงจันทร์']],
  sla: [['Spacecraft–LM adapter', 'ตัวต่อยานกับยานลงดวงจันทร์'], ['A conical shroud that protected the lunar module and joined the spacecraft to the rocket. Its panels folded away after launch.', 'กรวยที่ห่อหุ้มยานลงดวงจันทร์และเชื่อมยานอวกาศกับจรวด แผ่นด้านข้างพับออกหลังปล่อย']],
  iu: [['Instrument Unit', 'หน่วยเครื่องมือนำทาง'], ['A thin ring packed with the computers and guidance electronics that flew the rocket.', 'วงแหวนบางที่อัดแน่นด้วยคอมพิวเตอร์และระบบนำทางที่บังคับจรวด']],
  ivb: [['Third stage (S-IVB)', 'สเตจที่ 3 (S-IVB)'], ['One J-2 engine reached Earth orbit, then fired a second time to send the spacecraft toward the Moon.', 'เครื่องยนต์ J-2 หนึ่งเครื่องพาขึ้นสู่วงโคจรโลก แล้วจุดอีกครั้งเพื่อส่งยานไปดวงจันทร์']],
  sii: [['Second stage (S-II)', 'สเตจที่ 2 (S-II)'], ['Five J-2 engines burning liquid hydrogen and liquid oxygen carried the vehicle most of the way to orbit.', 'เครื่องยนต์ J-2 ห้าเครื่องเผาไฮโดรเจนเหลวกับออกซิเจนเหลว พายานเกือบถึงวงโคจร']],
  sic: [['First stage (S-IC)', 'สเตจที่ 1 (S-IC)'], ['Five F-1 engines, the most powerful single-chamber liquid-fuel rocket engines ever flown, lifted everything off the pad.', 'เครื่องยนต์ F-1 ห้าเครื่อง ซึ่งเป็นเครื่องยนต์จรวดเชื้อเพลิงเหลวห้องเผาไหม้เดียวที่ทรงพลังที่สุดที่เคยบิน ยกจรวดทั้งลำขึ้นจากแท่น']],
};
const CH = {
  f9: [['fairing', ['PL-020', 'PL-030']], ['payload', ['PL-050']], ['s2', ['S2-000']], ['is', ['IS-000']], ['tanks', ['S1-TNK-000']], ['engines', ['S1-AFT-000']], ['legs', ['S1-LEG-000']]],
  fh: [['fairing', ['PL-020', 'PL-030']], ['payload', ['PL-050']], ['s2', ['S2-000']], ['is', ['IS-000']], ['tanks3', ['S1-TNK-000']], ['engines', ['S1-AFT-000']], ['legs', ['S1-LEG-000']]],
  sv: [['les', ['SV-LES-000']], ['csm', ['SV-CSM-000']], ['sla', ['SV-SLA-000']], ['iu', ['SV-IU-000']], ['ivb', ['SV-IVB-000']], ['sii', ['SV-II-000']], ['sic', ['SV-IC-000']]],
};

const S = { manifest: null, veh: null, model: null, key: null, token: 0, dirty: true, visible: true, p: 0, keys: [], chapters: [], ch: -1, ctaOn: false, spin: 0, chosen: false, armed: false, rv: 0, rvT0: 0 };
let renderer, scene, camera, shadow;

/* ---------------- three.js ---------------- */
function setup() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight(0xfff1e0, 1.5); key.position.set(50, 70, 60);
  const rim = new THREE.DirectionalLight(0x9fd8ee, 0.7); rim.position.set(-60, 30, -50);
  const fill = new THREE.DirectionalLight(0x8aa6b8, 0.18); fill.position.set(-40, 10, 60);
  scene.add(key, rim, fill, new THREE.HemisphereLight(0xaac4d2, 0x0d151a, 0.18));
  camera = new THREE.PerspectiveCamera(30, 1, 0.2, 2000);
  shadow = makeShadow(); scene.add(shadow);
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(es => { S.visible = es[0].isIntersecting; S.dirty = true; }).observe(stage);
  resize();
  requestAnimationFrame(loop);
}
function resize() {
  const r = stage.getBoundingClientRect();
  if (!renderer || !r.width) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (S.model) { computeKeys(); S.dirty = true; }
}

/* ---------------- keyframes ---------------- */
const mobile = () => innerWidth <= 900;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function fit(box, margin) {
  const c = box.getCenter(V3()), sz = box.getSize(V3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = Math.max(sz.x, sz.z);
  const dist = (Math.max(sz.y / 2 / tan, w / 2 / (tan * camera.aspect)) + w / 2) * margin;
  return { c, dist: Math.max(dist, 6) };
}
function chapterBox(ids) {
  const b = new THREE.Box3();
  for (const id of ids) for (const m of S.model.meshesUnder(id)) b.expandByObject(m);
  return b;
}

function computeKeys() {
  const m = S.model, t0 = m.t;
  const base = m.box(m.meshes);
  m.setExplode(1);
  const ex = m.box(m.meshes);
  const specs = CH[S.key];
  const boxes = specs.map(([, ids]) => chapterBox(ids));
  m.setExplode(t0);

  const N = specs.length, A = 0.22, B = 0.84, W = (B - A) / N, side = mobile() ? 0 : 0.18;
  const fb = fit(base, 1.2), fe = fit(ex, 1.15);
  const K = (f, azim, elev, ox, oy, tt) => ({ c: f.c.clone(), dist: f.dist, azim, elev, ox, oy, t: tt });
  const keys = [
    { p: 0, k: K(fb, 0.55, 0.1, 0, 0, 0) },
    { p: 0.12, k: K(fb, 0.55, 0.1, 0, 0, 0) },
    { p: A, k: K(fe, 0.9, 0.14, 0, 0, 1) },
  ];
  S.chapters = specs.map(([name], i) => {
    const bx = boxes[i], f = fit(bx.isEmpty() ? ex : bx, 1.45);
    const right = i % 2 === 0; // caption on the right -> model shifted left
    const ox = mobile() ? 0 : (right ? side : -side), oy = mobile() ? 0.17 : 0;
    const a = A + i * W, k = K(f, 0.9 + (i + 1) * 1.5, 0.1 + 0.1 * Math.sin(i * 1.7), ox, oy, 1);
    keys.push({ p: a + 0.4 * W, k }, { p: a + 0.85 * W, k });
    const set = new Set(); for (const id of specs[i][1]) for (const mm of m.meshesUnder(id)) set.add(mm);
    return { name, a, W, right, id: specs[i][1][0], set };
  });
  const kr = K(fit(base, 1.5), 0.55 + Math.PI * 2 * Math.ceil((0.9 + N * 1.5) / (Math.PI * 2)), 0.1, 0, 0.07, 0); // a little smaller and higher: room for the button below
  keys.push({ p: 0.95, k: kr }, { p: 1, k: kr });
  S.keys = keys;
}

function evaluate(p) {
  const ks = S.keys;
  let i = 0;
  while (i < ks.length - 2 && p > ks[i + 1].p) i++;
  const a = ks[i], b = ks[i + 1], s = ease(clamp((p - a.p) / Math.max(b.p - a.p, 1e-6)));
  const L = (x, y) => x + (y - x) * s;
  return {
    c: a.k.c.clone().lerp(b.k.c, s), dist: L(a.k.dist, b.k.dist), azim: L(a.k.azim, b.k.azim) + 0.5 * Math.sin(Math.PI * s), elev: L(a.k.elev, b.k.elev),
    ox: L(a.k.ox, b.k.ox), oy: L(a.k.oy, b.k.oy), t: L(a.k.t, b.k.t),
  };
}

/* ---------------- per-frame state ---------------- */
function trackProgress() {
  if (!S.armed) return 0; // ignore any restored scroll position until the loading screen is gone
  const r = story.getBoundingClientRect(), span = r.height - innerHeight;
  return span > 0 ? clamp(-r.top / span) : 0;
}
/* dim everything except the part being described (soft fade, restored when the tour is over) */
const DIM = 0.22;
function dimOthers(p) {
  const m = S.model; let d = 0, ch = null;
  if (S.chosen && p >= 0.22 && p < 0.95) {
    const N = S.chapters.length, i = clamp(Math.floor((p - 0.22) / ((0.84 - 0.22) / N)), 0, N - 1), c = S.chapters[i];
    ch = c; d = smooth(c.a + 0.1 * c.W, c.a + 0.4 * c.W, p) * (1 - smooth(c.a + 0.85 * c.W, c.a + 1.0 * c.W, p));
    if (i === N - 1) d = Math.min(d, 1 - smooth(0.88, 0.94, p));
  }
  d = Math.round(d * 50) / 50;
  if (d === S.dimD && ch === S.dimCh) return;
  S.dimD = d; S.dimCh = ch;
  for (const mesh of m.meshes) {
    const keep = !ch || ch.set.has(mesh), base = mesh._clone || mesh._baseMat;
    if (!base) continue;
    if (d === 0 || keep) { if (mesh._dim && mesh.material === mesh._dim) mesh.material = base; continue; }
    if (!mesh._dim) { mesh._dim = base.clone(); mesh._dim.transparent = true; }
    mesh._dim.opacity = 1 - (1 - DIM) * d; mesh._dim.depthWrite = d < 0.3;
    mesh.material = mesh._dim;
  }
}
function apply(p, spinAdd = 0) {
  const m = S.model; if (!m || !S.keys.length) return;
  const st = evaluate(p);
  if (Math.abs(st.t - m.t) > 0.0004) { m.setExplode(st.t); placeShadow(shadow, m.box(m.meshes)); }
  const az = st.azim + spinAdd, cd = Math.cos(st.elev);
  camera.position.copy(st.c).add(V3(Math.sin(az) * cd, Math.sin(st.elev), Math.cos(az) * cd).multiplyScalar(st.dist));
  camera.lookAt(st.c);
  const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
  const pan = S.rv < 1 ? Math.pow(1 - S.rv, 3) * 0.95 : 0; // extra downward pan while the chosen rocket comes into view
  if (Math.abs(st.ox) > 1e-3 || Math.abs(st.oy) > 1e-3 || pan > 1e-3) camera.setViewOffset(W, H, st.ox * W, (st.oy - pan) * H, W, H); else camera.clearViewOffset();
  camera.near = Math.max(0.2, st.dist / 300); camera.far = st.dist * 40; camera.updateProjectionMatrix();
  dimOthers(p);
  updateCaption(p);
  S.dirty = true;
}

function updateCaption(p) {
  // hero (wordmark + Let's explore) -> rocket chooser -> chosen rocket pans in
  const hp = 1 - smooth(0.004, 0.05, p), cp = smooth(0.07, 0.1, p); // the ROCKET page scrolls away first, then the chooser comes in
  stage.style.setProperty('--hs', smooth(0, 0.05, p).toFixed(3));
  stage.style.setProperty('--hp', hp.toFixed(3));
  stage.style.setProperty('--cp', S.chosen ? 0 : cp.toFixed(3));
  stage.style.setProperty('--cb', back(cp).toFixed(3)); // chooser buttons bounce in
  stage.classList.toggle('picking', !S.chosen && cp > 0.4);
  stage.classList.toggle('chosen', S.chosen);
  stage.classList.toggle('away', hp < 0.3);
  const away = smooth(0.045, 0.07, p); // the 3D model never shows on the ROCKET hero page, even after a choice
  canvas.style.opacity = S.chosen ? Math.min(S.rv * 3, 1) * away : 0;
  canvas.style.visibility = S.chosen && away > 0 ? 'visible' : 'hidden';
  canvas.style.transform = S.chosen && S.rv < 1 ? `scale(${(0.3 + 0.7 * back(S.rv)).toFixed(3)})` : ''; // the chosen rocket pops out
  document.querySelector('.picker').style.opacity = S.chosen ? smooth(0.1, 0.14, p) : 0;
  document.querySelector('.picker').style.pointerEvents = S.chosen && p > 0.11 ? '' : 'none';
  const cap = $('cap'), N = S.chapters.length;
  const inTour = S.chosen && p >= 0.22 && p < 0.9;
  let i = -1, o = 0;
  if (inTour) {
    i = clamp(Math.floor((p - 0.22) / ((0.84 - 0.22) / N)), 0, N - 1);
    const c = S.chapters[i];
    o = smooth(c.a + 0.36 * c.W, c.a + 0.52 * c.W, p) * (1 - smooth(c.a + 0.8 * c.W, c.a + 0.93 * c.W, p));
    if (i === N - 1) o = smooth(c.a + 0.36 * c.W, c.a + 0.52 * c.W, p) * (1 - smooth(0.88, 0.93, p));
  }
  if (i !== S.ch && i >= 0) { S.ch = i; renderCaption(); }
  cap.hidden = i < 0;
  cap.style.setProperty('--cap-o', o.toFixed(3));
  if (i >= 0) { cap.classList.toggle('right', S.chapters[i].right); cap.classList.toggle('left', !S.chapters[i].right); }
  document.querySelectorAll('#dots button').forEach((b, k) => b.classList.toggle('on', k === i));
  $('dots').style.setProperty('--dots-o', p >= 0.2 && p < 0.93 ? 1 : 0);
  // end of the story: reassembled rocket + button
  const showCta = S.chosen && p >= 0.955;
  if (showCta !== S.ctaOn) {
    S.ctaOn = showCta;
    const cta = $('cta');
    cta.hidden = !showCta;
    cta.classList.remove('on');
    if (showCta) { void cta.offsetWidth; cta.classList.add('on'); }
  }
}
function renderCaption() {
  const c = S.chapters[S.ch]; if (!c) return;
  const N = S.chapters.length, [tt, dd] = TXT[c.name], th = getLang() === 'th' ? 1 : 0;
  $('cap-i').textContent = String(S.ch + 1).padStart(2, '0');
  $('cap-of').textContent = `/ ${String(N).padStart(2, '0')}`;
  $('cap-t').textContent = tt[th];
  $('cap-d').textContent = dd[th];
  $('cap-id').textContent = c.id;
}

let scrollQ = false;
addEventListener('scroll', () => { if (trackProgress() < 0.045) { canvas.style.visibility = 'hidden'; canvas.style.opacity = 0; } /* instant guard: never any 3D on the hero */ if (scrollQ) return; scrollQ = true; requestAnimationFrame(() => { scrollQ = false; S.p = trackProgress(); apply(S.p, S.spin); }); }, { passive: true });

function loop(now) {
  requestAnimationFrame(loop);
  if (!S.visible || !S.model) return;
  if (S.chosen && S.rv < 1) { S.rv = Math.min((now - S.rvT0) / 1400, 1); apply(S.p, S.spin); }
  if (S.ctaOn && !reduce) { S.spin = (now / 1000) * 0.18; apply(S.p, S.spin); } // slow turntable at the end
  if (S.dirty) { S.dirty = false; renderer.render(scene, camera); }
}

/* ---------------- loading a rocket ---------------- */
async function loadVehicle(key) {
  const v = VEHICLES.find(x => x.key === key), token = ++S.token;
  $('loading3d').classList.remove('done');
  $('loading3d').querySelector('span').textContent = t('cu.loadingV', { name: v.label });
  try {
    const model = await loadModel(`rocket3d/models/${v.file}.glb`, S.manifest, key, f => window.__loader?.progress(0.12 + f * 0.72));
    if (token !== S.token) { model.dispose(); return; }
    if (S.model) { const prev = S.veh; for (const mm of S.model.meshes) { mm._dim?.dispose(); mm._dim = null; } S.model.dispose(); unloadGLB(`rocket3d/models/${prev.file}.glb`); }
    S.veh = v; S.model = model; S.key = key; S.ch = -1; S.dimD = -1; S.dimCh = null;
    scene.add(model.root);
    const saved = loadSaved(key);
    if (saved?.paint) model.importPaint(saved.paint); // colours picked on the customize page show up here too
    const variant = model.variantNames.includes(saved?.variant) ? saved.variant : v.variant;
    if (model.variantNames.length) await model.setVariant(variant);
    model.setExplode(0);
    placeShadow(shadow, model.box(model.meshes));
    buildDots();
    sizeTrack();
    computeKeys();
    S.p = trackProgress();
    apply(S.p);
    $('loading3d').classList.add('done');
    window.__loader?.progress(0.97);
    requestAnimationFrame(() => requestAnimationFrame(() => window.__loader?.finish()));
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('span').innerHTML = t('cu.loadErr');
    window.__loader?.finish();
  }
}
function sizeTrack() {
  const n = CH[S.key].length, unit = CSS.supports('height', '1svh') ? 'svh' : 'vh';
  const p0 = trackProgress();
  story.style.height = reduce ? '' : `${n * 88 + 420}${unit}`;
  const r = story.getBoundingClientRect(), span = r.height - innerHeight;
  if (span > 0 && p0 > 0) scrollTo(0, scrollY + r.top + p0 * span); // stay at the same point of the story after the track length changes
}
function buildDots() {
  const box = $('dots');
  box.innerHTML = '';
  CH[S.key].forEach(([name], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `${t('st.go')} ${i + 1}: ${TXT[name][0][getLang() === 'th' ? 1 : 0]}`);
    b.onclick = () => {
      const c = S.chapters[i]; if (!c) return;
      const r = story.getBoundingClientRect(), span = r.height - innerHeight;
      scrollTo({ top: scrollY + r.top + (c.a + 0.6 * c.W) * span, behavior: reduce ? 'auto' : 'smooth' });
    };
    box.append(b);
  });
}

/* ---------------- picker ---------------- */
const pick = $('rocket-pick');
for (const v of VEHICLES) { const o = document.createElement('option'); o.value = v.key; o.textContent = v.label; pick.append(o); }
let startKey = 'f9';
try { const k = localStorage.getItem('rocket3d:pick'); if (VEHICLES.some(v => v.key === k)) startKey = k; } catch { /* storage unavailable */ }
pick.value = startKey;
const chips = $('hero-chips');
const syncChips = () => chips.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(S.chosen && b.dataset.k === pick.value)));
async function choose(key) {
  const first = !S.chosen;
  if (pick.value !== key || S.key !== key) {
    pick.value = key;
    try { localStorage.setItem('rocket3d:pick', key); } catch { /* storage unavailable */ }
    S.chosen = true; syncChips();
    await loadVehicle(key);
  } else { S.chosen = true; syncChips(); }
  S.rvT0 = performance.now(); S.rv = reduce ? 1 : 0; // camera pans down onto the chosen rocket
  if (first || scrollY < story.offsetHeight * 0.05) { const span = story.offsetHeight - innerHeight; scrollTo({ top: span * 0.13, behavior: reduce ? 'auto' : 'smooth' }); }
  S.p = trackProgress(); apply(S.p, S.spin);
}
for (const v of VEHICLES) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.k = v.key; b.textContent = v.label;
  b.addEventListener('click', () => choose(v.key));
  chips.append(b);
}
pick.addEventListener('change', () => choose(pick.value));

/* ---------------- boot ---------------- */
async function boot() {
  try {
    setup();
    S.manifest = await Manifest.load('rocket3d/parts_manifest.json');
    window.__loader?.progress(0.12);
    await loadVehicle(startKey);
    if (reduce) { S.ctaOn = true; $('cta').hidden = false; }
  } catch (e) {
    console.error(e);
    $('loading3d').querySelector('i').hidden = true;
    $('loading3d').querySelector('span').innerHTML = t('cu.webgl');
    window.__loader?.finish();
  }
}
boot();
window.__story = { S, apply, trackProgress, loadVehicle };

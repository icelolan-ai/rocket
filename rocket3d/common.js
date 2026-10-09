// Shared bits for the full viewer (rocket3d/viewer.js) and the home-page lab (assets/rocket-lab.js)
import * as THREE from 'three';

export const VEHICLES = [
  { key: 'f9', code: 'F9', label: 'Falcon 9', note: '69.9 m', file: 'VEH_full', variant: 'CLEAN' },
  { key: 'fh', code: 'FH', label: 'Falcon Heavy', note: '3 core', file: 'VEH_FH_full', variant: 'CLEAN' },
  { key: 'sv', code: 'SV', label: 'Saturn V', note: '110.6 m', file: 'SV_full', variant: 'SV_AS506' },
];
export const SWATCHES = ['#f2f2ef', '#151515', '#e6f23a', '#e2674a', '#3b82c4', '#2f9e6b', '#c9a23f', '#8a8a85'];

// paint/variant/slot choices are shared between the home page and the viewer
const storeKey = k => `rocket3d:v1:${k}`;
export function loadSaved(key) {
  try { return JSON.parse(localStorage.getItem(storeKey(key)) || 'null'); } catch { return null; }
}
export function saveState(key, patch) {
  try { localStorage.setItem(storeKey(key), JSON.stringify({ ...loadSaved(key), ...patch })); } catch { /* storage unavailable */ }
}

// soft contact shadow under the model (studio look)
export function makeShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,.55)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.visible = false;
  return mesh;
}
export function placeShadow(mesh, box) {
  if (box.isEmpty()) { mesh.visible = false; return; }
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(sz.x, sz.z) * 1.9;
  mesh.scale.set(r, r, 1);
  mesh.position.set(c.x, box.min.y - 0.05, c.z);
  mesh.visible = true;
}

/* ---------- camera helpers shared by the home page and the viewer ---------- */
const clampN = (v, a, b) => Math.min(Math.max(v, a), b);

// smoothly move camera + orbit target; `tick` is called every frame (e.g. to request a render)
export function animateCamera(camera, controls, toPos, toTarget, ms = 450, tick = () => {}) {
  const p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now();
  cancelAnimationFrame(animateCamera._raf);
  const step = now => {
    const k = clampN((now - start) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(p0, toPos, e);
    controls.target.lerpVectors(t0, toTarget, e);
    controls.update(); tick();
    if (k < 1) animateCamera._raf = requestAnimationFrame(step);
  };
  animateCamera._raf = requestAnimationFrame(step);
}

// dolly towards / away from the orbit target
export function zoomStep(camera, controls, factor, tick) {
  const dir = camera.position.clone().sub(controls.target);
  const d = clampN(dir.length() * factor, controls.minDistance, controls.maxDistance);
  animateCamera(camera, controls, controls.target.clone().add(dir.setLength(d)), controls.target.clone(), 260, tick);
}

// fit the camera on a bounding box, keeping the current viewing direction
export function focusBox(camera, controls, box, tick, margin = 1.5) {
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const r = Math.max(sz.x, sz.y, sz.z) / 2;
  const dist = clampN((r * margin) / tan, controls.minDistance, controls.maxDistance);
  const dir = camera.position.clone().sub(controls.target).normalize();
  animateCamera(camera, controls, c.clone().addScaledVector(dir, dist), c, 520, tick);
}

// touch: pinch zooms about the screen centre (no drifting) and never pans, unless the hand tool is on;
// mouse keeps zoom-to-cursor + right-drag pan. `handBtn` (optional) toggles "hand" mode: one finger / left mouse drag moves the model.
export function pointerModes(controls, canvas, handBtn) {
  let hand = false;
  const set = e => { const mouse = e.pointerType === 'mouse'; controls.zoomToCursor = mouse; controls.enablePan = mouse || hand; };
  canvas.addEventListener('pointerdown', set, { capture: true });
  controls.zoomToCursor = true;
  if (!handBtn) return;
  const apply = () => {
    controls.mouseButtons.LEFT = hand ? 2 : 0; // THREE.MOUSE.PAN : ROTATE
    controls.touches.ONE = hand ? 2 : 0;       // THREE.TOUCH.PAN : ROTATE
    controls.touches.TWO = 2;                  // DOLLY_PAN
    handBtn.setAttribute('aria-pressed', String(hand));
    canvas.style.cursor = hand ? 'grab' : '';
  };
  handBtn.addEventListener('click', () => { hand = !hand; apply(); controls.enablePan = hand || controls.enablePan; });
  apply();
}

// keep the orbit target inside `box` so the model can never be dragged/zoomed off screen;
// the camera moves with the target, so the view only slides back instead of jumping
export function keepTargetInside(controls, camera, box) {
  if (!box || box.isEmpty()) return;
  const t = controls.target;
  if (box.containsPoint(t)) return;
  const c = t.clone().clamp(box.min, box.max);
  camera.position.add(c.clone().sub(t));
  t.copy(c);
}

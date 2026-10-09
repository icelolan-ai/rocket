// Shared bits for the full viewer (rocket3d/viewer.js) and the home-page lab (assets/rocket-lab.js)
import * as THREE from 'three';

export const VEHICLES = [
  { key: 'f9', code: 'F9', label: 'Falcon 9', note: '69.9 m', file: 'VEH_full', variant: 'CLEAN' },
  { key: 'fh', code: 'FH', label: 'Falcon Heavy', note: '3 core', file: 'VEH_FH_full', variant: 'CLEAN' },
  { key: 'sv', code: 'SV', label: 'Saturn V', note: '110.6 m', file: 'SV_full', variant: 'SV_AS506' },
];
export const SWATCHES = ['#f2f2ef', '#151515', '#e6f23a', '#e2674a', '#3b82c4', '#2f9e6b', '#c9a23f', '#8a8a85'];
export const ACC_TH = { documented: 'มีแหล่งอ้างอิง', 'standard-based': 'ตามมาตรฐาน', representative: 'ค่าประมาณ' };

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

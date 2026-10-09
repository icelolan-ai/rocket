// Slot swapping (manifest `slots`) and cross-model module placement.
// The GLBs carry no SKT_* sockets, so swaps rely on the variant files storing their
// nodes in the same parent-local frame as the nodes they replace (checked by bbox).
import * as THREE from 'three';
import { loadGLB } from './model.js';
import { t, partName } from './i18n.js';

const TOL = 0.15;
const base = f => (f || '').split('/').pop().replace(/\.glb$/, '');

function size(box) { return box.getSize(new THREE.Vector3()); }

// returns a Thai warning if any dimension differs by more than 15 %
export function compareBoxes(a, b) {
  if (a.isEmpty() || b.isEmpty()) return null;
  const sa = size(a), sb = size(b);
  const diffs = ['x', 'y', 'z'].map(k => Math.abs(sb[k] - sa[k]) / Math.max(sa[k], 1e-6));
  const worst = Math.max(...diffs);
  return worst > TOL
    ? t('s.size', { p: (worst * 100).toFixed(0) }) : null;
}

function boxOfNodes(nodes) {
  const b = new THREE.Box3();
  for (const n of nodes) b.expandByObject(n);
  return b;
}

function state(model, slotId) {
  model.slots ??= {};
  return model.slots[slotId];
}

// describes what can be done for a slot in this model; never guesses
export function slotInfo(manifest, model, slotId) {
  const def = manifest.slots[slotId];
  if (!def) return { ok: false, reason: t('s.noSlot') };
  if (slotId === 'SLOT_SV_PATTERN') return { ok: false, reason: t('s.sv') };
  const options = def.variants.map(id => ({ id, label: id ? `${partName(manifest.get(id), id)} (${id})` : t('s.none') }));
  const real = options.filter(o => o.id);
  const st = state(model, slotId);
  const live = [...model.nodesById.values()].flat().filter(n => n.userData.slot === slotId);
  if (!st && !live.length) return { ok: false, reason: t('s.empty') };
  if (options.length < 2) {
    return { ok: false, reason: t('s.single', { ids: real.map(o => o.id).join(', ') }) };
  }
  const defBase = base(manifest.get(def.default)?.files?.web);
  const missing = real.filter(o => o.id !== def.default && base(manifest.get(o.id)?.files?.web) === defBase);
  if (missing.length) return { ok: false, reason: t('s.nofile', { ids: missing.map(m => m.id).join(', ') }) };
  return { ok: true, options, current: st?.current ?? def.default };
}

export async function applySlot(manifest, model, slotId, targetId) {
  const def = manifest.slots[slotId];
  const info = slotInfo(manifest, model, slotId);
  if (!info.ok) throw new Error(info.reason);
  let st = state(model, slotId);
  if (!st) {
    const nodes = (model.nodesById.get(def.default) ?? []).filter(n => n.userData.slot === slotId);
    st = model.slots[slotId] = { current: def.default, parent: nodes[0].parent, sets: { [def.default]: nodes } };
  }
  if (st.current === targetId) return { warning: null };
  const t = model.t;
  model.setExplode(0);

  if (!(targetId in st.sets)) {
    if (targetId === null) st.sets[null] = [];
    else {
      const file = base(manifest.get(targetId).files.web);
      const gltf = await loadGLB(`models/${file}.glb`);
      const found = [];
      gltf.scene.traverse(o => { if (o.userData?.part_id && manifest.normId(o.userData.part_id) === targetId && !o.isInstancedMesh) found.push(o); });
      // keep only top-most matches
      const top = found.filter(o => !found.some(p => p !== o && p.getObjectById(o.id)));
      if (!top.length) throw new Error(t('s.nopart', { id: targetId, file }));
      st.sets[targetId] = top.map(o => o.clone(true));
    }
  }
  const oldNodes = st.sets[st.current];
  const oldBox = boxOfNodes(oldNodes);
  for (const n of oldNodes) st.parent.remove(n);
  for (const n of st.sets[targetId]) st.parent.add(n);
  st.current = targetId;
  const warning = targetId ? compareBoxes(oldBox, boxOfNodes(st.sets[targetId])) : null;
  model.reindex();
  model.refreshMaterials();
  model.setExplode(t);
  return { warning };
}

// ---------- gallery module -> open vehicle ----------

export function placeTarget(manifest, vehicle, galleryModel) {
  const rootId = galleryModel.rootId;
  if (!rootId) return null;
  const nodes = vehicle.nodesById.get(rootId);
  if (nodes?.length === 1 && !nodes[0].isInstancedMesh) return nodes[0];
  return null;
}

export function placeModule(manifest, vehicle, galleryModel) {
  const target = placeTarget(manifest, vehicle, galleryModel);
  if (!target) throw new Error(t('s.notarget'));
  const rootId = galleryModel.rootId;
  const t = vehicle.t;
  vehicle.setExplode(0);
  vehicle.root.updateMatrixWorld(true);
  galleryModel.setExplode(0);

  const oldBox = vehicle.box(vehicle.meshesUnder(rootId));
  const world = target.matrixWorld.clone();
  const scene = vehicle.gltf.scene;

  // 1. drop the old module (hierarchy + its instanced meshes living at the scene root)
  for (const it of [...vehicle.inst]) {
    if (manifest.isUnder(it.pid, rootId)) it.mesh.removeFromParent();
  }
  const parent = target.parent;
  const local = { p: target.position.clone(), q: target.quaternion.clone(), s: target.scale.clone() };
  parent.remove(target);

  // 2. add the new module with the same local transform.
  // clone with the unpainted base materials (the gallery may hold per-mesh paint clones)
  const src = galleryModel.gltf.scene;
  const savedMats = galleryModel.meshes.map(m => m.material);
  for (const m of galleryModel.meshes) m.material = m._baseMat ?? m.material;
  const rootNode = src.children.find(c => !c.isInstancedMesh && manifest.normId(c.userData?.part_id) === rootId);
  const node = rootNode.clone(true);
  node.position.copy(local.p); node.quaternion.copy(local.q); node.scale.copy(local.s);
  parent.add(node);
  // instanced meshes: bake the module->vehicle transform into the instance matrices
  for (const c of src.children) {
    if (!c.isInstancedMesh) continue;
    const m = c.clone();
    const mat = new THREE.Matrix4();
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, mat);
      mat.premultiply(world);
      m.setMatrixAt(i, mat);
    }
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  }
  galleryModel.meshes.forEach((m, i) => { m.material = savedMats[i]; });
  vehicle.reindex();
  vehicle.refreshMaterials();
  vehicle.root.updateMatrixWorld(true);
  vehicle.setExplode(t);
  return compareBoxes(oldBox, vehicle.box(vehicle.meshesUnder(rootId)));
}

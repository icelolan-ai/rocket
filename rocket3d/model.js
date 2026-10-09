// Model: wraps one loaded GLB (vehicle or module) and provides
// explode / paint / variants / hide-isolate on top of the glTF contract
// described in README_FOR_CLAUDE_CODE.md. All paths are relative.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// manifest direction strings are in the CAD frame (Z-up); glTF is Y-up
const CAD_AXES = {
  '+X': [1, 0, 0], '-X': [-1, 0, 0],
  '+Y': [0, 0, -1], '-Y': [0, 0, 1],
  '+Z': [0, 1, 0], '-Z': [0, -1, 0],
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltfCache = new Map();

export function loadGLB(url, onProgress) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((res, rej) => loader.load(url, res, onProgress && (e => e.total && onProgress(e.loaded / e.total)), rej)));
    gltfCache.get(url).catch(() => gltfCache.delete(url));
  }
  return gltfCache.get(url);
}

// drop a cached GLB (and its GPU resources) once nothing uses it any more
export function unloadGLB(url) {
  const p = gltfCache.get(url);
  gltfCache.delete(url);
  p?.then(g => disposeTree(g.scene)).catch(() => {});
}

export function disposeTree(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
    o.dispose?.();
  });
}

export class Manifest {
  constructor(json) {
    this.json = json;
    this.byId = new Map(json.parts.map(p => [p.id, p]));
    this.slots = json.slots;
    this.paintZones = json.paint_zones;
    this.variantLabels = json.material_variants;
  }
  static async load(url) { return new Manifest(await (await fetch(url)).json()); }
  // instanced meshes may carry suffixes (e.g. LIB-FST-010-M16x60) -> manifest id
  normId(id) {
    if (!id) return id;
    if (this.byId.has(id)) return id;
    const m = /^([A-Z0-9]+(?:-[A-Z0-9]+)*?-\d{3})/.exec(id);
    return m && this.byId.has(m[1]) ? m[1] : id;
  }
  get(id) { return this.byId.get(this.normId(id)); }
  parentOf(id) { return this.get(id)?.parent ?? null; }
  isUnder(id, ancestor) {
    for (let c = this.normId(id), n = 0; c && n < 20; c = this.parentOf(c), n++) if (c === ancestor) return true;
    return false;
  }
  ancestors(id) {
    const out = [];
    for (let c = this.normId(id), n = 0; c && n < 20; c = this.parentOf(c), n++) out.push(c);
    return out;
  }
  explodeOf(id) {
    const e = this.get(id)?.explode;
    const dir = e && CAD_AXES[e.direction];
    if (!dir || !(e.distance_m > 0) || (e.mode && e.mode !== 'translate')) return null;
    return { dir: new THREE.Vector3(...dir), dist: e.distance_m, order: e.order ?? null };
  }
}

const MAX_OWNER_DIST = 12; // metres
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();

export class Model {
  constructor(gltf, manifest, key) {
    this.key = key;
    this.manifest = manifest;
    this.gltf = gltf;
    this.root = new THREE.Group();
    this.root.name = 'model:' + key;
    this.root.add(gltf.scene);
    this.variantNames = gltf.scene.userData.gltfExtensions?.KHR_materials_variants?.variants?.map(v => v.name)
      ?? gltf.userData.gltfExtensions?.KHR_materials_variants?.variants?.map(v => v.name) ?? [];
    this.variant = null;
    this.t = 0;
    this.scopeId = null;
    this.stagger = false;
    this.hidden = new Set();
    this.isolated = null;
    // paint overrides: precedence mesh > part > zone
    this.paint = { zones: {}, parts: {}, meshes: {}, noTex: {} };
    this.matCache = new Map();
    this.reindex();
    // first real (non-instanced) part node at scene root = the module/vehicle root id
    const r = gltf.scene.children.find(c => !c.isInstancedMesh && (c.userData?.part_id || manifest.byId.has(c.name)));
    this.rootId = r ? manifest.normId(r.userData?.part_id || r.name) : null;
  }

  /* ---------- indexing ---------- */
  partOf(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.userData?.part_id) return this.manifest.normId(o.userData.part_id);
      if (o.isInstancedMesh && o.name) return this.manifest.normId(o.name);
    }
    return null;
  }

  reindex() {
    this.root.updateMatrixWorld(true);
    this.meshes = [];
    this.nodesById = new Map();
    this.expl = [];
    this.inst = [];
    const ord = new Map();
    this.root.traverse(o => {
      if (o.isMesh) {
        const pid = this.partOf(o);
        const n = ord.get(pid) ?? 0; ord.set(pid, n + 1);
        o._pid = pid;
        o._key = `${pid}|${n}`;
        this.meshes.push(o);
      }
      const ud = o.userData;
      if (ud?.part_id && !o.isInstancedMesh) {
        const id = this.manifest.normId(ud.part_id);
        (this.nodesById.get(id) ?? this.nodesById.set(id, []).get(id)).push(o);
      }
    });
    let maxOrder = 1;
    this.root.traverse(o => {
      const ud = o.userData;
      if (!ud?.explode_dir || !(ud.explode_dist > 0) || o.isInstancedMesh) return;
      const order = ud.explode_order ?? null;
      if (order) maxOrder = Math.max(maxOrder, order);
      this.expl.push({
        obj: o, base: o.position.clone(), dir: new THREE.Vector3(...ud.explode_dir),
        dist: ud.explode_dist, order,
      });
    });
    this.maxOrder = maxOrder;
    this.baseWorld = new Map();
    for (const list of this.nodesById.values()) for (const n of list) {
      this.baseWorld.set(n, { pos: n.getWorldPosition(new THREE.Vector3()), quat: n.getWorldQuaternion(new THREE.Quaternion()) });
    }
    this.meshBoxes = new Map();
    if (this.meshes.some(m => m.isInstancedMesh && this.manifest.get(m._pid)?.type === 'hardware')) {
      for (const m of this.meshes) {
        if (m.isInstancedMesh) continue;
        const box = new THREE.Box3().setFromObject(m);
        if (box.isEmpty()) continue;
        const sz = box.getSize(new THREE.Vector3());
        this.meshBoxes.set(m, { box, vol: sz.x * sz.y * sz.z, base: m.getWorldPosition(new THREE.Vector3()) });
      }
    }
    for (const m of this.meshes) if (m.isInstancedMesh) this.#indexInstanced(m);
    this.#indexVariants();
  }

  #indexInstanced(mesh) {
    if (!mesh.parent?.matrixWorld.equals(new THREE.Matrix4()) && mesh.parent !== this.gltf.scene && mesh.parent !== this.root) {
      // instanced meshes are expected at scene root with world-space instances
      console.warn('instanced mesh not at root:', mesh.name);
    }
    const pid = mesh._pid;
    const base = mesh.instanceMatrix.array.slice();
    const terms = [];
    for (let i = 0; i < mesh.count; i++) {
      tmpV.set(base[i * 16 + 12], base[i * 16 + 13], base[i * 16 + 14]).applyMatrix4(mesh.matrixWorld);
      terms.push(this.#termsFor(pid, tmpV));
    }
    this.inst.push({ mesh, pid, base, terms });
  }

  // chain of displacements an instance inherits: a real scene node (nearest) plus
  // virtual explode steps taken from the manifest for ancestors that have no node.
  // Nodes further than MAX_OWNER_DIST are rejected: the same part id can exist on
  // another stage (e.g. S2's engine reuses ENG-M1D-0xx ids).
  #termsFor(pid, pos) {
    const virt = [];
    for (let id = pid, n = 0; id && n < 20; id = this.manifest.parentOf(id), n++) {
      const nodes = id !== pid ? this.nodesById.get(id) : null;
      if (nodes?.length) {
        let best = null, bd = MAX_OWNER_DIST * MAX_OWNER_DIST;
        for (const nd of nodes) {
          const d = this.baseWorld.get(nd).pos.distanceToSquared(pos);
          if (d < bd) { bd = d; best = nd; }
        }
        if (best) {
          const q = this.baseWorld.get(best).quat;
          return {
            node: best, nodeBase: this.baseWorld.get(best).pos,
            virt: virt.map(v => ({ ...v, dir: v.dir.clone().applyQuaternion(q) })),
          };
        }
      }
      const ex = this.manifest.explodeOf(id);
      if (ex) virt.push({ id, ...ex });
    }
    // loose hardware (fasteners): the GLB does not say which part they belong to, so
    // follow the closest non-instanced mesh (heuristic, see PR notes)
    if (this.manifest.get(pid)?.type === 'hardware' && !virt.length) {
      const near = this.#nearestMesh(pos);
      if (near) return { node: near.obj, nodeBase: near.base, virt: [] };
    }
    return { node: null, virt };
  }

  #nearestMesh(pos) {
    let best = null, bs = Infinity;
    for (const [obj, e] of this.meshBoxes) {
      const score = e.box.distanceToPoint(pos) * 1000 + e.vol * 1e-6;
      if (score < bs) { bs = score; best = { obj, base: e.base }; }
    }
    return best;
  }

  /* ---------- explode ---------- */
  effT(t, order) {
    if (!this.stagger || order == null) return t;
    const d = Math.min(Math.max((order - 1) / Math.max(this.maxOrder - 1, 1), 0), 1) * 0.5;
    return Math.min(Math.max((t - d) / 0.5, 0), 1);
  }

  #inScopeNode(obj) {
    if (!this.scopeId) return true;
    const scopeNodes = this.nodesById.get(this.scopeId);
    if (!scopeNodes) return true;
    for (let o = obj; o; o = o.parent) if (scopeNodes.includes(o)) return true;
    return false;
  }

  setExplode(t, scopeId = this.scopeId) {
    this.t = t; this.scopeId = scopeId;
    for (const e of this.expl) {
      const k = this.#inScopeNode(e.obj) ? this.effT(t, e.order) : 0;
      e.obj.position.copy(e.base);
      if (k > 0) e.obj.position.addScaledVector(e.dir, e.dist * k);
    }
    this.root.updateMatrixWorld(true);
    for (const it of this.inst) {
      const arr = it.mesh.instanceMatrix.array;
      arr.set(it.base);
      for (let i = 0; i < it.terms.length; i++) {
        const tm = it.terms[i];
        tmpV.set(0, 0, 0);
        if (tm.node) tmpV.add(tm.node.getWorldPosition(new THREE.Vector3())).sub(tm.nodeBase);
        for (const v of tm.virt) {
          const on = !this.scopeId || this.manifest.isUnder(v.id, this.scopeId);
          if (on) tmpV.addScaledVector(v.dir, v.dist * this.effT(t, v.order));
        }
        arr[i * 16 + 12] += tmpV.x; arr[i * 16 + 13] += tmpV.y; arr[i * 16 + 14] += tmpV.z;
      }
      it.mesh.instanceMatrix.needsUpdate = true;
      it.mesh.computeBoundingSphere();
    }
  }

  /* ---------- queries ---------- */
  partIds() {
    const s = new Set();
    for (const m of this.meshes) if (m._pid) s.add(m._pid);
    return [...s];
  }
  meshesOf(pid) { return this.meshes.filter(m => m._pid === pid); }
  meshesUnder(pid) { return this.meshes.filter(m => this.manifest.isUnder(m._pid, pid)); }

  box(meshes = this.meshes.filter(m => m.visible)) {
    const b = new THREE.Box3();
    for (const m of meshes) b.expandByObject(m);
    return b;
  }

  /* ---------- hide / isolate ---------- */
  setHidden(pid, on) { on ? this.hidden.add(pid) : this.hidden.delete(pid); this.#applyVisibility(); }
  setIsolated(pid) { this.isolated = pid; this.#applyVisibility(); }
  showAll() { this.hidden.clear(); this.isolated = null; this.#applyVisibility(); }
  #applyVisibility() {
    for (const m of this.meshes) {
      const pid = m._pid;
      let vis = true;
      for (const h of this.hidden) if (this.manifest.isUnder(pid, h)) { vis = false; break; }
      if (vis && this.isolated && !this.manifest.isUnder(pid, this.isolated)) vis = false;
      m.visible = vis;
    }
  }

  /* ---------- variants (KHR_materials_variants) ---------- */
  #indexVariants() {
    this.variantMeshes = this.meshes.filter(m => m.userData.gltfExtensions?.KHR_materials_variants);
    for (const m of this.meshes) if (!m._baseMat) m._baseMat = m.material;
  }

  async setVariant(name) {
    const idx = this.variantNames.indexOf(name);
    if (idx < 0) return;
    const parser = this.gltf.parser;
    const jobs = [];
    for (const m of this.meshes) {
      const ext = m.userData.gltfExtensions?.KHR_materials_variants;
      const map = ext?.mappings.find(x => x.variants.includes(idx));
      if (map) jobs.push(parser.getDependency('material', map.material).then(mat => { m._baseMat = mat; }));
    }
    await Promise.all(jobs);
    this.variant = name;
    this.refreshMaterials();
  }

  /* ---------- paint ---------- */
  isPaintable(mesh) { return !!mesh._baseMat?.name?.startsWith('MAT_PAINT_'); }
  zoneOf(mesh) {
    for (let o = mesh; o; o = o.parent) if (o.userData?.paint_zone) return o.userData.paint_zone;
    return this.manifest.get(mesh._pid)?.paint_zone ?? null;
  }
  defaultColor(mesh) { return '#' + mesh._baseMat.color.getHexString(THREE.SRGBColorSpace); }
  colorOf(mesh) {
    const k = mesh._key, p = mesh._pid, z = this.zoneOf(mesh);
    return this.paint.meshes[k] ?? this.paint.parts[p] ?? (z && this.paint.zones[z]) ?? null;
  }
  hasTexture(mesh) { return !!mesh._baseMat?.map; }

  // scope: 'mesh' | 'part' | 'zone'
  setColor(mesh, hex, scope) {
    if (!this.isPaintable(mesh)) return false;
    if (scope === 'mesh') this.paint.meshes[mesh._key] = hex;
    else if (scope === 'part') {
      this.paint.parts[mesh._pid] = hex;
      for (const m of this.meshesOf(mesh._pid)) delete this.paint.meshes[m._key];
    } else {
      const z = this.zoneOf(mesh);
      if (!z) return false;
      this.paint.zones[z] = hex;
      for (const m of this.meshes) if (this.zoneOf(m) === z) { delete this.paint.meshes[m._key]; delete this.paint.parts[m._pid]; }
    }
    this.refreshMaterials();
    return true;
  }
  setNoTexture(mesh, on) {
    const k = mesh._pid;
    on ? this.paint.noTex[k] = true : delete this.paint.noTex[k];
    this.refreshMaterials();
  }
  resetPaint(pid = null) {
    if (pid) {
      delete this.paint.parts[pid]; delete this.paint.noTex[pid];
      for (const m of this.meshesOf(pid)) delete this.paint.meshes[m._key];
    } else this.paint = { zones: {}, parts: {}, meshes: {}, noTex: {} };
    this.refreshMaterials();
  }
  exportPaint() { return JSON.parse(JSON.stringify(this.paint)); }
  importPaint(p) {
    this.paint = { zones: {}, parts: {}, meshes: {}, noTex: {}, ...p };
    this.refreshMaterials();
  }

  // materials are shared between meshes: clone per mesh before changing colour
  refreshMaterials() {
    for (const m of this.meshes) {
      const base = m._baseMat;
      if (!base) continue;
      const hex = this.isPaintable(m) ? this.colorOf(m) : null;
      const noTex = !!this.paint.noTex[m._pid] && !!base.map;
      if (!hex && !noTex) {
        if (m.material !== base) this.#dropClone(m);
        m.material = base;
        continue;
      }
      let clone = m._clone;
      if (!clone || clone.userData.src !== base) {
        this.#dropClone(m);
        clone = base.clone();
        clone.userData.src = base;
        m._clone = clone;
      }
      clone.color.copy(base.color);
      if (hex) clone.color.set(hex);
      clone.map = noTex ? null : base.map;
      clone.needsUpdate = true;
      m.material = clone;
    }
  }
  #dropClone(m) { m._clone?.dispose(); m._clone = null; }

  /* ---------- lifecycle ---------- */
  dispose() {
    for (const m of this.meshes) this.#dropClone(m);
    // geometry/materials of the source gltf are cached and shared; only drop the clones
    this.root.removeFromParent();
  }
}

export async function loadModel(url, manifest, key, onProgress) {
  const gltf = await loadGLB(url, onProgress);
  // clone so a cached gltf can back several Model instances; materials/geometry stay shared
  const clone = { ...gltf, scene: gltf.scene.clone(true) };
  return new Model(clone, manifest, key);
}

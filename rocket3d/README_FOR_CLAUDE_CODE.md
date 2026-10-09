# Web handoff — Rocket 3D viewer (Falcon 9 Block 5 reference)

> Status: **READY (P7, 2026-10-09)**. This folder is the only thing the web project needs to read.

## Contents
- `models/*.glb` — Meshopt-compressed GLBs (no textures except one 4x256 soot ramp in VEH_full).
  - `VEH_full.glb` (~3.0 MB) — whole vehicle, 69.9 m (standard fairing), variants CLEAN / FLIGHT_PROVEN.
  - `VEH_FH_full.glb` (~3.2 MB) — **Falcon Heavy**: centre core (F9 stack, no legs) + 2 side boosters (nose cone, legs stowed). Same extras/variants contract. Copies of a part on the side boosters are named `<ID>__b1` / `<ID>__b2` (extra `booster` = 1|2); booster roots are empties `FH-B1`, `FH-B2` (explode dir ±X, 6 m) — their children (S1, IS, nose cone, attach struts) ride with them.
  - Module GLBs for part-level viewing: `ENG_M1D(.glb, _x9)`, `ENG_MVAC`, `S1_AFT`, `S1_LEG`, `S1_TNK`, `IS`, `S2`, `PL`.
  - Swap-in variants: `IS_GRIDFIN_AL` (SLOT_GRIDFIN), `PL_FAIRING_EXT` (SLOT_FAIRING, extended), `PL_PAYLOAD_B` (SLOT_PAYLOAD B).
- `parts_manifest.json` — source of truth for every part (accuracy, material, paint_zone, slot, explode, files).
- `example/variants_example.html` — minimal three.js example: loads `VEH_full.glb`, applies a variant, applies explode.

## Contract
- Units metres; glTF Y-up (rocket axis = +Y). Vehicle origin = centre of S1 aft plane; legs reach y = -0.9 m.
- Node name = part ID (`S1-TNK-010`); instances suffixed `__i01`, `__i02`…
- Node `extras`: `part_id`, `accuracy`, `paint_zone`, `slot`, `explode_group`, `explode_order`, `explode_dir` [x,y,z glTF, in the PARENT node's local frame], `explode_dist` (m). Explode = `position += dir * dist * t` (cumulative with parents; assemblies VEH-000/S1-000/S1-TNK-000 have dist 0).
- Sockets: empties `SKT_<ID>_<name>`; a part's local origin = its mating point.
- Paintable materials: prefix `MAT_PAINT_` (+ `paint_zone` extra); defaults in manifest `paint_zones`. Clone the material per mesh/zone before recolouring (materials are shared).
- Variants: `KHR_materials_variants` — `CLEAN`, `FLIGHT_PROVEN` (soot via texture on `__FP` materials; applies to engines, aft skirt/legs, S1 tank barrels; not LEG-050). The variant mapping is per primitive: use `GLTFLoader` `userData.gltfExtensions.KHR_materials_variants` (see example) or three-gltf-variants helper.
- Slots/swaps: manifest `slots`. Accuracy levels (`documented` / `standard-based` / `representative`) should be shown to viewers.

## Loaders (three.js)
`GLTFLoader` + `MeshoptDecoder`. `EXT_mesh_gpu_instancing` is used (engines, legs) — supported by GLTFLoader ≥ r15x. KTX2 not required (no big textures); Draco not used.

## Known approximations
See `../00_docs/decisions/D-003..D-009`: Merlin 1D 2.24 m (real ~2.9 m), fins/pods/pushers/COPV/trusses estimated, tank domes/stringers representative, payload sats are generic.

## Saturn V (S0–S5)
- `SV_full.glb` (~2.9 MB) — whole Saturn V SA-506 reference, 110.6 m, ⌀10.06 m (S-IC fins span 19 m). Root `SV-000`; module roots `SV-IC-000`, `SV-II-000`, `SV-IVB-000`, `SV-IU-000`, `SV-SLA-000`, `SV-CSM-000`, `SV-LES-000` (explode +Z: 0/6/12/17/20/24/30 m, cumulative with part/engine explode). F-1 ×5 and J-2 ×5+1 are engine roots `ENG-F1-000__i01..`, `ENG-J2-000__i01..`.
- Variants (KHR_materials_variants): `SV_AS506` (default, white) and `SV_AS501` (black/white roll pattern on S-IC tanks, black fins/interstage/IU band). Slot `SLOT_SV_PATTERN`.
- Module GLBs (stage frame, origin = module aft plane): `SV_IC, SV_II, SV_IVB, SV_IU, SV_SLA, SV_CSM, SV_LES, ENG_F1, ENG_J2`.
- Dimensions are estimates (D-011..D-015) pending check vs Saturn V Flight Manual SA-503.

# 3D Rocket Viewer

หน้า `viewer.html` แสดงจรวด **Falcon 9, Falcon Heavy, Saturn V** แบบ 3 มิติ ถอดแยกชิ้นส่วน คลิกเลือกชิ้น เปลี่ยนสี สลับ variant/ชิ้นส่วน และดูโมดูลแยกใน Part Gallery
เป็น static HTML + ES modules ล้วน ไม่มี build tool / framework

## รันในเครื่อง
```bash
python3 -m http.server 8000      # รันที่ root ของ repo
# เปิด http://localhost:8000/rocket3d/viewer.html   (?v=f9|fh|sv เลือกลำเริ่มต้น)
```
ต้องเสิร์ฟผ่าน HTTP (ไม่ใช่เปิดไฟล์ตรง) เพราะใช้ ES module + `fetch`
path ทั้งหมดเป็น relative จึงใช้ได้ทั้งที่ root และใต้ sub-path ของ GitHub Pages

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `viewer.html` / `viewer.css` | โครงหน้าและสไตล์ (ใช้สี/ฟอนต์ชุดเดียวกับ `../assets/style.css`) |
| `viewer.js` | UI, กล้อง/renderer, picking, สี, variant, gallery |
| `model.js` | `Model` ห่อ GLB หนึ่งไฟล์: index ชิ้นส่วน, explode, สี, variants, ซ่อน/isolate |
| `slots.js` | สลับชิ้นส่วนตาม `slots` ใน manifest และวางโมดูลข้ามไฟล์ |
| `vendor/three/` | three.js **r170** (`three.module.min.js`, GLTFLoader, OrbitControls, BufferGeometryUtils, MeshoptDecoder, RoomEnvironment) + LICENSE — ใช้ผ่าน `<script type="importmap">` ไม่พึ่ง CDN |
| `models/*.glb`, `parts_manifest.json` | ข้อมูลจากไปป์ไลน์ CAD→Blender (**ห้ามแก้**) |

## การทำงานสำคัญ
- **Explode:** `position += dir * dist * t` ต่อ node ตาม `extras` (cumulative ตาม hierarchy) เก็บ position เดิมไว้ ที่ `t=0` จึงกลับที่เดิมพอดี (ทดสอบแล้ว diff = 0)
- **ชิ้นแบบ instanced** (`EXT_mesh_gpu_instancing`: เครื่องยนต์ S1 ×9, ขา, pusher, น็อต) อยู่ที่ root ของ scene ไม่มี `extras` และไม่อยู่ใน hierarchy จึงผูกกับ part ผ่านชื่อ mesh + chain `parent` ใน manifest แล้วคำนวณระยะถอดต่อ instance (ดูหมายเหตุด้านล่าง)
- **สี:** เฉพาะ material ที่ขึ้นต้น `MAT_PAINT_` ซึ่งถูกแชร์ จึง clone ต่อ mesh ก่อนแก้; ขอบเขต ชิ้นนี้ / paint_zone / ทุก instance ของ part; เก็บใน `localStorage` แยกตามลำ (`rocket3d:v1:<f9|fh|sv>`), Export/Import JSON
- **Variants:** อ่านจาก `KHR_materials_variants` สีที่ตั้งไว้เก็บแยกจาก material จึงไม่หายตอนสลับ; ชิ้นที่มี texture ลาย (เขม่า) จะเป็นสี × ลาย ปิดลายต่อชิ้นได้
- **ประสิทธิภาพ:** โหลด GLB ตอนเลือกลำ (lazy), ตอนสลับลำ dispose geometry/material/texture ของลำเดิมและทิ้ง cache, `pixelRatio ≤ 2`, render เฉพาะเมื่อมีการเปลี่ยนแปลง

## ข้อจำกัด / สิ่งที่พบในข้อมูล (แจ้งเจ้าของไปป์ไลน์)
1. **ไม่มี `SKT_*` socket ในไฟล์ GLB** (README ระบุว่ามี) — การสลับ slot จึงอาศัยว่าไฟล์ variant (`IS_GRIDFIN_AL`, `PL_FAIRING_EXT`, `PL_PAYLOAD_B`) เก็บ transform ใน frame เดียวกับ parent ของชิ้นเดิม แล้วเตือนด้วยการเทียบ bounding box (เกิน 15%): แฟริ่งยาว +47%, payload B +21% (กริดฟินอลูมิเนียมไม่เตือน)
2. slot `SLOT_S1_ENGINE`, `SLOT_S2_ENGINE` มีตัวเลือกเดียวใน manifest → ปุ่มสลับถูกซ่อนและแสดงเหตุผล; `SLOT_SV_PATTERN` ใช้เมนู Variant; Falcon Heavy ไม่มีกริดฟินที่ลำกลาง จึงไม่มี `SLOT_GRIDFIN`
3. ชิ้นแบบ instanced ไม่มี `part_id`/`explode_*` ใน GLB ใช้ค่าจาก manifest (ทิศใน manifest เป็น CAD Z-up แปลงเป็น glTF Y-up; ทิศ `radial` ไม่ถูกใช้) และ **น็อต/ฮาร์ดแวร์ `LIB-FST-*` ไม่มี parent** จึงผูกกับ mesh ที่ใกล้ที่สุด (heuristic)
4. id ซ้ำข้ามสเตจ: เครื่อง MVAC ของ S2 ใช้ id `ENG-M1D-0xx` เดียวกับเครื่อง Merlin 1D ของ S1 (instanced) — viewer ไฮไลต์เฉพาะจุดที่คลิก
5. node ขา `S1-LEG-000` ทั้ง 4 ตั้งชื่อซ้ำ (ไม่มี `__i0N`) และ node ลูก (เช่น `S1-LEG-020__cylinder`) มี `explode_dist` เท่ากับ node แม่ → ตามกติกา cumulative จะถอดไกลเป็น 2 เท่า (ตรวจกับเจ้าของข้อมูลว่าตั้งใจหรือไม่)
6. Part Gallery: "วางแทนในลำที่เปิดอยู่" ใช้ได้กับโมดูลที่มี node เดียวในลำนั้น (`IS`, `PL`, `S2`, `S1_TNK`, `S1_AFT`, Saturn V modules บน Saturn V) และชิ้นสลับ slot; `S1_LEG`/`ENG_M1D*` (หลาย instance) ดูอย่างเดียว; Saturn V ไม่มีชิ้นร่วมกับ Falcon

ขนาดบางส่วนเป็นค่าประมาณ — ดูระดับ `accuracy` (documented / standard-based / representative) ของแต่ละชิ้นเสมอ

## ภาษา (EN / TH)
ทั้งหน้าแรกและ `viewer.html` มีปุ่ม EN / TH (ค่าเริ่มต้นคือ English, จำค่าที่เลือกใน `localStorage` คีย์ `rocket3d:lang`) ข้อความอยู่ใน `rocket3d/i18n.js` — ข้อความ static ใช้ `data-i18n` / `data-i18n-attr` ส่วนข้อความจาก JS ใช้ `t('key')` ชื่อชิ้นส่วนใช้ `name_en` / `name_th` จาก manifest ตามภาษา

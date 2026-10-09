// Tiny i18n: English is the default, Thai is available. Shared by the home page and the viewer.
// Static text uses data-i18n="key" (textContent) / data-i18n-html="key" / data-i18n-attr="attr:key,attr2:key2".
const KEY = 'rocket3d:lang';

const DICT = {
  en: {
    // nav / common
    'nav.home': 'Home', 'nav.customize': 'Customize', 'nav.rockets': 'Rockets', 'nav.features': 'Features', 'nav.contact': 'Contact',
    'nav.viewer': 'Open viewer', 'nav.menu': 'Menu', 'nav.main': 'Main menu', 'lang.label': 'Language', 'nav.home.aria': 'Rocket — home',
    // intro
    'intro.eyebrow': 'Launch vehicles in 3D', 'intro.sub': 'Explore, disassemble and recolor launch vehicles', 'intro.go': "Let's explore",
    'intro.scroll': 'Scroll', 'stat.parts': 'Parts in manifest', 'stat.rockets': 'Launch vehicles', 'stat.modules': '3D modules', 'stat.docs': 'Documented parts',
    'stat.aria': 'Key numbers',
    // customize
    'cu.aria': 'Customize the rocket in 3D', 'cu.canvas': '3D rocket model. Drag to rotate, click a part to select it',
    'cu.kicker': 'Customize', 'cu.rocket': 'Rocket', 'cu.rocket.aria': 'Choose a rocket', 'cu.variant': 'Variant', 'cu.explode': 'Disassemble',
    'cu.explode.btn': 'Disassemble / assemble', 'cu.explode.slider': 'Disassembly level', 'cu.color': 'Color',
    'cu.paint.none': 'Select a part first', 'cu.paint.no': '{name}: cannot be recolored', 'cu.paint.why': 'Material {m} is not paintable (MAT_PAINT_)',
    'cu.swatches': 'Preset colors', 'cu.custom': 'Custom color', 'cu.resetPart': 'Reset part', 'cu.resetAll': 'Reset all',
    'cu.parts': 'Parts', 'cu.search': 'Search parts / part id', 'cu.selected': 'Selected part', 'cu.selectHint': 'Click a part on the model or pick one from the list.',
    'kv.id': 'part id', 'kv.acc': 'accuracy', 'kv.mat': 'material', 'kv.zone': 'paint zone', 'kv.qty': 'quantity',
    'cu.isolate': 'Isolate', 'cu.unisolate': 'Exit isolate', 'cu.showAll': 'Show all', 'cu.deselect': 'Deselect',
    'spec.aria': 'Selected model', 'spec.model': 'Model', 'spec.height': 'Height', 'spec.parts': 'Parts',
    'step.1': 'Assembled', 'step.1h': 'Scroll down to disassemble', 'step.2': 'Separating', 'step.2h': '{n} parts', 'step.3': 'Exploded', 'step.3h': 'Click a part for details',
    'cu.loading': 'Loading 3D model…', 'cu.loadingV': 'Loading {name}…', 'cu.loadErr': 'Could not load the model — <a href="rocket3d/viewer.html" style="text-decoration:underline">open the 3D Viewer</a>',
    'cu.webgl': 'This browser cannot show 3D — <a href="rocket3d/viewer.html" style="text-decoration:underline">try the 3D Viewer</a>',
    'cu.noManifest': 'Not in parts_manifest.json', 'cu.unknown': 'unknown', 'cu.swatch': 'Color {c}',
    'var.CLEAN': 'Clean', 'var.FLIGHT_PROVEN': 'Flight proven', 'var.SV_AS506': 'AS-506', 'var.SV_AS501': 'AS-501',
    'varL.CLEAN': 'Like new', 'varL.FLIGHT_PROVEN': 'Reused booster with soot from the base', 'varL.SV_AS506': 'AS-506 (Apollo 11): final black-and-white pattern',
    'varL.SV_AS501': 'AS-501 (Apollo 4): long black stripes on the S-IC',
    'acc.documented': 'Shape and dimensions from a cited source', 'acc.standard-based': 'Built to a published engineering standard (ISO etc.)',
    'acc.representative': 'The part exists on the real vehicle, but the geometry is a plausible estimate',
    'accn.documented': 'documented', 'accn.standard-based': 'standard-based', 'accn.representative': 'representative',
    // rockets
    'rk.kicker': 'Collection', 'rk.h': 'ROCKETS', 'rk.lead': 'Pick a rocket to open it in 3D — take it apart piece by piece, recolor it and check how accurate each part is.',
    'rk.f9': 'Two-stage, 69.9 m tall, 9 Merlin 1D engines and four landing legs, with new and flight-proven variants.',
    'rk.fh': 'Centre core plus two side boosters, sharing parts with Falcon 9. Pull the boosters apart sideways.',
    'rk.sv': '110.6 m tall with 5 F-1 and 6 J-2 engines, split into S-IC, S-II, S-IVB, IU, SLA, CSM and LES modules.',
    'rk.view': 'View in 3D →', 'rk.viewAria': 'View {name} in 3D',
    // features
    'ft.kicker': 'What you can do', 'ft.h': 'TAKE IT<br>APART.', 'ft.lead': 'Every rocket is built from CAD models split into real parts, not a still image — rotate, separate, swap and repaint it in the browser.',
    'ft.btn': 'Open full viewer', 'ft.1h': 'Disassemble', 'ft.1p': 'Separate the whole rocket or a single module, in assembly order, and put it back exactly where it was.',
    'ft.2h': 'Recolor', 'ft.2p': 'Paint each part, a whole paint zone or every instance. Saved on your device, with JSON export and import.',
    'ft.3h': 'Swap parts', 'ft.3p': 'Swap grid fins, fairings and payloads with a size check, and browse modules from every rocket in the Part Gallery.',
    // accuracy
    'ac.h': 'HOW ACCURATE?', 'ac.lead': 'Some dimensions are approximate — every part states its accuracy level.',
    // contact
    'ct.kicker': 'Get in touch', 'ct.h': 'TALK TO US', 'ct.lead': 'Interested in the 3D models or want another rocket added? Send us a message.',
    'ct.addr': 'Address', 'ct.phone': 'Phone', 'ct.mail': 'E-mail', 'ct.name': 'Your name', 'ct.tel': 'Your phone', 'ct.email': 'Your e-mail', 'ct.msg': 'Message',
    'ct.send': 'Send message', 'ct.err': 'Please enter your name and a valid e-mail.', 'ct.ok': 'Thank you — message received.',
    'ft.nav': 'Footer links', 'ft.viewer': '3D Viewer', 'ft.note': '3D models built from CAD · sizes partly approximate',
    // viewer page
    'v.title': '3D Rocket Viewer', 'v.home': 'Back to home', 'v.back': '← Home', 'v.modes': 'Mode', 'v.tab.viewer': 'Whole rocket', 'v.tab.gallery': 'Part Gallery',
    'v.controls': 'Controls', 'v.explode': 'Disassemble', 'v.level': 'Level (0–1)', 'v.explodeBtn': 'Disassemble', 'v.assemble': 'Assemble',
    'v.stagger': 'Stagger by assembly order', 'v.scope': 'Scope', 'v.scopeAria': 'Disassembly scope', 'v.scope.all': 'Whole rocket / whole model',
    'v.scope.sel': 'Follow selection (enclosing assembly)', 'v.partsList': 'Parts', 'v.modules': 'Modules', 'v.fromAll': 'from every rocket',
    'v.canvas': '3D rocket model. Drag to rotate, scroll to zoom, click to select a part', 'v.loading': 'Loading…', 'v.showAll': 'Show all', 'v.resetView': 'Reset view',
    'v.approx': "Some dimensions are approximate — see each part's accuracy level", 'v.selected': 'Selected part',
    'v.selectHint': 'Click a part on the model or pick one from the list.', 'v.hide': 'Hide', 'v.show': 'Show', 'v.clear': 'Deselect',
    'v.perParent': '{n} per {p}', 'v.paint': 'Color', 'v.pick': 'Choose a color', 'v.sc.legend': 'Scope', 'v.sc.mesh': 'This piece', 'v.sc.zone': 'Whole paint_zone',
    'v.sc.part': 'All instances of this part', 'v.notex': 'Disable pattern texture on this part (color × pattern)', 'v.export': 'Export JSON', 'v.import': 'Import JSON',
    'v.slot': 'Swap part (slot)', 'v.option': 'Option', 'v.slotAria': 'Slot option', 'v.apply': 'Use this option', 'v.gallery': 'Part Gallery',
    'v.place': 'Place into the open rocket', 'v.group.fh': 'Falcon 9 / Heavy', 'v.group.slot': 'Swap parts (slot)', 'v.group.sv': 'Saturn V',
    // viewer messages
    'm.loadV': 'Loading {name} …', 'm.loadVErr': 'Could not load {name}: {err}', 'm.loadM': 'Loading module {name} …', 'm.loadMErr': 'Could not load the module: {err}',
    'm.loadPart': 'Loading the part…', 'm.noWebgl': 'This browser does not support WebGL', 'm.initErr': 'Startup failed: {err}',
    'm.paint.pick': 'Select a part first to recolor it',
    'm.paint.no': 'This part cannot be recolored — material {m} is not MAT_PAINT_ (only painted surfaces can change color)',
    'm.badFile': 'Not a rocket3d color file', 'm.imported': 'Colors imported', 'm.importErr': 'Import failed: {err}',
    'm.variantKept': 'Switched to {v} — {n} saved color(s) kept (parts with a soot pattern show color × pattern; turn the pattern off in the "Color" panel)',
    'm.swapOk': 'Part swapped', 'm.swapErr': 'Swap failed: {err}', 'm.noName': 'Not in parts_manifest.json', 'm.unknown': 'unknown', 'm.swatch': 'Color {c}',
    'm.engCluster': 'Merlin 1D engine ×9 (cluster)',
    'm.pick': 'Pick a module from the list',
    'm.place.slot': 'This module is an option for {slot} — it can replace the part in {veh}.',
    'm.place.mod': '{note}Replace {id} in {veh} (size is checked against the original, ±15%).',
    'm.place.multi': 'The open rocket has "{id}" in {n} places (instances) — replacing several places is not supported',
    'm.place.none': 'No matching position for "{id}" in the open {veh}',
    'm.place.view': '{note}{why} — view only (rotate / separate / recolor still work)',
    'm.place.confirm': '{w}\nContinue? (cannot be undone — reload the rocket to restore)', 'm.place.done': 'Module placed — switch to the "Whole rocket" tab to see it',
    'm.place.err': 'Could not place it: {err}',
    // slots
    's.size': 'Size differs from the original by {p}% (over 15%) — position/size may not fit the socket',
    's.noSlot': 'Slot not found in the manifest', 's.sv': 'This slot switches the Saturn V material pattern — use the Variant menu (SV_AS506 / SV_AS501).',
    's.none': 'Not installed', 's.empty': 'The open rocket has no part for this slot in its GLB file',
    's.single': 'This slot has a single option ({ids}) in the supplied files, so it cannot be swapped — ask the pipeline owner for more options',
    's.nofile': 'There is no separate GLB for {ids}, so it cannot be swapped', 's.nopart': 'Part {id} not found in {file}.glb', 's.notarget': 'No matching position in the open rocket',
    's.slotNote': '{slot}: {reason} ', 's.sub': 'slot: {slot}',
    'a.perParent': '{n} per {p}',
  },
  th: {
    'nav.home': 'หน้าแรก', 'nav.customize': 'ปรับแต่ง', 'nav.rockets': 'จรวด', 'nav.features': 'ฟีเจอร์', 'nav.contact': 'ติดต่อ',
    'nav.viewer': 'เปิด Viewer', 'nav.menu': 'เมนู', 'nav.main': 'เมนูหลัก', 'lang.label': 'ภาษา', 'nav.home.aria': 'Rocket — หน้าแรก',
    'intro.eyebrow': 'จรวดแบบ 3 มิติ', 'intro.sub': 'สำรวจ ถอดแยก และเปลี่ยนสีจรวด', 'intro.go': 'เริ่มสำรวจ',
    'intro.scroll': 'เลื่อนลง', 'stat.parts': 'ชิ้นส่วนทั้งหมด', 'stat.rockets': 'จรวด', 'stat.modules': 'โมดูล 3D', 'stat.docs': 'ชิ้นที่มีแหล่งอ้างอิง',
    'stat.aria': 'ตัวเลขสำคัญ',
    'cu.aria': 'ปรับแต่งจรวด 3D', 'cu.canvas': 'โมเดลจรวด 3 มิติ ลากเพื่อหมุน คลิกชิ้นส่วนเพื่อเลือก',
    'cu.kicker': 'ปรับแต่ง', 'cu.rocket': 'จรวด', 'cu.rocket.aria': 'เลือกจรวด', 'cu.variant': 'รุ่น / สภาพ', 'cu.explode': 'ถอดแยกชิ้นส่วน',
    'cu.explode.btn': 'ถอดแยก / ประกอบกลับ', 'cu.explode.slider': 'ระดับการถอดแยก', 'cu.color': 'สี',
    'cu.paint.none': 'เลือกชิ้นส่วนก่อน', 'cu.paint.no': '{name}: เปลี่ยนสีไม่ได้', 'cu.paint.why': 'วัสดุ {m} ไม่ใช่ MAT_PAINT_',
    'cu.swatches': 'สีสำเร็จรูป', 'cu.custom': 'เลือกสีเอง', 'cu.resetPart': 'รีเซ็ตชิ้นนี้', 'cu.resetAll': 'รีเซ็ตทั้งหมด',
    'cu.parts': 'ชิ้นส่วน', 'cu.search': 'ค้นหาชิ้นส่วน / part id', 'cu.selected': 'ชิ้นส่วนที่เลือก', 'cu.selectHint': 'คลิกชิ้นส่วนบนโมเดลหรือเลือกจากรายการ',
    'kv.id': 'part id', 'kv.acc': 'accuracy', 'kv.mat': 'วัสดุ', 'kv.zone': 'paint zone', 'kv.qty': 'จำนวน',
    'cu.isolate': 'แยกดูชิ้นนี้', 'cu.unisolate': 'ยกเลิกการแยกดู', 'cu.showAll': 'แสดงทุกชิ้น', 'cu.deselect': 'ยกเลิกเลือก',
    'spec.aria': 'โมเดลที่เลือก', 'spec.model': 'รุ่น', 'spec.height': 'ความสูง', 'spec.parts': 'ชิ้นส่วน',
    'step.1': 'ประกอบแล้ว', 'step.1h': 'เลื่อนลงหรือปัดเพื่อถอดแยก', 'step.2': 'กำลังแยก', 'step.2h': '{n} ชิ้น', 'step.3': 'แยกครบทุกชิ้น', 'step.3h': 'คลิกชิ้นส่วนเพื่อดูรายละเอียด',
    'cu.loading': 'กำลังโหลดโมเดล 3D…', 'cu.loadingV': 'กำลังโหลด {name}…', 'cu.loadErr': 'โหลดโมเดลไม่สำเร็จ — <a href="rocket3d/viewer.html" style="text-decoration:underline">เปิด 3D Viewer</a>',
    'cu.webgl': 'เบราว์เซอร์นี้แสดง 3D ไม่ได้ — <a href="rocket3d/viewer.html" style="text-decoration:underline">ลองเปิด 3D Viewer</a>',
    'cu.noManifest': 'ไม่มีข้อมูลใน parts_manifest.json', 'cu.unknown': 'ไม่ทราบ', 'cu.swatch': 'สี {c}',
    'var.CLEAN': 'สภาพใหม่', 'var.FLIGHT_PROVEN': 'ใช้ซ้ำแล้ว', 'var.SV_AS506': 'AS-506', 'var.SV_AS501': 'AS-501',
    'varL.CLEAN': 'ใหม่เอี่ยม ไม่มีรอยเขม่า', 'varL.FLIGHT_PROVEN': 'บูสเตอร์ใช้ซ้ำ มีเขม่าไล่จากฐาน', 'varL.SV_AS506': 'AS-506 (Apollo 11): ลายดำ-ขาวสุดท้าย',
    'varL.SV_AS501': 'AS-501 (Apollo 4): แถบดำ S-IC ยาว + ลายดำ-ขาว',
    'acc.documented': 'รูปทรงและขนาดจากแหล่งอ้างอิงที่ระบุได้', 'acc.standard-based': 'สร้างตามมาตรฐานวิศวกรรม เช่น ISO',
    'acc.representative': 'ชิ้นส่วนมีอยู่จริง แต่รูปทรงเป็นค่าประมาณที่สมเหตุสมผล',
    'accn.documented': 'มีแหล่งอ้างอิง', 'accn.standard-based': 'ตามมาตรฐาน', 'accn.representative': 'ค่าประมาณ',
    'rk.kicker': 'คอลเลกชัน', 'rk.h': 'จรวด', 'rk.lead': 'เลือกจรวดเพื่อเปิดดูแบบ 3 มิติ — ถอดแยกทีละชิ้น เปลี่ยนสี และดูระดับความแม่นยำของแต่ละชิ้นส่วน',
    'rk.f9': 'จรวด 2 สเตจ สูง 69.9 m เครื่อง Merlin 1D ×9 ขาลงจอด 4 ขา พร้อม variant สภาพใหม่ / บูสเตอร์ใช้ซ้ำ',
    'rk.fh': 'แกนกลาง + บูสเตอร์ข้าง 2 ท่อน ใช้ชิ้นส่วนร่วมกับ Falcon 9 ถอดบูสเตอร์ออกด้านข้างได้',
    'rk.sv': 'สูง 110.6 m เครื่อง F-1 ×5 และ J-2 ×6 แยกเป็นโมดูล S-IC, S-II, S-IVB, IU, SLA, CSM, LES',
    'rk.view': 'ดูแบบ 3D →', 'rk.viewAria': 'ดู {name} แบบ 3D',
    'ft.kicker': 'ทำอะไรได้บ้าง', 'ft.h': 'ถอดดู<br>ทีละชิ้น', 'ft.lead': 'ทุกลำสร้างจากโมเดล CAD แยกเป็นชิ้นส่วนจริง ไม่ใช่ภาพนิ่ง — หมุน ถอด สลับ และทาสีใหม่ได้ในเบราว์เซอร์',
    'ft.btn': 'เปิด Viewer เต็มจอ', 'ft.1h': 'ถอดแยก', 'ft.1p': 'ถอดแยกทั้งลำหรือเฉพาะโมดูล ตามลำดับการประกอบ แล้วประกอบกลับที่เดิมพอดี',
    'ft.2h': 'เปลี่ยนสี', 'ft.2p': 'เลือกสีให้แต่ละชิ้น ทั้ง paint zone หรือทุก instance บันทึกในเครื่อง และ Export / Import ได้',
    'ft.3h': 'สลับชิ้นส่วน', 'ft.3p': 'สลับกริดฟิน แฟริ่ง และ payload เทียบขนาดกับชิ้นเดิม และดูโมดูลจากทุกลำใน Part Gallery',
    'ac.h': 'แม่นยำแค่ไหน?', 'ac.lead': 'ขนาดบางส่วนเป็นค่าประมาณ — ทุกชิ้นส่วนระบุระดับความแม่นยำไว้เสมอ',
    'ct.kicker': 'ติดต่อ', 'ct.h': 'ติดต่อเรา', 'ct.lead': 'สนใจโมเดล 3D หรืออยากให้เพิ่มจรวดลำอื่น ส่งข้อความมาได้เลย',
    'ct.addr': 'ที่อยู่', 'ct.phone': 'โทรศัพท์', 'ct.mail': 'อีเมล', 'ct.name': 'ชื่อของคุณ', 'ct.tel': 'เบอร์โทร', 'ct.email': 'อีเมลของคุณ', 'ct.msg': 'ข้อความ',
    'ct.send': 'ส่งข้อความ', 'ct.err': 'กรุณากรอกชื่อและอีเมลให้ถูกต้อง', 'ct.ok': 'ขอบคุณ ได้รับข้อความแล้ว',
    'ft.nav': 'ลิงก์ท้ายหน้า', 'ft.viewer': '3D Viewer', 'ft.note': 'โมเดล 3D สร้างจาก CAD · ขนาดบางส่วนเป็นค่าประมาณ',
    'v.title': '3D Rocket Viewer', 'v.home': 'กลับหน้าหลัก', 'v.back': '← หน้าหลัก', 'v.modes': 'โหมด', 'v.tab.viewer': 'จรวดทั้งลำ', 'v.tab.gallery': 'Part Gallery',
    'v.controls': 'ตัวควบคุม', 'v.explode': 'ถอดแยกชิ้นส่วน', 'v.level': 'ระดับ (0–1)', 'v.explodeBtn': 'ถอดแยก', 'v.assemble': 'ประกอบกลับ',
    'v.stagger': 'ทยอยถอดตามลำดับ (stagger)', 'v.scope': 'ขอบเขต', 'v.scopeAria': 'ขอบเขตการถอด', 'v.scope.all': 'ทั้งลำ / ทั้งโมเดล',
    'v.scope.sel': 'ตามชิ้นที่เลือก (assembly ที่ครอบ)', 'v.partsList': 'รายการชิ้นส่วน', 'v.modules': 'โมดูล', 'v.fromAll': 'จากทุกลำ',
    'v.canvas': 'โมเดลจรวด 3 มิติ ลากเพื่อหมุน ล้อเมาส์เพื่อซูม คลิกเพื่อเลือกชิ้นส่วน', 'v.loading': 'กำลังโหลด…', 'v.showAll': 'แสดงทุกชิ้น', 'v.resetView': 'Reset view',
    'v.approx': 'ขนาดบางส่วนเป็นค่าประมาณ ดูระดับ accuracy ของแต่ละชิ้น', 'v.selected': 'ชิ้นส่วนที่เลือก',
    'v.selectHint': 'คลิกที่ชิ้นส่วนในโมเดลหรือเลือกจากรายการ', 'v.hide': 'ซ่อน', 'v.show': 'แสดง', 'v.clear': 'ยกเลิกเลือก',
    'v.perParent': '{n} ต่อ {p}', 'v.paint': 'เปลี่ยนสี', 'v.pick': 'เลือกสี', 'v.sc.legend': 'ขอบเขต', 'v.sc.mesh': 'ชิ้นนี้', 'v.sc.zone': 'ทั้ง paint_zone',
    'v.sc.part': 'ทุก instance ของ part', 'v.notex': 'ปิดลาย texture ของชิ้นนี้ (สี×ลาย)', 'v.export': 'Export JSON', 'v.import': 'Import JSON',
    'v.slot': 'สลับชิ้นส่วน (slot)', 'v.option': 'ตัวเลือก', 'v.slotAria': 'ตัวเลือกของ slot', 'v.apply': 'ใช้ตัวเลือกนี้', 'v.gallery': 'Part Gallery',
    'v.place': 'วางแทนในลำที่เปิดอยู่', 'v.group.fh': 'Falcon 9 / Heavy', 'v.group.slot': 'ชิ้นสลับ (slot)', 'v.group.sv': 'Saturn V',
    'm.loadV': 'กำลังโหลด {name} …', 'm.loadVErr': 'โหลด {name} ไม่สำเร็จ: {err}', 'm.loadM': 'กำลังโหลดโมดูล {name} …', 'm.loadMErr': 'โหลดโมดูลไม่สำเร็จ: {err}',
    'm.loadPart': 'กำลังโหลดชิ้นส่วน…', 'm.noWebgl': 'เบราว์เซอร์นี้ไม่รองรับ WebGL', 'm.initErr': 'เริ่มต้นไม่สำเร็จ: {err}',
    'm.paint.pick': 'เลือกชิ้นส่วนก่อนเพื่อเปลี่ยนสี',
    'm.paint.no': 'ชิ้นนี้เปลี่ยนสีไม่ได้ — วัสดุ {m} ไม่ใช่ MAT_PAINT_ (เปลี่ยนได้เฉพาะผิวที่เป็นสี)',
    'm.badFile': 'ไม่ใช่ไฟล์สีของ rocket3d', 'm.imported': 'นำเข้าสีเรียบร้อย', 'm.importErr': 'Import ไม่สำเร็จ: {err}',
    'm.variantKept': 'สลับเป็น {v} — สีที่ตั้งไว้ {n} รายการยังคงอยู่ (ชิ้นที่มีลายเขม่าจะแสดงเป็นสี × ลาย ปิดลายได้ที่แผง "เปลี่ยนสี")',
    'm.swapOk': 'สลับชิ้นส่วนเรียบร้อย', 'm.swapErr': 'สลับไม่สำเร็จ: {err}', 'm.noName': 'ไม่มีข้อมูลใน parts_manifest.json', 'm.unknown': 'ไม่ทราบ', 'm.swatch': 'สี {c}',
    'm.engCluster': 'เครื่องยนต์ Merlin 1D ×9 (กลุ่ม)',
    'm.pick': 'เลือกโมดูลจากรายการ',
    'm.place.slot': 'โมดูลนี้เป็นตัวเลือกของ {slot} — วางแทนใน {veh} ได้',
    'm.place.mod': '{note}วางแทน {id} ใน {veh} (ตรวจขนาดเทียบตำแหน่งเดิม ±15%)',
    'm.place.multi': 'ลำที่เปิดอยู่มี "{id}" {n} ตำแหน่ง (instance) — ยังไม่รองรับการวางแทนหลายตำแหน่ง',
    'm.place.none': 'ไม่มีตำแหน่ง "{id}" ที่เข้ากันใน {veh} ที่เปิดอยู่',
    'm.place.view': '{note}{why} — ดูอย่างเดียว (หมุน/ถอด/เปลี่ยนสีได้)',
    'm.place.confirm': '{w}\nวางต่อไปหรือไม่? (ยกเลิกไม่ได้ ต้องโหลดลำใหม่)', 'm.place.done': 'วางโมดูลในลำที่เปิดอยู่แล้ว — กลับไปแท็บ "จรวดทั้งลำ" เพื่อดู',
    'm.place.err': 'วางไม่สำเร็จ: {err}',
    's.size': 'ขนาดต่างจากชิ้นเดิม {p}% (เกิน 15%) — ตำแหน่ง/ขนาดอาจไม่พอดีกับ socket',
    's.noSlot': 'ไม่พบ slot นี้ใน manifest', 's.sv': 'slot นี้เป็นการสลับวัสดุ/ลายของ Saturn V — ใช้เมนู Variant (SV_AS506 / SV_AS501)',
    's.none': 'ไม่ติดตั้ง', 's.empty': 'ลำที่เปิดอยู่ไม่มีชิ้นส่วนใน slot นี้ในไฟล์ GLB',
    's.single': 'slot นี้มีตัวเลือกเดียว ({ids}) ในไฟล์ที่ให้มา จึงสลับไม่ได้ — แจ้งเจ้าของไปป์ไลน์หากต้องการตัวเลือกเพิ่ม',
    's.nofile': 'ไม่มีไฟล์ GLB แยกสำหรับ {ids} จึงสลับไม่ได้', 's.nopart': 'ไม่พบชิ้น {id} ในไฟล์ {file}.glb', 's.notarget': 'ไม่มีตำแหน่งที่เข้ากันในลำที่เปิดอยู่',
    's.slotNote': '{slot}: {reason} ', 's.sub': 'slot: {slot}',
    'a.perParent': '{n} ต่อ {p}',
  },
};

let lang = 'en';
try { const s = localStorage.getItem(KEY); if (s === 'th' || s === 'en') lang = s; } catch { /* storage unavailable */ }
const listeners = new Set();

export const getLang = () => lang;
export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
// localized part name from a manifest entry
export const partName = (p, fallback) => (lang === 'th' ? p?.name_th : p?.name_en) ?? p?.name_en ?? fallback;
export const partNameAlt = p => (lang === 'th' ? p?.name_en : p?.name_th);
export const zoneLabel = (manifest, z) => (lang === 'th' ? manifest.paintZones[z]?.label_th : null) ?? '';

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(',')) { const [a, k] = pair.split(':'); el.setAttribute(a.trim(), t(k.trim(), el.dataset.name ? { name: el.dataset.name } : undefined)); }
  });
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.querySelectorAll('[data-l]').forEach(s => s.classList.toggle('on', s.dataset.l === lang));
    b.setAttribute('aria-label', t('lang.label') + ': ' + (lang === 'en' ? 'English' : 'ไทย'));
  });
}
export function setLang(l) {
  if (l === lang || !DICT[l]) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
  applyDom();
  listeners.forEach(cb => cb(l));
}
export const onLang = cb => listeners.add(cb);

// wire every language toggle button on the page
export function initLangButtons() {
  document.querySelectorAll('[data-lang-btn]').forEach(b => b.addEventListener('click', () => setLang(lang === 'en' ? 'th' : 'en')));
  applyDom();
}

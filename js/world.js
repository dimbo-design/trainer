import * as THREE from '../vendor/three.module.min.js';

// ---------- палитра «дневной зал»: спокойная взрослая сила ----------
export const C = {
  wallLight: 0xb9ad9a,   // тёплый светлый бетон
  wallLower: 0x8e846f,   // панель по низу стен
  floor: 0x4a4c42,       // резина, серо-оливковая
  platform: 0xa8845c,    // дерево помоста
  woodLight: 0xb08d63,
  green: 0x3d5c48,       // глубокий зелёный — покраска рам
  brass: 0xc2934d,       // латунь — акцент
  coal: 0x2c2a26,        // железо
  chrome: 0x9fa4a6,
  paper: 0xece4d4,
  glass: 0x39413c,
  plant: 0x41573c,
  ceiling: 0xcfc5b2,
};

export const ROOM = { hw: 11, hd: 7.5, h: 4.5 }; // полукомнаты по x/z, высота

const mat = {
  wall: new THREE.MeshStandardMaterial({ color: C.wallLight, roughness: 1 }),
  wallLower: new THREE.MeshStandardMaterial({ color: C.wallLower, roughness: 1 }),
  floor: new THREE.MeshStandardMaterial({ color: C.floor, roughness: 0.92 }),
  wood: new THREE.MeshStandardMaterial({ color: C.platform, roughness: 0.85 }),
  woodLight: new THREE.MeshStandardMaterial({ color: C.woodLight, roughness: 0.85 }),
  green: new THREE.MeshStandardMaterial({ color: C.green, roughness: 0.6, metalness: 0.3 }),
  brass: new THREE.MeshStandardMaterial({ color: C.brass, roughness: 0.45, metalness: 0.7 }),
  coal: new THREE.MeshStandardMaterial({ color: C.coal, roughness: 0.55, metalness: 0.5 }),
  chrome: new THREE.MeshStandardMaterial({ color: C.chrome, roughness: 0.3, metalness: 0.85 }),
  paper: new THREE.MeshStandardMaterial({ color: C.paper, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: C.glass, roughness: 0.15, metalness: 0.4 }),
  plant: new THREE.MeshStandardMaterial({ color: C.plant, roughness: 0.95 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x36382f, roughness: 1 }),
};

const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const box = (w, h, d, material) => shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
const cyl = (r, h, material, seg = 20) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material));

// Коллайдеры — AABB на полу: {x, z, hw, hd}
export const colliders = [];
const collide = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DISPLAY_FONT = '"Oswald", "Arial Narrow", sans-serif';

// ---------- строим мир; возвращаем ключевые объекты ----------
export function buildWorld(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // свет: дневной, из больших окон слева
  const hemi = new THREE.HemisphereLight(0xfff3dd, 0x6b6152, 1.55);
  scene.add(hemi);
  // тёплый контровой — мягкость по краям объёмов
  const rim = new THREE.DirectionalLight(0xffd0a0, 0.6);
  rim.position.set(5, 3.5, -7);
  scene.add(rim);
  const sun = new THREE.DirectionalLight(0xffe9c8, 3.2);
  sun.position.set(-9, 5.5, 2.5);
  sun.target.position.set(4, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0005;
  sun.shadow.intensity = 0.75;
  scene.add(sun, sun.target);

  // ---------- оболочка ----------
  const floor = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(ROOM.hw * 2, ROOM.hd * 2), mat.floor));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.hw * 2, ROOM.hd * 2),
    new THREE.MeshStandardMaterial({ color: C.ceiling, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h;
  room.add(ceil);

  const wallX = new THREE.PlaneGeometry(ROOM.hw * 2, ROOM.h);
  const wallZ = new THREE.PlaneGeometry(ROOM.hd * 2, ROOM.h);
  const walls = [
    [wallX, [0, ROOM.h / 2, -ROOM.hd], [0, 0, 0]],
    [wallX, [0, ROOM.h / 2, ROOM.hd], [0, Math.PI, 0]],
    [wallZ, [-ROOM.hw, ROOM.h / 2, 0], [0, Math.PI / 2, 0]],
    [wallZ, [ROOM.hw, ROOM.h / 2, 0], [0, -Math.PI / 2, 0]],
  ];
  for (const [g, p, r] of walls) {
    const w = new THREE.Mesh(g, mat.wall);
    w.position.set(...p); w.rotation.set(...r); w.receiveShadow = true;
    room.add(w);
    // нижняя панель стен — тёмная полоса, «взрослый» интерьерный приём
    const lower = new THREE.Mesh(
      g === wallX ? new THREE.PlaneGeometry(ROOM.hw * 2, 1.1) : new THREE.PlaneGeometry(ROOM.hd * 2, 1.1),
      mat.wallLower);
    lower.position.set(p[0] * 0.998, 0.55, p[2] * 0.998);
    lower.rotation.set(...r);
    room.add(lower);
  }

  // ---------- окна на левой стене + свет-пятна ----------
  for (let i = 0; i < 3; i++) {
    const z = -4.6 + i * 4.6;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ color: 0xfff0d2 }));
    win.position.set(-ROOM.hw + 0.08, 2.7, z);
    win.rotation.y = Math.PI / 2;
    room.add(win);
    // рама: горизонтали + вертикальная перемычка
    for (const [w, h, y, zo] of [[0.1, 0.1, 3.75, 0], [0.1, 0.1, 1.65, 0]]) {
      const rail = box(w, h, 3.6, mat.coal);
      rail.position.set(-ROOM.hw + 0.1, y, z + zo);
      room.add(rail);
    }
    const mullion = box(0.1, 2.1, 0.08, mat.coal);
    mullion.position.set(-ROOM.hw + 0.1, 2.7, z);
    room.add(mullion);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.rotation.z = 0.1;
    pool.position.set(-ROOM.hw + 3.1, 0.02, z);
    room.add(pool);
  }

  // ---------- постеры (окружающий сторителлинг) ----------
  const poster = (text, sub, x, z, ry, wallColor = '#efe7d7') => {
    const t = canvasTexture(384, 512, (g) => {
      g.fillStyle = wallColor; g.fillRect(0, 0, 384, 512);
      g.strokeStyle = '#2c2a26'; g.lineWidth = 10; g.strokeRect(14, 14, 356, 484);
      g.fillStyle = '#2c2a26';
      g.font = `600 64px ${DISPLAY_FONT}`;
      g.textAlign = 'center';
      const lines = text.split('\n');
      lines.forEach((l, i) => g.fillText(l, 192, 210 + i * 72));
      g.fillStyle = '#c2934d';
      g.font = `500 28px ${DISPLAY_FONT}`;
      g.fillText(sub, 192, 440);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.55),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    p.position.set(x, 2.35, z); p.rotation.y = ry;
    room.add(p);
  };
  poster('СИЛА\nЛЮБИТ\nТИШИНУ', 'зал работает с 7:00', -4.6, -ROOM.hd + 0.02, 0);
  poster('ТЕХНИКА\nСТАРШЕ\nЭГО', 'снимай вес — ставь движение', ROOM.hw - 0.02, -3.6, -Math.PI / 2);
  poster('МЫШЦЫ\nНЕ ВРУТ', 'остальное — переговоры', -6.2, ROOM.hd - 0.02, Math.PI);

  // плакаты качков — двойной бицепс силуэтом, старошкольная брутальность
  const musclePoster = (title, sub, x, z, ry) => {
    const t = canvasTexture(384, 512, (g) => {
      g.fillStyle = '#e8dfcc'; g.fillRect(0, 0, 384, 512);
      g.strokeStyle = '#26231d'; g.lineWidth = 12; g.strokeRect(12, 12, 360, 488);
      const ink = '#26231d';
      const cx = 192, cy = 260;
      g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round';
      // голова + трапеции
      g.beginPath(); g.arc(cx, cy - 128, 24, 0, Math.PI * 2); g.fill();
      // V-торс
      g.beginPath();
      g.moveTo(cx - 66, cy - 96); g.lineTo(cx + 66, cy - 96);
      g.lineTo(cx + 34, cy + 24); g.lineTo(cx - 34, cy + 24);
      g.closePath(); g.fill();
      for (const s of [-1, 1]) {
        // плечо → локоть (в сторону), предплечье вверх, бицепс шаром
        g.lineWidth = 30;
        g.beginPath(); g.moveTo(cx + s * 60, cy - 88); g.lineTo(cx + s * 112, cy - 96); g.stroke();
        g.beginPath(); g.moveTo(cx + s * 112, cy - 96); g.lineTo(cx + s * 96, cy - 152); g.stroke();
        g.beginPath(); g.arc(cx + s * 88, cy - 102, 24, 0, Math.PI * 2); g.fill(); // бицепс
        g.beginPath(); g.arc(cx + s * 98, cy - 150, 15, 0, Math.PI * 2); g.fill(); // кулак
        // ноги с икрами
        g.lineWidth = 32;
        g.beginPath(); g.moveTo(cx + s * 22, cy + 16); g.lineTo(cx + s * 30, cy + 138); g.stroke();
        g.beginPath(); g.arc(cx + s * 30, cy + 92, 20, 0, Math.PI * 2); g.fill();
      }
      g.font = `600 44px ${DISPLAY_FONT}`;
      g.textAlign = 'center';
      g.fillText(title, 192, 456);
      g.fillStyle = '#b95c2a';
      g.font = `500 24px ${DISPLAY_FONT}`;
      g.fillText(sub, 192, 60);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.0),
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }));
    p.position.set(x, 2.3, z);
    p.rotation.y = ry;
    room.add(p);
  };
  musclePoster('СТАРАЯ ШКОЛА', 'с 1978', ROOM.hw - 0.02, 0.4, -Math.PI / 2);
  musclePoster('ДЕНЬ НОГ — СВЯТОЕ', 'без исключений', 3.4, ROOM.hd - 0.02, Math.PI);

  // ---------- часы ----------
  const clock = new THREE.Group();
  const face = cyl(0.32, 0.05, mat.paper, 32);
  face.rotation.x = Math.PI / 2;
  const hourH = box(0.03, 0.16, 0.02, mat.coal); hourH.position.set(0, 0.07, 0.035);
  const minH = box(0.02, 0.24, 0.02, mat.coal); minH.position.set(0.08, 0.06, 0.035); minH.rotation.z = -1.2;
  clock.add(face, hourH, minH);
  clock.position.set(0, 3.5, -ROOM.hd + 0.06);
  room.add(clock);

  // ---------- помост + силовая стойка (станция: присед) ----------
  const rackG = new THREE.Group();
  const plat = box(3.4, 0.09, 2.8, mat.wood); plat.position.y = 0.045; rackG.add(plat);
  const platEdge = box(3.5, 0.02, 2.9, mat.brass); platEdge.position.y = 0.005; rackG.add(platEdge);
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.1], [0.9, 0.1]]) {
    const post = box(0.12, 2.6, 0.12, mat.green); post.position.set(x, 1.38, z); rackG.add(post);
  }
  for (const z of [-0.9, 0.1]) {
    const cross = box(1.9, 0.1, 0.1, mat.green); cross.position.set(0, 2.66, z); rackG.add(cross);
  }
  // штанга на крюках (переносится персонажу при приседе)
  const rackBar = new THREE.Group();
  const barShaft = cyl(0.028, 2.6, mat.chrome); barShaft.rotation.z = Math.PI / 2; rackBar.add(barShaft);
  for (const s of [-1, 1]) {
    const p1 = cyl(0.23, 0.05, mat.coal, 28); p1.rotation.z = Math.PI / 2; p1.position.x = s * 1.02; rackBar.add(p1);
    const p2 = cyl(0.17, 0.045, mat.green, 28); p2.rotation.z = Math.PI / 2; p2.position.x = s * 1.09; rackBar.add(p2);
  }
  rackBar.position.set(0, 1.62, -0.9);
  rackG.add(rackBar);
  rackG.position.set(-7, 0, -4.4);
  room.add(rackG);
  collide(-7, -5.3, 1.15, 0.35);
  const rackBarHome = { parent: rackG, pos: rackBar.position.clone() };

  // стойка с блинами рядом
  const plateTree = new THREE.Group();
  const pole = cyl(0.04, 1.1, mat.coal); pole.position.y = 0.55; plateTree.add(pole);
  for (let i = 0; i < 4; i++) {
    const pl = cyl(0.2 - i * 0.03, 0.05, i % 2 ? mat.green : mat.coal, 24);
    pl.position.y = 0.08 + i * 0.1;
    plateTree.add(pl);
  }
  plateTree.position.set(-9.3, 0, -3.4);
  room.add(plateTree);
  collide(-9.3, -3.4, 0.35, 0.35);

  // ---------- жим лёжа (станция) — гриф над головным концом скамьи ----------
  const benchG = new THREE.Group();
  const pad = box(0.4, 0.1, 1.35, mat.rubber); pad.position.set(0, 0.5, 0.1); benchG.add(pad);
  for (const z of [-0.4, 0.6]) { const leg = box(0.32, 0.48, 0.09, mat.green); leg.position.set(0, 0.24, z); benchG.add(leg); }
  for (const s of [-1, 1]) {
    const up = box(0.1, 1.32, 0.1, mat.green); up.position.set(s * 0.55, 0.66, -0.75); benchG.add(up);
  }
  const benchBar = new THREE.Group();
  const bShaft = cyl(0.025, 1.9, mat.chrome); bShaft.rotation.z = Math.PI / 2; benchBar.add(bShaft);
  for (const s of [-1, 1]) {
    const pl = cyl(0.17, 0.05, mat.coal, 26); pl.rotation.z = Math.PI / 2; pl.position.x = s * 0.8; benchBar.add(pl);
  }
  benchBar.position.set(0, 1.34, -0.75);
  benchG.add(benchBar);
  benchG.position.set(-2.6, 0, -5.0);
  room.add(benchG);
  collide(-2.6, -5.2, 0.75, 1.0);
  const benchBarHome = { pos: benchBar.position.clone() };

  // ---------- гантельный ряд + тёмное стекло (станция: свободные веса) ----------
  const dbG = new THREE.Group();
  for (const [y, zOff] of [[0.55, 0.1], [0.98, -0.08]]) {
    const shelf = box(3.2, 0.07, 0.5, mat.green); shelf.position.set(0, y, zOff); dbG.add(shelf);
  }
  for (const sx of [-1.55, 1.55]) {
    const side = box(0.08, 1.05, 0.6, mat.coal); side.position.set(sx, 0.52, 0); dbG.add(side);
  }
  for (let i = 0; i < 6; i++) {
    for (const [y, zOff] of [[0.66, 0.1], [1.09, -0.08]]) {
      const r = 0.055 + (i % 3) * 0.012;
      const h = cyl(0.02, 0.24, mat.chrome); h.rotation.x = Math.PI / 2; h.position.set(-1.3 + i * 0.52, y, zOff);
      const a = cyl(r, 0.1, mat.coal, 14); a.rotation.x = Math.PI / 2; a.position.set(-1.3 + i * 0.52, y, zOff - 0.1);
      const b = cyl(r, 0.1, mat.coal, 14); b.rotation.x = Math.PI / 2; b.position.set(-1.3 + i * 0.52, y, zOff + 0.1);
      dbG.add(h, a, b);
    }
  }
  dbG.position.set(3.6, 0, -6.9);
  room.add(dbG);
  collide(3.6, -6.9, 1.7, 0.5);
  // тёмное стекло за гантелями (образ зеркала без envmap)
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), mat.glass);
  mirror.position.set(3.6, 1.7, -ROOM.hd + 0.03);
  room.add(mirror);
  const mirrorFrame = box(4.4, 0.08, 0.06, mat.brass);
  mirrorFrame.position.set(3.6, 2.94, -ROOM.hd + 0.05);
  room.add(mirrorFrame);

  // ---------- доска форматов (станция) ----------
  const boardT = canvasTexture(512, 384, (g) => {
    g.fillStyle = '#232b24'; g.fillRect(0, 0, 512, 384);
    g.fillStyle = 'rgba(236,228,212,0.92)';
    g.font = `600 42px ${DISPLAY_FONT}`;
    g.fillText('ФОРМАТЫ', 44, 70);
    g.fillRect(44, 86, 160, 3);
    g.font = `500 30px ${DISPLAY_FONT}`;
    g.fillStyle = 'rgba(236,228,212,0.8)';
    g.fillText('разовая', 44, 150);
    g.fillText('месяц ведения', 44, 205);
    g.fillText('онлайн', 44, 260);
    g.fillStyle = '#c2934d';
    g.fillText('···', 400, 150); g.fillText('···', 400, 205); g.fillText('···', 400, 260);
    g.font = `500 24px ${DISPLAY_FONT}`;
    g.fillStyle = 'rgba(236,228,212,0.5)';
    g.fillText('подойди — расскажу', 44, 330);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.65),
    new THREE.MeshStandardMaterial({ map: boardT, roughness: 0.95 }));
  board.position.set(-5.6, 2.1, ROOM.hd - 0.08); // на передней стене, между ресепшн и баром
  board.rotation.y = Math.PI;
  room.add(board);
  const boardFrame = box(2.35, 1.8, 0.05, mat.woodLight);
  boardFrame.position.set(-5.6, 2.1, ROOM.hd - 0.03);
  room.add(boardFrame);

  // ---------- боксёрский мешок (станция, интерактив: удар) ----------
  const bagG = new THREE.Group();          // якорь на потолке
  const bagSwing = new THREE.Group();      // качается
  const chain = cyl(0.02, 2.2, mat.chrome); chain.position.y = -1.1; bagSwing.add(chain);
  const bagBody = cyl(0.24, 1.15, mat.green, 24); bagBody.position.y = -2.78; bagSwing.add(bagBody);
  const bagCapT = cyl(0.25, 0.1, mat.brass, 24); bagCapT.position.y = -2.23; bagSwing.add(bagCapT);
  const bagCapB = cyl(0.25, 0.1, mat.brass, 24); bagCapB.position.y = -3.33; bagSwing.add(bagCapB);
  bagG.add(bagSwing);
  bagG.position.set(7.6, ROOM.h - 0.6, -1.2);
  room.add(bagG);
  collide(7.6, -1.2, 0.45, 0.45);

  // ---------- кардио: две дорожки (станция) ----------
  const treadmill = (x, z, ry) => {
    const t = new THREE.Group();
    const deck = box(0.8, 0.16, 1.9, mat.coal); deck.position.y = 0.12; t.add(deck);
    const belt = box(0.6, 0.02, 1.6, mat.rubber); belt.position.y = 0.21; t.add(belt);
    const mast = box(0.08, 1.2, 0.08, mat.green);
    const mast2 = mast.clone();
    mast.position.set(-0.33, 0.7, -0.8); mast2.position.set(0.33, 0.7, -0.8);
    t.add(mast, mast2);
    const console_ = box(0.7, 0.3, 0.12, mat.coal); console_.position.set(0, 1.32, -0.82); console_.rotation.x = -0.35; t.add(console_);
    t.position.set(x, 0, z); t.rotation.y = ry;
    room.add(t);
    collide(x, z, 0.55, 1.05);
  };
  treadmill(9.6, 2.2, -Math.PI / 2);
  treadmill(9.6, 3.6, -Math.PI / 2);

  // ---------- бар (станция: питание) — у входа, рядом с ресепшн ----------
  const barG = new THREE.Group();
  const barFront = box(3.2, 1.0, 0.55, mat.wood); barFront.position.y = 0.5; barG.add(barFront);
  const barTop = box(3.4, 0.07, 0.8, mat.coal); barTop.position.y = 1.06; barG.add(barTop);
  const barRail = cyl(0.022, 3.3, mat.brass); barRail.rotation.z = Math.PI / 2;
  barRail.position.set(0, 0.32, 0.4); barG.add(barRail); // подножка
  const blender = cyl(0.09, 0.34, mat.chrome); blender.position.set(-1.1, 1.27, 0); barG.add(blender);
  for (let i = 0; i < 3; i++) { // шейкеры на стойке
    const sh = cyl(0.055, 0.2, i === 1 ? mat.brass : mat.paper, 12);
    sh.position.set(0.4 + i * 0.35, 1.2, 0.08 - (i % 2) * 0.16);
    barG.add(sh);
  }
  barG.position.set(-0.5, 0, 6.7);
  room.add(barG);
  collide(-0.5, 6.7, 1.75, 0.5);

  // холодильник справа от стойки
  const fridge = box(0.85, 1.95, 0.8, mat.green); fridge.position.set(2.5, 0.975, 6.9);
  const fridgeHandle = box(0.04, 0.5, 0.05, mat.brass); fridgeHandle.position.set(2.08, 1.2, 6.55);
  room.add(fridge, fridgeHandle);
  collide(2.5, 6.9, 0.5, 0.45);

  // задний бар на стене: полки с бутылками + вывеска
  for (const y of [1.95, 2.45]) {
    const shelfB = box(2.8, 0.06, 0.28, mat.woodLight);
    shelfB.position.set(-0.5, y, ROOM.hd - 0.16);
    room.add(shelfB);
    for (let i = 0; i < 6; i++) {
      const bh = 0.16 + ((i * 7 + y * 13) % 3) * 0.07;
      const bottle = cyl(0.045, bh, [mat.paper, mat.green, mat.brass][(i + (y > 2 ? 1 : 0)) % 3], 10);
      bottle.position.set(-1.7 + i * 0.48, y + 0.03 + bh / 2, ROOM.hd - 0.16);
      room.add(bottle);
    }
  }
  const barSignT = canvasTexture(512, 192, (g) => {
    g.fillStyle = '#232b24'; g.fillRect(0, 0, 512, 192);
    g.fillStyle = '#ece4d4';
    g.font = `600 84px ${DISPLAY_FONT}`;
    g.textAlign = 'center';
    g.fillText('БАР', 256, 92);
    g.fillStyle = '#c2934d';
    g.font = `500 30px ${DISPLAY_FONT}`;
    g.fillText('смузи · протеин · кофе', 256, 150);
  });
  const barSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.7),
    new THREE.MeshStandardMaterial({ map: barSignT, roughness: 0.9 }));
  barSign.position.set(-0.5, 3.15, ROOM.hd - 0.05);
  barSign.rotation.y = Math.PI;
  room.add(barSign);

  // барные стулья
  for (const sx of [-1.6, -0.5, 0.6]) {
    const stool = new THREE.Group();
    const leg = cyl(0.035, 0.66, mat.coal, 12); leg.position.y = 0.33; stool.add(leg);
    const base = cyl(0.16, 0.03, mat.coal, 14); base.position.y = 0.02; stool.add(base);
    const seat = cyl(0.19, 0.08, mat.woodLight, 16); seat.position.y = 0.7; stool.add(seat);
    stool.position.set(sx, 0, 5.85);
    room.add(stool);
    collide(sx, 5.85, 0.22, 0.22);
  }

  // ---------- ресепшн (станция: записаться) — угловая L-стойка у входа ----------
  const rG = new THREE.Group();
  const deskMain = box(2.3, 1.05, 0.6, mat.woodLight); deskMain.position.set(0, 0.52, 0); rG.add(deskMain);
  const deskTopM = box(2.45, 0.06, 0.78, mat.coal); deskTopM.position.set(0, 1.08, 0); rG.add(deskTopM);
  const deskRet = box(0.6, 1.05, 1.6, mat.woodLight); deskRet.position.set(-1.45, 0.52, 1.0); rG.add(deskRet);
  const deskTopR = box(0.78, 0.06, 1.75, mat.coal); deskTopR.position.set(-1.45, 1.08, 1.0); rG.add(deskTopR);
  // латунная полоса по фасаду — фирменная деталь
  const trimM = box(2.3, 0.06, 0.02, mat.brass); trimM.position.set(0, 0.8, -0.31); rG.add(trimM);
  const trimR = box(0.02, 0.06, 1.6, mat.brass); trimR.position.set(-1.76, 0.8, 1.0); rG.add(trimR);
  const notebook = box(0.42, 0.03, 0.3, mat.paper); notebook.position.set(0.3, 1.14, 0.05); notebook.rotation.y = -0.25; rG.add(notebook);
  const bellBase = cyl(0.05, 0.02, mat.coal, 14); bellBase.position.set(-0.5, 1.12, 0.05); rG.add(bellBase);
  const bell = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.brass));
  bell.position.set(-0.5, 1.13, 0.05); rG.add(bell);
  const lampArm = cyl(0.015, 0.5, mat.brass); lampArm.rotation.z = 0.5; lampArm.position.set(0.85, 1.35, 0); rG.add(lampArm);
  const lampHead = cyl(0.08, 0.12, mat.green, 16); lampHead.position.set(1.0, 1.55, 0); lampHead.rotation.z = 0.9; rG.add(lampHead);
  rG.position.set(-8.2, 0, 5.9); // в левом углу входной стены
  room.add(rG);
  collide(-8.2, 5.9, 1.3, 0.42);
  collide(-9.65, 6.9, 0.45, 0.95);

  // ---------- полка славы (станция: о тренере) — витрина с кубками ----------
  const trG = new THREE.Group();
  const trBase = box(2.0, 0.9, 0.5, mat.wood); trBase.position.y = 0.45; trG.add(trBase);
  const trTop = box(2.1, 0.05, 0.55, mat.coal); trTop.position.y = 0.92; trG.add(trTop);
  const trBack = box(2.0, 1.7, 0.06, mat.green); trBack.position.set(0, 1.8, -0.22); trG.add(trBack);
  for (const y of [1.35, 1.95]) {
    const sh = box(1.9, 0.05, 0.34, mat.woodLight); sh.position.set(0, y, -0.05); trG.add(sh);
  }
  const cup = (x, y, s = 1) => {
    const g = new THREE.Group();
    const base = cyl(0.05 * s, 0.03, mat.coal, 12); base.position.y = 0.015; g.add(base);
    const stem = cyl(0.018 * s, 0.09, mat.brass, 10); stem.position.y = 0.075; g.add(stem);
    const bowl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.032 * s, 0.11 * s, 14), mat.brass));
    bowl.position.y = 0.17 * s; g.add(bowl);
    g.position.set(x, y, -0.05);
    trG.add(g);
  };
  cup(-0.7, 1.38, 1.15); cup(0, 1.38, 1.35); cup(0.7, 1.38, 1.0);
  cup(-0.55, 1.98, 0.9); cup(0.25, 1.98, 1.0);
  // медали на лентах
  for (let i = 0; i < 3; i++) {
    const ribbon = box(0.05, 0.22, 0.02, i === 1 ? mat.green : mat.rubber);
    ribbon.position.set(0.55 + i * 0.25, 2.5, -0.17);
    const medal = cyl(0.06, 0.02, mat.brass, 16);
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0.55 + i * 0.25, 2.36, -0.16);
    trG.add(ribbon, medal);
  }
  // фото в рамке (плейсхолдер под реальное фото тренера)
  const photoFrame = box(0.5, 0.64, 0.03, mat.woodLight); photoFrame.position.set(-0.55, 2.05, -0.18); trG.add(photoFrame);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.54), mat.paper);
  photo.position.set(-0.55, 2.05, -0.16); trG.add(photo);
  trG.position.set(4.6, 0, 7.2); // в ряду входной стены, правее бара
  trG.rotation.y = Math.PI;
  room.add(trG);
  collide(4.6, 7.2, 1.1, 0.4);

  // ---------- декор: растения, шведская стенка, гири, скамейка ----------
  const plantAt = (x, z) => {
    const g = new THREE.Group();
    const pot = cyl(0.22, 0.4, mat.paper, 16); pot.position.y = 0.2; g.add(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7 + (i % 3) * 0.25, 8), mat.plant));
      leaf.position.set(Math.sin(i * 2.2) * 0.12, 0.7 + (i % 3) * 0.12, Math.cos(i * 2.2) * 0.12);
      leaf.rotation.set(Math.sin(i) * 0.25, 0, Math.cos(i * 1.3) * 0.25);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    room.add(g);
    collide(x, z, 0.3, 0.3);
  };
  plantAt(10.2, -6.6);
  plantAt(-10.2, 6.7);
  plantAt(10.3, 6.8);

  // шведская стенка
  const ladder = new THREE.Group();
  for (const s of [-0.45, 0.45]) { const r = box(0.07, 2.6, 0.07, mat.woodLight); r.position.set(s, 1.4, 0); ladder.add(r); }
  for (let i = 0; i < 8; i++) { const r = cyl(0.025, 0.9, mat.woodLight, 12); r.rotation.z = Math.PI / 2; r.position.y = 0.35 + i * 0.3; ladder.add(r); }
  ladder.position.set(-ROOM.hw + 0.15, 0, 2.2); ladder.rotation.y = Math.PI / 2;
  room.add(ladder);

  // гири у помоста
  for (let i = 0; i < 3; i++) {
    const kb = new THREE.Group();
    const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.14 + i * 0.02, 16, 12), i === 1 ? mat.brass : mat.coal));
    body.position.y = 0.15;
    const handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 16, Math.PI), mat.coal));
    handle.position.y = 0.3;
    kb.add(body, handle);
    kb.position.set(-5.2 + i * 0.5, 0, -2.6);
    room.add(kb);
  }
  collide(-4.7, -2.6, 0.8, 0.3);

  // фитнес-коврик у кардио-зоны (станция: растяжка); плоский — без коллайдера
  const yoga = box(0.7, 0.025, 1.9, new THREE.MeshStandardMaterial({ color: 0x46604e, roughness: 1 }));
  yoga.position.set(3.8, 0.013, 1.4);
  yoga.rotation.y = 0.35;
  room.add(yoga);

  // скамейка для отдыха у окна
  const restBench = new THREE.Group();
  const seatB = box(1.6, 0.08, 0.4, mat.woodLight); seatB.position.y = 0.42; restBench.add(seatB);
  for (const s of [-0.65, 0.65]) { const l = box(0.08, 0.4, 0.36, mat.coal); l.position.set(s, 0.2, 0); restBench.add(l); }
  restBench.position.set(-9.9, 0, -0.6); restBench.rotation.y = Math.PI / 2;
  room.add(restBench);
  collide(-9.9, -0.6, 0.45, 0.85);

  // разметка зон на полу — тонкие латунные линии
  const zoneLine = (x, z, w, d) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: C.brass, transparent: true, opacity: 0.28 }));
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.012, z);
    room.add(l);
  };
  // рамка кардио-зоны
  zoneLine(9.0, 2.9, 0.05, 3.6); zoneLine(8.0, 2.9, 0.05, 3.6);
  zoneLine(8.5, 1.1, 1.05, 0.05); zoneLine(8.5, 4.7, 1.05, 0.05);
  // дорожка к ресепшн от входа
  zoneLine(-4.5, 6.4, 4.4, 0.05);

  return { room, rackG, rackBar, rackBarHome, bagSwing, benchG, benchBar, benchBarHome, hemi, sun };
}

import * as THREE from '../vendor/three.module.min.js';

// Низкополигональный качок. Силуэт утрирован (плечи/грудь/предплечья),
// но рендер честный — никакой аниме-стилизации.

const M = {
  skin: new THREE.MeshStandardMaterial({ color: 0xd7a380, roughness: 0.85 }),
  tank: new THREE.MeshStandardMaterial({ color: 0x3d5c48, roughness: 0.9 }),
  shorts: new THREE.MeshStandardMaterial({ color: 0x33312c, roughness: 0.9 }),
  shoe: new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.8 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.95 }),
};

const HIP = 0.98;

function bx(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

export function createCharacter() {
  const root = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = HIP;
  root.add(hips);

  const pelvis = bx(0.34, 0.24, 0.23, M.shorts);
  pelvis.position.y = 0.0;
  hips.add(pelvis);

  // ноги: бедро (пивот в тазу) → голень (пивот в колене) → стопа
  const legs = {};
  for (const s of ['L', 'R']) {
    const side = s === 'L' ? -1 : 1;
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.12, -0.08, 0);
    const thighMesh = bx(0.18, 0.42, 0.21, M.shorts);
    thighMesh.position.y = -0.19;
    thigh.add(thighMesh);

    const shin = new THREE.Group();
    shin.position.y = -0.4;
    const shinMesh = bx(0.14, 0.4, 0.16, M.skin);
    shinMesh.position.y = -0.19;
    const foot = new THREE.Group(); // пивот в голеностопе — стопа умеет стоять плоско
    foot.position.y = -0.4;
    const footMesh = bx(0.14, 0.09, 0.3, M.shoe);
    footMesh.position.set(0, -0.02, 0.06);
    foot.add(footMesh);
    shin.add(shinMesh, foot);
    thigh.add(shin);

    hips.add(thigh);
    legs[s] = { thigh, shin, foot };
  }

  // торс: пивот над тазом, V-образный
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  hips.add(torso);
  const lower = bx(0.36, 0.3, 0.24, M.tank); lower.position.y = 0.14; torso.add(lower);
  const chest = bx(0.56, 0.36, 0.3, M.tank); chest.position.y = 0.44; torso.add(chest);
  for (const side of [-1, 1]) {
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M.skin);
    delt.castShadow = true;
    delt.position.set(side * 0.35, 0.56, 0);
    torso.add(delt);
  }

  // руки: плечо (пивот) → локоть (пивот) → предплечье (чуть массивнее плеча) → кулак
  const arms = {};
  for (const s of ['L', 'R']) {
    const side = s === 'L' ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.56, 0);
    const upper = bx(0.15, 0.34, 0.16, M.skin);
    upper.position.y = -0.17;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.35;
    const forearm = bx(0.17, 0.3, 0.17, M.skin);
    forearm.position.y = -0.13;
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), M.skin);
    fist.castShadow = true;
    fist.position.y = -0.32;
    elbow.add(forearm, fist);
    shoulder.add(elbow);

    torso.add(shoulder);
    arms[s] = { shoulder, elbow };
  }

  // шея + голова
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), M.skin);
  neck.position.y = 0.68; torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.78;
  const skull = bx(0.24, 0.28, 0.26, M.skin); skull.position.y = 0.12; head.add(skull);
  const hair = bx(0.25, 0.09, 0.27, M.hair); hair.position.set(0, 0.29, -0.01); head.add(hair);
  const brim = bx(0.23, 0.035, 0.12, M.hair); brim.position.set(0, 0.27, 0.18); head.add(brim); // козырёк = перёд
  torso.add(head);
  const badge = bx(0.09, 0.09, 0.02, new THREE.MeshStandardMaterial({ color: 0xc2934d, roughness: 0.5, metalness: 0.6 }));
  badge.position.set(-0.14, 0.5, 0.155);
  torso.add(badge);

  // точка крепления штанги при приседе (за головой, на трапециях)
  const barMount = new THREE.Group();
  barMount.position.set(0, 0.62, -0.12);
  torso.add(barMount);

  // точка крепления грифа при жиме (над грудью; z анимируется позой)
  const chestMount = new THREE.Group();
  chestMount.position.set(0, 0.44, 0.6);
  torso.add(chestMount);

  // гантели в кулаках (появляются на упражнении)
  const dbProps = [];
  for (const s of ['L', 'R']) {
    const g = new THREE.Group();
    g.position.y = -0.32;
    const handle = bx(0.2, 0.035, 0.035, M.hair);
    const headA = bx(0.06, 0.11, 0.11, M.hair); headA.position.x = -0.12;
    const headB = bx(0.06, 0.11, 0.11, M.hair); headB.position.x = 0.12;
    g.add(handle, headA, headB);
    g.visible = false;
    arms[s].elbow.add(g);
    dbProps.push(g);
  }

  // сброс позы перед применением новой
  function reset() {
    for (const s of ['L', 'R']) {
      legs[s].thigh.rotation.set(0, 0, 0);
      legs[s].shin.rotation.set(0, 0, 0);
      legs[s].foot.rotation.set(0, 0, 0);
      arms[s].shoulder.rotation.set(0, 0, 0);
      arms[s].elbow.rotation.set(0, 0, 0);
    }
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    hips.position.set(0, HIP, 0);
  }

  const api = {
    root, barMount, chestMount, HIP,

    setDumbbells(on) { dbProps.forEach((g) => { g.visible = on; }); },

    idle(t) {
      reset();
      torso.rotation.x = 0.03 + Math.sin(t * 1.5) * 0.015; // дыхание
      hips.position.x = Math.sin(t * 0.45) * 0.012;        // перенос веса
      head.rotation.y = Math.sin(t * 0.3) * 0.12;
      for (const s of ['L', 'R']) {
        const side = s === 'L' ? -1 : 1;
        arms[s].shoulder.rotation.z = side * 0.16;         // руки не висят — широчайшие мешают
        arms[s].elbow.rotation.x = -0.3;
      }
    },

    walk(phase, t) {
      reset();
      const A = 0.6;
      for (const s of ['L', 'R']) {
        const side = s === 'L' ? -1 : 1;
        const p = phase + (s === 'L' ? 0 : Math.PI);
        legs[s].thigh.rotation.x = Math.sin(p) * A;
        legs[s].shin.rotation.x = Math.max(0, -Math.sin(p - 0.5)) * 0.85;
        arms[s].shoulder.rotation.x = Math.sin(p + Math.PI) * 0.42;
        arms[s].shoulder.rotation.z = side * 0.18;
        arms[s].elbow.rotation.x = -0.55;
      }
      hips.position.y = HIP + Math.abs(Math.sin(phase)) * 0.035;
      torso.rotation.x = 0.06;
      torso.rotation.y = Math.sin(phase) * 0.07;
    },

    // s — фаза цикла приседа [0..1]; глубина по косинусу, низ в s=0.5.
    // Ноги — двухзвенная кинематика: голеностоп остаётся на месте, стопы плоско на полу.
    squat(s) {
      reset();
      const d = (1 - Math.cos(s * Math.PI * 2)) / 2;
      const L1 = 0.4, L2 = 0.4;          // бедро, голень (пивот-пивот)
      const drop = d * 0.38;
      hips.position.y = HIP - drop;
      const hipPivot = HIP - drop - 0.08; // таз → пивот бедра
      const D = Math.max(0.3, Math.min(L1 + L2 - 0.005, hipPivot - 0.065));
      const t1 = -Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D));       // бедро: колено вперёд
      const t2 = Math.PI - Math.acos((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2)); // сгиб колена
      for (const side of ['L', 'R']) {
        legs[side].thigh.rotation.x = t1;
        legs[side].shin.rotation.x = t2;
        legs[side].foot.rotation.x = -(t1 + t2); // стопа компенсирует — стоит плоско
        arms[side].shoulder.rotation.x = -2.3;
        arms[side].shoulder.rotation.z = (side === 'L' ? -1 : 1) * 0.55;
        arms[side].elbow.rotation.x = -0.5;
      }
      torso.rotation.x = 0.1 + d * 0.28;
      head.rotation.x = -d * 0.2; // взгляд вперёд, не в пол
      return d;
    },

    // s — фаза цикла жима [0..1]; персонаж лежит (root повёрнут снаружи).
    // Руки ведутся к грифу двухзвенной кинематикой — кисти ходят вместе со штангой.
    benchPress(s) {
      reset();
      const lower = (1 - Math.cos(s * Math.PI * 2)) / 2; // 0 — руки прямые, 1 — гриф у груди
      // ноги: бёдра вдоль скамьи, голени вниз за её краем, стопы на пол
      for (const side of ['L', 'R']) {
        legs[side].thigh.rotation.x = 0.35;
        legs[side].shin.rotation.x = 1.1;
        legs[side].foot.rotation.x = -0.85;
      }
      const zBar = 0.66 - lower * 0.26;
      chestMount.position.set(0, 0.44, zBar);
      const L1 = 0.35, L2 = 0.32;
      const dy = 0.12; // плечо чуть выше линии грифа
      const d = Math.max(0.2, Math.min(L1 + L2 - 0.01, Math.hypot(dy, zBar)));
      const phi = Math.atan2(zBar, dy);
      const a1 = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      const a2 = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
      for (const side of ['L', 'R']) {
        arms[side].shoulder.rotation.x = -(phi - a1);
        arms[side].shoulder.rotation.z = (side === 'L' ? -1 : 1) * 0.12;
        arms[side].elbow.rotation.x = -(Math.PI - a2);
      }
      return lower;
    },

    // s — фаза цикла сгибаний [0..1]; руки работают попеременно
    curls(s) {
      reset();
      const a = Math.sin(s * Math.PI * 2);
      arms.L.shoulder.rotation.x = -0.12;
      arms.R.shoulder.rotation.x = -0.12;
      arms.L.elbow.rotation.x = -0.9 - Math.max(0, a) * 1.35;
      arms.R.elbow.rotation.x = -0.9 - Math.max(0, -a) * 1.35;
      arms.L.shoulder.rotation.z = -0.14;
      arms.R.shoulder.rotation.z = 0.14;
      torso.rotation.x = 0.05 + Math.abs(a) * 0.03;
      return a;
    },

    // бег на месте — как походка, но выше и резче, руки согнуты
    run(phase) {
      reset();
      const A = 0.85;
      for (const s of ['L', 'R']) {
        const p = phase + (s === 'L' ? 0 : Math.PI);
        legs[s].thigh.rotation.x = Math.sin(p) * A;
        legs[s].shin.rotation.x = Math.max(0, -Math.sin(p - 0.6)) * 1.3;
        arms[s].shoulder.rotation.x = Math.sin(p + Math.PI) * 0.6;
        arms[s].shoulder.rotation.z = (s === 'L' ? -1 : 1) * 0.16;
        arms[s].elbow.rotation.x = -1.25;
      }
      hips.position.y = HIP + Math.abs(Math.sin(phase)) * 0.06;
      torso.rotation.x = 0.14;
      return phase;
    },

    // сидит на лавке, дышит; руки на бёдрах
    sit(t) {
      reset();
      hips.position.y = 0.52;
      for (const side of ['L', 'R']) {
        legs[side].thigh.rotation.x = -1.5;
        legs[side].shin.rotation.x = 1.5;
        arms[side].shoulder.rotation.x = -0.6;
        arms[side].shoulder.rotation.z = (side === 'L' ? -1 : 1) * 0.1;
        arms[side].elbow.rotation.x = -0.85;
      }
      torso.rotation.x = 0.08 + Math.sin(t * 1.4) * 0.015;
      head.rotation.y = Math.sin(t * 0.35) * 0.2; // смотрит по залу
    },

    // p — фаза удара [0..1]: до 0.35 — выброс, дальше — возврат; arm — какой рукой
    punch(p, arm = 'R') {
      reset();
      const guard = arm === 'R' ? 'L' : 'R';
      const mirror = arm === 'R' ? 1 : -1;
      const ext = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
      const e = Math.sin(ext * Math.PI / 2);
      arms[arm].shoulder.rotation.x = -1.45 * e;
      arms[arm].shoulder.rotation.z = mirror * 0.15;
      arms[arm].elbow.rotation.x = -1.7 * (1 - e) - 0.1;
      arms[guard].shoulder.rotation.x = -0.95;
      arms[guard].shoulder.rotation.z = -mirror * 0.35;
      arms[guard].elbow.rotation.x = -1.9;
      torso.rotation.y = -mirror * 0.45 * e;
      hips.position.y = HIP - 0.04 * e;
      const stance = 0.35;
      legs[guard].thigh.rotation.x = -stance * 0.6;
      legs[arm].thigh.rotation.x = stance * 0.5;
      legs[arm].shin.rotation.x = stance * 0.5;
      return e;
    },
  };

  return api;
}

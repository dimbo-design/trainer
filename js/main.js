import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { createCharacter } from './character.js';
import { createControls } from './controls.js';
import { createUI } from './ui.js';

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
} catch (e) {
  document.body.classList.add('flat');
}

if (renderer) boot();

async function boot() {
  // шрифт нужен canvas-текстурам мира (доски, постеры) до постройки сцены
  try {
    await Promise.all([
      document.fonts.load('700 40px Oswald'),
      document.fonts.load('500 30px Oswald'),
    ]);
  } catch (e) { /* работаем на fallback-шрифте */ }
  init();
}

function init() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfc5b2);
  scene.fog = new THREE.Fog(0xc9bfab, 18, 44);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 80);
  const setFov = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 0.9 ? 70 : 58;
    camera.updateProjectionMatrix();
  };
  setFov();
  addEventListener('resize', () => { setFov(); renderer.setSize(innerWidth, innerHeight); });

  const world = buildWorld(scene);

  const char = createCharacter();
  char.root.position.set(0, 0, 4.4);
  char.root.rotation.y = Math.PI; // лицом в зал
  scene.add(char.root);

  const controls = createControls(renderer.domElement, char, camera);

  // ---------- станции ----------
  const stations = [
    { id: 'rack', x: -7, z: -3.2, r: 1.8, verb: 'присесть со штангой' },
    { id: 'bench', x: -2.6, z: -3.9, r: 1.7, verb: 'жать лёжа' },
    { id: 'dumbbells', x: 3.6, z: -6.0, r: 1.7, verb: 'взять гантели' },
    { id: 'bag', x: 7.6, z: -1.2, r: 1.7, verb: 'ударить' },
    { id: 'cardio', x: 8.6, z: 2.9, r: 1.8, verb: 'на дорожку' },
    { id: 'rest', x: -9.15, z: -0.6, r: 1.5, verb: 'присесть' },
    { id: 'trophies', x: 4.6, z: 6.0, r: 1.7, verb: 'посмотреть' },
    { id: 'kitchen', x: -0.5, z: 5.4, r: 1.9, verb: 'изучить' },
    { id: 'board', x: -5.6, z: 6.2, r: 1.6, verb: 'посмотреть' },
    { id: 'reception', x: -8.0, z: 4.8, r: 1.8, verb: 'записаться' },
  ];
  const ui = createUI(stations.map((s) => s.id));

  // debug: ?at=<id> — заспавниться рядом со станцией
  const at = new URLSearchParams(location.search).get('at');
  const atSt = at && stations.find((s) => s.id === at);
  if (atSt) {
    const len = Math.hypot(atSt.x, atSt.z) || 1;
    char.root.position.set(atSt.x - (atSt.x / len) * 1.2, 0, atSt.z - (atSt.z / len) * 1.2);
    char.root.rotation.y = Math.atan2(atSt.x - char.root.position.x, atSt.z - char.root.position.z);
  }

  // ---------- фокус: луч на станцию + притемнение ----------
  const spot = new THREE.SpotLight(0xffe2b0, 0, 22, 0.55, 0.55, 1.2);
  spot.position.set(0, 4.3, 0);
  scene.add(spot, spot.target);
  let envK = 0;

  // ---------- состояние ----------
  let mode = 'free'; // free | panel | exercise
  let exercise = null; // { type, t }
  let saved = null; // позиция/поворот до упражнения
  let activeSt = null;
  let panelTimer = null;
  let punchT = -1;
  let punchApplied = false;
  let punchArm = 'R';
  let eHeld = false;
  let bagHits = 0;
  const bagVel = { x: 0, z: 0 };
  let near = null;

  const EXERCISES = { rack: 'squat', bench: 'bench', dumbbells: 'curls', cardio: 'run', rest: 'sit' };

  function beginExercise(st) {
    saved = { pos: char.root.position.clone(), rot: char.root.rotation.y };
    mode = 'exercise';
    exercise = { type: EXERCISES[st.id], t: 0 };
    const r = char.root;
    r.rotation.order = 'YXZ';
    if (exercise.type === 'squat') {
      r.position.set(-7, 0, -4.0);
      r.rotation.set(0, 0, 0); // спиной к стойке, лицом в зал
      char.barMount.add(world.rackBar);
      world.rackBar.position.set(0, 0, 0);
      world.rackBar.rotation.set(0, 0, 0);
    } else if (exercise.type === 'bench') {
      r.position.set(-2.6, 0.7, -3.6);
      r.rotation.set(-Math.PI / 2, 0, 0); // на спину, головой к стойкам, ноги за краем скамьи
      char.chestMount.add(world.benchBar);
      world.benchBar.position.set(0, 0, 0);
      world.benchBar.rotation.set(0, 0, 0);
    } else if (exercise.type === 'curls') {
      r.position.set(3.6, 0, -5.8);
      r.rotation.set(0, Math.PI, 0); // лицом к стеллажу
      char.setDumbbells(true);
    } else if (exercise.type === 'run') {
      r.position.set(9.6, 0.22, 2.2);
      r.rotation.set(0, Math.PI / 2, 0); // лицом к консоли дорожки
    } else if (exercise.type === 'sit') {
      r.position.set(-9.88, 0, -0.6);
      r.rotation.set(0, Math.PI / 2, 0); // сидит лицом в зал
    }
  }

  function endExercise() {
    if (!exercise) return;
    if (exercise.type === 'squat') {
      world.rackG.add(world.rackBar);
      world.rackBar.position.copy(world.rackBarHome.pos);
      world.rackBar.rotation.set(0, 0, 0);
    }
    if (exercise.type === 'bench') {
      world.benchG.add(world.benchBar);
      world.benchBar.position.copy(world.benchBarHome.pos);
      world.benchBar.rotation.set(0, 0, 0);
    }
    if (exercise.type === 'curls') char.setDumbbells(false);
    char.root.rotation.set(0, saved.rot, 0);
    char.root.position.copy(saved.pos);
    exercise = null;
    saved = null;
  }

  // хореография фокуса: свет ведёт, камера доворачивается, карточка входит следом
  function openStation(st) {
    activeSt = st;
    spot.position.set(st.x, 4.3, st.z + 0.8);
    spot.target.position.set(st.x, 0.7, st.z);
    controls.focusPoint = new THREE.Vector3(st.x, 1.0, st.z);
    clearTimeout(panelTimer);
    panelTimer = setTimeout(() => ui.openPanel(st.id), 280);
  }

  function closePanel() {
    clearTimeout(panelTimer);
    ui.closePanel();
    controls.focusPoint = null;
    activeSt = null;
    endExercise();
    mode = 'free';
  }

  function startPunch(st) {
    if (punchT >= 0) return;
    punchT = 0;
    punchApplied = false;
    punchArm = punchArm === 'R' ? 'L' : 'R'; // руки бьют по очереди
    bagHits++;
    // подшагнуть на дистанцию удара и развернуться к мешку
    const dx = st.x - char.root.position.x, dz = st.z - char.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.9) {
      char.root.position.x = st.x - (dx / d) * 0.85;
      char.root.position.z = st.z - (dz / d) * 0.85;
    }
    char.root.rotation.y = Math.atan2(dx, dz);
    if (bagHits === 3 && !activeSt) openStation(st); // размялся — теперь можно и поговорить
  }

  function doAction(st) {
    if (!st || mode !== 'free' || punchT >= 0) return;
    ui.hideOnboard();
    if (st.id === 'bag') { startPunch(st); return; }
    if (EXERCISES[st.id]) { beginExercise(st); openStation(st); return; }
    char.root.rotation.y = Math.atan2(st.x - char.root.position.x, st.z - char.root.position.z);
    mode = 'panel';
    openStation(st);
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') eHeld = true;
    if (e.repeat) return;
    if (e.code === 'Escape' && (ui.panelOpen || activeSt)) { closePanel(); return; }
    if (e.code !== 'KeyE') return;
    // у мешка E продолжает бить — панель живёт своей жизнью
    if (activeSt && activeSt.id === 'bag' && near && near.id === 'bag') { startPunch(near); return; }
    if (ui.panelOpen || activeSt) closePanel();
    else doAction(near);
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyE') eHeld = false; });

  ui.onAction((forceId) => {
    if (forceId === 'reception') {
      mode = 'panel';
      openStation(stations.find((s) => s.id === 'reception'));
      return;
    }
    if (near && near.id === 'bag') { startPunch(near); return; }
    if (ui.panelOpen || activeSt) closePanel();
    else doAction(near);
  });
  ui.onCloseReq(() => closePanel());

  // ---------- цикл ----------
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    const blocked = mode !== 'free' || punchT >= 0;
    controls.update(dt, t, blocked);
    if (!ui.onboardHidden && controls.everMoved) ui.hideOnboard();

    // свет «на сцену»: мягче и раньше карточки
    envK += ((activeSt ? 1 : 0) - envK) * Math.min(1, dt * 3);
    spot.intensity = envK * 120;
    world.hemi.intensity = 1.55 - envK * 0.45;
    world.sun.intensity = 3.2 - envK * 0.9;

    // зажатое действие у мешка — серия без остановки
    if (mode === 'free' && punchT < 0 && near && near.id === 'bag' && (eHeld || ui.actionHeld)) {
      startPunch(near);
    }

    // ---------- поза персонажа ----------
    if (exercise) {
      exercise.t += dt;
      const T = exercise.t;
      if (exercise.type === 'squat') char.squat((T / 2.8) % 1);
      else if (exercise.type === 'bench') char.benchPress((T / 2.4) % 1);
      else if (exercise.type === 'curls') char.curls((T / 2.1) % 1);
      else if (exercise.type === 'run') char.run(T * 7);
      else if (exercise.type === 'sit') char.sit(t);
    } else if (punchT >= 0) {
      punchT += dt;
      const p = punchT / 0.48;
      if (p >= 1) { punchT = -1; }
      else {
        char.punch(p, punchArm);
        if (!punchApplied && p > 0.28) {
          punchApplied = true;
          const fy = char.root.rotation.y;
          bagVel.z += Math.sin(fy) * 2.5;
          bagVel.x -= Math.cos(fy) * 2.5;
        }
      }
    } else if (controls.moving) {
      char.walk(controls.walkPhase, t);
    } else {
      char.idle(t);
    }

    // ---------- мешок: пружина с затуханием ----------
    const bag = world.bagSwing;
    bagVel.x += (-25 * bag.rotation.x - 2.2 * bagVel.x) * dt;
    bagVel.z += (-25 * bag.rotation.z - 2.2 * bagVel.z) * dt;
    bag.rotation.x += bagVel.x * dt;
    bag.rotation.z += bagVel.z * dt;

    // ---------- станции рядом ----------
    near = null;
    if (mode === 'free' && punchT < 0) {
      let best = Infinity;
      for (const st of stations) {
        const d = Math.hypot(st.x - char.root.position.x, st.z - char.root.position.z);
        if (d < st.r && d < best) { best = d; near = st; }
      }
    }
    // ушёл от открытой станции (мешок) — панель закрывается сама
    if (activeSt && mode === 'free' && punchT < 0) {
      const d = Math.hypot(activeSt.x - char.root.position.x, activeSt.z - char.root.position.z);
      if (d > activeSt.r + 0.7) closePanel();
    }
    if (near) ui.showPrompt(near.verb);
    else ui.hidePrompt();

    renderer.render(scene, camera);
  }
  frame();
}

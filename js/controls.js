import * as THREE from '../vendor/three.module.min.js';
import { colliders, ROOM } from './world.js';

const SPEED = 3.0;
const CAM_DIST = 4.4;
const R = 0.32; // радиус коллизии персонажа

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function resolveCollisions(p) {
  p.x = Math.max(-ROOM.hw + R + 0.05, Math.min(ROOM.hw - R - 0.05, p.x));
  p.z = Math.max(-ROOM.hd + R + 0.05, Math.min(ROOM.hd - R - 0.05, p.z));
  for (const b of colliders) {
    const cx = Math.max(b.x - b.hw, Math.min(b.x + b.hw, p.x));
    const cz = Math.max(b.z - b.hd, Math.min(b.z + b.hd, p.z));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 === 0) {
      const pushX = (b.hw + R) - Math.abs(p.x - b.x);
      const pushZ = (b.hd + R) - Math.abs(p.z - b.z);
      if (pushX < pushZ) p.x += Math.sign(p.x - b.x || 1) * pushX;
      else p.z += Math.sign(p.z - b.z || 1) * pushZ;
    } else if (d2 < R * R) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * R;
      p.z = cz + (dz / d) * R;
    }
  }
}

export function createControls(canvas, char, camera) {
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // ---------- джойстик (появляется под пальцем на левой половине) ----------
  const joyBase = document.getElementById('joy');
  const joyKnob = document.getElementById('joy-knob');
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const JOY_R = 52;

  // ---------- камера ----------
  const cam = { yaw: 0, pitch: 0.42, drag: null, lastDragT: -10 };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45) {
      if (joy.id !== null) return;
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = 0; joy.y = 0;
      joyBase.style.left = e.clientX + 'px';
      joyBase.style.top = e.clientY + 'px';
      joyBase.classList.add('on');
      canvas.setPointerCapture(e.pointerId);
    } else {
      if (cam.drag) return;
      cam.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
      joy.x = dx / JOY_R; joy.y = dy / JOY_R;
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (cam.drag && e.pointerId === cam.drag.id) {
      cam.yaw -= (e.clientX - cam.drag.x) * 0.0042;
      cam.pitch += (e.clientY - cam.drag.y) * 0.003;
      cam.pitch = Math.max(0.12, Math.min(1.0, cam.pitch));
      cam.drag.x = e.clientX; cam.drag.y = e.clientY;
      cam.lastDragT = performance.now() / 1000;
    }
  });

  const release = (e) => {
    if (e.pointerId === joy.id) {
      joy.id = null; joy.x = 0; joy.y = 0;
      joyKnob.style.transform = '';
      joyBase.classList.remove('on');
    }
    if (cam.drag && e.pointerId === cam.drag.id) cam.drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const api = {
    moving: false,
    walkPhase: 0,
    speedNorm: 0,
    everMoved: false,
    focusPoint: null, // Vector3 станции в фокусе — камера мягко доворачивается
    _f: 0,
    camYaw: () => cam.yaw,

    update(dt, t, blocked) {
      // ---------- ввод ----------
      let ix = 0, iy = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (Math.hypot(joy.x, joy.y) > 0.16) { ix = joy.x; iy = joy.y; }

      let len = Math.hypot(ix, iy);
      if (len > 1) { ix /= len; iy /= len; len = 1; }
      if (blocked) { ix = 0; iy = 0; len = 0; }

      // ---------- движение относительно камеры ----------
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      const mx = (-s) * (-iy) + c * ix;
      const mz = (-c) * (-iy) + (-s) * ix;
      const p = char.root.position;
      const dist = SPEED * len * dt;
      // в упражнении позицию задаёт сценарий (персонаж стоит НА снаряде) —
      // коллайдеры не должны его выталкивать
      if (!blocked) {
        p.x += mx * dist;
        p.z += mz * dist;
        resolveCollisions(p);
      }

      this.moving = len > 0.01;
      if (this.moving) this.everMoved = true;
      this.speedNorm = len;
      if (this.moving) {
        this.walkPhase += dist * 3.6;
        char.root.rotation.y = lerpAngle(char.root.rotation.y, Math.atan2(mx, mz), Math.min(1, dt * 10));
      }

      // ---------- камера: орбита + мягкое следование за спиной ----------
      const now = performance.now() / 1000;
      if (this.moving && now - cam.lastDragT > 1.8) {
        cam.yaw = lerpAngle(cam.yaw, char.root.rotation.y + Math.PI, Math.min(1, dt * 1.4));
      }
      // фокус: камера чуть приближается и смотрит между персонажем и станцией
      this._f += ((this.focusPoint ? 1 : 0) - this._f) * Math.min(1, dt * 2.2);
      const camDist = CAM_DIST * (1 - 0.16 * this._f);
      const hd = Math.cos(cam.pitch) * camDist;
      const cy = 1.15 + Math.sin(cam.pitch) * camDist;
      const target = new THREE.Vector3(p.x, 1.3, p.z);
      if (this.focusPoint) {
        target.lerp(this.focusPoint, this._f * 0.45);
        // объект в фокусе уводим из-под панели: влево (десктоп) или вверх (мобилка)
        if (innerWidth / innerHeight >= 0.9) {
          target.x += Math.cos(cam.yaw) * 0.85 * this._f;
          target.z += -Math.sin(cam.yaw) * 0.85 * this._f;
        } else {
          target.y -= 0.5 * this._f;
        }
      }
      camera.position.set(
        Math.max(-ROOM.hw + 0.3, Math.min(ROOM.hw - 0.3, p.x + Math.sin(cam.yaw) * hd)),
        Math.min(ROOM.h - 0.25, cy),
        Math.max(-ROOM.hd + 0.3, Math.min(ROOM.hd - 0.3, p.z + Math.cos(cam.yaw) * hd)),
      );
      camera.lookAt(target);
    },
  };
  return api;
}

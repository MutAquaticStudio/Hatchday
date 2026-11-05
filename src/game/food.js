// Thức ăn và khay thức ăn: kéo món vào thú hoặc chạm. feed() cập nhật chỉ số tại chỗ rồi gửi act('feed') lên server.
// Cần thêm món / nhóm dinh dưỡng / khẩu vị: sửa ở đây (và `items` trong SQL, `pet_action`).
import * as THREE from 'three';
import { S, act, save } from './store';
import { $, clamp } from './dom.js';
import { count, dayRec } from './diary.js';
import { sfx } from './audio.js';

export const FOODS = [
  { id: 'carot', name: 'Cà rốt', no: 10, vui: 2, line: 'Giòn giòn ngọt ngọt!', svg: '<svg viewBox="0 0 40 40"><path d="M14 13l13 3-11 19z" fill="#ff9a3c" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 14c-1-5-4-7-7-8M22 15c1-5 4-8 8-8M21 14c0-4 0-7 1-10" fill="none" stroke="#4fae5a" stroke-width="2.6" stroke-linecap="round"/></svg>' },
  { id: 'comnam', name: 'Cơm nắm', no: 25, vui: 3, line: 'No bụng ghê, cảm ơn nha!', svg: '<svg viewBox="0 0 40 40"><path d="M20 6c6 0 15 17 13 23-1 4-25 4-26 0-2-6 7-23 13-23z" fill="#fff" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><rect x="13" y="24" width="14" height="10" rx="2" fill="#2f4a3a"/></svg>' },
  { id: 'kem', name: 'Kem que', no: 5, vui: 15, line: 'Mát lạnh luôn!', svg: '<svg viewBox="0 0 40 40"><rect x="18" y="26" width="4" height="10" rx="2" fill="#e8b47a" stroke="#4a2140" stroke-width="1.8"/><path d="M12 12a8 8 0 0 1 16 0v14H12z" fill="#ff9ec4" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 18h16" stroke="#fff" stroke-width="2.4"/></svg>' },
  { id: 'che', name: 'Chè đậu', no: 15, vui: 12, line: 'Ngọt lịm tim!', svg: '<svg viewBox="0 0 40 40"><path d="M9 16h22l-3 17H12z" fill="#dff4ff" stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 20h20" stroke="#4a2140" stroke-width="1.6"/><circle cx="16" cy="25" r="2.4" fill="#a8507a"/><circle cx="22" cy="27" r="2.4" fill="#a8507a"/><circle cx="20" cy="22" r="2" fill="#7edb72"/><path d="M27 6l-4 13" stroke="#ff9ec4" stroke-width="2.6" stroke-linecap="round"/></svg>' },
];

/**
 * Gắn khay thức ăn. `c` là các hàm của cảnh: { petRoot, camera, canvas, reduce, hitPet, hideHint, say, setTemp,
 * popText, impulse, spawn, renderStats, shake }. Trả về { isDragging } để cảnh biết đang kéo món.
 */
export function initFood(c) {
  const { petRoot, camera, canvas, reduce, hitPet, hideHint, say, setTemp, popText, impulse, spawn, renderStats } = c;
  const pv = new THREE.Vector3();
  const tray = $('tray');
  tray.innerHTML = '<span class="tray-hint">Kéo món ăn vào thú, hoặc chạm</span>' + FOODS.map(f => `<button class="food" type="button" data-id="${f.id}">${f.svg}${f.name}<small>+${f.no} no</small></button>`).join('');
  let drag = null;
  tray.addEventListener('pointerdown', e => {
    const b = e.target.closest('.food'); if (!b) return;
    e.preventDefault();
    const f = FOODS.find(x => x.id === b.dataset.id);
    const g = document.createElement('div'); g.className = 'drag-ghost'; g.innerHTML = f.svg; g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
    document.body.appendChild(g);
    drag = { f, g, x0: e.clientX, y0: e.clientY, moved: false };
    b.setPointerCapture(e.pointerId);
  });
  tray.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px';
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  });
  tray.addEventListener('pointerup', e => {
    if (!drag) return;
    const { f, g, moved } = drag; drag = null;
    if (!moved || hitPetLoose(e)) flyAndFeed(f, g); else { g.remove(); }
  });
  tray.addEventListener('pointercancel', () => { if (drag) { drag.g.remove(); drag = null; } });
  function hitPetLoose(e) {
    if (hitPet(e)) return true;
    petRoot.localToWorld(pv.set(0, 1.1, 0)); pv.project(camera);
    const r = canvas.getBoundingClientRect();
    const sx = (pv.x + 1) / 2 * r.width + r.left, sy = (1 - pv.y) / 2 * r.height + r.top;
    return Math.hypot(e.clientX - sx, e.clientY - sy) < Math.min(r.width, r.height) * 0.16;
  }
  function flyAndFeed(f, g) {
    petRoot.localToWorld(pv.set(0, 0.85, 0.9)); pv.project(camera);
    const r = canvas.getBoundingClientRect();
    g.classList.add('fly');
    requestAnimationFrame(() => { g.style.left = ((pv.x + 1) / 2 * r.width + r.left) + 'px'; g.style.top = ((1 - pv.y) / 2 * r.height + r.top) + 'px'; g.style.transform = 'translate(-50%,-50%) scale(.4)'; g.style.opacity = '0.2'; });
    setTimeout(() => { g.remove(); feed(f); }, reduce ? 0 : 450);
  }
  function feed(f) {
    hideHint();
    if (S.asleep) { say('Suỵt… mình đang ngủ mà.', 2400); return; }
    if (S.no >= 90) { setTemp('sulky', 1600); c.shake(); say('Mình no căng rồi mà~', 2400); return; }
    S.no = clamp(S.no + f.no); S.vui = clamp(S.vui + f.vui); S.sach = clamp(S.sach - 2);
    popText(`+${f.no} No`, '#f08a24');
    count('fed'); dayRec().foods.push(f.name);
    setTemp('chew', 1500); impulse(-1.5); sfx('feed');
    const req = act('feed', f.id);
    setTimeout(async () => {
      const r = await req;
      if (r && r.refused === 'full') { setTemp('sulky', 1400); say('Mình no căng rồi mà~', 2400); }
      else if (r && r.fav) { setTemp('love', 1800); spawn('heart', 4, 1); spawn('sparkle', 2); say(S.favFound ? 'Món tủ của mình nè!!' : 'Ơ… đây là món tủ của mình! Sao bạn biết hay vậy?', 3400); S.favFound = true; }
      else { spawn('sparkle'); say(f.line, 2600); }
      save(); renderStats();
    }, 1500);
  }
  return { isDragging: () => !!drag };
}

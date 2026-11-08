// Thức ăn và khay thức ăn: kéo món vào thú hoặc chạm. Số liệu từng món (No, Vui, nhóm, giá) nằm ở catalog.ts (FOODS).
// Mỗi lần ăn dùng hết một phần trong kho; mua thêm ở tab "Thức ăn" của cửa hàng. feed() cập nhật chỉ số tại chỗ rồi gửi act('feed') lên server.
import { _t } from '../i18n';
import * as THREE from 'three';
import { S, act, save, onSync, refreshOwned } from './store';
import { EDIBLES, FOOD_BY_ID, FOOD_GROUPS } from './catalog';
import { BALANCED_BONUS } from './nutrition';
import { $, clamp } from './dom.js';
import { count, dayRec } from './diary.js';
import { sfx } from './audio.js';

const ST = 'stroke="#4a2140" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
/** Biểu tượng từng món (hiển thị trong khay và cửa hàng). */
export const FOOD_SVG = {
  carot: `<svg viewBox="0 0 40 40"><path d="M14 13l13 3-11 19z" fill="#ff9a3c" ${ST}/><path d="M20 14c-1-5-4-7-7-8M22 15c1-5 4-8 8-8M21 14c0-4 0-7 1-10" fill="none" stroke="#4fae5a" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  comnam: `<svg viewBox="0 0 40 40"><path d="M20 6c6 0 15 17 13 23-1 4-25 4-26 0-2-6 7-23 13-23z" fill="#fff" ${ST}/><rect x="13" y="24" width="14" height="10" rx="2" fill="#2f4a3a"/></svg>`,
  kem: `<svg viewBox="0 0 40 40"><rect x="18" y="26" width="4" height="10" rx="2" fill="#e8b47a" stroke="#4a2140" stroke-width="1.8"/><path d="M12 12a8 8 0 0 1 16 0v14H12z" fill="#ff9ec4" ${ST}/><path d="M12 18h16" stroke="#fff" stroke-width="2.4"/></svg>`,
  che: `<svg viewBox="0 0 40 40"><path d="M9 16h22l-3 17H12z" fill="#dff4ff" ${ST}/><path d="M10 20h20" stroke="#4a2140" stroke-width="1.6"/><circle cx="16" cy="25" r="2.4" fill="#a8507a"/><circle cx="22" cy="27" r="2.4" fill="#a8507a"/><circle cx="20" cy="22" r="2" fill="#7edb72"/><path d="M27 6l-4 13" stroke="#ff9ec4" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  chuoi: `<svg viewBox="0 0 40 40"><path d="M10 9c-3 13 4 25 22 27 3 0 4-3 2-4-12-2-17-10-16-21z" fill="#ffd95a" ${ST}/><path d="M10 9c1-3 4-4 5-2" fill="none" stroke="#8a6a20" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  'dua-hau': `<svg viewBox="0 0 40 40"><path d="M5 17a15 15 0 0 0 30 0z" fill="#ff6f7d" ${ST}/><path d="M7.5 22a13 13 0 0 0 25 0" fill="none" stroke="#5fbf6a" stroke-width="3.4" stroke-linecap="round"/><circle cx="14" cy="22" r="1.5" fill="#4a2140"/><circle cx="20" cy="26" r="1.5" fill="#4a2140"/><circle cx="26" cy="22" r="1.5" fill="#4a2140"/></svg>`,
  'canh-rau': `<svg viewBox="0 0 40 40"><path d="M6 18h28a14 14 0 0 1-28 0z" fill="#fff" ${ST}/><path d="M9 18c3-4 8-5 11-3 3-3 9-2 11 3z" fill="#7edb72" ${ST}/><path d="M14 11c0-2 2-2 2-4M22 11c0-2 2-2 2-4" fill="none" stroke="#ff8fb8" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  'trung-op': `<svg viewBox="0 0 40 40"><path d="M8 20c-2-8 6-14 13-11 7-3 14 3 11 11 3 7-5 12-12 10-7 3-15-2-12-10z" fill="#fff" ${ST}/><circle cx="19" cy="20" r="6" fill="#ffb02e" stroke="#4a2140" stroke-width="2"/><circle cx="17" cy="18" r="1.6" fill="#fff"/></svg>`,
  'ca-vien': `<svg viewBox="0 0 40 40"><path d="M6 35L34 7" stroke="#e8b47a" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="29" r="5.5" fill="#f3d6a6" ${ST}/><circle cx="20" cy="21" r="5.5" fill="#f3d6a6" ${ST}/><circle cx="28" cy="13" r="5.5" fill="#f3d6a6" ${ST}/></svg>`,
  'sua-chua': `<svg viewBox="0 0 40 40"><path d="M10 14h20l-3 21H13z" fill="#fff" ${ST}/><path d="M9 14h22v-3H9z" fill="#ff9ec4" ${ST}/><path d="M20 29c-4-3-5-5-3-7 1.5-1.5 3-.8 3 .6 0-1.4 1.5-2.1 3-.6 2 2 1 4-3 7z" fill="#ff9ec4" stroke="#4a2140" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  'bap-nuong': `<svg viewBox="0 0 40 40"><path d="M13 6c4-2 10 0 12 5l2 17c-1 5-12 7-15 2z" fill="#ffd95a" ${ST}/><path d="M16 11l8 21M20 9l5 22M14 18l10 3M15 25l9 3" stroke="#e0a82a" stroke-width="1.6" fill="none"/><path d="M12 30c-5-1-7-7-6-12 3 3 6 7 10 9zM27 30c5-1 7-7 6-12-3 3-6 7-10 9z" fill="#7edb72" ${ST}/></svg>`,
  'chao-trung': `<svg viewBox="0 0 40 40"><path d="M6 18h28a14 14 0 0 1-28 0z" fill="#fff3d6" ${ST}/><circle cx="20" cy="17" r="6" fill="#ffb02e" stroke="#4a2140" stroke-width="2"/><path d="M12 10c0-2 2-2 2-4M26 10c0-2 2-2 2-4" fill="none" stroke="#ff8fb8" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  'com-rau': `<svg viewBox="0 0 40 40"><path d="M6 20h28a14 14 0 0 1-28 0z" fill="#fff" ${ST}/><path d="M10 20c1-8 8-10 10-10s9 2 10 10z" fill="#f7f3ee" ${ST}/><path d="M24 14c3-2 6 0 6 3-3 1-6 0-6-3z" fill="#7edb72" ${ST}/></svg>`,
  'banh-mi-trung': `<svg viewBox="0 0 40 40"><path d="M5 24c-2-6 2-11 8-12l14-5c5-1 9 3 7 8l-6 13c-3 5-10 6-15 2z" fill="#e8b25a" ${ST}/><path d="M12 19c3-3 10-3 14 0-1 5-12 6-14 0z" fill="#fff" ${ST}/><circle cx="19" cy="20" r="2.6" fill="#ffb02e"/></svg>`,
  'sinh-to': `<svg viewBox="0 0 40 40"><path d="M10 10h20l-3 24H13z" fill="#fff3a8" ${ST}/><path d="M11 18h18" stroke="#ffd95a" stroke-width="3"/><path d="M22 4l-3 20" stroke="#ff9ec4" stroke-width="2.8" stroke-linecap="round"/></svg>`,
  salad: `<svg viewBox="0 0 40 40"><path d="M6 18h28a14 14 0 0 1-28 0z" fill="#fff" ${ST}/><path d="M9 18c2-5 6-6 8-4 2-4 8-4 10 0 2-1 4 1 4 4z" fill="#7edb72" ${ST}/><circle cx="16" cy="16" r="2.4" fill="#ff6f7d"/><circle cx="25" cy="15" r="2.4" fill="#ff9a3c"/></svg>`,
  'che-trai-cay': `<svg viewBox="0 0 40 40"><path d="M9 14h22l-3 20H12z" fill="#ffe1ee" ${ST}/><path d="M10 20h20" stroke="#4a2140" stroke-width="1.6"/><circle cx="16" cy="26" r="2.6" fill="#ff6f7d"/><circle cx="23" cy="28" r="2.6" fill="#7edb72"/><circle cx="21" cy="22" r="2.2" fill="#ffd95a"/><path d="M27 6l-4 13" stroke="#ff9ec4" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  'com-chien-rau': `<svg viewBox="0 0 40 40"><path d="M6 20h28a14 14 0 0 1-28 0z" fill="#fff3d6" ${ST}/><path d="M10 20c1-8 8-10 10-10s9 2 10 10z" fill="#ffe9a8" ${ST}/><circle cx="16" cy="16" r="2" fill="#ff9a3c"/><circle cx="23" cy="15" r="2" fill="#7edb72"/><circle cx="20" cy="18" r="1.8" fill="#ff9a3c"/></svg>`,
  'banh-mi-ca-vien': `<svg viewBox="0 0 40 40"><path d="M5 24c-2-6 2-11 8-12l14-5c5-1 9 3 7 8l-6 13c-3 5-10 6-15 2z" fill="#e8b25a" ${ST}/><circle cx="17" cy="19" r="4" fill="#f3d6a6" stroke="#4a2140" stroke-width="2"/><circle cx="25" cy="16" r="4" fill="#f3d6a6" stroke="#4a2140" stroke-width="2"/></svg>`,
  'bap-xao-trung': `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="24" rx="15" ry="9" fill="#fff" ${ST}/><circle cx="14" cy="22" r="2.4" fill="#ffd95a"/><circle cx="20" cy="26" r="2.4" fill="#ffd95a"/><circle cx="26" cy="22" r="2.4" fill="#ffd95a"/><circle cx="21" cy="21" r="3.4" fill="#ffb02e" stroke="#4a2140" stroke-width="1.6"/></svg>`,
  'canh-trung': `<svg viewBox="0 0 40 40"><path d="M6 18h28a14 14 0 0 1-28 0z" fill="#fff3a8" ${ST}/><path d="M12 22c3-2 5 2 8 0s5 2 8 0" fill="none" stroke="#ffb02e" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="25" r="1.8" fill="#7edb72"/><circle cx="25" cy="25" r="1.8" fill="#7edb72"/><path d="M14 11c0-2 2-2 2-4M24 11c0-2 2-2 2-4" fill="none" stroke="#ff8fb8" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  'sua-chua-dua': `<svg viewBox="0 0 40 40"><path d="M10 14h20l-3 21H13z" fill="#fff" ${ST}/><path d="M9 14h22v-3H9z" fill="#ff6f7d" ${ST}/><circle cx="17" cy="25" r="2.2" fill="#ff6f7d"/><circle cx="23" cy="28" r="2.2" fill="#ff6f7d"/><circle cx="22" cy="22" r="1.6" fill="#4a2140"/></svg>`,
  'kem-chuoi': `<svg viewBox="0 0 40 40"><rect x="18" y="26" width="4" height="10" rx="2" fill="#e8b47a" stroke="#4a2140" stroke-width="1.8"/><path d="M12 12a8 8 0 0 1 16 0v14H12z" fill="#ffe98a" ${ST}/><path d="M12 18h16" stroke="#fff" stroke-width="2.4"/></svg>`,
  'che-bap': `<svg viewBox="0 0 40 40"><path d="M9 16h22l-3 17H12z" fill="#fff8d6" ${ST}/><path d="M10 20h20" stroke="#4a2140" stroke-width="1.6"/><circle cx="16" cy="26" r="2.4" fill="#ffd95a"/><circle cx="23" cy="28" r="2.4" fill="#ffd95a"/><circle cx="21" cy="23" r="2" fill="#ffd95a"/><path d="M27 6l-4 13" stroke="#ffb02e" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  'banh-flan': `<svg viewBox="0 0 40 40"><path d="M8 30c0-8 5-14 12-14s12 6 12 14z" fill="#ffd978" ${ST}/><path d="M14 22c2-3 10-3 12 0" fill="none" stroke="#b9722a" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="14" r="2.2" fill="#b9722a"/></svg>`,
  'ca-vien-rau': `<svg viewBox="0 0 40 40"><path d="M6 20h28a14 14 0 0 1-28 0z" fill="#fff" ${ST}/><circle cx="14" cy="18" r="4" fill="#f3d6a6" stroke="#4a2140" stroke-width="2"/><circle cx="23" cy="17" r="4" fill="#f3d6a6" stroke="#4a2140" stroke-width="2"/><path d="M27 13c3-2 6 0 6 3-3 1-6 0-6-3z" fill="#7edb72" ${ST}/></svg>`,
  'chuoi-nuong': `<svg viewBox="0 0 40 40"><path d="M10 9c-3 13 4 25 22 27 3 0 4-3 2-4-12-2-17-10-16-21z" fill="#e8b25a" ${ST}/><path d="M14 16l5-2M16 22l6-1M20 28l6 0" stroke="#7a4a1a" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  'banh-mi': `<svg viewBox="0 0 40 40"><path d="M6 25c-3-5 0-10 6-12l14-7c5-2 10 3 8 8l-7 14c-3 5-9 7-14 3z" fill="#e8b25a" ${ST}/><path d="M14 17l5 5M20 12l5 5M26 9l3 3" stroke="#fff3c4" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};

/**
 * Gắn khay thức ăn. `c` là các hàm của cảnh: { petRoot, camera, canvas, reduce, hitPet, hideHint, say, setTemp,
 * popText, impulse, spawn, renderStats, shake }. Trả về { isDragging } để cảnh biết đang kéo món.
 */
export function initFood(c) {
  const { petRoot, camera, canvas, reduce, hitPet, hideHint, say, setTemp, popText, impulse, spawn, renderStats, openShop } = c;
  const pv = new THREE.Vector3();
  const tray = $('tray');
  let drag = null;
  /* Khay chỉ hiện món còn trong kho, kèm số phần; nút cuối mở cửa hàng để mua thêm */
  function renderTray() {
    if (drag) return; // đang kéo thì đừng dựng lại nút
    const have = EDIBLES.filter(f => (S.owned[f.id] || 0) > 0);
    tray.innerHTML = _t`<span class="tray-hint">${have.length ? _t('Kéo món ăn vào bé, hoặc chạm') : _t('Hết thức ăn rồi. Mua thêm nhé!')}</span>` +
      have.map(f => `<button class="food" type="button" data-id="${f.id}" title="${f.name} · +${f.no} No, +${f.vui} Vui · ${FOOD_GROUPS[f.group].name}${f.group2 ? ' + ' + FOOD_GROUPS[f.group2].name : ''}">${FOOD_SVG[f.id]}${f.name}<small>×${S.owned[f.id]} · +${f.no}</small></button>`).join('') +
      _t('<button class="food more" type="button" data-more title="Mua thêm thức ăn"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#ffd36e" stroke="#a8742e" stroke-width="2.2"/><path d="M20 12v16M12 20h16" stroke="#a8742e" stroke-width="3" stroke-linecap="round"/></svg>Mua thêm<small>cửa hàng</small></button>');
  }
  renderTray(); onSync(renderTray);
  tray.addEventListener('pointerdown', e => {
    const b = e.target.closest('.food'); if (!b) return;
    if ('more' in b.dataset) { e.preventDefault(); openShop && openShop(); return; } // data-more không có giá trị nên dataset.more là '' (falsy): phải kiểm bằng `in`
    e.preventDefault();
    const f = FOOD_BY_ID[b.dataset.id];
    const g = document.createElement('div'); g.className = 'drag-ghost'; g.innerHTML = FOOD_SVG[f.id]; g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
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
    if (!moved || hitPetLoose(e)) flyAndFeed(f, g); else { g.remove(); renderTray(); }
  });
  tray.addEventListener('pointercancel', () => { if (drag) { drag.g.remove(); drag = null; renderTray(); } });
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
    setTimeout(() => { g.remove(); feed(f); renderTray(); }, reduce ? 0 : 450);
  }
  function feed(f) {
    hideHint();
    if (S.asleep) { say(_t('Suỵt… mình đang ngủ mà.'), 2400); return; }
    if ((S.owned[f.id] || 0) < 1) { say(_t`Hết ${f.name} rồi. Mua thêm ở cửa hàng nhé!`, 2800); return; }
    const sweet = f.group === 'ngot' || f.group2 === 'ngot';
    if (sweet && c.sweetsBlocked()) { setTemp('sulky', 1600); say(_t('Răng mình đang đau, mình không ăn đồ ngọt được đâu…'), 3000); return; }
    if (S.no >= 90) { setTemp('sulky', 1600); c.shake(); say(_t('Mình no căng rồi mà~'), 2400); return; }
    S.no = clamp(S.no + f.no); S.vui = clamp(S.vui + f.vui); S.sach = clamp(S.sach - 2);
    S.owned = { ...S.owned, [f.id]: S.owned[f.id] - 1 }; // dùng một phần; số thật do server trả về
    popText(`+${f.no} No`, '#f08a24');
    count('fed'); dayRec().foods.push(f.name); dayRec().groups.push(f.group); if (f.group2) dayRec().groups.push(f.group2);
    setTemp('chew', 1500); impulse(-1.5); sfx('feed');
    if (sweet && dayRec().groups.filter(g => g === "ngot").length === c.sweetsLimit - 1) c.toast(_t`Hôm nay bé đã ăn ${c.sweetsLimit - 1} món ngọt. Thêm một món ngọt nữa là bé bị sâu răng đó!`);
    const req = act('feed', f.id);
    setTimeout(async () => {
      const r = await req;
      if (!r || r.refused) refreshOwned().catch(() => {}); // lấy lại số phần thật từ server
      if (!r) { /* mất mạng: giữ bản dự đoán trên máy */ }
      else if (r.refused === 'full') { setTemp('sulky', 1400); say(_t('Mình no căng rồi mà~'), 2400); }
      else if (r.dislike) { setTemp('sulky', 1500); say(_t('Hừm… món này mình không thích lắm.'), 2800); }
      else if (r && r.fav) { setTemp('love', 1800); spawn('heart', 4, 1); spawn('sparkle', 2); say(S.favFound ? _t('Món tủ của mình nè!!') : _t('Ơ… đây là món tủ của mình! Sao bạn biết hay vậy?'), 3400); S.favFound = true; }
      else { spawn('sparkle'); say(f.line, 2600); }
      if (r && r.balanced) setTimeout(() => { popText(_t`Ăn cân bằng +${BALANCED_BONUS} Vui`, '#3f9a63'); spawn('sparkle', 2); }, 600);
      save(); renderStats(); renderTray();
    }, 1500);
  }
  return { isDragging: () => !!drag };
}

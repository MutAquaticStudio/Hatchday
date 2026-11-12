// Tay cầm (Xbox / PlayStation / Steam Deck, bố cục "standard" của Gamepad API).
//   D-pad / cần trái khi đang mở bảng: di chuyển vòng chọn giữa các nút theo hướng · A: bấm · B: quay lại (như Esc)
//   Cần trái khi không mở bảng ở nơi đi lại được: dắt bé đi · Cần phải: cuộn bảng đang mở
//   LB / RB: đổi tab trong bảng · Y: menu Nhà · Start: Cài đặt · Back/View: Bản đồ
// Ô nhập chữ trên Steam Deck mở bàn phím ảo Steam. Dùng tay cầm thì hiện vòng chọn rõ và dải gợi ý nút; dùng chuột/chạm thì ẩn đi.
import { _t } from '../i18n';
import { desktop } from '../lib/platform';

/** Hướng đi của bé từ cần trái (game.js cộng vào điều khiển bàn phím). */
export const stick = { x: 0, y: 0 };

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [role="button"], [tabindex]:not([tabindex="-1"])';
const LAYERS = '#mini:not([hidden]), .welcome:not([hidden]), .tour:not([hidden]), #settings:not([hidden]), #stats:not([hidden]), #diary:not([hidden]), .hsheet:not([hidden]), .peer-card:not([hidden]), #battle:not([hidden])';
const DEAD = 0.35;

const visible = el => { if (!el || el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };

/** Lớp đang ở trên cùng (bảng, mini-game, thẻ chào…): vòng chọn chỉ đi trong lớp này. Không có lớp nào thì là cả màn hình. */
function topLayer() {
  let best = null, bz = -1;
  document.querySelectorAll(LAYERS).forEach(el => { if (!visible(el)) return; const z = parseInt(getComputedStyle(el).zIndex) || 0; if (z >= bz) { bz = z; best = el; } });
  return best;
}
const candidates = root => [...(root || document.getElementById('app') || document.body).querySelectorAll(FOCUSABLE)].filter(visible);

/** Chọn phần tử gần nhất theo hướng (ưu tiên thẳng hàng). */
function moveFocus(dx, dy) {
  const layer = topLayer(), list = candidates(layer); if (!list.length) return;
  const cur = document.activeElement && list.includes(document.activeElement) ? document.activeElement : null;
  // chưa chọn gì trong lớp này: chọn nút nội dung đầu tiên (bỏ qua nút ✕ đóng)
  if (!cur) { focus(list.find(el => !el.matches('.hs-close, [data-close], .x, #settings-close')) || list[0]); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, vx = x - ax, vy = y - ay;
    const along = vx * dx + vy * dy; if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.2;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) focus(best);
}
function focus(el) { el.focus({ preventScroll: true }); el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }

/* Bảng hay vẽ lại nội dung (đồng hồ, tiến độ…) làm nút đang chọn bị thay bằng nút mới y hệt: nhớ "danh tính" của nút
   (id hoặc thuộc tính data-*) và chọn lại nút tương ứng sau khi vẽ lại, để vòng chọn không nhảy mất. */
let lastKey = '';
const keyOf = el => {
  if (!el || el === document.body) return '';
  if (el.id) return '#' + CSS.escape(el.id);
  for (const a of el.attributes) if (a.name.startsWith('data-')) return `${el.tagName.toLowerCase()}[${a.name}="${CSS.escape(a.value)}"]`;
  return '';
};
addEventListener('focusin', e => { const k = keyOf(e.target); if (k) lastKey = k; });
function restoreFocus() {
  if (!lastKey || (document.activeElement && document.activeElement !== document.body)) return;
  const layer = topLayer(), el = (layer || document).querySelector(lastKey);
  if (el && visible(el)) el.focus({ preventScroll: true });
}

/** Đổi tab trong lớp đang mở (LB / RB). */
function switchTab(step) {
  const layer = topLayer(); if (!layer) return;
  const bar = layer.querySelector('[role="tablist"], .tabs-row, .tabs'); if (!bar) return;
  const tabs = [...bar.querySelectorAll('button')].filter(visible); if (!tabs.length) return;
  let i = tabs.findIndex(b => b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on'));
  i = ((i < 0 ? 0 : i + step) + tabs.length) % tabs.length; tabs[i].click(); setTimeout(() => focus(tabs[i]), 30);
}

async function press() {
  restoreFocus(); // nút vừa bị vẽ lại: chọn lại nút tương ứng rồi mới bấm
  const el = document.activeElement;
  if (!el || el === document.body) { const l = candidates(topLayer())[0]; if (l) focus(l); return; }
  if (el.matches('input:not([type=checkbox]):not([type=range]), textarea') && desktop?.steam?.deck) {
    const v = await desktop.steam.textInput({ desc: el.getAttribute('aria-label') || el.getAttribute('placeholder') || '', max: +(el.getAttribute('maxlength') || 100), text: el.value });
    if (v != null) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    return;
  }
  el.click();
}
const back = () => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

/* ---------- vòng lặp đọc tay cầm ---------- */
let raf = 0, prev = [], held = { dir: '', at: 0, next: 0 }, padMode = false;
const hints = document.createElement('div');
function setPadMode(on) {
  if (padMode === on) return; padMode = on; document.body.classList.toggle('pad', on); hints.hidden = !on;
}
function buildHints() {
  hints.className = 'pad-hints'; hints.hidden = true; hints.setAttribute('aria-hidden', 'true');
  hints.innerHTML = `<span><b>A</b>${_t('Chọn')}</span><span><b>B</b>${_t('Quay lại')}</span><span><b>Y</b>${_t('Nhà')}</span><span><b>☰</b>${_t('Cài đặt')}</span>`;
  (document.getElementById('app') || document.body).appendChild(hints);
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[0]; if (!gp) { stick.x = stick.y = 0; return; }
  const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const down = i => btn(i) && !prev[i];
  const any = gp.buttons.some(b => b.pressed) || gp.axes.some(v => Math.abs(v) > DEAD);
  if (any) setPadMode(true);

  if (padMode) restoreFocus();
  const layer = topLayer();
  const lx = Math.abs(gp.axes[0]) > DEAD ? gp.axes[0] : 0, ly = Math.abs(gp.axes[1]) > DEAD ? gp.axes[1] : 0;
  // cần trái: dắt bé khi không có bảng nào mở; có bảng thì dùng để chọn như D-pad
  if (!layer) { stick.x = lx; stick.y = ly; } else { stick.x = stick.y = 0; }
  let dir = btn(12) ? 'u' : btn(13) ? 'd' : btn(14) ? 'l' : btn(15) ? 'r' : '';
  if (!dir && layer) dir = ly < -0.6 ? 'u' : ly > 0.6 ? 'd' : lx < -0.6 ? 'l' : lx > 0.6 ? 'r' : '';
  if (dir) {
    if (held.dir !== dir) { held = { dir, at: now, next: now + 360 }; step(dir); }
    else if (now >= held.next) { held.next = now + 110; step(dir); }
  } else held.dir = '';
  // cần phải: cuộn vùng cuộn được của lớp đang mở
  const ry = gp.axes[3] || 0;
  if (Math.abs(ry) > DEAD && layer) { const sc = [layer, ...layer.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); if (sc) sc.scrollTop += ry * 14; }

  if (down(0)) void press();
  if (down(1)) back();
  if (down(3)) document.getElementById('a-house')?.click();
  if (down(9)) document.getElementById('btn-settings')?.click();
  if (down(8)) document.getElementById('scene-tag')?.click();
  if (down(4)) switchTab(-1);
  if (down(5)) switchTab(1);
  prev = gp.buttons.map(b => b.pressed);
}
const step = d => moveFocus(d === 'l' ? -1 : d === 'r' ? 1 : 0, d === 'u' ? -1 : d === 'd' ? 1 : 0);

export function initGamepad() {
  buildHints();
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('gamepadconnected', start);
  addEventListener('gamepaddisconnected', () => { if (![...(navigator.getGamepads?.() || [])].some(Boolean)) { cancelAnimationFrame(raf); raf = 0; stick.x = stick.y = 0; setPadMode(false); } });
  // chuột hoặc chạm thì về chế độ thường
  ['pointerdown', 'mousemove'].forEach(ev => addEventListener(ev, e => { if (e.isTrusted && (ev !== 'mousemove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) setPadMode(false); }, { passive: true }));
  if ([...(navigator.getGamepads?.() || [])].some(Boolean)) start();
}

// Màn hình Bản đồ: bản đồ minh hoạ có địa hình (sông, cầu, đồi, rừng cây, đường lát), khu đất riêng cho từng nơi, mây trôi, màu theo giờ trong ngày,
// 9 ghim (Nhà, Vườn nhà và 7 địa điểm) với ổ khoá theo Gắn bó, chấm cảnh báo, huy hiệu số người ở nơi chung, thẻ "Đi tới" ở đáy.
import { _t } from '../../i18n';
import { BLOCK_TEXT, enterBlock, MAP_NODES, PLACE_BY_ID } from './registry';
import * as api from '../../data/api';

const ICON = {
  home: '<path d="M4 12 12 5l8 7v8H4z" fill="#ffd9a8"/><path d="M10 20v-5h4v5" fill="#ff9ec4"/>',
  garden: '<circle cx="12" cy="9" r="5" fill="#7edb72"/><rect x="11" y="13" width="2" height="7" fill="#a7743a"/><circle cx="8" cy="9" r="2.5" fill="#9be38a"/>',
  market: '<path d="M3 9h18l-2 4H5z" fill="#ff9ec4"/><path d="M5 13h14v7H5z" fill="#ffe9c4"/><path d="M8 9v4M12 9v4M16 9v4" stroke="#fff" stroke-width="1.4"/>',
  hospital: '<rect x="4" y="5" width="16" height="15" rx="2" fill="#eafaf4"/><path d="M12 8v8M8 12h8" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/>',
  plaza: '<ellipse cx="12" cy="17" rx="8" ry="3" fill="#cfe9ff"/><path d="M12 6v9M8 9c2 0 4 1 4 4M16 9c-2 0-4 1-4 4" stroke="#6ab7ff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  tea: '<path d="M5 9h11v5a5 5 0 0 1-5 5 5 5 0 0 1-6-5z" fill="#ffe9c4"/><path d="M16 10h2a2 2 0 0 1 0 4h-2" stroke="#a7743a" stroke-width="1.6" fill="none"/><path d="M8 5c0 1 1 1 1 2M12 5c0 1 1 1 1 2" stroke="#c9a6ff" stroke-width="1.4" fill="none"/>',
  park: '<path d="M5 20V8h14v12" stroke="#a7743a" stroke-width="1.8" fill="none"/><path d="M9 8l-2 9M15 8l2 9" stroke="#6ab7ff" stroke-width="1.5"/><rect x="6" y="16" width="6" height="2" rx="1" fill="#ff9ec4"/>',
  tailor: '<path d="M12 6a2 2 0 1 1 2 2l-2 1.5L4 15h16l-8-5.5" fill="none" stroke="#8a6ac8" stroke-width="1.8" stroke-linejoin="round"/>',
  library: '<path d="M4 6h7v13H4zM13 6h7v13h-7z" fill="#e0f4ff"/><path d="M11 6c-2-1-5-1-7 0M13 6c2-1 5-1 7 0" stroke="#6ab7ff" stroke-width="1.6" fill="none"/>',
};
const LOCK = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="#8a7a9a"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#8a7a9a" stroke-width="2"/></svg>';
/** Màu khu đất của từng nơi trên bản đồ. */
const PLOT = { home: '#ffe9c9', garden: '#d9f3c4', market: '#fff0cf', hospital: '#e0f7ee', plaza: '#fbeed9', tea: '#ffe6cf', park: '#cdeeb0', tailor: '#eadcff', library: '#dcecff' };
const W = 360, H = 400, px = n => (n.map.x / 100) * W, py = n => (n.map.y / 100) * H;
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Địa hình vẽ tay bằng SVG (viewBox 360×400). dusk/night: lớp phủ màu theo giờ; decor: cờ trang trí theo sự kiện. */
function terrain(nodes, hour, decor) {
  const pins = nodes.filter(n => !n.hidden), by = Object.fromEntries(pins.map(n => [n.id, n])), c = by.plaza;
  const cx = px(c), cy = py(c), r = rng(11), trees = [], dots = [];
  const farFromPins = (x, y, d) => pins.every(n => Math.hypot(px(n) - x, py(n) - y) > d);
  for (let i = 0; i < 220 && trees.length < 46; i++) { const x = r() * W, y = 36 + r() * 300; if (farFromPins(x, y, 54) && !(y > 322 && y < 362)) trees.push([x, y, 5 + r() * 5]); }
  for (let i = 0; i < 120 && dots.length < 60; i++) { const x = r() * W, y = 30 + r() * 300; if (farFromPins(x, y, 40) && !(y > 318 && y < 366)) dots.push([x, y, ['#fff', '#ffd36e', '#ffb3d1', '#d9c4ff'][i % 4]]); }
  const road = (a, b, bend = 0) => { const ax = px(a), ay = py(a), bx = px(b), by2 = py(b), mx = (ax + bx) / 2 + bend, my = (ay + by2) / 2 - bend * 0.4; return `M${ax} ${ay} Q${mx} ${my} ${bx} ${by2}`; };
  const roads = [['market', -26], ['hospital', 26], ['library', 0], ['tea', 24], ['park', -24], ['tailor', 0]].map(([id, bend]) => road(c, by[id], bend));
  const lower = [road(by.tailor, by.home, -18), road(by.tailor, by.garden, 18)];
  const night = hour >= 21 || hour < 5, dusk = !night && (hour >= 18 || hour < 7);
  const cloud = (x, y, s, d) => `<g class="wm-cloud" style="animation-duration:${d}s;animation-delay:-${(x % 40)}s" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="9" fill="#fff" opacity=".85"/><ellipse cx="14" cy="-6" rx="14" ry="8" fill="#fff" opacity=".85"/><ellipse cx="-12" cy="-5" rx="12" ry="7" fill="#fff" opacity=".85"/></g>`;
  return `<svg class="wm-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="wmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ecb6"/><stop offset=".55" stop-color="#d9f3c4"/><stop offset="1" stop-color="#bfe8a8"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#wmg)"/>
    <path d="M0 70 L40 22 L80 62 L112 28 L150 70Z" fill="#c9d8f2"/><path d="M210 66 L246 24 L286 60 L320 18 L360 64Z" fill="#d3c9f2"/><path d="M40 22 L48 34 L34 34Z M320 18 L328 31 L312 31Z" fill="#fff"/>
    <ellipse cx="60" cy="86" rx="110" ry="34" fill="#b4e29c" opacity=".8"/><ellipse cx="310" cy="92" rx="100" ry="30" fill="#aee09a" opacity=".8"/>
    <path d="M0 322 C60 300 110 350 190 334 S320 312 360 338 L360 366 C320 346 250 372 190 360 S60 330 0 350Z" fill="#8fd4ff"/><path d="M10 332 q16 -6 32 0 M120 346 q16 -6 32 0 M250 340 q16 -6 32 0" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
    <ellipse cx="34" cy="206" rx="30" ry="14" fill="#8fd4ff"/><ellipse cx="30" cy="204" rx="14" ry="5" fill="#fff" opacity=".35"/>
    <g fill="none" stroke-linecap="round">${[...roads, ...lower].map(d => `<path d="${d}" stroke="#e5c78e" stroke-width="13"/>`).join('')}${[...roads, ...lower].map(d => `<path d="${d}" stroke="#f6e5bd" stroke-width="9"/>`).join('')}${[...roads, ...lower].map(d => `<path d="${d}" stroke="#fffaf0" stroke-width="1.6" stroke-dasharray="3 7" opacity=".9"/>`).join('')}</g>
    <g fill="#c29a62" stroke="#8a5f3a" stroke-width="1.5"><rect x="${(px(by.tailor) + px(by.home)) / 2 - 30}" y="331" width="22" height="9" rx="2" transform="rotate(-14 ${(px(by.tailor) + px(by.home)) / 2} 336)"/><rect x="${(px(by.tailor) + px(by.garden)) / 2 + 8}" y="333" width="22" height="9" rx="2" transform="rotate(14 ${(px(by.tailor) + px(by.garden)) / 2 + 20} 338)"/></g>
    ${pins.map(n => `<ellipse cx="${px(n)}" cy="${py(n) + 6}" rx="${n.id === 'plaza' ? 46 : 38}" ry="${n.id === 'plaza' ? 30 : 25}" fill="${PLOT[n.id] || '#fff'}" stroke="#ffffff" stroke-width="3" opacity=".95"/>`).join('')}
    <circle cx="${cx}" cy="${cy + 6}" r="15" fill="#bfe8ff" stroke="#fff" stroke-width="2"/><circle cx="${cx}" cy="${cy + 6}" r="6" fill="#fff" opacity=".7"/>
    ${trees.map(([x, y, s]) => `<g><rect x="${x - 1.4}" y="${y}" width="2.8" height="${s * 0.8}" fill="#b98a5e"/><circle cx="${x}" cy="${y - s * 0.2}" r="${s}" fill="#6fcf75" stroke="#4aa65a" stroke-width="1.5"/><circle cx="${x - s * 0.35}" cy="${y - s * 0.5}" r="${s * 0.45}" fill="#8be07a" opacity=".85"/></g>`).join('')}
    ${dots.map(([x, y, col]) => `<circle cx="${x}" cy="${y}" r="2.1" fill="${col}"/>`).join('')}
    ${cloud(60, 40, 0.9, 70)}${cloud(230, 28, 1.1, 90)}${cloud(320, 120, 0.8, 80)}
    ${decor ? `<g>${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 31 + 6} 2 l9 0 l-4.5 12z" fill="${['#ff9ec4', '#ffd36e', '#7ec8ff', '#c9a6ff'][i % 4]}"/>`).join('')}</g>` : ''}
    ${dusk ? `<rect width="${W}" height="${H}" fill="#ff9a5a" opacity=".16"/>` : ''}
    ${night ? `<rect width="${W}" height="${H}" fill="#1a2756" opacity=".5"/>${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53) % 110}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity=".85"/>`).join('')}` : ''}
  </svg>`;
}

/** h: { $, esc, head, sheet, open, closeAll, S, bondLevel(), goTo, toast, getArea, alerts() → {id: true}, decor?() } */
export function initMap(h) {
  let sel = '', counts = {};
  function render(el = h.$('map')) {
    const level = h.bondLevel(), here = h.getArea(), alerts = h.alerts(), node = MAP_NODES.find(n => n.id === sel);
    const pins = MAP_NODES.filter(n => !n.hidden).map(n => {
      const locked = !n.ready || level < n.unlock, soon = !n.ready, cnt = counts[n.id];
      return _t`<button type="button" class="pin${locked ? ' locked' : ''}${sel === n.id ? ' on' : ''}${here === n.id ? ' here' : ''}${alerts[n.id] ? ' alert' : ''}" data-pin="${n.id}" style="left:${n.map.x}%;top:${n.map.y}%" aria-label="${h.esc(n.name)}${cnt ? _t`, ${cnt} người ở đây` : ''}">
        <span class="pin-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n.id] || ''}</svg>${cnt ? `<i class="pin-n" aria-hidden="true">${cnt}</i>` : ''}</span><b>${h.esc(PLACE_BY_ID[n.id]?.short || n.name)}</b>${soon ? _t('<small>Sắp mở</small>') : locked ? _t`<small>${LOCK} Cấp ${n.unlock}</small>` : ''}</button>`;
    }).join('');
    let card = _t('<div class="map-card empty"><p class="map-hint">Chạm một nơi trên bản đồ để xem và đi tới.</p></div>');
    if (node) {
      const block = enterBlock(node.id, { bondLevel: level, asleep: h.S.asleep });
      const who = counts[node.id] ? _t`<p class="map-who">${counts[node.id]} người đang ở đây</p>` : '';
      card = _t`<div class="map-card"><div><b>${h.esc(node.name)}</b><p>${h.esc(node.blurb)}</p>${who}</div>${here === node.id ? _t('<span class="pill-ok">Bạn đang ở đây</span>')
        : block ? `<span class="map-block">${h.esc(BLOCK_TEXT[block](node))}</span>` : _t`<button type="button" class="btn-sm" data-go-place="${node.id}">Đi tới</button>`}</div>`;
    }
    el.innerHTML = h.head(_t('Bản đồ'), _t`Gắn bó cấp ${level}`) + `<div class="hs-body">${card}<div class="worldmap">${terrain(MAP_NODES, new Date().getHours(), h.decor ? h.decor() : null)}${pins}</div></div>`;
  }
  async function loadCounts() { try { counts = await api.getPlacesSummary(); } catch { counts = {}; } if (!h.$('map').hidden) render(); }
  const open = () => { sel = ''; h.open('map'); render(); loadCounts(); };
  h.app.addEventListener('click', e => {
    const p = e.target.closest('[data-pin]'), go = e.target.closest('[data-go-place]');
    if (p) { sel = p.dataset.pin; if (!h.$('map').hidden) render(); return; }
    if (go) {
      const id = go.dataset.goPlace, block = enterBlock(id, { bondLevel: h.bondLevel(), asleep: h.S.asleep });
      if (block) { h.toast(BLOCK_TEXT[block](MAP_NODES.find(n => n.id === id))); return; }
      h.closeAll(); h.goTo(id);
    }
  });
  return { open, render };
}

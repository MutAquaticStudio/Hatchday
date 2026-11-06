// Màn hình Bản đồ: 9 ghim (Nhà, Vườn nhà và 7 địa điểm), ổ khoá theo Gắn bó, chấm cảnh báo, thẻ "Đi tới" ở đáy.
import { BLOCK_TEXT, enterBlock, MAP_NODES, PLACE_BY_ID } from './registry';

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

/** h: { $, esc, head, sheet, open, closeAll, S, bondLevel(), goTo, toast, getArea, alerts() → {id: true} } */
export function initMap(h) {
  let sel = '';
  const roads = MAP_NODES.filter(n => n.id !== 'plaza' && !n.hidden).map(n => `<path d="M50 45 L${n.map.x} ${n.map.y}" />`).join('');
  function render(el = h.$('map')) {
    const level = h.bondLevel(), here = h.getArea(), alerts = h.alerts(), node = MAP_NODES.find(n => n.id === sel);
    const pins = MAP_NODES.filter(n => !n.hidden).map(n => {
      const locked = !n.ready || level < n.unlock, soon = !n.ready;
      return `<button type="button" class="pin${locked ? ' locked' : ''}${sel === n.id ? ' on' : ''}${here === n.id ? ' here' : ''}${alerts[n.id] ? ' alert' : ''}" data-pin="${n.id}" style="left:${n.map.x}%;top:${n.map.y}%" aria-label="${h.esc(n.name)}">
        <span class="pin-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n.id] || ''}</svg></span><b>${h.esc(PLACE_BY_ID[n.id]?.short || n.name)}</b>${soon ? '<small>Sắp mở</small>' : locked ? `<small>${LOCK} Cấp ${n.unlock}</small>` : ''}</button>`;
    }).join('');
    let card = '<div class="map-card empty"><p class="map-hint">Chạm một nơi trên bản đồ để xem và đi tới.</p></div>';
    if (node) {
      const block = enterBlock(node.id, { bondLevel: level, asleep: h.S.asleep });
      card = `<div class="map-card"><div><b>${h.esc(node.name)}</b><p>${h.esc(node.blurb)}</p></div>${here === node.id ? '<span class="pill-ok">Bạn đang ở đây</span>'
        : block ? `<span class="map-block">${h.esc(BLOCK_TEXT[block](node))}</span>` : `<button type="button" class="btn-sm" data-go-place="${node.id}">Đi tới</button>`}</div>`;
    }
    el.innerHTML = h.head('Bản đồ', `Gắn bó cấp ${level}`) + `<div class="hs-body">${card}<div class="worldmap"><svg class="wm-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="100" fill="#dff5d6"/><path d="M0 52 Q25 44 40 58 T100 54 V66 Q70 70 55 64 T0 66z" fill="#bfe8ff" opacity=".8"/>
      <g stroke="#f1dcb4" stroke-width="3.2" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke">${roads}</g></svg>${pins}</div></div>`;
  }
  const open = () => { sel = ''; h.open('map'); render(); };
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

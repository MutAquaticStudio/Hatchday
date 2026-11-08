// Nhật ký ngày, Ký ức và bộ đếm hành động trong ngày. count()/remember()/firstTime() được game.js gọi khi người chơi chăm thú.
import { _t } from '../i18n';
import { S, save, deleteMemory as delMem } from './store';
import { writeDiary as writeDiaryRule } from './rules';
import { $, esc } from './dom.js';

const WD = [_t('Chủ nhật'), _t('Thứ Hai'), _t('Thứ Ba'), _t('Thứ Tư'), _t('Thứ Năm'), _t('Thứ Sáu'), _t('Thứ Bảy')];
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dayRec() {
  const k = today();
  if (!S.day || S.day.d !== k) { if (S.day) S.diary[S.day.d] = writeDiary(S.day); S.day = { d: k, fed: 0, foods: [], groups: [], bath: 0, ball: 0, pet: 0, talk: 0, sleep: 0 }; }
  return S.day;
}
export function count(k) { const d = dayRec(); d[k] = (d[k] || 0) + 1; if (!$('diary').hidden) renderDiary(); }
export function remember(type, text) { S.mem.unshift({ t: Date.now(), type, text }); if (S.mem.length > 60) S.mem.length = 60; save(); if (!$('diary').hidden) renderDiary(); }
export function firstTime(key, type, text) { if (S.firsts[key]) return; S.firsts[key] = 1; remember(type, text); }
const writeDiary = writeDiaryRule;
function dayTitle(k) { const [y, m, dd] = k.split('-').map(Number); return `${WD[new Date(y, m - 1, dd).getDay()]}, ${dd}/${m}`; }
function ago(t) { const x = (Date.now() - t) / 1000; return x < 60 ? _t('vừa xong') : x < 3600 ? _t`${Math.floor(x / 60)} phút trước` : x < 86400 ? _t`${Math.floor(x / 3600)} giờ trước` : _t`${Math.floor(x / 86400)} ngày trước`; }
const MEM_COL = { meet: '#ff6fa8', food: '#ffb35c', bath: '#4fc3f7', play: '#7edb72', talk: '#8f7cff' };
let dTab = 'pages';
export function renderDiary() {
  const el = $('dpanel');
  if (dTab === 'pages') {
    const d = dayRec(), past = Object.keys(S.diary).sort().reverse();
    el.innerHTML = _t`<article class="page"><h3>${dayTitle(d.d)}</h3><span class="writing">${esc(S.name)} đang viết trang hôm nay…</span><p>${esc(writeDiary(d))}</p></article>` +
      past.map(k => `<article class="page"><h3>${dayTitle(k)}</h3><p>${esc(S.diary[k])}</p></article>`).join('');
  } else {
    el.innerHTML = S.mem.length
      ? _t`<p class="empty">Những điều ${esc(S.name)} nhớ. Bạn xoá được từng dòng.</p>` + S.mem.map((m, i) => _t`<div class="mem"><i style="background:${MEM_COL[m.type] || '#ccc'}"></i><span>${esc(m.text)}<small>${ago(m.t)}</small></span><button type="button" data-i="${i}" aria-label="Xoá ký ức này">Xoá</button></div>`).join('')
      : _t('<p class="empty">Chưa có ký ức nào.</p>');
  }
}

/** Gắn các nút của bảng Nhật ký. Gọi một lần khi khởi động. */
export function initDiary() {
  $('dpanel').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const m = S.mem[Number(b.dataset.i)]; if (m) delMem(m).then(renderDiary); renderDiary(); });
  function setTab(t) { dTab = t; $('tab-pages').setAttribute('aria-selected', String(t === 'pages')); $('tab-mem').setAttribute('aria-selected', String(t === 'mem')); renderDiary(); }
  $('tab-pages').onclick = () => setTab('pages'); $('tab-mem').onclick = () => setTab('mem');
  $('btn-diary').onclick = () => { const s = $('diary'); s.hidden = !s.hidden; $('btn-diary').setAttribute('aria-expanded', String(!s.hidden)); if (!s.hidden) { $('settings').hidden = true; $('btn-settings')?.setAttribute('aria-expanded', 'false'); $('stats').hidden = true; $('btn-stats').setAttribute('aria-expanded', 'false'); renderDiary(); } };
}

// Đồng hành giờ làm việc (nhắc giải lao, uống nước, chào sáng/tối) và màn chào mừng quay lại sau khi vắng. Luật ở companion-rules.ts.
import { _t } from '../i18n';
import { S } from './store';
import { $ } from './dom.js';
import { awayText, COMPANION, DEFAULT_PREFS, drops, greetingFor, pickLine, stepReminders, wasAway } from './companion-rules';
import { ILLNESS_BY_ID, minutesToSick, STAT_NOUN } from './health';
import { healthNow } from './store';
import { localDay } from './rules';

const SEEN = 'hatchday-seen', PREFS = 'hatchday-companion', GREETED = 'hatchday-greeted';
const get = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } };
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const capFirst = t => t.charAt(0).toUpperCase() + t.slice(1);

/** c: { say, startAction, spawn, sfx, goTo, openClinic, isBusy, dev } */
export function initCompanion(c) {
  const prefs = { ...DEFAULT_PREFS, ...(get(PREFS) || {}) };
  const snap = () => put(SEEN, { t: Date.now(), no: S.no, vui: S.vui, sach: S.sach, nl: S.nl });

  /* ---------- cài đặt trong bảng Chỉ số ---------- */
  document.querySelectorAll('[data-cp]').forEach(b => {
    b.setAttribute('aria-pressed', String(!!prefs[b.dataset.cp]));
    b.addEventListener('click', () => { prefs[b.dataset.cp] = !prefs[b.dataset.cp]; b.setAttribute('aria-pressed', String(prefs[b.dataset.cp])); put(PREFS, prefs); });
  });

  /* ---------- chào mừng quay lại ---------- */
  const before = get(SEEN), toured = (() => { try { return localStorage.getItem('hatchday-tour') === '1'; } catch { return true; } })();
  let card = null;
  function closeWelcome() { card?.remove(); card = null; }
  function showWelcome(prev) {
    const mins = Math.round((Date.now() - prev.t) / 60000), lost = drops(prev, S), il = S.illness ? ILLNESS_BY_ID[S.illness] : null, risk = minutesToSick(healthNow(), Date.now());
    card = document.createElement('div'); card.className = 'welcome'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', _t('Chào mừng quay lại'));
    const acts = [];
    if (il) acts.push(['clinic', _t('Mở sổ sức khoẻ')]);
    if (S.no < 40 && !S.asleep) acts.push(['eat', _t('Cho ăn')]);
    if (S.sach < 40 && !S.asleep) acts.push(['bath', _t('Tắm cho bé')]);
    card.innerHTML = _t`<div class="welcome-card"><h2>Chào mừng trở lại!</h2><p>Bạn vắng ${awayText(mins)}. ${esc(S.name)} đã đợi bạn.</p>
      ${S.asleep ? _t`<p class="w-note">${esc(S.name)} đang ngủ.</p>` : ''}
      ${lost.length ? _t`<ul class="w-drops">${lost.map(d => _t`<li>${esc(capFirst(STAT_NOUN[d.key]))} tụt từ ${d.from} xuống ${d.to}</li>`).join('')}</ul>` : _t`<p class="w-note">Các chỉ số vẫn ổn, bé ở nhà ngoan lắm.</p>`}
      ${il ? _t`<p class="w-warn">Bé đang bị ${esc(il.name.toLowerCase())}.</p>` : risk ? _t`<p class="w-warn">${esc(capFirst(STAT_NOUN[risk.stat]))} của bé gần 0, chăm bé ngay kẻo ốm.</p>` : ''}
      <div class="welcome-act">${acts.map(([k, l]) => `<button type="button" class="btn-sm ghost" data-w="${k}">${l}</button>`).join('')}<button type="button" class="btn-sm" data-w="close">Chào ${esc(S.name)}</button></div></div>`;
    $('app').appendChild(card);
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      const k = b.dataset.w; closeWelcome();
      if (k === 'eat') c.goTo('kitchen'); else if (k === 'bath') c.goTo('bath'); else if (k === 'clinic') c.openClinic();
      else { c.spawn('heart', 3); c.startAction('wave'); }
    });
    card.querySelector('[data-w]:last-child')?.focus({ preventScroll: true });
  }
  if (toured && wasAway(before, Date.now()) && S.id) setTimeout(() => showWelcome(before), 900);
  snap();

  /* ---------- nhắc theo giờ ---------- */
  let acc = { break: 0, water: 0 }, last = Date.now();
  function fire(kind) {
    if (c.isBusy() || S.asleep) return false;
    c.say(pickLine(kind), 5200); c.sfx('ui');
    if (kind === 'break') c.startAction('stretch'); else c.spawn('sweat', 3);
    return true;
  }
  function greetOnce() {
    const today = localDay(), g = get(GREETED), done = g && g.d === today ? g.list : [];
    const which = greetingFor(new Date().getHours(), done, prefs);
    if (!which || c.isBusy() || S.asleep) return;
    c.say(pickLine(which), 5000); c.spawn('sparkle', 2); put(GREETED, { d: today, list: [...done, which] });
  }
  setInterval(() => {
    const now = Date.now(), dt = Math.min(1, (now - last) / 60000); last = now;
    if (document.visibilityState === 'visible') snap();
    if (document.visibilityState !== 'visible' || card) return;
    const r = stepReminders(acc, dt, new Date().getHours(), prefs); acc = r.acc;
    if (r.due && !fire(r.due)) acc = { ...acc, [r.due]: COMPANION[r.due === 'break' ? 'breakEvery' : 'waterEvery'] - 5 }; // đang bận thì nhắc lại sau 5 phút
    greetOnce();
  }, 30000);
  setTimeout(greetOnce, 6500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') snap(); else last = Date.now(); });
  addEventListener('pagehide', snap);
  if (c.dev) { window.__remind = k => fire(k); window.__greet = () => greetOnce(); }
  return { closeWelcome };
}

// Đấu trường giao hữu (bản đấu tập với máy): chọn chiêu theo lượt, thấy khắc hệ, trạng thái và nhật ký trận.
// Luật nằm ở battle.ts / skills.ts. Thua không mất gì; chưa có phần thưởng và chưa ghép với người chơi thật (cần máy chủ).
import { _t } from '../i18n';
import { SPECIES, SPECIES_BY_ID } from './species';
import { ELEMENT_NAMES, KIND_NAMES, STATUS_INFO, elementMult, moveDesc } from './skills';
import { endTurn, fighterOf, pickMove, rngOf, useMove } from './battle';
import { bondLevel } from './bond';
import { sfx } from './audio.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const speed = f => f.spd * (f.status.root ? 0.7 : 1) * (f.haste ? 1.3 : 1);

export function initArena({ ctx, open, head, sheet, getS, thumb }) {
  let st = null;
  function start() {
    const S = getS(), lv = bondLevel(S.bondXp), stage = S.stage === 'elder' ? 'adult' : S.stage, me = fighterOf({ species: S.species, stage: S.stage, form: S.form, bond: lv });
    if (!me) { st = { tooYoung: true }; return; }
    const pool = SPECIES.filter(x => x.id !== S.species), foeSp = pool[Math.floor(Math.random() * pool.length)];
    st = { me, foe: fighterOf({ species: foeSp.id, stage, form: null, bond: lv }), mine: { sp: SPECIES_BY_ID[S.species], name: S.name || SPECIES_BY_ID[S.species].name, look: `pet:${S.species}:${S.stage}:${S.form || ''}` },
      theirs: { sp: foeSp, name: foeSp.name, look: `pet:${foeSp.id}:${stage}:` }, rnd: rngOf((Math.random() * 2 ** 31) | 0), turn: 1, log: [], over: null };
  }
  const multNote = m => (m > 1.3 ? _t('Rất hiệu quả!') : m > 1 ? _t('Hiệu quả') : m < 0.7 ? _t('Kém hiệu quả') : m < 1 ? _t('Hơi kém') : '');
  function lineText(l) {
    const who = l.who === 0 ? st.mine.name : st.theirs.name;
    if (l.skipped) return _t`${who} bị choáng, mất lượt.`;
    let t = _t`${who} dùng ${l.move}`;
    if (l.dmg) t += ' · −' + l.dmg + (l.crit ? ' ' + _t('(chí mạng)') : '') + (multNote(l.mult) ? ' · ' + multNote(l.mult) : '');
    if (l.heal) t += ' · +' + l.heal;
    if (l.status) t += ' · ' + STATUS_INFO[l.status].name;
    return t;
  }
  const card = (f, who) => `<div class="ar-card"><img alt="" src="${thumb(who.look) || ''}" width="96" height="96"><div class="ar-info"><b>${esc(who.name)}</b> <span class="chip">${ELEMENT_NAMES[f.element]}</span>
    <div class="ar-hp" role="img" aria-label="${_t('Thể lực')} ${f.hp}/${f.maxHp}"><i style="width:${Math.round(f.hp / f.maxHp * 100)}%"></i></div><small>${f.hp}/${f.maxHp}${f.guard ? ' · 🛡' : ''}${f.boost ? ' · ⚔' : ''}${Object.keys(f.status).map(k => ' · ' + STATUS_INFO[k].name).join('')}</small></div></div>`;
  function render() {
    const el = sheet('arena');
    if (st.tooYoung) { el.innerHTML = head(_t('Đấu trường'), _t('Đấu tập giao hữu')) + `<p class="hs-note">${_t('Bé còn nhỏ quá. Lên tuổi Nhí là bé học được chiêu đầu tiên và vào Đấu trường được.')}</p>`; return; }
    const { me, foe } = st;
    el.innerHTML = head(_t('Đấu trường'), _t('Đấu tập giao hữu · thua không mất gì')) + `<div class="ar-field">${card(foe, st.theirs)}<p class="ar-vs">${_t`Lượt ${st.turn}`}</p>${card(me, st.mine)}</div>
      <ol class="ar-log" aria-live="polite">${st.log.slice(-3).map(l => `<li>${esc(lineText(l))}</li>`).join('')}</ol>
      ${st.over === null ? `<div class="ar-moves">${me.moves.map((m, i) => { const mu = m.kind === 'attack' ? elementMult(m.element, foe.element) : 1; return `<button type="button" class="ar-move${mu > 1 ? ' good' : mu < 1 ? ' bad' : ''}" data-ar-move="${i}" title="${esc(moveDesc(m))}"><b>${esc(m.name)}</b><small>${KIND_NAMES[m.kind]}${m.power ? ' · ' + m.power : ''}${mu !== 1 ? ' · ×' + mu : ''}</small></button>`; }).join('')}</div>`
        : `<p class="ar-result">${st.over === 0 ? _t('Thắng rồi! Bé vui lắm.') : st.over === 1 ? _t('Thua mất rồi. Không sao, tập thêm là giỏi.') : _t('Hoà nhau!')}</p><button type="button" class="btn-sm big" data-ar="again">${_t('Đấu trận nữa')}</button>`}`;
  }
  function act(i) {
    const { me, foe, rnd } = st, mv = [me.moves[i], pickMove(foe, me, rnd)], f = [me, foe];
    const first = (mv[0].twist === 'first') !== (mv[1].twist === 'first') ? (mv[0].twist === 'first' ? 0 : 1) : speed(me) === speed(foe) ? (rnd() < 0.5 ? 0 : 1) : speed(me) > speed(foe) ? 0 : 1;
    for (const w of [first, 1 - first]) { const a = f[w], d = f[1 - w]; if (a.hp <= 0 || d.hp <= 0) break;
      if (a.status.daze && rnd() < 0.25) { st.log.push({ turn: st.turn, who: w, move: mv[w].name, dmg: 0, heal: 0, mult: 1, crit: false, skipped: true }); continue; }
      st.log.push(useMove(a, d, mv[w], rnd, st.turn, w)); }
    endTurn(me); endTurn(foe); st.turn++;
    if (me.hp <= 0 || foe.hp <= 0 || st.turn > 30) { st.over = foe.hp <= 0 && me.hp > 0 ? 0 : me.hp <= 0 && foe.hp > 0 ? 1 : me.hp / me.maxHp > foe.hp / foe.maxHp ? 0 : me.hp / me.maxHp < foe.hp / foe.maxHp ? 1 : -1; sfx(st.over === 0 ? 'badge' : 'tap'); }
    render();
  }
  sheet('arena').addEventListener('click', e => {
    const m = e.target.closest('[data-ar-move]'); if (m && st && st.over === null) { act(+m.dataset.arMove); return; }
    if (e.target.closest('[data-ar="again"]')) { start(); render(); }
  });
  function openArena() { open('arena'); start(); render(); }
  return { openArena };
}

// Giao diện các tính năng chơi miễn phí (chỉ xu kiếm được): Việc làm & kỹ năng, Thi biểu diễn tuần, quà Lễ hội,
// Album ảnh (lưu trong máy), và hai tab mới của sheet Nhiệm vụ: Sổ mùa và Sticker. Luật ở f2p.ts, dữ liệu qua store.ts.
import { _t } from '../i18n';
import {
  S, cancelJob, claimContest, claimFestival, claimSeason, claimSticker, enterContest, finishJob, jobActive, refreshF2P, refreshJob, refreshProgress, startJob,
} from './store';
import {
  contestReward, FESTIVAL_BY_ID, FESTIVAL_DAYS, FESTIVAL_GIFT, JOB_BY_ID, JOB_HOURS, JOB_MIN_ENERGY, JOB_PER_DAY, jobPay, JOBS, SEASON_XP,
  SKILL_BY_ID, SKILL_MAX_LEVEL, SKILLS, skillLevel, skillXpAt, STICKER_BY_ID, STICKER_COINS, STICKERS,
} from './f2p';
import { ALBUM_MAX, deletePhoto, listPhotos } from './album';
import { localDay } from './rules';
import { viError } from '../lib/errors';
import { sfx } from './audio.js';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hms = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const dmy = d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };

export function initF2P({ ctx, app, $, open, head, COIN_SVG, onChange }) {
  const hours = {}; // giờ đã chọn cho từng việc
  let jobTimer = 0, albumUrls = [];

  /* ---------------- Thẻ "Bé đang đi làm" ở góc màn hình ---------------- */
  const chip = document.createElement('button'); chip.type = 'button'; chip.id = 'job-chip'; chip.className = 'job-chip'; chip.hidden = true; app.appendChild(chip);
  chip.addEventListener('click', () => openJobs());
  function updateChip() {
    const j = S.job; if (!j?.job) { chip.hidden = true; return; }
    const left = Date.parse(j.ends_at) - Date.now(), name = JOB_BY_ID[j.job]?.name || _t('Làm thêm');
    chip.hidden = false; chip.classList.toggle('done', left <= 0);
    chip.textContent = left > 0 ? _t`💼 ${S.name} đang ${name.toLowerCase()} · ${hms(left)}` : _t`💼 ${S.name} làm xong rồi! Nhận lương`;
  }
  setInterval(updateChip, 1000);

  /* ---------------- Việc làm & kỹ năng ---------------- */
  const skillOf = id => S.job?.skills?.find(s => s.skill === id) || { skill: id, xp: 0, level: 0 };
  function skillsHtml() {
    return _t`<h3 class="qh">Kỹ năng của ${esc(S.name)}</h3><ul class="skills">${SKILLS.map(k => {
      const r = skillOf(k.id), max = r.level >= SKILL_MAX_LEVEL, lo = skillXpAt(r.level), hi = skillXpAt(r.level + 1), pct = max ? 100 : (r.xp - lo) / (hi - lo) * 100;
      return _t`<li><span class="sk-ico" aria-hidden="true">${k.icon}</span><div><b>${k.name} · cấp ${r.level}</b><div class="bar-track"><i style="width:${pct}%"></i></div><small>${max ? _t('Cấp cao nhất') : _t`${r.xp - lo}/${hi - lo} kinh nghiệm`}</small></div></li>`;
    }).join('')}</ul><p class="hs-note">Kỹ năng tăng khi chơi mini-game (lượt có xu) và khi đi làm. Kỹ năng cao thì lương cao hơn và thi biểu diễn được điểm cao hơn.</p>`;
  }
  function jobsBody() {
    const j = S.job;
    if (!j) return _t('<p class="hs-note">Đang tải…</p>');
    if (j.job) {
      const d = JOB_BY_ID[j.job], left = Date.parse(j.ends_at) - Date.now(), total = j.hours * 3600000, pct = Math.min(100, (1 - left / total) * 100);
      return _t`<div class="job-now"><b>${esc(S.name)} đang ${esc(d.name.toLowerCase())}</b><span>Ca ${j.hours} giờ · ${left > 0 ? _t`còn <b id="job-left">${hms(left)}</b>` : _t('đã xong!')}</span>
        <div class="bar-track"><i style="width:${pct}%"></i></div>
        <div class="row-btns">${left > 0 ? _t('<button type="button" class="btn-sm ghost" data-job-cancel>Gọi bé về (không có lương)</button>') : _t`<button type="button" class="btn-sm" data-job-finish>${COIN_SVG}Nhận lương</button>`}</div></div>
        <p class="hs-note">Trong lúc làm, bé vắng nhà nên chưa chơi, ăn hay tắm được. Lương trả bằng xu, thêm 5% mỗi cấp kỹ năng của việc đó.</p>` + skillsHtml();
    }
    const why = S.asleep ? _t('Bé đang ngủ.') : S.illness ? _t('Bé đang ốm, khỏi rồi mới đi làm được.') : S.nl < JOB_MIN_ENERGY ? _t('Bé mệt quá, cho bé nghỉ đã.') : j.done_today >= JOB_PER_DAY ? _t`Hôm nay đã làm đủ ${JOB_PER_DAY} ca, mai làm tiếp nhé.` : S.stage === 'egg' ? _t('Bé còn là trứng.') : '';
    return _t`${why ? `<p class="hs-note warn">${why}</p>` : ''}<ul class="jobs">${JOBS.map(d => {
      const lv = skillOf(d.skill).level, h = hours[d.id] || 1;
      return _t`<li><div><b>${esc(d.name)}</b><span>${SKILL_BY_ID[d.skill].icon} ${SKILL_BY_ID[d.skill].name} cấp ${lv} · ${jobPay(d.id, 1, lv)} xu/giờ</span>
        <div class="hours" role="group" aria-label="Chọn số giờ">${JOB_HOURS.map(x => _t`<button type="button" class="chip" data-job-h="${d.id}:${x}" aria-pressed="${x === h}">${x} giờ</button>`).join('')}</div></div>
        <button type="button" class="btn-sm" data-job-go="${d.id}" ${why ? 'disabled' : ''}>Đi làm · ${COIN_SVG}${jobPay(d.id, h, lv)}</button></li>`;
    }).join('')}</ul><p class="hs-note">Mỗi ngày tối đa ${JOB_PER_DAY} ca. Bé vắng nhà trong lúc làm, về thì bấm Nhận lương.</p>` + skillsHtml();
  }
  function renderJobs() { const el = $('jobs'); if (!el || el.hidden) return; el.innerHTML = head(_t('Việc làm & kỹ năng'), _t`${COIN_SVG}<b class="coin-inline">${S.coins.toLocaleString('vi-VN')}</b> xu · hôm nay ${S.job?.done_today ?? 0}/${JOB_PER_DAY} ca`) + `<div class="hs-body">${jobsBody()}</div>`; }
  function openJobs() {
    open('jobs'); renderJobs(); refreshJob().then(renderJobs).catch(() => {});
    clearInterval(jobTimer); jobTimer = setInterval(() => { const el = $('jobs'); if (!el || el.hidden) { clearInterval(jobTimer); return; } const t = $('job-left'); if (t && S.job?.ends_at) { const left = Date.parse(S.job.ends_at) - Date.now(); if (left <= 0) renderJobs(); else t.textContent = hms(left); } }, 1000);
  }

  /* ---------------- Thi biểu diễn tuần ---------------- */
  function contestBody() {
    const c = S.contest; if (!c) return _t('<p class="hs-note">Đang tải…</p>');
    const levels = (S.job?.skills || []).reduce((n, r) => n + r.level, 0);
    const last = c.last && !c.last.claimed ? _t`<div class="contest-last"><b>Kết quả tuần trước: hạng ${c.last.rank}</b><button type="button" class="btn-sm" data-contest-claim>${COIN_SVG}Nhận +${c.last.reward}</button></div>` : '';
    const me = c.entered ? _t`<div class="contest-me"><b>${esc(S.name)} đã dự thi · ${c.score} điểm</b><span>Đang xếp hạng ${c.rank}/${c.entries}. Kết quả chốt vào thứ Hai tuần sau.</span></div>`
      : _t`<div class="contest-me"><b>Thi biểu diễn tuần này</b><span>Điểm = tổng cấp kỹ năng × 10 + cấp Gắn bó × 5 + chút may mắn. Hiện bé có ${levels} cấp kỹ năng.</span><button type="button" class="btn-sm" data-contest-enter>Cho bé dự thi</button></div>`;
    return last + me + _t`<h3 class="qh">Bảng xếp hạng tuần <small>${c.entries} bé dự thi</small></h3>
      <ol class="leader">${c.top.map((r, i) => _t`<li class="${r.mine ? 'mine' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(r.name)}</b><span>${r.score} điểm</span></li>`).join('') || _t('<li><em>Chưa có bé nào dự thi.</em></li>')}</ol>
      <p class="hs-note">Thưởng (xu kiếm được): hạng 1 +${contestReward(1)}, hạng 2–3 +${contestReward(2)}, top 10 +${contestReward(4)}, còn lại +${contestReward(11)}. Luyện kỹ năng bằng mini-game và việc làm để lên hạng.</p>`;
  }
  function renderContest() { const el = $('contest'); if (!el || el.hidden) return; el.innerHTML = head(_t('Thi biểu diễn'), _t('Mỗi tuần một lần, tính điểm theo kỹ năng của bé')) + `<div class="hs-body">${contestBody()}</div>`; }
  function openContest() { open('contest'); renderContest(); Promise.all([refreshProgress(), refreshJob()]).then(renderContest).catch(() => {}); }

  /* ---------------- Lễ hội ---------------- */
  function nextFestival() { const d = localDay(); const n = FESTIVAL_DAYS.find(f => f.from > d); return n ? { ...FESTIVAL_BY_ID[n.id], from: n.from } : null; }
  function renderFestival() {
    const el = $('festival'); if (!el || el.hidden) return; const f = S.festival?.festival, def = f && FESTIVAL_BY_ID[f.id], nx = nextFestival();
    el.innerHTML = head(_t('Lễ hội'), def ? `${def.icon} ${def.name}` : _t('Lịch lễ hội trong năm')) + _t`<div class="hs-body">${def
      ? _t`<div class="fest-card"><span class="fest-ico" aria-hidden="true">${def.icon}</span><b>${def.name}</b><p>${esc(def.line)}</p>${S.festival.claimed ? _t('<span class="pill-ok">Đã nhận quà lễ</span>') : _t`<button type="button" class="btn-sm" data-fest-claim>${COIN_SVG}Nhận quà lễ +${FESTIVAL_GIFT}</button>`}</div>
         <p class="hs-note">Nhận quà lễ còn mở khoá một sticker riêng của dịp này trong Sổ sticker (tab ở Nhiệm vụ).</p>`
      : _t`<p class="hs-note">Hôm nay chưa có lễ hội. ${nx ? _t`Lễ tiếp theo: ${nx.icon} ${nx.name} từ ${dmy(nx.from)}.` : ''}</p>`}
      <h3 class="qh">Các dịp trong năm</h3><ul class="fest-list">${['tet', 'thieunhi', 'trungthu', 'halloween', 'noel', 'nammoi'].map(id => { const d = FESTIVAL_BY_ID[id], n = FESTIVAL_DAYS.find(x => x.id === id && x.to >= localDay()); return `<li><span aria-hidden="true">${d.icon}</span><b>${d.name}</b><small>${n ? `${dmy(n.from)} – ${dmy(n.to)}` : ''}</small></li>`; }).join('')}</ul></div>`;
  }
  function openFestival() { open('festival'); renderFestival(); refreshF2P().then(renderFestival).catch(() => {}); }

  /* ---------------- Album ảnh ---------------- */
  async function renderAlbum() {
    const el = $('album'); if (!el || el.hidden) return;
    albumUrls.forEach(u => URL.revokeObjectURL(u)); albumUrls = [];
    const ps = await listPhotos();
    el.innerHTML = head(_t('Album ảnh'), _t`${ps.length}/${ALBUM_MAX} ảnh · lưu ngay trong máy này`) + _t`<div class="hs-body">${ps.length
      ? _t`<div class="album">${ps.map(p => { const u = URL.createObjectURL(p.blob); albumUrls.push(u); return _t`<figure><img src="${u}" alt="Ảnh ở ${esc(p.place)}" loading="lazy"><figcaption>${esc(p.place)} · ${new Date(p.at).toLocaleDateString('vi-VN')}</figcaption>
          <div class="row-btns"><a class="btn-sm ghost" href="${u}" download="hatchday-${p.id}.png">Lưu</a><button type="button" class="btn-sm ghost" data-album-del="${p.id}">Xoá</button></div></figure>`; }).join('')}</div>`
      : _t('<p class="hs-note">Chưa có ảnh nào. Mở Chỉ số → Chụp ảnh, ảnh sẽ tự lưu vào album.</p>')}
      <p class="hs-note">Album chỉ lưu trong trình duyệt này (không tải lên máy chủ). Xoá dữ liệu trình duyệt sẽ mất album, nhớ bấm Lưu ảnh nào bạn thích.</p></div>`;
  }
  function openAlbum() { open('album'); renderAlbum(); }

  /* ---------------- Sổ mùa và Sticker (tab trong sheet Nhiệm vụ) ---------------- */
  const seasonReady = () => !!S.season && S.season.tiers.some(t => t.ready && !t.claimed);
  const stickerReady = () => S.stickers.some(s => !s.claimed && s.progress >= s.target);
  function seasonHtml() {
    const s = S.season; if (!s) return _t('<p class="hs-note">Đang tải…</p>');
    const next = s.tiers.find(t => !t.ready), [y, m] = s.season.split('-');
    return _t`<h3 class="qh">Sổ mùa tháng ${+m}/${y} <small>${s.xp} điểm mùa${next ? _t` · bậc tiếp: ${next.xp}` : _t(' · đủ cả 10 bậc!')}</small></h3>
      <div class="bar-track season-bar"><i style="width:${Math.min(100, s.xp / s.tiers[s.tiers.length - 1].xp * 100)}%"></i></div>
      <ul class="quests season">${s.tiers.map(t => _t`<li class="${t.claimed ? 'got' : t.ready ? 'ready' : ''}"><div><b>Bậc ${t.tier + 1}</b><span>${t.xp} điểm mùa</span></div>
        ${t.claimed ? _t('<span class="pill-ok">Đã nhận</span>') : `<button type="button" class="btn-sm" data-season="${t.tier}" ${t.ready ? '' : 'disabled'}>${COIN_SVG}+${t.coins}</button>`}</li>`).join('')}</ul>
      <p class="hs-note">Sổ mùa miễn phí, đổi mới đầu mỗi tháng. Điểm mùa: mỗi hoạt động khác nhau mỗi ngày tối đa ${SEASON_XP.activityCap} lần × ${SEASON_XP.activity}, mỗi ca làm +${SEASON_XP.job}, hẹn chơi +${SEASON_XP.playdate}, dự thi +${SEASON_XP.contest}, nhận quà lễ +${SEASON_XP.festival}.</p>`;
  }
  function stickersHtml() {
    const got = S.stickers.filter(s => s.claimed).length;
    return _t`<h3 class="qh">Sổ sticker <small>${got}/${STICKERS.length} đã dán</small></h3>
      <ul class="stickers">${STICKERS.map(d => { const s = S.stickers.find(x => x.id === d.id) || { progress: 0, target: d.target, claimed: false }, ready = !s.claimed && s.progress >= s.target;
        return _t`<li class="sticker${s.claimed ? ' got' : ready ? ' ready' : ''}"><span class="st-ico" aria-hidden="true">${d.icon}</span><b>${esc(d.name)}</b><span class="b-desc">${esc(d.desc)}</span>
          ${s.claimed ? _t('<span class="pill-ok">Đã dán</span>') : ready ? _t`<button type="button" class="btn-sm" data-sticker="${d.id}">${COIN_SVG}Dán +${STICKER_COINS}</button>` : `<span class="b-num">${s.progress}/${s.target}</span>`}</li>`; }).join('')}</ul>`;
  }

  /* ---------------- Bấm nút ---------------- */
  const reward = r => { sfx('coin'); ctx.popText?.(`+${r} xu`, '#a8742e'); ctx.buzz?.(12); ctx.spawn?.('sparkle', 3); };
  app.addEventListener('click', async e => {
    const t = e.target;
    const hb = t.closest('[data-job-h]'); if (hb) { const [id, h] = hb.dataset.jobH.split(':'); hours[id] = +h; renderJobs(); return; }
    const go = t.closest('[data-job-go]');
    if (go) { go.disabled = true; const id = go.dataset.jobGo, r = await startJob(id, hours[id] || 1); if ('error' in r) ctx.toast(viError(r.error)); else { ctx.say?.(JOB_BY_ID[id].line, 2600); sfx('badge'); ctx.onJob?.(); } renderJobs(); updateChip(); return; }
    if (t.closest('[data-job-finish]')) { const r = await finishJob(); if ('error' in r) ctx.toast(viError(r.error)); else { reward(r.pay); ctx.toast(_t`${S.name} đã về! Lương +${r.pay} xu, ${SKILL_BY_ID[r.skill].name} +${r.skill_xp} kinh nghiệm.`); ctx.onJob?.(); } renderJobs(); updateChip(); return; }
    if (t.closest('[data-job-cancel]')) { const r = await cancelJob(); if ('error' in r) ctx.toast(viError(r.error)); else { ctx.toast(_t`${S.name} đã về nhà.`); ctx.onJob?.(); } renderJobs(); updateChip(); return; }
    const ce = t.closest('[data-contest-enter]'); if (ce) { ce.disabled = true; const r = await enterContest(); if ('error' in r) ctx.toast(viError(r.error)); else { sfx('cheer'); ctx.startAction?.('dance'); } renderContest(); return; }
    if (t.closest('[data-contest-claim]')) { const r = await claimContest(); if ('error' in r) ctx.toast(viError(r.error)); else reward(r.reward); renderContest(); return; }
    if (t.closest('[data-fest-claim]')) { const r = await claimFestival(); if ('error' in r) ctx.toast(viError(r.error)); else { reward(r.reward); ctx.spawn?.('heart', 3); } renderFestival(); onChange?.(); return; }
    const sb = t.closest('[data-season]'); if (sb) { sb.disabled = true; const r = await claimSeason(+sb.dataset.season); if ('error' in r) ctx.toast(viError(r.error)); else reward(r.reward); onChange?.(); return; }
    const st = t.closest('[data-sticker]'); if (st) { st.disabled = true; const r = await claimSticker(st.dataset.sticker); if ('error' in r) ctx.toast(viError(r.error)); else { reward(r.reward); ctx.toast(_t`Đã dán sticker ${STICKER_BY_ID[st.dataset.sticker].icon} vào sổ!`); } onChange?.(); return; }
    const ad = t.closest('[data-album-del]'); if (ad) { await deletePhoto(+ad.dataset.albumDel); renderAlbum(); }
  });

  return {
    openJobs, openContest, openFestival, openAlbum, seasonHtml, stickersHtml, seasonReady, stickerReady, updateChip,
    festivalReady: () => !!S.festival?.festival && !S.festival.claimed,
    jobTileText: () => (jobActive() ? _t`${S.name} đang đi làm` : _t`Hôm nay ${S.job?.done_today ?? 0}/${JOB_PER_DAY} ca · ${(S.job?.skills || []).reduce((n, r) => n + r.level, 0)} cấp kỹ năng`),
    jobReady: () => !!S.job?.job && Date.parse(S.job.ends_at) <= Date.now(),
    contestReady: () => !!S.contest?.last && !S.contest.last.claimed,
    skillLevel,
  };
}

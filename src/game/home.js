// Nhà của bé: bố cục phòng, chế độ trang trí, cửa hàng, tủ đồ, nhiệm vụ ngày (theo GDD).
import { _t, LOCALE } from '../i18n';
import { SELL, sellPrice, BY_ID, DEFAULT_LAYOUT, FOOD_BY_ID, FOOD_GROUPS, FOOD_STOCK, FOODS, FRIDGE, GRID, ITEMS, PET_ZONE, RARITY, RECIPES, SET_LINES, SLOTS, TAGS, THEMES, WINDOW_CELLS } from './catalog';
import { BALANCED_BONUS, BALANCED_GROUPS, tastesLine } from './nutrition';
import { FOOD_SVG } from './food.js';
import { BADGE_ICONS } from './badge-icons';
import { ACTIVITY_LABEL, BADGES, BADGE_BY_ID, EXPLORE_TIERS } from './world-activity';
import { activeSets, buyable, canPlace, cellsOf, comfortLevel, comfortScore, footprint, placedCount, QUEST_BONUS, QUEST_POOL, WEEKLY_POOL } from './layout';
import { makeDecor } from './decor3d.js';
import { disposePet } from './pet3d.js';
import { makeFitter } from './fit.js';
import { sfx } from './audio.js';
import { clinicBody } from './clinic.js';
import { initMap } from './places/map.js';
import { initSocial } from './social-ui.js';
import { priceOf, salePct } from './pricing';
import { setIsolation } from './store';
import { initAds } from './ads-ui.js';
import { initToys } from './toys-ui.js';
import { initF2P } from './f2p-ui.js';
import { initSupport } from './support-ui.js';
import { initArena } from './arena-ui.js';
import { refreshProgress } from './store';
import { SPACES } from './places/registry';
import { bondLevel } from './bond';
import { ILLNESS_BY_ID, MEDICINE_BY_ID } from './health';
import { FORMS, RARITIES, REGIONS, SPECIES, SPECIES_BY_ID, STAGES } from './species';
import { describe as describePersona, normalize as normalizePersona } from './personality';
import { viError } from '../lib/errors';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const COIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffd36e" stroke="#a8742e" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4" fill="none" stroke="#a8742e" stroke-width="1.8" stroke-linecap="round"/></svg>';

export function initHome(ctx) {
  const { THREE, scene, camera, canvas, room, store, $ } = ctx;
  const { S } = store;
  const D = makeDecor(ctx);
  const fitter = makeFitter(THREE);
  const app = $('app');

  /* ===================== Phòng theo bố cục ===================== */
  const itemsRoot = new THREE.Group(); room.add(itemsRoot);
  let placed = []; // { p, group, item }
  const backTexRepeat = [6, 3], leftTexRepeat = [4, 3], floorRepeat = [3 * 14 / 9, 3 * 13 / 7]; // sàn kéo dài ra phía trước (xem FLOOR trong game.js) nên số lần lặp tăng theo

  function worldOf(p) {
    const it = BY_ID[p.id];
    if (it.layer === 'wall') return new THREE.Vector3(GRID.x0 + p.c + (it.w || 1) / 2, GRID.wallY0 + p.r + (it.d || 1) / 2, -3.5);
    const [w, d] = footprint(it, p.rot);
    return new THREE.Vector3(GRID.x0 + p.c + w / 2, it.layer === 'rug' ? 0.004 * (1 + (placed.length % 5)) : 0, GRID.z0 + p.r + d / 2);
  }
  function placeGroup(g, p) {
    g.position.copy(worldOf(p));
    g.rotation.y = BY_ID[p.id].layer === 'wall' ? 0 : -p.rot * Math.PI / 2;
  }
  function applySurfaces(layout) {
    const w = D.surface('wall', layout.wallpaper), f = D.surface('floor', layout.flooring);
    const set = (mesh, s, rep) => { const t = s.map.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; mesh.material.color.set(s.color); mesh.material.map = t; mesh.material.needsUpdate = true; };
    set(ctx.homeWalls[0], w, backTexRepeat); set(ctx.homeWalls[1], w, leftTexRepeat); set(ctx.homeFloor, f, floorRepeat);
  }
  function renderRoom(layout) {
    placed.forEach(x => itemsRoot.remove(x.group)); placed = [];
    layout.items.forEach(p => {
      if (!BY_ID[p.id]) return;
      const g = D.build(p.id); placeGroup(g, p); ctx.applyShadows(g); itemsRoot.add(g);
      placed.push({ p, group: g, item: BY_ID[p.id] });
    });
    applySurfaces(layout);
  }

  /* ===================== Trang phục trên thú ===================== */
  const outfitRoot = new THREE.Group(); ctx.pivot.add(outfitRoot);
  let outfitKey = '';
  let outfitParts = null;
  function renderOutfit(o) {
    const parts = ctx.getPetParts();
    const k = JSON.stringify(o || {}); if (k === outfitKey && parts === outfitParts) return; outfitKey = k; outfitParts = parts;
    outfitRoot.clear();
    let hideTop = false;
    Object.values(o || {}).forEach(id => { const it = BY_ID[id]; if (!it) return; const g = fitter.fit(D.buildOutfit(id), it, parts?.sockets); if (g.userData.fit?.hideTop) hideTop = true; outfitRoot.add(g); });
    if (parts?.top) parts.top.visible = !hideTop;
  }

  if (/[?&]dev\b/.test(location.search)) window.__wear = o => renderOutfit(o); // thử đồ nhanh khi kiểm tra hình (chỉ ở chế độ dev)

  /* ===================== Phản ứng của bé ===================== */
  const likes = () => new Set(S.likes), liked = it => (it.tags || []).some(t => likes().has(t)), disliked = it => (it.tags || []).includes(S.dislike);
  function reactTo(it, kind) {
    if (liked(it)) { ctx.setTemp('love', 1800); ctx.spawn('heart', 3, 0.8); ctx.say(kind === 'outfit' ? _t`Mình thích ${it.name.toLowerCase()} ghê!` : _t`Ơ, ${it.name.toLowerCase()}! Mình thích cái này lắm.`, 2800); }
    else if (disliked(it)) { ctx.setTemp('sulky', 1600); ctx.say(kind === 'outfit' ? _t('Cái này vướng víu quá à…') : _t`Mình không thích ${it.name.toLowerCase()} lắm…`, 2600); }
    else { ctx.setTemp('excited', 900); ctx.spawn('sparkle', 2); }
  }
  /** Gợi ý chỗ bé tự đi tới chơi khi rảnh (dùng trong hành vi rảnh rỗi). */
  function pickVisit() {
    if (ctx.getArea() !== 'home' || editing) return null;
    const cands = placed.filter(x => x.item.layer === 'floor' && (x.item.tags || []).some(t => ['choi', 'sach', 'retro', 'mem', 'sang', 'cay'].includes(t)));
    if (!cands.length) return null;
    const x = cands[Math.floor(Math.random() * cands.length)], pos = worldOf(x.p), [, d] = footprint(x.item, x.p.rot);
    const tz = Math.min(2.6, pos.z + d / 2 + 0.7);
    const tags = x.item.tags || [];
    return {
      x: pos.x, z: tz,
      then: () => {
        if (tags.includes('choi')) { ctx.startAction('hop'); ctx.say(_t`Chơi ${x.item.name.toLowerCase()} vui ghê!`, 2200); }
        else if (tags.includes('sach')) { ctx.say(_t('Để mình đọc sách một chút…'), 2200); ctx.setTemp('sleepy', 1800); }
        else if (tags.includes('retro')) { ctx.startAction('dance'); ctx.say(_t('Hồi xưa mấy món này hot lắm đó!'), 2400); }
        else if (tags.includes('mem')) { ctx.setTemp('love', 1600); ctx.spawn('heart', 2); }
        else if (liked(x.item)) { ctx.setTemp('love', 1400); ctx.spawn('heart', 1); }
        else ctx.spawn('sparkle', 1);
      },
    };
  }

  /* ===================== Thanh trên: xu ===================== */
  const coinBtn = $('btn-coins');
  const renderCoins = () => { $('coin-n').textContent = S.coins.toLocaleString(LOCALE); };
  coinBtn?.addEventListener('click', () => openShop('market'));

  /* ===================== Bảng (sheet) dùng chung ===================== */
  function sheet(id, cls = '') {
    let el = $(id);
    if (!el) { el = document.createElement('section'); el.id = id; el.className = 'sheet hsheet ' + cls; el.hidden = true; el.setAttribute('aria-label', id); app.appendChild(el); }
    return el;
  }
  const sheets = ['house', 'shop', 'wardrobe', 'quests', 'dex', 'family', 'cooking', 'clinic', 'map', 'sell', 'social', 'visit', 'gift', 'spaces', 'ads', 'toys', 'jobs', 'contest', 'festival', 'album', 'support'];
  function closeAll(except) { sheets.forEach(s => { if (s !== except && $(s)) $(s).hidden = true; }); ctx.setZoom(0); $('a-house').setAttribute('aria-pressed', 'false'); }
  function open(id) { ctx.closeGameSheets(); closeAll(id); const el = sheet(id); el.hidden = false; $('a-house').setAttribute('aria-pressed', String(id !== 'none')); el.querySelector('button, input')?.focus({ preventScroll: true }); return el; }
  const head = (title, sub = '') => _t`<header class="hs-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button type="button" class="hs-close" data-close aria-label="Đóng">✕</button></header>`;
  app.addEventListener('click', e => { if (e.target.closest('[data-close]')) { closeAll(); $('a-house').focus(); } });
  const f2p = initF2P({ ctx, app, $, open, head, COIN_SVG, onChange: () => { if ($('quests') && !$('quests').hidden) renderQuests(); } });
  initSupport({ ctx, $, open, head });
  const arena = initArena({ ctx, closeAll: () => closeAll(), getS: () => S });

  /* ---------- Menu Nhà ---------- */
  const worldReady = () => !!S.world && (S.world.explore.some(t => t.ready && !t.claimed) || S.world.badges.some(b => !b.claimed && b.progress >= b.target));
  const questReady = () => S.quests.some(q => !q.claimed && q.progress >= q.target) || (S.questBonus.ready && !S.questBonus.claimed) || S.weekly.some(q => !q.claimed && q.progress >= q.target) || worldReady() || f2p.seasonReady() || f2p.stickerReady();
  function openHouse() {
    const el = open('house');
    el.innerHTML = head(_t('Nhà của bé'), _t`Thoải mái cấp ${S.comfort} · ${S.coins.toLocaleString(LOCALE)} xu`) + _t`<div class="tiles">
      <button type="button" class="tile${S.illness ? ' ready' : ''}" data-go="map"><b>Bản đồ</b><span>Chợ, bệnh viện, tiệm may, thư viện…</span></button>
      <button type="button" class="tile${social.badge() ? ' ready' : ''}" data-go="social"><b>Bạn bè &amp; thư</b><span>${esc(social.tileText())}</span></button>
      <button type="button" class="tile${SPACES.some(p => bondLevel(S.bondXp) >= p.unlock) ? ' ready' : ''}" data-go="spaces"><b>Không gian của bé</b><span>${SPACES.filter(p => bondLevel(S.bondXp) >= p.unlock).length}/${SPACES.length} nơi đã mở</span></button>
      <button type="button" class="tile" data-go="decor"><b>Trang trí phòng</b><span>Đặt, xoay, cất đồ</span></button>
      <button type="button" class="tile" data-go="shop"><b>Cửa hàng</b><span>Thức ăn, đồ trang trí, trang phục</span></button>
      <button type="button" class="tile" data-go="wardrobe"><b>Tủ đồ</b><span>Trang phục cho bé</span></button>
      <button type="button" class="tile" data-go="arena"><b>Đấu trường</b><span>Đấu tập giao hữu, thử chiêu thức</span></button>
      <button type="button" class="tile${questReady() ? ' ready' : ''}" data-go="quests"><b>Nhiệm vụ</b><span>${S.quests.filter(q => q.claimed).length}/${S.quests.length} hôm nay · ${S.weekly.filter(q => q.claimed).length}/${S.weekly.length} tuần này</span></button>
      ${S.festival?.festival ? _t`<button type="button" class="tile${f2p.festivalReady() ? ' ready' : ''}" data-go="festival"><b>Lễ hội</b><span>Đang có lễ hội! Nhận quà lễ</span></button>` : ''}
      <button type="button" class="tile${f2p.jobReady() ? ' ready' : ''}" data-go="jobs"><b>Việc làm & kỹ năng</b><span>${esc(f2p.jobTileText())}</span></button>
      <button type="button" class="tile${f2p.contestReady() ? ' ready' : ''}" data-go="contest"><b>Thi biểu diễn</b><span>${S.contest?.entered ? _t`Tuần này: hạng ${S.contest.rank}` : _t('Mỗi tuần một lần, theo kỹ năng')}</span></button>
      <button type="button" class="tile" data-go="album"><b>Album ảnh</b><span>Ảnh chụp cùng bé</span></button>
      <button type="button" class="tile${S.garden?.plots.some(p => p.ready) ? ' ready' : ''}" data-go="garden"><b>Vườn rau</b><span>${S.garden ? _t`Ra vườn · ${S.garden.plots.length}/${S.garden.parcels.reduce((n, p) => n + p.size, 0)} ô đang trồng` : _t('Ra vườn trồng rau')}</span></button>
      <button type="button" class="tile${S.illness ? ' ready' : ''}" data-go="clinic"><b>Sức khoẻ</b><span>${S.illness ? _t`Đang ${esc(ILLNESS_BY_ID[S.illness].name.toLowerCase())}` : _t('Thuốc, phòng khám, sổ bệnh')}</span></button>
      <button type="button" class="tile" data-go="cooking"><b>Nấu ăn</b><span>${RECIPES.length} công thức</span></button>
      <button type="button" class="tile" data-go="family"><b>Gia phả</b><span>${S.lineage.length > 1 ? _t`${S.lineage.length} đời của ${esc(S.family)}` : _t`Đời ${S.generation} của ${esc(S.family)}`}</span></button>
      <button type="button" class="tile" data-go="dex"><b>Sổ loài</b><span>Đã gặp ${S.seen.length}/${SPECIES.length} loài</span></button>
      <button type="button" class="tile" data-go="settings"><b>Cài đặt</b><span>Hình ảnh, âm thanh, nhắc nhở, hỗ trợ</span></button></div>`;
    scrollWrap(el);
  }
  /* Hàng tab cuộn ngang: mờ dần ở mép còn nội dung để người chơi biết vuốt thêm */
  const hint = el => { el.classList.toggle('fade-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 4); el.classList.toggle('fade-l', el.scrollLeft > 4); };
  app.addEventListener('scroll', e => { if (e.target.classList?.contains('tabs-row')) hint(e.target); }, true);
  let hintRaf = 0; // gộp nhiều thay đổi DOM trong một khung hình
  new MutationObserver(() => { if (hintRaf) return; hintRaf = requestAnimationFrame(() => { hintRaf = 0; app.querySelectorAll('.tabs-row').forEach(hint); }); }).observe(app, { childList: true, subtree: true });
  $('a-house').addEventListener('click', () => { ctx.hideHint(); const hs = $('house'); if (hs && !hs.hidden) { closeAll(); return; } openHouse(); });
  app.addEventListener('click', e => {
    const b = e.target.closest('.tile'); if (!b) return;
    ({ arena: () => arena.openArena(), decor: () => enterEdit(), shop: () => openShop('market'), wardrobe: openWardrobe, quests: openQuests, dex: () => openDex(), family: openFamily, garden: () => { closeAll(); ctx.goTo('garden'); }, cooking: openCooking, clinic: () => openClinic(), map: () => worldMap.open(), social: () => social.open(), spaces: () => openSpaces(), jobs: f2p.openJobs, settings: () => { closeAll(); ctx.openSettings?.(); }, contest: f2p.openContest, album: f2p.openAlbum, festival: f2p.openFestival })[b.dataset.go]();
  });

  /* ---------- Ảnh thu nhỏ 3D ---------- */
  let thumbR = null; const thumbs = {};
  function thumb(id) {
    if (thumbs[id]) return thumbs[id];
    try {
      if (!thumbR) {
        thumbR = { r: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), s: new THREE.Scene(), c: new THREE.PerspectiveCamera(30, 1, 0.05, 50) };
        thumbR.r.setSize(160, 160); thumbR.r.setPixelRatio(1);
        thumbR.s.add(new THREE.HemisphereLight('#fff6fb', '#b9a3e3', 1.8)); const dl = new THREE.DirectionalLight('#fff1dc', 2.2); dl.position.set(3, 6, 5); thumbR.s.add(dl);
      }
      let g;
      if (id.startsWith('pet:')) {
        const [, species, stage, form, wear] = id.split(':'); g = new THREE.Group();
        const parts = ctx.petBuilder.build(g, { species, stage, form: form || null, genes: {}, face: true });
        (wear ? wear.split(',') : []).forEach(w => { const it = BY_ID[w]; if (!it) return; const o = fitter.fit(D.buildOutfit(w), it, parts.sockets); if (o.userData.fit?.hideTop) parts.top.visible = false; g.add(o); });
      }
      else { const it = BY_ID[id]; g = it.kind === 'outfit' ? D.buildOutfit(id) : it.layer === 'wallpaper' || it.layer === 'flooring' ? swatch(it) : D.build(id); if (it.kind === 'outfit') g.position.set(0, 0, 0); }
      thumbR.s.add(g);
      if (id.startsWith('pet:')) { const st = id.split(':')[2], k = { baby: 0.78, child: 0.86, teen: 0.94 }[st] || 1; g.scale.setScalar(k); thumbR.c.position.set(3.2, 2.05, 4.4); thumbR.c.lookAt(0, 1.22, -0.15); }
      else {
        const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
        thumbR.c.position.copy(c).add(new THREE.Vector3(0.9, 0.75, 1.6).normalize().multiplyScalar(size * 1.75)); thumbR.c.lookAt(c);
      }
      thumbR.r.render(thumbR.s, thumbR.c);
      thumbs[id] = thumbR.r.domElement.toDataURL('image/png');
      thumbR.s.remove(g); if (id.startsWith('pet:')) disposePet(g);
    } catch (e) { thumbs[id] = ''; }
    return thumbs[id];
  }
  function swatch(it) {
    const s = D.surface(it.layer === 'wallpaper' ? 'wall' : 'floor', it.id);
    const t = s.map.clone(); t.repeat.set(1, 1); t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, it.layer === 'wallpaper' ? 1 : 0.1, it.layer === 'wallpaper' ? 0.1 : 1), new THREE.MeshToonMaterial({ color: s.color, map: t, gradientMap: ctx.grad }));
    const g = new THREE.Group(); g.add(m); return g;
  }
  function fillThumbs(root) {
    const imgs = [...root.querySelectorAll('img[data-thumb]')];
    let i = 0;
    const step = () => { const t0 = performance.now(); while (i < imgs.length && performance.now() - t0 < 12) { const im = imgs[i++]; im.src = thumb(im.dataset.thumb) || ''; } if (i < imgs.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const card = (it, body) => `<article class="card-item r-${it.rarity}"><img data-thumb="${it.id}" alt="" width="80" height="80"><div class="ci-name">${esc(it.name)}</div>${body}</article>`;

  /* ---------- Sức khoẻ: tình trạng, thuốc, phòng khám, sổ bệnh ---------- */
  const clinicOpen = new Set();
  function openClinic(section) { open('clinic'); renderClinic(); if (section) setTimeout(() => $('cl-' + section)?.scrollIntoView({ block: 'start' }), 60); store.refreshHealth().then(() => { if (!$('clinic').hidden) renderClinic(); }).catch(() => {}); }
  function renderClinic(el = $('clinic')) {
    el.innerHTML = head(_t('Sức khoẻ'), _t`${esc(S.name)} · ${S.illness ? _t('đang ốm') : _t('khoẻ mạnh')} · ${S.coins.toLocaleString(LOCALE)} xu`) + clinicBody(S, store.healthNow(), Date.now(), COIN_SVG);
    el.querySelectorAll('details').forEach((d, i) => { d.open = clinicOpen.has(i); d.addEventListener('toggle', () => { d.open ? clinicOpen.add(i) : clinicOpen.delete(i); }); });
  }
  app.addEventListener('click', async e => {
    const iso = e.target.closest('[data-iso]');
    if (iso) { iso.disabled = true; const err = await setIsolation(iso.dataset.iso === '1'); if (err) ctx.toast(viError(err)); else ctx.toast(iso.dataset.iso === '1' ? _t('Bé đang cách ly, tạm thời không vào nơi chung.') : _t('Đã tắt cách ly.')); renderClinic?.(); return; }
    const buy = e.target.closest('[data-buy-med]'), use = e.target.closest('[data-use-med]'), cl = e.target.closest('[data-clinic]');
    if (!buy && !use && !cl) return;
    (buy || use || cl).disabled = true;
    if (buy) {
      const m = MEDICINE_BY_ID[buy.dataset.buyMed], err = await store.buyMedicine(m.id, 1);
      if (err) ctx.toast(viError(err)); else { sfx('buy'); ctx.buzz(10); ctx.toast(_t`Đã mua ${m.name}.`); }
    } else if (use) {
      const m = MEDICINE_BY_ID[use.dataset.useMed], err = await store.useMedicine(m.id);
      if (err) ctx.toast(viError(err)); else { sfx('wake'); ctx.buzz(14); ctx.spawn('sparkle', 5); ctx.say(_t('Mình thấy đỡ hơn nhiều rồi! Cảm ơn bạn nha.'), 3200); ctx.toast(_t`${S.name} đã khỏi bệnh.`); }
    } else {
      const err = await store.visitClinic();
      if (err) ctx.toast(viError(err)); else { sfx('wake'); ctx.buzz(14); ctx.spawn('sparkle', 6); ctx.spawn('heart', 3); ctx.say(_t('Bác sĩ khám xong rồi, mình khoẻ lại rồi nè!'), 3200); ctx.toast(_t`${S.name} đã khỏi bệnh.`); }
    }
    if (!$('clinic').hidden) renderClinic();
  });


  /* ---------- Không gian của bé: mở theo cấp Gắn bó ---------- */
  function openSpaces() {
    const el = open('spaces'), lvl = bondLevel(S.bondXp);
    el.innerHTML = head(_t('Không gian của bé'), _t('Mở thêm khi tăng cấp Gắn bó')) + `<div class="hs-body"><ul class="soc-list">${SPACES.map(p => `<li class="soc-row"><div class="soc-info"><b>${esc(p.name)}</b><small>${esc(p.blurb)}</small></div><div class="soc-act">${lvl >= p.unlock ? _t`<button type="button" class="btn-sm" data-space="${p.id}">Đi tới</button>` : _t`<span class="pill-ok" style="background:#eee;color:#666">Gắn bó cấp ${p.unlock}</span>`}</div></li>`).join('')}</ul></div>`;
  }
  app.addEventListener('click', e => { const b = e.target.closest('[data-space]'); if (b) { closeAll(); ctx.goTo(b.dataset.space); } });

  /* ---------- Thu mua nông sản (Chợ) ---------- */
  function openSell() { open('sell'); renderSell(); store.refreshSell().then(() => { if (!$('sell').hidden) renderSell(); }).catch(() => {}); }
  function renderSell(el = $('sell')) {
    const left = Math.max(0, SELL.dailyCap - S.soldToday), have = FOODS.filter(f => (S.owned[f.id] || 0) > 0);
    el.innerHTML = head(_t('Thu mua nông sản'), _t`Hôm nay đã bán ${S.soldToday}/${SELL.dailyCap} xu · còn ${left} xu`) + _t`<div class="hs-body">${have.length ? `<ul class="sell-list">${have.map(f => {
      const n = S.owned[f.id], unit = sellPrice(f.price), maxN = Math.min(n, SELL.maxQty, Math.floor(left / Math.max(unit, 1)));
      return _t`<li><span class="food-ic">${FOOD_SVG[f.id]}</span><div><b>${esc(f.name)}</b><small>Có ${n} · ${unit} xu/phần</small></div><div class="sell-act"><button type="button" class="btn-sm" data-sell="${f.id}" data-qty="1" ${maxN >= 1 ? '' : 'disabled'}>Bán 1</button><button type="button" class="btn-sm ghost" data-sell="${f.id}" data-qty="${Math.max(maxN, 1)}" ${maxN >= 2 ? '' : 'disabled'}>Bán ${maxN >= 2 ? maxN : _t('hết')} · ${unit * Math.max(maxN, 0)}</button></div></li>`;
    }).join('')}</ul>` : _t('<p class="hs-note">Bé chưa có món nào để bán. Trồng rau ở vườn rồi mang ra chợ nhé.</p>')}<p class="hs-note">Chợ thu mua bằng ${Math.round(SELL.ratio * 100)}% giá mua, tối đa ${SELL.dailyCap} xu mỗi ngày. Không thu mua món nấu.</p></div>`;
  }
  app.addEventListener('click', async e => {
    const b = e.target.closest('[data-sell]'); if (!b) return;
    b.disabled = true; const r = await store.sellFood(b.dataset.sell, +b.dataset.qty);
    if ('error' in r) ctx.toast(viError(r.error)); else { sfx('coin'); ctx.buzz(10); ctx.toast(_t`Đã bán, nhận ${r.got} xu.`); }
    renderSell();
  });
  const ads = initAds({ ctx, store, head, open, app, $ });
  const toys = initToys({ ctx, head, open, app, $ });
  const social = initSocial({ ctx, S, store, esc, head, open, closeAll, thumb, fillThumbs, app, $, onChange: () => sync() });
  const worldMap = initMap({ app, $, esc, head, open, closeAll, decor: () => (ctx.events && ctx.events.decor ? ctx.events.decor() : null), S, bondLevel: () => bondLevel(S.bondXp), goTo: ctx.goTo, toast: ctx.toast, getArea: ctx.getArea, alerts: () => ({ hospital: !!S.illness }) });

  /* ---------- Nấu ăn: hai nguyên liệu thành một món ngon hơn, thuộc hai nhóm dinh dưỡng ---------- */
  /** Nấu ăn chỉ mở khi bé đã đứng trước bếp lò (force); bấm từ nơi khác thì đi vào Bếp trước (game.js: goCook). */
  function openCooking(force) { if (force !== true && !(ctx.atStove && ctx.atStove())) { ctx.goCook(); return; } open('cooking'); renderCooking(); }
  function renderCooking(el = $('cooking')) {
    // món nấu được ngay lên đầu, giữ nguyên thứ tự công thức trong mỗi nhóm
    const can = r => (S.owned[r.a] || 0) >= 1 && (S.owned[r.b] || 0) >= 1 && (S.owned[r.dish] || 0) < FOOD_STOCK.max;
    const list = [...RECIPES.filter(can), ...RECIPES.filter(r => !can(r))], ready = list.filter(can).length;
    el.innerHTML = head(_t('Nấu ăn'), _t`${ready ? _t`Nấu được ${ready}/${RECIPES.length} món. ` : ''}Mỗi lần nấu dùng một phần của mỗi nguyên liệu`) + _t`<div class="hs-body"><ul class="recipes">${list.map(r => {
      const A = FOOD_BY_ID[r.a], B = FOOD_BY_ID[r.b], dish = FOOD_BY_ID[r.dish], ha = S.owned[r.a] || 0, hb = S.owned[r.b] || 0, hd = S.owned[r.dish] || 0;
      const ok = ha >= 1 && hb >= 1 && hd < FOOD_STOCK.max;
      return _t`<li><div class="rc-ing"><span>${FOOD_SVG[r.a]}<small class="${ha ? '' : 'lack'}">${esc(A.name)} ×${ha}</small></span><i>+</i><span>${FOOD_SVG[r.b]}<small class="${hb ? '' : 'lack'}">${esc(B.name)} ×${hb}</small></span><i>→</i><span class="dish">${FOOD_SVG[r.dish]}<b>${esc(dish.name)}</b><small>có ${hd}</small></span></div>
        <div class="rc-foot"><span class="ci-meta">+${dish.no} No · +${dish.vui} Vui · ${FOOD_GROUPS[dish.group].name} + ${FOOD_GROUPS[dish.group2].name} · tươi</span><button type="button" class="btn-sm" data-cook="${r.id}" ${ok ? '' : 'disabled'}>Nấu</button></div></li>`;
    }).join('')}</ul><p class="hs-note">Món nấu ngon hơn và tính cho hai nhóm dinh dưỡng, dễ ăn cân bằng. Món nấu là thức ăn tươi nên để lâu sẽ hỏng.</p></div>`;
  }
  app.addEventListener('click', async e => {
    const b = e.target.closest('[data-cook]'); if (!b) return;
    b.disabled = true; const res = await store.cook(b.dataset.cook);
    if ('error' in res) ctx.toast(viError(res.error)); else { sfx('place'); ctx.buzz(12); ctx.toast(_t`Đã nấu ${FOOD_BY_ID[res.dish].name}.`); ctx.startAction('dance'); }
    renderCooking();
  });

  /* ---------- Gia phả: cây theo đời, bấm vào một bé để xem trang tưởng niệm ---------- */
  let famSel = ''; const famMem = {};
  function openFamily() {
    famSel = ''; open('family'); renderFamily();
    store.refreshFamily().then(() => { if (!$('family').hidden) renderFamily(); }).catch(() => {});
  }
  const famThumb = p => `pet:${p.species}:${p.stage === 'departed' ? 'elder' : p.stage}:${p.form || ''}:`;
  const dateVi = iso => new Date(iso).toLocaleDateString(LOCALE);
  function renderFamily(el = $('family')) {
    const list = S.lineage.length ? S.lineage : [];
    const p = list.find(x => x.id === famSel);
    if (p) {
      const sp = SPECIES_BY_ID[p.species], rar = sp ? RARITIES[sp.rarity] : null, gone = p.stage === 'departed', mem = famMem[p.id];
      el.innerHTML = head(esc(p.name), _t`Đời ${p.generation} · ${esc(p.family_name)}`) + _t`<div class="hs-body">
        <div class="memo-card"><img data-thumb="${famThumb(p)}" alt="" width="96" height="96">
          <div><b>${sp ? esc(sp.name) : ''}</b>${rar ? ` <span class="rar" style="--rc:${rar.color}">${rar.name}</span>` : ''}
          <p>${p.form && FORMS[p.form] ? _t`Dáng ${esc(FORMS[p.form].name)} · ` : ''}${gone ? _t`Đã sống ${p.lived_days} ngày` : _t('Đang ở bên bạn')}</p>
          <p>Sinh ngày ${dateVi(p.born_at)}${gone && p.departed_at ? _t` · ra đi ngày ${dateVi(p.departed_at)}` : ''}</p></div></div>
        <p class="hs-note">${esc(describePersona(normalizePersona(p.personality)))}</p>
        <h3 class="qh">${gone ? _t('Những điều bé nhớ') : _t('Ký ức gần đây')}</h3>
        <ul class="memo-ul">${mem ? (mem.filter(r => r.kind !== 'talk').slice(0, 6).map(r => `<li>“${esc(r.body)}”</li>`).join('') || _t('<li>Chưa có ký ức nào.</li>')) : _t('<li>Đang nhớ lại…</li>')}</ul>
        <button type="button" class="btn-sm ghost" data-fam-back>Quay lại gia phả</button></div>`;
      fillThumbs(el);
      if (!mem) store.familyMemories(p.id).then(rows => { famMem[p.id] = rows; if (famSel === p.id && !$('family').hidden) renderFamily(); }).catch(() => { famMem[p.id] = []; });
      return;
    }
    el.innerHTML = head(_t('Gia phả'), _t`${esc(S.family)} · ${list.length || 1} đời`) + _t`<div class="hs-body"><div class="tree">${list.map(x => {
      const sp = SPECIES_BY_ID[x.species], gone = x.stage === 'departed';
      return _t`<button type="button" class="gen ${gone ? 'gone' : 'alive'}" data-fam="${x.id}"><img data-thumb="${famThumb(x)}" alt="" width="64" height="64">
        <div><span class="gen-n">Đời ${x.generation}</span><b>${esc(x.name)}</b><small>${sp ? esc(sp.name) : ''}${x.form && FORMS[x.form] ? ' · ' + esc(FORMS[x.form].name) : ''}</small>
        <small>${gone ? _t`Sống ${x.lived_days} ngày, đã ra đi` : _t('Đang ở bên bạn')}</small></div></button>`;
    }).join('')}</div><p class="hs-note">Bé nào cũng sống từ 30 đến 60 ngày. Khi bé ra đi, bạn đón một quả trứng đời sau mang tên dòng họ và thừa hưởng một phần cá tính.</p></div>`;
    fillThumbs(el);
  }
  app.addEventListener('click', e => {
    const f = e.target.closest('[data-fam]'); if (f) { famSel = f.dataset.fam; renderFamily(); return; }
    if (e.target.closest('[data-fam-back]')) { famSel = ''; renderFamily(); }
  });

  /* ---------- Sổ loài ---------- */
  let dexRegion = -1, dexSel = '';
  function openDex() { dexSel = S.species; open('dex'); renderDex(); }
  /** Bọc phần thân của sheet (mọi thứ sau thanh tiêu đề) vào một vùng cuộn, giữ nguyên vị trí cuộn khi vẽ lại. */
  function scrollWrap(el, keepTop = 0) {
    const h = el.querySelector('.hs-head'); if (!h) return;
    const w = document.createElement('div'); w.className = 'hs-scroll'; while (h.nextSibling) w.appendChild(h.nextSibling); el.appendChild(w); w.scrollTop = keepTop;
  }
  const scrollTopOf = el => el.querySelector('.hs-scroll')?.scrollTop || 0;
  function renderDex(el = $('dex')) {
    const seen = new Map(S.seen.map(x => [x.species_id, x]));
    const leg = SPECIES.filter(x => x.rarity === 'huyen' && seen.has(x.id)).length;
    const list = SPECIES.filter(x => dexRegion < 0 || x.region === dexRegion);
    const sel = SPECIES_BY_ID[dexSel], selSeen = sel && seen.get(sel.id);
    const look = sp => { const cur = sp.id === S.species; const f = cur ? S.form : seen.get(sp.id)?.forms[0]; return `pet:${sp.id}:${cur ? S.stage : 'adult'}:${f || 'thuong'}`; };
    const keepTop = scrollTopOf(el);
    el.innerHTML = head(_t('Sổ loài'), _t`Đã gặp ${seen.size}/${SPECIES.length} loài · Huyền thoại ${leg}/5`) +
      (sel ? `<div class="dex-detail">${selSeen ? `<img data-thumb="${look(sel)}" alt="" width="96" height="96">` : '<div class="dex-q">?</div>'}
        <div><b>${selSeen ? esc(sel.name) : '???'}</b> <span class="rar" style="--rc:${RARITIES[sel.rarity].color}">${RARITIES[sel.rarity].name}</span>
        <p>${REGIONS[sel.region].name}${selSeen ? ' · ' + esc(sel.blurb) : _t(' · Chưa gặp. Ấp ') + REGIONS[sel.region].egg.toLowerCase() + _t(' để có cơ hội gặp.')}</p>
        </div></div>${selSeen ? _t`<div class="evo-line" aria-label="Các giai đoạn tiến hoá">
          ${['baby', 'child', 'teen'].map(st => `<figure><img data-thumb="pet:${sel.id}:${st}:" alt="" width="72" height="72"><figcaption>${STAGES[st].name}</figcaption></figure>`).join('<span class="evo-arrow">›</span>')}
          <span class="evo-arrow">›</span><div class="evo-forms">${Object.entries(FORMS).map(([k, f]) => { const got = selSeen.forms.includes(k); return `<figure class="${got ? '' : 'unknown'}"><img data-thumb="pet:${sel.id}:adult:${k}" alt="" width="64" height="64"><figcaption>${got ? f.name : '?'}</figcaption></figure>`; }).join('')}</div></div>
          <p class="evo-note">Trưởng thành có 4 dáng, tuỳ cách bạn chăm: ${Object.values(FORMS).map(f => `<b>${f.name}</b> (${f.hint})`).join(', ')}.</p>` : ''}` : '') +
      `<div class="tabs-row" role="tablist">${[[-1, _t('Tất cả')], ...REGIONS.map((r, i) => [i, r.name])].map(([i, n]) => `<button type="button" class="pill${dexRegion === i ? ' on' : ''}" data-dexr="${i}" role="tab" aria-selected="${dexRegion === i}">${n}</button>`).join('')}</div>
      <div class="grid-items dex-grid">${list.map(sp => { const ok = seen.has(sp.id); return `<button type="button" class="card-item dex-card r-${sp.rarity}${ok ? '' : ' unknown'}${dexSel === sp.id ? ' on' : ''}" data-dex="${sp.id}">
        <img data-thumb="${look(sp)}" alt="" width="72" height="72"><div class="ci-name">${ok ? esc(sp.name) : '???'}</div><span class="rar" style="--rc:${RARITIES[sp.rarity].color}">${RARITIES[sp.rarity].name}</span></button>`; }).join('')}</div>`;
    scrollWrap(el, keepTop); fillThumbs(el);
  }
  app.addEventListener('click', e => {
    const r = e.target.closest('[data-dexr]'); if (r) { dexRegion = Number(r.dataset.dexr); renderDex(); return; }
    const c = e.target.closest('[data-dex]'); if (c) { dexSel = c.dataset.dex; renderDex(); $('dex').querySelector('.hs-body, .dex-detail')?.scrollIntoView({ block: 'nearest' }); }
  });

  /* ---------- Cửa hàng ---------- */
  let shopTab = 'market', shopKind = 'all', confirmId = '';
  const KIND_FILTER = { all: _t('Tất cả'), floor: _t('Nội thất'), rug: _t('Thảm'), wall: _t('Treo tường'), surface: _t('Tường & sàn'), farm: _t('Nông trại'), outfit: _t('Trang phục') };
  const kindOf = it => (it.kind === 'outfit' ? 'outfit' : it.layer === 'wallpaper' || it.layer === 'flooring' ? 'surface' : it.layer);
  function openShop(tab = shopTab, kind) {
    shopTab = tab; confirmId = ''; if (kind) shopKind = kind;
    const el = open('shop'); renderShop(el);
  }
  /* Tab Thức ăn: suất ăn miễn phí mỗi ngày, ăn cân bằng, mua thức ăn bằng xu */
  function foodBody() {
    const claimed = S.rationDay === store.today(), ration = FOOD_BY_ID[FOOD_STOCK.rationId], got = new Set(store.nutritionNow());
    const healthy = Object.entries(FOOD_GROUPS).filter(([, g]) => g.healthy);
    return _t`<div class="ration"><div><b>Suất ăn hôm nay</b><span>Miễn phí ${FOOD_STOCK.ration} ${esc(ration.name)}, mỗi ngày nhận một lần</span></div>${claimed ? _t('<span class="pill-ok">Đã nhận</span>') : _t('<button type="button" class="btn-sm" data-ration>Nhận</button>')}</div>
      <div class="ration fridge"><div><b>Tủ lạnh cấp ${S.fridge + 1}</b><span>Giữ tươi tối đa ${FRIDGE[S.fridge].keep} phần mỗi món tươi (rau, trái cây, đạm, món nấu). Phần dư mỗi ngày hỏng 1/4. Tinh bột và đồ ngọt không hỏng.</span></div>${FRIDGE[S.fridge + 1] ? `<button type="button" class="btn-sm" data-fridge ${S.coins >= FRIDGE[S.fridge + 1].price ? '' : 'disabled'}>${COIN_SVG}${FRIDGE[S.fridge + 1].price}</button>` : _t('<span class="pill-ok">Cấp cao nhất</span>')}</div>
      <div class="nutri"><b>Khẩu vị của bé</b><span>${esc(tastesLine(S.tastes))}. Cho bé ăn thử nhiều món để biết bé thích gì.</span></div>
      ${salePct('food') ? _t`<div class="sale-note">🏷 Đang giảm giá ${salePct('food')}% thức ăn</div>` : ''}<div class="nutri"><b>Ăn cân bằng</b><span>Trong 3 ngày, cho bé ăn đủ ${BALANCED_GROUPS} nhóm: mỗi bữa bé vui thêm +${BALANCED_BONUS}.</span>
        <div class="chips-row">${healthy.map(([k, g]) => `<span class="gchip${got.has(k) ? ' on' : ''}">${got.has(k) ? '✓ ' : ''}${g.name}</span>`).join('')}</div></div>
      <div class="grid-items">${FOODS.map(f => {
        const have = S.owned[f.id] || 0, one = priceOf('food', f.price), five = one * 5;
        const can = n => S.coins >= one * n && have + n <= FOOD_STOCK.max;
        return _t`<article class="card-item"><div class="food-ic">${FOOD_SVG[f.id]}</div><div class="ci-name">${esc(f.name)}</div>
          <div class="ci-meta">${FOOD_GROUPS[f.group].name}${f.fresh ? _t(' · tươi') : ''} · +${f.no} No · +${f.vui} Vui</div><div class="ci-meta">Đang có ${have}/${FOOD_STOCK.max}</div>
          <div class="ci-act"><button type="button" class="btn-sm buy" data-buyfood="${f.id}" data-qty="1" ${can(1) ? '' : 'disabled'}>${COIN_SVG}${one}</button>
          <button type="button" class="btn-sm ghost" data-buyfood="${f.id}" data-qty="5" ${can(5) ? '' : 'disabled'}>×5 · ${five}</button></div></article>`;
      }).join('')}</div>`;
  }
  function renderShop(el = $('shop')) {
    const tabs = { food: _t('Thức ăn'), market: _t('Chợ'), rotating: _t('Tiệm hôm nay'), weekend: _t('Chợ cuối tuần'), book: _t('Sổ sưu tập') };
    if (!tabs[shopTab]) shopTab = 'market';
    let body = '';
    if (shopTab === 'food') {
      body = foodBody();
    } else if (shopTab === 'book') {
      body = '<div class="book">' + Object.entries(THEMES).filter(([t]) => t !== 'le-hoi').map(([t, name]) => {
        const all = ITEMS.filter(i => i.theme === t), have = all.filter(i => S.owned[i.id]).length, done = have === all.length, claimed = S.collections.includes(t);
        return _t`<div class="book-row"><div><b>${name}</b><span>${have}/${all.length} món</span><div class="bar-track"><i style="width:${have / all.length * 100}%"></i></div></div>
          ${claimed ? _t('<span class="pill-ok">Đã nhận</span>') : _t`<button type="button" class="btn-sm" data-claim-col="${t}" ${done ? '' : 'disabled'}>Nhận 150 xu</button>`}</div>`;
      }).join('') + _t('</div><p class="hs-note">Sưu tập đủ mọi món của một chủ đề để nhận thưởng và một ký ức mới cho bé.</p>');
    } else {
      const now = shopTab === 'rotating' ? S.rotation : null;
      let list = ITEMS.filter(i => i.source === shopTab && (now ? now.includes(i.id) : true));
      if (shopKind !== 'all') list = list.filter(i => kindOf(i) === shopKind);
      const closed = shopTab === 'weekend' && !S.weekend;
      body = (closed ? _t('<p class="hs-note">Chợ cuối tuần mở vào Thứ Bảy và Chủ nhật. Đây là những món sẽ bày bán:</p>') : shopTab === 'rotating' ? _t('<p class="hs-note">Mỗi ngày tiệm bày 6 món khác nhau.</p>') : '') +
        `<div class="kinds">${Object.entries(KIND_FILTER).map(([k, l]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === shopKind}">${l}</button>`).join('')}</div>` +
        `<div class="grid-items">${list.map(it => {
          const owned = S.owned[it.id] || 0, single = it.kind === 'outfit' || it.layer === 'wallpaper' || it.layer === 'flooring';
          const can = !closed && buyable(it, store.today());
          const badge = liked(it) ? _t('<span class="badge-like">Bé chỉ vào món này</span>') : '';
          const action = single && owned ? _t('<span class="pill-ok">Đã có</span>')
            : `<button type="button" class="btn-sm buy" data-buy="${it.id}" ${can && S.coins >= priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price) ? '' : 'disabled'}>${confirmId === it.id ? _t('Bấm lần nữa để mua') : `${COIN_SVG}${priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price)}`}</button>`;
          const preview = it.kind === 'decor' && ['floor', 'rug', 'wall'].includes(it.layer) && can ? _t`<button type="button" class="btn-link" data-try="${it.id}">Xem thử</button>` : '';
          return card(it, `${badge}<div class="ci-meta">${RARITY[it.rarity]}${it.theme ? ' · ' + THEMES[it.theme] : ''}${!single && owned ? _t` · có ${owned}` : ''}</div><div class="ci-act">${action}${preview}</div>`);
        }).join('') || _t('<p class="hs-note">Không có món nào trong mục này.</p>')}</div>`;
    }
    el.innerHTML = head(_t('Cửa hàng'), _t`${COIN_SVG}<b class="coin-inline">${S.coins.toLocaleString(LOCALE)}</b> xu · hôm nay đã kiếm ${S.earnedToday}/${S.careCap || 50} xu chăm sóc`) +
      `<nav class="tabs-row" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button type="button" role="tab" class="tab" data-shop-tab="${k}" aria-selected="${k === shopTab}">${l}</button>`).join('')}</nav><div class="hs-body">${body}</div>`;
    fillThumbs(el);
  }
  app.addEventListener('click', async e => {
    const t = e.target.closest('[data-shop-tab]'); if (t) { shopTab = t.dataset.shopTab; confirmId = ''; renderShop(); return; }
    const k = e.target.closest('[data-kind]'); if (k) { shopKind = k.dataset.kind; renderShop(); return; }
    const b = e.target.closest('[data-buy]');
    if (b) {
      const id = b.dataset.buy;
      if (confirmId !== id) { confirmId = id; renderShop(); setTimeout(() => { if (confirmId === id) { confirmId = ''; if (!$('shop').hidden) renderShop(); } }, 3500); return; }
      confirmId = ''; b.disabled = true;
      const err = await store.buy(id);
      if (err) { ctx.toast(viError(err)); renderShop(); return; }
      const it = BY_ID[id]; sfx('buy'); ctx.buzz(12); ctx.toast(_t`Đã mua ${it.name}.`); ctx.popText('-' + priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price) + _t(' xu'), '#a8742e'); reactTo(it, it.kind);
      renderShop();
      if (pendingPreview === id) { pendingPreview = ''; }
      return;
    }
    const bf = e.target.closest('[data-buyfood]');
    if (bf) {
      const f = FOOD_BY_ID[bf.dataset.buyfood], n = +bf.dataset.qty; bf.disabled = true;
      const err = await store.buyFood(f.id, n);
      if (err) ctx.toast(viError(err)); else { sfx('buy'); ctx.buzz(10); ctx.toast(_t`Đã mua ${n} ${f.name}.`); ctx.popText('-' + priceOf('food', f.price) * n + _t(' xu'), '#a8742e'); }
      renderShop(); return;
    }
    const fr = e.target.closest('[data-fridge]');
    if (fr) {
      fr.disabled = true; const err = await store.upgradeFridge();
      if (err) ctx.toast(viError(err)); else { sfx('buy'); ctx.buzz(12); ctx.toast(_t`Đã mua tủ lạnh cấp ${S.fridge + 1}.`); }
      renderShop(); return;
    }
    const rt = e.target.closest('[data-ration]');
    if (rt) {
      rt.disabled = true; const err = await store.claimRation();
      if (err) ctx.toast(viError(err)); else { sfx('coin'); ctx.buzz(10); ctx.toast(_t`Nhận ${FOOD_STOCK.ration} ${FOOD_BY_ID[FOOD_STOCK.rationId].name} miễn phí.`); }
      renderShop(); return;
    }
    const tr = e.target.closest('[data-try]'); if (tr) { closeAll(); enterEdit(tr.dataset.try); return; }
    const cc = e.target.closest('[data-claim-col]');
    if (cc) { cc.disabled = true; const err = await store.claimCollection(cc.dataset.claimCol); if (err) ctx.toast(viError(err)); else { sfx('coin'); ctx.popText(_t('+150 xu'), '#a8742e'); ctx.startAction('dance'); ctx.toast(_t('Hoàn thành một trang sổ sưu tập!')); } renderShop(); }
  });

  /* ---------- Tủ đồ ---------- */
  let wardSlot = 'head';
  function openWardrobe() { const el = open('wardrobe'); ctx.setZoom(0.2); renderWardrobe(el); }
  function renderWardrobe(el = $('wardrobe')) {
    const items = ITEMS.filter(i => i.kind === 'outfit' && i.slot === wardSlot);
    const cur = S.outfit[wardSlot];
    el.innerHTML = head(_t('Tủ đồ'), _t('Trang phục chỉ để trang trí, không tăng chỉ số.')) +
      _t`<nav class="tabs-row" role="tablist">${Object.entries(SLOTS).map(([k, l]) => `<button type="button" role="tab" class="tab" data-slot="${k}" aria-selected="${k === wardSlot}">${l}${S.outfit[k] ? ' •' : ''}</button>`).join('')}</nav>
      <div class="hs-body"><div class="grid-items">
        <article class="card-item none ${cur ? '' : 'on'}"><div class="none-ic" aria-hidden="true">∅</div><div class="ci-name">Không đeo</div><div class="ci-act"><button type="button" class="btn-sm ghost" data-wear="" ${cur ? '' : 'disabled'}>Bỏ ra</button></div></article>
        ${items.map(it => { const own = !!S.owned[it.id];
          return card(it, `<div class="ci-meta">${own ? RARITY[it.rarity] : buyable(it, store.today()) ? _t`Có bán · ${priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price)} xu` : _t('Chưa bán hôm nay')}</div><div class="ci-act">${own ? `<button type="button" class="btn-sm ${cur === it.id ? 'on' : ''}" data-wear="${it.id}">${cur === it.id ? _t('Đang mặc') : _t('Mặc')}</button>` : _t`<button type="button" class="btn-link" data-shop-for="${it.id}">Đến cửa hàng</button>`}</div>`).replace('card-item', `card-item ${own ? '' : 'locked'} ${cur === it.id ? 'on' : ''}`); }).join('')}
      </div>
      <h3 class="hs-sub">Bộ phối</h3><div class="presets">${S.presets.map((p, i) => _t`<div class="preset"><b>Bộ ${i + 1}</b><span>${Object.values(p || {}).map(id => BY_ID[id]?.name).filter(Boolean).join(', ') || _t('Trống')}</span><div><button type="button" class="btn-sm ghost" data-preset-wear="${i}" ${Object.keys(p || {}).length ? '' : 'disabled'}>Mặc</button><button type="button" class="btn-sm ghost" data-preset-save="${i}">Lưu bộ đang mặc</button></div></div>`).join('')}</div></div>`;
    fillThumbs(el);
  }
  app.addEventListener('click', async e => {
    const s = e.target.closest('[data-slot]'); if (s) { wardSlot = s.dataset.slot; renderWardrobe(); return; }
    const w = e.target.closest('[data-wear]');
    if (w) {
      const id = w.dataset.wear, o = { ...S.outfit, [wardSlot]: id || undefined };
      if (!id) delete o[wardSlot];
      await store.equip(o); ctx.impulse(-2); if (id) reactTo(BY_ID[id], 'outfit'); renderWardrobe(); return;
    }
    const sf = e.target.closest('[data-shop-for]'); if (sf) { const it = BY_ID[sf.dataset.shopFor]; shopKind = 'outfit'; openShop(it.source === 'starter' ? 'market' : it.source); return; }
    const pw = e.target.closest('[data-preset-wear]'); if (pw) { await store.equip(clone(S.presets[+pw.dataset.presetWear])); ctx.impulse(-2); ctx.spawn('sparkle', 2); renderWardrobe(); return; }
    const ps = e.target.closest('[data-preset-save]'); if (ps) { await store.savePreset(+ps.dataset.presetSave); ctx.toast(_t`Đã lưu Bộ ${+ps.dataset.presetSave + 1}.`); renderWardrobe(); }
  });

  /* ---------- Nhiệm vụ ---------- */
  function openQuests() { open('quests'); renderQuests(); refreshProgress().then(() => { if (!$('quests').hidden) renderQuests(); }).catch(() => {}); store.refreshQuests().then(() => { if (!$('quests').hidden) renderQuests(); }); store.refreshWorld().then(() => { if (!$('quests').hidden) renderQuests(); }).catch(() => {}); }
  const questRow = (q, def, attr) => {
    const done = q.progress >= q.target;
    return `<li><div><b>${def.label}</b><div class="bar-track"><i style="width:${Math.min(100, q.progress / q.target * 100)}%"></i></div><span>${Math.min(q.progress, q.target)}/${q.target}</span></div>
      ${q.claimed ? _t('<span class="pill-ok">Đã nhận</span>') : `<button type="button" class="btn-sm" ${attr}="${q.idx}" ${done ? '' : 'disabled'}>${COIN_SVG}+${q.reward}</button>`}</li>`;
  };
  function weekDaysLeft() { const [y, m, d] = store.today().split('-').map(Number), dow = new Date(y, m - 1, d).getDay(); return 7 - ((dow + 6) % 7); }
  let questTab = 'daily';
  const exploreReady = () => !!S.world && S.world.explore.some(t => t.ready && !t.claimed), badgeReady = () => !!S.world && S.world.badges.some(b => !b.claimed && b.progress >= b.target);
  function renderQuests(el = $('quests')) {
    const b = S.questBonus, n = S.quests.filter(q => q.claimed).length, left = weekDaysLeft();
    const boost = ctx.events ? ctx.events.boost() : 1;
    const dotDaily = S.quests.some(q => !q.claimed && q.progress >= q.target) || (b.ready && !b.claimed) || S.weekly.some(q => !q.claimed && q.progress >= q.target);
    const tabs = [['daily', _t('Nhiệm vụ'), dotDaily], ['explore', _t('Khám phá'), exploreReady()], ['badges', _t('Huy hiệu'), badgeReady()], ['season', _t('Sổ mùa'), f2p.seasonReady()], ['stickers', 'Sticker', f2p.stickerReady()]];
    const nav = `<nav class="tabs-row" role="tablist">${tabs.map(([k, l, dot]) => `<button type="button" role="tab" class="tab${dot ? ' dot' : ''}" data-quest-tab="${k}" aria-selected="${k === questTab}">${l}</button>`).join('')}</nav>`;
    const sub = questTab === 'explore' ? _t('chơi nhiều hoạt động khác nhau để nhận xu') : questTab === 'badges' ? _t('sưu tầm huy hiệu bằng cách chơi cùng bé') : questTab === 'season' ? _t('miễn phí, đổi mới mỗi tháng') : questTab === 'stickers' ? _t('sưu tầm sticker từ mọi hoạt động') : _t('chăm sóc hằng ngày cho thêm tối đa 50 xu');
    if (questTab !== 'daily') { el.innerHTML = head(_t('Nhiệm vụ'), _t`${COIN_SVG}<b class="coin-inline">${S.coins.toLocaleString(LOCALE)}</b> xu · ${sub}`) + nav + `<div class="hs-body">${questTab === 'explore' ? exploreHtml() : questTab === 'season' ? f2p.seasonHtml() : questTab === 'stickers' ? f2p.stickersHtml() : badgesHtml()}</div>`; return; }
    el.innerHTML = head(_t('Nhiệm vụ'), _t`${COIN_SVG}<b class="coin-inline">${S.coins.toLocaleString(LOCALE)}</b> xu · ${sub}`) + nav + _t`<div class="hs-body">${boost > 1 ? _t`<p class="hs-note">🎉 Sự kiện: thưởng nhiệm vụ nhân ${String(boost).replace('.', ',')} lần!</p>` : ''}
      <h3 class="qh">Hôm nay <small>${n}/${S.quests.length} đã nhận</small></h3>
      <ul class="quests">${S.quests.map(q => questRow(q, QUEST_POOL[q.quest], 'data-quest')).join('')}</ul>
      <div class="quest-bonus${b.ready && !b.claimed ? ' ready' : ''}"><div><b>Thưởng cả ngày</b><span>Nhận đủ ${S.quests.length} nhiệm vụ hôm nay</span></div>
        ${b.claimed ? _t('<span class="pill-ok">Đã nhận</span>') : `<button type="button" class="btn-sm" data-quest-bonus ${b.ready ? '' : 'disabled'}>${COIN_SVG}+${b.reward || QUEST_BONUS}</button>`}</div>
      <h3 class="qh">Tuần này <small>còn ${left} ngày, tính từ thứ Hai</small></h3>
      <ul class="quests">${S.weekly.map(q => questRow(q, WEEKLY_POOL[q.quest], 'data-weekly')).join('')}</ul>
      <p class="hs-note">Nhiệm vụ ngày đổi mới mỗi ngày, nhiệm vụ tuần đổi vào thứ Hai. Làm nhiều thì thưởng nhiều.</p></div>`;
  }
  /** "Khám phá hôm nay": chơi nhiều hoạt động khác nhau trong thế giới (đồ chơi, ghế đá, sân khấu, trà, mèo, mini-game). */
  function exploreHtml() {
    const w = S.world; if (!w) return '';
    const n = w.kinds.length, top = EXPLORE_TIERS[EXPLORE_TIERS.length - 1].need;
    return _t`<h3 class="qh">Khám phá hôm nay <small>${Math.min(n, top)}/${top} hoạt động khác nhau</small></h3>
      <div class="explore"><div class="bar-track"><i style="width:${Math.min(100, n / top * 100)}%"></i></div>
        <p class="ex-kinds">${w.kinds.length ? w.kinds.map(k => `<span>${ACTIVITY_LABEL[k] || k}</span>`).join('') : _t('<em>Chưa có hoạt động nào. Ra Công viên, Quảng trường hoặc Tiệm trà chơi cùng bé nhé!</em>')}</p>
        <ul class="quests">${w.explore.map(t => _t`<li><div><b>Chơi ${t.need} hoạt động khác nhau</b><span class="ex-n">${Math.min(n, t.need)}/${t.need}</span></div>
          ${t.claimed ? _t('<span class="pill-ok">Đã nhận</span>') : `<button type="button" class="btn-sm" data-explore="${t.tier}" ${t.ready ? '' : 'disabled'}>${COIN_SVG}+${t.reward}</button>`}</li>`).join('')}</ul></div>`;
  }
  /** Sổ huy hiệu: tiến độ lấy từ máy chủ; đủ thì bấm nhận xu một lần. */
  function badgesHtml() {
    const w = S.world; if (!w) return '';
    const got = w.badges.filter(b => b.claimed).length;
    return _t`<h3 class="qh">Huy hiệu <small>${got}/${w.badges.length} đã nhận</small></h3>
      <ul class="badges">${w.badges.map(b => { const d = BADGE_BY_ID[b.id], done = b.progress >= b.target || b.claimed, prog = b.claimed ? b.target : b.progress;
        return `<li class="badge${b.claimed ? ' got' : done ? ' ready' : ''}"><span class="b-ico" aria-hidden="true">${BADGE_ICONS[b.id] || d.icon}</span><b>${d.name}</b><span class="b-desc">${d.desc}</span>
          <div class="bar-track"><i style="width:${Math.min(100, prog / b.target * 100)}%"></i></div><span class="b-num">${prog}/${b.target}</span>
          ${b.claimed ? _t('<span class="pill-ok">Đã nhận</span>') : `<button type="button" class="btn-sm" data-badge="${b.id}" ${done ? '' : 'disabled'}>${COIN_SVG}+${b.reward}</button>`}</li>`; }).join('')}</ul>`;
  }
  app.addEventListener('click', async e => {
    const qt = e.target.closest('[data-quest-tab]'); if (qt) { questTab = qt.dataset.questTab; renderQuests(); return; }
    const wb = e.target.closest('[data-explore], [data-badge]');
    if (wb) {
      wb.disabled = true;
      const res = 'explore' in wb.dataset ? await store.claimExplore(+wb.dataset.explore) : await store.claimBadge(wb.dataset.badge);
      if ('error' in res) ctx.toast(viError(res.error)); else { sfx('coin'); ctx.popText(_t`+${res.reward} xu`, '#a8742e'); ctx.buzz(12); ctx.spawn('sparkle', 3); }
      renderQuests(); return;
    }
    const b = e.target.closest('[data-quest], [data-quest-bonus], [data-weekly]'); if (!b) return;
    b.disabled = true;
    const res = 'quest' in b.dataset ? await store.claimQuest(+b.dataset.quest) : 'weekly' in b.dataset ? await store.claimWeeklyQuest(+b.dataset.weekly) : await store.claimQuestBonus();
    if ('error' in res) ctx.toast(viError(res.error)); else { sfx('coin'); ctx.popText(_t`+${res.reward} xu`, '#a8742e'); ctx.buzz(12); ctx.startAction('hop'); }
    renderQuests();
  });

  /* ===================== Chế độ trang trí ===================== */
  let editing = false, work = null, slot = 0, undo = [], redo = [], dirty = false, sel = -1, placing = null, drag = null, pendingPreview = '', filter = 'all';
  const gridGroup = new THREE.Group(); gridGroup.visible = false; room.add(gridGroup);
  const lineMat = new THREE.LineBasicMaterial({ color: '#a8507a', transparent: true, opacity: 0.7, depthWrite: false });
  {
    const pts = [];
    for (let c = 0; c <= GRID.cols; c++) pts.push(GRID.x0 + c, 0.075, GRID.z0, GRID.x0 + c, 0.075, GRID.z0 + GRID.rows);
    for (let r = 0; r <= GRID.rows; r++) pts.push(GRID.x0, 0.075, GRID.z0 + r, GRID.x0 + GRID.cols, 0.075, GRID.z0 + r);
    for (let c = 0; c <= GRID.cols; c++) pts.push(GRID.x0 + c, GRID.wallY0, -3.47, GRID.x0 + c, GRID.wallY0 + GRID.wallRows, -3.47);
    for (let r = 0; r <= GRID.wallRows; r++) pts.push(GRID.x0, GRID.wallY0 + r, -3.47, GRID.x0 + GRID.cols, GRID.wallY0 + r, -3.47);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    gridGroup.add(new THREE.LineSegments(geo, lineMat));
    const pz = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#ff9ec4', transparent: true, opacity: 0.18, depthWrite: false }));
    pz.rotation.x = -Math.PI / 2; pz.position.set(GRID.x0 + 4, 0.07, GRID.z0 + 4); gridGroup.add(pz);
  }
  const hiGood = new THREE.MeshBasicMaterial({ color: '#5fd38a', transparent: true, opacity: 0.45, depthWrite: false });
  const hiBad = new THREE.MeshBasicMaterial({ color: '#ff5c7a', transparent: true, opacity: 0.45, depthWrite: false });
  const hiGroup = new THREE.Group(); room.add(hiGroup);
  const cellPlane = new THREE.PlaneGeometry(0.94, 0.94);
  function showCells(p, ok) {
    hiGroup.clear(); if (!p) return;
    const it = BY_ID[p.id];
    cellsOf(p).forEach(([c, r]) => {
      const m = new THREE.Mesh(cellPlane, ok ? hiGood : hiBad);
      if (it.layer === 'wall') m.position.set(GRID.x0 + c + 0.5, GRID.wallY0 + r + 0.5, -3.46);
      else { m.rotation.x = -Math.PI / 2; m.position.set(GRID.x0 + c + 0.5, 0.08, GRID.z0 + r + 0.5); }
      hiGroup.add(m);
    });
  }
  const REASON = { bounds: _t('Món này nằm ngoài phòng.'), overlap: _t('Chỗ này đã có đồ.'), pet: _t('Ô giữa phòng để dành cho bé đi lại.'), window: _t('Vướng cửa sổ rồi.'), path: _t('Đặt ở đây sẽ chặn mất lối ra của bé.'), unknown: _t('Không đặt được món này.') };

  const ui = document.createElement('div'); ui.className = 'edit-ui'; ui.hidden = true; app.appendChild(ui);
  ui.innerHTML = _t`<div class="edit-top"><div class="edit-title"><b>Trang trí phòng</b><span id="edit-status"></span></div>
      <div class="edit-slots" role="group" aria-label="Bố cục">${[0, 1, 2].map(i => _t`<button type="button" class="chip" data-eslot="${i}">Bố cục ${i + 1}</button>`).join('')}</div>
      <div class="edit-actions"><button type="button" class="pill" id="e-undo" title="Hoàn tác (Ctrl+Z)">↶</button><button type="button" class="pill" id="e-redo" title="Làm lại (Ctrl+Y)">↷</button><button type="button" class="pill save" id="e-save">Lưu</button><button type="button" class="pill" id="e-done">Xong</button></div></div>
    <div class="edit-confirm" id="e-confirm" hidden><span>Bạn chưa lưu thay đổi.</span><button type="button" class="btn-sm" id="e-save-exit">Lưu và thoát</button><button type="button" class="btn-sm ghost" id="e-discard">Bỏ thay đổi</button><button type="button" class="btn-sm ghost" id="e-stay">Ở lại</button></div>
    <div class="item-bar" id="e-itembar" hidden><b id="e-itemname"></b><button type="button" class="btn-sm ghost" id="e-rotate">Xoay (R)</button><button type="button" class="btn-sm ghost" id="e-store">Cất (Del)</button><button type="button" class="btn-sm" id="e-buy" hidden></button><button type="button" class="btn-sm ghost" id="e-deselect">Xong</button></div>
    <div class="inventory"><nav class="kinds" id="e-filter">${Object.entries({ all: _t('Tất cả'), floor: _t('Nội thất'), rug: _t('Thảm'), wall: _t('Treo tường'), surface: _t('Tường & sàn') }).map(([k, l]) => `<button type="button" class="chip" data-efilter="${k}">${l}</button>`).join('')}</nav><div class="inv-row" id="e-inv"></div></div>`;

  const pushUndo = () => { undo.push(JSON.stringify(work)); if (undo.length > 60) undo.shift(); redo = []; dirty = true; };
  function refreshEdit() {
    renderRoom(work);
    const lvl = comfortLevel(comfortScore(work)), sets = activeSets(work);
    $('edit-status').innerHTML = _t`Thoải mái <b class="stars" aria-label="${lvl} trên 5 sao">${'★'.repeat(lvl)}<i>${'★'.repeat(5 - lvl)}</i></b> cấp ${lvl}${sets.length ? _t(' · Bộ ') + sets.map(t => THEMES[t]).join(', ') : ''}`;
    ui.querySelectorAll('[data-eslot]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.eslot === slot)));
    ui.querySelectorAll('[data-efilter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.efilter === filter)));
    $('e-undo').disabled = !undo.length; $('e-redo').disabled = !redo.length;
    $('e-save').disabled = !dirty || work.items.some(p => !(S.owned[p.id] > 0)) || hasUnpaid();
    renderInventory(); renderItemBar();
  }
  function hasUnpaid() { const n = placedCount(work); return Object.entries(n).some(([id, k]) => (S.owned[id] || 0) < k); }
  function renderInventory() {
    const n = placedCount(work);
    const list = ITEMS.filter(i => i.kind === 'decor' && i.layer !== 'farm' && (S.owned[i.id] || 0) > 0 && (filter === 'all' || kindOf(i) === filter)); // đồ nông trại đặt ở cảnh Vườn
    $('e-inv').innerHTML = list.map(it => {
      const surf = it.layer === 'wallpaper' || it.layer === 'flooring', left = surf ? null : (S.owned[it.id] || 0) - (n[it.id] || 0);
      const on = surf && (work.wallpaper === it.id || work.flooring === it.id);
      return `<button type="button" class="inv-item ${on ? 'on' : ''}" data-inv="${it.id}" ${left === 0 ? 'disabled' : ''} title="${esc(it.name)}"><img data-thumb="${it.id}" alt="" width="56" height="56"><span>${esc(it.name)}</span>${left != null ? `<em>${left}</em>` : on ? '<em>✓</em>' : ''}</button>`;
    }).join('') + _t`<button type="button" class="inv-item more" data-inv-shop><span>Mua thêm đồ</span></button>`;
    fillThumbs(ui);
  }
  function renderItemBar() {
    const bar = $('e-itembar');
    if (placing && sel < 0) { bar.hidden = false; $('e-itemname').innerHTML = _t`${esc(BY_ID[placing.p.id].name)} <small>· chạm ô để đặt</small>`; $('e-rotate').hidden = BY_ID[placing.p.id].layer === 'wall'; $('e-buy').hidden = true; bar.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${ui.querySelector('.inventory').offsetHeight + 24}px)`; return; }
  if (sel < 0 || !work.items[sel]) { bar.hidden = true; return; }
    const p = work.items[sel], it = BY_ID[p.id], unpaid = (S.owned[p.id] || 0) < placedCount(work)[p.id];
    bar.hidden = false; $('e-itemname').textContent = it.name;
    bar.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${ui.querySelector('.inventory').offsetHeight + 24}px)`;
    $('e-rotate').hidden = it.layer === 'wall';
    $('e-buy').hidden = !unpaid; $('e-buy').innerHTML = _t`Mua · ${priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price || 0)} xu`; $('e-buy').disabled = S.coins < priceOf(it.kind === 'outfit' ? 'outfit' : 'decor', it.price || 0);
  }
  function enterEdit(previewId) {
    if (ctx.getArea() !== 'home') { ctx.goTo('home'); setTimeout(() => enterEdit(previewId), 1100); return; }
    closeAll(); ctx.closeGameSheets();
    editing = true; ctx.setEditing(true); document.body.classList.add('editing');
    slot = S.activeLayout; work = clone(store.activeLayout()); undo = []; redo = []; dirty = false; sel = -1; placing = null; filter = 'all';
    gridGroup.visible = true; ui.hidden = false; $('e-confirm').hidden = true;
    ctx.petBase.set(0, 0, 0.7);
    ctx.say(_t('Mình ngồi giữa phòng xem bạn trang trí nha!'), 2400);
    refreshEdit();
    if (previewId) { pendingPreview = previewId; startPlacing(previewId); }
  }
  function exitEdit(save) {
    const finish = () => {
      editing = false; ctx.setEditing(false); document.body.classList.remove('editing');
      gridGroup.visible = false; ui.hidden = true; hiGroup.clear(); placing = null; sel = -1; pendingPreview = '';
      ctx.petBase.set(0, 0, 0.35); renderRoom(store.activeLayout()); afterRoomChange(false);
    };
    if (save) doSave(true).then(ok => { if (ok) finish(); }); else finish();
  }
  async function doSave(quiet) {
    if (hasUnpaid()) { ctx.toast(_t('Còn món đang xem thử chưa mua. Mua hoặc cất nó đi trước nhé.')); return false; }
    $('e-save').disabled = true;
    const err = await store.saveLayout(slot, work);
    if (err) { ctx.toast(viError(err)); refreshEdit(); return false; }
    dirty = false; if (!quiet) ctx.toast(_t`Đã lưu Bố cục ${slot + 1}. Thoải mái cấp ${S.comfort}.`);
    refreshEdit(); return true;
  }
  function startPlacing(id) {
    const it = BY_ID[id]; sel = -1;
    const p = { id, c: it.layer === 'wall' ? 0 : 0, r: 0, rot: 0 };
    // chọn ô hợp lệ đầu tiên làm gợi ý
    outer: for (let r = 0; r < (it.layer === 'wall' ? GRID.wallRows : GRID.rows); r++) for (let c = 0; c < GRID.cols; c++) { p.c = c; p.r = r; if (!canPlace(work, p)) break outer; }
    placing = { p, group: D.build(id) }; ctx.applyShadows(placing.group); room.add(placing.group); placeGroup(placing.group, p);
    showCells(p, !canPlace(work, p)); renderItemBar();
  }
  function stopPlacing() { if (placing) { room.remove(placing.group); placing = null; } hiGroup.clear(); }
  const ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 3.5), hit = new THREE.Vector3();
  function cellAt(e, it, rot) {
    ray.setFromCamera(ctx.ndcFrom(e), camera);
    if (it.layer === 'wall') {
      if (!ray.ray.intersectPlane(wallPlane, hit)) return null;
      return { c: Math.round(hit.x - GRID.x0 - (it.w || 1) / 2), r: Math.round(hit.y - GRID.wallY0 - (it.d || 1) / 2) };
    }
    if (!ray.ray.intersectPlane(floorPlane, hit)) return null;
    const [w, d] = footprint(it, rot);
    return { c: Math.round(hit.x - GRID.x0 - w / 2), r: Math.round(hit.z - GRID.z0 - d / 2) };
  }
  function pickPlaced(e) {
    ray.setFromCamera(ctx.ndcFrom(e), camera);
    const hits = ray.intersectObjects(placed.map(x => x.group), true);
    if (!hits.length) return -1;
    let o = hits[0].object; while (o && !placed.some(x => x.group === o)) o = o.parent;
    const k = placed.findIndex(x => x.group === o);
    // ưu tiên nội thất hơn thảm khi chồng lên nhau
    const nonRug = hits.map(h => { let q = h.object; while (q && !placed.some(x => x.group === q)) q = q.parent; return placed.findIndex(x => x.group === q); }).find(i => i >= 0 && placed[i].item.layer !== 'rug');
    return nonRug ?? k;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!editing) return;
    if (placing) { placing.downAt = [e.clientX, e.clientY]; return; }
    const i = pickPlaced(e);
    if (i >= 0) { sel = i; drag = { i, orig: clone(work.items[i]), x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); showCells(work.items[i], true); renderItemBar(); ctx.buzz(6); }
    else { sel = -1; hiGroup.clear(); renderItemBar(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!editing) return;
    if (placing) {
      const it = BY_ID[placing.p.id], c = cellAt(e, it, placing.p.rot); if (!c) return;
      placing.p.c = c.c; placing.p.r = c.r; placeGroup(placing.group, placing.p); showCells(placing.p, !canPlace(work, placing.p));
    } else if (drag) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (!drag.moved) return;
      const p = work.items[drag.i], c = cellAt(e, BY_ID[p.id], p.rot); if (!c) return;
      p.c = c.c; p.r = c.r; placeGroup(placed[drag.i].group, p); showCells(p, !canPlace(work, p, drag.i));
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!editing) return;
    if (placing) {
      if (placing.downAt && Math.hypot(e.clientX - placing.downAt[0], e.clientY - placing.downAt[1]) > 12 && e.pointerType === 'mouse') return;
      const it = BY_ID[placing.p.id], c = cellAt(e, it, placing.p.rot);
      if (c) { placing.p.c = c.c; placing.p.r = c.r; }
      const err = canPlace(work, placing.p);
      if (err) { ctx.toast(REASON[err]); ctx.buzz(20); showCells(placing.p, false); return; }
      pushUndo(); work.items.push(clone(placing.p)); stopPlacing(); sel = work.items.length - 1; sfx('place'); ctx.buzz(10); ctx.addTrauma(0.05);
      refreshEdit(); showCells(work.items[sel], true);
      if ((S.owned[it.id] || 0) >= placedCount(work)[it.id]) reactTo(it, 'decor');
      return;
    }
    if (drag) {
      const d = drag; drag = null;
      if (!d.moved) return;
      const err = canPlace(work, work.items[d.i], d.i);
      if (err) { ctx.toast(REASON[err]); ctx.buzz(20); work.items[d.i] = d.orig; refreshEdit(); sel = d.i; showCells(work.items[d.i], true); renderItemBar(); return; }
      const now = clone(work.items[d.i]); work.items[d.i] = d.orig; pushUndo(); work.items[d.i] = now; refreshEdit(); sel = d.i; showCells(now, true); renderItemBar();
    }
  });
  function rotateSel() {
    if (placing) { placing.p.rot = (placing.p.rot + 1) % 4; placeGroup(placing.group, placing.p); showCells(placing.p, !canPlace(work, placing.p)); return; }
    if (sel < 0) return;
    const p = clone(work.items[sel]); if (BY_ID[p.id].layer === 'wall') return;
    p.rot = (p.rot + 1) % 4;
    const err = canPlace(work, p, sel); if (err) { ctx.toast(REASON[err]); ctx.buzz(20); return; }
    pushUndo(); work.items[sel] = p; refreshEdit(); showCells(p, true);
  }
  function storeSel() {
    if (placing) { stopPlacing(); renderItemBar(); return; }
    if (sel < 0) return;
    pushUndo(); work.items.splice(sel, 1); sel = -1; hiGroup.clear(); refreshEdit();
  }
  ui.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.inv) {
      const it = BY_ID[t.dataset.inv];
      if (it.layer === 'wallpaper' || it.layer === 'flooring') { pushUndo(); work[it.layer] = it.id; refreshEdit(); reactTo(it, 'decor'); return; }
      stopPlacing(); startPlacing(it.id); return;
    }
    if (t.hasAttribute('data-inv-shop')) { exitEdit(false); openShop('market'); return; }
    if (t.dataset.efilter) { filter = t.dataset.efilter; refreshEdit(); return; }
    if (t.dataset.eslot != null) {
      const i = +t.dataset.eslot; if (i === slot) return;
      if (dirty) { ctx.toast(_t('Lưu bố cục hiện tại trước khi đổi sang bố cục khác nhé.')); return; }
      slot = i; work = clone(S.layouts[i] || DEFAULT_LAYOUT); work.items = work.items.filter(p => (S.owned[p.id] || 0) > 0); undo = []; redo = []; dirty = i !== S.activeLayout; stopPlacing(); sel = -1; refreshEdit(); return;
    }
    switch (t.id) {
      case 'e-undo': if (undo.length) { redo.push(JSON.stringify(work)); work = JSON.parse(undo.pop()); sel = -1; hiGroup.clear(); dirty = true; refreshEdit(); } break;
      case 'e-redo': if (redo.length) { undo.push(JSON.stringify(work)); work = JSON.parse(redo.pop()); sel = -1; hiGroup.clear(); dirty = true; refreshEdit(); } break;
      case 'e-save': doSave(false); break;
      case 'e-done': stopPlacing(); if (dirty) $('e-confirm').hidden = false; else exitEdit(false); break;
      case 'e-save-exit': exitEdit(true); break;
      case 'e-discard': exitEdit(false); break;
      case 'e-stay': $('e-confirm').hidden = true; break;
      case 'e-rotate': rotateSel(); break;
      case 'e-store': storeSel(); break;
      case 'e-deselect': stopPlacing(); sel = -1; hiGroup.clear(); renderItemBar(); break;
      case 'e-buy': {
        const p = work.items[sel]; if (!p) break;
        const err = await store.buy(p.id);
        if (err) ctx.toast(viError(err)); else { sfx('buy'); ctx.toast(_t`Đã mua ${BY_ID[p.id].name}.`); ctx.popText('-' + priceOf(BY_ID[p.id].kind === 'outfit' ? 'outfit' : 'decor', BY_ID[p.id].price) + _t(' xu'), '#a8742e'); reactTo(BY_ID[p.id], 'decor'); pendingPreview = ''; }
        refreshEdit(); break;
      }
    }
  });
  addEventListener('keydown', e => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea');
    if (!editing) {
      if (e.key === 'Escape' && sheets.some(s => $(s) && !$(s).hidden)) { closeAll(); e.stopImmediatePropagation(); }
      else if (e.key === '6' && !typing && !e.ctrlKey && !e.metaKey) { $('a-house').click(); e.stopImmediatePropagation(); }
      return;
    }
    if (typing) return;
    e.stopImmediatePropagation();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('e-undo').click(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); $('e-redo').click(); }
    else if (e.key === 'r' || e.key === 'R') rotateSel();
    else if (e.key === 'Delete' || e.key === 'Backspace') storeSel();
    else if (e.key === 'Escape') { if (placing || sel >= 0) { stopPlacing(); sel = -1; hiGroup.clear(); renderItemBar(); } else $('e-done').click(); }
  }, true);

  /* ===================== Sau khi đổi phòng ===================== */
  let lastSets = [];
  function afterRoomChange(react = true) {
    const sets = activeSets(store.activeLayout());
    const fresh = sets.filter(t => !lastSets.includes(t)); lastSets = sets;
    if (react && fresh.length && SET_LINES[fresh[0]]) setTimeout(() => { ctx.say(SET_LINES[fresh[0]], 3200); ctx.startAction('dance'); }, 800);
    else if (react) { const fav = placed.find(x => liked(x.item)); if (fav) setTimeout(() => reactTo(fav.item, 'decor'), 700); }
  }

  /* ===================== Cập nhật mỗi khung hình ===================== */
  let setLineAt = performance.now() + 60000, scarfAsked = false;
  function update(dt, t) {
    placed.forEach(x => {
      if (x.group.userData.spin) x.group.userData.spin.rotation.z -= dt * 9;
      if (x.group.userData.clock) { const d = new Date(); x.group.userData.clock[0].rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI / 6; x.group.userData.clock[1].rotation.z = -d.getMinutes() * Math.PI / 30; }
    });
    outfitRoot.children.forEach(g => { if (g.userData.flap && !ctx.reduce) g.userData.flap.forEach(w => { w.rotation.y = w.userData.s * (0.25 + Math.sin(t * 6) * 0.2); }); });
    const now = performance.now();
    if (!editing && ctx.getArea() === 'home' && now > setLineAt && ctx.isIdle()) {
      setLineAt = now + 90000 + Math.random() * 60000;
      const sets = activeSets(store.activeLayout());
      if (sets.length && Math.random() < 0.6) { const th = sets[Math.floor(Math.random() * sets.length)]; if (SET_LINES[th]) { ctx.say(SET_LINES[th], 3000); if (th === 'pastel' || th === 'tuoi-tho-9x') ctx.startAction('dance'); } }
    }
    if (!scarfAsked && ctx.isNight() && S.owned['khan-len'] && S.outfit.neck !== 'khan-len' && ctx.isIdle() && !editing) { scarfAsked = true; ctx.say(_t('Tối rồi lạnh ghê… cho mình mượn khăn len nha?'), 3200); }
  }

  /* ===================== Đồng bộ ===================== */
  let roomKey = '';
  function sync() {
    renderCoins();
    if (!editing) { const k = JSON.stringify(store.activeLayout()); if (k !== roomKey) { const first = !roomKey; roomKey = k; renderRoom(store.activeLayout()); afterRoomChange(!first); } }
    renderOutfit(S.outfit);
    $('a-house').classList.toggle('need', questReady() || !!S.illness || social.badge() > 0);
    if ($('clinic') && !$('clinic').hidden) renderClinic();
  }
  store.onSync(sync); sync();
  lastSets = activeSets(store.activeLayout());

  /* Kiểm tra mặc đồ cho mọi loài × giai đoạn × món (chỉ khi mở với ?fitcheck): trả về các trường hợp bị lẹm. */
  if (/[?&]fitcheck\b/.test(location.search)) window.__fitDebug = (spId, stage, form, itemId) => {
    const g = new THREE.Group(), parts = ctx.petBuilder.build(g, { species: spId, stage, form, genes: {} }), it = BY_ID[itemId];
    const o = fitter.fit(D.buildOutfit(itemId), it, parts.sockets);
    return { neck: parts.sockets.neck, head: parts.sockets.head, body: parts.sockets.body, kinds: parts.sockets.keepOut.map(k => k.kind + ':' + k.r.toFixed(2) + '@' + k.c.map(x => x.toFixed(2)).join(',')), fit: o.userData.fit, check: fitter.check(o, it, parts.sockets) };
  };
  if (/[?&]fitcheck\b/.test(location.search)) window.__thumb = thumb;
  if (/[?&]fitcheck\b/.test(location.search)) window.__fitCheck = (kt = 0.02, st = 0.03) => {
    const outfits = ITEMS.filter(i => i.kind === 'outfit'), bad = []; let n = 0;
    const looks = [['baby', null], ['child', null], ['teen', null], ['adult', 'tron'], ['adult', 'nhanh'], ['adult', 'thuong']];
    for (const sp of SPECIES) for (const [stage, form] of looks) {
      const g = new THREE.Group(), parts = ctx.petBuilder.build(g, { species: sp.id, stage, form, genes: {} });
      for (const it of outfits) {
        const o = fitter.fit(D.buildOutfit(it.id), it, parts.sockets), r = fitter.check(o, it, parts.sockets); n++;
        if (r.keepOut > kt || r.sink > st) bad.push({ sp: sp.id, stage, form, item: it.id, keepOut: +r.keepOut.toFixed(3), sink: +r.sink.toFixed(3), place: o.userData.fit?.t });
      }
      disposePet(g);
    }
    return { checked: n, bad };
  };

  return { closeSheets: () => closeAll(), closeAll: () => closeAll(), f2p, update, pickVisit, thumb, isEditing: () => editing, openShop, openCooking, openClinic, openSell, openMap: () => worldMap.open(), openSocial: social.open, openAds: ads.open, openToys: toys.open, closeAll, openMail: social.openMail, openNews: social.openNews, openWardrobe, openFamily, enterEdit, closeAll, openDex, refreshOutfit: () => renderOutfit(S.outfit) };
}

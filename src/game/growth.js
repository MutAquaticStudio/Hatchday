// Lớn lên: cảnh tiến hoá khi thú sang giai đoạn mới, và thẻ loài trong bảng Chỉ số.
// Vòng đời (chia tay, trứng đời sau, gia phả) sẽ được thêm ở đây hoặc trong file mới `lifecycle.js` gọi từ onGrow.
import { S, onGrow, demoAge } from './store';
import { STAGES, STAGE_ORDER, FORMS, RARITIES, REGIONS, SPECIES_BY_ID, formFromCare } from './species';
import { isDemo } from '../data/api';
import { $, esc } from './dom.js';
import { sfx } from './audio.js';

/**
 * `c`: { evoGlow (uniform sáng trắng của shader thú), reduce, buildLook, cancelMotion, say, setTemp, spawn, impulse,
 *        addTrauma, toast, popText, buzz, getHome }.
 * Trả về { isEvolving, step(dt) → { spin, hop }, renderSpecies }.
 */
export function initGrowth(c) {
  const { evoGlow, reduce, buildLook, say, setTemp, spawn, impulse, addTrauma, toast, popText, buzz, getHome } = c;
  let evo = null;
  onGrow((from, to) => {
    if (STAGE_ORDER.indexOf(to) <= STAGE_ORDER.indexOf(from) && from !== 'elder') { buildLook(); return; }
    if (reduce) { buildLook(); growToast(to); return; }
    evo = { t: 0, swapped: false, to }; c.cancelMotion();
    say(to === 'elder' ? 'Ơ… mình thấy hơi khác…' : 'Ơ ơ… người mình nóng ran nè!', 1500); buzz(30);
  });
  function growToast(to) {
    const sp = SPECIES_BY_ID[S.species];
    const msg = to === 'adult' || (to === 'elder' && S.form) ? `${S.name} đã ${STAGES[to].name.toLowerCase()} · dáng ${FORMS[S.form || 'thuong'].name}!` : `${S.name} đã lớn thành ${STAGES[to].name}!`;
    toast(msg); popText(STAGES[to].name, '#ff8a3d');
    say(to === 'child' ? `Mình là ${sp?.name || 'bé'} Nhí nè! Vỏ trứng rơi mất rồi.` : to === 'teen' ? 'Mình cao lên rồi đó, thấy không?' : to === 'adult' ? `Ta-da! Mình trưởng thành rồi. Cảm ơn bạn đã chăm mình!` : 'Mình già rồi, nhưng vẫn thương bạn lắm.', 3600);
  }
  function step(dt) {
    if (!evo) return { spin: 0, hop: 0 };
    evo.t += dt; const T = evo.t;
    evoGlow.value = T < 1.7 ? Math.min(1, T / 1.4) * (0.75 + Math.sin(T * 18) * 0.12 * (T / 1.7)) : Math.max(0, 1 - (T - 1.7) / 0.9);
    if (T > 0.2 && Math.random() < dt * 8) spawn('sparkle', 1, 1.1);
    if (!evo.swapped && T >= 1.7) {
      evo.swapped = true; sfx('evolve'); buildLook(); impulse(-3.2); addTrauma(0.3); spawn('sparkle', 10, 1.4); spawn('heart', 3);
      const f = document.createElement('div'); f.className = 'evo-flash'; $('wipe').parentElement.appendChild(f); setTimeout(() => f.remove(), 900);
    }
    if (T >= 2.7) { evoGlow.value = 0; const to = evo.to; evo = null; setTemp('excited', 1600); growToast(to); return { spin: 0, hop: 0 }; }
    const u = Math.min(T / 1.7, 1);
    return T < 1.7 ? { spin: u * u * Math.PI * 6, hop: u * 0.5 } : { spin: 0, hop: 0 };
  }

  function renderSpecies() {
    const el = $('species-card'); if (!el) return;
    const sp = SPECIES_BY_ID[S.species] || SPECIES_BY_ID['mam-xanh'], rar = RARITIES[sp.rarity];
    const days = Math.max(0, (Date.now() - S.bornAt) / 86400000), st = S.stage;
    const next = { baby: 'child', child: 'teen', teen: 'adult' }[st];
    const left = next ? Math.max(0, STAGES[next].from - days) : 0;
    const leftTxt = left >= 1 ? `${Math.ceil(left)} ngày` : `${Math.max(1, Math.ceil(left * 24))} giờ`;
    const lean = FORMS[formFromCare(S.care)];
    el.innerHTML = `<div class="sp-head"><b>${esc(sp.name)}</b><span class="rar" style="--rc:${rar.color}">${rar.name}</span></div>
      <p class="sp-sub">${REGIONS[sp.region].name} · ${esc(S.family)} · đời ${S.generation}</p>
      <p class="sp-stage"><b>${STAGES[st].name}</b> · ${Math.floor(days)} ngày tuổi${S.form ? ` · dáng <b>${FORMS[S.form].name}</b>` : ''}</p>
      ${next ? `<p class="sp-next">Còn ${leftTxt} nữa lên <b>${STAGES[next].name}</b>${st === 'teen' ? `. Bé đang nghiêng về dáng <b>${lean.name}</b> vì ${lean.hint}.` : '.'}</p>` : st === 'elder' ? '<p class="sp-next">Bé đang ở tuổi xế chiều. Hãy dành thật nhiều thời gian bên bé nhé.</p>' : ''}
      <p class="sp-blurb">${esc(sp.blurb)}</p>
      <div class="sp-actions"><button type="button" class="pill" id="btn-dex">Sổ loài</button>${isDemo ? '<button type="button" class="pill ghost-pill" id="btn-age">Tua 1 ngày (bản thử)</button>' : ''}</div>`;
    $('btn-dex').onclick = () => { $('btn-stats').click(); getHome()?.openDex(); };
    const ab = $('btn-age'); if (ab) ab.onclick = async () => { ab.disabled = true; await demoAge(1); ab.disabled = false; renderSpecies(); };
  }
  return { isEvolving: () => !!evo, step, renderSpecies };
}

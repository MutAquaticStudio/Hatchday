import { createPet } from '../data/api';
import { viError } from '../lib/errors';
import { REGIONS, RARITIES, SPECIES_BY_ID } from '../game/species';
import '../auth/auth.css';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const eggBg = (i: number) => {
  const r = REGIONS[i], d = r.dot;
  const pattern = [`radial-gradient(circle at 30% 40%, ${d} 0 5px, transparent 6px), radial-gradient(circle at 65% 65%, ${d} 0 6px, transparent 7px)`,
    `repeating-linear-gradient(-30deg, transparent 0 10px, ${d}b3 10px 16px)`,
    `radial-gradient(circle at 50% 35%, ${d} 0 8px, transparent 9px), radial-gradient(circle at 30% 70%, ${d} 0 5px, transparent 6px)`,
    `radial-gradient(circle at 35% 35%, ${d} 0 3px, transparent 4px), radial-gradient(circle at 62% 55%, ${d} 0 4px, transparent 5px), radial-gradient(circle at 42% 75%, ${d} 0 3px, transparent 4px)`,
    `repeating-linear-gradient(90deg, transparent 0 9px, ${d}99 9px 13px)`][i];
  return `background-color:${r.color};background-image:${pattern}`;
};
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function mountOnboarding(root: HTMLElement, onDone: () => void): void {
  // 3 quả trứng ngẫu nhiên trong 5 miền. Mỗi miền có 10 loài, loài cụ thể do server bốc khi ấp.
  const offer = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
  let egg = offer[0];
  root.innerHTML = `<main class="screen"><section class="card">
    <h1>Chọn một quả trứng</h1><p class="sub">Mỗi miền có 10 loài, từ Thường tới Huyền thoại. Bé nào nở ra là duyên, và không bé nào giống bé nào.</p>
    <form novalidate>
      <div class="eggs" role="radiogroup" aria-label="Quả trứng">${offer.map((r, k) => `<button type="button" class="egg-pick" role="radio" aria-checked="${k === 0}" data-i="${r}"><span class="egg-shape" style="${eggBg(r)}"></span>${REGIONS[r].name}</button>`).join('')}</div>
      <label class="field" for="pet-name">Tên của bé<input id="pet-name" maxlength="16" placeholder="Ví dụ: Bánh Bò" autocomplete="off" aria-describedby="pet-name-err"><span class="err" id="pet-name-err"></span></label>
      <label class="field" for="family">Tên dòng họ<input id="family" maxlength="16" placeholder="Ví dụ: Nhà Mây" autocomplete="off" aria-describedby="family-err"><span class="err" id="family-err"></span></label>
      <p class="sub" style="font-size:13px">Tên dòng họ được giữ qua các thế hệ trong gia phả.</p>
      <p class="err" id="form-err" role="alert"></p>
      <button class="btn" type="submit">Ấp trứng</button>
    </form></section></main>`;
  const picks = [...root.querySelectorAll<HTMLButtonElement>('.egg-pick')];
  picks.forEach(b => b.addEventListener('click', () => { egg = Number(b.dataset.i); picks.forEach(x => x.setAttribute('aria-checked', String(x === b))); }));
  const form = root.querySelector('form')!;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = (root.querySelector<HTMLInputElement>('#pet-name')!.value || 'Bánh Bò').trim();
    const family = (root.querySelector<HTMLInputElement>('#family')!.value || 'Nhà Mây').trim();
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true; btn.textContent = 'Đang ấp…';
    try {
      const pet = await createPet(name.slice(0, 16), family.slice(0, 16), egg);
      const sp = SPECIES_BY_ID[pet.species], rar = sp ? RARITIES[sp.rarity] : null;
      const card = root.querySelector('.card')!;
      card.innerHTML = `<div class="hatch"><span class="egg-shape" style="${eggBg(egg)}"></span><p class="flash" role="status">Trứng đang động đậy…</p><p class="hatch-sp" hidden></p></div>`;
      const hatch = card.querySelector('.hatch')!;
      setTimeout(() => {
        hatch.classList.add('cracked', 'r-' + (sp?.rarity || 'thuong'));
        hatch.querySelector('.flash')!.textContent = `${name} đã chào đời!`;
        if (sp && rar) { const el = hatch.querySelector<HTMLElement>('.hatch-sp')!; el.hidden = false; el.innerHTML = `Một bé <b>${esc(sp.name)}</b> <span class="rar" style="--rc:${rar.color}">${rar.name}</span><br><i>${esc(sp.blurb)}</i>`; }
      }, reduce ? 0 : 1600);
      setTimeout(onDone, reduce ? 1800 : sp && sp.rarity !== 'thuong' ? 4600 : 3800);
    } catch (e) {
      root.querySelector('#form-err')!.textContent = viError(e);
      btn.disabled = false; btn.textContent = 'Ấp trứng';
    }
  });
}

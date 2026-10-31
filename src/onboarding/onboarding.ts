import { createPet } from '../data/api';
import { viError } from '../lib/errors';
import { PALETTES } from '../game/rules';
import '../auth/auth.css';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const eggBg = (i: number) => {
  const p = PALETTES[i];
  const pattern = ['radial-gradient(circle at 30% 40%, #fff 0 5px, transparent 6px), radial-gradient(circle at 65% 65%, #fff 0 6px, transparent 7px)',
    'repeating-linear-gradient(-30deg, transparent 0 10px, rgba(255,255,255,.7) 10px 16px)',
    'radial-gradient(circle at 50% 35%, #fff3c4 0 8px, transparent 9px), radial-gradient(circle at 30% 70%, #fff3c4 0 5px, transparent 6px)'][i];
  return `background-color:${p.body};background-image:${pattern}`;
};

export function mountOnboarding(root: HTMLElement, onDone: () => void): void {
  let egg = 0;
  root.innerHTML = `<main class="screen"><section class="card">
    <h1>Chọn một quả trứng</h1><p class="sub">Mỗi quả trứng nở ra một bé khác nhau. Không bé nào giống bé nào.</p>
    <form novalidate>
      <div class="eggs" role="radiogroup" aria-label="Quả trứng">${PALETTES.map((p, i) => `<button type="button" class="egg-pick" role="radio" aria-checked="${i === 0}" data-i="${i}"><span class="egg-shape" style="${eggBg(i)}"></span>${p.name}</button>`).join('')}</div>
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
      await createPet(name.slice(0, 16), family.slice(0, 16), egg);
      const card = root.querySelector('.card')!;
      card.innerHTML = `<div class="hatch"><span class="egg-shape" style="${eggBg(egg)}"></span><p class="flash" role="status">Trứng đang động đậy…</p></div>`;
      const hatch = card.querySelector('.hatch')!;
      setTimeout(() => { hatch.classList.add('cracked'); hatch.querySelector('.flash')!.textContent = `${name} đã chào đời!`; }, reduce ? 0 : 1600);
      setTimeout(onDone, reduce ? 300 : 2400);
    } catch (e) {
      root.querySelector('#form-err')!.textContent = viError(e);
      btn.disabled = false; btn.textContent = 'Ấp trứng';
    }
  });
}

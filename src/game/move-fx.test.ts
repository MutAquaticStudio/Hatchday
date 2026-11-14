import { describe, expect, it } from 'vitest';
import { SPECIES } from './species';
import { movesOf } from './skills';
import { allRecipes, recipeOf, moveDuration, FORM_ACT, MOTIFS, TIER_BEATS, SUPPORT_BEATS, REHIT, REHIT_MAX, isSupportForm, OTHER_BEATS, SCREEN } from './move-fx';
import { FORM_NAMES, hasShape } from './battle-forms.js';

/** Trần thời lượng theo sổ tay (docs/VFX-STYLE-GUIDE.md §3), tốc độ ×1. */
const BUDGET = [0.9, 1.6, 3.0];

describe('công thức hiệu ứng của 200 chiêu', () => {
  const all = allRecipes();
  it('mọi chiêu của mọi loài đều có công thức hợp lệ (dạng có thật, hoạ tiết có hình, màu hợp lệ)', () => {
    expect(all).toHaveLength(SPECIES.length * 4);
    for (const { move, recipe: r } of all) {
      const forms = [r.form, ...(r.then ? [r.then] : []), ...(r.strike ? [r.strike.form] : [])];
      for (const f of forms) expect(FORM_NAMES, `${move.id} ${f}`).toContain(f);
      for (const m of [r.motif, r.m2, r.strike?.motif].filter(Boolean)) { expect(MOTIFS[m as string], `${move.id} ${m}`).toBeTruthy(); expect(hasShape(m), `${move.id} ${m}`).toBe(true); }
      for (const c of [r.c, r.c2]) expect(c, move.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.element).toBe(move.element);
      // chiêu đánh thì dạng tấn công, chiêu hỗ trợ thì dạng hỗ trợ (chiêu kép có thêm đòn kèm là dạng tấn công)
      expect(isSupportForm(r.form), move.id).toBe(move.kind !== 'attack');
      if (move.kind !== 'attack' && move.power > 0) { expect(r.strike, move.id).toBeTruthy(); expect(isSupportForm(r.strike!.form)).toBe(false); }
      if (r.then) expect(isSupportForm(r.then)).toBe(false);
    }
  });
  it('thời lượng nằm trong trần của sổ tay, kể cả đòn liên hoàn 3 lần', () => {
    for (const { move, recipe: r } of all) {
      const cap = r.support && !r.strike ? SUPPORT_BEATS.budget : BUDGET[r.cls];
      expect(r.beats.budget, move.id).toBe(cap);
      expect(r.beats.total, move.id).toBeLessThanOrEqual(cap + 1e-9);
      for (const k of Object.values(r.beats)) expect(k, move.id).toBeGreaterThanOrEqual(0);
      if (move.twist === 'multi') expect(moveDuration(r, 3), move.id).toBeLessThanOrEqual(cap + REHIT * REHIT_MAX + 1e-9);
    }
    for (const f of Object.keys(FORM_ACT) as (keyof typeof FORM_ACT)[]) FORM_ACT[f].forEach((act, cls) => expect(TIER_BEATS[cls].antic + act + TIER_BEATS[cls].stop / 60 + TIER_BEATS[cls].follow, `${f} ${cls}`).toBeLessThanOrEqual(BUDGET[cls]));
    expect(OTHER_BEATS.enter).toBeLessThanOrEqual(1.0); expect(OTHER_BEATS.faint).toBeLessThanOrEqual(1.2);
  });
  it('các loài cùng hệ không dùng chung một công thức ở cùng tầng chiêu', () => {
    const seen = new Map<string, string>();
    for (const { move, recipe: r } of all) {
      const key = `${r.element}|${move.id.split('-').pop()}|${r.form}|${r.motif}|${r.k}|${r.c}`;
      expect(seen.get(key), `${move.id} trùng ${seen.get(key)}`).toBeUndefined(); seen.set(key, move.id);
    }
    // ít nhất 190/200 cặp (dạng, hoạ tiết) khác nhau trong toàn bộ bảng
    expect(new Set(all.map(x => `${x.recipe.form}|${x.recipe.motif}|${x.recipe.k}|${x.recipe.c}`)).size).toBeGreaterThanOrEqual(190);
    // mỗi hệ dùng ít nhất 12 dạng khác nhau
    for (let el = 0; el < 5; el++) expect(new Set(all.filter(x => x.recipe.element === el).map(x => x.recipe.form)).size).toBeGreaterThanOrEqual(12);
  });
  it('chiêu lạ vẫn có công thức dự phòng; luật màn hình đúng trần an toàn nhạy sáng', () => {
    expect(recipeOf({ id: 'khong-co-loai-nay-2', element: 3, kind: 'heal' }).form).toBe('bloom');
    expect(recipeOf(movesOf('cao-bac')[2]).motif).toBe('flame');
    expect(SCREEN.flashAlpha).toBeLessThanOrEqual(0.35); expect(SCREEN.flashGap).toBeGreaterThanOrEqual(1 / 3);
  });
});

import { describe, expect, it } from 'vitest';
import EN from './en.json';
import { fill, t, templateKey } from './index';

const en = EN as Record<string, string>;
const ph = (s: string) => [...new Set([...s.matchAll(/\{(\d+)/g)].map(m => m[1]))].sort();
const tags = (s: string) => [...s.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map(m => m[1]);
const attrs = (s: string) => [...s.matchAll(/\b(?:id|class|data-[\w-]+|for|type|href|src)="[^"]*"/g)].map(m => m[0]).sort();

describe('đa ngôn ngữ', () => {
  it('mọi chữ hiển thị đã bọc _t và có bản tiếng Anh (công cụ i18n-tool check)', async () => {
    const cp = await import(/* @vite-ignore */ 'node:' + 'child_process') as { execFileSync(cmd: string, args: string[], o: object): unknown };
    expect(() => cp.execFileSync('node', ['scripts/i18n-tool.mjs', 'check'], { stdio: 'pipe' })).not.toThrow();
  });
  it('bản dịch giữ đủ tham số {n}, thẻ HTML và thuộc tính kỹ thuật (id, class, data-*…)', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(en)) {
      if (!v.trim()) bad.push(`trống: ${k.slice(0, 60)}`);
      if (ph(k).join() !== ph(v).join()) bad.push(`tham số: ${k.slice(0, 60)}`);
      if (tags(k).join() !== tags(v).join()) bad.push(`thẻ: ${k.slice(0, 60)}`);
      if (attrs(k).join() !== attrs(v).join()) bad.push(`thuộc tính: ${k.slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });
  it('bản tiếng Anh không còn chữ tiếng Việt (trừ tên riêng giữ nguyên có chủ đích)', () => {
    const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
    const allowed = /Tiếng Việt|Ngôn ngữ|Ung ho Hatchday|Bống bống bang bang/;
    const left = Object.entries(en).filter(([, v]) => VI.test(v.replace(/(href|src|for|id|data-[\w-]+)="[^"]*"/g, '')) && !allowed.test(v)).map(([k]) => k.slice(0, 60));
    expect(left).toEqual([]);
  });
  it('khuôn: tham số đổi thứ tự và số nhiều', () => {
    expect(fill('{1} of {0}', ['a', 'b'])).toBe('b of a');
    expect(fill('{0} {0|day|days}', [1])).toBe('1 day');
    expect(fill('{0} {0|day|days}', [3])).toBe('3 days');
    expect(templateKey(['Còn ', ' ngày nữa lên ', ''])).toBe('Còn {0} ngày nữa lên {1}');
  });
  it('ngôn ngữ mặc định khi chạy test là tiếng Việt: _t trả nguyên câu', () => {
    expect(t('Chỉ số')).toBe('Chỉ số');
    const n = 2;
    expect(t`Còn ${n} ngày`).toBe('Còn 2 ngày');
  });
});

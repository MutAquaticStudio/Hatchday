import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/** Nạp public/sw.js vào một `self` giả để kiểm tra bộ xử lý push và notificationclick (không cần trình duyệt). */
function loadSw() {
  const listeners: Record<string, (e: any) => void> = {};
  const shown: { title: string; opts: any }[] = [];
  const focused: string[] = [], opened: string[] = [], messages: unknown[] = [];
  const clients = { list: [] as any[], matchAll: async () => clients.list, openWindow: async (u: string) => { opened.push(u); }, claim: async () => {} };
  const self: any = {
    addEventListener: (t: string, fn: (e: any) => void) => { listeners[t] = fn; }, location: { origin: 'https://hatchday.noxelis.co' }, skipWaiting: () => {},
    registration: { showNotification: async (title: string, opts: any) => { shown.push({ title, opts }); } }, clients,
  };
  new Function('self', 'caches', 'fetch', readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'))(self, { keys: async () => [], open: async () => ({}) }, vi.fn());
  const fire = async (type: string, e: Record<string, unknown> = {}) => { const waits: Promise<unknown>[] = []; listeners[type]({ ...e, waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits); };
  return { fire, shown, focused, opened, messages, clients };
}

describe('service worker: thông báo đẩy', () => {
  it('push hiển thị tiêu đề, nội dung, nhãn, biểu tượng và đường dẫn đúng', async () => {
    const sw = loadSw();
    await sw.fire('push', { data: { json: () => ({ title: 'Hatchday', body: 'Bé Bánh Bò đói rồi, ghé cho bé ăn nhé.', tag: 'care', url: './?from=push&k=care' }) } });
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('Hatchday');
    expect(sw.shown[0].opts).toMatchObject({ body: 'Bé Bánh Bò đói rồi, ghé cho bé ăn nhé.', tag: 'care', icon: './icon.svg', data: { url: './?from=push&k=care' } });
  });
  it('thông điệp rỗng hoặc hỏng vẫn hiện thông báo mặc định, không làm SW đổ', async () => {
    const sw = loadSw();
    await sw.fire('push', {}); await sw.fire('push', { data: { json: () => { throw new Error('không phải JSON'); } } });
    expect(sw.shown).toHaveLength(2);
    for (const n of sw.shown) expect(n).toMatchObject({ title: 'Hatchday', opts: { tag: 'hatchday', data: { url: './' } } });
  });
  it('bấm thông báo: đóng nó, đưa trang đang mở lên trước; chưa có trang thì mở đường dẫn', async () => {
    const sw = loadSw(); let closed = 0, focus = 0;
    await sw.fire('notificationclick', { notification: { close: () => { closed++; }, data: { url: './?from=push' } } });
    expect(closed).toBe(1); expect(sw.opened).toEqual(['./?from=push']);
    sw.clients.list = [{ focus: async () => { focus++; } }];
    await sw.fire('notificationclick', { notification: { close: () => { closed++; }, data: { url: './?from=push' } } });
    expect(focus).toBe(1); expect(sw.opened).toHaveLength(1);
  });
  it('đăng ký push bị đổi: báo cho mọi trang đang mở đăng ký lại', async () => {
    const sw = loadSw(); const got: unknown[] = [];
    sw.clients.list = [{ postMessage: (m: unknown) => got.push(m) }, { postMessage: (m: unknown) => got.push(m) }];
    await sw.fire('pushsubscriptionchange');
    expect(got).toEqual([{ type: 'resubscribe' }, { type: 'resubscribe' }]);
  });
});

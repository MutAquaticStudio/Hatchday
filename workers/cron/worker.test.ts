import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Worker viết bằng JS thuần
import worker, { pushJob, runTick } from './worker.js';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' };

describe('worker cron', () => {
  it('gọi cron_tick với khoá service_role', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }));
    const r = await runTick(env);
    expect(r.cron_tick).toEqual({ ok: true });
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/rpc/cron_tick');
    expect((calls[0].init.headers as Record<string, string>).apikey).toBe('svc');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer svc');
    vi.unstubAllGlobals();
  });
  it('push: chọn → gửi từng thiết bị → báo kết quả; lỗi gửi vẫn được báo; thiếu VAPID thì bỏ qua', async () => {
    const e2 = { ...env, VAPID_PUBLIC: 'pub', VAPID_PRIVATE_JWK: JSON.stringify({ kty: 'EC' }) };
    const items = [{ sub_id: 1, log_id: 10, endpoint: 'https://p/1', p256dh: 'k', auth: 'a', payload: { title: 'T' } }, { sub_id: 2, log_id: 10, endpoint: 'https://p/2', p256dh: 'k', auth: 'a', payload: { title: 'T' } }];
    const calls: { fn: string; body: any }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { const fn = url.split('/rpc/')[1]; calls.push({ fn, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify(fn === 'push_pick' ? items : null), { status: 200 }); }));
    const sent: string[] = [];
    const r = await pushJob(e2, async (sub: { endpoint: string }) => { sent.push(sub.endpoint); if (sub.endpoint.endsWith('/2')) throw new Error('mạng'); return { ok: true, status: 201 }; });
    expect(r).toEqual({ picked: 2, ok: 1, fail: 1 }); expect(sent).toEqual(['https://p/1', 'https://p/2']);
    expect(calls.filter(c => c.fn === 'push_mark').map(c => c.body)).toEqual([{ p_sub: 1, p_log: 10, p_ok: true, p_status: 201 }, { p_sub: 2, p_log: 10, p_ok: false, p_status: 0 }]);
    expect(calls[0]).toMatchObject({ fn: 'push_pick', body: { p_limit: 5 } });
    expect(await pushJob(env)).toEqual({ skipped: 'chưa có khoá VAPID' });
    vi.unstubAllGlobals();
  });
  it('lỗi máy chủ không làm đổ Worker, trả về lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await runTick(env); expect(r.cron_tick.error).toContain('500'); spy.mockRestore(); vi.unstubAllGlobals();
  });
  it('chỉ có /health, không lộ gì khác', async () => {
    expect((await worker.fetch(new Request('https://w/health'))).status).toBe(200);
    expect((await worker.fetch(new Request('https://w/x'))).status).toBe(404);
  });
});

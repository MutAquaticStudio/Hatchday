import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Worker viết bằng JS thuần
import worker, { runTick } from './worker.js';

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

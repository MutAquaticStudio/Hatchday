// Worker định kỳ của Hatchday (Cloudflare Cron Trigger, mỗi 15 phút). Gọi các hàm chỉ-service_role trên Supabase:
//   cron_tick() : lấy mẫu số người ở nơi chung, tổng hợp thống kê hôm nay/hôm qua, dọn dẹp dữ liệu cũ.
// Cần biến: SUPABASE_URL (thường), SUPABASE_SERVICE_KEY (secret). Triển khai: xem workers/cron/README.md.
// Worker không có đường vào công khai nào ngoài /health (không lộ gì).

async function rpc(env, fn, args = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export async function runTick(env) {
  const out = {};
  for (const [name, job] of Object.entries({ cron_tick: () => rpc(env, 'cron_tick') })) {
    try { out[name] = await job(); } catch (e) { out[name] = { error: String(e && e.message || e) }; console.error(name, out[name].error); }
  }
  return out;
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runTick(env)); },
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    return new Response('Not found', { status: 404 });
  },
};

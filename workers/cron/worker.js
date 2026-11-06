// Worker định kỳ của Hatchday (Cloudflare Cron Trigger, mỗi 15 phút). Gọi các hàm chỉ-service_role trên Supabase:
//   cron_tick()          : lấy mẫu số người ở nơi chung, tổng hợp thống kê hôm nay/hôm qua, dọn dẹp dữ liệu cũ;
//   push_pick/push_mark  : chọn người cần nhắc (bé cần chăm, thư, sự kiện), gửi Web Push, báo kết quả.
// Biến: SUPABASE_URL (thường), SUPABASE_SERVICE_KEY (secret); cho push: VAPID_PUBLIC (thường), VAPID_PRIVATE_JWK (secret, JSON), VAPID_SUBJECT (thường, tuỳ chọn).
// Thiếu khoá VAPID thì bỏ qua phần push. Worker không có đường vào công khai nào ngoài /health. Triển khai: xem workers/cron/README.md.
import { sendWebPush } from './webpush.js';

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

// Mỗi lượt chọn tối đa 5 người (mỗi người ≤ 5 thiết bị) để giữ số lần gọi con dưới giới hạn của gói Workers miễn phí (50).
export async function pushJob(env, sender = sendWebPush) {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return { skipped: 'chưa có khoá VAPID' };
  const items = await rpc(env, 'push_pick', { p_limit: 5 });
  if (!Array.isArray(items) || !items.length) return { picked: 0, ok: 0, fail: 0 };
  const vapid = { publicKey: env.VAPID_PUBLIC, privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK), subject: env.VAPID_SUBJECT || 'https://hatchday.noxelis.co' };
  let ok = 0, fail = 0;
  for (const it of items) {
    let r;
    try { r = await sender({ endpoint: it.endpoint, p256dh: it.p256dh, auth: it.auth }, it.payload, vapid); } catch { r = { ok: false, status: 0 }; }
    try { await rpc(env, 'push_mark', { p_sub: it.sub_id, p_log: it.log_id, p_ok: r.ok, p_status: r.status }); } catch (e) { console.error('push_mark', String(e.message || e)); }
    if (r.ok) ok++; else fail++;
  }
  return { picked: items.length, ok, fail };
}

export async function runTick(env, sender) {
  const out = {};
  for (const [name, job] of Object.entries({ cron_tick: () => rpc(env, 'cron_tick'), push: () => pushJob(env, sender) })) {
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

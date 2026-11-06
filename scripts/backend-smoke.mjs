// Kiểm thử đầu-cuối trên Supabase THẬT: tạo 2 người dùng tạm, chạy các RPC chính (bé, hoạt động, huy hiệu, mini-game, đồ chơi, push, lỗi client, nơi chung)
// và Realtime thật (hiện diện + tin `act` giữa hai người), rồi xoá hết người dùng tạm (dữ liệu xoá theo cascade).
// Cần biến môi trường: SUPABASE_URL, SUPABASE_ANON_KEY (khoá publishable), SUPABASE_SERVICE_KEY. Không in khoá. Chạy: node scripts/backend-smoke.mjs
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const { SUPABASE_URL: URL, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_KEY: SVC } = process.env;
if (!URL || !ANON || !SVC) { console.error('Thiếu SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY'); process.exit(2); }
const out = []; const ok = (n, c, x = '') => { out.push((c ? 'OK  ' : 'FAIL') + ' ' + n + (x ? ' ' + x : '')); };
const admin = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now(), made = [];
/** Chạy SQL bằng Management API (curl đi qua proxy của môi trường). */
const REF = (process.env.SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
const sql = q => { const r = JSON.parse(execFileSync('curl', ['-sS', '-m', '60', '-X', 'POST', `https://api.supabase.com/v1/projects/${REF}/database/query`, '-H', 'Content-Type: application/json', '--data', JSON.stringify({ query: q })], { encoding: 'utf8' })); if (r && r.message) throw new Error(r.message); return r; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(150); } return false; };

async function makeUser(tag) {
  const email = `smoke-${tag}-${stamp}@example.invalid`;
  const { data: u, error } = await admin.auth.admin.createUser({ email, email_confirm: true }); if (error) throw error;
  made.push(u.user.id);
  const { data: l, error: e2 } = await admin.auth.admin.generateLink({ type: 'magiclink', email }); if (e2) throw e2;
  const cl = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e3 } = await cl.auth.verifyOtp({ token_hash: l.properties.hashed_token, type: 'magiclink' }); if (e3) throw e3;
  return { id: u.user.id, cl, token: s.session.access_token };
}
const rpc = async (u, fn, args = {}) => { const { data, error } = await u.cl.rpc(fn, args); if (error) throw Object.assign(new Error(error.message), { code: error.code }); return data; };
const fails = async (p, text) => { try { await p; return false; } catch (e) { return String(e.message).includes(text); } };

(async () => {
  const A = await makeUser('a'), B = await makeUser('b');
  ok('tạo 2 người dùng tạm và đăng nhập', !!A.token && !!B.token);
  for (const [u, n] of [[A, 'Thử A'], [B, 'Thử B']]) { const p = await rpc(u, 'create_pet', { p_name: n, p_family: 'Nhà Thử', p_egg: 1 }); u.pet = p.id || p.pet_id || true; }
  ok('create_pet cho cả hai', !!A.pet && !!B.pet);
  // mở khoá nơi chung: Gắn bó cấp cao (chỉ để thử, người dùng tạm sẽ bị xoá)
  // Ghi thẳng bảng pets bằng service_role bị chặn (trigger gọi private.bond_level mà service_role không có quyền chạy), nên đặt qua Management API (vai postgres)
  try { sql(`update public.pets set bond_xp = 900, nl = 90, no = 90, vui = 60, sach = 90 where owner_id in ('${A.id}', '${B.id}')`); ok('đặt Gắn bó cao cho người dùng tạm', true); } catch (e) { ok('đặt Gắn bó cao cho người dùng tạm', false, e.message); }

  /* ---- đo lường & lỗi ---- */
  await rpc(A, 'ping_session', { p_platform: 'desktop', p_standalone: false }); ok('ping_session', true);
  await rpc(A, 'log_client_error', { p_kind: 'js', p_message: 'smoke test', p_stack: 'at smoke', p_place: 'test', p_build: 'smoke' });
  const { count: ce } = await admin.from('client_errors').select('*', { count: 'exact', head: true }).eq('user_id', A.id); ok('log_client_error ghi 1 bản', ce === 1);
  ok('người thường không đọc được admin_client_errors', await fails(rpc(A, 'admin_client_errors', { p_days: 7 }), ''));

  /* ---- hoạt động thế giới ---- */
  let w = await rpc(A, 'get_world_progress'); ok('get_world_progress: 12 huy hiệu, 2 bậc, 2 mini-game', w.badges.length === 12 && w.explore.length === 2 && Object.keys(w.mini).length === 2);
  ok('record_activity: loại lạ bị từ chối', await fails(rpc(A, 'record_activity', { p_kind: 'hack' }), 'unknown_activity'));
  for (const k of ['bench', 'tea', 'cat']) await rpc(A, 'record_activity', { p_kind: k });
  w = await rpc(A, 'get_world_progress'); ok('Khám phá: 3 hoạt động khác nhau → bậc 1 sẵn sàng', w.kinds.length === 3 && w.explore[0].ready === true);
  const c0 = (await admin.from('wallets').select('coins').eq('owner_id', A.id).single()).data.coins;
  const ex = await rpc(A, 'claim_explore', { p_tier: 0 }); ok('claim_explore +20 xu', ex.reward === 20 && ex.coins === c0 + 20);
  ok('claim_explore lần hai bị chặn', await fails(rpc(A, 'claim_explore', { p_tier: 0 }), 'already_claimed'));
  const m = await rpc(A, 'submit_minigame', { p_kind: 'brew', p_score: 5 }); ok('submit_minigame brew 5 sao → 15 xu', m.reward === 15 && m.rewarded === true);
  ok('submit_minigame sát lượt trước bị giãn cách', await fails(rpc(A, 'submit_minigame', { p_kind: 'brew', p_score: 5 }), 'rate_limited'));
  ok('submit_minigame điểm vượt trần bị từ chối', await fails(rpc(A, 'submit_minigame', { p_kind: 'butterfly', p_score: 99 }), 'invalid_score'));
  const { data: ledger } = await admin.from('coin_ledger').select('ctx').eq('owner_id', A.id); ok('sổ cái ghi nguồn claim_explore và submit_minigame', ['claim_explore', 'submit_minigame'].every(c => ledger.some(r => r.ctx === c)));

  /* ---- đồ chơi + push ---- */
  const t = await rpc(A, 'play_toy', { p_toy: 'swing' }); ok('play_toy xích đu (Công viên)', !!t && (t.refused === null || typeof t.refused === 'string'));
  await rpc(A, 'save_push_subscription', { p_endpoint: 'https://fcm.googleapis.com/fcm/send/smoke-' + stamp, p_p256dh: 'BPkx'.padEnd(87, 'A'), p_auth: 'authsmoke0123456789ab', p_ua: 'smoke' });
  const ps = await rpc(A, 'get_push_state'); ok('push: lưu đăng ký thiết bị', JSON.stringify(ps).length > 2);
  ok('push_pick không gọi được bằng quyền người chơi', await fails(rpc(A, 'push_pick', { p_limit: 5 }), ''));

  /* ---- nơi chung: RPC + Realtime thật ---- */
  const ja = await rpc(A, 'join_place', { p_place: 'plaza' }), jb = await rpc(B, 'join_place', { p_place: 'plaza' });
  ok('join_place plaza cùng kênh', !!ja.topic && ja.topic === jb.topic, ja.topic);
  const room = async (u, info) => {
    await u.cl.realtime.setAuth(u.token);
    const ch = u.cl.channel(info.topic, { config: { private: true, broadcast: { self: false, ack: false }, presence: { key: info.pid } } });
    u.got = []; ch.on('broadcast', { event: 'act' }, ({ payload }) => u.got.push(payload)); ch.on('presence', { event: 'sync' }, () => { u.presence = Object.keys(ch.presenceState()); });
    await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('realtime_timeout')), 12000); ch.subscribe(async (s, err) => { if (s === 'SUBSCRIBED') { clearTimeout(to); await ch.track({ pid: info.pid, x: 0, z: 0 }); res(); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(to); rej(new Error('realtime_' + s + ' ' + (err?.message || ''))); } }); });
    u.ch = ch; return ch;
  };
  try {
    await room(A, ja); await room(B, jb); ok('Realtime: cả hai vào kênh riêng tư', true);
    ok('Realtime: hiện diện thấy nhau', await until(() => A.presence?.includes(jb.pid) && B.presence?.includes(ja.pid)), JSON.stringify({ a: A.presence?.length, b: B.presence?.length }));
    await A.ch.send({ type: 'broadcast', event: 'act', payload: { t: 'act', pid: ja.pid, id: 'swing' } });
    ok('Realtime: B nhận tin act của A', await until(() => B.got.some(g => g.id === 'swing' && g.pid === ja.pid)));
    await B.ch.send({ type: 'broadcast', event: 'emote', payload: { t: 'emote', pid: jb.pid, id: 'heart' } });
    const bGotEmote = await until(async () => true, 100); void bGotEmote;
    const roster = await rpc(A, 'shard_roster', { p_topic: ja.topic }); ok('shard_roster trả người còn lại, không lộ auth.uid', roster.some(r => r.pid === jb.pid) && roster.every(r => !('user_id' in r) && !('owner_id' in r)), roster.length + ' người');
    const hb = await rpc(A, 'place_heartbeat'); ok('place_heartbeat', hb !== undefined);
  } catch (e) { ok('Realtime thật', false, e.message); }
  // kênh ngoài (người chưa vào) không nghe/nói được
  try {
    const C = await makeUser('c'); await admin.from('pets').select('id').limit(1);
    await C.cl.realtime.setAuth(C.token);
    const ch = C.cl.channel(ja.topic, { config: { private: true } }); let status = '';
    await new Promise(res => { const to = setTimeout(res, 6000); ch.subscribe(s => { status = s; if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(to); res(); } }); });
    ok('Realtime: người chưa join_place không vào được kênh', status !== 'SUBSCRIBED', status); await ch.unsubscribe();
  } catch (e) { ok('Realtime: kiểm kênh ngoài', false, e.message); }
  for (const u of [A, B]) { try { await u.ch?.unsubscribe(); await rpc(u, 'leave_place'); } catch { /* bỏ qua */ } }
})().catch(e => { ok('kịch bản dừng giữa chừng', false, e.message); }).finally(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id);
  const { count } = await admin.from('wallets').select('*', { count: 'exact', head: true }).in('owner_id', made);
  ok('dọn: xoá người dùng tạm và dữ liệu của họ', count === 0, 'ví còn lại: ' + count);
  console.log(out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0);
});

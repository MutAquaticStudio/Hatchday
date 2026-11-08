// Edge Function steam-auth (Deno). Biến môi trường: STEAM_WEB_API_KEY (khoá Web API của nhà phát hành), STEAM_APP_ID;
// SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY do Supabase tự cấp. Triển khai: supabase functions deploy steam-auth --no-verify-jwt
// (người chơi chưa có phiên khi gọi; hàm tự kiểm vé Steam). Lõi ở logic.ts (có test).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { AuthError, steamLogin, type Admin } from './logic.ts';

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const key = Deno.env.get('STEAM_WEB_API_KEY'), appId = Deno.env.get('STEAM_APP_ID');
  if (!key || !appId) return json({ error: 'not_configured' }, 503);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const admin: Admin = {
    async findUserBySteam(steamId) { const { data } = await sb.from('steam_accounts').select('user_id').eq('steam_id', steamId).maybeSingle(); return data?.user_id ?? null; },
    async createUser(email, meta) { const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta }); if (error || !data.user) throw new AuthError('create_failed', 500); return data.user.id; },
    async link(steamId, userId) { const { error } = await sb.from('steam_accounts').insert({ steam_id: steamId, user_id: userId }); if (error) throw new AuthError('link_failed', 500); },
    async touch(steamId) { await sb.from('steam_accounts').update({ last_login_at: new Date().toISOString() }).eq('steam_id', steamId); },
    async emailOf(userId) { const { data } = await sb.auth.admin.getUserById(userId); return data.user?.email ?? null; },
    async magicLinkHash(email) { const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email }); if (error || !data.properties?.hashed_token) throw new AuthError('link_failed', 500); return data.properties.hashed_token; },
  };
  try {
    const { ticket } = await req.json();
    const r = await steamLogin(String(ticket || ''), { webApiKey: key, appId }, (u: string) => fetch(u), admin);
    return json({ token_hash: r.token_hash, created: r.created });
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.code }, e.status);
    return json({ error: 'server' }, 500);
  }
});

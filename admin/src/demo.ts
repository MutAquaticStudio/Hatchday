/** Bộ chạy thử trong bộ nhớ cho trang quản trị (không cần máy chủ). Dữ liệu giả, không phải người thật. Vai trò chọn bằng ?role=owner|ops|support|moderator|analyst. */
import { can, type Action, type Role } from './rbac';
import { demoOverview } from './demo-dash';

const role: Role = (new URLSearchParams(location.search).get('role') as Role) || 'owner';
const now = () => new Date().toISOString();
let nid = 100;
const players = [
  { user_id: 'u1', name: 'Bánh Bò', code: 'BANHBOX2', species: 'mam-xanh', bond_level: 5, email: 'banhbo@example.com' },
  { user_id: 'u2', name: 'Nắng', code: 'NANGVANG', species: 'ong-mat', bond_level: 3, email: 'nang@example.com' },
  { user_id: 'u3', name: 'Mây', code: 'MAYXANH2', species: 'co-may', bond_level: 8, email: 'may@example.com' },
];
const S = {
  chat: [
    { id: 3, at: now(), user_id: 'u2', topic: 'plaza:1', body: 'ai chơi bóng không', name: 'Nắng' },
    { id: 2, at: now(), user_id: 'u1', topic: 'plaza:1', body: 'chào cả nhà', name: 'Bánh Bò' },
    { id: 1, at: now(), user_id: 'u3', topic: 'tea:1', body: 'trà hôm nay thơm quá', name: 'Mây' },
  ] as any[],
  audit: [] as any[], ann: [] as any[], events: [] as any[], campaigns: [] as any[], sanctions: [] as any[], words: [] as any[],
  reports: [{ id: 1, kind: 'player', reason: 'harassment', detail: 'nhắn tin làm phiền', status: 'open', at: now(), reporter: 'Bánh Bò', target_id: 'u2', target: 'Nắng', target_open_reports: 1 }] as any[],
  flags: { 'chat.public.enabled': false, 'chat.dm.enabled': true, 'places.enabled': true, 'ads.enabled': false, 'push.enabled': false, 'campaign.approval': { users: 50, coins: 500 }, 'site.info': { contact_email: 'm.thuanwork@gmail.com' } } as Record<string, unknown>,
  tickets: [
    { id: 1, user_id: 'u2', kind: 'bug', subject: 'Bé kẹt ở Công viên', status: 'open', created_at: now(), updated_at: now(), seen: false, meta: { platform: 'android', screen: '390x844@3', place: 'Công viên', build: 'demo' },
      messages: [{ from_admin: false, body: 'Bé đứng yên gần ao vịt, bấm đâu cũng không đi được ạ.', at: now() }] },
    { id: 2, user_id: 'u3', kind: 'feedback', subject: 'Thêm mini-game nấu ăn', status: 'answered', created_at: now(), updated_at: now(), seen: true, meta: { platform: 'desktop' },
      messages: [{ from_admin: false, body: 'Mình mong có trò nấu ăn theo công thức!', at: now() }, { from_admin: true, body: 'Cảm ơn bạn, đội ngũ đã ghi nhận ý tưởng.', at: now(), by: 'owner@example.com' }] },
  ] as any[],
  flagMeta: {} as Record<string, { at: string; reason: string; by: string }>,
  balance: [
    ['ads.reward', 20, 5, 100, 'xu', 'Thưởng mỗi lượt xem quảng cáo', 'Quảng cáo', 'Không bị nhân bởi sự kiện nhân xu nhiệm vụ.'], ['ads.per_day', 5, 0, 20, 'lượt', 'Số lượt xem tối đa mỗi ngày', 'Quảng cáo', '0 = không ai nhận được thưởng.'],
    ['ads.gap_minutes', 10, 0, 120, 'phút', 'Giãn cách giữa hai lượt', 'Quảng cáo', ''], ['ads.min_watch_seconds', 15, 5, 60, 'giây', 'Thời gian xem tối thiểu', 'Quảng cáo', ''],
    ['ads.ecpm_usd', 1, 0, 50, 'USD', 'eCPM ước tính (cho ARPDAU)', 'Quảng cáo', 'Chỉ dùng để ước tính trên dashboard.'], ['care.daily_cap', 50, 10, 200, 'xu', 'Trần xu chăm sóc mỗi ngày', 'Kinh tế', ''],
    ['sell.daily_cap', 80, 20, 400, 'xu', 'Trần bán rau mỗi ngày', 'Kinh tế', ''], ['alert.dau_drop_pct', 20, 5, 80, '%', 'Cảnh báo DAU giảm hơn', 'Cảnh báo', ''],
    ['alert.ads_per_user', 4.5, 1, 20, 'lượt', 'Cảnh báo lượt quảng cáo/người vượt', 'Cảnh báo', ''], ['alert.coin_ratio', 1.3, 1.05, 3, 'lần', 'Cảnh báo xu kiếm/xu tiêu vượt', 'Cảnh báo', ''],
    ['alert.reports_per_day', 10, 1, 100, 'báo cáo', 'Cảnh báo báo cáo mỗi ngày vượt', 'Cảnh báo', ''],
  ].map(([key, v, min, max, unit, label, grp, note]) => ({ key, value: v, def: v, min, max, unit, label, grp, note, updated_at: null as string | null, by: '' })) as any[],
  roles: [{ user_id: 'a1', role: 'owner', email: 'owner@example.com', since: now() }] as any[],
};
const audit = (action: string, target: string | null, after: unknown, reason: string | null) => S.audit.unshift({ id: ++nid, admin: `${role}@example.com`, action, target, before: null, after, reason, at: now() });
const need = (a: Action) => { if (!can(role, a)) throw new Error('forbidden'); };
const why = (r: unknown) => { if (!r || String(r).trim().length < 3) throw new Error('reason_required'); };

export async function demoRpc(fn: string, a: Record<string, any>): Promise<any> {
  await new Promise(r => setTimeout(r, 30));
  switch (fn) {
    case 'admin_me': return { role, mfa: true };
    case 'admin_dashboard_stats': need('dashboard'); return { players: players.length, new_today: 1, pets_alive: 3, ill_now: 1, ill_by_type: { 'dau-bung': 1 }, species_top: [{ species: 'mam-xanh', n: 2 }], coins_total: 4200, friends: 4, gifts_7d: 6, mail_unclaimed: 2, reports_open: S.reports.filter(r => r.status === 'open').length, sanctions_active: S.sanctions.length, events_live: S.events.filter(e => e.enabled).length };
    case 'admin_search_user': need('search'); if (String(a.p_q).trim().length < 2) throw new Error('query_too_short');
      return players.filter(p => p.name.toLowerCase().includes(String(a.p_q).toLowerCase()) || p.code === String(a.p_q).toUpperCase()).map(p => ({ ...p, email: ['owner', 'ops', 'support'].includes(role) ? p.email : null }));
    case 'admin_get_user': { need('get_user'); const p = players.find(x => x.user_id === a.p_user); if (!p) throw new Error('not_found'); audit('view_user', p.user_id, null, null);
      return { profile: { display_name: p.name, friend_code: p.code, species: p.species, bond_level: p.bond_level }, email: ['owner', 'ops', 'support'].includes(role) ? p.email : null, coins: 320, pet: { stage: 'child', illness: null, bond_xp: 300, no: 62, vui: 70, sach: 80, nl: 55 }, friends: 2, mail: [], sanctions: [], reports_against: 0 }; }
    case 'admin_grant': need('grant'); why(a.p_reason); if (role !== 'owner' && (a.p_coins > 200)) throw new Error('grant_limit'); audit('grant', a.p_user, { coins: a.p_coins }, a.p_reason); return ++nid;
    case 'admin_preview_audience': need('campaign'); return a.p_audience?.all ? players.length : a.p_audience?.min_bond ? players.filter(p => p.bond_level >= a.p_audience.min_bond).length : (a.p_audience?.codes || []).length;
    case 'admin_create_campaign': { need('campaign'); why(a.p_reason); const n = a.p_audience?.all ? players.length : a.p_audience?.min_bond ? players.filter(p => p.bond_level >= a.p_audience.min_bond).length : (a.p_audience?.codes || []).length;
      if (!n) throw new Error('empty_audience'); const big = n > 2 || a.p_coins > 500; const c = { id: ++nid, title: a.p_title, coins: a.p_coins, items: a.p_items, audience: a.p_audience, status: big ? 'pending' : 'sent', recipients: n, created_at: now(), created_by: role };
      S.campaigns.unshift(c); audit('campaign_create', String(c.id), { recipients: n }, a.p_reason); return { id: c.id, status: c.status, recipients: n }; }
    case 'admin_list_campaigns': need('campaign'); return S.campaigns;
    case 'admin_approve_campaign': { need('campaign'); why(a.p_reason); const c = S.campaigns.find(x => x.id === a.p_id); if (!c) throw new Error('not_found'); if (c.status !== 'pending') throw new Error('not_pending');
      if (c.created_by === role) throw new Error('self_approval'); c.status = 'sent'; audit('campaign_approve', String(c.id), null, a.p_reason); return c.recipients; }
    case 'admin_cancel_campaign': { need('campaign'); why(a.p_reason); const c = S.campaigns.find(x => x.id === a.p_id && x.status === 'pending'); if (!c) throw new Error('not_pending'); c.status = 'cancelled'; audit('campaign_cancel', String(c.id), null, a.p_reason); return null; }
    case 'admin_list_announcements': need('announce'); return S.ann;
    case 'admin_upsert_announcement': { need('announce'); why(a.p_reason); if (String(a.p_title || '').trim().length < 2) throw new Error('invalid_announcement');
      const row = { id: a.p_id ?? ++nid, kind: a.p_kind, title: a.p_title, body: a.p_body, starts_at: a.p_starts || now(), ends_at: a.p_ends, pinned: !!a.p_pinned, min_bond: a.p_min_bond || 1 };
      const i = S.ann.findIndex(x => x.id === row.id); if (i >= 0) S.ann[i] = row; else S.ann.unshift(row); audit('announce_' + (a.p_id ? 'update' : 'create'), String(row.id), { title: a.p_title }, a.p_reason); return row.id; }
    case 'admin_delete_announcement': { need('announce'); why(a.p_reason); const i = S.ann.findIndex(x => x.id === a.p_id); if (i < 0) throw new Error('not_found'); S.ann.splice(i, 1); audit('announce_delete', String(a.p_id), null, a.p_reason); return null; }
    case 'admin_list_events': need('event'); return S.events;
    case 'admin_upsert_event': { need('event'); why(a.p_reason); for (const k of Object.keys(a.p_config || {})) if (!['banner', 'plaza_decor', 'coin_boost', 'shop_discount', 'epidemic', 'goal'].includes(k)) throw new Error('invalid_event_config');
      const row = { id: a.p_id ?? ++nid, title: a.p_title, body: a.p_body, kind: a.p_kind, starts_at: a.p_starts, ends_at: a.p_ends, enabled: true, config: a.p_config || {} }; S.events.unshift(row); audit('event_create', String(row.id), { title: a.p_title }, a.p_reason); return row.id; }
    case 'admin_set_event_enabled': { need('event'); why(a.p_reason); const e = S.events.find(x => x.id === a.p_id); if (!e) throw new Error('not_found'); e.enabled = a.p_enabled; audit('event_enabled', String(a.p_id), a.p_enabled, a.p_reason); return null; }
    case 'admin_list_reports': need('report'); return S.reports.filter(r => r.status === a.p_status);
    case 'admin_resolve_report': { need('report'); why(a.p_reason); const r = S.reports.find(x => x.id === a.p_id); if (!r) throw new Error('not_found'); if (r.status !== 'open') throw new Error('not_open');
      r.status = a.p_action === 'dismiss' ? 'dismissed' : 'resolved'; if (a.p_action !== 'dismiss') S.sanctions.unshift({ id: ++nid, user_id: r.target_id, name: r.target, kind: a.p_action, until: now(), reason: a.p_reason, auto: false }); audit('report_' + a.p_action, String(r.id), null, a.p_reason); return null; }
    case 'admin_list_sanctions': need('sanction'); return S.sanctions;
    case 'admin_lift_sanction': { need('sanction'); why(a.p_reason); const i = S.sanctions.findIndex(x => x.id === a.p_id); if (i < 0) throw new Error('not_found'); S.sanctions.splice(i, 1); audit('sanction_lift', String(a.p_id), null, a.p_reason); return null; }
    case 'admin_chat_log': { need('report'); const q = String(a.p_q || '').toLowerCase().replace(/[%_]/g, ''); audit('view_chat_log', a.p_user ?? null, { q }, null);
      return S.chat.filter(m => (!a.p_user || m.user_id === a.p_user) && (!q || m.body.toLowerCase().includes(q))).slice(0, Math.min(Math.max(a.p_limit || 100, 1), 200)).map(m => ({ ...m, sanctioned: S.sanctions.some(s => s.user_id === m.user_id) })); }
    case 'admin_chat_filter_stats': need('report'); return { messages_24h: S.chat.length, senders_24h: new Set(S.chat.map(m => m.user_id)).size, blocked: { link: 4, phone: 2, filtered: 3 }, auto_mutes_24h: S.sanctions.filter(s => s.auto).length, words: S.words.length };
    case 'admin_sanction': { need('sanction'); why(a.p_reason); if (!(a.p_hours > 0)) throw new Error('invalid_sanction'); const p = players.find(x => x.user_id === a.p_user); S.sanctions.unshift({ id: ++nid, user_id: a.p_user, name: p?.name ?? '—', kind: a.p_kind, until: new Date(Date.now() + a.p_hours * 3600000).toISOString(), reason: a.p_reason, auto: false }); audit('sanction', a.p_user, { kind: a.p_kind, hours: a.p_hours }, a.p_reason); return ++nid; }
    case 'admin_list_words': need('word'); return S.words;
    case 'admin_upsert_word': { need('word'); why(a.p_reason); if (String(a.p_term || '').trim().length < 2) throw new Error('invalid_word'); S.words = S.words.filter(w => w.term !== a.p_term.toLowerCase()); S.words.push({ term: a.p_term.toLowerCase(), match: a.p_match, action: a.p_action }); audit('word_upsert', a.p_term, null, a.p_reason); return null; }
    case 'admin_delete_word': { need('word'); why(a.p_reason); S.words = S.words.filter(w => w.term !== a.p_term); audit('word_delete', a.p_term, null, a.p_reason); return null; }
    case 'admin_list_roles': need('role'); return S.roles;
    case 'admin_set_role': need('role'); why(a.p_reason); audit('set_role', a.p_user, { role: a.p_role }, a.p_reason); return null;
    case 'admin_list_flags': need('flag'); return S.flags;
    case 'admin_set_flag': need('flag'); why(a.p_reason); if (!(a.p_key in S.flags)) throw new Error('unknown_flag'); if (a.p_key !== 'campaign.approval' && typeof a.p_value !== 'boolean') throw new Error('invalid_flag');
      S.flags[a.p_key] = a.p_value; S.flagMeta[a.p_key] = { at: now(), reason: a.p_reason, by: role }; audit('set_flag', a.p_key, a.p_value, a.p_reason); return null;
    case 'admin_flag_meta': need('flag'); return S.flagMeta;
    case 'admin_client_errors': need('flag'); return { total: 14, users: 5, top: [{ fp: 'a', kind: 'js', message: "Cannot read properties of undefined (reading 'position')", stack: 'TypeError: Cannot read properties of undefined\n    at update (park-4f2a.js:1:2210)\n    at tick (index-9c1b.js:1:41233)', place: 'Công viên Cỏ Non', build: '9c1b3a', count: 9, users: 3, last: now() }, { fp: 'b', kind: 'promise', message: 'realtime_timeout', stack: '', place: 'Quảng trường Mầm', build: '9c1b3a', count: 5, users: 2, last: now() }], daily: [] };
    case 'admin_push_stats': need('flag'); return { devices: 14, users: 11, sent_24h: 32, fail_24h: 1 };
    case 'admin_list_balance': need('flag'); return S.balance;
    case 'admin_set_balance': { need('flag'); why(a.p_reason); const b = S.balance.find(x => x.key === a.p_key); if (!b) throw new Error('unknown_balance');
      if (!(a.p_value >= b.min && a.p_value <= b.max)) throw new Error('balance_out_of_range'); if (b.def > 0 && Math.abs(a.p_value - b.def) / b.def > 0.5 && role !== 'owner') throw new Error('balance_needs_owner');
      b.value = a.p_value; b.updated_at = now(); b.by = role; audit('set_balance', a.p_key, { value: a.p_value }, a.p_reason); return null; }
    case 'admin_dashboard_overview': { need('dashboard'); return demoOverview(+a.p_days || 30, S.events, Object.fromEntries(S.balance.map(x => [x.key, x.value])), S.flags); }
    case 'admin_audit_list': need('audit'); return S.audit;
    case 'admin_set_site_info': { need('flag'); why(a.p_reason); const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(a.p_info || {})) { const x = String(v ?? '').trim(); if (!x) continue;
        const ok = ({ donate_url: /^https:\/\/[^\s<>"']+$/, donate_label: /^.{1,40}$/, bank_name: /^.{1,60}$/, bank_holder: /^.{1,60}$/, bank_account: /^[0-9][0-9 .-]{3,29}$/, vietqr_bank: /^[A-Za-z0-9]{2,12}$/,
          qr_url: /^\.?\/[A-Za-z0-9/_.-]+\.(png|jpg|jpeg|webp|svg)$/, contact_email: /^[^@\s<>"']+@[^@\s<>"']+\.[A-Za-z]{2,}$/ } as Record<string, RegExp>)[k];
        if (!ok || !ok.test(x) || (k === 'qr_url' && x.includes('..'))) throw new Error('invalid_site_info'); out[k] = x; }
      S.flags['site.info'] = out; S.flagMeta['site.info'] = { at: now(), reason: a.p_reason, by: role }; audit('set_site_info', 'site.info', out, a.p_reason); return out; }
    case 'admin_list_tickets': { need('ticket'); const st = a.p_status || 'open'; const T = S.tickets;
      const items = T.filter(t => st === 'all' || t.status === st).sort((x, y) => Number(x.seen) - Number(y.seen) || y.updated_at.localeCompare(x.updated_at)).map(t => {
        const p = players.find(x => x.user_id === t.user_id); return { id: t.id, kind: t.kind, subject: t.subject, status: t.status, created_at: t.created_at, updated_at: t.updated_at, new: !t.seen, name: p?.name, code: p?.code, messages: t.messages.length, last: t.messages.at(-1)?.body.slice(0, 140) }; });
      return { counts: { open: T.filter(t => t.status === 'open').length, answered: T.filter(t => t.status === 'answered').length, closed: T.filter(t => t.status === 'closed').length, new: T.filter(t => t.status === 'open' && !t.seen).length }, items }; }
    case 'admin_get_ticket': { need('ticket'); const t = S.tickets.find(x => x.id === a.p_id); if (!t) throw new Error('not_found'); t.seen = true; const p = players.find(x => x.user_id === t.user_id);
      return { ...t, name: p?.name, code: p?.code, email: ['owner', 'ops', 'support'].includes(role) ? p?.email : null }; }
    case 'admin_reply_ticket': { need('ticket'); const t = S.tickets.find(x => x.id === a.p_id); if (!t) throw new Error('not_found'); const b = String(a.p_body || '').trim(); if (!b || b.length > 2000) throw new Error('invalid_ticket');
      t.messages.push({ from_admin: true, body: b, at: now(), by: `${role}@example.com` }); t.status = a.p_close ? 'closed' : 'answered'; t.updated_at = now(); t.seen = true; audit('ticket_reply', String(t.id), { close: !!a.p_close }, null); return null; }
    case 'admin_set_ticket_status': { need('ticket'); const t = S.tickets.find(x => x.id === a.p_id); if (!t) throw new Error('not_found'); if (!['open', 'answered', 'closed'].includes(a.p_status)) throw new Error('invalid_ticket');
      t.status = a.p_status; t.updated_at = now(); audit('ticket_status', String(t.id), a.p_status, null); return null; }
    default: throw new Error('unknown_rpc ' + fn);
  }
}

/** Dữ liệu GIẢ cho dashboard ở bản chạy thử (không có máy chủ). Sinh có hạt giống cố định để ảnh chụp và test ổn định. Không phải người thật. */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export function demoOverview(days: number, events: any[], balance: Record<string, number>, flags: Record<string, unknown>) {
  const n = Math.min(Math.max(days, 7), 90), r = rng(7), today = new Date(), from = new Date(today.getTime() - (n - 1) * 86400000);
  const noisy = (base: number, spread: number, i: number, weekly = 0.15) => Math.max(0, Math.round(base * (1 + weekly * Math.sin((i / 7) * 2 * Math.PI)) + (r() - 0.5) * spread));
  const ramp = (i: number) => 0.55 + (i / n) * 0.7; // tăng dần
  const mk = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round(f(i) * 0.6) : f(i)));
  const dau = mk(i => noisy(46 * ramp(i), 10, i)), sessions = dau.map(v => Math.round(v * 1.9)), secs = sessions.map(v => v * (410 + Math.round(r() * 80)));
  const dims = (names: string[], f: (k: number, i: number) => number) => Object.fromEntries(names.map((k, ki) => [k, mk(i => f(ki, i))]));
  const adsU = dau.map(v => Math.round(v * 0.22)), adsV = adsU.map(v => Math.round(v * 2.4)), adsS = adsV.map(v => Math.round(v * 1.25));
  const funnelBase = Math.round(n * 7.5), steps = [1, 0.94, 0.91, 0.82, 0.66, 0.52, 0.37, 0.19, 0.55];
  const wk = Array.from({ length: Math.min(8, Math.ceil(n / 7)) }, (_, w) => { const size = 38 + Math.round(r() * 20), mat = (p: number, of: number) => ({ n: Math.round(of * p), of }); return { week: iso(new Date(today.getTime() - (7 - w) * 7 * 86400000 + 86400000 * 1)), size,
    d1: mat(0.52 - w * 0.01, size), d3: mat(0.38, size), d7: mat(0.3 - w * 0.005, w < 6 ? size : 0), d14: mat(0.22, w < 4 ? size : 0), d30: mat(0.15, w < 2 ? size : 0) }; });
  const tot = (k: string) => wk.reduce((a, x: any) => ({ n: a.n + x[k].n, of: a.of + x[k].of }), { n: 0, of: 0 });
  const heat: number[][] = []; for (let dow = 1; dow <= 7; dow++) for (let h = 0; h < 24; h++) { const peak = Math.exp(-Math.pow(h - 20.5, 2) / 6) + 0.5 * Math.exp(-Math.pow(h - 12.5, 2) / 4) + 0.15; const v = Math.round(peak * (dow >= 6 ? 26 : 18) * (0.8 + r() * 0.4)); if (v) heat.push([dow, h, v]); }
  const evs = events.map(e => ({ id: e.id, title: e.title, kind: e.kind, starts_at: e.starts_at, ends_at: e.ends_at, enabled: e.enabled, config: e.config, dau_before: 41.5, dau_during: 52.3 }));
  const ecpm = balance['ads.ecpm_usd'] ?? 1, per = balance['ads.per_day'] ?? 5, yAds = adsV[n - 2], yAu = adsU[n - 2];
  return {
    generated_at: new Date().toISOString(), from: iso(from), to: iso(today), days: n,
    alerts: yAu > 0 && yAds / yAu > (balance['alert.ads_per_user'] ?? 4.5) ? [{ key: 'ads_per_user', level: 'warn', value: yAds / yAu, text: 'Dữ liệu giả: lượt quảng cáo mỗi người vượt ngưỡng.' }] : [],
    live: { online_now: 7, in_places: 4, pets_alive: 312, ill_now: 23, users_total: 340, events_live: events.filter(e => e.enabled).length, reports_open: 1, sanctions_active: 0, mail_unclaimed: 58, ads_capped_today: 2,
      dau_wau_mau: { wau: 168, mau: 247 } },
    series: {
      dau, dau_platform: dims(['mobile', 'desktop'], (k, i) => Math.round(dau[i] * (k ? 0.28 : 0.72))), dau_standalone: dau.map(v => Math.round(v * 0.12)),
      new_users: mk(i => noisy(8, 8, i, 0.2)), new_ref: dims(['direct', 'facebook', 'tiktok'], (k, i) => noisy([4, 2.5, 1.5][k], 3, i)), new_pets: mk(i => noisy(7, 7, i)), tour_done: mk(i => noisy(5, 5, i)),
      sessions, session_secs_sum: secs, session_secs_p50: sessions.map(() => 300), actions: dau.map(v => v * 22), action_users: dau.map(v => Math.round(v * 0.93)),
      coins_earned: dims(['pet_action', 'claim_quest', 'claim_quest_bonus', 'claim_ad_reward', 'sell_food', 'claim_bond_reward'], (k, i) => noisy(dau[i] * [24, 30, 6, 5, 4, 3][k] / 10, 40, i)),
      coins_spent: dims(['buy_item', 'buy_food', 'buy_medicine', 'plant_crop', 'visit_clinic'], (k, i) => noisy(dau[i] * [34, 20, 6, 4, 2][k] / 10, 40, i)),
      ads_views: adsV, ads_users: adsU, ads_started: adsS,
      illness_started: dims(['cam-lanh', 'dau-bung', 'cang-co', 'u-rut'], (k, i) => noisy([2.2, 1.6, 0.8, 0.8][k], 2, i, 0.05)), illness_secs: mk(i => noisy(2, 3, i, 0) * 3.6 * 3600), illness_ended: mk(i => noisy(2, 3, i, 0)),
      departed: mk(() => (r() < 0.25 ? 1 : 0)), friends_new: mk(i => noisy(5, 6, i)), gifts: mk(i => noisy(7, 8, i)), dms: mk(i => noisy(14, 12, i)),
      chat_msgs: mk(() => 0), chat_senders: mk(() => 0), chat_blocked: {}, reports_new: mk(() => (r() < 0.3 ? 1 : 0)),
      place_visits: dims(['plaza', 'tea', 'park'], (k, i) => noisy(dau[i] * [0.9, 0.35, 0.5][k], 12, i)), place_users: dau.map(v => Math.round(v * 0.45)), place_peak: dims(['plaza', 'tea', 'park'], k => [9, 4, 6][k] + 2),
      feat_users: dims(['feed', 'bath', 'play', 'pet', 'talk', 'sleep', 'quest', 'places', 'shop', 'clinic'], (k, i) => Math.round(dau[i] * [0.92, 0.55, 0.7, 0.85, 0.4, 0.5, 0.66, 0.45, 0.5, 0.12][k])), feat_chat: mk(() => 0),
      push_sent: mk(() => 0), push_fail: mk(() => 0), push_return: mk(() => 0),
    },
    retention: { weeks: wk, total: { size: wk.reduce((a, x) => a + x.size, 0), d1: tot('d1'), d3: tot('d3'), d7: tot('d7'), d14: tot('d14'), d30: tot('d30') } },
    churn: { d7: { n: 61, of: 280 }, d14: { n: 84, of: 240 }, d30: { n: 97, of: 170 } },
    funnel: ['signup', 'pet', 'action', 'tour', 'quest', 'bond2', 'place', 'friend', 'return'].map((key, i) => ({ key, n: Math.round(funnelBase * steps[i]) })),
    progression: {
      bond: Object.fromEntries([[1, 60, 2.1], [2, 82, 5.5], [3, 54, 9.2], [4, 40, 14], [5, 28, 19.5], [6, 20, 25], [7, 12, 31], [8, 8, 38], [9, 5, 44], [10, 3, 52]].map(([l, c, a]) => [String(l), { n: c, age_p50: a }])),
      stage: { egg: 4, baby: 130, teen: 110, adult: 68, departed: 31 }, lived_p50: 43.5, churn_by_bond: { '1': 22, '2': 31, '3': 12, '4': 6, '5': 2 },
    },
    wallet: { n: 340, sum: 188000, avg: 553, p50: 410, p90: 1250, max: 6400 },
    heat, events: evs, ads_ecpm: ecpm, ads_per_day: per, flags,
  };
}

/**
 * Tổng quan = dashboard chỉ số nhà phát triển game. Mọi số liệu do admin_dashboard_overview (SQL) trả về; ở đây chỉ tính tỉ lệ
 * và vẽ. Ngày tính theo giờ Việt Nam. Hôm nay còn dở dang nên các so sánh dùng "hôm qua" (ngày trọn vẹn gần nhất).
 */
import { rpc } from '../api';
import { barChart, card, dayList, dmy, dur, esc, heatmap, hbars, kpi, lineChart, num, pct, type Series } from '../charts';

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const at = (a: number[], i: number) => (i >= 0 && i < a.length ? a[i] : 0);
const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const ratio = (a: number[], b: number[]) => a.map((v, i) => (b[i] > 0 ? v / b[i] : 0));
const sumDims = (o: Record<string, number[]>) => { const keys = Object.keys(o); const n = keys.length ? o[keys[0]].length : 0; return Array.from({ length: n }, (_, i) => keys.reduce((s, k) => s + (o[k][i] || 0), 0)); };

const EARN: Record<string, string> = { pet_action: 'Chăm bé', claim_quest: 'Nhiệm vụ', claim_quest_bonus: 'Nhiệm vụ', claim_weekly_quest: 'Nhiệm vụ', claim_ad_reward: 'Quảng cáo', sell_food: 'Bán rau',
  claim_bond_reward: 'Gắn bó', claim_mail: 'Thư và quà', claim_all_mail: 'Thư và quà', start: 'Khởi đầu', claim_collection: 'Sưu tập' };
const SPEND: Record<string, string> = { buy_item: 'Đồ nhà và trang phục', buy_food: 'Thức ăn', buy_medicine: 'Thuốc', visit_clinic: 'Phòng khám', plant_crop: 'Nông trại', upgrade_parcel: 'Nông trại', buy_parcel: 'Nông trại',
  upgrade_fridge: 'Nông trại', cook: 'Nông trại', send_gift: 'Quà tặng', buy_event_item: 'Sự kiện' };
function group(dims: Record<string, number[]>, map: Record<string, string>, order: string[]): Series[] {
  const n = Object.values(dims)[0]?.length ?? 0, acc: Record<string, number[]> = {};
  for (const [k, arr] of Object.entries(dims)) { const g = map[k] || 'Khác'; acc[g] = (acc[g] || Array(n).fill(0)).map((v, i) => v + (arr[i] || 0)); }
  return [...order, 'Khác'].filter(g => acc[g] && sum(acc[g]) > 0).map(g => ({ name: g, values: acc[g] }));
}
function topDims(dims: Record<string, number[]>, k: number, labelOf: (s: string) => string = s => s): Series[] {
  const ents = Object.entries(dims).sort((a, b) => sum(b[1]) - sum(a[1])), n = ents[0]?.[1].length ?? 0;
  const top = ents.slice(0, k).map(([name, values]) => ({ name: labelOf(name), values })), rest = ents.slice(k);
  if (rest.length) top.push({ name: 'Khác', values: Array.from({ length: n }, (_, i) => rest.reduce((s, [, v]) => s + (v[i] || 0), 0)) });
  return top;
}
const FUNNEL: Record<string, string> = { signup: 'Đăng ký', pet: 'Tạo bé', action: 'Có hành động đầu tiên', tour: 'Xong hoặc bỏ qua hướng dẫn', quest: 'Nhận nhiệm vụ đầu', bond2: 'Gắn bó cấp 2', place: 'Vào nơi chung', friend: 'Có bạn bè', return: 'Quay lại ngày sau' };
const PLACE: Record<string, string> = { plaza: 'Quảng trường', tea: 'Tiệm trà', park: 'Công viên' };
const ILL: Record<string, string> = { 'dau-bung': 'Đau bụng', 'ngua-da': 'Nổi mẩn', 'u-rut': 'Ủ rũ', 'sot-met': 'Sốt mệt', 'sau-rang': 'Sâu răng', 'thieu-chat': 'Thiếu chất', 'cang-co': 'Căng cơ', 'cam-lanh': 'Cảm lạnh' };
const FEAT: Record<string, string> = { feed: 'Cho ăn', bath: 'Tắm', play: 'Chơi', pet: 'Vuốt ve', talk: 'Nói chuyện', sleep: 'Ngủ', quest: 'Nhiệm vụ', places: 'Nơi chung', shop: 'Cửa hàng và chợ', clinic: 'Phòng khám', chat: 'Chat công khai' };
const PLATFORM: Record<string, string> = { mobile: 'Di động', desktop: 'Máy tính', unknown: 'Không rõ' };
const REF: Record<string, string> = { direct: 'Trực tiếp' };

export const DASH_DAYS = [7, 30, 90];

export async function renderDashboard(days: number, demo: boolean): Promise<string> {
  const d = await rpc('admin_dashboard_overview', { p_days: days }), S = d.series, L = d.live;
  const dl = dayList(d.from, d.to), labels = dl.map(dmy), n = dl.length, last = n - 1, y = n - 2;
  const dau: number[] = S.dau, sessions: number[] = S.sessions, secs: number[] = S.session_secs_sum;
  const mau = L.dau_wau_mau.mau, wau = L.dau_wau_mau.wau, avgDau30 = sum(dau.slice(-30)) / Math.max(1, Math.min(30, n));
  const ret = d.retention.total, ecpm = Number(d.ads_ecpm), adsV: number[] = S.ads_views, adsU: number[] = S.ads_users;
  const sess = (i: number) => (at(sessions, i) > 0 ? at(secs, i) / at(sessions, i) : 0);
  const rt = (k: string) => `${pct(ret[k].n, ret[k].of)}`, rs = (k: string) => (ret[k].of > 0 ? `${ret[k].n}/${ret[k].of} người` : 'chưa đủ ngày để tính');
  const arpdauY = at(dau, y) > 0 ? (at(adsV, y) * ecpm / 1000) / at(dau, y) : 0;
  const warn = (d.alerts as any[]).length;

  const kpis = [
    kpi('Đang online', num(L.online_now), `${num(L.in_places)} ở nơi chung`, undefined, null, 'Người có phiên chơi cập nhật trong 3 phút qua.'),
    kpi('DAU hôm qua', num(at(dau, y)), `hôm nay đến giờ ${num(at(dau, last))}`, dau, delta(at(dau, y), at(dau, y - 7)), 'Số người có phiên chơi hoặc hành động trong ngày (giờ Việt Nam). % so với cùng thứ tuần trước.'),
    kpi('Độ dính DAU/MAU', pct(avgDau30, mau), `WAU ${num(wau)} · MAU ${num(mau)}`, undefined, null, 'DAU trung bình 30 ngày chia MAU (số người khác nhau trong 30 ngày). Tham chiếu thường gặp: 10–20% là ổn, trên 20% là tốt.'),
    kpi('Người mới hôm qua', num(at(S.new_users, y)), `hôm nay ${num(at(S.new_users, last))} · tổng ${num(L.users_total)}`, S.new_users, delta(at(S.new_users, y), at(S.new_users, y - 7))),
    kpi('Giữ chân D1', rt('d1'), rs('d1'), undefined, null, 'Trong số người đã đủ 1 ngày kể từ lúc đăng ký, bao nhiêu % quay lại đúng ngày hôm sau.'),
    kpi('Giữ chân D7', rt('d7'), rs('d7'), undefined, null, 'Quay lại đúng ngày thứ 7 sau khi đăng ký.'),
    kpi('Giữ chân D30', rt('d30'), rs('d30'), undefined, null, 'Quay lại đúng ngày thứ 30 sau khi đăng ký.'),
    kpi('Phiên trung bình', dur(sess(y)), `${at(dau, y) > 0 ? num(at(sessions, y) / at(dau, y), 1) : '—'} phiên/người`, ratio(secs, sessions), delta(sess(y), sess(y - 7)), 'Thời lượng phiên chơi hôm qua. Phiên mới bắt đầu khi nghỉ quá 5 phút.'),
    kpi('Người xem quảng cáo', pct(at(adsU, y), at(dau, y)), `${at(adsU, y) > 0 ? num(at(adsV, y) / at(adsU, y), 1) : '—'} lượt/người`, adsU, null, 'Tỉ lệ người chơi có xem quảng cáo thưởng hôm qua.'),
    kpi('ARPDAU ước tính', `$${num(arpdauY, 4)}`, `eCPM giả định $${num(ecpm, 2)}`, undefined, null, 'Ước tính từ lượt xem × eCPM (đặt ở tab Cân bằng) / DAU. Chưa phải doanh thu thật: quảng cáo thật chưa chạy, quầy trả phí đang ẩn nên chưa có ARPPU.'),
  ].join('');

  const alerts = warn
    ? `<div class="al">${(d.alerts as any[]).map(a => `<div class="${a.level}"><b>${a.level === 'bad' ? '✖ Nghiêm trọng' : '⚠ Chú ý'}</b> ${esc(a.text)}</div>`).join('')}</div>`
    : '<div class="al ok"><div><b>✔ Ổn</b> Không có cảnh báo nào đang bật (ngưỡng chỉnh ở tab Cân bằng).</div></div>';

  const ctrl = `<div class="dctl"><span>Khoảng:</span>${DASH_DAYS.map(x => `<button type="button" class="g" data-days="${x}" aria-pressed="${x === d.days}">${x} ngày</button>`).join('')}<span class="small">Cập nhật ${new Date(d.generated_at).toLocaleTimeString('vi-VN')} · tự làm mới mỗi phút · ngày tính theo giờ Việt Nam</span></div>`;
  const note = `<p class="small">Cỡ mẫu: ${num(L.users_total)} tài khoản. Dưới khoảng 30 người mỗi ngày thì D1/D7/D30 và các tỉ lệ dao động rất mạnh, hãy xem số người (n/tổng) bên cạnh mỗi phần trăm.${demo ? ' <b>Đang xem dữ liệu giả của bản chạy thử.</b>' : ''}</p>`;

  // Thu hút
  const fun = d.funnel as { key: string; n: number }[], f0 = fun[0]?.n || 0;
  const acquisition = `<div class="cg">${barChart('Người mới mỗi ngày', 'Tài khoản mới đăng ký (giờ Việt Nam).', labels, [{ name: 'Người mới', values: S.new_users }])}
    ${Object.keys(S.new_ref).length ? barChart('Nguồn người mới', 'Lấy từ ?ref= hoặc utm_source lúc đăng ký; không có thì tính "Trực tiếp".', labels, topDims(S.new_ref, 5, s => REF[s] || s)) : card('Nguồn người mới', '', '<p class="small">Chưa có dữ liệu.</p>')}
    ${card('Phễu hành trình đầu', `Trong ${d.days} ngày qua, người đăng ký đi được tới đâu. Phần trăm so với số đăng ký; số nhỏ bên cạnh là % so với bước trước.`, hbars(fun.map((f, i) => ({ label: FUNNEL[f.key] || f.key, value: f.n, sub: `${pct(f.n, f0)}${i ? ` · ${pct(f.n, fun[i - 1].n)} so với bước trước` : ''}` }))), true)}</div>`;

  // Tương tác
  const hm: (number | null)[][] = Array.from({ length: 7 }, () => Array(24).fill(0)); for (const [dow, h, c] of d.heat as number[][]) hm[dow - 1][h] = c;
  const platforms = Object.keys(S.dau_platform).map(k => ({ name: PLATFORM[k] || k, values: S.dau_platform[k] as number[] }));
  const engagement = `<div class="cg">${lineChart('DAU theo ngày', 'Người có phiên chơi hoặc hành động trong ngày.', labels, [{ name: 'DAU', values: dau }])}
    ${lineChart('Phiên mỗi ngày', 'Số phiên chơi bắt đầu trong ngày.', labels, [{ name: 'Số phiên', values: sessions }])}
    ${lineChart('Thời lượng phiên trung bình (phút)', 'Tổng thời lượng chia số phiên.', labels, [{ name: 'Phút', values: ratio(secs, sessions).map(v => v / 60) }], v => num(v, 1))}
    ${lineChart('Hành động mỗi người', 'Số hành động chăm bé chia số người có hành động.', labels, [{ name: 'Hành động/người', values: ratio(S.actions, S.action_users) }], v => num(v, 1))}
    ${platforms.length ? barChart('DAU theo nền tảng', 'Người có phiên trong ngày, theo loại thiết bị. Một người dùng cả hai thì tính ở cả hai.', labels, platforms) : ''}
    ${lineChart('Người dùng đã cài PWA', 'Số người chơi từ ứng dụng đã thêm vào màn hình chính.', labels, [{ name: 'PWA', values: S.dau_standalone }])}
    ${card('Giờ cao điểm (28 ngày)', 'Số phiên bắt đầu theo giờ (cột) và thứ (hàng), giờ Việt Nam.', heatmap(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], Array.from({ length: 24 }, (_, i) => String(i)), hm, v => (v ? String(v) : ''), undefined, (r, c) => `${['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'][r]} ${c}h: ${hm[r][c]} phiên`), true)}</div>`;

  // Giữ chân
  const wk = d.retention.weeks as any[];
  const rcell = (o: { n: number; of: number }) => (o.of > 0 ? (o.n / o.of) * 100 : null);
  const cohort = heatmap(wk.map(w => `Tuần ${dmy(w.week)} (${w.size})`), ['D1', 'D3', 'D7', 'D14', 'D30'], wk.map(w => ['d1', 'd3', 'd7', 'd14', 'd30'].map(k => rcell(w[k]))), v => `${num(v, 0)}%`, 60,
    (r, c) => { const k = ['d1', 'd3', 'd7', 'd14', 'd30'][c], o = wk[r][k]; return `${o.n}/${o.of} người`; });
  const ch = d.churn;
  const retention = `<div class="cg">${card('Bảng cohort theo tuần đăng ký', 'Mỗi hàng là nhóm đăng ký trong một tuần (số trong ngoặc là số người). Ô = % người quay lại đúng ngày thứ N sau đăng ký, chỉ tính người đã đủ ngày. Ô trống là chưa đủ ngày.', cohort + '<p class="small">Màu đậm = giữ chân cao. Rê chuột vào ô để xem số người.</p>', true)}
    ${card('Bỏ đi (churn)', 'Trong số người đã đăng ký đủ N ngày, bao nhiêu % không có hoạt động nào trong N ngày gần nhất.', hbars(['d7', 'd14', 'd30'].map(k => ({ label: `Không quay lại ${k.slice(1)} ngày`, value: ch[k].of > 0 ? (ch[k].n / ch[k].of) * 100 : 0, sub: ch[k].of > 0 ? `${ch[k].n}/${ch[k].of} người` : 'chưa đủ dữ liệu' })), v => `${num(v, 0)}%`, 'var(--s2)'))}</div>`;

  // Tiến trình
  const bond = d.progression.bond as Record<string, { n: number; age_p50: number }>;
  const cb = d.progression.churn_by_bond as Record<string, number>;
  const progression = `<div class="cg">${card('Phân bố cấp Gắn bó', 'Số bé đang sống ở mỗi cấp; số nhỏ là tuổi trung vị (ngày) của bé ở cấp đó, cho thấy tốc độ lên cấp.', hbars(Array.from({ length: 10 }, (_, i) => ({ label: `Cấp ${i + 1}`, value: bond[String(i + 1)]?.n || 0, sub: bond[String(i + 1)] ? `tuổi trung vị ${num(bond[String(i + 1)].age_p50, 1)} ngày` : '' }))))}
    ${card('Người rời bỏ dừng ở cấp nào', 'Bé của người không hoạt động 7 ngày qua (đã đăng ký trên 7 ngày), theo cấp Gắn bó. Chỗ cột cao là điểm người chơi hay dừng lại.', Object.keys(cb).length ? hbars(Object.keys(cb).sort((a, b) => +a - +b).map(k => ({ label: `Cấp ${k}`, value: cb[k] })), v => num(v), 'var(--s2)') : '<p class="small">Chưa có ai rời bỏ.</p>')}
    ${card('Vòng đời bé', 'Số bé theo giai đoạn, và tuổi thọ trung vị của những bé đã ra đi.', hbars(['egg', 'baby', 'teen', 'adult', 'departed'].map(k => ({ label: ({ egg: 'Trứng', baby: 'Bé', teen: 'Thiếu niên', adult: 'Trưởng thành', departed: 'Đã ra đi' } as Record<string, string>)[k], value: d.progression.stage[k] || 0 })))
      + `<p class="small">Tuổi thọ trung vị (bé đã ra đi): ${d.progression.lived_p50 == null ? '—' : num(d.progression.lived_p50, 1) + ' ngày'}</p>`)}</div>`;

  // Tính năng
  const feat = Object.entries(S.feat_users as Record<string, number[]>).map(([k, v]) => ({ label: FEAT[k] || k, value: sum(v.slice(-7)) / Math.max(1, sum(dau.slice(-7))) * 100 })).sort((a, b) => b.value - a.value);
  const peaks = Object.entries(S.place_peak as Record<string, number[]>).map(([k, v]) => ({ label: PLACE[k] || k, value: Math.max(0, ...v) }));
  const features = `<div class="cg">${card('Tính năng được dùng (7 ngày)', 'Trung bình mỗi ngày có bao nhiêu % người chơi hoạt động dùng tính năng đó.', feat.length ? hbars(feat, v => `${num(v, 0)}%`) : '<p class="small">Chưa có dữ liệu.</p>')}
    ${Object.keys(S.place_visits).length ? barChart('Lượt vào nơi chung', 'Số lần vào từng nơi chung mỗi ngày.', labels, Object.entries(S.place_visits as Record<string, number[]>).map(([k, v]) => ({ name: PLACE[k] || k, values: v }))) : card('Lượt vào nơi chung', '', '<p class="small">Chưa có ai vào nơi chung.</p>')}
    ${card('Số người cùng lúc cao nhất', `Mẫu mỗi 15 phút trong ${d.days} ngày qua.`, peaks.length ? hbars(peaks) : '<p class="small">Chưa có mẫu.</p>')}</div>`;

  // Kinh tế
  const earned = group(S.coins_earned, EARN, ['Chăm bé', 'Nhiệm vụ', 'Quảng cáo', 'Bán rau', 'Gắn bó', 'Thư và quà', 'Sưu tập', 'Khởi đầu']);
  const spent = group(S.coins_spent, SPEND, ['Thức ăn', 'Đồ nhà và trang phục', 'Thuốc', 'Phòng khám', 'Nông trại', 'Quà tặng', 'Sự kiện']);
  const eT = sumDims(Object.fromEntries(Object.entries(S.coins_earned as Record<string, number[]>).filter(([k]) => k !== 'start'))), sT = sumDims(S.coins_spent);
  const W = d.wallet;
  const economy = `<div class="cg">${earned.length ? barChart('Xu kiếm được theo nguồn', 'Tổng xu vào ví mỗi ngày, theo nguồn (suy từ sổ cái xu). Không gồm xu khởi đầu cho tài khoản cũ.', labels, earned) : card('Xu kiếm được theo nguồn', '', '<p class="small">Chưa có dữ liệu.</p>')}
    ${spent.length ? barChart('Xu tiêu theo mục', 'Tổng xu ra khỏi ví mỗi ngày.', labels, spent) : card('Xu tiêu theo mục', '', '<p class="small">Chưa có dữ liệu.</p>')}
    ${lineChart('Xu kiếm so với xu tiêu', 'Hai đường trên cùng một trục. Kiếm cao hơn tiêu kéo dài là dấu hiệu lạm phát.', labels, [{ name: 'Kiếm', values: eT }, { name: 'Tiêu', values: sT }])}
    ${card('Ví người chơi hiện tại', 'Phân phối số xu đang có.', `<div class="grid2">${kpi('Trung vị', num(W.p50), `${num(W.n)} ví`)}${kpi('Trung bình', num(W.avg), '')}${kpi('Top 10% từ', num(W.p90), 'xu')}${kpi('Cao nhất', num(W.max), `tổng ${num(W.sum)} xu`)}</div>`)}</div>`;

  // Quảng cáo
  const ads = `<div class="cg">${lineChart('Quảng cáo thưởng', 'Bắt đầu: số lần xin mã xem. Lượt nhận: số lần nhận thưởng thành công. Người xem: số người khác nhau.', labels, [{ name: 'Bắt đầu', values: S.ads_started }, { name: 'Lượt nhận', values: adsV }, { name: 'Người xem', values: adsU }])}
    ${card('Hiệu quả quảng cáo', `Trong ${d.days} ngày qua. Doanh thu ước tính = lượt nhận × eCPM / 1000 (eCPM giả định $${num(ecpm, 2)}).`, `<div class="grid2">${kpi('Lượt nhận', num(sum(adsV)), `${num(sum(S.ads_started))} lượt bắt đầu`)}${kpi('Nhận / bắt đầu', pct(sum(adsV), sum(S.ads_started)), 'xem hết và nhận')}${kpi('Doanh thu ước tính', `$${num(sum(adsV) * ecpm / 1000, 2)}`, 'chưa phải thật')}${kpi('Chạm trần hôm nay', num(L.ads_capped_today), `trần ${d.ads_per_day} lượt/ngày`)}</div>`)}</div>`;

  // Sức khoẻ trong game
  const ill = Object.entries(S.illness_started as Record<string, number[]>).map(([k, v]) => ({ name: ILL[k] || k, values: v }));
  const cureHrs = ratio(S.illness_secs, S.illness_ended).map(v => v / 3600);
  const health = `<div class="cg">${ill.length ? barChart('Ca bệnh mới theo loại', 'Số bé bắt đầu bị bệnh mỗi ngày.', labels, ill) : card('Ca bệnh mới theo loại', '', '<p class="small">Chưa có ca bệnh nào.</p>')}
    ${lineChart('Thời gian chữa trung bình (giờ)', 'Từ lúc ốm tới lúc khỏi, theo ngày khỏi.', labels, [{ name: 'Giờ', values: cureHrs }], v => num(v, 1))}
    ${barChart('Bé ra đi mỗi ngày', 'Số bé hết tuổi thọ trong ngày.', labels, [{ name: 'Ra đi', values: S.departed }])}
    ${card('Đang ốm', 'Số bé đang ốm trên tổng số bé đang sống.', `<div class="grid2">${kpi('Đang ốm', num(L.ill_now), `trên ${num(L.pets_alive)} bé đang sống`)}${kpi('Tỉ lệ ốm', pct(L.ill_now, L.pets_alive), '')}</div>`)}</div>`;

  // Xã hội và kiểm duyệt
  const social = `<div class="cg">${lineChart('Kết bạn, quà, tin riêng', 'Số lời mời được đồng ý, quà gửi và tin nhắn riêng mỗi ngày.', labels, [{ name: 'Kết bạn', values: S.friends_new }, { name: 'Quà', values: S.gifts }, { name: 'Tin riêng', values: S.dms }])}
    ${lineChart('Chat công khai', 'Tin gửi được, người gửi và tin bị bộ lọc chặn mỗi ngày (chỉ có số liệu khi cờ chat công khai bật).', labels, [{ name: 'Tin', values: S.chat_msgs }, { name: 'Người gửi', values: S.chat_senders }, { name: 'Bị chặn', values: sumDims(S.chat_blocked) }])}
    ${barChart('Báo cáo mới mỗi ngày', 'Số báo cáo người chơi gửi.', labels, [{ name: 'Báo cáo', values: S.reports_new }])}
    ${card('Kiểm duyệt hiện tại', '', `<div class="grid2">${kpi('Báo cáo mở', num(L.reports_open), 'cần xử lý')}${kpi('Đang bị phạt', num(L.sanctions_active), 'người')}${kpi('Thư chưa nhận', num(L.mail_unclaimed), 'quà/thưởng')}</div>`)}</div>`;

  // Sự kiện và push
  const evs = d.events as any[];
  const evTable = evs.length ? `<table><tr><th>Sự kiện</th><th>Loại</th><th>Thời gian</th><th>DAU trước</th><th>DAU trong</th><th>Chênh</th></tr>${evs.map(e => `<tr><td>${esc(e.title)}${e.enabled ? '' : ' <span class="pill">tắt</span>'}</td><td>${esc(e.kind)}</td><td>${esc(dmy(String(e.starts_at).slice(0, 10)))}–${esc(dmy(String(e.ends_at).slice(0, 10)))}</td><td>${num(e.dau_before, 1)}</td><td>${num(e.dau_during, 1)}</td><td>${e.dau_before > 0 ? `${e.dau_during >= e.dau_before ? '▲' : '▼'} ${num(Math.abs(delta(e.dau_during, e.dau_before) ?? 0), 0)}%` : '—'}</td></tr>`).join('')}</table>` : '<p class="small">Chưa có sự kiện nào trong khoảng này.</p>';
  const liveops = `<div class="cg">${card('Hiệu quả sự kiện', 'So DAU trung bình trong sự kiện với 7 ngày ngay trước đó. Chỉ là gợi ý: DAU còn chịu ảnh hưởng của nhiều thứ khác.', evTable, true)}
    ${lineChart('Thông báo đẩy', 'Đã gửi, lỗi và số người quay lại trong 1 giờ sau khi nhận. Có số liệu khi bật push.', labels, [{ name: 'Đã gửi', values: S.push_sent }, { name: 'Lỗi', values: S.push_fail }, { name: 'Quay lại trong 1 giờ', values: S.push_return }])}</div>`;

  return `${ctrl}${note}<h3>Cảnh báo</h3>${alerts}<h3>Tổng quan hôm nay</h3><div class="kg">${kpis}</div>
    <h3>1. Thu hút người chơi</h3>${acquisition}<h3>2. Tương tác</h3>${engagement}<h3>3. Giữ chân</h3>${retention}<h3>4. Tiến trình</h3>${progression}
    <h3>5. Dùng tính năng</h3>${features}<h3>6. Kinh tế game</h3>${economy}<h3>7. Quảng cáo</h3>${ads}<h3>8. Sức khoẻ trong game</h3>${health}
    <h3>9. Xã hội và kiểm duyệt</h3>${social}<h3>10. Vận hành live-ops</h3>${liveops}`;
}

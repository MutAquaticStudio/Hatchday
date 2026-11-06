/**
 * Biểu đồ SVG viết tay cho dashboard quản trị (không thêm thư viện). Theo skill dataviz:
 *  - màu phân loại theo thứ tự cố định (CSS --s1…--s8 trong index.html), không đổi theo thứ hạng;
 *  - một trục, nét 2px, lưới mờ, nhãn trục ngắn; chú giải cho ≥ 2 chuỗi; bảng số liệu thay thế (thẻ <details>);
 *  - rê chuột/chạm hiện chú thích (tooltip) theo cột, vùng chạm rộng hơn nét vẽ.
 * Chỉ trả về chuỗi HTML; bindCharts() gắn tooltip một lần cho cả trang.
 */
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const num = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—');
export const pct = (a: number, b: number, d = 0) => (b > 0 ? num((a / b) * 100, d) + '%' : '—');
export const dur = (secs: number) => { if (!Number.isFinite(secs) || secs <= 0) return '—'; const m = Math.floor(secs / 60), s = Math.round(secs % 60); return m ? `${m} phút ${s ? s + ' giây' : ''}`.trim() : `${s} giây`; };
export const dmy = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
/** Danh sách ngày ISO từ `from` tới `to`. */
export const dayList = (from: string, to: string): string[] => { const out: string[] = []; for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10)); return out; };

export const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
export interface Series { name: string; values: number[]; color?: string }
type Fmt = (n: number) => string;
interface Reg { labels: string[]; series: Series[]; fmt: Fmt; x: number[]; w: number }
const REG = new Map<string, Reg>();
let uid = 0;
export const resetCharts = () => { REG.clear(); };

const niceMax = (v: number) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const W = 600, PL = 44, PR = 10, PT = 10, PB = 22;

function frame(id: string, labels: string[], series: Series[], fmt: Fmt, max: number, h: number, kind: 'line' | 'bar', body: (x: (i: number) => number, y: (v: number) => number, plotW: number) => string) {
  const n = labels.length, plotW = W - PL - PR, plotH = h - PT - PB;
  const step = kind === 'bar' ? plotW / n : plotW / Math.max(n - 1, 1);
  const x = (i: number) => (kind === 'bar' ? PL + step * i + step / 2 : PL + step * i), y = (v: number) => PT + plotH - (v / max) * plotH;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => { const v = max * f, yy = y(v); return `<line x1="${PL}" x2="${W - PR}" y1="${yy}" y2="${yy}" class="gl"/><text x="${PL - 6}" y="${yy + 3}" text-anchor="end" class="ax">${esc(fmt(v))}</text>`; }).join('');
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text x="${x(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" class="ax">${esc(labels[i])}</text>`).join('');
  const hits = labels.map((_, i) => `<rect class="hit" x="${x(i) - step / 2}" y="${PT}" width="${step}" height="${plotH}" data-c="${id}" data-i="${i}"/>`).join('');
  REG.set(id, { labels, series, fmt, x: labels.map((_, i) => x(i)), w: W });
  return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img" aria-label="${esc(series.map(s => s.name).join(', '))}"><g>${grid}</g>${body(x, y, plotW)}<line class="xh" x1="0" x2="0" y1="${PT}" y2="${PT + plotH}" visibility="hidden"/>${ticks}${hits}</svg>`;
}

function legend(series: Series[]) {
  if (series.length < 2) return '';
  return `<div class="lg">${series.map((s, i) => `<span><i style="background:${s.color || COLORS[i % 8]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
function table(labels: string[], series: Series[], fmt: Fmt) {
  const rows = labels.map((l, i) => `<tr><th>${esc(l)}</th>${series.map(s => `<td>${esc(fmt(s.values[i] ?? 0))}</td>`).join('')}</tr>`).join('');
  return `<details class="tv"><summary>Bảng số liệu</summary><div class="tvs"><table><tr><th></th>${series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${rows}</table></div></details>`;
}
export const card = (title: string, hint: string, inner: string, wide = false) => `<section class="card cc${wide ? ' wide' : ''}"><h4>${esc(title)}${hint ? ` <span class="help" tabindex="0" title="${esc(hint)}" aria-label="${esc(hint)}">?</span>` : ''}</h4>${inner}</section>`;

export function lineChart(title: string, hint: string, labels: string[], series: Series[], fmt: Fmt = n => num(n), h = 170, wide = false): string {
  const id = 'c' + ++uid, max = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const svg = frame(id, labels, series, fmt, max, h, 'line', (x, y) => series.map((s, k) => {
    const col = s.color || COLORS[k % 8], pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const last = s.values.length - 1;
    return `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${x(last)}" cy="${y(s.values[last] ?? 0)}" r="3.5" fill="${col}" stroke="var(--card)" stroke-width="2"/>`;
  }).join(''));
  return card(title, hint, legend(series) + svg + table(labels, series, fmt), wide);
}

/** Cột (một chuỗi) hoặc cột xếp chồng (nhiều chuỗi) theo ngày. Đầu cột bo 4px khi không xếp chồng; khe 2px giữa các đoạn. */
export function barChart(title: string, hint: string, labels: string[], series: Series[], fmt: Fmt = n => num(n), h = 170, wide = false): string {
  const id = 'c' + ++uid, stacked = series.length > 1, totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const max = niceMax(Math.max(0, ...(stacked ? totals : series[0]?.values ?? [0])));
  const svg = frame(id, labels, series, fmt, max, h, 'bar', (x, y, plotW) => {
    const bw = Math.max(2, Math.min(18, (plotW / labels.length) * 0.62)), base = y(0);
    return labels.map((_, i) => { let acc = 0; return series.map((s, k) => {
      const v = s.values[i] || 0; if (v <= 0) return ''; const top = y(acc + v), bot = y(acc) - (stacked && acc > 0 ? 2 : 0); acc += v;
      const col = s.color || COLORS[k % 8], hgt = Math.max(1, bot - top), r = stacked ? 0 : Math.min(4, bw / 2, hgt);
      return `<path d="M${x(i) - bw / 2},${Math.min(base, bot)} v${-(hgt - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hgt - r} z" fill="${col}"/>`;
    }).join(''); }).join('');
  });
  return card(title, hint, legend(series) + svg + table(labels, series, fmt), wide);
}

/** Thanh ngang: danh sách {label, value, color?}; dùng cho phân bố, phễu. */
export function hbars(rows: { label: string; value: number; sub?: string; color?: string }[], fmt: Fmt = n => num(n), colorFirst = 'var(--s1)'): string {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<div class="hb">${rows.map(r => `<div class="hr"><span class="hl">${esc(r.label)}</span><span class="ht"><i style="width:${Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100)}%;background:${r.color || colorFirst}"></i></span><b>${esc(fmt(r.value))}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>`).join('')}</div>`;
}

/** Thẻ chỉ số: số lớn, so sánh, đường xu hướng nhỏ. */
export function kpi(label: string, value: string, sub: string, trend?: number[], deltaPct?: number | null, hint = ''): string {
  let spark = '';
  if (trend && trend.length > 1) { const mx = Math.max(1, ...trend), pts = trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${28 - (v / mx) * 26}`).join(' '); spark = `<svg viewBox="0 0 100 30" class="spark" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--s1)" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`; }
  const d = deltaPct == null || !Number.isFinite(deltaPct) ? '' : `<span class="dl ${deltaPct > 0.5 ? 'up' : deltaPct < -0.5 ? 'dn' : ''}">${deltaPct > 0.5 ? '▲' : deltaPct < -0.5 ? '▼' : '■'} ${num(Math.abs(deltaPct), 0)}%</span>`;
  return `<div class="kpi"><span class="kl">${esc(label)}${hint ? ` <span class="help" tabindex="0" title="${esc(hint)}" aria-label="${esc(hint)}">?</span>` : ''}</span><b class="kv">${esc(value)}</b><span class="ks">${d} ${esc(sub)}</span>${spark}</div>`;
}

/** Bản đồ nhiệt (hàng × cột), màu tuần tự một sắc xanh nhạt → đậm. cells: giá trị 0..max. */
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
export const rampColor = (f: number) => RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(f * RAMP.length - 1e-9)))];
export const rampText = (f: number) => (f > 0.5 ? '#fff' : '#0b0b0b');
export function heatmap(rowLabels: string[], colLabels: string[], cells: (number | null)[][], fmt: Fmt, max?: number, tipOf?: (r: number, c: number) => string): string {
  const mx = max ?? Math.max(1, ...cells.flat().map(v => v ?? 0));
  const head = `<tr><th></th>${colLabels.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = cells.map((row, r) => `<tr><th>${esc(rowLabels[r])}</th>${row.map((v, c) => v == null ? '<td class="na">·</td>' : `<td style="background:${rampColor(v / mx)};color:${rampText(v / mx)}" title="${esc(tipOf ? tipOf(r, c) : fmt(v))}">${esc(fmt(v))}</td>`).join('')}</tr>`).join('');
  return `<div class="hm"><table>${head}${body}</table></div>`;
}

/** Gắn tooltip + đường dọc cho mọi biểu đồ trong `root` (gọi một lần). */
export function bindCharts(root: HTMLElement): void {
  if (root.dataset.charts) return; root.dataset.charts = '1';
  let tip = document.getElementById('tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'status'); tip.hidden = true; document.body.appendChild(tip); }
  const t = tip;
  const show = (el: SVGRectElement, cx: number, cy: number) => {
    const c = REG.get(el.dataset.c || ''), i = +(el.dataset.i || 0); if (!c) return;
    t.innerHTML = `<b>${esc(c.labels[i])}</b>${c.series.map((s, k) => `<div><i style="background:${s.color || COLORS[k % 8]}"></i>${esc(s.name)}: <b>${esc(c.fmt(s.values[i] ?? 0))}</b></div>`).join('')}`;
    t.hidden = false; const w = t.offsetWidth; t.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, cx + 12)) + 'px'; t.style.top = Math.max(8, cy - t.offsetHeight - 10) + 'px';
    const svg = el.ownerSVGElement!, xh = svg.querySelector('.xh') as SVGLineElement; xh.setAttribute('x1', String(c.x[i])); xh.setAttribute('x2', String(c.x[i])); xh.setAttribute('visibility', 'visible');
  };
  const hide = () => { t.hidden = true; root.querySelectorAll('.xh').forEach(l => l.setAttribute('visibility', 'hidden')); };
  root.addEventListener('mousemove', e => { const el = (e.target as Element).closest?.('.hit') as SVGRectElement | null; if (el) show(el, e.clientX, e.clientY); else hide(); });
  root.addEventListener('mouseleave', hide);
  root.addEventListener('touchstart', e => { const tc = e.touches[0], el = document.elementFromPoint(tc.clientX, tc.clientY)?.closest?.('.hit') as SVGRectElement | null; if (el) show(el, tc.clientX, tc.clientY); }, { passive: true });
  root.addEventListener('touchmove', e => { const tc = e.touches[0], el = document.elementFromPoint(tc.clientX, tc.clientY)?.closest?.('.hit') as SVGRectElement | null; if (el) show(el, tc.clientX, tc.clientY); else hide(); }, { passive: true });
}

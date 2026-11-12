// Âm thanh: hiệu ứng ngắn và nhạc nền, tổng hợp bằng Web Audio nên không cần file âm thanh nào.
//
// - Trình duyệt chặn tự phát: AudioContext chỉ được tạo ở lần chạm/bấm phím đầu tiên.
// - Cài đặt (bật/tắt tiếng, bật/tắt nhạc, âm lượng) lưu ở localStorage 'hatchday-audio', chỉnh trong bảng Chỉ số.
// - Người bật prefers-reduced-motion thì nhạc nền mặc định tắt (tiếng hiệu ứng vẫn bật).
// - Ẩn tab thì tạm dừng hẳn để không tốn pin.
//
// Các sự kiện (xem chỗ gọi: grep "sfx("):
//   pet      vuốt/chạm vào thú          feed     cho ăn            talk   gửi tin nhắn
//   bath     kỳ cọ / xả nước            play     ném bóng / xoay   sleep  đi ngủ        wake   thức dậy
//   evolve   thú lớn sang giai đoạn mới  coin     nhận xu           buy    mua đồ        place  đặt đồ trong phòng
//   ui       bấm nút thường (tự gắn cho các nút .pill, .tab, .qbtn)
//   Thế giới: boing creak whee thud quack kick splash sit cheer flap sip purr kettle badge catch rain
//
// Nhạc nền: music('home'|'kitchen'|'bath'|'garden'|'bedroom'|'night'|'sleep'). Ban ngày, ban đêm và lúc ngủ có
// nhịp, cao độ và độ sáng khác nhau. Nhạc tự sinh từ thang ngũ cung nên không lặp đúng một đoạn.
// Muốn thay bằng file thật sau này: giữ nguyên sfx()/music(), chỉ đổi phần "giọng" bên dưới.

/** @typedef {'hitLeaf'|'hitWater'|'hitWind'|'hitShadow'|'hitFire'|'charge'|'boom'|'shatter'|'stRoot'|'stSoak'|'stDaze'|'stBlind'|'stBurn'|'launch'|'pet'|'feed'|'talk'|'bath'|'play'|'sleep'|'wake'|'evolve'|'coin'|'buy'|'place'|'ui'|'boing'|'creak'|'whee'|'thud'|'quack'|'kick'|'splash'|'sit'|'cheer'|'flap'|'sip'|'purr'|'kettle'|'badge'|'catch'|'miss'|'rain'|'hit'|'hitBig'|'crit'|'whoosh'|'fire'|'water'|'leaf'|'wind'|'shadow'|'zap'|'shield'|'heal'|'power'|'faint'|'win'|'lose'} SfxName */

const KEY = 'hatchday-audio';
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const prefs = { sfx: true, music: !reduce, vol: 70 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* bỏ qua */ }
function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* bỏ qua */ } }

/** @type {AudioContext | null} */ let ctx = null;
let master, sfxBus, musicBus, noiseBuf;
let scene = 'home';

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { return null; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolume();
  return ctx;
}
function applyVolume() {
  if (!ctx) return;
  const v = prefs.vol / 100;
  master.gain.setTargetAtTime(v * v * 2.2, ctx.currentTime, 0.03); // bình phương cho thanh trượt nghe đều tai
}
const ready = () => !!ctx && ctx.state === 'running';

/* ---------------- giọng cơ bản ---------------- */
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

/** Một nốt có bao âm: tấn công nhanh, tắt dần. */
function tone(f, t, dur, { type = 'sine', vol = 0.3, to = 0, attack = 0.008, bus = sfxBus, cutoff = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = g;
  if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; g.connect(lp); out = lp; }
  o.connect(g); out.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
/** Tiếng ồn lọc: nước, xào xạc, cú chạm. */
function noise(t, dur, { freq = 1200, q = 1, type = 'bandpass', vol = 0.2, to = 0, bus = sfxBus } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
/** Nốt kiểu hộp nhạc: tam giác + bồi âm quãng tám. */
function bell(m, t, dur = 0.5, vol = 0.18, bus = sfxBus) {
  tone(hz(m), t, dur, { type: 'triangle', vol, bus });
  tone(hz(m + 12), t, dur * 0.6, { vol: vol * 0.35, bus });
}

const PENTA = [0, 2, 4, 7, 9];
const pick = a => a[Math.floor(Math.random() * a.length)];
const jitter = (f, c = 40) => f * Math.pow(2, ((Math.random() * 2 - 1) * c) / 1200);

/** @type {Record<SfxName, (t: number) => void>} */
const VOICES = {
  pet: t => { const f = jitter(hz(72 + pick(PENTA)), 30); tone(f, t, 0.18, { vol: 0.12, to: f * 1.25 }); },
  feed: t => { [0, 0.16].forEach((d, i) => { tone(jitter(260 - i * 30), t + d, 0.12, { type: 'triangle', vol: 0.22, to: 150, cutoff: 1400 }); noise(t + d, 0.06, { freq: 2500, vol: 0.05 }); }); },
  talk: t => { const n = 3 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) tone(jitter(hz(76 + pick(PENTA))), t + i * 0.075, 0.07, { type: 'square', vol: 0.045, cutoff: 2200 }); },
  bath: t => { noise(t, 0.35, { freq: 900, to: 2600, q: 3, vol: 0.09 }); for (let i = 0; i < 3; i++) { const f = jitter(500 + Math.random() * 500, 80); tone(f, t + 0.05 + i * 0.07 + Math.random() * 0.04, 0.08, { vol: 0.1, to: f * 2.2 }); } },
  play: t => { tone(200, t, 0.32, { vol: 0.2, to: 560 }); tone(400, t, 0.2, { type: 'triangle', vol: 0.06, to: 1100 }); },
  sleep: t => { [79, 76, 72].forEach((m, i) => bell(m - 12, t + i * 0.32, 1.1, 0.14)); },
  wake: t => { [72, 76, 79, 84].forEach((m, i) => bell(m, t + i * 0.11, 0.6, 0.13)); },
  evolve: t => {
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => bell(m, t + i * 0.08, 0.9, 0.12));
    for (let i = 0; i < 10; i++) tone(hz(96 + pick(PENTA)), t + 0.5 + i * 0.06, 0.25, { vol: 0.04 });
    noise(t, 1.2, { freq: 3000, to: 9000, type: 'highpass', vol: 0.03 });
  },
  coin: t => { tone(hz(83), t, 0.09, { type: 'square', vol: 0.06, cutoff: 4000 }); tone(hz(88), t + 0.08, 0.35, { type: 'square', vol: 0.06, cutoff: 4000 }); },
  buy: t => { VOICES.coin(t); tone(120, t, 0.18, { vol: 0.2, to: 70 }); },
  place: t => { tone(150, t, 0.16, { vol: 0.26, to: 70 }); noise(t, 0.05, { freq: 1800, vol: 0.08 }); },
  ui: t => { tone(hz(84), t, 0.05, { vol: 0.05, to: hz(86) }); },
  // ---- thế giới (Công viên, Quảng trường, Tiệm trà) ----
  boing: t => { tone(180, t, 0.22, { vol: 0.2, to: 420 }); tone(360, t + 0.02, 0.18, { type: 'triangle', vol: 0.07, to: 760 }); },
  creak: t => { const f = jitter(310, 60); tone(f, t, 0.3, { type: 'sawtooth', vol: 0.035, to: f * 0.78, cutoff: 900 }); },
  whee: t => { tone(900, t, 0.5, { type: 'triangle', vol: 0.09, to: 260 }); noise(t, 0.45, { freq: 1800, to: 600, q: 0.7, vol: 0.05 }); },
  thud: t => { tone(110, t, 0.18, { vol: 0.3, to: 55 }); noise(t, 0.07, { freq: 500, vol: 0.09 }); },
  quack: t => { [0, 0.16].forEach(d => { const f = jitter(480, 90); tone(f, t + d, 0.11, { type: 'sawtooth', vol: 0.06, to: f * 0.7, cutoff: 1500 }); }); },
  kick: t => { tone(140, t, 0.13, { vol: 0.3, to: 60 }); noise(t, 0.05, { freq: 1200, vol: 0.12 }); },
  splash: t => { noise(t, 0.28, { freq: 2200, to: 900, q: 0.8, vol: 0.12 }); for (let i = 0; i < 3; i++) { const f = jitter(700 + Math.random() * 600, 100); tone(f, t + 0.03 + i * 0.06, 0.07, { vol: 0.08, to: f * 1.8 }); } },
  sit: t => { tone(190, t, 0.12, { vol: 0.14, to: 110 }); noise(t, 0.05, { freq: 700, vol: 0.05 }); },
  cheer: t => { noise(t, 0.9, { freq: 2400, to: 3600, q: 0.6, vol: 0.05 }); [76, 81, 85, 88].forEach((m, i) => bell(m, t + 0.1 + i * 0.09, 0.7, 0.1)); },
  flap: t => { for (let i = 0; i < 4; i++) noise(t + i * 0.05, 0.05, { freq: 3200, type: 'highpass', vol: 0.06 }); },
  sip: t => { tone(300, t, 0.28, { vol: 0.06, to: 520, cutoff: 1400 }); noise(t + 0.02, 0.2, { freq: 1500, to: 2500, q: 2, vol: 0.03 }); },
  purr: t => { for (let i = 0; i < 10; i++) tone(48 + (i % 2) * 4, t + i * 0.07, 0.09, { type: 'sawtooth', vol: 0.05, cutoff: 260 }); },
  kettle: t => { noise(t, 0.6, { freq: 5200, type: 'highpass', vol: 0.035 }); tone(1500, t + 0.15, 0.4, { vol: 0.025, to: 1900 }); },
  badge: t => { [72, 76, 79, 84, 91].forEach((m, i) => bell(m, t + i * 0.1, 0.8, 0.13)); },
  catch: t => { const f = hz(84 + pick(PENTA)); tone(f, t, 0.12, { type: 'triangle', vol: 0.12, to: f * 1.5 }); },
  miss: t => { tone(240, t, 0.18, { type: 'triangle', vol: 0.08, to: 150 }); },
  rain: t => { noise(t, 1.0, { freq: 4200, q: 0.5, type: 'bandpass', vol: 0.02 }); },
  /* Đấu trường: đòn trúng, nguyên tố, lá chắn, hồi phục, tụ lực, gục ngã, kết quả */
  hit: t => { tone(170, t, 0.12, { vol: 0.32, to: 70 }); noise(t, 0.08, { freq: 1600, vol: 0.14 }); },
  hitBig: t => { tone(120, t, 0.32, { vol: 0.42, to: 40 }); noise(t, 0.28, { freq: 900, to: 260, vol: 0.2 }); noise(t, 0.06, { freq: 4200, type: 'highpass', vol: 0.1 }); },
  crit: t => { VOICES.hitBig(t); bell(91, t + 0.02, 0.45, 0.1); bell(96, t + 0.07, 0.35, 0.07); },
  whoosh: t => { noise(t, 0.26, { freq: 600, to: 3200, q: 1.2, vol: 0.1 }); },
  fire: t => { noise(t, 0.55, { freq: 500, to: 1600, q: 0.7, vol: 0.15 }); tone(90, t, 0.45, { type: 'sawtooth', vol: 0.06, to: 55, cutoff: 600 }); },
  water: t => { noise(t, 0.42, { freq: 1900, to: 650, q: 1, vol: 0.13 }); for (let i = 0; i < 3; i++) { const f = jitter(620 + Math.random() * 500); tone(f, t + 0.05 + i * 0.06, 0.08, { vol: 0.05, to: f * 1.8 }); } },
  leaf: t => { for (let i = 0; i < 6; i++) noise(t + i * 0.035, 0.06, { freq: 2400 + i * 280, q: 4, vol: 0.05 }); },
  wind: t => { noise(t, 0.65, { freq: 380, to: 2400, q: 2.5, vol: 0.11 }); },
  shadow: t => { tone(230, t, 0.42, { type: 'sawtooth', vol: 0.05, to: 85, cutoff: 900 }); noise(t, 0.32, { freq: 320, to: 120, q: 3, vol: 0.09 }); },
  zap: t => { for (let i = 0; i < 4; i++) noise(t + i * 0.03, 0.05, { freq: 5200, type: 'highpass', vol: 0.09 }); tone(1600, t, 0.2, { type: 'square', vol: 0.03, to: 300, cutoff: 3000 }); },
  shield: t => { bell(84, t, 0.5, 0.08); tone(660, t, 0.3, { type: 'triangle', vol: 0.06, to: 990 }); },
  heal: t => { [79, 84, 88, 91].forEach((m, i) => bell(m, t + i * 0.06, 0.5, 0.07)); },
  power: t => { tone(110, t, 0.9, { type: 'sawtooth', vol: 0.06, to: 440, cutoff: 1800 }); noise(t, 0.9, { freq: 300, to: 2600, q: 1, vol: 0.06 }); },
  faint: t => { tone(440, t, 0.75, { type: 'triangle', vol: 0.1, to: 110 }); },
  win: t => { [72, 76, 79, 84, 88, 91].forEach((m, i) => bell(m, t + i * 0.09, 0.9, 0.12)); },
  lose: t => { [72, 69, 65, 60].forEach((m, i) => bell(m - 12, t + i * 0.16, 0.8, 0.1)); },
  /* lớp đuôi khi trúng đòn theo hệ */
  hitLeaf: t => { noise(t, 0.18, { freq: 3000, q: 3, vol: 0.08 }); for (let i = 0; i < 4; i++) noise(t + 0.03 + i * 0.03, 0.05, { freq: 2200 + i * 500, q: 5, vol: 0.05 }); tone(240, t, 0.12, { type: 'triangle', vol: 0.1, to: 120 }); },
  hitWater: t => { noise(t, 0.35, { freq: 1500, to: 500, q: 0.9, vol: 0.16 }); for (let i = 0; i < 4; i++) { const f = jitter(500 + Math.random() * 700); tone(f, t + 0.04 + i * 0.05, 0.07, { vol: 0.05, to: f * 2 }); } },
  hitWind: t => { noise(t, 0.3, { freq: 2600, to: 600, q: 2, vol: 0.12 }); noise(t, 0.06, { freq: 5000, type: 'highpass', vol: 0.08 }); },
  hitShadow: t => { tone(150, t, 0.35, { type: 'sawtooth', vol: 0.08, to: 50, cutoff: 700 }); noise(t, 0.25, { freq: 260, q: 4, vol: 0.12 }); },
  hitFire: t => { noise(t, 0.5, { freq: 700, to: 200, q: 0.6, vol: 0.2 }); tone(90, t, 0.35, { vol: 0.25, to: 40 }); noise(t + 0.05, 0.35, { freq: 3500, type: 'highpass', vol: 0.04 }); },
  /* tụ lực chiêu tối thượng (dâng lên) và tiếng nổ lớn khi trúng */
  charge: t => { tone(80, t, 1.2, { type: 'sawtooth', vol: 0.07, to: 640, cutoff: 2200 }); tone(120, t, 1.2, { type: 'square', vol: 0.03, to: 960, cutoff: 1800 }); noise(t, 1.2, { freq: 200, to: 4000, q: 1.5, vol: 0.07 }); [0.4, 0.7, 0.95, 1.1].forEach((d, i) => bell(79 + i * 5, t + d, 0.3, 0.05)); },
  boom: t => { tone(70, t, 0.9, { vol: 0.5, to: 28 }); tone(140, t, 0.3, { type: 'triangle', vol: 0.2, to: 60 }); noise(t, 1.1, { freq: 900, to: 120, q: 0.5, vol: 0.28 }); noise(t, 0.08, { freq: 6000, type: 'highpass', vol: 0.15 }); },
  shatter: t => { for (let i = 0; i < 7; i++) { const f = jitter(2400 + Math.random() * 2400); tone(f, t + i * 0.025, 0.12, { type: 'triangle', vol: 0.05, to: f * 0.7 }); } noise(t, 0.2, { freq: 6000, type: 'highpass', vol: 0.12 }); },
  /* gây trạng thái */
  stRoot: t => { VOICES.creak(t); tone(110, t + 0.08, 0.2, { vol: 0.2, to: 60 }); },
  stSoak: t => { for (let i = 0; i < 6; i++) { const f = jitter(300 + Math.random() * 500); tone(f, t + i * 0.05, 0.09, { vol: 0.06, to: f * 2.2 }); } },
  stDaze: t => { [88, 91, 88, 93].forEach((m, i) => tone(hz(m), t + i * 0.08, 0.1, { type: 'triangle', vol: 0.05, to: hz(m + 2) })); },
  stBlind: t => { noise(t, 0.6, { freq: 400, to: 140, q: 2, vol: 0.12 }); tone(330, t, 0.5, { type: 'sawtooth', vol: 0.03, to: 110, cutoff: 800 }); },
  stBurn: t => { noise(t, 0.7, { freq: 4500, type: 'highpass', vol: 0.06 }); noise(t, 0.4, { freq: 900, q: 1, vol: 0.08 }); },
  launch: t => { noise(t, 0.2, { freq: 900, to: 2800, q: 1.4, vol: 0.09 }); tone(300, t, 0.12, { type: 'triangle', vol: 0.06, to: 520 }); },
};
// Một số tiếng bị gọi liên tục (vuốt ve, kỳ cọ): giãn khoảng cách tối thiểu cho đỡ rối.
const GAP = { pet: 0.11, bath: 0.12, talk: 0.08, ui: 0.04, creak: 0.4, boing: 0.25, splash: 0.2, quack: 0.3, flap: 0.3, catch: 0.06, rain: 0.8, purr: 0.5 };
const lastAt = {};

/** Phát một hiệu ứng âm thanh ngắn. @param {SfxName} name */
export function sfx(name) {
  if (!prefs.sfx || !ready() || !VOICES[name]) return;
  const t = ctx.currentTime;
  if (t - (lastAt[name] ?? -1) < (GAP[name] ?? 0)) return;
  lastAt[name] = t;
  try { VOICES[name](t + 0.005); } catch (e) { console.error('sfx', name, e); } // lỗi âm thanh không được làm hỏng game
}

/* ---------------- nhạc nền tự sinh ---------------- */
// Vòng hợp âm I–vi–IV–V tính theo nốt gốc; mỗi hợp âm 2 nhịp lớn (bar).
const PROG = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
const MOODS = {
  day: { bpm: 84, root: 60, density: 0.5, bright: 2600, vol: 0.3 },
  night: { bpm: 66, root: 57, density: 0.32, bright: 1500, vol: 0.24 },
  sleep: { bpm: 52, root: 55, density: 0.16, bright: 900, vol: 0.16 },
  battle: { bpm: 138, root: 57, density: 0.62, bright: 3400, vol: 0.3 },
};
/** Vòng hợp âm chiến đấu i–VI–VII–v và thang ngũ cung thứ. */
const BPROG = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], MPENTA = [0, 3, 5, 7, 10];
let battleOn = false;
const moodOf = s => (battleOn ? 'battle' : s === 'sleep' ? 'sleep' : s === 'night' ? 'night' : 'day');

let timer = 0, nextT = 0, step = 0, mel = 2, playingMood = '';
function musicVoice(m, t, dur, vol, cutoff) {
  tone(hz(m), t, dur, { type: 'triangle', vol, bus: musicBus, cutoff });
  tone(hz(m + 12), t, dur * 0.5, { vol: vol * 0.25, bus: musicBus, cutoff });
}
function pad(chord, root, t, dur, cutoff) {
  chord.forEach(n => tone(hz(root - 12 + n), t, dur, { vol: 0.05, attack: 0.6, bus: musicBus, cutoff: cutoff * 0.6 }));
  tone(hz(root - 24 + chord[0]), t, dur * 0.8, { vol: 0.07, attack: 0.05, bus: musicBus, cutoff: 400 });
}
function tick() {
  if (!ready()) return;
  const M = MOODS[playingMood], eighth = 30 / M.bpm;
  while (nextT < ctx.currentTime + 0.25) {
    const fight = playingMood === 'battle', bar = Math.floor(step / 8), chord = (fight ? BPROG : PROG)[Math.floor(bar / (fight ? 1 : 2)) % PROG.length];
    if (fight) {
      // trống: kick ở phách 1 và 3, snare ở 2 và 4, hi-hat mỗi móc đơn; bass chạy móc đơn theo nốt gốc
      if (step % 4 === 0) tone(110, nextT, 0.16, { vol: 0.32, to: 45, bus: musicBus });
      if (step % 4 === 2) noise(nextT, 0.14, { freq: 1800, q: 0.7, vol: 0.12, bus: musicBus });
      noise(nextT, 0.04, { freq: 7000, type: 'highpass', vol: step % 2 ? 0.025 : 0.04, bus: musicBus });
      tone(hz(M.root - 24 + chord[0] + (step % 4 === 3 ? 7 : 0)), nextT, eighth * 0.9, { type: 'sawtooth', vol: 0.06, bus: musicBus, cutoff: 700 });
      if (step % 8 === 0) chord.forEach(n => tone(hz(M.root - 12 + n), nextT, eighth * 7, { type: 'square', vol: 0.018, attack: 0.02, bus: musicBus, cutoff: 1600 }));
    } else if (step % 16 === 0) pad(chord, M.root, nextT, eighth * 16, M.bright);
    // Giai điệu đi từng bậc trên thang ngũ cung, nghiêng về nốt trong hợp âm ở phách mạnh.
    const strong = step % 4 === 0;
    if (Math.random() < (strong ? M.density + 0.25 : M.density * 0.6)) {
      mel = Math.max(0, Math.min(9, mel + pick([-2, -1, -1, 0, 1, 1, 2])));
      let m = M.root + 12 * Math.floor(mel / 5) + (fight ? MPENTA : PENTA)[mel % 5];
      if (strong) { const c = chord.map(n => M.root + ((n + 12) % 12)); m = c.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), c[0]) + 12 * Math.floor(mel / 5); }
      musicVoice(m, nextT, eighth * (strong ? 3 : 1.6), 0.09, M.bright);
    }
    nextT += eighth; step++;
  }
}
function syncMusic() {
  if (!ctx) return;
  const want = prefs.music && !document.hidden ? moodOf(scene) : '';
  const t = ctx.currentTime;
  if (!want) {
    musicBus.gain.setTargetAtTime(0, t, 0.25);
    if (timer) { clearInterval(timer); timer = 0; }
    playingMood = '';
    return;
  }
  if (want !== playingMood) {
    // Chuyển tâm trạng: hạ nhỏ rồi vào đoạn mới từ đầu vòng hợp âm.
    playingMood = want; step = 0; mel = 2;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0, t, 0.15);
    nextT = t + 0.6;
    musicBus.gain.setTargetAtTime(MOODS[want].vol, nextT, 0.8);
  }
  if (!timer) timer = setInterval(tick, 100);
}

/** Nhạc chiến đấu khi đang trong trận ở Đấu trường (tắt thì về lại nhạc theo khu vực). */
export function battleMusic(on) { battleOn = !!on; syncMusic(); }

/** Nhạc nền theo khu vực/thời điểm. @param {string} next ví dụ 'home', 'kitchen', 'night', 'sleep' */
export function music(next) {
  scene = next;
  syncMusic();
}

/* ---------------- mở khoá, tab ẩn, cài đặt ---------------- */
function unlock() {
  if (!prefs.sfx && !prefs.music) return;
  if (!ensureCtx()) return;
  if (ctx.state !== 'running') ctx.resume().then(syncMusic, () => {});
  else syncMusic();
}
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, unlock, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { syncMusic(); ctx.suspend().catch(() => {}); }
  else if (prefs.sfx || prefs.music) ctx.resume().then(syncMusic, () => {});
});

/** Gắn nút Tiếng / Nhạc / Âm lượng trong bảng Chỉ số và tiếng 'ui' cho các nút thường. Gọi một lần khi vào game. */
export function initAudio() {
  const $ = id => document.getElementById(id);
  const bSfx = $('snd-sfx'), bMusic = $('snd-music'), vol = $('snd-vol');
  const render = () => {
    bSfx?.setAttribute('aria-pressed', String(prefs.sfx));
    bMusic?.setAttribute('aria-pressed', String(prefs.music));
    if (vol) { vol.value = String(prefs.vol); vol.setAttribute('aria-valuetext', prefs.vol + '%'); }
  };
  render();
  if (/[?&]dev\b/.test(location.search)) /** @type {any} */ (window).__audio = audioState, /** @type {any} */ (window).__sfx = sfx;
  bSfx?.addEventListener('click', () => { prefs.sfx = !prefs.sfx; savePrefs(); render(); unlock(); sfx('ui'); });
  bMusic?.addEventListener('click', () => { prefs.music = !prefs.music; savePrefs(); render(); unlock(); syncMusic(); });
  vol?.addEventListener('input', () => { prefs.vol = Number(vol.value); render(); applyVolume(); });
  vol?.addEventListener('change', () => { savePrefs(); sfx('ui'); });
  document.addEventListener('click', e => {
    const el = e.target instanceof Element && e.target.closest('.pill, .tab, .qbtn, .act');
    if (el && el !== bSfx) sfx('ui');
  });
}

/** Cho kiểm thử: trạng thái hiện tại. */
export function audioState() { return { ...prefs, ctx: ctx?.state ?? 'none', mood: playingMood }; }

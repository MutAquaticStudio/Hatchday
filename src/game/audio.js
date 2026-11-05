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
//
// Nhạc nền: music('home'|'kitchen'|'bath'|'garden'|'bedroom'|'night'|'sleep'). Ban ngày, ban đêm và lúc ngủ có
// nhịp, cao độ và độ sáng khác nhau. Nhạc tự sinh từ thang ngũ cung nên không lặp đúng một đoạn.
// Muốn thay bằng file thật sau này: giữ nguyên sfx()/music(), chỉ đổi phần "giọng" bên dưới.

/** @typedef {'pet'|'feed'|'talk'|'bath'|'play'|'sleep'|'wake'|'evolve'|'coin'|'buy'|'place'|'ui'} SfxName */

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
function noise(t, dur, { freq = 1200, q = 1, type = 'bandpass', vol = 0.2, to = 0 } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus);
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
};
// Một số tiếng bị gọi liên tục (vuốt ve, kỳ cọ): giãn khoảng cách tối thiểu cho đỡ rối.
const GAP = { pet: 0.11, bath: 0.12, talk: 0.08, ui: 0.04 };
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
};
const moodOf = s => (s === 'sleep' ? 'sleep' : s === 'night' ? 'night' : 'day');

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
    const bar = Math.floor(step / 8), chord = PROG[Math.floor(bar / 2) % PROG.length];
    if (step % 16 === 0) pad(chord, M.root, nextT, eighth * 16, M.bright);
    // Giai điệu đi từng bậc trên thang ngũ cung, nghiêng về nốt trong hợp âm ở phách mạnh.
    const strong = step % 4 === 0;
    if (Math.random() < (strong ? M.density + 0.25 : M.density * 0.6)) {
      mel = Math.max(0, Math.min(9, mel + pick([-2, -1, -1, 0, 1, 1, 2])));
      let m = M.root + 12 * Math.floor(mel / 5) + PENTA[mel % 5];
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

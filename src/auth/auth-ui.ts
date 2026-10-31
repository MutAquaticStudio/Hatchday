import { supabase, isConfigured } from '../lib/supabase';
import { viError } from '../lib/errors';
import './auth.css';

export type AuthView = 'gate' | 'login' | 'register' | 'forgot' | 'reset' | 'check-email';

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/* Giới hạn phía máy: 5 lần sai trong 15 phút thì tạm khoá 15 phút.
   Đây là lớp trải nghiệm; lớp bảo vệ thật là rate limit + CAPTCHA của Supabase Auth. */
const FAIL_KEY = 'hatchday-login-fails';
function fails(): number[] { try { return (JSON.parse(localStorage.getItem(FAIL_KEY) || '[]') as number[]).filter(t => Date.now() - t < 15 * 60_000); } catch { return []; } }
function addFail() { try { localStorage.setItem(FAIL_KEY, JSON.stringify([...fails(), Date.now()])); } catch { /* bỏ qua */ } }
function clearFails() { try { localStorage.removeItem(FAIL_KEY); } catch { /* bỏ qua */ } }
function lockedMinutes(): number { const f = fails(); return f.length >= 5 ? Math.ceil((f[0] + 15 * 60_000 - Date.now()) / 60_000) : 0; }

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

const field = (id: string, label: string, type: string, auto: string, extra = '') =>
  type === 'password'
    ? `<label class="field" for="${id}">${label}<span class="pw"><input id="${id}" type="password" autocomplete="${auto}" aria-describedby="${id}-err" ${extra}><button type="button" data-toggle="${id}" aria-label="Hiện mật khẩu">Hiện</button></span><span class="err" id="${id}-err"></span></label>`
    : `<label class="field" for="${id}">${label}<input id="${id}" type="${type}" autocomplete="${auto}" aria-describedby="${id}-err" ${extra}><span class="err" id="${id}-err"></span></label>`;

export function mountAuth(root: HTMLElement, view: AuthView, onSignedIn: () => void, info = ''): void {
  const go = (v: AuthView, msg = '') => mountAuth(root, v, onSignedIn, msg);
  const device = '<div class="device" aria-hidden="true"><div class="lcd"><div class="egg"></div></div><div class="btns"><i></i><i></i><i></i></div></div>';
  const cfg = isConfigured ? '' : '<p class="notice bad">Chưa cấu hình Supabase. Tạo file <code>.env</code> theo <code>.env.example</code> rồi chạy lại.</p>';
  const back = '<button type="button" class="link back" data-go="gate">← Quay lại</button>';
  const views: Record<AuthView, string> = {
    gate: `${device}<h1>Hatchday</h1><p class="sub">Một người bạn nhỏ đang chờ bạn.</p>${cfg}
      <div class="stack"><button class="btn" data-go="login">Đăng nhập</button><button class="btn ghost" data-go="register">Tạo tài khoản</button>
      <div class="or">hoặc</div><p class="err" id="form-err" role="alert"></p><button class="btn ghost google" id="google">${GOOGLE_ICON}Đăng nhập bằng Google</button></div>`,
    login: `${back}<h1>Đăng nhập</h1>${info ? `<p class="notice">${esc(info)}</p>` : ''}<form novalidate>
      ${field('email', 'Email', 'email', 'email', 'inputmode="email" required')}
      ${field('password', 'Mật khẩu', 'password', 'current-password', 'required')}
      <div class="row-between"><label class="check"><input type="checkbox" id="remember" checked> Ghi nhớ tôi</label><button type="button" class="link" data-go="forgot">Quên mật khẩu?</button></div>
      <p class="err" id="form-err" role="alert"></p><button class="btn" type="submit">Đăng nhập</button></form>
      <p class="sub">Chưa có tài khoản? <button type="button" class="link" data-go="register">Tạo tài khoản</button></p>`,
    register: `${back}<h1>Tạo tài khoản</h1><form novalidate>
      ${field('email', 'Email', 'email', 'email', 'inputmode="email" required')}
      ${field('password', 'Mật khẩu (ít nhất 8 ký tự)', 'password', 'new-password', 'required minlength="8"')}
      ${field('password2', 'Nhập lại mật khẩu', 'password', 'new-password', 'required')}
      <label class="check"><input type="checkbox" id="terms"> <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách riêng tư</span></label><span class="err" id="terms-err"></span>
      <p class="err" id="form-err" role="alert"></p><button class="btn" type="submit">Tạo tài khoản</button></form>
      <p class="sub">Đã có tài khoản? <button type="button" class="link" data-go="login">Đăng nhập</button></p>`,
    forgot: `<button type="button" class="link back" data-go="login">← Quay lại</button><h1>Quên mật khẩu</h1>
      <p class="sub">Nhập email bạn đã đăng ký. Chúng mình sẽ gửi link đặt lại mật khẩu, link có hiệu lực trong 1 giờ.</p>
      ${info ? `<p class="notice" role="status">${esc(info)}</p>` : ''}<form novalidate>${field('email', 'Email', 'email', 'email', 'inputmode="email" required')}
      <p class="err" id="form-err" role="alert"></p><button class="btn" type="submit">Gửi link đặt lại</button></form>`,
    reset: `<h1>Đặt mật khẩu mới</h1><form novalidate>
      ${field('password', 'Mật khẩu mới (ít nhất 8 ký tự)', 'password', 'new-password', 'required minlength="8"')}
      ${field('password2', 'Nhập lại mật khẩu mới', 'password', 'new-password', 'required')}
      <p class="err" id="form-err" role="alert"></p><button class="btn" type="submit">Lưu mật khẩu</button></form>`,
    'check-email': `${device}<h1>Kiểm tra email nhé</h1><p class="notice" role="status">${esc(info || 'Chúng mình đã gửi thư xác minh. Mở thư và bấm vào link để bắt đầu.')}</p>
      <button class="btn ghost" data-go="login">Về trang đăng nhập</button>`,
  };
  root.innerHTML = `<main class="screen"><section class="card" aria-live="polite">${views[view]}</section></main>`;
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => root.querySelector<T>('#' + id);

  root.querySelectorAll<HTMLElement>('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go as AuthView)));
  root.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const inp = $(b.dataset.toggle!)!; const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; b.textContent = show ? 'Ẩn' : 'Hiện'; b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  }));
  $<HTMLButtonElement>('google')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) alertInline(viError(error));
  });

  const form = root.querySelector('form');
  if (!form) return;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const setErr = (id: string, msg: string) => { const e = $(id + '-err'); const i = $(id); if (e) e.textContent = msg; if (i) i.setAttribute('aria-invalid', String(!!msg)); };
  function alertInline(msg: string) { const e = $('form-err'); if (e) e.textContent = msg; }
  const busy = (on: boolean, label: string) => { submit.disabled = on; submit.textContent = label; };

  form.addEventListener('submit', async ev => {
    ev.preventDefault(); alertInline('');
    const email = $('email')?.value.trim() ?? '';
    const pw = $('password')?.value ?? '', pw2 = $('password2')?.value ?? '';
    let bad = false;
    if ($('email')) { const m = !email ? 'Bạn chưa nhập email.' : !emailOk(email) ? 'Email chưa đúng định dạng, ví dụ ten@gmail.com.' : ''; setErr('email', m); bad ||= !!m; }
    if (view === 'login') { const m = pw ? '' : 'Bạn chưa nhập mật khẩu.'; setErr('password', m); bad ||= !!m; }
    if (view === 'register' || view === 'reset') {
      const m1 = pw.length < 8 ? 'Mật khẩu cần ít nhất 8 ký tự.' : ''; setErr('password', m1);
      const m2 = pw2 !== pw ? 'Hai mật khẩu chưa giống nhau.' : ''; setErr('password2', m2); bad ||= !!(m1 || m2);
    }
    if (view === 'register') { const ok = $('terms')!.checked; const e = $('terms-err'); if (e) e.textContent = ok ? '' : 'Bạn cần đồng ý điều khoản để tạo tài khoản.'; bad ||= !ok; }
    if (bad) { root.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(); return; }

    try {
      if (view === 'login') {
        const lock = lockedMinutes();
        if (lock) { alertInline(`Bạn nhập sai nhiều lần. Thử lại sau ${lock} phút nhé.`); return; }
        busy(true, 'Đang đăng nhập…');
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) { if (error.code === 'invalid_credentials') addFail(); throw error; }
        clearFails();
        try { localStorage.setItem('hatchday-remember', $('remember')!.checked ? '1' : '0'); sessionStorage.setItem('hatchday-alive', '1'); } catch { /* bỏ qua */ }
        onSignedIn();
      } else if (view === 'register') {
        busy(true, 'Đang tạo…');
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.session) onSignedIn();
        else go('check-email', `Chúng mình đã gửi thư xác minh tới ${email}. Mở thư và bấm vào link để bắt đầu.`);
      } else if (view === 'forgot') {
        busy(true, 'Đang gửi…');
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}?reset=1` });
        go('forgot', 'Nếu email này có tài khoản, bạn sẽ nhận được thư trong vài phút. Nhớ xem cả mục Spam nhé.');
      } else if (view === 'reset') {
        busy(true, 'Đang lưu…');
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        await supabase.auth.signOut({ scope: 'others' });
        history.replaceState(null, '', location.pathname);
        onSignedIn();
      }
    } catch (e) {
      alertInline(viError(e));
      busy(false, { login: 'Đăng nhập', register: 'Tạo tài khoản', forgot: 'Gửi link đặt lại', reset: 'Lưu mật khẩu' }[view as 'login'] ?? 'Thử lại');
    }
  });
  root.querySelector<HTMLInputElement>('input')?.focus();
}

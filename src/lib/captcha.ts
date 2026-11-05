/**
 * Cloudflare Turnstile cho Supabase Auth (Authentication > Bot and Abuse Protection > CAPTCHA).
 * Chỉ bật khi có VITE_TURNSTILE_SITE_KEY; không có thì mọi hàm là no-op (chế độ thử, chưa bật CAPTCHA).
 * Token chỉ dùng được một lần: gọi reset() sau mỗi lần gửi.
 */
interface TurnstileApi {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const captchaEnabled = Boolean(SITE_KEY);

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = () => ok(); s.onerror = () => { loading = null; bad(new Error('captcha_load')); };
    document.head.appendChild(s);
  });
  return loading;
}

export interface Captcha {
  /** Chờ token (tối đa 20 giây). undefined nếu CAPTCHA chưa bật. */
  token(): Promise<string | undefined>;
  reset(): void;
  remove(): void;
}

const NOOP: Captcha = { token: async () => undefined, reset() {}, remove() {} };

export function mountCaptcha(el: HTMLElement | null): Captcha {
  if (!captchaEnabled || !el) return NOOP;
  let wid = '', tok: string | undefined, wait: ((t: string | undefined) => void) | null = null, failed = false;
  const set = (t: string | undefined) => { tok = t; if (t && wait) { wait(t); wait = null; } };
  load().then(() => {
    // 'interaction-only': chỉ hiện khi Cloudflare cần người dùng tương tác, còn lại chạy ngầm.
    wid = window.turnstile!.render(el, {
      sitekey: SITE_KEY, appearance: 'interaction-only', language: 'vi', theme: 'auto',
      callback: (t: string) => set(t),
      'expired-callback': () => set(undefined),
      'error-callback': () => { failed = true; if (wait) { wait(undefined); wait = null; } },
    });
  }).catch(() => { failed = true; if (wait) { wait(undefined); wait = null; } });
  return {
    token() {
      if (tok) return Promise.resolve(tok);
      if (failed) return Promise.reject(new Error('captcha_failed'));
      return new Promise<string | undefined>((ok, bad) => {
        const t = setTimeout(() => { wait = null; bad(new Error('captcha_timeout')); }, 20_000);
        wait = v => { clearTimeout(t); v ? ok(v) : bad(new Error('captcha_failed')); };
      });
    },
    reset() { tok = undefined; failed = false; if (wid && window.turnstile) window.turnstile.reset(wid); },
    remove() { if (wid && window.turnstile) window.turnstile.remove(wid); wid = ''; },
  };
}

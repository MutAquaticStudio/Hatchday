/**
 * Báo lỗi JS chưa xử lý lên nhật ký lỗi của nhà phát triển (log_client_error). Rất kiệm: tối đa 5 bản mỗi lần mở trang, bỏ lỗi mạng và lỗi
 * của tiện ích trình duyệt, chỉ gửi khi đã đăng nhập thật (bản Chơi thử không gửi). Không gửi nội dung người chơi nhập.
 */
import { isDemo, logClientError } from '../data/api';

const MAX_PER_PAGE = 5;
/** Lỗi không phải của game: mạng chập chờn, tiện ích, hiệu ứng trình duyệt vô hại. */
export const IGNORED = /ResizeObserver loop|Script error|Failed to fetch|Load failed|NetworkError|Network request failed|AbortError|The operation was aborted|chrome-extension|moz-extension|safari-extension|Non-Error promise rejection/i;

export function shouldReport(message: string, stack: string | undefined): boolean {
  if (!message) return false;
  return !IGNORED.test(message) && !(stack && IGNORED.test(stack));
}

const build = (): string => { try { return document.querySelector<HTMLScriptElement>('script[src*="index-"]')?.src.match(/index-([\w-]+)/)?.[1] ?? 'dev'; } catch { return 'dev'; } };
const place = (): string => { try { return document.getElementById('scene-tag')?.textContent?.trim() || 'home'; } catch { return ''; } };

let sent = 0; const seen = new Set<string>();
function send(kind: 'js' | 'promise', message: string, stack?: string): void {
  if (isDemo || sent >= MAX_PER_PAGE || !shouldReport(message, stack)) return;
  const key = kind + message.slice(0, 80); if (seen.has(key)) return; seen.add(key); sent++;
  logClientError(kind, message, (stack || '').split('\n').slice(0, 6).join('\n'), place(), build()).catch(() => {});
}

let installed = false;
export function installErrorReporting(): void {
  if (installed || isDemo) return; installed = true;
  window.addEventListener('error', e => send('js', e.message || String(e.error?.message ?? ''), e.error?.stack));
  window.addEventListener('unhandledrejection', e => { const r = e.reason as { message?: string; stack?: string } | string | undefined; send('promise', typeof r === 'string' ? r : r?.message ?? '', typeof r === 'object' ? r?.stack : undefined); });
}

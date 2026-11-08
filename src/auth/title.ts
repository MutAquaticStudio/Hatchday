/**
 * Màn tiêu đề của bản Steam (thay trang giới thiệu web): logo lớn, quả trứng máy nuôi, các nút chính và số phiên bản.
 * `actions` là cụm nút đăng nhập / chơi (giữ nguyên id để luồng đăng nhập chạy như bản web); bản máy tính có thêm "Thoát game".
 */
import { _t } from '../i18n';
import './title.css';
import { desktop } from '../lib/platform';
import { LANG, setLang } from '../i18n';

const VERSION = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_APP_VERSION || '0.1.0';

export function titleHtml(actions: string, notice = ''): string {
  return _t`<div class="title-screen">
  <div class="ts-sky" aria-hidden="true"><i class="c1"></i><i class="c2"></i><i class="c3"></i></div>
  <main class="ts-main">
    <div class="ts-art" aria-hidden="true"><div class="device"><div class="lcd"><div class="egg"></div></div><div class="btns"><i></i><i></i><i></i></div></div>
      <span class="ts-spark s1">✦</span><span class="ts-spark s2">♡</span><span class="ts-spark s3">✦</span></div>
    <h1 class="ts-logo">Hatchday</h1>
    <p class="ts-tag">Một người bạn nhỏ đang chờ bạn.</p>
    ${notice}
    <div class="ts-actions">${actions}${desktop ? _t('<button class="btn ghost" id="ts-quit" type="button">Thoát game</button>') : ''}</div>
  </main>
  <footer class="ts-foot"><span>v${VERSION}</span><span class="ts-lang" role="group" aria-label="Language">🌐 <button type="button" data-lang="vi" aria-pressed="${LANG === 'vi'}">Tiếng Việt</button> · <button type="button" data-lang="en" aria-pressed="${LANG === 'en'}">English</button></span><span>© 2026 Hatchday</span></footer>
</div>`;
}

export function bindTitle(root: ParentNode): void {
  root.querySelector('#ts-quit')?.addEventListener('click', () => desktop?.quit());
  root.querySelectorAll<HTMLButtonElement>('.ts-lang [data-lang]').forEach(b => b.addEventListener('click', () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang as 'vi' | 'en'); }));
}

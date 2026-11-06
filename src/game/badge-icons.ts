/** Icon huy hiệu vẽ riêng (SVG 32×32, nét nâu, màu kẹo) thay cho emoji để giống nhau trên mọi máy. */
const S = 'stroke="#5a3a4a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const svg = (inner: string) => `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">${inner}</svg>`;

export const BADGE_ICONS: Record<string, string> = {
  swing10: svg(`<path d="M6 28 16 5l10 23M10 19h12" fill="none" ${S}/><path d="M12 19v6M20 19v6" ${S} fill="none"/><rect x="10" y="24.5" width="12" height="3.5" rx="1.5" fill="#ff9ec4" ${S}/>`),
  seesaw10: svg(`<path d="M16 17 10 28h12z" fill="#ffd36e" ${S}/><path d="M3 21 29 12" ${S} fill="none" stroke-width="3.5"/><circle cx="6" cy="17" r="3" fill="#7ec8ff" ${S}/><circle cx="26" cy="8.5" r="3" fill="#ff9ec4" ${S}/>`),
  slide10: svg(`<path d="M6 28V6M12 28V6M6 10h6M6 16h6M6 22h6" fill="none" ${S}/><path d="M12 7c8 0 12 9 16 19" fill="none" ${S} stroke-width="4" stroke="#7ec8ff"/><path d="M12 7c8 0 12 9 16 19" fill="none" ${S}/>`),
  ducks10: svg(`<path d="M5 20c0-6 4-9 9-9 2-5 8-5 9 0l4 2-4 2c0 6-4 10-10 10-5 0-8-2-8-5z" fill="#ffd36e" ${S}/><circle cx="19" cy="9.5" r="1.3" fill="#5a3a4a"/><path d="M23 11l5 1.5-4.5 1.5" fill="#ff9a76" ${S}/>`),
  bench15: svg(`<rect x="4" y="12" width="24" height="5" rx="2" fill="#e8b47a" ${S}/><rect x="4" y="19" width="24" height="4" rx="1.5" fill="#d9a066" ${S}/><path d="M7 23v5M25 23v5" ${S} fill="none"/>`),
  fountain15: svg(`<path d="M4 24h24l-3 4H7z" fill="#cfe9ff" ${S}/><path d="M9 24c0-4 3-5 7-5s7 1 7 5" fill="#8ed6ff" ${S}/><path d="M16 19V9" ${S} fill="none"/><path d="M16 9c-3-1-5 1-6 4M16 9c3-1 5 1 6 4" ${S} fill="none"/><circle cx="16" cy="6" r="2" fill="#8ed6ff" ${S}/>`),
  stage5: svg(`<path d="M3 5h26v4c-4 0-4 3-8 3s-4-3-6-3-3 3-6 3-5-3-6-3z" fill="#ff9ec4" ${S}/><rect x="3" y="24" width="26" height="4" rx="1.5" fill="#e8b47a" ${S}/><path d="m16 11 1.8 4.4 4.6.4-3.5 3 1.1 4.5L16 20.9l-4 2.4 1.1-4.5-3.5-3 4.6-.4z" fill="#ffd36e" ${S}/>`),
  tea12: svg(`<path d="M6 13h17v6c0 5-3 8-8.5 8S6 24 6 19z" fill="#fff" ${S}/><path d="M23 15h2.5a3 3 0 0 1 0 6H22" fill="none" ${S}/><path d="M11 9c-1-2 1-3 0-5M17 9c-1-2 1-3 0-5" ${S} fill="none"/><path d="M8 15h13" stroke="#ff9a76" stroke-width="2.5" stroke-linecap="round"/>`),
  cat10: svg(`<path d="M6 12 7 4l6 4h6l6-4 1 8c2 8-3 16-10 16S4 20 6 12z" fill="#ffcf9a" ${S}/><circle cx="12" cy="16" r="1.5" fill="#5a3a4a"/><circle cx="20" cy="16" r="1.5" fill="#5a3a4a"/><path d="M14.5 20q1.5 1.5 3 0M16 18.5v1.5" ${S} fill="none"/><path d="M5 19 1.5 18M5 22l-3 2M27 19l3.5-1M27 22l3 2" ${S} fill="none"/>`),
  butterfly40: svg(`<path d="M16 15C13 4 4 4 4 11s6 9 12 4zM16 15c3-11 12-11 12-4s-6 9-12 4z" fill="#ff9ec4" ${S}/><path d="M16 17c-4 0-9 3-7 8s6 1 7-3zM16 17c4 0 9 3 7 8s-6 1-7-3z" fill="#c9a6ff" ${S}/><path d="M16 9v16M14 6l2 3 2-3" ${S} fill="none"/>`),
  brew5: svg(`<path d="M7 14h15v7c0 4-3 7-7.5 7S7 25 7 21z" fill="#7ec8a0" ${S}/><path d="M22 17h3a3 3 0 0 1 0 6h-3M7 17H4.5" fill="none" ${S}/><path d="M12 14v-2h5v2M14.5 12V9.5" ${S} fill="none"/><circle cx="14.5" cy="8" r="1.8" fill="#ffd36e" ${S}/>`),
  explore7: svg(`<circle cx="16" cy="16" r="12" fill="#fff" ${S}/><path d="m21 11-3 7-7 3 3-7z" fill="#ff9ec4" ${S}/><circle cx="16" cy="16" r="1.5" fill="#5a3a4a"/><path d="M16 4v2.5M16 25.5V28M4 16h2.5M25.5 16H28" ${S} fill="none"/>`),
};

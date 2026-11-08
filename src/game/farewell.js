// Chia tay: khi bé hết tuổi thọ (server báo qua onDepart), phủ một lớp lặng lẽ lên màn chơi.
// Bấm Tiếp tục thì tải lại trang: main.ts thấy không còn bé đang sống nên mở trang tưởng niệm và đón trứng đời sau.
import { _t } from '../i18n';
import { onDepart } from './store';
import { $, esc } from './dom.js';

export function initFarewell() {
  onDepart(p => {
    if (document.querySelector('.farewell')) return;
    const el = document.createElement('div');
    el.className = 'farewell'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'fw-t');
    el.innerHTML = _t`<div class="farewell-card"><div class="fw-star" aria-hidden="true">✦</div><h2 id="fw-t">${esc(p.name)} đã ra đi</h2>
      <p>Bé đã sống ${p.lived_days ?? ''} ngày bên bạn. Cảm ơn bạn đã chăm bé thật nhiều.</p><button type="button" class="btn-sm" id="fw-go">Tiếp tục</button></div>`;
    $('app').appendChild(el);
    $('fw-go').addEventListener('click', () => location.reload());
    $('fw-go').focus();
  });
}

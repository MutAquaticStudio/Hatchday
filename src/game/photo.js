// Chế độ chụp ảnh: ẩn giao diện, chụp khung 3D hiện tại, thêm khung viền + tên bé + ngày rồi lưu hoặc chia sẻ.
// Ảnh chỉ nằm trên máy người chơi (tải về hoặc mở hộp chia sẻ của hệ điều hành); không gửi gì lên máy chủ.

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Ghép ảnh chụp + khung: viền bo góc, chân ảnh có tên bé, nơi chụp và ngày. Trả về canvas. */
export function composePhoto(src, { name, place, date }) {
  const W = src.width, H = src.height, pad = Math.round(W * 0.035), foot = Math.round(W * 0.15);
  const cv = document.createElement('canvas'); cv.width = W + pad * 2; cv.height = H + pad + foot;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff7fb'; g.fillRect(0, 0, cv.width, cv.height);
  g.save(); g.beginPath(); g.roundRect(pad, pad, W, H, pad * 0.9); g.clip(); g.drawImage(src, pad, pad, W, H); g.restore();
  g.lineWidth = Math.max(3, pad * 0.18); g.strokeStyle = '#f4b6d0'; g.beginPath(); g.roundRect(pad, pad, W, H, pad * 0.9); g.stroke();
  g.fillStyle = '#4a2a52'; g.textBaseline = 'middle';
  g.font = `800 ${Math.round(foot * 0.34)}px "Baloo 2", system-ui, sans-serif`; g.textAlign = 'left'; g.fillText(name, pad * 1.3, pad + H + foot * 0.36);
  g.font = `700 ${Math.round(foot * 0.2)}px "Nunito", system-ui, sans-serif`; g.fillStyle = '#8a6a92'; g.fillText(`${place} · ${date}`, pad * 1.3, pad + H + foot * 0.7);
  g.textAlign = 'right'; g.fillStyle = '#ff6aa0'; g.font = `800 ${Math.round(foot * 0.26)}px "Baloo 2", system-ui, sans-serif`; g.fillText('Hatchday', cv.width - pad * 1.3, pad + H + foot * 0.5);
  return cv;
}

export function initPhoto({ ctx, app, $ }) {
  let bar = null, view = null, blob = null, url = '';

  function ensure() {
    if (bar) return;
    bar = document.createElement('div'); bar.id = 'photo-ui'; bar.className = 'photo-ui'; bar.hidden = true;
    bar.innerHTML = '<button type="button" class="btn-sm ghost" data-photo-exit>Thoát</button><button type="button" class="shutter" data-photo-shot aria-label="Chụp ảnh"><i></i></button><span class="photo-tip">Chạm để bé di chuyển, rồi bấm nút chụp</span>';
    view = document.createElement('div'); view.id = 'photo-view'; view.className = 'mini'; view.hidden = true; view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true');
    app.append(bar, view);
    bar.addEventListener('click', e => { if (e.target.closest('[data-photo-exit]')) exit(); else if (e.target.closest('[data-photo-shot]')) shoot(); });
    view.addEventListener('click', e => {
      if (e.target.closest('[data-photo-retake]')) { closeView(); return; }
      if (e.target.closest('[data-photo-done]')) { closeView(); exit(); return; }
      if (e.target.closest('[data-photo-save]')) save();
      if (e.target.closest('[data-photo-share]')) share();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !bar.hidden) { if (!view.hidden) closeView(); else exit(); } });
  }
  function enter() {
    if (ctx.state.asleep) { ctx.toast('Bé đang ngủ, chụp ảnh sau nhé.'); return; }
    ensure(); ctx.closeAllSheets?.(); $('stats').hidden = true; app.classList.add('photo'); bar.hidden = false;
    ctx.hideHint?.(); setTimeout(() => ctx.toast('Bé sẽ tạo dáng cho bạn. Bấm nút tròn để chụp!'), 250);
  }
  function exit() { if (!bar) return; app.classList.remove('photo'); bar.hidden = true; closeView(); }
  function closeView() { if (view) { view.hidden = true; view.innerHTML = ''; } if (url) { URL.revokeObjectURL(url); url = ''; } blob = null; }

  async function shoot() {
    const shotBtn = bar.querySelector('[data-photo-shot]'); shotBtn.disabled = true;
    try {
      ctx.pose?.(); // bé tạo dáng một nhịp
      await new Promise(r => setTimeout(r, 450));
      const src = await ctx.capture();
      const d = new Date(), date = d.toLocaleDateString('vi-VN');
      const cv = composePhoto(src, { name: ctx.state.name, place: ctx.placeName(), date });
      blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (!blob) throw new Error('capture');
      url = URL.createObjectURL(blob); ctx.sfx('badge');
      const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([blob], 'x.png', { type: 'image/png' })] });
      view.hidden = false;
      view.innerHTML = `<div class="mini-card photo-card"><header class="mini-head"><div><h2>Ảnh của ${esc(ctx.state.name)}</h2><span>Đẹp quá! Lưu lại nhé</span></div></header>
        <img class="photo-img" src="${url}" alt="Ảnh vừa chụp">
        <div class="mini-actions"><button type="button" class="btn-sm" data-photo-save>Lưu ảnh</button>${canShare ? '<button type="button" class="btn-sm" data-photo-share>Chia sẻ</button>' : ''}<button type="button" class="btn-sm ghost" data-photo-retake>Chụp lại</button><button type="button" class="btn-sm ghost" data-photo-done>Xong</button></div></div>`;
    } catch (e) { ctx.toast('Chưa chụp được, thử lại nhé.'); console.warn(e); }
    shotBtn.disabled = false;
  }
  const fileName = () => `hatchday-${(ctx.state.name || 'be').toLowerCase().replace(/[^a-z0-9À-ỹ]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.png`;
  function save() {
    if (!blob) return; const a = document.createElement('a'); a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove(); ctx.toast('Đã lưu ảnh vào máy.');
  }
  async function share() {
    if (!blob) return;
    try { await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], title: `Ảnh của ${ctx.state.name}` }); } catch (e) { if (e && e.name !== 'AbortError') ctx.toast('Chưa chia sẻ được, thử Lưu ảnh nhé.'); }
  }
  return { enter, exit, isOpen: () => !!bar && !bar.hidden };
}

import './styles/base.css';
import { supabase, isConfigured } from './lib/supabase';
import { mountAuth } from './auth/auth-ui';
import { mountOnboarding } from './onboarding/onboarding';
import { getMyPet, listFamily, setTimezone } from './data/api';
import { viError } from './lib/errors';
import { captureReferral, startTelemetry } from './lib/telemetry';

const root = document.getElementById('root')!;
let started = false;

/** "Ghi nhớ tôi" tắt: phiên trình duyệt mới thì đăng xuất. */
async function enforceRemember(): Promise<void> {
  try {
    if (localStorage.getItem('hatchday-remember') === '0' && !sessionStorage.getItem('hatchday-alive')) await supabase.auth.signOut();
    sessionStorage.setItem('hatchday-alive', '1');
  } catch { /* bỏ qua */ }
}

async function startGame(): Promise<void> {
  if (started) return;
  started = true;
  root.innerHTML = '<main class="screen"><section class="card"><div class="device" aria-hidden="true"><div class="lcd"><div class="egg"></div></div><div class="btns"><i></i><i></i><i></i></div></div><p class="sub" role="status">Đang mở cửa nhà…</p></section></main>';
  const [{ hydrate }, markup] = await Promise.all([import('./game/store'), import('./game/markup.html?raw')]);
  await import('./game/game.css');
  await hydrate();
  root.innerHTML = markup.default;
  const logout = document.getElementById('btn-logout');
  if (logout && !isConfigured) {
    logout.textContent = 'Thoát bản chơi thử';
    const note = document.querySelector('#stats .note');
    if (note) note.textContent = 'Chỉ số giảm theo giờ thật, kể cả khi bạn đóng trang. Bản chơi thử lưu dữ liệu trên trình duyệt này.';
  }
  logout?.addEventListener('click', async () => { if (isConfigured) await supabase.auth.signOut(); location.replace(location.pathname); });
  await import('./game/game.js');
  startTelemetry();
}

async function onSignedIn(): Promise<void> {
  try {
    await setTimezone();
    const pet = await getMyPet();
    if (pet && pet.stage !== 'departed') await startGame();
    else {
      // chưa có bé đang sống: nếu từng có bé đã đi thì đón quả trứng đời sau, không thì là lần đầu chơi
      const gone = (await listFamily()).filter(p => p.stage === 'departed');
      mountOnboarding(root, () => { startGame(); }, { parent: gone[gone.length - 1] });
    }
  } catch (e) {
    started = false;
    mountAuth(root, 'login', onSignedIn, viError(e));
  }
}

/** Service worker: chỉ ở bản chạy thật (mở nhanh, mở được khi mất mạng, nhận thông báo đẩy sau này). */
function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* bỏ qua */ }); });
}

async function boot(): Promise<void> {
  captureReferral();
  registerSW();
  if (!isConfigured) { mountAuth(root, 'gate', onSignedIn); return; }
  const recovering = new URLSearchParams(location.search).has('reset');
  supabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') mountAuth(root, 'reset', onSignedIn);
  });
  await enforceRemember();
  const { data } = await supabase.auth.getSession();
  if (recovering && data.session) { mountAuth(root, 'reset', onSignedIn); return; }
  if (data.session) await onSignedIn();
  else mountAuth(root, 'gate', onSignedIn);
}

boot();

import './styles/base.css';
import { supabase, isConfigured } from './lib/supabase';
import { mountAuth } from './auth/auth-ui';
import { mountOnboarding } from './onboarding/onboarding';
import { getMyPet, setTimezone } from './data/api';
import { viError } from './lib/errors';

const root = document.getElementById('root')!;
let started = false;

/** "Ghi nhớ tôi" tắt: phiên trình duyệt mới thì đăng xuất. */
async function enforceRemember(): Promise<void> {
  try {
    if (localStorage.getItem('thu-ao-remember') === '0' && !sessionStorage.getItem('thu-ao-alive')) await supabase.auth.signOut();
    sessionStorage.setItem('thu-ao-alive', '1');
  } catch { /* bỏ qua */ }
}

async function startGame(): Promise<void> {
  if (started) return;
  started = true;
  root.innerHTML = '<main class="screen"><section class="card"><p class="sub" role="status">Đang mở cửa nhà…</p></section></main>';
  const [{ hydrate }, markup] = await Promise.all([import('./game/store'), import('./game/markup.html?raw')]);
  await import('./game/game.css');
  await hydrate();
  root.innerHTML = markup.default;
  document.getElementById('btn-logout')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.replace(location.pathname); });
  await import('./game/game.js');
}

async function onSignedIn(): Promise<void> {
  try {
    await setTimezone();
    const pet = await getMyPet();
    if (pet) await startGame();
    else mountOnboarding(root, () => { startGame(); });
  } catch (e) {
    started = false;
    mountAuth(root, 'login', onSignedIn, viError(e));
  }
}

async function boot(): Promise<void> {
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

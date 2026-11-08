/**
 * Đăng ký Web Push (thông báo đẩy khi đóng hẳn trình duyệt). Chỉ bật ở bản chạy thật có khoá VAPID công khai (VITE_VAPID_PUBLIC_KEY)
 * và trình duyệt hỗ trợ. Máy chủ gửi từ Cloudflare Worker (workers/cron). Trên iPhone chỉ chạy khi đã Thêm vào Màn hình chính.
 */
import { isSteam } from './platform';
import { getPushState, isDemo, removePushSubscription, savePushSubscription } from '../data/api';
import { isStandalone } from './telemetry';

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushSupported = (): boolean => !isDemo && !isSteam && !!KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);
/** iPhone/iPad chỉ nhận push khi đã cài PWA. */
export const needsInstall = (): boolean => isIos() && !isStandalone();

const toBytes = (b64u: string): Uint8Array<ArrayBuffer> => {
  const s = atob(b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length)); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
};
const ready = (): Promise<ServiceWorkerRegistration> => Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, bad) => setTimeout(() => bad(new Error('sw_not_ready')), 4000))]);

/** Đăng ký (hoặc làm mới) đăng ký thiết bị này với máy chủ. Cần quyền thông báo đã được cấp. */
export async function subscribePush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await ready();
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY!) });
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  await savePushSubscription(j.endpoint, j.keys.p256dh, j.keys.auth, navigator.userAgent.slice(0, 180));
  return true;
}
export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await ready(), sub = await reg.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* bỏ qua */ }
}
export const serverPushEnabled = async (): Promise<boolean> => { try { return (await getPushState()).enabled === true; } catch { return false; } };

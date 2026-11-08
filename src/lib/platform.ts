/**
 * Nền tảng của bản build: `web` (trình duyệt, như trước) hoặc `steam` (đóng gói Electron, build với VITE_PLATFORM=steam).
 * Bản Steam: không có trang giới thiệu/ủng hộ bên ngoài, không quảng cáo thưởng, không push trình duyệt, không service worker
 * (quy định Steam và môi trường Electron). `desktop` là cầu nối do desktop/preload.cjs đưa vào (không có ở trình duyệt).
 */
export type Platform = 'web' | 'steam';
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
export const PLATFORM: Platform = env.VITE_PLATFORM === 'steam' ? 'steam' : 'web';
export const isSteam = PLATFORM === 'steam';

export interface DesktopBridge {
  /** Bật/tắt toàn màn hình; không truyền thì đảo trạng thái. Trả trạng thái mới. */
  fullscreen(on?: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  quit(): void;
  /** Mở liên kết ngoài bằng trình duyệt mặc định (chỉ https). */
  openExternal(url: string): void;
  /** Hệ số cỡ giao diện người chơi chọn (nhân với tỉ lệ tự động theo chiều cao cửa sổ). */
  uiScale?(v: number): void;
  os: string;
}
export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? (window as unknown as { hatchdayDesktop?: DesktopBridge }).hatchdayDesktop : undefined;

/**
 * Quảng cáo thưởng: xem video tự nguyện để nhận xu. Luật song song với supabase/migrations/20261211000000_ad_rewards.sql (test: ads.test.ts).
 * Máy chủ quyết định mọi thứ (mã dùng một lần, trần ngày, giãn cách, thời gian xem tối thiểu); client chỉ hiển thị quảng cáo qua AdProvider.
 * Chính sách: không đổi quảng cáo lấy thuốc/đồ cứu bé; không chạy khi hướng dẫn, chia tay, chữa bệnh, trang trí; có hộp đồng ý.
 */
export const AD = { reward: 20, perDay: 5, gapMinutes: 10, minWatchSeconds: 15, nonceMinutes: 5 } as const;

export type AdOutcome = 'viewed' | 'dismissed' | 'unavailable';
/** Nhà cung cấp quảng cáo (đổi được nếu không được duyệt): trả về kết quả sau khi quảng cáo kết thúc. */
export interface AdProvider {
  name: string;
  /** Hiện một quảng cáo thưởng. Phải tự đóng/hoàn tất rồi mới resolve. */
  show(o: { seconds: number; onTick?: (left: number) => void }): Promise<AdOutcome>;
}
export interface AdState { enabled: boolean | unknown; left: number; next_in: number; reward: number; per_day: number }
export interface AdTicket { nonce: string; reward: number; left: number; wait: number }

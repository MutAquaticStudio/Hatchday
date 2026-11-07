/** Gọi RPC quản trị. Có cấu hình Supabase thì gọi thật (khách riêng, chỉ khoá publishable, lưu phiên trong sessionStorage); không thì dùng bộ chạy thử trong bộ nhớ. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoRpc } from './demo';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const isDemo = !(url && key);
export const sb: SupabaseClient | null = isDemo ? null : createClient(url!, key!, { auth: { storageKey: 'hatchday-admin-auth', storage: sessionStorage, persistSession: true, autoRefreshToken: true } });

export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isDemo) return demoRpc(fn, args) as T;
  const { data, error } = await sb!.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Lỗi máy chủ → câu tiếng Việt. */
const MSG: Record<string, string> = {
  not_authenticated: 'Chưa đăng nhập.', not_admin: 'Tài khoản này không có quyền quản trị.', mfa_required: 'Cần xác thực hai bước.', forbidden: 'Vai trò của bạn không được làm việc này.',
  reason_required: 'Cần nhập lý do (ít nhất 3 ký tự).', grant_limit: 'Vượt hạn mức của vai trò (tối đa 200 xu và 5 phần).', invalid_grant: 'Quà chưa hợp lệ.', not_found: 'Không tìm thấy.',
  self_approval: 'Người tạo không được tự duyệt.', not_pending: 'Chiến dịch không còn chờ duyệt.', empty_audience: 'Không có ai thuộc nhóm nhận này.', invalid_campaign: 'Chiến dịch chưa hợp lệ.',
  invalid_announcement: 'Thông báo chưa hợp lệ.', invalid_event_config: 'Cấu hình sự kiện chưa hợp lệ.', last_owner: 'Không thể bỏ chủ cuối cùng.', cannot_sanction_admin: 'Không thể phạt quản trị viên.',
  invalid_sanction: 'Phạt chưa hợp lệ.', not_open: 'Báo cáo đã được xử lý.', invalid_word: 'Từ khoá chưa hợp lệ.', query_too_short: 'Gõ ít nhất 2 ký tự.', unknown_balance: 'Núm cân bằng không tồn tại.', balance_out_of_range: 'Giá trị nằm ngoài khoảng cho phép.', balance_needs_owner: 'Đổi lệch quá ±50% so với mặc định chỉ owner làm được.',  unknown_flag: 'Cờ không tồn tại.', invalid_flag: 'Giá trị cờ chưa hợp lệ.',
};
export const viMsg = (e: unknown): string => { const m = String((e as Error)?.message ?? e); const k = Object.keys(MSG).find(x => m.includes(x)); return k ? MSG[k] : m; };

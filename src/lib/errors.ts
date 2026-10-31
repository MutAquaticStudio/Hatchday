/** Đổi lỗi kỹ thuật thành câu tiếng Việt dễ hiểu, kèm cách xử lý. */
const AUTH: Record<string, string> = {
  invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
  user_already_exists: 'Email này đã có tài khoản. Bạn thử đăng nhập nhé.',
  email_exists: 'Email này đã có tài khoản. Bạn thử đăng nhập nhé.',
  weak_password: 'Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 8 ký tự, trộn chữ và số.',
  email_not_confirmed: 'Bạn cần xác minh email trước. Hãy mở thư chúng mình đã gửi.',
  over_request_rate_limit: 'Bạn thử hơi nhiều lần. Đợi vài phút rồi thử lại nhé.',
  over_email_send_rate_limit: 'Đã gửi nhiều thư quá. Đợi vài phút rồi thử lại nhé.',
  same_password: 'Mật khẩu mới cần khác mật khẩu cũ.',
  validation_failed: 'Thông tin chưa hợp lệ. Bạn kiểm tra lại email nhé.',
  session_expired: 'Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại nhé.',
};
const RPC: Record<string, string> = {
  pet_exists: 'Bạn đã có một bé thú rồi.',
  invalid_name: 'Tên cần từ 1 đến 16 ký tự.',
  rate_limited: 'Chậm lại chút nha, bé thú theo không kịp.',
  not_authenticated: 'Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại nhé.',
};

export function viError(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number } | null;
  if (!e) return 'Có lỗi xảy ra. Bạn thử lại nhé.';
  if (e.code && AUTH[e.code]) return AUTH[e.code];
  const m = e.message || '';
  for (const k of Object.keys(RPC)) if (m.includes(k)) return RPC[k];
  if (e.status === 0 || /fetch|network/i.test(m)) return 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.';
  return 'Có lỗi xảy ra. Bạn thử lại nhé.';
}

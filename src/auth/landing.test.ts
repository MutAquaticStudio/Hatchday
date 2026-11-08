import { describe, expect, it } from 'vitest';
import { donateHtml, qrSrc } from './landing';

describe('phần Ủng hộ ở trang chủ', () => {
  it('không có gì thì hiện "sắp mở"', () => { expect(donateHtml({})).toContain('Kênh ủng hộ sẽ sớm mở'); });
  it('hiện nút, chuyển khoản và mã VietQR tạo từ mã ngân hàng + số tài khoản', () => {
    const h = donateHtml({ donate_url: 'https://ko-fi.com/hatchday', donate_label: 'Mời ly trà', bank_name: 'Vietcombank', bank_account: '0123 456 789', bank_holder: 'NGUYEN VAN A', vietqr_bank: 'VCB' });
    expect(h).toContain('href="https://ko-fi.com/hatchday"'); expect(h).toContain('Mời ly trà'); expect(h).toContain('0123 456 789');
    expect(h).toContain('https://img.vietqr.io/image/VCB-0123456789-compact.png?addInfo=Ung+ho+Hatchday&amp;accountName=NGUYEN+VAN+A');
  });
  it('ảnh QR riêng trong trang được ưu tiên; ảnh ngoài trang bị bỏ', () => {
    expect(qrSrc({ qr_url: './landing/qr.png', vietqr_bank: 'VCB', bank_account: '1' })).toBe('./landing/qr.png');
    expect(qrSrc({ qr_url: 'https://evil.com/qr.png' })).toBe('');
    expect(qrSrc({ qr_url: '/../x.png' })).toBe('');
  });
  it('liên kết không phải https hoặc có ký tự lạ thì không hiện; chữ được thoát HTML', () => {
    expect(donateHtml({ donate_url: 'javascript:alert(1)' })).toContain('sẽ sớm mở');
    expect(donateHtml({ donate_url: 'https://x.com/"><script>' })).toContain('sẽ sớm mở');
    expect(donateHtml({ bank_name: '<b>x</b>', bank_account: '123' })).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

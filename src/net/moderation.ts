/**
 * Chuẩn hoá và bộ lọc chat phía client (để báo lỗi sớm và để kiểm thử). Giống hệt private.chat_normalize / private.chat_filter
 * trong supabase/migrations/20261209000000_chat_moderation.sql; test so khớp bằng bộ ngữ liệu supabase/tests/fixtures/chat-corpus.json.
 * Máy chủ mới là nơi quyết định; bản này không thay thế kiểm tra ở máy chủ.
 */
export interface WordRule { term: string; match: 'word' | 'substr'; action: 'block' | 'mask' | 'flag' }
export interface ChatResult { ok: boolean; reason: null | 'empty' | 'too_long' | 'invalid_chars' | 'emoji' | 'link' | 'phone' | 'filtered'; text: string; flag: boolean; norm: string }

export const CHAT = { maxLen: 100, maxEmoji: 3, minPhoneDigits: 9 } as const;
const LEET: Record<string, string> = { 'Đ': 'd', 'đ': 'd', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '7': 't', '$': 's' };

/** Bỏ dấu, đ→d, chữ thường, bỏ ký tự vô hình, đổi leet (chỉ để so khớp), gộp chữ lặp. */
export function normalize(t: string): string {
  const s = (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[​-‏‪-‮⁠﻿]/g, '').toLowerCase()
    .replace(/[Đđ0134@57$]/g, c => LEET[c]);
  return s.replace(/[^a-z0-9]+/g, ' ').replace(/([a-z])\1+/g, '$1').trim();
}

const emojiCount = (t: string) => [...t].filter(ch => { const c = ch.codePointAt(0)!; return (c >= 0x1f000 && c <= 0x1faff) || (c >= 0x2600 && c <= 0x27bf); }).length;

export function filterChat(input: string, words: WordRule[] = []): ChatResult {
  const t = (input ?? '').replace(/\s+/g, ' ').trim();
  const fail = (reason: ChatResult['reason'], norm = ''): ChatResult => ({ ok: false, reason, text: t, flag: false, norm });
  if (!t.length) return fail('empty');
  if ([...t].length > CHAT.maxLen) return fail('too_long');
  const n = normalize(t), sq = n.replace(/ /g, '');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/.test(t)) return fail('invalid_chars', n);
  if (emojiCount(t) > CHAT.maxEmoji) return fail('emoji', n);
  if (t.includes('@') || /(https?:|www\.|[a-z0-9-]+\.(com|vn|net|org|info|xyz|io|me|tv|gg|ly|co)\b)/.test(t.toLowerCase()) || /(http|www|dotcom|chamcom|dotvn|chamvn)/.test(sq)) return fail('link', n);
  if (t.replace(/[^0-9]/g, '').length >= CHAT.minPhoneDigits) return fail('phone', n);
  let masked = t, flag = false;
  for (const w of words) {
    const tn = normalize(w.term); if (!tn) continue;
    const hit = w.match === 'word' ? (' ' + n + ' ').includes(' ' + tn + ' ') : sq.includes(tn.replace(/ /g, ''));
    if (!hit) continue;
    if (w.action === 'block') return fail('filtered', n);
    if (w.action === 'flag') { flag = true; continue; }
    if (tn.includes(' ')) { flag = true; continue; }
    masked = masked.split(' ').map(x => ((w.match === 'word' && normalize(x) === tn) || (w.match === 'substr' && normalize(x).replace(/ /g, '').includes(tn))) ? '***' : x).join(' ');
  }
  return { ok: true, reason: null, text: masked, flag, norm: n };
}

/** Thông báo cho người chơi theo lý do bị từ chối. */
export const CHAT_REASON_TEXT: Record<string, string> = {
  empty: 'Bạn chưa gõ gì.', too_long: `Tin nhắn dài tối đa ${CHAT.maxLen} ký tự.`, invalid_chars: 'Tin nhắn có ký tự không cho phép.',
  emoji: `Chỉ dùng tối đa ${CHAT.maxEmoji} biểu tượng cảm xúc.`, link: 'Không gửi liên kết, email hay tên liên hệ ở đây nhé.', phone: 'Không gửi số điện thoại nhé.',
  filtered: 'Tin nhắn có từ không phù hợp nên chưa gửi được.',
};

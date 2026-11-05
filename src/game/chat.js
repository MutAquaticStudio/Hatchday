// Trò chuyện với thú. Hiện là bản mẫu trả lời theo từ khoá. Khi tích hợp AI, thay reply() bằng lời gọi Edge Function `chat`
// (xem docs/TDD.md mục 11); phần gửi/nhận và ghi nhớ vẫn giữ nguyên.
import { S, act, addTalkMemory } from './store';
import { $, clamp } from './dom.js';
import { count, remember } from './diary.js';
import { sfx } from './audio.js';
import { smallTalk } from './personality';

/** `c`: { reduce, hideHint, say, setTemp, spawn }. */
export function initChat(c) {
  const { reduce, hideHint, say, setTemp, spawn } = c;
  function reply(t) {
    const s = t.toLowerCase();
    if (S.asleep) return 'Zzz… (thú đang ngủ, mai nói tiếp nha)';
    if (/chào|hello|\bhi\b|alo/.test(s)) return `Chào bạn! ${S.name} nhớ bạn quá trời. Hôm nay bạn thế nào?`;
    if (/đói|ăn|cơm|kem/.test(s)) return S.no < 45 ? 'Đói lắm luôn á… cho mình ăn đi mà~' : 'Mình vừa ăn xong, no căng bụng rồi nè!';
    if (/buồn|mệt|chán|áp lực|stress/.test(s)) { setTemp('love', 2600); spawn('heart', 2); return 'Lại đây mình ôm một cái. Hôm nay bạn vất vả rồi ha.'; }
    if (/yêu|thương|thích bạn|cute|dễ thương/.test(s)) { setTemp('love', 2200); spawn('heart', 3); return 'Mình cũng thương bạn nhất luôn!'; }
    if (/tên/.test(s)) return `Mình là ${S.name} nè! Tên này bạn đặt đó.`;
    if (/ngủ/.test(s)) return 'Tối nay nhớ chúc mình ngủ ngon nha.';
    if (/làm|công việc|sếp|deadline/.test(s)) return 'Làm việc xong nhớ uống nước nha. Mình ngồi đây chờ bạn.';
    if (/nhớ/.test(s) && S.mem.length) { const m = S.mem[Math.floor(Math.random() * Math.min(S.mem.length, 8))]; return `Nhớ chứ! ${m.text}`; }
    setTemp('excited', 900);
    return smallTalk(S.personality);
  }
  $('chat').addEventListener('submit', e => {
    e.preventDefault(); const v = $('chat-input').value.trim(); if (!v) return;
    $('chat-input').value = ''; hideHint();
    setTemp('vui', 700); sfx('talk');
    setTimeout(() => say(reply(v), 4200), reduce ? 0 : 500);
    S.vui = clamp(S.vui + 2); count('talk'); act('talk');
    if (/(^|\s)(tôi|mình|em|anh|chị|tớ)(\s|$)/i.test(v) && v.length > 10) { remember('talk', `Bạn kể: “${v.slice(0, 70)}”`); addTalkMemory(v); }
  });
}

// Sổ sức khoẻ: tình trạng của bé, cách chữa, tủ thuốc và từ điển 8 bệnh (luật ở health.ts).
import { BLOCK_LABEL, clinicPrice, effectLines, FAMILY_NAME, healLine, HEALTH, ILLNESS_BY_ID, ILLNESSES, isSevere, MEDICINE_BY_ID, MEDICINES, minutesToRecover, minutesToSick, STAT_LABEL } from './health';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FAMILIES = ['bo-be', 'an-uong', 'van-dong', 'moi-truong'];
export const minutesVi = m => (m >= 60 ? `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}` : `${m} phút`);

/** Số món ngọt bé đã ăn hôm nay (từ nhật ký ngày trên máy). */
export const sweetsToday = S => (S.day?.groups || []).filter(g => g === 'ngot').length;

/** Việc bé không làm được lúc này ('play' | 'bath' | 'sweets'), rỗng nếu khoẻ. */
export const blockedNow = S => (S.illness ? ILLNESS_BY_ID[S.illness]?.block || [] : []);

/** Các cảnh báo "sắp ốm" lúc này, dạng câu ngắn. */
export function risks(S, hs, now) {
  const L = [], r = minutesToSick(hs, now);
  if (r) L.push(`${STAT_LABEL[r.stat]} của bé gần 0. Còn khoảng ${minutesVi(r.left)} nữa là bé bị ốm nếu chưa chăm.`);
  if (!S.illness && sweetsToday(S) >= HEALTH.sweetsLimit - 1) L.push(`Hôm nay bé đã ăn ${sweetsToday(S)} món ngọt. Thêm món ngọt thứ ${HEALTH.sweetsLimit} là bé bị sâu răng.`);
  return L;
}

function statusCard(S, hs, now, coinSvg) {
  const il = S.illness ? ILLNESS_BY_ID[S.illness] : null;
  if (!il) {
    const rs = risks(S, hs, now);
    return `<div class="sick-card ok"><div class="sick-head"><b>${esc(S.name)} đang khoẻ mạnh</b></div>
      <p class="sign">Chăm bé đều đặn thì bé không ốm. Bé chỉ ốm khi bị bỏ bê hoặc chăm chưa đúng cách (xem Sổ bệnh bên dưới).</p>
      ${rs.map(t => `<p class="risk">${esc(t)}</p>`).join('')}</div>`;
  }
  const sev = isSevere(hs, now), rec = minutesToRecover(hs, now), med = MEDICINE_BY_ID[il.medicine], have = S.owned[med.id] || 0, price = clinicPrice(sev);
  const heal = sev ? 'Bệnh đã nặng vì để quá 24 giờ chưa hồi phục. Thuốc không đủ, phải ra phòng khám.'
    : rec != null ? `Bé đang nghỉ ngơi, còn khoảng ${minutesVi(rec)} nữa là khỏi.` : `${healLine(il)}.`;
  const medBtn = sev ? '' : have
    ? `<button type="button" class="btn-sm" data-use-med="${med.id}">Cho uống ${esc(med.name)} (còn ${have})</button>`
    : `<button type="button" class="btn-sm" data-buy-med="${med.id}" ${S.coins >= med.price ? '' : 'disabled'}>${coinSvg}${med.price} · Mua ${esc(med.name)}</button>`;
  return `<div class="sick-card${sev ? ' severe' : ''}"><div class="sick-head"><b>${esc(S.name)} đang bị ${esc(il.name.toLowerCase())}</b>${sev ? '<span class="sev">Nặng</span>' : ''}<span class="fam">${FAMILY_NAME[il.family]}</span></div>
    <p class="sign">“${esc(il.sign)}”</p>
    <ul class="eff">${effectLines(il).map(t => `<li>${esc(t)}</li>`).join('')}${sev ? '<li>Bệnh nặng: giảm chỉ số nhanh hơn 25% nữa</li>' : ''}</ul>
    <p class="heal">${esc(heal)}</p>
    <div class="cure-row">${medBtn}<button type="button" class="btn-sm${sev ? '' : ' ghost'}" data-clinic ${S.coins >= price ? '' : 'disabled'}>${coinSvg}${price} · Phòng khám</button></div>
    <p class="hs-note">Phòng khám chữa khỏi ngay${il.heal.kind === 'stat' ? ` và bồi bổ ${STAT_LABEL[il.heal.stat]} lên ít nhất ${HEALTH.clinicRestore}` : ''}. Bé khỏi bệnh được +${HEALTH.cureBond} gắn bó.</p></div>`;
}

function cabinet(S, coinSvg) {
  return `<h3 class="qh">Tủ thuốc <small>mỗi loại tối đa ${HEALTH.medicineMax} liều</small></h3><div class="meds">${MEDICINES.map(m => {
    const have = S.owned[m.id] || 0, il = ILLNESS_BY_ID[m.cures], now = S.illness === m.cures;
    return `<div class="med${now ? ' now' : ''}"><div><b>${esc(m.name)}</b><span>Chữa ${esc(il.name.toLowerCase())} · có ${have}</span></div>
      <button type="button" class="btn-sm buy" data-buy-med="${m.id}" ${S.coins >= m.price && have < HEALTH.medicineMax ? '' : 'disabled'}>${coinSvg}${m.price}</button></div>`;
  }).join('')}</div>`;
}

function book() {
  return `<h3 class="qh">Sổ bệnh <small>8 bệnh, mỗi bệnh một luật riêng</small></h3>${FAMILIES.map(f => `<details class="ill-fam"><summary>${FAMILY_NAME[f]}</summary>${ILLNESSES.filter(i => i.family === f).map(i => {
    const med = MEDICINE_BY_ID[i.medicine];
    return `<div class="ill"><b>${esc(i.name)}</b><p><em>Mắc khi:</em> ${esc(i.cause)}.</p><p><em>Ảnh hưởng:</em> ${esc(effectLines(i).join('; '))}.</p>
      <p><em>Khỏi bằng:</em> ${esc(med.name)}, phòng khám, hoặc ${esc(healLine(i).replace(/^./, c => c.toLowerCase()))}.</p></div>`;
  }).join('')}</details>`).join('')}
  <p class="hs-note">Bệnh do bỏ bê chỉ tính lúc bạn đang mở game: chỉ số gần 0 liền 30 phút mà chưa chăm. Đóng game thì đồng hồ không chạy. Bệnh để 24 giờ không hồi phục sẽ thành nặng, chỉ phòng khám chữa được.</p>`;
}

/** HTML thân sổ sức khoẻ. `hs` là healthNow() của store. */
export function clinicBody(S, hs, now, coinSvg) {
  return `<div class="hs-body">${statusCard(S, hs, now, coinSvg)}${cabinet(S, coinSvg)}${book()}</div>`;
}

export { BLOCK_LABEL };

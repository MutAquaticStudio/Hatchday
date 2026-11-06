/**
 * Giá sau giảm giá của sự kiện đang chạy (shop_discount). Server tính giá thật khi mua (private.discounted); đây chỉ để hiện đúng số xu.
 * events-ui.js nạp danh sách sự kiện rồi gọi setPricingEvents.
 */
import { discountedPrice, discountPct, isEpidemic, type ActiveEvent, type DiscountScope } from './events';

let list: ActiveEvent[] = [];
export const setPricingEvents = (l: ActiveEvent[]): void => { list = l; };
/** Giá phải trả cho một món (đã giảm nếu có sự kiện). */
export const priceOf = (kind: DiscountScope, base: number): number => discountedPrice(base, discountPct(list, kind));
/** Đang có Mùa cúm không? */
export const epidemicNow = (): boolean => isEpidemic(list);
/** Phần trăm giảm đang áp cho loại hàng (0 = không giảm). */
export const salePct = (kind: DiscountScope): number => discountPct(list, kind);

import { supabase, isConfigured } from '../lib/supabase';
import * as demo from './demo-api';
import * as demoSocial from './demo-social';
import type { MailRow, NewsRow, PublicProfile, SocialState, SocialSummary, VisitData } from '../game/social';
import type { ActionResult, CureResult, DayLogRow, Economy, FarmItem, Garden, MemoryRow, Outfit, PetAction, PetRow, QuestBoard, SeenRow, Tastes } from './types';
import type { Layout } from '../game/catalog';

/** Chưa cấu hình Supabase thì chạy chế độ Chơi thử (dữ liệu trong trình duyệt). */
export const isDemo = !isConfigured;

const unwrap = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export async function setTimezone(): Promise<void> {
  if (isDemo) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  await supabase.from('profiles').update({ timezone: tz }).eq('id', data.user.id);
}

export async function getMyPet(): Promise<PetRow | null> {
  if (isDemo) return demo.getMyPet();
  const row = unwrap(await supabase.rpc('get_my_pet')) as PetRow | null;
  return row && row.id ? row : null;
}

export const createPet = async (name: string, family: string, egg: number) =>
  isDemo ? demo.createPet(name, family, egg) : unwrap(await supabase.rpc('create_pet', { p_name: name, p_family: family, p_egg: egg })) as PetRow;

/** Đón quả trứng đời sau của bé đã đi (giữ dòng họ, đời + 1, thừa hưởng cá tính và gen). */
export const hatchHeir = async (name: string, egg: number) =>
  isDemo ? demo.hatchHeir(name, egg) : unwrap(await supabase.rpc('hatch_heir', { p_name: name, p_egg: egg })) as PetRow;

/** Cả gia phả: mọi bé của người chơi từ đời 1 tới nay, cũ trước. */
export const listFamily = async (): Promise<PetRow[]> =>
  isDemo ? demo.listFamily() : unwrap(await supabase.from('pets').select('id, parent_id, name, family_name, generation, stage, species, form, genes, personality, born_at, departed_at, lived_days').order('generation')) as PetRow[];

export const renamePet = async (name: string) => { if (isDemo) return demo.renamePet(name); unwrap(await supabase.rpc('rename_pet', { p_name: name })); };

export const petAction = async (action: PetAction, item?: string, count = 1) =>
  isDemo ? demo.petAction(action, item, count) : unwrap(await supabase.rpc('pet_action', { p_action: action, p_item: item ?? null, p_count: count })) as ActionResult;

export const addTalkMemory = async (text: string) => { if (isDemo) return demo.addTalkMemory(text); unwrap(await supabase.rpc('add_talk_memory', { p_text: text })); };

export const listMemories = async (petId: string) =>
  isDemo ? demo.listMemories(petId) : unwrap(await supabase.from('memories').select('id, kind, body, created_at').eq('pet_id', petId).order('created_at', { ascending: false }).limit(60)) as MemoryRow[];

export const deleteMemory = async (id: number) => { if (isDemo) return demo.deleteMemory(id); unwrap(await supabase.from('memories').delete().eq('id', id)); };

export const listDayLogs = async (petId: string) =>
  isDemo ? demo.listDayLogs() : unwrap(await supabase.from('day_logs').select('day, fed, foods, fgroups, bath, ball, pet, talk, sleep').eq('pet_id', petId).order('day', { ascending: false }).limit(30)) as DayLogRow[];

/* ---------- Trang trí, trang phục, xu, nhiệm vụ ---------- */
const rpc = async <T>(fn: string, args?: Record<string, unknown>) => unwrap(await supabase.rpc(fn, args)) as T;

export const getEconomy = () => (isDemo ? demo.getEconomy() : rpc<Economy>('get_economy'));
export const buyItem = (id: string) => (isDemo ? demo.buyItem(id) : rpc<{ coins: number; qty: number }>('buy_item', { p_item: id }));

export async function listOwned(): Promise<Record<string, number>> {
  if (isDemo) return demo.listOwned();
  const rows = unwrap(await supabase.from('entitlements').select('item_id, qty')) as { item_id: string; qty: number }[];
  return Object.fromEntries(rows.map(r => [r.item_id, r.qty]));
}

export async function getLayouts(): Promise<{ layouts: (Layout | null)[]; active: number }> {
  if (isDemo) return demo.getLayouts();
  const rows = unwrap(await supabase.from('room_layouts').select('slot, layout')) as { slot: number; layout: Layout }[];
  const prof = unwrap(await supabase.from('profiles').select('active_layout').maybeSingle()) as { active_layout: number } | null;
  const layouts: (Layout | null)[] = [null, null, null];
  rows.forEach(r => { layouts[r.slot] = r.layout; });
  return { layouts, active: prof?.active_layout ?? 0 };
}
export const saveLayout = (slot: number, layout: Layout, activate = true) =>
  isDemo ? demo.saveLayout(slot, layout, activate) : rpc<{ comfort_level: number }>('save_room_layout', { p_slot: slot, p_layout: layout, p_activate: activate });

export const equipOutfit = (o: Outfit) => (isDemo ? demo.equipOutfit(o) : rpc<Outfit>('equip_outfit', { p_outfit: o }));
export const saveOutfitPreset = async (i: number, o: Outfit) => { if (isDemo) return demo.saveOutfitPreset(i, o); await rpc('save_outfit_preset', { p_idx: i, p_outfit: o }); };

export const getQuests = () => (isDemo ? demo.getQuests() : rpc<QuestBoard>('get_quests'));
export const claimQuest = (i: number) => (isDemo ? demo.claimQuest(i) : rpc<{ coins: number; reward: number }>('claim_quest', { p_idx: i }));
export const claimQuestBonus = () => (isDemo ? demo.claimQuestBonus() : rpc<{ coins: number; reward: number }>('claim_quest_bonus'));
export const claimWeeklyQuest = (i: number) => (isDemo ? demo.claimWeeklyQuest(i) : rpc<{ coins: number; reward: number }>('claim_weekly_quest', { p_idx: i }));

/* ---------- Thức ăn ---------- */
export const buyFood = (id: string, qty: number) => (isDemo ? demo.buyFood(id, qty) : rpc<{ coins: number; qty: number }>('buy_food', { p_item: id, p_qty: qty }));
export const upgradeFridge = () => (isDemo ? demo.upgradeFridge() : rpc<{ coins: number; fridge_level: number }>('upgrade_fridge'));
export const getGarden = () => (isDemo ? demo.getGarden() : rpc<Garden>('get_garden'));
export const plantCrop = (plot: number, crop: string) => (isDemo ? demo.plantCrop(plot, crop) : rpc<{ coins: number }>('plant_crop', { p_plot: plot, p_crop: crop }));
export const upgradeParcel = (parcel: number) => (isDemo ? demo.upgradeParcel(parcel) : rpc<{ coins: number; parcel: number; level: number; size: number }>('upgrade_parcel', { p_parcel: parcel }));
export const buyParcel = () => (isDemo ? demo.buyParcel() : rpc<{ coins: number; parcel: number }>('buy_parcel'));
export const getFarm = async (): Promise<FarmItem[]> =>
  isDemo ? demo.getFarm() : ((unwrap(await supabase.from('farm_layouts').select('layout').maybeSingle()) as { layout: { items: FarmItem[] } } | null)?.layout.items ?? []);
export const saveFarm = (items: FarmItem[]) => (isDemo ? demo.saveFarm(items) : rpc<{ count: number }>('save_farm_layout', { p_layout: { items } }));
export const waterCrop = (plot: number) => (isDemo ? demo.waterCrop(plot) : rpc<{ waters: number; ready_at: string }>('water_crop', { p_plot: plot }));
export const harvestCrop = (plot: number) => (isDemo ? demo.harvestCrop(plot) : rpc<{ item: string; qty: number; got: number }>('harvest_crop', { p_plot: plot }));
export const cook = (recipe: string, qty = 1) => (isDemo ? demo.cook(recipe, qty) : rpc<{ dish: string; qty: number }>('cook', { p_recipe: recipe, p_qty: qty }));
export const getTastes = () => (isDemo ? demo.getTastes() : rpc<Tastes>('get_tastes'));
export const claimRation = () => (isDemo ? demo.claimRation() : rpc<{ item: string; qty: number }>('claim_ration'));
export const claimCollection = (t: string) => (isDemo ? demo.claimCollection(t) : rpc<{ coins: number }>('claim_collection', { p_theme: t }));
export async function listCollectionClaims(): Promise<string[]> {
  if (isDemo) return demo.listCollectionClaims();
  return (unwrap(await supabase.from('collection_claims').select('theme')) as { theme: string }[]).map(r => r.theme);
}

/* ---------- Loài & lớn lên ---------- */
export const listSpeciesSeen = async () =>
  isDemo ? demo.listSpeciesSeen() : unwrap(await supabase.from('species_seen').select('species_id, first_at, forms').order('first_at')) as SeenRow[];
/** Chỉ chế độ Chơi thử: lùi ngày sinh để xem thú lớn lên. Bản thật không có (tuổi do server tính). */
export const demoAge = async (days: number) => (isDemo ? demo.demoAge(days) : null);

/* ---------- Sức khoẻ ---------- */
/** Áp giảm chỉ số, xét bệnh bỏ bê và hồi phục. Gọi lúc mở game và mỗi phút. */
export const getHealth = async (): Promise<PetRow | null> => {
  if (isDemo) return demo.getHealth();
  const row = unwrap(await supabase.rpc('get_health')) as PetRow | null;
  return row && row.id ? row : null;
};
export const buyMedicine = (id: string, qty: number) => (isDemo ? demo.buyMedicine(id, qty) : rpc<{ coins: number; qty: number }>('buy_medicine', { p_item: id, p_qty: qty }));
export const useMedicine = (id: string) => (isDemo ? demo.useMedicine(id) : rpc<CureResult>('use_medicine', { p_item: id }));
export const visitClinic = () => (isDemo ? demo.visitClinic() : rpc<CureResult>('visit_clinic'));

/* ---------- Gắn bó ---------- */
export const getBondClaims = async (): Promise<number[]> =>
  isDemo ? demo.getBondClaims() : (unwrap(await supabase.from('bond_claims').select('level')) as { level: number }[]).map(r => r.level);
export const claimBond = (level: number) => (isDemo ? demo.claimBond(level) : rpc<{ coins: number; reward: number }>('claim_bond_reward', { p_level: level }));

/* ---------- Chợ: thu mua nông sản ---------- */
export const getSellState = () => (isDemo ? demo.getSellState() : rpc<{ today: number; cap: number }>('get_sell_state'));
export const sellFood = (id: string, qty: number) => (isDemo ? demo.sellFood(id, qty) : rpc<{ coins: number; qty: number; got: number; today: number; cap: number }>('sell_food', { p_item: id, p_qty: qty }));

/* ---------- Xã hội: bạn bè, hộp thư, quà, tin tức, thăm nhà ---------- */
export const getSocialState = () => (isDemo ? demoSocial.getSocialState() : rpc<SocialState>('get_social_state'));
export const getSocialSummary = () => (isDemo ? demoSocial.getSocialSummary() : rpc<SocialSummary>('get_social_summary'));
export const setPrivacy = (key: string, value: string) => (isDemo ? demoSocial.setPrivacy(key, value) : rpc<{ friends: string; online: string }>('set_privacy', { p_key: key, p_value: value }));
export const findByCode = (who: string) => (isDemo ? demoSocial.findByCode(who) : rpc<PublicProfile>('find_by_code', { p_who: who }));
export const sendFriendRequest = (who: string) => (isDemo ? demoSocial.sendFriendRequest(who) : rpc<{ status: 'pending' | 'accepted' }>('send_friend_request', { p_who: who }));
export const respondFriendRequest = (who: string, accept: boolean) => (isDemo ? demoSocial.respondFriendRequest(who, accept) : rpc<{ status: string }>('respond_friend_request', { p_who: who, p_accept: accept }));
export const removeFriend = async (who: string) => { if (isDemo) return demoSocial.removeFriend(who); await rpc('remove_friend', { p_who: who }); };
export const blockUser = async (who: string) => { if (isDemo) return demoSocial.blockUser(who); await rpc('block_user', { p_who: who }); };
export const unblockUser = async (who: string) => { if (isDemo) return demoSocial.unblockUser(who); await rpc('unblock_user', { p_who: who }); };
export const listFriends = () => (isDemo ? demoSocial.listFriends() : rpc<PublicProfile[]>('list_friends'));
export const listRequests = () => (isDemo ? demoSocial.listRequests() : rpc<{ incoming: PublicProfile[]; outgoing: PublicProfile[] }>('list_requests'));
export const getInbox = () => (isDemo ? demoSocial.getInbox() : rpc<{ mail: MailRow[] }>('get_inbox'));
export const claimMail = (id: number) => (isDemo ? demoSocial.claimMail(id) : rpc<{ items: { id: string; qty: number }[]; coins: number; wallet: number }>('claim_mail', { p_id: id }));
export const claimAllMail = () => (isDemo ? demoSocial.claimAllMail() : rpc<{ claimed: number; skipped: number; wallet: number }>('claim_all_mail'));
export const deleteMail = async (id: number) => { if (isDemo) return demoSocial.deleteMail(id); await rpc('delete_mail', { p_id: id }); };
export const sendGift = (who: string, items: { id: string; qty: number }[], note: string | null) => (isDemo ? demoSocial.sendGift(who, items, note) : rpc<{ id: number }>('send_gift', { p_who: who, p_items: items, p_note: note }));
export const getNews = () => (isDemo ? demoSocial.getNews() : rpc<NewsRow[]>('get_news'));
export const markNewsRead = async (id: number) => { if (isDemo) return demoSocial.markNewsRead(id); await rpc('mark_news_read', { p_id: id }); };
export const getVisit = (who: string) => (isDemo ? demoSocial.getVisit(who) : rpc<VisitData>('get_visit', { p_who: who }));
export const strokeFriend = (who: string) => (isDemo ? demoSocial.strokeFriend(who) : rpc<{ got: number }>('stroke_friend_pet', { p_who: who }));
export const waterFriendCrop = (who: string, plot: number) => (isDemo ? demoSocial.waterFriendCrop(who, plot) : rpc<{ waters: number; got: number }>('water_friend_crop', { p_who: who, p_plot: plot }));
export const leaveGuestbook = async (who: string, emote: string) => { if (isDemo) return demoSocial.leaveGuestbook(who, emote); await rpc('leave_guestbook', { p_who: who, p_emote: emote }); };
export const getGuestbook = () => (isDemo ? demoSocial.getGuestbook() : rpc<{ from: string; kind: string; emote: string | null; at: string }[]>('get_guestbook'));

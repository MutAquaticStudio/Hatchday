import { supabase, isConfigured } from '../lib/supabase';
import * as demo from './demo-api';
import type { ActionResult, DayLogRow, Economy, MemoryRow, Outfit, PetAction, PetRow, QuestBoard, SeenRow } from './types';
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

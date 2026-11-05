import { supabase, isConfigured } from '../lib/supabase';
import * as demo from './demo-api';
import type { ActionResult, DayLogRow, Economy, MemoryRow, Outfit, PetAction, PetRow, QuestRow } from './types';
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

export const renamePet = async (name: string) => { if (isDemo) return demo.renamePet(name); unwrap(await supabase.rpc('rename_pet', { p_name: name })); };

export const petAction = async (action: PetAction, item?: string, count = 1) =>
  isDemo ? demo.petAction(action, item, count) : unwrap(await supabase.rpc('pet_action', { p_action: action, p_item: item ?? null, p_count: count })) as ActionResult;

export const addTalkMemory = async (text: string) => { if (isDemo) return demo.addTalkMemory(text); unwrap(await supabase.rpc('add_talk_memory', { p_text: text })); };

export const listMemories = async (petId: string) =>
  isDemo ? demo.listMemories() : unwrap(await supabase.from('memories').select('id, kind, body, created_at').eq('pet_id', petId).order('created_at', { ascending: false }).limit(60)) as MemoryRow[];

export const deleteMemory = async (id: number) => { if (isDemo) return demo.deleteMemory(id); unwrap(await supabase.from('memories').delete().eq('id', id)); };

export const listDayLogs = async (petId: string) =>
  isDemo ? demo.listDayLogs() : unwrap(await supabase.from('day_logs').select('day, fed, foods, bath, ball, pet, talk, sleep').eq('pet_id', petId).order('day', { ascending: false }).limit(30)) as DayLogRow[];

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

export const getQuests = () => (isDemo ? demo.getQuests() : rpc<QuestRow[]>('get_quests'));
export const claimQuest = (i: number) => (isDemo ? demo.claimQuest(i) : rpc<{ coins: number }>('claim_quest', { p_idx: i }));
export const claimCollection = (t: string) => (isDemo ? demo.claimCollection(t) : rpc<{ coins: number }>('claim_collection', { p_theme: t }));
export async function listCollectionClaims(): Promise<string[]> {
  if (isDemo) return demo.listCollectionClaims();
  return (unwrap(await supabase.from('collection_claims').select('theme')) as { theme: string }[]).map(r => r.theme);
}

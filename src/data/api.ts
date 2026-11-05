import { supabase, isConfigured } from '../lib/supabase';
import * as demo from './demo-api';
import type { ActionResult, DayLogRow, MemoryRow, PetAction, PetRow } from './types';

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

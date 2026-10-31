export interface PetRow {
  id: string;
  owner_id: string;
  name: string;
  family_name: string;
  generation: number;
  stage: 'egg' | 'baby' | 'teen' | 'adult' | 'departed';
  genes: { palette: number; ear: number; sprout: number; scale: number };
  personality: Record<string, number>;
  no: number; vui: number; nl: number; sach: number;
  asleep: boolean;
  stats_at: string;
  bond_xp: number;
  born_at: string;
}

export interface MemoryRow { id: number; kind: string; body: string; created_at: string }

export interface DayLogRow { day: string; fed: number; foods: string[]; bath: number; ball: number; pet: number; talk: number; sleep: number }

export type PetAction = 'feed' | 'pet' | 'bath_scrub' | 'bath_rinse' | 'play_ball' | 'play_spin' | 'talk' | 'sleep' | 'wake';

export interface ActionResult { pet: PetRow; refused: null | 'asleep' | 'full' | 'tired'; fav: boolean; new_memory: boolean }

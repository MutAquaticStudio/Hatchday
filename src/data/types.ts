export interface PetRow {
  id: string;
  owner_id: string;
  name: string;
  family_name: string;
  generation: number;
  stage: 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'elder' | 'departed';
  species: string;
  form: 'tron' | 'nhanh' | 'thuong' | 'sang' | null;
  genes: { palette?: number; region?: number; ear: number; sprout?: number; scale: number; hue?: number; likes?: string[]; dislike?: string };
  personality: Record<string, number>;
  no: number; vui: number; nl: number; sach: number;
  asleep: boolean;
  stats_at: string;
  bond_xp: number;
  born_at: string;
  outfit?: Outfit;
  outfit_presets?: Outfit[];
  comfort_level?: number;
}

export type Outfit = Partial<Record<'head' | 'face' | 'neck' | 'back', string>>;
export interface Economy { coins: number; earned_today: number; day: string; rotation: string[]; weekend: boolean }
export interface QuestRow { idx: number; quest: number; progress: number; target: number; claimed: boolean }

export interface MemoryRow { id: number; kind: string; body: string; created_at: string }

export interface DayLogRow { day: string; fed: number; foods: string[]; bath: number; ball: number; pet: number; talk: number; sleep: number }

export type PetAction = 'feed' | 'pet' | 'bath_scrub' | 'bath_rinse' | 'play_ball' | 'play_spin' | 'talk' | 'sleep' | 'wake';

export interface ActionResult { pet: PetRow; refused: null | 'asleep' | 'full' | 'tired'; fav: boolean; new_memory: boolean; earned?: number; coins?: number }

export interface SeenRow { species_id: string; first_at: string; forms: string[] }

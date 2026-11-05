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
  /** Gia phả: bé đời trước, ngày chia tay và số ngày đã sống (chỉ có khi stage = 'departed'). */
  parent_id?: string | null; departed_at?: string | null; lived_days?: number | null;
  outfit?: Outfit;
  outfit_presets?: Outfit[];
  comfort_level?: number;
}

export type Outfit = Partial<Record<'head' | 'face' | 'neck' | 'back', string>>;
export interface Economy { coins: number; earned_today: number; day: string; rotation: string[]; weekend: boolean; ration_claimed: boolean; fridge_level: number; spoiled: Record<string, number> }
export interface QuestRow { idx: number; quest: number; progress: number; target: number; reward: number; claimed: boolean }
/** Bảng nhiệm vụ: 5 nhiệm vụ ngày, thưởng làm hết cả ngày, 3 nhiệm vụ tuần. */
export interface QuestBoard { day: string; quests: QuestRow[]; week: string; weekly: QuestRow[]; bonus: { reward: number; ready: boolean; claimed: boolean } }

export interface MemoryRow { id: number; kind: string; body: string; created_at: string }

export interface DayLogRow { day: string; fed: number; foods: string[]; fgroups: string[]; bath: number; ball: number; pet: number; talk: number; sleep: number }

export type PetAction = 'feed' | 'pet' | 'bath_scrub' | 'bath_rinse' | 'play_ball' | 'play_spin' | 'talk' | 'sleep' | 'wake';

export interface ActionResult { pet: PetRow; refused: null | 'asleep' | 'full' | 'tired'; fav: boolean; new_memory: boolean; earned?: number; coins?: number; stock?: number | null; balanced?: boolean; dislike?: boolean }

export interface GardenPlot { plot: number; crop: string; planted_at: string; ready_at: string; ready: boolean; waters: number; watered_at: string | null; can_water: boolean }
/** `now` là giờ server, để tính giờ còn lại mà không tin đồng hồ máy. */
/** Một món đồ trang trí nông trại đã đặt: toạ độ trên sân (x, z) và hướng xoay 0–3. */
export interface FarmItem { id: string; x: number; z: number; rot: number }
export interface Parcel { parcel: number; level: number; size: number }
export interface Garden { now: string; parcels: Parcel[]; plots: GardenPlot[] }
/** Khẩu vị bé đã lộ ra: món tủ / món ghét chỉ biết sau khi bé được ăn thử món đó. */
export interface Tastes { fav: string | null; dis: string | null; tried: number; total: number }

export interface SeenRow { species_id: string; first_at: string; forms: string[] }

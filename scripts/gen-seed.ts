// Sinh câu lệnh seed SQL từ src/game/catalog.ts. Chạy: node --experimental-strip-types scripts/gen-seed.ts
import { ITEMS, DEFAULT_LAYOUT } from '../src/game/catalog.ts';
const q = (v: unknown) => v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a?: string[]) => `'{${(a || []).join(',')}}'`;
const rows = ITEMS.map(i => `  (${q(i.id)}, ${q(i.kind)}, ${q(i.name)}, ${q(i.layer)}, ${q(i.slot)}, ${q(i.w ?? null)}, ${q(i.d ?? null)}, ${q(i.comfort ?? 0)}, ${q(i.theme ?? null)}, ${arr(i.tags)}, ${q(i.price)}, ${q(i.source)}, ${q(i.rarity)})`);
console.log(`insert into public.items (id, kind, name, layer, slot, w, d, comfort, theme, tags, price_coins, source, rarity) values\n${rows.join(',\n')};`);
console.log(`-- DEFAULT_LAYOUT\n${JSON.stringify(DEFAULT_LAYOUT)}`);
// Loài thú (src/game/species.ts) — dán vào migration 20261112000000_species_growth.sql
import { SPECIES, RARITIES } from '../src/game/species.ts';
console.log(`-- SPECIES\ninsert into public.species (id, name, region, rarity, weight) values\n${SPECIES.map(s => `  (${q(s.id)}, ${q(s.name)}, ${s.region}, ${q(s.rarity)}, ${RARITIES[s.rarity].weight})`).join(',\n')};`);

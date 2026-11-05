// Sinh câu lệnh seed SQL từ src/game/catalog.ts. Chạy: node --experimental-strip-types scripts/gen-seed.ts
import { ITEMS, DEFAULT_LAYOUT, FOODS, DISHES, RECIPES, CROPS } from '../src/game/catalog.ts';
const q = (v: unknown) => v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const arr = (a?: string[]) => `'{${(a || []).join(',')}}'`;
const rows = ITEMS.map(i => `  (${q(i.id)}, ${q(i.kind)}, ${q(i.name)}, ${q(i.layer)}, ${q(i.slot)}, ${q(i.w ?? null)}, ${q(i.d ?? null)}, ${q(i.comfort ?? 0)}, ${q(i.theme ?? null)}, ${arr(i.tags)}, ${q(i.price)}, ${q(i.source)}, ${q(i.rarity)})`);
console.log(`insert into public.items (id, kind, name, layer, slot, w, d, comfort, theme, tags, price_coins, source, rarity) values\n${rows.join(',\n')};`);
console.log(`-- DEFAULT_LAYOUT\n${JSON.stringify(DEFAULT_LAYOUT)}`);
// Loài thú (src/game/species.ts) — dán vào migration 20261112000000_species_growth.sql
import { SPECIES, RARITIES } from '../src/game/species.ts';
console.log(`-- SPECIES\ninsert into public.species (id, name, region, rarity, weight) values\n${SPECIES.map(s => `  (${q(s.id)}, ${q(s.name)}, ${s.region}, ${q(s.rarity)}, ${RARITIES[s.rarity].weight})`).join(',\n')};`);

// Thức ăn, món nấu, công thức, cây trồng (src/game/catalog.ts) — dán vào migration 20261114000000_food_economy.sql (thức ăn)
// và 20261116000000_food_advanced.sql (món nấu, công thức, cây trồng, và cờ fresh của thức ăn)
const eff = (f: (typeof FOODS)[number] | (typeof DISHES)[number]) => JSON.stringify({ no: f.no, vui: f.vui, group: f.group, ...(f.group2 ? { group2: f.group2 } : {}), fresh: f.fresh });
console.log(`-- FOODS\ninsert into public.items (id, kind, name, effects, price_coins, source, rarity) values\n${FOODS.map(f => `  (${q(f.id)}, 'food', ${q(f.name)}, '${eff(f)}', ${f.price}, 'market', 'thuong')`).join(',\n')}\non conflict (id) do update set name = excluded.name, effects = excluded.effects, price_coins = excluded.price_coins, source = excluded.source, rarity = excluded.rarity;`);
console.log(`-- DISHES\ninsert into public.items (id, kind, name, effects, price_coins, source, rarity) values\n${DISHES.map(f => `  (${q(f.id)}, 'dish', ${q(f.name)}, '${eff(f)}', null, 'cook', 'thuong')`).join(',\n')}\non conflict (id) do update set name = excluded.name, effects = excluded.effects;`);
console.log(`-- RECIPES\ninsert into public.recipes (id, dish, a, b) values\n${RECIPES.map(r => `  (${q(r.id)}, ${q(r.dish)}, ${q(r.a)}, ${q(r.b)})`).join(',\n')}\non conflict (id) do update set dish = excluded.dish, a = excluded.a, b = excluded.b;`);
console.log(`-- CROPS\ninsert into public.crops (id, hours, seed, yield) values\n${CROPS.map(c => `  (${q(c.id)}, ${c.hours}, ${c.seed}, ${c.yield})`).join(',\n')};`);

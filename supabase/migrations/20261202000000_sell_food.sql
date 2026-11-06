-- =====================================================================
-- Hatchday — Thu mua nông sản ở Chợ: bán thức ăn thừa lấy xu (P3)
-- Giá thu mua = 40% giá mua (làm tròn xuống), tối đa 80 xu mỗi ngày (theo ngày của người chơi), mỗi lần bán 1–30 phần.
-- Luật ở hai nơi: catalog.ts (SELL, sellPrice) và migration này. Test: supabase/tests/market.test.ts.
-- Không viết lại hàm nào.
-- =====================================================================

create table public.sell_log (
  owner_id uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  coins    int  not null default 0,
  primary key (owner_id, day)
);
alter table public.sell_log enable row level security;
create policy "sell_log: đọc của mình" on public.sell_log for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function private.sell_price(price int) returns int
language sql immutable set search_path = '' as $$ select floor(price * 0.4)::int $$;

create or replace function public.get_sell_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  d := private.local_day(uid);
  return jsonb_build_object('today', coalesce((select coins from public.sell_log where owner_id = uid and day = d), 0), 'cap', 80);
end $$;

create or replace function public.sell_food(p_item text, p_qty int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); it public.items; d date; today int; unit int; total int; q int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into it from public.items where id = p_item and active and kind = 'food';
  if it.id is null then raise exception 'unknown_item'; end if;
  if p_qty is null or p_qty not between 1 and 30 then raise exception 'invalid_qty'; end if;
  if not private.owns(uid, it.id, p_qty) then raise exception 'not_owned'; end if;
  d := private.local_day(uid);
  today := coalesce((select coins from public.sell_log where owner_id = uid and day = d), 0);
  unit := private.sell_price(it.price_coins); total := unit * p_qty;
  if total <= 0 then raise exception 'not_for_sale'; end if;
  if today + total > 80 then raise exception 'sell_cap'; end if;
  update public.entitlements set qty = qty - p_qty where owner_id = uid and item_id = it.id returning qty into q;
  perform private.earn(uid, total, false);
  insert into public.sell_log (owner_id, day, coins) values (uid, d, total)
  on conflict (owner_id, day) do update set coins = public.sell_log.coins + total;
  return jsonb_build_object('coins', (select coins from public.wallets where owner_id = uid), 'qty', q, 'got', total, 'today', today + total, 'cap', 80);
end $$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.get_sell_state(), public.sell_food(text, int) from public, anon;
grant execute on function public.get_sell_state(), public.sell_food(text, int) to authenticated;

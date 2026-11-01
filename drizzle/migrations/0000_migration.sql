-- Profiles (public nickname + net worth for rating)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Игрок',
  net_worth bigint not null default 0,
  level int not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles readable by everyone" on public.profiles for select using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Игрок'))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Game saves (one per user)
create table public.game_saves (
  user_id uuid primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.game_saves to authenticated;
grant all on public.game_saves to service_role;
alter table public.game_saves enable row level security;
create policy "Own save select" on public.game_saves for select to authenticated using (auth.uid() = user_id);
create policy "Own save insert" on public.game_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "Own save update" on public.game_saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Global chat
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nickname text not null,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
grant select on public.chat_messages to authenticated;
grant insert on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "Chat readable by signed-in" on public.chat_messages for select to authenticated using (true);
create policy "Chat insert own" on public.chat_messages for insert to authenticated with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.chat_messages;

-- Player-to-player car market
create table public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  seller_nickname text not null,
  car jsonb not null,
  price bigint not null check (price > 0),
  buyer_id uuid,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.market_listings to authenticated;
grant all on public.market_listings to service_role;
alter table public.market_listings enable row level security;
create policy "Listings readable" on public.market_listings for select to authenticated using (true);
create policy "Seller creates listing" on public.market_listings for insert to authenticated with check (auth.uid() = seller_id and status = 'active' and buyer_id is null);
create policy "Seller cancels own" on public.market_listings for update to authenticated using (auth.uid() = seller_id and status = 'active') with check (auth.uid() = seller_id);

-- Atomic buy of a listing by another player
create or replace function public.buy_listing(_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.market_listings;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.market_listings set status = 'sold', buyer_id = auth.uid()
    where id = _listing_id and status = 'active' and seller_id <> auth.uid()
    returning * into l;
  if l.id is null then raise exception 'listing unavailable'; end if;
  return jsonb_build_object('car', l.car, 'price', l.price);
end; $$;
revoke all on function public.buy_listing(uuid) from public, anon;
grant execute on function public.buy_listing(uuid) to authenticated;

-- Seller collects money for sold listings once
create or replace function public.collect_sales()
returns bigint language plpgsql security definer set search_path = public as $$
declare total bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  with c as (
    update public.market_listings set status = 'paid'
    where seller_id = auth.uid() and status = 'sold' returning price
  ) select coalesce(sum(price),0) into total from c;
  return total;
end; $$;
revoke all on function public.collect_sales() from public, anon;
grant execute on function public.collect_sales() to authenticated;

-- Shop: items delivered to players after payment (written only by server)
create table public.item_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null,
  source text not null default 'purchase',
  created_at timestamptz not null default now()
);
grant select on public.item_grants to authenticated;
grant all on public.item_grants to service_role;
alter table public.item_grants enable row level security;
create policy "Own grants readable" on public.item_grants for select to authenticated using (auth.uid() = user_id);
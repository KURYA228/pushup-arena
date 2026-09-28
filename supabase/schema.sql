-- Схема для аккаунтов и таблицы лидеров.
--
-- Вставить целиком в Supabase → SQL Editor → Run. Скрипт можно запускать повторно:
-- всё создаётся через "if not exists" и пересоздаваемые политики.
--
-- Данные разделены на две таблицы намеренно. `players` — то, что видят все: имя и цифры для
-- таблицы лидеров. `saves` — полная выгрузка прогресса для переноса между устройствами, её
-- владелец видит только свою. Держать их в одной таблице нельзя: политика, открывающая
-- таблицу лидеров всем, открыла бы заодно и сохранёнку.

-- ─────────────────────────────────────────────────────────────────────────────
-- Публичные профили
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 24),
  total_pushups integer not null default 0 check (total_pushups >= 0),
  total_xp integer not null default 0 check (total_xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak integer not null default 0 check (streak >= 0),
  bosses_defeated integer not null default 0 check (bosses_defeated >= 0),
  rush_best_reps integer not null default 0 check (rush_best_reps >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists players_display_name_key
  on public.players (lower(trim(display_name)));

create index if not exists players_total_pushups_idx
  on public.players (total_pushups desc);

alter table public.players enable row level security;

-- Читать таблицу лидеров может любой вошедший; писать — только в свою строку.
drop policy if exists "players are readable by authenticated users" on public.players;
create policy "players are readable by authenticated users"
  on public.players for select
  to authenticated
  using (true);

drop policy if exists "players insert own row" on public.players;
create policy "players insert own row"
  on public.players for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "players update own row" on public.players;
create policy "players update own row"
  on public.players for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Личные сохранения
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.saves (
  id uuid primary key references auth.users on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves are private" on public.saves;
create policy "saves are private"
  on public.saves for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Штамп времени обновляется сервером: клиент может прислать что угодно, а «когда
-- обновлялось» должно оставаться честным.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
  before insert or update on public.players
  for each row execute function public.touch_updated_at();

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before insert or update on public.saves
  for each row execute function public.touch_updated_at();

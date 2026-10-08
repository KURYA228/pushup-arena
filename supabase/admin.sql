-- Админ-доступ: правка чужого прогресса из админ-панели в игре.
--
-- Вставить целиком в Supabase → SQL Editor → Run, после schema.sql. Можно запускать повторно.
--
-- Защита держится здесь, в базе, а не в интерфейсе: спрятанная кнопка в игре ничего не значит,
-- если чужие сохранения можно прочитать запросом в обход. Поэтому правила ниже открывают
-- чужие `saves` и правку чужих `players` только тем, кто записан в `admins`, — и никому больше,
-- что бы ни прислал клиент.

-- ─────────────────────────────────────────────────────────────────────────────
-- Список админов
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Каждый может узнать только одно: админ ли он сам. Список целиком не виден никому из игры,
-- а добавить себя туда из игры нельзя — политик на запись нет вовсе.
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- Проверка вынесена в функцию с правами владельца: так её можно звать из политик других
-- таблиц, не открывая саму таблицу админов.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Что админу можно сверх обычного игрока
-- ─────────────────────────────────────────────────────────────────────────────
-- Политики складываются через ИЛИ с уже существующими: игроки по-прежнему видят и меняют
-- только своё, админ — ещё и чужое.

drop policy if exists "admins read all saves" on public.saves;
create policy "admins read all saves"
  on public.saves for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins update all saves" on public.saves;
create policy "admins update all saves"
  on public.saves for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins update all players" on public.players;
create policy "admins update all players"
  on public.players for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Сделать себя админом — один раз, подставив почту своего аккаунта в игре:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'твоя@почта.ru'
--   on conflict do nothing;
--
-- Убрать: delete from public.admins where user_id = (select id from auth.users where email = '…');
-- ─────────────────────────────────────────────────────────────────────────────

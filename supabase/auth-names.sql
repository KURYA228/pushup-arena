-- Ники из игры в Supabase → Authentication → Users, столбец «Display name».
--
-- Вставить целиком в Supabase → SQL Editor → Run. Можно запускать повторно.
--
-- Ник живёт в public.players, а список пользователей в Authentication показывает данные самого
-- аккаунта (auth.users → user_metadata). Для входа через Google панель берёт имя из Google
-- (full_name / name), и Google переписывает эти поля при каждом входе. Поэтому ник кладётся во
-- все три поля — display_name, full_name, name — и возвращается на место после каждого входа.
-- Игра эти поля не читает: они только для того, чтобы в панели было видно, чья почта чья.

-- Ник поверх имени аккаунта, если у человека он уже есть.
create or replace function public.with_nickname(meta jsonb, nick text)
returns jsonb
language sql
immutable
as $$
  select case
    when nick is null then coalesce(meta, '{}'::jsonb)
    else coalesce(meta, '{}'::jsonb)
         || jsonb_build_object('display_name', nick, 'full_name', nick, 'name', nick)
  end;
$$;

revoke all on function public.with_nickname(jsonb, text) from public, anon, authenticated;

-- 1. Игрок выбрал или сменил ник — записать в аккаунт.
create or replace function public.copy_name_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_user_meta_data = public.with_nickname(raw_user_meta_data, new.display_name)
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.copy_name_to_auth() from public, anon, authenticated;

drop trigger if exists players_name_to_auth on public.players;
create trigger players_name_to_auth
  after insert or update of display_name on public.players
  for each row execute function public.copy_name_to_auth();

-- 2. Вход через Google переписал имя на гугловское — вернуть ник.
create or replace function public.keep_nickname_in_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.raw_user_meta_data := public.with_nickname(
    new.raw_user_meta_data,
    (select display_name from public.players where id = new.id)
  );
  return new;
end;
$$;

revoke all on function public.keep_nickname_in_auth() from public, anon, authenticated;

drop trigger if exists auth_users_keep_nickname on auth.users;
create trigger auth_users_keep_nickname
  before update of raw_user_meta_data on auth.users
  for each row execute function public.keep_nickname_in_auth();

-- 3. Уже зарегистрированные.
update auth.users u
set raw_user_meta_data = public.with_nickname(u.raw_user_meta_data, p.display_name)
from public.players p
where p.id = u.id;

-- Проверка: почта → ник. Пустой ник — человек ещё не выбрал имя в игре.
select u.email, p.display_name as nickname, u.raw_user_meta_data ->> 'full_name' as shown_name
from auth.users u
left join public.players p on p.id = u.id
order by u.created_at desc;

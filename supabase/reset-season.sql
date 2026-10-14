-- Обнуление прогресса игроков.
--
-- ВАЖНО: одного этого файла недостаточно. Прогресс каждого игрока лежит у него на телефоне,
-- в браузере, а не здесь — облако только зеркало. Если стереть строки и ничего больше не
-- делать, то первый же запуск игры на телефоне зальёт всё обратно, а те, кто не заходил,
-- вообще ничего не заметят.
--
-- Полный порядок действий описан в README, раздел «Обнулить прогресс всех игроков».
-- Коротко: сначала поднять SEASON в src/lib/season.ts и выкатить (npm run deploy),
-- и только потом запускать этот файл.
--
-- Аккаунты, почты и пароли не трогаются: люди остаются зарегистрированными, у них просто
-- обнуляется прогресс. Имена в таблице лидеров тоже сохраняются.

-- ─────────────────────────────────────────────────────────────────────────────
-- Всем игрокам: обнулить цифры и выбросить сохранения
-- ─────────────────────────────────────────────────────────────────────────────
update public.players
set total_pushups = 0,
    total_xp = 0,
    level = 1,
    streak = 0,
    bosses_defeated = 0,
    rush_best_reps = 0;

-- Ранги, лига недели и 1 на 1 (ranks.sql, duels.sql) — отдельно, чтобы файл работал и на базе,
-- где эти скрипты ещё не запускали: там этих колонок просто нет.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'players' and column_name = 'best_set') then
    update public.players set best_set = 0, week_reps = 0, week_key = '';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'players' and column_name = 'duel_rating') then
    update public.players
    set duel_rating = 1000, duel_wins = 0, duel_losses = 0, duel_draws = 0, rush_run = null;
  end if;
end $$;

delete from public.saves;

-- ─────────────────────────────────────────────────────────────────────────────
-- Одному игроку — если нужно обнулить кого-то одного, а не всех.
-- Подставь имя и убери комментарии.
-- ─────────────────────────────────────────────────────────────────────────────
-- update public.players
-- set total_pushups = 0, total_xp = 0, level = 1, streak = 0,
--     bosses_defeated = 0, rush_best_reps = 0
-- where lower(trim(display_name)) = lower('ИМЯ ИГРОКА');
--
-- delete from public.saves
-- where id in (
--   select id from public.players where lower(trim(display_name)) = lower('ИМЯ ИГРОКА')
-- );

-- ─────────────────────────────────────────────────────────────────────────────
-- Удалить аккаунт целиком (почта освободится, человеку придётся регистрироваться
-- заново). Строки в players и saves уйдут сами — они висят на пользователе через
-- "on delete cascade".
-- ─────────────────────────────────────────────────────────────────────────────
-- delete from auth.users where email = 'кто-то@example.com';

-- Что осталось после запуска — проверка.
select display_name, total_pushups, total_xp, level, bosses_defeated
from public.players
order by display_name;

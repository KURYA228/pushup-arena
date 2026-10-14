-- 1 на 1: рейтинг дуэлей и запись лучшего Rush, с которой соревнуются другие.
--
-- Вставить целиком в Supabase → SQL Editor → Run, после schema.sql. Можно запускать повторно.
-- Пока не запущено, дуэль идёт против спарринг-партнёра без рейтинга, а в таблице нет вкладки
-- «1 на 1» с очками.

alter table public.players
  -- Рейтинг дуэлей (Эло), с которого начинают все.
  add column if not exists duel_rating integer not null default 1000 check (duel_rating between 0 and 5000),
  add column if not exists duel_wins integer not null default 0 check (duel_wins >= 0),
  add column if not exists duel_losses integer not null default 0 check (duel_losses >= 0),
  add column if not exists duel_draws integer not null default 0 check (duel_draws >= 0),
  -- Когда был сделан каждый повтор лучшего Rush, в мс от старта: по ней соперник видит «призрака».
  add column if not exists rush_run jsonb check (rush_run is null or (jsonb_typeof(rush_run) = 'array' and jsonb_array_length(rush_run) <= 400));

-- Подбор соперника ищет по рейтингу.
create index if not exists players_duel_rating_idx on public.players (duel_rating);

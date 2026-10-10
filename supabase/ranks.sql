-- Ранги: лига недели и ранг силы в таблице лидеров.
--
-- Вставить целиком в Supabase → SQL Editor → Run, после schema.sql. Можно запускать повторно.
-- Пока не запущено, игра работает как раньше — просто без этих чисел в общей таблице.

alter table public.players
  add column if not exists best_set integer not null default 0 check (best_set >= 0),
  add column if not exists week_reps integer not null default 0 check (week_reps >= 0),
  add column if not exists week_key text not null default '';

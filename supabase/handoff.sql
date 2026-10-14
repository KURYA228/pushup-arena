-- Вход через Google в игре, установленной на экран «Домой» iPhone.
--
-- Вставить целиком в Supabase → SQL Editor → Run. Можно запускать повторно.
--
-- Зачем: на iPhone установленная игра живёт отдельно от Safari — у неё своё хранилище. Google
-- открывается в окне Safari поверх игры, и туда же возвращается: вход оседал в Safari, а игра
-- так и оставалась на форме. Теперь окно Safari кладёт сюда одноразовый код входа под случайным
-- ключом, который знает только игра, а игра забирает его и сама обменивает на сессию.
--
-- Код из этой таблицы без второй половины бесполезен: обменять его можно только вместе с
-- секретом (PKCE code verifier), который не покидает установленную игру.

create table if not exists public.auth_handoff (
  nonce text primary key check (char_length(nonce) between 32 and 128),
  -- Код входа или «error:<текст>», если Google/Supabase отказали.
  payload text not null check (char_length(payload) <= 2000),
  flow_id text check (flow_id is null or char_length(flow_id) <= 64),
  created_at timestamptz not null default now()
);

-- Ни чтения, ни записи напрямую: только через две функции ниже.
alter table public.auth_handoff enable row level security;
revoke all on public.auth_handoff from anon, authenticated;

-- Окно Safari: «вот код для игры с ключом nonce».
create or replace function public.handoff_put(p_nonce text, p_payload text, p_flow_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.auth_handoff where created_at < now() - interval '10 minutes';
  insert into public.auth_handoff (nonce, payload, flow_id)
  values (p_nonce, p_payload, p_flow_id)
  on conflict (nonce) do update set payload = excluded.payload, flow_id = excluded.flow_id, created_at = now();
end;
$$;

-- Игра: «есть что-нибудь для меня?» Отдаёт один раз и сразу стирает.
create or replace function public.handoff_take(p_nonce text)
returns table (payload text, flow_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    delete from public.auth_handoff h
    where h.nonce = p_nonce and h.created_at > now() - interval '10 minutes'
    returning h.payload, h.flow_id;
end;
$$;

revoke all on function public.handoff_put(text, text, text) from public;
revoke all on function public.handoff_take(text) from public;
grant execute on function public.handoff_put(text, text, text) to anon, authenticated;
grant execute on function public.handoff_take(text) to anon, authenticated;

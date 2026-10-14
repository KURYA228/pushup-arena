-- Аватарки игроков: выбранная картинка из галереи или своё фото.
--
-- Вставить целиком в Supabase → SQL Editor → Run, после schema.sql. Можно запускать повторно.
-- Пока не запущено, игра работает как раньше — у всех буква вместо аватарки, а выбор аватарки
-- говорит, что этот скрипт нужно запустить.

-- В строке игрока — что у него на аватарке: «g:<файл>» для картинки из галереи (портрет босса
-- или подчинённого из public/bosses) или адрес загруженного фото. Пусто — буква имени.
alter table public.players
  add column if not exists avatar text check (avatar is null or char_length(avatar) <= 500);

-- Хранилище для своих фото. Публичное на чтение: аватарки видны всем в таблице лидеров.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 524288,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Каждый пишет только в свою папку: avatars/<id игрока>/…
drop policy if exists "avatars are readable by everyone" on storage.objects;
create policy "avatars are readable by everyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

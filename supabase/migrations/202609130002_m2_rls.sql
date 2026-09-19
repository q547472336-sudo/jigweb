-- M2 RLS：私有作品和资源必须只能由所有者读取。

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.puzzles enable row level security;
alter table public.puzzle_assets enable row level security;
alter table public.puzzle_curation enable row level security;
alter table public.favorites enable row level security;
alter table public.play_sessions enable row level security;
alter table public.completion_records enable row level security;
alter table public.recent_plays enable row level security;
alter table public.notifications enable row level security;
alter table public.feedback enable row level security;
alter table public.reports enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.email_change_requests enable row level security;

drop policy if exists profiles_owner_read on public.profiles;
create policy profiles_owner_read on public.profiles for select using (id = auth.uid());
drop policy if exists profiles_owner_write on public.profiles;
create policy profiles_owner_write on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (active = true);

drop policy if exists puzzles_public_or_owner_read on public.puzzles;
create policy puzzles_public_or_owner_read on public.puzzles for select using ((status = 'published' and visibility = 'public') or owner_id = auth.uid());
drop policy if exists puzzles_owner_insert on public.puzzles;
create policy puzzles_owner_insert on public.puzzles for insert with check (owner_id = auth.uid());
drop policy if exists puzzles_owner_update on public.puzzles;
create policy puzzles_owner_update on public.puzzles for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists assets_public_or_owner_read on public.puzzle_assets;
create policy assets_public_or_owner_read on public.puzzle_assets for select using (exists (select 1 from public.puzzles p where p.id = puzzle_id and ((p.status = 'published' and p.visibility = 'public') or p.owner_id = auth.uid())));
drop policy if exists assets_owner_write on public.puzzle_assets;
create policy assets_owner_write on public.puzzle_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists curation_public_read on public.puzzle_curation;
create policy curation_public_read on public.puzzle_curation for select using (active = true and exists (select 1 from public.puzzles p where p.id = puzzle_id and p.status = 'published' and p.visibility = 'public'));

drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sessions_owner_all on public.play_sessions;
create policy sessions_owner_all on public.play_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists completions_owner_read on public.completion_records;
create policy completions_owner_read on public.completion_records for select using (user_id = auth.uid());
drop policy if exists recents_owner_all on public.recent_plays;
create policy recents_owner_all on public.recent_plays for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_owner_all on public.notifications;
create policy notifications_owner_all on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists feedback_owner_read_insert on public.feedback;
create policy feedback_owner_read_insert on public.feedback for select using (user_id = auth.uid());
create policy feedback_owner_insert on public.feedback for insert with check (user_id = auth.uid());
drop policy if exists reports_owner_read_insert on public.reports;
create policy reports_owner_read_insert on public.reports for select using (reporter_id = auth.uid());
create policy reports_owner_insert on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists idempotency_owner_all on public.idempotency_keys;
create policy idempotency_owner_all on public.idempotency_keys for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists email_change_owner_all on public.email_change_requests;
create policy email_change_owner_all on public.email_change_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- OTP 只由服务端 service role 访问，客户端绝不能直接读写。
-- 没有为 otp_challenges 创建 anon/authenticated policy。

drop policy if exists puzzle_assets_private_storage_read on storage.objects;
create policy puzzle_assets_private_storage_read on storage.objects for select to authenticated
using (bucket_id = 'puzzle-assets' and exists (
  select 1 from public.puzzle_assets a
  join public.puzzles p on p.id = a.puzzle_id
  where a.storage_path = name and (p.visibility = 'public' and p.status = 'published' or p.owner_id = auth.uid())
));
drop policy if exists puzzle_assets_owner_storage_insert on storage.objects;
create policy puzzle_assets_owner_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'puzzle-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists puzzle_assets_owner_storage_update on storage.objects;
create policy puzzle_assets_owner_storage_update on storage.objects for update to authenticated
using (bucket_id = 'puzzle-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'puzzle-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists puzzle_assets_owner_storage_delete on storage.objects;
create policy puzzle_assets_owner_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'puzzle-assets' and (storage.foldername(name))[1] = auth.uid()::text);

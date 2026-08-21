-- ==========================================================
-- Supabase 초기 설정 SQL
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ==========================================================

-- 1) 신고 테이블
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  location text not null,
  occurred_at timestamptz not null,
  description text not null,
  photo_url text not null,
  contact text,
  consent boolean not null default false,
  assignee text,
  status text not null default '접수',
  completed_at date,
  done_photo_url text,
  created_at timestamptz not null default now()
);

-- 2) 안전 건의 테이블
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author text,
  created_at timestamptz not null default now()
);

-- 3) 접근 정책 (사내 간이 시스템용: 익명 읽기/쓰기 허용)
alter table reports enable row level security;
alter table suggestions enable row level security;

create policy "reports_select" on reports for select using (true);
create policy "reports_insert" on reports for insert with check (true);
create policy "reports_update" on reports for update using (true);

create policy "suggestions_select" on suggestions for select using (true);
create policy "suggestions_insert" on suggestions for insert with check (true);

-- 4) 사진 저장용 Storage 버킷 (공개 읽기)
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

create policy "photos_insert" on storage.objects
  for insert with check (bucket_id = 'report-photos');
create policy "photos_select" on storage.objects
  for select using (bucket_id = 'report-photos');

-- 5) 3단계 계정 체계 (supabase-accounts.sql 과 동일)
create table if not exists app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;
create policy "settings_select" on app_settings for select using (true);
create policy "settings_insert" on app_settings for insert with check (true);
create policy "settings_update" on app_settings for update using (true);
insert into app_settings (key, value) values
  ('pw_manager', '2026'),
  ('pw_staff', '1111')
on conflict (key) do nothing;
create policy "reports_delete" on reports for delete using (true);
create policy "suggestions_delete" on suggestions for delete using (true);
create policy "photos_delete" on storage.objects
  for delete using (bucket_id = 'report-photos');

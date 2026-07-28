-- ==========================================================
-- 3단계 계정 체계 추가 SQL (기존 운영 프로젝트용)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ==========================================================

-- 1) 계정 비밀번호 저장 테이블 (시설팀장/담당자 공용)
create table if not exists app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;
create policy "settings_select" on app_settings for select using (true);
create policy "settings_insert" on app_settings for insert with check (true);
create policy "settings_update" on app_settings for update using (true);

-- 초기 비밀번호: 시설팀장 2026 / 담당자(공용) 1111
insert into app_settings (key, value) values
  ('pw_manager', '2026'),
  ('pw_staff', '1111')
on conflict (key) do nothing;

-- 2) 마스터 계정의 게시물 삭제 기능용 정책
create policy "reports_delete" on reports for delete using (true);
create policy "suggestions_delete" on suggestions for delete using (true);
create policy "photos_delete" on storage.objects
  for delete using (bucket_id = 'report-photos');

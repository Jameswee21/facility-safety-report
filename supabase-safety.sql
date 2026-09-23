-- ==========================================================
-- 안전보건 신고(위험요소 · 아차사고) 테이블 추가 SQL
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- ==========================================================

create table if not exists safety_reports (
  id uuid primary key default gen_random_uuid(),
  type text not null,               -- 사고 형태 (미끄러짐·넘어짐 등)
  witness text not null,            -- 직접 겪음 / 목격함
  location text not null,           -- 발생 장소
  occurred_at timestamptz not null, -- 발생일시
  description text not null,        -- 상황 설명
  photo_url text,                   -- 사진 (선택)
  risk text,                        -- 이대로 두면? (선택)
  suggestion text,                  -- 개선 의견 (선택)
  contact text,                     -- 연락처 (선택)
  consent boolean not null default false,
  assignee text,                    -- 담당자
  status text not null default '접수',
  completed_at date,                -- 조치일
  done_photo_url text,              -- 조치완료 사진
  created_at timestamptz not null default now()
);

-- 접근 정책 (사내 간이 시스템용: 익명 읽기/쓰기 허용)
alter table safety_reports enable row level security;

create policy "safety_select" on safety_reports for select using (true);
create policy "safety_insert" on safety_reports for insert with check (true);
create policy "safety_update" on safety_reports for update using (true);
create policy "safety_delete" on safety_reports for delete using (true);

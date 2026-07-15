-- Supabase SQL Editor에서 이 스크립트를 한 번 실행하세요.
-- 로그인한(Google) 강사라면 누구나 같은 학생/리포트 데이터를 보고 쓸 수 있도록 구성되어 있습니다.

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class text,
  phone text,
  parent_phone text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  attendance text not null,
  homework text,
  attitude text,
  understanding int,
  progress text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists reports_student_id_idx on reports(student_id);
create index if not exists reports_date_idx on reports(date);

alter table students enable row level security;
alter table reports enable row level security;

drop policy if exists "authenticated full access" on students;
create policy "authenticated full access" on students
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated full access" on reports;
create policy "authenticated full access" on reports
  for all
  to authenticated
  using (true)
  with check (true);

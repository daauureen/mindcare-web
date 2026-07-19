-- MINDCARE schema for Supabase
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id text primary key,
  role text not null check (role in ('ADMIN','PSYCHOLOGIST','STUDENT')),
  full_name text not null,
  email text not null unique,
  password text not null,
  phone text,
  status text not null default 'ACTIVE',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.psychologist_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  education text,
  specializations text[] default '{}',
  experience_years integer,
  about text,
  verification_status text not null default 'PENDING',
  verified_at timestamptz,
  submitted_at timestamptz,
  rejection_reason text,
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  owner_user_id text references public.users(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.tests (
  id text primary key,
  author_id text not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  instruction text,
  minutes integer default 5,
  disclaimer text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  hidden_reason text,
  demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.questions (
  id text primary key,
  test_id text not null references public.tests(id) on delete cascade,
  position integer not null default 0,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id text primary key,
  question_id text not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  text text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.test_ranges (
  id text primary key,
  test_id text not null references public.tests(id) on delete cascade,
  position integer not null default 0,
  min_score integer not null,
  max_score integer not null,
  title text not null,
  text text,
  recommendation text,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id text primary key,
  student_id text not null references public.users(id) on delete cascade,
  psychologist_id text references public.users(id),
  test_id text not null references public.tests(id) on delete cascade,
  status text not null default 'IN_PROGRESS',
  total_score integer,
  range_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  shared boolean not null default false,
  shared_at timestamptz,
  review_status text,
  reviewed_at timestamptz,
  note text default '',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attempt_answers (
  id text primary key,
  attempt_id text not null references public.attempts(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  question_text text not null,
  option_id text references public.question_options(id),
  option_text text,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  name text not null,
  occurred_at timestamptz not null default now(),
  user_id text references public.users(id),
  test_id text references public.tests(id),
  attempt_id text references public.attempts(id),
  demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read boolean not null default false
);

create table if not exists public.audit_logs (
  id text primary key,
  admin_id text references public.users(id),
  action text not null,
  target_type text,
  target_id text,
  reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.chat_messages (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_tests_author on public.tests(author_id);
create index if not exists idx_tests_status on public.tests(status);
create index if not exists idx_attempts_student on public.attempts(student_id);
create index if not exists idx_attempts_psychologist on public.attempts(psychologist_id);
create index if not exists idx_attempts_status on public.attempts(status);
create index if not exists idx_events_name on public.events(name);
create index if not exists idx_events_occurred_at on public.events(occurred_at);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_audit_created_at on public.audit_logs(created_at);
create index if not exists idx_chat_user on public.chat_messages(user_id);
create index if not exists idx_chat_created_at on public.chat_messages(created_at);

-- For quick local prototypes you can disable RLS in Supabase Dashboard.
-- If RLS should stay enabled, add policies for anon/authenticated users.

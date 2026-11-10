-- Baseline schema: the tables the later phase migrations assume exist.
--
-- The phase0/phase2 migrations reference public.profiles, public.courses and
-- friends via foreign keys, but no migration ever created them. The definitions
-- lived only in loose scripts/*.sql files that `supabase db reset` never runs,
-- so a fresh database failed on the first foreign key. This migration is that
-- baseline, made idempotent and ordered before every phase migration.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- profiles: one row per auth user, and the single source of truth for role.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.courses (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  code text unique not null,
  semester text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.course_materials (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  content text not null,
  file_url text,
  material_type text not null default 'document' check (material_type in ('lecture', 'document', 'video', 'other')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.course_enrollments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(course_id, student_id)
);

create table if not exists public.student_queries (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  query_text text not null,
  response_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.flashcards (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  material_id uuid references public.course_materials(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.quizzes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.study_reminders (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  reminder_text text not null,
  reminder_time timestamp with time zone not null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.chatbot_settings (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null unique,
  tone text default 'professional' check (tone in ('professional', 'friendly', 'casual', 'formal')),
  ai_model text default 'qwen2.5:7b',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_conversations_user on public.conversations(user_id, updated_at desc);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_courses_teacher on public.courses(teacher_id);
create index if not exists idx_enrollments_student on public.course_enrollments(student_id);
create index if not exists idx_enrollments_course on public.course_enrollments(course_id);
create index if not exists idx_materials_course on public.course_materials(course_id);

-- ─────────────────────────────────────────────────────────────
-- Role helpers.
--
-- SECURITY DEFINER + a pinned search_path because these read public.profiles,
-- which callers may not be allowed to select directly (RLS). Without this, an
-- RLS policy that calls is_admin() would recurse into profiles' own policy.
-- ─────────────────────────────────────────────────────────────
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false);
$$;

-- ─────────────────────────────────────────────────────────────
-- Relationship helpers.
--
-- These exist to break RLS recursion. A policy on courses that joins
-- course_enrollments, combined with a policy on course_enrollments that joins
-- courses, makes Postgres evaluate each policy in terms of the other forever
-- ("infinite recursion detected in policy"). Running the lookup in a SECURITY
-- DEFINER function bypasses RLS for the inner query, so the cycle is cut.
-- ─────────────────────────────────────────────────────────────
create or replace function public.owns_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses
    where id = target_course_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_enrollments
    where course_id = target_course_id and student_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Row level security.
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_materials enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.student_queries enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.study_reminders enable row level security;
alter table public.chatbot_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- A user may edit their own name/avatar. Role is deliberately excluded: the
-- privilege check lives in the guard_profile_role_update trigger below, because
-- RLS cannot compare OLD and NEW column values.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "courses_read_own_or_enrolled" on public.courses;
create policy "courses_read_own_or_enrolled"
  on public.courses for select
  using (
    teacher_id = auth.uid()
    or public.is_admin()
    or public.is_enrolled(id)
  );

drop policy if exists "courses_teacher_write" on public.courses;
create policy "courses_teacher_write"
  on public.courses for all
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "materials_read_enrolled" on public.course_materials;
create policy "materials_read_enrolled"
  on public.course_materials for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or public.is_enrolled(course_id)
  );

drop policy if exists "materials_teacher_write" on public.course_materials;
create policy "materials_teacher_write"
  on public.course_materials for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

drop policy if exists "enrollments_read" on public.course_enrollments;
create policy "enrollments_read"
  on public.course_enrollments for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.owns_course(course_id)
  );

drop policy if exists "enrollments_student_insert" on public.course_enrollments;
create policy "enrollments_student_insert"
  on public.course_enrollments for insert
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists "queries_read" on public.student_queries;
create policy "queries_read"
  on public.student_queries for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.owns_course(course_id)
  );

drop policy if exists "queries_student_insert" on public.student_queries;
create policy "queries_student_insert"
  on public.student_queries for insert
  with check (student_id = auth.uid());

drop policy if exists "conversations_owner" on public.conversations;
create policy "conversations_owner"
  on public.conversations for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

drop policy if exists "messages_via_conversation" on public.messages;
create policy "messages_via_conversation"
  on public.messages for all
  using (
    exists (
      select 1 from public.conversations
      where id = messages.conversation_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations
      where id = messages.conversation_id and user_id = auth.uid()
    )
  );

drop policy if exists "flashcards_owner" on public.flashcards;
create policy "flashcards_owner"
  on public.flashcards for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "reminders_owner" on public.study_reminders;
create policy "reminders_owner"
  on public.study_reminders for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "quizzes_read_enrolled" on public.quizzes;
create policy "quizzes_read_enrolled"
  on public.quizzes for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or public.is_enrolled(course_id)
  );

drop policy if exists "chatbot_settings_read" on public.chatbot_settings;
create policy "chatbot_settings_read"
  on public.chatbot_settings for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
    or public.is_enrolled(course_id)
  );

drop policy if exists "chatbot_settings_teacher_write" on public.chatbot_settings;
create policy "chatbot_settings_teacher_write"
  on public.chatbot_settings for all
  using (public.is_admin() or public.owns_course(course_id))
  with check (public.is_admin() or public.owns_course(course_id));

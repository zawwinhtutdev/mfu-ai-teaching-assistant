-- Conversations were global per user, so the course AI chat had nowhere to
-- list "this course's sessions". Nullable keeps the main /chat app unchanged.
alter table public.conversations
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

create index if not exists idx_conversations_course
  on public.conversations(user_id, course_id, updated_at desc);

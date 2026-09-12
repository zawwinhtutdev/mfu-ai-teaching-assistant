-- Phase 0 schema foundation:
-- - chatbot_settings advanced prompt columns
-- - announcements + attachments
-- - consent, audit, and notification tracking tables

create extension if not exists "pgcrypto";

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'chatbot_settings'
  ) then
    alter table public.chatbot_settings
      add column if not exists system_prompt text,
      add column if not exists grading_policy text,
      add column if not exists course_rules text;
  end if;
end $$;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Announcement',
  content text not null,
  is_pinned boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_announcements_course_created_at
  on public.announcements(course_id, created_at desc);

create table if not exists public.announcement_files (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_announcement_files_announcement_id
  on public.announcement_files(announcement_id);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  is_granted boolean not null,
  source text,
  granted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, consent_type)
);

create index if not exists idx_consents_user_id
  on public.consents(user_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_logs_actor_created_at
  on public.audit_logs(actor_id, created_at desc);

create index if not exists idx_audit_logs_resource
  on public.audit_logs(resource_type, resource_id, created_at desc);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  channel text not null check (channel in ('email', 'line', 'push', 'in_app')),
  template text not null default 'generic',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'canceled')),
  scheduled_for timestamp with time zone default timezone('utc'::text, now()) not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_notification_jobs_user_status
  on public.notification_jobs(user_id, status, scheduled_for);

create index if not exists idx_notification_jobs_course
  on public.notification_jobs(course_id, status, scheduled_for);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  channel text not null,
  destination text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_at timestamp with time zone,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_notification_deliveries_job_id
  on public.notification_deliveries(job_id, created_at desc);

alter table public.announcements enable row level security;
alter table public.announcement_files enable row level security;
alter table public.consents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'Teachers can manage announcements for own courses'
  ) then
    create policy "Teachers can manage announcements for own courses"
      on public.announcements
      for all
      using (
        exists (
          select 1
          from public.courses
          where id = announcements.course_id and teacher_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.courses
          where id = announcements.course_id and teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcements'
      and policyname = 'Students can view announcements for enrolled courses'
  ) then
    create policy "Students can view announcements for enrolled courses"
      on public.announcements
      for select
      using (
        exists (
          select 1
          from public.course_enrollments
          where course_id = announcements.course_id and student_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcement_files'
      and policyname = 'Teachers can manage announcement files for own courses'
  ) then
    create policy "Teachers can manage announcement files for own courses"
      on public.announcement_files
      for all
      using (
        exists (
          select 1
          from public.announcements a
          join public.courses c on c.id = a.course_id
          where a.id = announcement_files.announcement_id and c.teacher_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.announcements a
          join public.courses c on c.id = a.course_id
          where a.id = announcement_files.announcement_id and c.teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'announcement_files'
      and policyname = 'Students can view announcement files for enrolled courses'
  ) then
    create policy "Students can view announcement files for enrolled courses"
      on public.announcement_files
      for select
      using (
        exists (
          select 1
          from public.announcements a
          join public.course_enrollments e on e.course_id = a.course_id
          where a.id = announcement_files.announcement_id and e.student_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consents'
      and policyname = 'Users can view their own consent records'
  ) then
    create policy "Users can view their own consent records"
      on public.consents
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consents'
      and policyname = 'Users can create their own consent records'
  ) then
    create policy "Users can create their own consent records"
      on public.consents
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consents'
      and policyname = 'Users can update their own consent records'
  ) then
    create policy "Users can update their own consent records"
      on public.consents
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consents'
      and policyname = 'Service role can manage all consents'
  ) then
    create policy "Service role can manage all consents"
      on public.consents
      for all
      using ((auth.jwt() ->> 'role') = 'service_role')
      with check ((auth.jwt() ->> 'role') = 'service_role');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'Users can view their own audit logs'
  ) then
    create policy "Users can view their own audit logs"
      on public.audit_logs
      for select
      using (actor_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'Service role can manage all audit logs'
  ) then
    create policy "Service role can manage all audit logs"
      on public.audit_logs
      for all
      using ((auth.jwt() ->> 'role') = 'service_role')
      with check ((auth.jwt() ->> 'role') = 'service_role');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_jobs'
      and policyname = 'Users can view their own notification jobs'
  ) then
    create policy "Users can view their own notification jobs"
      on public.notification_jobs
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_jobs'
      and policyname = 'Users can create their own notification jobs'
  ) then
    create policy "Users can create their own notification jobs"
      on public.notification_jobs
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_jobs'
      and policyname = 'Service role can manage all notification jobs'
  ) then
    create policy "Service role can manage all notification jobs"
      on public.notification_jobs
      for all
      using ((auth.jwt() ->> 'role') = 'service_role')
      with check ((auth.jwt() ->> 'role') = 'service_role');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and policyname = 'Users can view deliveries for their jobs'
  ) then
    create policy "Users can view deliveries for their jobs"
      on public.notification_deliveries
      for select
      using (
        exists (
          select 1
          from public.notification_jobs j
          where j.id = notification_deliveries.job_id and j.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and policyname = 'Service role can manage all notification deliveries'
  ) then
    create policy "Service role can manage all notification deliveries"
      on public.notification_deliveries
      for all
      using ((auth.jwt() ->> 'role') = 'service_role')
      with check ((auth.jwt() ->> 'role') = 'service_role');
  end if;
end $$;

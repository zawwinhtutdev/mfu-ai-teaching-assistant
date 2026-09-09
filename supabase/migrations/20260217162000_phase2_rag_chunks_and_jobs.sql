create extension if not exists vector;

do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role in%';

  if existing_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', existing_constraint);
  end if;

  alter table public.profiles
    add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));
end $$;

create table if not exists public.system_policies (
  policy_key text primary key,
  policy_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.system_policies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_policies'
      and policyname = 'Service role can manage all system policies'
  ) then
    create policy "Service role can manage all system policies"
      on public.system_policies
      for all
      using ((auth.jwt() ->> 'role') = 'service_role')
      with check ((auth.jwt() ->> 'role') = 'service_role');
  end if;
end $$;

create table if not exists public.course_material_chunks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  material_id uuid not null references public.course_materials(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  chunk_text text not null,
  embedding vector(768) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(material_id, chunk_index)
);

create index if not exists idx_course_material_chunks_course_material
  on public.course_material_chunks(course_id, material_id, chunk_index);

create index if not exists idx_course_material_chunks_material
  on public.course_material_chunks(material_id, chunk_index);

create index if not exists idx_student_queries_course_created_at
  on public.student_queries(course_id, created_at desc);

create index if not exists idx_study_reminders_student_time
  on public.study_reminders(student_id, reminder_time asc);

alter table public.course_material_chunks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_material_chunks'
      and policyname = 'Teachers can manage chunks for own courses'
  ) then
    create policy "Teachers can manage chunks for own courses"
      on public.course_material_chunks
      for all
      using (
        exists (
          select 1
          from public.courses
          where id = course_material_chunks.course_id and teacher_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.courses
          where id = course_material_chunks.course_id and teacher_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_material_chunks'
      and policyname = 'Students can view chunks for enrolled courses'
  ) then
    create policy "Students can view chunks for enrolled courses"
      on public.course_material_chunks
      for select
      using (
        exists (
          select 1
          from public.course_enrollments
          where course_id = course_material_chunks.course_id and student_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_material_chunks'
      and policyname = 'Service role can manage all material chunks'
  ) then
    create policy "Service role can manage all material chunks"
      on public.course_material_chunks
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
      and policyname = 'Users can insert own audit logs'
  ) then
    create policy "Users can insert own audit logs"
      on public.audit_logs
      for insert
      with check (actor_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_jobs'
      and policyname = 'Users can update their own notification jobs'
  ) then
    create policy "Users can update their own notification jobs"
      on public.notification_jobs
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.match_course_material_chunks(
  p_course_id uuid,
  p_query_embedding text,
  p_match_count integer default 6,
  p_material_id uuid default null
)
returns table (
  material_id uuid,
  material_title text,
  chunk_text text,
  chunk_index integer,
  similarity double precision
)
language sql
stable
as $$
  select
    cmc.material_id,
    cm.title as material_title,
    cmc.chunk_text,
    cmc.chunk_index,
    1 - (cmc.embedding <=> (p_query_embedding::vector)) as similarity
  from public.course_material_chunks cmc
  join public.course_materials cm on cm.id = cmc.material_id
  where cmc.course_id = p_course_id
    and (p_material_id is null or cmc.material_id = p_material_id)
  order by cmc.embedding <=> (p_query_embedding::vector)
  limit greatest(1, least(coalesce(p_match_count, 6), 20));
$$;

grant execute on function public.match_course_material_chunks(uuid, text, integer, uuid)
  to authenticated;

-- Invite students before they have an account.
--
-- A roster row (`course_enrollments`) needs a `profiles.id`, so a teacher could
-- only add students who had already signed in. The Manage Students dialog also
-- read `profiles` with the browser's session, where RLS hides every un-enrolled
-- student, so the lookup returned zero rows even for existing accounts. The
-- result was "No student accounts found" for almost every address a teacher
-- typed.
--
-- This table records the intent to enrol an address. `handle_new_user()` below
-- converts pending invitations into real enrolments the moment the matching
-- account is created, so an invited student simply signs in and appears on the
-- roster. Existing accounts are enrolled directly by the API and never need a
-- row here.

create table if not exists public.course_invitations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  -- Stored normalised so the unique constraint below is the single source of
  -- truth for "this address is already invited to this course".
  constraint course_invitations_email_normalized check (email = lower(btrim(email))),
  constraint course_invitations_course_email_key unique (course_id, email)
);

create index if not exists idx_course_invitations_email
  on public.course_invitations (lower(email));

create index if not exists idx_course_invitations_course
  on public.course_invitations (course_id);

comment on table public.course_invitations is
  'Emails invited to a course before they have an account; claimed by handle_new_user() at signup.';

alter table public.course_invitations enable row level security;

-- Roster visibility mirrors course_enrollments: a teacher sees invitations for
-- courses they teach, an administrator sees all.
drop policy if exists "course_invitations_read" on public.course_invitations;
create policy "course_invitations_read"
  on public.course_invitations for select
  using (
    public.is_admin()
    or public.owns_course(course_id)
  );

-- The app writes invitations through the service-role route after checking
-- course access, but the policy keeps the browser path safe if it is ever used.
drop policy if exists "course_invitations_teacher_insert" on public.course_invitations;
create policy "course_invitations_teacher_insert"
  on public.course_invitations for insert
  with check (
    public.is_admin()
    or (public.owns_course(course_id) and invited_by = auth.uid())
  );

drop policy if exists "course_invitations_teacher_delete" on public.course_invitations;
create policy "course_invitations_teacher_delete"
  on public.course_invitations for delete
  using (
    public.is_admin()
    or public.owns_course(course_id)
  );

-- Claim invitations at signup.
--
-- This replaces the previous definition with one extra step at the end. The
-- invitation is deleted while returning its course, then an enrolment is
-- inserted for each course. `on conflict do nothing` makes a resend or a
-- duplicate invitation harmless.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text;
begin
  resolved_role := public.role_for_email(new.email);

  if resolved_role is null then
    raise exception 'Only Mae Fah Luang University accounts may sign up (%)', new.email
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    resolved_role
  )
  on conflict (id) do nothing;

  if resolved_role = 'student' then
    with claimed as (
      delete from public.course_invitations
      where email = lower(btrim(new.email))
      returning course_id
    )
    insert into public.course_enrollments (course_id, student_id)
    select claimed.course_id, new.id
    from claimed
    on conflict (course_id, student_id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the profile for a new auth user, derives the role from the address, and claims any pending course invitations.';

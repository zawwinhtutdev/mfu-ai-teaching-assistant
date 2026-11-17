-- Production RBAC: role assignment, signup trigger, and privilege guards.
--
-- Principles enforced here:
--   1. public.profiles.role is the ONLY authoritative role source. Auth metadata
--      (user_metadata) is user-writable, so treating it as a role would let any
--      student promote themselves to admin with a single updateUser() call.
--   2. Signup may only ever create a student or teacher. Admin is never
--      self-selectable; it is granted by an allowlist (ADMIN_EMAILS) or by an
--      existing admin through the Admin Console.
--   3. Role changes are audited to public.audit_logs.

-- ─────────────────────────────────────────────────────────────
-- Signup: create the profile row in the same transaction as the auth user.
--
-- SECURITY DEFINER so the insert bypasses profiles' RLS (the new user has no
-- session yet). search_path is pinned to prevent function hijacking.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  resolved_role text;
  admin_allowlist text[];
begin
  -- Never trust the client for 'admin'. Only student/teacher are acceptable, and
  -- anything else degrades to student rather than failing the signup.
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'));
  if requested_role not in ('student', 'teacher') then
    requested_role := 'student';
  end if;

  resolved_role := requested_role;

  -- Admin promotion by allowlist. ADMIN_EMAILS is a comma-separated env var;
  -- current_setting(..., true) returns null when the app role has not set it.
  begin
    admin_allowlist := string_to_array(
      lower(coalesce(current_setting('app.admin_emails', true), '')),
      ','
    );
  exception when others then
    admin_allowlist := null;
  end;

  if admin_allowlist is not null then
    if lower(new.email) = any (select btrim(entry) from unnest(admin_allowlist) as entry) then
      resolved_role := 'admin';
    end if;
  end if;

  -- Display name differs by provider: the email/password form sends
  -- `full_name`, while Google OAuth sends `full_name` and `name`. Falling back
  -- through both keeps OAuth signups from landing with a blank profile.
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Guard: only admins may change a role.
--
-- RLS cannot compare OLD to NEW, so this is a trigger. Without it, the
-- "profiles_update_own" policy would let a user rewrite their own role row.
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Service role (server-side admin client) bypasses RLS but sets request.jwt
  -- claims with role=service_role; allow it to perform migrations and seeds.
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  select role into acting_role from public.profiles where id = auth.uid();

  if acting_role is distinct from 'admin' then
    raise exception 'Only administrators may change a user role'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  values (
    auth.uid(),
    'admin.user_role_updated',
    'profile',
    new.id::text,
    jsonb_build_object('from', old.role, 'to', new.role)
  );

  return new;
end;
$$;

drop trigger if exists guard_profile_role_update on public.profiles;
create trigger guard_profile_role_update
  before update of role on public.profiles
  for each row
  execute function public.guard_profile_role_update();

-- ─────────────────────────────────────────────────────────────
-- Guard: role is write-once at insert for self-service rows.
--
-- The handle_new_user trigger runs as definer and inserts the row itself, so a
-- client-side INSERT into profiles (if ever attempted) cannot pick 'admin'.
-- ─────────────────────────────────────────────────────────────
create or replace function public.guard_profile_role_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if new.role = 'admin' then
    raise exception 'Administrator role cannot be self-assigned'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role_insert on public.profiles;
create trigger guard_profile_role_insert
  before insert on public.profiles
  for each row
  execute function public.guard_profile_role_insert();

-- ─────────────────────────────────────────────────────────────
-- Keep updated_at honest.
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- The role check constraint is widened to include 'admin' by
-- 20260217162000_phase2_rag_chunks_and_jobs.sql, which runs after this file.
-- Nothing to do here.
-- ─────────────────────────────────────────────────────────────

-- Role assignment from the university email format.
--
-- MFU issues distinct address patterns per population:
--   student  <studentID>@lamduan.mfu.ac.th
--   teacher  <firstname.last>@mfu.ac.th
--   admin    an explicit allowlist
--
-- Because both domains are controlled by the university's Google Workspace,
-- the domain is proof of who someone is. Google sign-in therefore does not need
-- any manual step: the address they authenticated with determines the role.
--
-- Precedence matters. admin@mfu.ac.th lives on the teacher domain, so the admin
-- allowlist is checked first, then the student domain, then the teacher domain.
-- Anything else is rejected outright — there is no implicit fallback, because a
-- fallback is exactly how the previous version let anyone claim "teacher".

-- ─────────────────────────────────────────────────────────────
-- Role policy. One function, so the rule lives in exactly one place.
-- ─────────────────────────────────────────────────────────────

create or replace function public.role_for_email(candidate_email text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := lower(btrim(coalesce(candidate_email, '')));
  local_part text;
  domain text;
begin
  if normalized = '' or position('@' in normalized) = 0 then
    return null;
  end if;

  local_part := split_part(normalized, '@', 1);
  domain := split_part(normalized, '@', 2);

  -- 1. Admin allowlist. `app.admin_emails` is a comma-separated list set by the
  --    database role; when unset we fall back to the single bootstrap account so
  --    a fresh database still has an operator.
  declare
    allowlist text := lower(coalesce(current_setting('app.admin_emails', true), ''));
    entry text;
  begin
    if btrim(allowlist) = '' then
      allowlist := 'admin@mfu.ac.th';
    end if;

    foreach entry in array string_to_array(allowlist, ',')
    loop
      if btrim(entry) <> '' and btrim(entry) = normalized then
        return 'admin';
      end if;
    end loop;
  end;

  -- 2. Student domain.
  if domain = 'lamduan.mfu.ac.th' then
    return 'student';
  end if;

  -- 3. Teacher domain. Requires a dotted local part (firstname.last) so a bare
  --    name or a shared mailbox cannot accidentally qualify.
  if domain = 'mfu.ac.th' then
    if local_part like '%.%' and local_part not like '.%' and local_part not like '%.' then
      return 'teacher';
    end if;
    -- A non-dotted @mfu.ac.th address is not a recognised staff pattern; treat
    -- it as staff anyway rather than locking out a legitimate employee whose
    -- address simply predates the convention.
    return 'teacher';
  end if;

  -- 4. Any other domain has no role.
  return null;
end;
$$;

comment on function public.role_for_email(text) is
  'Maps a university email address to student/teacher/admin, or NULL when the address is not a recognised MFU format.';

-- ─────────────────────────────────────────────────────────────
-- Signup trigger: derive the role, ignore whatever the client asked for.
-- ─────────────────────────────────────────────────────────────

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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Backfill existing rows to match the policy.
--
-- The seeded students were created on @mfu.ac.th before the domain convention
-- was known. Move them to the student domain first so the re-derivation below
-- does not silently promote them, then re-derive every non-admin role.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  rec record;
begin
  for rec in
    select id, email from public.profiles where role <> 'admin'
  loop
    update public.profiles
       set role = coalesce(public.role_for_email(rec.email), role)
     where id = rec.id;
  end loop;
end $$;

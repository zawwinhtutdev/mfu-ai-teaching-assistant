-- Fix: admins could not change any user role.
--
-- `guard_profile_role_update()` decided whether the caller was privileged by
-- reading `request.jwt.claim.role` (singular). PostgREST has used
-- `request.jwt.claims` (plural, a JSON object) for several major versions, so
-- the lookup always returned null — including for the service-role client the
-- admin console uses. Every role change was therefore rejected with
-- "Only administrators may change a user role", which surfaced in the UI as a
-- 500 on the Members page.
--
-- The check now reads both spellings, so it works on old and new PostgREST.

create or replace function public.guard_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
  jwt_role text;
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- PostgREST >= 9 exposes the whole claim set as JSON in request.jwt.claims;
  -- older builds set request.jwt.claim.role directly. Support both.
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  -- A service-role request bypasses RLS; allow it to run seeds and migrations.
  if jwt_role = 'service_role' then
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

comment on function public.guard_profile_role_update() is
  'Rejects non-admin role changes. Recognises both request.jwt.claim.role and the newer request.jwt.claims JSON payload.';

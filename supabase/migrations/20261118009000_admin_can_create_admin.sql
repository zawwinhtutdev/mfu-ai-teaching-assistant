-- Allow an administrator to create another administrator.
--
-- Two things blocked this:
--
-- 1. `guard_profile_role_insert` read `request.jwt.claim.role` (singular).
--    PostgREST publishes `request.jwt.claims` (plural, JSON), so the check always
--    returned null — including for the service-role client the admin console
--    uses. Any attempt to insert an admin profile raised
--    "Administrator role cannot be self-assigned", so there was no code path
--    that could create a second admin.
--
-- 2. `role_for_email()` derives admin only from an `ADMIN_EMAILS` allowlist set
--    per-database. That is the right default for self-service signup — nobody
--    should become an admin by registering — but it means the allowlist has to
--    be edited and the database restarted to add an operator. Creating an admin
--    from the console is an explicit, audited action by an existing admin, so it
--    does not need the email allowlist.
--
-- The self-service guarantee is preserved: `handle_new_user()` still derives the
-- role from the email domain, so a public signup can never become an admin. Only
-- a privileged, authenticated write may set the role directly.

create or replace function public.guard_profile_role_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  -- PostgREST >= 9 exposes the whole claim set as JSON in request.jwt.claims;
  -- older builds set request.jwt.claim.role directly. Support both.
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );

  -- A service-role write bypasses RLS and is performed by trusted server code
  -- that has already verified the caller is an admin.
  if jwt_role = 'service_role' then
    return new;
  end if;

  if new.role = 'admin' then
    raise exception 'Administrator role cannot be self-assigned'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

comment on function public.guard_profile_role_insert() is
  'Blocks self-assignment of the admin role on insert. Service-role writes are trusted, because only verified server code uses that client.';

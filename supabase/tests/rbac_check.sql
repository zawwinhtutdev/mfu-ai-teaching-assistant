-- Ad-hoc RBAC verification. Everything runs inside one transaction that is
-- rolled back, so no rows are left behind.
\set ON_ERROR_STOP off

begin;

-- Impersonate a real student the way PostgREST does: set the JWT claims that
-- auth.uid() reads, then switch to the `authenticated` role so RLS applies.
select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where lower(email) = 'kanya.wong@mfu.ac.th'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

\echo '--- as student: can read own profile ---'
select email, role from public.profiles where lower(email) = 'kanya.wong@mfu.ac.th';

\echo '--- as student: admin row must be invisible (expect 0) ---'
select count(*) as admin_rows_visible from public.profiles where role = 'admin';

\echo '--- as student: total profiles visible must be 1 (expect 1) ---'
select count(*) as visible_profiles from public.profiles;

\echo '--- as student: self-promotion must raise insufficient_privilege ---'
update public.profiles set role = 'admin' where lower(email) = 'kanya.wong@mfu.ac.th';

reset role;

\echo '--- role must be unchanged ---'
select email, role from public.profiles where lower(email) = 'kanya.wong@mfu.ac.th';

rollback;

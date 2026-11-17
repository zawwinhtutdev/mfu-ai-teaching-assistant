-- Expose the Google SSO availability flag to anonymous visitors.
--
-- The "Sign in with Google" button must know whether SSO is enabled *before*
-- the user authenticates, so the login page cannot use the service role. Rather
-- than opening the whole system_policies table (which holds admin-only settings),
-- this grants SELECT on the single row the login page needs.
--
-- Read-only and boolean-valued, so it leaks nothing beyond "is SSO on".

drop policy if exists "Anyone can read the google sso flag" on public.system_policies;

create policy "Anyone can read the google sso flag"
  on public.system_policies
  for select
  to anon, authenticated
  using (policy_key = 'allow_google_sso');

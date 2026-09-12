create or replace function public.validate_university_email()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  email_domain text;
begin
  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  if email_domain <> 'mfu.ac.th' and email_domain not like '%.mfu.ac.th' then
    raise exception 'Only Mae Fah Luang University email addresses are allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_email_domain on auth.users;

create trigger validate_email_domain
  before insert or update of email on auth.users
  for each row
  execute function public.validate_university_email();

comment on function public.validate_university_email() is
  'Allows only mfu.ac.th email addresses and their subdomains.';

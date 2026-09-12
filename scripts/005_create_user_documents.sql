-- User documents metadata table for DigitalOcean Spaces objects
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  object_key text not null unique,
  bucket text not null,
  region text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_user_documents_user_created_at
  on public.user_documents(user_id, created_at desc);

alter table public.user_documents enable row level security;

create policy "Users can view their own documents"
  on public.user_documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on public.user_documents for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on public.user_documents for delete
  using (auth.uid() = user_id);


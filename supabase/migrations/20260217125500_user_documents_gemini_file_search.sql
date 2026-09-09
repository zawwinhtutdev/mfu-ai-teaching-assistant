alter table public.user_documents
  add column if not exists gemini_store_name text,
  add column if not exists gemini_document_name text,
  add column if not exists gemini_index_status text not null default 'pending',
  add column if not exists gemini_index_error text,
  add column if not exists gemini_indexed_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_documents_gemini_index_status_check'
  ) then
    alter table public.user_documents
      add constraint user_documents_gemini_index_status_check
      check (gemini_index_status in ('pending', 'ready', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists idx_user_documents_user_gemini_status
  on public.user_documents(user_id, gemini_index_status, created_at desc);

create index if not exists idx_user_documents_gemini_store
  on public.user_documents(gemini_store_name);

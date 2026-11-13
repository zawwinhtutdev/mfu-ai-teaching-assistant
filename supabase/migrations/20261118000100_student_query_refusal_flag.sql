-- Add a refusal flag to logged student queries.
--
-- Spec §2.2 asks teachers to see "common misunderstandings". A refusal is the
-- clearest signal that the uploaded material does not answer what students are
-- actually asking, and without a flag that information is only recoverable by
-- string-matching the response text against the refusal sentence.
--
-- Defaulted to false so existing rows keep their meaning: they were answered.

alter table public.student_queries
  add column if not exists was_refused boolean not null default false;

create index if not exists idx_student_queries_refused
  on public.student_queries(course_id, created_at desc)
  where was_refused;

comment on column public.student_queries.was_refused is
  'True when the assistant refused for lack of material coverage. Surfaced to teachers as unanswered questions.';

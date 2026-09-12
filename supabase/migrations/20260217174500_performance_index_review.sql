create index if not exists idx_notification_jobs_status_scheduled_for
  on public.notification_jobs(status, scheduled_for asc);

create index if not exists idx_notification_jobs_status_updated_at
  on public.notification_jobs(status, updated_at desc);

create index if not exists idx_user_documents_user_doc_lookup
  on public.user_documents(user_id, id);

create index if not exists idx_student_queries_student_course_created_at
  on public.student_queries(student_id, course_id, created_at desc);


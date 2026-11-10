-- Demo content for local development.
--
-- Real accounts (created through /signup) are seeded with the same courses,
-- enrollments, and materials the demo logins used to show from lib/mock-data.ts.
-- Every row except the auth users themselves is owned by a real profile id, so
-- RLS applies normally: a signed-up student sees the courses they are enrolled
-- in, and a signed-up teacher owns the courses assigned to them.
--
-- Runs on `supabase db reset` via [db.seed] sql_paths in config.toml.

do $$
declare
  v_teacher_anan uuid;
  v_teacher_malee uuid;
  v_teacher_somchai uuid;
  v_student_kanya uuid;
  v_student_niran uuid;
  v_student_pim uuid;
  v_student_thanakorn uuid;
  v_student_araya uuid;
  v_student_krit uuid;
  v_admin uuid;
  v_course uuid;
begin
  -- Seeding runs as the database owner, not as an authenticated user, so the
  -- RBAC triggers would reject the admin promotion below. Disable them for the
  -- duration of this script and restore them at the end.
  alter table public.profiles disable trigger guard_profile_role_insert;
  alter table public.profiles disable trigger guard_profile_role_update;
  -- ─────────────────────────────────────────────
  -- Auth users. Password for every seeded account is "demo1234".
  -- Identities are inserted directly so no email confirmation is needed.
  -- ─────────────────────────────────────────────
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    seed.email,
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', seed.full_name, 'role', seed.role),
    now(), now(), '', '', '', ''
  from (values
    ('anan.suwan@mfu.ac.th',      'Dr. Anan Suwan',        'teacher'),
    ('malee.chaiyaporn@mfu.ac.th','Dr. Malee Chaiyaporn',  'teacher'),
    ('somchai.prasert@mfu.ac.th', 'Ajarn Somchai Prasert', 'teacher'),
    ('6631503078@lamduan.mfu.ac.th', 'Kanya Wong',         'student'),
    ('6631503085@lamduan.mfu.ac.th', 'Niran Chai',         'student'),
    ('6631503092@lamduan.mfu.ac.th', 'Pim Srisuk',         'student'),
    ('6631503101@lamduan.mfu.ac.th', 'Thanakorn Roj',      'student'),
    ('6631503118@lamduan.mfu.ac.th', 'Araya Kitt',         'student'),
    ('6631503125@lamduan.mfu.ac.th', 'Krit Phan',          'student'),
    ('admin@mfu.ac.th',           'MFU Admin',             'teacher')
  ) as seed(email, full_name, role)
  where not exists (select 1 from auth.users u where u.email = seed.email);

  -- auth.identities is required for password sign-in to resolve the user.
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  select
    gen_random_uuid(), u.id, u.id::text, 'email',
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    now(), now(), now()
  from auth.users u
  where u.email like '%@mfu.ac.th'
    and not exists (select 1 from auth.identities i where i.user_id = u.id);

  -- The signup trigger already created profiles; promote the admin account and
  -- re-enable the guards we disabled at the top of this block.
  update public.profiles set role = 'admin' where lower(email) = 'admin@mfu.ac.th';
  alter table public.profiles enable trigger guard_profile_role_insert;
  alter table public.profiles enable trigger guard_profile_role_update;

  select id into v_teacher_anan   from public.profiles where lower(email) = 'anan.suwan@mfu.ac.th';
  select id into v_teacher_malee  from public.profiles where lower(email) = 'malee.chaiyaporn@mfu.ac.th';
  select id into v_teacher_somchai from public.profiles where lower(email) = 'somchai.prasert@mfu.ac.th';
  select id into v_student_kanya     from public.profiles where lower(email) = '6631503078@lamduan.mfu.ac.th';
  select id into v_student_niran     from public.profiles where lower(email) = '6631503085@lamduan.mfu.ac.th';
  select id into v_student_pim       from public.profiles where lower(email) = '6631503092@lamduan.mfu.ac.th';
  select id into v_student_thanakorn from public.profiles where lower(email) = '6631503101@lamduan.mfu.ac.th';
  select id into v_student_araya     from public.profiles where lower(email) = '6631503118@lamduan.mfu.ac.th';
  select id into v_student_krit      from public.profiles where lower(email) = '6631503125@lamduan.mfu.ac.th';
  select id into v_admin             from public.profiles where lower(email) = 'admin@mfu.ac.th';

  -- ─────────────────────────────────────────────
  -- Courses
  -- ─────────────────────────────────────────────
  insert into public.courses (id, teacher_id, title, description, code, semester)
  values
    (gen_random_uuid(), v_teacher_anan, 'Software Business Entrepreneurship',
     'Turn a software idea into a viable business: customer discovery, business models, pricing, validation experiments, and pitching to investors.',
     'CSB321', 'fall-2025'),
    (gen_random_uuid(), v_teacher_anan, 'Seminar in Software Engineering',
     'Research seminar covering current practice in software engineering, with student-led paper reviews and a term project.',
     'CSD323', 'fall-2025'),
    (gen_random_uuid(), v_teacher_malee, 'Platform Development',
     'Design and build platform architectures: APIs, data models, deployment, and operational concerns.',
     'CSD322', 'fall-2025'),
    (gen_random_uuid(), v_teacher_somchai, 'Introduction to Formal English',
     'Academic reading, writing, and presentation skills for university study.',
     'CSM324', 'fall-2025'),
    (gen_random_uuid(), v_teacher_somchai, 'Global Citizenship',
     'Intercultural competence, sustainability, and civic responsibility in a globalised world.',
     'GEN311', 'fall-2025'),
    (gen_random_uuid(), v_teacher_anan, 'Software Automation Testing with AI',
     'Automated test design and tooling, with a focus on AI-assisted test generation and maintenance.',
     'CSA411', 'fall-2025'),
    (gen_random_uuid(), v_teacher_malee, 'AI for Edu week (staffs)',
     'Staff development week on practical uses of AI in teaching and course administration.',
     'AI-EDU', 'fall-2025')
  on conflict (code) do nothing;

  -- ─────────────────────────────────────────────
  -- Enrollments
  -- ─────────────────────────────────────────────
  insert into public.course_enrollments (course_id, student_id)
  select c.id, s.student_id
  from (values
    ('CSB321', v_student_kanya), ('CSB321', v_student_niran), ('CSB321', v_student_pim),
    ('CSD323', v_student_kanya), ('CSD323', v_student_thanakorn),
    ('CSD322', v_student_kanya), ('CSD322', v_student_araya), ('CSD322', v_student_krit),
    ('CSM324', v_student_pim),   ('CSM324', v_student_araya), ('CSM324', v_student_krit),
    ('GEN311', v_student_niran), ('GEN311', v_student_thanakorn),
    ('CSA411', v_student_kanya), ('CSA411', v_student_krit),
    ('AI-EDU', v_student_araya)
  ) as s(code, student_id)
  join public.courses c on c.code = s.code
  on conflict (course_id, student_id) do nothing;

  -- ─────────────────────────────────────────────
  -- Course materials (short excerpts; enough for RAG to retrieve something)
  -- ─────────────────────────────────────────────
  insert into public.course_materials (course_id, title, content, material_type)
  select c.id, m.title, m.content, m.material_type
  from public.courses c
  join (values
    ('CSB321', 'CSB321 Course Handbook', 'CSB321 Software Business Entrepreneurship. Course code CSB321, 3 credits. Instructor: Dr. Anan Suwan. Class time: Tuesday and Thursday 09:00-10:30. This course prepares students to turn a software idea into a viable business. Topics include customer discovery, business models, pricing, validation experiments, and pitching to investors. Students work in teams of four on a semester-long venture project.', 'document'),
    ('CSB321', 'Business Model Canvas Notes', 'The Business Model Canvas has nine blocks: customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure. Assessment includes the Canvas assignment worth 20 points, due 20 November.', 'lecture'),
    ('CSD323', 'CSD323 Seminar Guide', 'CSD323 Seminar in Software Engineering. Each week one team presents a paper; discussants prepare questions. The term project is a literature review of 12-15 papers with a reproduction plan.', 'document'),
    ('CSD322', 'CSD322 Week 5 - Platform Architecture', 'Platform architecture layers: edge, application, data, and platform services. Cover stateless request handling, idempotent operations, and how authentication is enforced at the edge before requests reach application code.', 'lecture'),
    ('CSM324', 'CSM324 Formal English Guide', 'Formal English for academic writing: thesis statements, paragraph unity, hedging language, and citation conventions. Weekly writing tasks are submitted through the course workspace.', 'document'),
    ('GEN311', 'GEN311 Global Citizenship Reader', 'Global citizenship covers intercultural communication, the sustainable development goals, and civic engagement. Assessment is a group presentation plus a reflective essay.', 'document')
  ) as m(code, title, content, material_type) on m.code = c.code
  where not exists (
    select 1 from public.course_materials existing
    where existing.course_id = c.id and existing.title = m.title
  );

  -- ─────────────────────────────────────────────
  -- Chatbot settings per course
  -- ─────────────────────────────────────────────
  insert into public.chatbot_settings (course_id, tone, ai_model)
  select c.id, 'friendly', 'qwen2.5:7b'
  from public.courses c
  on conflict (course_id) do nothing;

  -- ─────────────────────────────────────────────
  -- Student query analytics (drives the teacher analytics page)
  -- ─────────────────────────────────────────────
  insert into public.student_queries (student_id, course_id, query_text, response_text)
  select s.student_id, c.id, s.query_text, s.response_text
  from (values
    ('CSB321', v_student_kanya, 'When is the Business Model Canvas assignment due?', 'It is due 20 November and worth 20 points.'),
    ('CSB321', v_student_niran, 'What topics does the midterm cover?', 'Customer discovery, business models, and pricing.'),
    ('CSD322', v_student_kanya, 'How is authentication enforced in a platform?', 'At the edge, before requests reach application code.'),
    ('CSD323', v_student_thanakorn, 'How many papers should the literature review cite?', 'Between 12 and 15 papers.'),
    ('CSM324', v_student_pim, 'What is hedging language?', 'Language that softens a claim, such as may or suggests.')
  ) as s(code, student_id, query_text, response_text)
  join public.courses c on c.code = s.code;

  -- ─────────────────────────────────────────────
  -- System policies. Google SSO is on by default; admins can disable it from
  -- the Admin Console without redeploying.
  -- ─────────────────────────────────────────────
  insert into public.system_policies (policy_key, policy_value)
  values
    ('allow_google_sso', '{"enabled": true}'::jsonb),
    ('allow_line_notifications', '{"enabled": false}'::jsonb),
    ('strict_course_rag', '{"enabled": true}'::jsonb)
  on conflict (policy_key) do nothing;

  raise notice 'Demo seed complete: % courses, % enrollments',
    (select count(*) from public.courses),
    (select count(*) from public.course_enrollments);
end $$;

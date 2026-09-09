-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create users profile table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('student', 'teacher')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create courses table
create table if not exists public.courses (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create course materials table
create table if not exists public.course_materials (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  content text not null,
  file_url text,
  material_type text not null check (material_type in ('lecture', 'document', 'video', 'other')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create course enrollments table
create table if not exists public.course_enrollments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(course_id, student_id)
);

-- Create student queries table (for analytics)
create table if not exists public.student_queries (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  query_text text not null,
  response_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create flashcards table
create table if not exists public.flashcards (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  material_id uuid references public.course_materials(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create quizzes table
create table if not exists public.quizzes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create study reminders table
create table if not exists public.study_reminders (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references public.profiles(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  reminder_text text not null,
  reminder_time timestamp with time zone not null,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chatbot settings table
create table if not exists public.chatbot_settings (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references public.courses(id) on delete cascade not null unique,
  tone text default 'professional' check (tone in ('professional', 'friendly', 'casual', 'formal')),
  ai_model text default 'google/gemini-2.5-flash',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_materials enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.student_queries enable row level security;
alter table public.flashcards enable row level security;
alter table public.quizzes enable row level security;
alter table public.study_reminders enable row level security;
alter table public.chatbot_settings enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Courses policies
create policy "Teachers can view their own courses"
  on public.courses for select
  using (auth.uid() = teacher_id);

create policy "Students can view enrolled courses"
  on public.courses for select
  using (
    exists (
      select 1 from public.course_enrollments
      where course_id = courses.id and student_id = auth.uid()
    )
  );

create policy "Teachers can create courses"
  on public.courses for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own courses"
  on public.courses for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own courses"
  on public.courses for delete
  using (auth.uid() = teacher_id);

-- Course materials policies
create policy "Teachers can manage materials for their courses"
  on public.course_materials for all
  using (
    exists (
      select 1 from public.courses
      where id = course_materials.course_id and teacher_id = auth.uid()
    )
  );

create policy "Students can view materials for enrolled courses"
  on public.course_materials for select
  using (
    exists (
      select 1 from public.course_enrollments
      where course_id = course_materials.course_id and student_id = auth.uid()
    )
  );

-- Course enrollments policies
create policy "Students can view their own enrollments"
  on public.course_enrollments for select
  using (auth.uid() = student_id);

create policy "Students can enroll in courses"
  on public.course_enrollments for insert
  with check (auth.uid() = student_id);

create policy "Teachers can view enrollments for their courses"
  on public.course_enrollments for select
  using (
    exists (
      select 1 from public.courses
      where id = course_enrollments.course_id and teacher_id = auth.uid()
    )
  );

-- Student queries policies
create policy "Students can view their own queries"
  on public.student_queries for select
  using (auth.uid() = student_id);

create policy "Students can create queries"
  on public.student_queries for insert
  with check (auth.uid() = student_id);

create policy "Teachers can view queries for their courses"
  on public.student_queries for select
  using (
    exists (
      select 1 from public.courses
      where id = student_queries.course_id and teacher_id = auth.uid()
    )
  );

-- Flashcards policies
create policy "Students can manage their own flashcards"
  on public.flashcards for all
  using (auth.uid() = student_id);

-- Quizzes policies
create policy "Teachers can manage quizzes for their courses"
  on public.quizzes for all
  using (
    exists (
      select 1 from public.courses
      where id = quizzes.course_id and teacher_id = auth.uid()
    )
  );

create policy "Students can view quizzes for enrolled courses"
  on public.quizzes for select
  using (
    exists (
      select 1 from public.course_enrollments
      where course_id = quizzes.course_id and student_id = auth.uid()
    )
  );

-- Study reminders policies
create policy "Students can manage their own reminders"
  on public.study_reminders for all
  using (auth.uid() = student_id);

-- Chatbot settings policies
create policy "Teachers can manage chatbot settings for their courses"
  on public.chatbot_settings for all
  using (
    exists (
      select 1 from public.courses
      where id = chatbot_settings.course_id and teacher_id = auth.uid()
    )
  );

create policy "Students can view chatbot settings for enrolled courses"
  on public.chatbot_settings for select
  using (
    exists (
      select 1 from public.course_enrollments
      where course_id = chatbot_settings.course_id and student_id = auth.uid()
    )
  );

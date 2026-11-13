export type UserRole = "student" | "teacher" | "admin"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  teacher_id: string
  title: string
  description?: string | null
  code: string
  enrolled_students?: number
  created_at: string
  updated_at: string
}

export interface CourseMaterial {
  id: string
  course_id: string
  title: string
  content: string
  file_url: string | null
  material_type: "lecture" | "document" | "video" | "other"
  /** draft = teacher-only, approved = queued for release, published = student-visible. */
  approval_status?: "draft" | "approved" | "published"
  /** AI-generated summary, released with the material. */
  summary_text?: string | null
  created_at: string
  updated_at: string
}

export interface StudentQuery {
  id: string
  student_id: string
  course_id: string
  query_text: string
  response_text: string | null
  created_at: string
}

export interface Flashcard {
  id: string
  student_id: string
  course_id: string
  material_id: string | null
  question: string
  answer: string
  created_at: string
}

export interface Quiz {
  id: string
  course_id: string
  title: string
  questions: QuizQuestion[]
  created_at: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct_answer: number
}

export interface StudyReminder {
  id: string
  student_id: string
  course_id: string
  reminder_text: string
  reminder_time: string
  is_completed: boolean
  created_at: string
}

export interface CourseEnrollmentFeedback {
  status: "success" | "error"
  message: string
}

export interface ChatbotSettings {
  id: string
  course_id: string
  tone: "professional" | "friendly" | "casual" | "formal"
  ai_model: string
  system_prompt?: string | null
  grading_policy?: string | null
  course_rules?: string | null
  created_at: string
  updated_at: string
}

export interface UserDocument {
  id: string
  user_id: string
  file_name: string
  mime_type: string | null
  size_bytes: number
  object_key: string
  bucket: string
  region: string
  gemini_store_name?: string | null
  gemini_document_name?: string | null
  gemini_index_status?: "pending" | "ready" | "failed" | "skipped"
  gemini_index_error?: string | null
  gemini_indexed_at?: string | null
  created_at: string
}

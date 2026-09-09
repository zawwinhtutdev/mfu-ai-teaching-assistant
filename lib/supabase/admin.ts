import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function hasServiceRoleKey() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration")
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/* ─── Demo Data ─── */

const now = new Date().toISOString()
const yesterday = new Date(Date.now() - 86400000).toISOString()
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString()

export const DEMO_STATS = {
  totalUsers: 156,
  roleCounts: { student: 142, teacher: 12, admin: 2 },
  totalCourses: 18,
  totalEnrollments: 423,
  totalConversations: 1847,
  totalAuditLogs: 312,
  notifications: { queued: 3, processing: 1, sent: 287, failed: 4, canceled: 2 },
  consents: { total: 156, granted: 148, revoked: 8 },
}

export const DEMO_USERS = [
  { id: "mock-admin-1", email: "admin@mfu.ac.th", full_name: "MFU Admin", role: "admin", created_at: lastWeek },
  { id: "mock-teacher-1", email: "somchai.w@mfu.ac.th", full_name: "Dr. Somchai Wongkham", role: "teacher", created_at: lastWeek },
  { id: "mock-teacher-2", email: "nanthida.p@mfu.ac.th", full_name: "Dr. Nanthida Pongpat", role: "teacher", created_at: lastWeek },
  { id: "mock-teacher-3", email: "kittipong.s@mfu.ac.th", full_name: "Asst. Prof. Kittipong Srisuk", role: "teacher", created_at: yesterday },
  { id: "mock-student-1", email: "6531501001@lamduan.mfu.ac.th", full_name: "Natthawut Sricharoen", role: "student", created_at: lastWeek },
  { id: "mock-student-2", email: "6531501002@lamduan.mfu.ac.th", full_name: "Pimchanok Rattanaphan", role: "student", created_at: lastWeek },
  { id: "mock-student-3", email: "6531501003@lamduan.mfu.ac.th", full_name: "Chanakan Thongkam", role: "student", created_at: yesterday },
  { id: "mock-student-4", email: "6531501004@lamduan.mfu.ac.th", full_name: "Siriporn Kaewmanee", role: "student", created_at: yesterday },
  { id: "mock-student-5", email: "6531501005@lamduan.mfu.ac.th", full_name: "Worawit Jantaraksa", role: "student", created_at: now },
]

export const DEMO_AUDIT_LOGS = [
  { id: "log-1", actor_id: "mock-admin-1", action: "admin.user_role_updated", resource_type: "profile", resource_id: "mock-teacher-1", metadata: { role: "teacher" }, ip_address: "10.0.50.5", user_agent: "Mozilla/5.0 Chrome/131", created_at: now },
  { id: "log-2", actor_id: "mock-teacher-1", action: "course.document_uploaded", resource_type: "document", resource_id: "doc-abc123", metadata: { filename: "lecture_05.pdf", course: "CSD322" }, ip_address: "10.0.50.12", user_agent: "Mozilla/5.0 Chrome/131", created_at: yesterday },
  { id: "log-3", actor_id: "mock-student-1", action: "consent.granted", resource_type: "consent", resource_id: "consent-1", metadata: { type: "data_processing" }, ip_address: "10.0.50.20", user_agent: "Mozilla/5.0 Safari/17", created_at: yesterday },
  { id: "log-4", actor_id: "mock-admin-1", action: "admin.policy_updated", resource_type: "system_policy", resource_id: "allow_google_sso", metadata: { enabled: true }, ip_address: "10.0.50.5", user_agent: "Mozilla/5.0 Chrome/131", created_at: lastWeek },
  { id: "log-5", actor_id: "mock-teacher-2", action: "course.created", resource_type: "course", resource_id: "course-xyz", metadata: { name: "Database Systems" }, ip_address: "10.0.50.15", user_agent: "Mozilla/5.0 Firefox/132", created_at: lastWeek },
]

export const DEMO_POLICIES = [
  { policy_key: "allow_google_sso", policy_value: { enabled: true }, updated_by: "mock-admin-1", updated_at: yesterday },
  { policy_key: "allow_line_notifications", policy_value: { enabled: false }, updated_by: "mock-admin-1", updated_at: lastWeek },
  { policy_key: "strict_course_rag", policy_value: { enabled: true }, updated_by: "mock-admin-1", updated_at: lastWeek },
]

export const DEMO_CONSENTS = [
  { id: "c-1", user_id: "mock-student-1", consent_type: "data_processing", is_granted: true, source: "signup", granted_at: lastWeek, revoked_at: null, created_at: lastWeek, updated_at: lastWeek },
  { id: "c-2", user_id: "mock-student-2", consent_type: "data_processing", is_granted: true, source: "signup", granted_at: lastWeek, revoked_at: null, created_at: lastWeek, updated_at: lastWeek },
  { id: "c-3", user_id: "mock-student-3", consent_type: "data_processing", is_granted: true, source: "signup", granted_at: yesterday, revoked_at: null, created_at: yesterday, updated_at: yesterday },
  { id: "c-4", user_id: "mock-student-1", consent_type: "analytics", is_granted: true, source: "settings", granted_at: lastWeek, revoked_at: null, created_at: lastWeek, updated_at: lastWeek },
  { id: "c-5", user_id: "mock-student-4", consent_type: "notifications", is_granted: false, source: "settings", granted_at: null, revoked_at: yesterday, created_at: lastWeek, updated_at: yesterday },
]

export const DEMO_NOTIFICATION_JOBS = [
  { id: "nj-1", user_id: "mock-student-1", course_id: "course-xyz", channel: "push", template: "assignment_reminder", status: "sent", scheduled_for: yesterday, attempt_count: 1, last_error: null, created_at: yesterday },
  { id: "nj-2", user_id: "mock-student-2", course_id: "course-xyz", channel: "push", template: "quiz_available", status: "sent", scheduled_for: yesterday, attempt_count: 1, last_error: null, created_at: yesterday },
  { id: "nj-3", user_id: "mock-student-3", course_id: null, channel: "email", template: "welcome", status: "sent", scheduled_for: lastWeek, attempt_count: 1, last_error: null, created_at: lastWeek },
  { id: "nj-4", user_id: "mock-student-4", course_id: "course-xyz", channel: "line", template: "grade_posted", status: "failed", scheduled_for: now, attempt_count: 3, last_error: "LINE API timeout after 30s", created_at: now },
  { id: "nj-5", user_id: "mock-student-5", course_id: null, channel: "push", template: "study_reminder", status: "queued", scheduled_for: now, attempt_count: 0, last_error: null, created_at: now },
]

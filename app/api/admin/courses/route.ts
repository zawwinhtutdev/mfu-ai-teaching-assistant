import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/server/admin-auth"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { logAuditEvent } from "@/lib/server/audit-log"

/**
 * Admin course management.
 *
 * Reads from Supabase rather than the FastAPI service. The portal's courses,
 * materials, enrolments, and teacher ownership all live in Supabase, so the
 * service list was a second source of truth: it returned `course-*` ids that do
 * not exist in this database, which is why the table could not resolve a
 * teacher or an enrolment count.
 */

type AdminRole = "student" | "teacher" | "admin"

/** Row shape returned to the admin table. */
type AdminCourse = {
  id: string
  code: string
  title: string
  description: string | null
  semester: string | null
  academic_year: string | null
  school: string | null
  credit_total: number | null
  credit_lecture: number | null
  credit_lab: number | null
  credit_self_study: number | null
  grading_type: string | null
  further_information: string | null
  teacher_id: string | null
  teacher_name: string | null
  teacher_email: string | null
  enrolled_students: number
  documents: number
  documents_ready: number
  sections: number
  created_at: string
}

type SectionInput = {
  id?: string
  section_no: string
  section_type: string
  timetable: string | null
  room: string | null
  capacity: number
  requested: number
}

const COURSE_DETAIL_COLUMNS =
  "id, code, title, description, semester, academic_year, school, credit_total, credit_lecture, credit_lab, credit_self_study, grading_type, further_information, teacher_id, created_at"

/** Coerce a value to a number, or null when it is absent or not finite. */
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Resolve a list of teacher emails to profile ids.
 *
 * Emails are what an administrator has to hand; ids are what the tables store.
 * Every address must resolve to a teacher, because a typo would otherwise
 * silently grant nobody access, or a student address would grant a student the
 * course. Returns the ids in the order given, de-duplicated.
 */
async function resolveTeacherEmails(
  supabase: any,
  emails: string[],
): Promise<{ ids: string[]; error: string | null }> {
  const cleaned = Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
  if (cleaned.length === 0) return { ids: [], error: null }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .in("email", cleaned)

  if (error) return { ids: [], error: error.message }

  const byEmail = new Map<string, { id: string; role: string }>()
  for (const row of data ?? []) {
    byEmail.set(String(row.email).toLowerCase(), { id: row.id, role: row.role })
  }

  const missing = cleaned.filter((email) => !byEmail.has(email))
  if (missing.length > 0) {
    return { ids: [], error: `No account found for: ${missing.join(", ")}` }
  }

  const notTeacher = cleaned.filter((email) => byEmail.get(email)!.role !== "teacher")
  if (notTeacher.length > 0) {
    return {
      ids: [],
      error: `These accounts are not teachers: ${notTeacher.join(", ")}`,
    }
  }

  return { ids: cleaned.map((email) => byEmail.get(email)!.id), error: null }
}

/**
 * Give `courseId` exactly this set of teachers.
 *
 * The first teacher also becomes the legacy `courses.teacher_id` owner, which
 * older queries and the student-facing course payload still read. Removing the
 * last teacher leaves `teacher_id` null, which is the same "unassigned" state
 * the single-teacher form had.
 */
async function replaceCourseTeachers(
  supabase: any,
  courseId: string,
  teacherIds: string[],
): Promise<{ error: string | null }> {
  const unique = Array.from(new Set(teacherIds))

  const { error: deleteError } = await supabase
    .from("course_teachers")
    .delete()
    .eq("course_id", courseId)
  if (deleteError) return { error: deleteError.message }

  if (unique.length > 0) {
    const { error: insertError } = await supabase.from("course_teachers").insert(
      unique.map((teacherId, index) => ({
        course_id: courseId,
        teacher_id: teacherId,
        is_primary: index === 0,
      })),
    )
    if (insertError) return { error: insertError.message }
  }

  const { error: courseError } = await supabase
    .from("courses")
    .update({ teacher_id: unique[0] ?? null })
    .eq("id", courseId)
  if (courseError) return { error: courseError.message }

  return { error: null }
}

/**
 * Validate and normalise the section list sent by the dialog.
 *
 * Sections are replaced wholesale on save: the dialog shows the complete set, so
 * diffing would add complexity for no benefit and risk leaving a deleted section
 * behind.
 */
function parseSections(input: unknown): { sections: SectionInput[]; error: string | null } {
  if (input === undefined) return { sections: [], error: null }
  if (!Array.isArray(input)) return { sections: [], error: "sections must be an array" }

  const parsed: SectionInput[] = []
  const seen = new Set<string>()

  for (const raw of input) {
    const sectionNo = typeof raw?.section_no === "string" ? raw.section_no.trim() : ""
    if (!sectionNo) return { sections: [], error: "Every section needs a section number" }
    if (seen.has(sectionNo)) {
      return { sections: [], error: `Section ${sectionNo} is listed twice` }
    }
    seen.add(sectionNo)

    const capacity = numberOrNull(raw?.capacity) ?? 30
    const requested = numberOrNull(raw?.requested) ?? 0
    if (capacity < 0) return { sections: [], error: `Section ${sectionNo} has a negative capacity` }
    if (requested < 0) return { sections: [], error: `Section ${sectionNo} has a negative request count` }

    parsed.push({
      id: typeof raw?.id === "string" && raw.id ? raw.id : undefined,
      section_no: sectionNo,
      section_type: textOrNull(raw?.section_type) ?? "Lecture",
      timetable: textOrNull(raw?.timetable),
      room: textOrNull(raw?.room),
      capacity,
      requested,
    })
  }

  return { sections: parsed, error: null }
}

/** Sync sections in place when ids are known so enrolment `section_id` rows stay valid. */
async function replaceSections(
  supabase: ReturnType<typeof createServiceRoleClient>,
  courseId: string,
  sections: SectionInput[],
) {
  const { data: existing, error: readError } = await supabase
    .from("course_sections")
    .select("id")
    .eq("course_id", courseId)

  if (readError) return readError

  const existingIds = new Set((existing ?? []).map((row) => row.id))
  const keptIds = new Set(sections.map((section) => section.id).filter((id): id is string => Boolean(id)))

  const removeIds = [...existingIds].filter((id) => !keptIds.has(id))
  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase.from("course_sections").delete().in("id", removeIds)
    if (deleteError) return deleteError
  }

  if (sections.length === 0) return null

  for (const section of sections) {
    const row = {
      course_id: courseId,
      section_no: section.section_no,
      section_type: section.section_type,
      timetable: section.timetable,
      room: section.room,
      capacity: section.capacity,
      requested: section.requested,
    }

    if (section.id && existingIds.has(section.id)) {
      const { error } = await supabase.from("course_sections").update(row).eq("id", section.id)
      if (error) return error
    } else {
      const { error } = await supabase.from("course_sections").insert(row)
      if (error) return error
    }
  }

  return null
}

function normaliseCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

async function requireAdmin() {
  const admin = await requireAdminUser()
  if (!admin.user || !admin.isAdmin) return null
  return admin
}

/**
 * GET — optionally one course with its full section list.
 *
 * `?courseId=` returns a single course plus its sections, which the edit dialog
 * needs. The list view only needs section counts, so it stays a single pass over
 * the section table rather than N queries.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }
    const supabase = createServiceRoleClient()

    const singleCourseId = new URL(req.url).searchParams.get("courseId")
    if (singleCourseId) {
      const { data: course, error } = await supabase
        .from("courses")
        .select(COURSE_DETAIL_COLUMNS)
        .eq("id", singleCourseId)
        .maybeSingle()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

      const { data: sections } = await supabase
        .from("course_sections")
        .select("id, section_no, section_type, timetable, room, capacity, requested")
        .eq("course_id", singleCourseId)
        .order("section_no")

      // `registered` is derived, never stored: a persisted counter drifts the
      // moment a student is added or dropped through any other path.
      const { data: placements } = await supabase
        .from("course_enrollments")
        .select("section_id")
        .eq("course_id", singleCourseId)

      const registeredBySection = new Map<string, number>()
      for (const row of placements ?? []) {
        if (!row.section_id) continue
        registeredBySection.set(row.section_id, (registeredBySection.get(row.section_id) ?? 0) + 1)
      }

      return NextResponse.json({
        course,
        sections: (sections ?? []).map((section) => ({
          ...section,
          registered: registeredBySection.get(section.id) ?? 0,
        })),
      })
    }

    const { data: courses, error } = await supabase
      .from("courses")
      .select(COURSE_DETAIL_COLUMNS)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = courses ?? []
    const courseIds = rows.map((c) => c.id)

    // Every teacher per course, not just the legacy owner, so the admin table
    // can show a co-taught course as such.
    const membershipsResult = courseIds.length
      ? await supabase
          .from("course_teachers")
          .select("course_id, teacher_id, is_primary, profiles:teacher_id(id, full_name, email)")
          .in("course_id", courseIds)
      : { data: [] as any[] }

    const teachersByCourse = new Map<string, Array<{ id: string; full_name: string | null; email: string }>>()
    for (const row of membershipsResult.data ?? []) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      if (!profile) continue
      const list = teachersByCourse.get(row.course_id) ?? []
      list.push({ id: profile.id, full_name: profile.full_name ?? null, email: profile.email })
      teachersByCourse.set(row.course_id, list)
    }

    const teacherIds = Array.from(
      new Set((membershipsResult.data ?? []).map((row: any) => row.teacher_id).filter(Boolean)),
    ) as string[]
    const [teachersResult, enrollmentsResult, materialsResult, chunksResult, sectionsResult] =
      await Promise.all([
        teacherIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", teacherIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from("course_enrollments").select("course_id").in("course_id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from("course_materials").select("id, course_id").in("course_id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
        // Count chunks per material so "ready" reflects indexed content.
        courseIds.length
          ? supabase.from("course_material_chunks").select("material_id").limit(5000)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from("course_sections").select("course_id").in("course_id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

    const teacherMap = new Map((teachersResult.data ?? []).map((t: any) => [t.id, t]))

    const enrolCount = new Map<string, number>()
    for (const row of enrollmentsResult.data ?? []) {
      enrolCount.set(row.course_id, (enrolCount.get(row.course_id) ?? 0) + 1)
    }

    const materialsByCourse = new Map<string, string[]>()
    for (const material of materialsResult.data ?? []) {
      const list = materialsByCourse.get(material.course_id) ?? []
      list.push(material.id)
      materialsByCourse.set(material.course_id, list)
    }

    const indexedMaterialIds = new Set((chunksResult.data ?? []).map((c: any) => c.material_id))

    const sectionCount = new Map<string, number>()
    for (const row of sectionsResult.data ?? []) {
      sectionCount.set(row.course_id, (sectionCount.get(row.course_id) ?? 0) + 1)
    }

    const payload: AdminCourse[] = rows.map((course) => {
      const teacher = course.teacher_id ? teacherMap.get(course.teacher_id) : null
      const materialIds = materialsByCourse.get(course.id) ?? []
      return {
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        semester: course.semester,
        academic_year: course.academic_year,
        school: course.school,
        credit_total: course.credit_total,
        credit_lecture: course.credit_lecture,
        credit_lab: course.credit_lab,
        credit_self_study: course.credit_self_study,
        grading_type: course.grading_type,
        further_information: course.further_information,
        teacher_id: course.teacher_id,
        teacher_name: teacher?.full_name ?? null,
        teacher_email: teacher?.email ?? null,
        // The full teaching team. `teacher_id` remains the primary owner for
        // older readers; this is what the UI uses to show co-teachers.
        teachers: teachersByCourse.get(course.id) ?? [],
        enrolled_students: enrolCount.get(course.id) ?? 0,
        documents: materialIds.length,
        documents_ready: materialIds.filter((id) => indexedMaterialIds.has(id)).length,
        sections: sectionCount.get(course.id) ?? 0,
        created_at: course.created_at,
      }
    })

    return NextResponse.json({ courses: payload })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load courses" }, { status: 500 })
  }
}

/** POST — create a course. Admin only. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Only an administrator may create courses" }, { status: 403 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const code = normaliseCode(body?.code)
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const semester = typeof body?.semester === "string" ? body.semester.trim() : ""
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    // `teacherEmails` is the multi-teacher field. `teacherId` is still honoured
    // so any older caller keeps working.
    const teacherEmails: string[] = Array.isArray(body?.teacherEmails)
      ? body.teacherEmails.filter((value: unknown) => typeof value === "string")
      : typeof body?.teacherEmail === "string" && body.teacherEmail.trim()
        ? [body.teacherEmail]
        : []
    const legacyTeacherId =
      typeof body?.teacherId === "string" && body.teacherId.trim() ? body.teacherId.trim() : null

    if (!code) return NextResponse.json({ error: "Course code is required" }, { status: 400 })
    if (!title) return NextResponse.json({ error: "Course title is required" }, { status: 400 })
    if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code)) {
      return NextResponse.json(
        { error: "Course code must be 2-16 characters: letters, digits, or hyphens" },
        { status: 400 },
      )
    }

    const { sections, error: sectionError } = parseSections(body?.sections)
    if (sectionError) {
      return NextResponse.json({ error: sectionError }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const resolved = await resolveTeacherEmails(supabase, teacherEmails)
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }
    // An explicit legacy id wins only when no emails were supplied.
    const teacherIds = resolved.ids.length > 0
      ? resolved.ids
      : legacyTeacherId ? [legacyTeacherId] : []

    // The first teacher is also written to `courses.teacher_id` below, so it
    // must be a real teacher rather than any profile.
    if (legacyTeacherId && resolved.ids.length === 0) {
      const { data: teacher } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", legacyTeacherId)
        .maybeSingle()

      if (!teacher || teacher.role !== "teacher") {
        return NextResponse.json({ error: "The assigned teacher must have the teacher role" }, { status: 400 })
      }
    }

    const { data: created, error } = await supabase
      .from("courses")
      .insert({
        code,
        title,
        description: description || null,
        semester: semester || null,
        teacher_id: teacherIds[0] ?? null,
        academic_year: textOrNull(body?.academicYear),
        school: textOrNull(body?.school),
        credit_total: numberOrNull(body?.creditTotal),
        credit_lecture: numberOrNull(body?.creditLecture),
        credit_lab: numberOrNull(body?.creditLab),
        credit_self_study: numberOrNull(body?.creditSelfStudy),
        grading_type: textOrNull(body?.gradingType),
        further_information: textOrNull(body?.furtherInformation),
      })
      .select(COURSE_DETAIL_COLUMNS)
      .maybeSingle()

    if (error) {
      // 23505 is the unique index on `code`; say so rather than leaking SQL.
      if (error.code === "23505") {
        return NextResponse.json({ error: `Course code ${code} is already in use` }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sections are written after the course so a section failure can roll the
    // course back rather than leaving a half-configured course behind.
    if (created && sections.length > 0) {
      const sectionFailure = await replaceSections(supabase, created.id, sections)
      if (sectionFailure) {
        await supabase.from("courses").delete().eq("id", created.id)
        return NextResponse.json({ error: sectionFailure.message }, { status: 500 })
      }
    }

    // Teaching assignments. Failure here rolls the course back too, so a course
    // is never left in a state where `teacher_id` names someone who is not in
    // `course_teachers`.
    if (created) {
      const teacherFailure = await replaceCourseTeachers(supabase, created.id, teacherIds)
      if (teacherFailure.error) {
        await supabase.from("courses").delete().eq("id", created.id)
        return NextResponse.json({ error: teacherFailure.error }, { status: 500 })
      }
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.course_created",
      resourceType: "course",
      resourceId: created?.id ?? null,
      metadata: { code, title, teacherIds, sections: sections.length },
    })

    return NextResponse.json({ course: created })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create course" }, { status: 500 })
  }
}

/** PATCH — update a course's details or assign a teacher. Admin only. */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Only an administrator may change courses" }, { status: 403 })
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: "Service role key is not configured" }, { status: 503 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const courseId = typeof body?.courseId === "string" ? body.courseId.trim() : ""
    if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 })

    const supabase = createServiceRoleClient()

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body?.title === "string" && body.title.trim()) updateData.title = body.title.trim()
    if (typeof body?.description === "string") updateData.description = body.description.trim() || null
    if (typeof body?.semester === "string") updateData.semester = body.semester.trim() || null
    if (body?.academicYear !== undefined) updateData.academic_year = textOrNull(body.academicYear)
    if (body?.school !== undefined) updateData.school = textOrNull(body.school)
    if (body?.creditTotal !== undefined) updateData.credit_total = numberOrNull(body.creditTotal)
    if (body?.creditLecture !== undefined) updateData.credit_lecture = numberOrNull(body.creditLecture)
    if (body?.creditLab !== undefined) updateData.credit_lab = numberOrNull(body.creditLab)
    if (body?.creditSelfStudy !== undefined) updateData.credit_self_study = numberOrNull(body.creditSelfStudy)
    if (body?.gradingType !== undefined) updateData.grading_type = textOrNull(body.gradingType)
    if (body?.furtherInformation !== undefined) {
      updateData.further_information = textOrNull(body.furtherInformation)
    }

    const { sections, error: sectionError } = parseSections(body?.sections)
    if (sectionError) {
      return NextResponse.json({ error: sectionError }, { status: 400 })
    }

    if (body?.code !== undefined) {
      const code = normaliseCode(body.code)
      if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code)) {
        return NextResponse.json({ error: "Invalid course code" }, { status: 400 })
      }
      updateData.code = code
    }

    // `teacherEmails: []` explicitly clears everyone; `teacherId: null` does the
    // same for the older single-teacher shape. Presence is checked rather than
    // truthiness so an empty array is meaningful.
    if (body?.teacherEmails !== undefined || body?.teacherId !== undefined) {
      const emails: string[] = Array.isArray(body?.teacherEmails)
        ? body.teacherEmails.filter((value: unknown) => typeof value === "string")
        : []
      const legacyTeacherId =
        typeof body?.teacherId === "string" && body.teacherId.trim() ? body.teacherId.trim() : null

      const resolved = await resolveTeacherEmails(supabase, emails)
      if (resolved.error) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
      }

      const teacherIds = resolved.ids.length > 0 ? resolved.ids : legacyTeacherId ? [legacyTeacherId] : []

      if (legacyTeacherId && resolved.ids.length === 0) {
        const { data: teacher } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", legacyTeacherId)
          .maybeSingle()
        if (!teacher || teacher.role !== "teacher") {
          return NextResponse.json({ error: "The assigned teacher must have the teacher role" }, { status: 400 })
        }
      }

      // `replaceCourseTeachers` also writes `courses.teacher_id`, so it must not
      // be overwritten afterwards by `updateData`.
      const teacherFailure = await replaceCourseTeachers(supabase, courseId, teacherIds)
      if (teacherFailure.error) {
        return NextResponse.json({ error: teacherFailure.error }, { status: 500 })
      }
    }

    const { data: updated, error } = await supabase
      .from("courses")
      .update(updateData)
      .eq("id", courseId)
      .select(COURSE_DETAIL_COLUMNS)
      .maybeSingle()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That course code is already in use" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // `sections === undefined` means "leave them alone"; an empty array is an
    // explicit "remove all", which the dialog sends when the last row is deleted.
    if (body?.sections !== undefined) {
      const sectionFailure = await replaceSections(supabase, courseId, sections)
      if (sectionFailure) {
        return NextResponse.json({ error: sectionFailure.message }, { status: 500 })
      }
    }

    await logAuditEvent({
      supabase: admin.supabase as any,
      actorId: admin.user.id,
      action: "admin.course_updated",
      resourceType: "course",
      resourceId: courseId,
      metadata: { ...updateData, sections: body?.sections !== undefined ? sections.length : undefined },
    })

    return NextResponse.json({ course: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update course" }, { status: 500 })
  }
}

export type { AdminCourse, AdminRole }

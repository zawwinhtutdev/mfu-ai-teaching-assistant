import { NextResponse } from "next/server"
import { assertCourseAccess, clientForPrincipal, resolvePrincipal } from "@/lib/server/principal"

type RouteParams = { params: Promise<{ courseId: string }> }

function normalizeFiles(input: any) {
  if (!Array.isArray(input)) return []
  return input
    .map((file) => ({
      file_name: typeof file?.file_name === "string" ? file.file_name.trim() : "",
      file_url: typeof file?.file_url === "string" ? file.file_url.trim() : "",
      mime_type: typeof file?.mime_type === "string" ? file.mime_type : null,
      size_bytes: typeof file?.size_bytes === "number" ? file.size_bytes : null,
    }))
    .filter((file) => file.file_name && file.file_url)
}

async function buildAnnouncementResponse(supabase: any, courseId: string) {
  const { data: announcements, error: announcementsError } = await supabase
    .from("announcements")
    .select("id, course_id, author_id, title, content, is_pinned, created_at, updated_at")
    .eq("course_id", courseId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (announcementsError) {
    return { error: announcementsError.message, status: 500, announcements: [] }
  }

  const announcementRows = Array.isArray(announcements) ? announcements : []
  const announcementIds = announcementRows.map((item: any) => item.id)
  const authorIds = Array.from(new Set(announcementRows.map((item: any) => item.author_id).filter(Boolean)))

  const [{ data: files }, { data: authors }] = await Promise.all([
    announcementIds.length
      ? supabase
          .from("announcement_files")
          .select("id, announcement_id, file_name, file_url, mime_type, size_bytes, created_at")
          .in("announcement_id", announcementIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds)
      : Promise.resolve({ data: [] }),
  ])

  const filesByAnnouncement = new Map<string, any[]>()
  for (const file of files || []) {
    const list = filesByAnnouncement.get(file.announcement_id) || []
    list.push(file)
    filesByAnnouncement.set(file.announcement_id, list)
  }

  const authorMap = new Map<string, any>()
  for (const author of authors || []) {
    authorMap.set(author.id, author)
  }

  const merged = announcementRows.map((item: any) => ({
    ...item,
    author: authorMap.get(item.author_id) || null,
    files: filesByAnnouncement.get(item.id) || [],
  }))

  return { error: null, status: 200, announcements: merged }
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { courseId } = await params
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const supabase = await clientForPrincipal(principal)
    const result = await buildAnnouncementResponse(supabase, course.id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ announcements: result.announcements })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load announcements" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { courseId } = await params
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (principal.role !== "teacher" && principal.role !== "admin") {
      return NextResponse.json({ error: "Only the course teacher may post announcements" }, { status: 403 })
    }

    const course = await assertCourseAccess(principal, courseId)
    if (!course) {
      return NextResponse.json({ error: "You do not have access to this course" }, { status: 403 })
    }

    const body = await req.json()
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    const titleFromBody = typeof body?.title === "string" ? body.title.trim() : ""
    const title = titleFromBody || (content.slice(0, 80) || "Announcement")
    const files = normalizeFiles(body?.files)

    if (!content) {
      return NextResponse.json({ error: "Announcement content is required" }, { status: 400 })
    }

    const supabase = await clientForPrincipal(principal)

    const { data: inserted, error: insertError } = await supabase
      .from("announcements")
      .insert({
        course_id: course.id,
        // A demo principal has a seed id, not a profile row; leaving the author
        // null keeps the foreign key valid instead of rejecting the insert.
        author_id: principal.isPersistable ? principal.userId : null,
        title,
        content,
      })
      .select("id, course_id, author_id, title, content, is_pinned, created_at, updated_at")
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message || "Failed to create announcement" }, { status: 500 })
    }

    if (files.length > 0) {
      const fileRows = files.map((file) => ({
        announcement_id: inserted.id,
        file_name: file.file_name,
        file_url: file.file_url,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
      }))
      const { error: fileError } = await supabase.from("announcement_files").insert(fileRows)
      if (fileError) {
        return NextResponse.json({ error: fileError.message }, { status: 500 })
      }

      // An announcement attachment is also course material: mirror it so the
      // Materials tab lists the same file without a second upload. Created only
      // when files exist, so text-only announcements leave Materials untouched.
      const { error: materialError } = await supabase.from("course_materials").insert(
        files.map((file) => ({
          course_id: course.id,
          title: file.file_name,
          content: `Attached to announcement: ${title}`,
          material_type: "document",
          file_url: file.file_url,
          approval_status: "published",
        })),
      )
      if (materialError) {
        // The announcement still stands; surface the miss without failing it.
        console.error("[announcements] could not mirror attachments into materials:", materialError.message)
      }
    }

    const result = await buildAnnouncementResponse(supabase, course.id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const announcement = result.announcements.find((item: any) => item.id === inserted.id) || null
    return NextResponse.json({ announcement })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create announcement" }, { status: 500 })
  }
}

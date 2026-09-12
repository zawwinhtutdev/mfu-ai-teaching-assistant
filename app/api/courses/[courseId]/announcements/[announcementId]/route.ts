import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteParams = { params: Promise<{ courseId: string; announcementId: string }> }

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { courseId, announcementId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    const titleFromBody = typeof body?.title === "string" ? body.title.trim() : ""
    const title = titleFromBody || (content.slice(0, 80) || "Announcement")

    if (!content) {
      return NextResponse.json({ error: "Announcement content is required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("announcements")
      .update({
        content,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcementId)
      .eq("course_id", courseId)
      .select("id")
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to update announcement" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update announcement" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  try {
    const { courseId, announcementId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId)
      .eq("course_id", courseId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete announcement" }, { status: 500 })
  }
}

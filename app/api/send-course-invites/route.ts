import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type SendInvitesBody = {
  courseId?: string
  courseCode?: string
  courseTitle?: string
  emails?: string[]
  inviteLink?: string
}

function normalizeEmails(emails: unknown) {
  if (!Array.isArray(emails)) {
    return []
  }

  return Array.from(
    new Set(
      emails
        .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
        .filter((email) => email.length > 0 && email.includes("@")),
    ),
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as SendInvitesBody
    const emails = normalizeEmails(body.emails)

    if (!body.courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }
    if (emails.length === 0) {
      return NextResponse.json({ error: "At least one valid email is required" }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id,code,title,teacher_id")
      .eq("id", body.courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }
    if (course.teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const jobsToInsert = emails.map((email) => ({
      user_id: user.id,
      course_id: course.id,
      channel: "email",
      template: "course_invite",
      payload: {
        email,
        inviteLink: body.inviteLink || null,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
      },
      status: "queued",
    }))

    const { data: insertedJobs, error: jobsError } = await supabase
      .from("notification_jobs")
      .insert(jobsToInsert)
      .select("id")

    if (jobsError) {
      // If the phase-0 notifications tables are not migrated yet, keep this endpoint non-breaking.
      if (jobsError.code === "42P01") {
        return NextResponse.json({
          queued: 0,
          emailsCount: emails.length,
          warning: "notification_jobs table is not available yet",
        })
      }
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }

    if (insertedJobs && insertedJobs.length > 0) {
      const deliveries = insertedJobs.map((job, index) => ({
        job_id: job.id,
        channel: "email",
        destination: emails[index] || null,
        status: "queued",
      }))

      const { error: deliveriesError } = await supabase.from("notification_deliveries").insert(deliveries)
      if (deliveriesError && deliveriesError.code !== "42P01") {
        console.error("Failed to queue notification deliveries:", deliveriesError)
      }
    }

    return NextResponse.json({
      queued: insertedJobs?.length || 0,
      emailsCount: emails.length,
      course: { id: course.id, code: course.code, title: course.title },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to queue invites" }, { status: 500 })
  }
}

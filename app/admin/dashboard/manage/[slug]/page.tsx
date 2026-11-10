import Link from "next/link"
import { notFound } from "next/navigation"

const SECTIONS: Record<string, { title: string; description: string }> = {
  "info-fields": {
    title: "Course Info Fields",
    description: "Choose which fields a teacher fills in when creating a course.",
  },
  approval: {
    title: "Course Approval",
    description: "Decide whether new courses need an administrator to approve them before students can join.",
  },
  "bulk-post": {
    title: "Bulk Post",
    description: "Publish an announcement to several courses at once.",
  },
  playback: {
    title: "Simultaneous playback restrictions",
    description: "Limit how many devices can play the same material at the same time.",
  },
  downloads: {
    title: "File download settings",
    description: "Control whether students may download course files or only view them.",
  },
  defaults: {
    title: "Course default settings",
    description: "Defaults applied to every new course in the organization.",
  },
}

export function generateStaticParams() {
  return Object.keys(SECTIONS).map((slug) => ({ slug }))
}

export default async function CourseSettingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const section = SECTIONS[slug]
  if (!section) notFound()

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#232334", margin: 0 }}>{section.title}</h1>
      </div>
      <p style={{ margin: "0 0 22px", fontSize: 14, color: "#8d92a6" }}>{section.description}</p>

      <div
        style={{
          border: "1px solid #eff1f6",
          borderRadius: 12,
          background: "#fff",
          padding: "44px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          <span style={{ width: 76, height: 38, borderRadius: 10, background: "#eef0f6" }} />
          <span style={{ width: 76, height: 38, borderRadius: 10, background: "#eef0f6" }} />
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#666b80" }}>Nothing configured yet.</p>
        <p style={{ margin: 0, fontSize: 13, color: "#8d92a6" }}>
          This setting stays at the platform default until it is changed here.
        </p>
      </div>

      <p style={{ marginTop: 18, fontSize: 13, color: "#8d92a6" }}>
        <Link href="/admin/dashboard" style={{ color: "#232334", textDecoration: "underline" }}>
          Back to course list
        </Link>
      </p>
    </div>
  )
}

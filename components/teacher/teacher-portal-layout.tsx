"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Profile, Course } from "@/lib/types"
import { UserNav } from "@/components/user-nav"
import { PortalShell, type PortalNavGroup, type PortalRailItem } from "@/components/portal/portal-shell"
import { Calendar, BarChart3, Bot, Building, Settings, LayoutGrid, FileText, BookOpen } from "lucide-react"

interface TeacherPortalLayoutProps {
  profile: Profile
  courses: Course[]
  children: React.ReactNode
}

const pageTitles: Record<string, { title: string; crumbs: string[] }> = {
  "/teacherportal/mycourses": { title: "My Courses", crumbs: ["Teacher Portal", "My Courses"] },
  "/teacherportal/calendar": { title: "Calendar & Schedule", crumbs: ["Teacher Portal", "Calendar"] },
  "/teacherportal/analytics": { title: "Analytics", crumbs: ["Teacher Portal", "Analytics"] },
  "/teacherportal/agentbuilder": { title: "Agent Builder", crumbs: ["Teacher Portal", "Agent Builder"] },
  "/teacherportal/documents": { title: "Documents", crumbs: ["Teacher Portal", "Documents"] },
  "/teacherportal/mfucampusresources": { title: "MFU Campus Guide", crumbs: ["Teacher Portal", "Campus Guide"] },
  "/teacherportal/settings": { title: "Settings", crumbs: ["Teacher Portal", "Settings"] },
}

export function TeacherPortalLayout({ profile, courses, children }: TeacherPortalLayoutProps) {
  const pathname = usePathname() || ""

  const nav: PortalNavGroup[] = [
    {
      label: "Teaching",
      items: [
        { href: "/teacherportal/mycourses", label: "My Courses", icon: LayoutGrid },
        { href: "/teacherportal/calendar", label: "Calendar", icon: Calendar },
        { href: "/teacherportal/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Coursework",
      items: [
        { href: "/teacherportal/documents", label: "Documents", icon: FileText },
        { href: "/teacherportal/agentbuilder", label: "Agent Builder", icon: Bot },
      ],
    },
    {
      label: "Campus",
      items: [{ href: "/teacherportal/mfucampusresources", label: "Campus Guide", icon: Building }],
    },
    {
      label: "Account",
      items: [{ href: "/teacherportal/settings", label: "Settings", icon: Settings }],
    },
  ]

  const railItems: PortalRailItem[] = [
    { href: "/teacherportal/mycourses", label: "Courses", icon: LayoutGrid },
    { href: "/teacherportal/calendar", label: "Calendar", icon: Calendar },
    { href: "/teacherportal/analytics", label: "Insights", icon: BarChart3 },
    { href: "/teacherportal/agentbuilder", label: "Agents", icon: Bot },
    { href: "/teacherportal/settings", label: "Settings", icon: Settings },
  ]

  const courseMatch = pathname.match(/^\/teacherportal\/mycourses\/([^/]+)/)
  const activeCourse = courseMatch ? courses.find((c) => c.id === courseMatch[1]) : undefined

  const base = Object.keys(pageTitles).find(
    (p) => pathname === p || (pathname.startsWith(p + "/") && p !== "/teacherportal/mycourses"),
  )
  const page = activeCourse
    ? { title: activeCourse.title, crumbs: ["Teacher Portal", "My Courses", activeCourse.title] }
    : pageTitles[base || "/teacherportal/mycourses"] || { title: "Teacher Portal", crumbs: ["Teacher Portal"] }

  const courseList =
    courses.length > 0 ? (
      <>
        <div className="mfp-side-group">My courses</div>
        {courses.slice(0, 8).map((course) => {
          const active = activeCourse?.id === course.id
          return (
            <Link
              key={course.id}
              href={`/teacherportal/mycourses/${course.id}`}
              className="mfp-nav-item"
              data-active={active}
              style={{ height: 36 }}
            >
              <BookOpen size={16} />
              <span className="truncate">{course.title}</span>
            </Link>
          )
        })}
      </>
    ) : null

  return (
    <PortalShell
      variant="teacher"
      chrome="sidebar"
      productName="Teacher Portal"
      title={page.title}
      crumbs={page.crumbs}
      nav={nav}
      railItems={railItems}
      extra={courseList}
      contextChip={
        courses.length > 0 ? `${courses.length} course${courses.length === 1 ? "" : "s"}` : "No courses yet"
      }
      actions={
        <>
          <UserNav profile={profile} />
        </>
      }
    >
      {children}
    </PortalShell>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Profile, Course } from "@/lib/types"
import { UserNav } from "@/components/user-nav"
import {
  PortalShell,
  type PortalNavGroup,
  type PortalNavItem,
  type PortalRailItem,
} from "@/components/portal/portal-shell"
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

  // No `contextChip` is passed: the course count is already visible in the
  // sidebar under "My Courses", so a badge repeating it in the header was noise.

  // Course shortcuts live under "My Courses" as a disclosure rather than in the
  // sidebar footer. A footer at the very bottom put them far from the nav item
  // that names them, and it competed with the account block for that space.
  const courseChildren: PortalNavItem[] =
    courses.length > 0
      ? courses.slice(0, 12).map((course) => ({
          href: `/teacherportal/mycourses/${course.id}`,
          label: course.title,
          icon: BookOpen,
          depth: 1,
        }))
      : []

  const nav: PortalNavGroup[] = [
    {
      label: "Teaching",
      items: [
        {
          href: "/teacherportal/mycourses",
          label: "My Courses",
          icon: LayoutGrid,
          // Exact so the parent is only current on the list itself, not on a
          // course detail page where the child is the selected row.
          exact: true,
          children: courseChildren,
        },
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

  return (
    <PortalShell
      variant="teacher"
      chrome="sidebar"
      productName="Teacher Portal"
      title={page.title}
      crumbs={page.crumbs}
      nav={nav}
      railItems={railItems}
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

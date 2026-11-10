"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Profile, Course } from "@/lib/types"
import { UserNav } from "@/components/user-nav"
import { PortalShell, type PortalNavGroup, type PortalRailItem } from "@/components/portal/portal-shell"
import {
  Calendar,
  Bell,
  Brain,
  Settings,
  LayoutGrid,
  Users,
  FileText,
  Search,
  ChevronDown,
  House,
} from "lucide-react"
import { slugify } from "@/lib/utils"

interface StudentPortalLayoutProps {
  profile: Profile
  courses: Course[]
  children: React.ReactNode
}

const pageTitles: Record<string, { title: string; crumbs: string[] }> = {
  "/studentportal/mycourses": { title: "My Courses", crumbs: ["Student Portal", "My Courses"] },
  "/studentportal/calendar": { title: "Calendar & Notifications", crumbs: ["Student Portal", "Calendar"] },
  "/studentportal/reminders": { title: "Study Reminders", crumbs: ["Student Portal", "Reminders"] },
  "/studentportal/aistudytools": { title: "AI Study Tools", crumbs: ["Student Portal", "AI Study Tools"] },
  "/studentportal/documents": { title: "Documents", crumbs: ["Student Portal", "Documents"] },
  "/studentportal/analytics": { title: "Analytics", crumbs: ["Student Portal", "Analytics"] },
  "/studentportal/agentbuilder": { title: "Agent Builder", crumbs: ["Student Portal", "Agent Builder"] },
  "/studentportal/mfucampusresources": { title: "MFU Campus Guide", crumbs: ["Student Portal", "Campus Guide"] },
  "/studentportal/mfuclubs": { title: "MFU Social", crumbs: ["Student Portal", "MFU Social"] },
  "/studentportal/settings": { title: "Settings", crumbs: ["Student Portal", "Settings"] },
}

export function StudentPortalLayout({ profile, courses, children }: StudentPortalLayoutProps) {
  const pathname = usePathname() || ""
  const [coursesOpen, setCoursesOpen] = useState(true)

  const nav: PortalNavGroup[] = [
    {
      label: "Learning",
      items: [
        { href: "/studentportal/mycourses", label: "My Courses", icon: LayoutGrid },
        { href: "/studentportal/calendar", label: "Calendar", icon: Calendar },
        { href: "/studentportal/reminders", label: "Reminders", icon: Bell },
        { href: "/studentportal/aistudytools", label: "AI Study Tools", icon: Brain },
      ],
    },
    {
      label: "Study",
      items: [
        { href: "/studentportal/documents", label: "Documents", icon: FileText },
        { href: "/studentportal/analytics", label: "Analytics", icon: Search },
        { href: "/studentportal/agentbuilder", label: "Agent Builder", icon: Brain },
      ],
    },
    {
      label: "Account",
      items: [{ href: "/studentportal/settings", label: "Settings", icon: Settings }],
    },
  ]

  const railItems: PortalRailItem[] = [
    { href: "/studentportal/mycourses", label: "Courses", icon: LayoutGrid },
    { href: "/studentportal/calendar", label: "Calendar", icon: Calendar },
    { href: "/studentportal/aistudytools", label: "Study", icon: Brain },
    { href: "/studentportal/mfuclubs", label: "Social", icon: Users },
    { href: "/studentportal/settings", label: "Settings", icon: Settings },
  ]

  const courseMatch = pathname.match(/^\/studentportal\/mycourses\/([^/]+)/)
  const activeCourse = courseMatch
    ? courses.find((c) => slugify(c.title) === courseMatch[1])
    : undefined

  const base = Object.keys(pageTitles).find(
    (p) => pathname === p || (pathname.startsWith(p + "/") && p !== "/studentportal/mycourses"),
  )
  const page = activeCourse
    ? { title: activeCourse.title, crumbs: ["Student Portal", "My Courses", activeCourse.title] }
    : pageTitles[base || "/studentportal/mycourses"] || { title: "Student Portal", crumbs: ["Student Portal"] }

  const coursePicker =
    courses.length > 0 ? (
      <div className="mfp-course-picker">
        <button
          type="button"
          className="mfp-course-toggle"
          aria-expanded={coursesOpen}
          aria-controls="mfp-course-list"
          onClick={() => setCoursesOpen((open) => !open)}
        >
          <House size={17} />
          <span>My courses</span>
          <ChevronDown
            size={16}
            className="mfp-course-chev"
            data-open={coursesOpen}
            aria-hidden
          />
        </button>

        {coursesOpen ? (
          <div id="mfp-course-list" className="mfp-course-list">
            {courses.slice(0, 8).map((course) => {
              const slug = slugify(course.title)
              return (
                <Link
                  key={course.id}
                  href={`/studentportal/mycourses/${slug}`}
                  className="mfp-course-item"
                  data-active={slug === courseMatch?.[1]}
                  title={course.title}
                >
                  {course.code ? <span className="mfp-course-code">[{course.code}]</span> : null}
                  <span className="truncate">{course.title}</span>
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>
    ) : null

  return (
    <PortalShell
      variant="student"
      chrome="rail"
      productName="Student Portal"
      title={page.title}
      crumbs={page.crumbs}
      nav={nav}
      railItems={railItems}
      extraTop={coursePicker}
      actions={<UserNav profile={profile} />}
    >
      {children}
    </PortalShell>
  )
}
